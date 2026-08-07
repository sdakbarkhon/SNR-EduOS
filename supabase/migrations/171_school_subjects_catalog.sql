-- Migration 171: school_subjects — справочник предметов школы (Z.2.1)
--
-- Первый шаг переделки админки (plan-z2-admin-rebuild.md, 11 шагов, 5 миграций).
--
-- ПРОБЛЕМА. public.subjects — таблица НА ГРУППУ: group_id NOT NULL,
-- UNIQUE(name, group_id). Поэтому один предмет физически существует как N
-- строк с N разными id — в демо-школе 29 строк на 14 уникальных названий.
-- Определение предмета (название, иконка, цвет) сплавлено со связкой
-- «предмет в группе», из-за чего админ вводит название и выбирает учителя
-- заново для каждой группы.
--
-- РЕШЕНИЕ «разделить, а не заменять». Определение выносится в новый
-- справочник school_subjects, а subjects остаётся НАЗНАЧЕНИЕМ
-- «предмет × группа × учитель». Ключевое: subjects.id, subjects.teacher_id и
-- subjects.name НЕ меняются, поэтому ни один FK и ни один RLS-предикат не
-- задет.
--
-- ПОЧЕМУ В СПРАВОЧНИКЕ НЕТ teacher_id. Соблазнительно перенести учителя на
-- строку справочника («предмет школы ведёт такой-то»), но так теряются
-- данные: у «Программирования» 4 строки под ДВУМЯ разными учителями
-- (teacher_prog в 3-А/7-А/10-А и другой учитель в W-5) — проверено, это
-- единственное такое название из 14. Учитель остаётся на строке назначения.
--
-- БЕЗОПАСНОСТЬ ОТНОСИТЕЛЬНО ЖИВЫХ ПРЕДИКАТОВ (см. §3 плана):
--   * subjects.teacher_id НЕ переписывается ни одной строкой этой миграции,
--     поэтому триггер trg_subject_teacher_direct_chats (AFTER INSERT OR
--     UPDATE OF teacher_id), порождающий личные чаты со всеми учениками
--     группы, НЕ срабатывает;
--   * teachers.subject_slug и groups.subject не трогаются вовсе;
--   * единственный UPDATE по subjects затрагивает только новую колонку
--     catalog_id, которую не читает ни одна политика; trg_subjects_updated_at
--     при этом бампнет updated_at — это ожидаемо и безвредно.
--
-- ИДЕМПОТЕНТНОСТЬ: IF NOT EXISTS на объектах, ON CONFLICT DO NOTHING на
-- вставке, UPDATE только там, где catalog_id ещё NULL. Повторный запуск
-- ничего не дублирует и не перезаписывает.

BEGIN;

-- ── 1. Справочник ────────────────────────────────────────────────────────────
-- icon/color повторяют форму subjects: NOT NULL с теми же дефолтами
-- ('BookOpen' / '#64748B'), чтобы UI не пришлось учить обрабатывать NULL.
CREATE TABLE IF NOT EXISTS public.school_subjects (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id  uuid NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  name       text NOT NULL,
  icon       text NOT NULL DEFAULT 'BookOpen',
  color      text NOT NULL DEFAULT '#64748B',
  is_active  boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT school_subjects_name_unique UNIQUE (school_id, name)
);

COMMENT ON TABLE public.school_subjects IS
  'Справочник предметов школы (Z.2.1). Определение предмета: название/иконка/цвет. НЕ содержит учителя — он живёт на строке назначения public.subjects, потому что один предмет школы может вести разный учитель в разных группах.';
COMMENT ON COLUMN public.school_subjects.is_active IS
  'false = предмет скрыт: не показывается в выпадающих списках, но не удалён (решение заказчика 06.08 — скрывать, а не удалять).';

CREATE INDEX IF NOT EXISTS idx_school_subjects_school
  ON public.school_subjects (school_id);

-- updated_at — тот же паттерн, что у соседей (fn_subjects_updated_at,
-- fn_sandbox_projects_updated_at): своя функция на таблицу.
CREATE OR REPLACE FUNCTION public.fn_school_subjects_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_school_subjects_updated_at ON public.school_subjects;
CREATE TRIGGER trg_school_subjects_updated_at
  BEFORE UPDATE ON public.school_subjects
  FOR EACH ROW EXECUTE FUNCTION public.fn_school_subjects_updated_at();

-- ── 2. RLS — дословно по образцу subjects ────────────────────────────────────
-- Только PERMISSIVE: RESTRICTIVE-политик в схеме ноль, прецедент не заводим
-- (см. обоснование в миграции 170).
ALTER TABLE public.school_subjects ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS school_subjects_select_authenticated ON public.school_subjects;
CREATE POLICY school_subjects_select_authenticated ON public.school_subjects
  FOR SELECT USING (public.is_super_admin() OR school_id = public.current_school_id());

DROP POLICY IF EXISTS school_subjects_insert_admin ON public.school_subjects;
CREATE POLICY school_subjects_insert_admin ON public.school_subjects
  FOR INSERT WITH CHECK (
    (public.fn_is_admin() AND school_id = public.current_school_id()) OR public.is_super_admin()
  );

DROP POLICY IF EXISTS school_subjects_update_admin ON public.school_subjects;
CREATE POLICY school_subjects_update_admin ON public.school_subjects
  FOR UPDATE USING (
    (public.fn_is_admin() AND school_id = public.current_school_id()) OR public.is_super_admin()
  ) WITH CHECK (
    (public.fn_is_admin() AND school_id = public.current_school_id()) OR public.is_super_admin()
  );

DROP POLICY IF EXISTS school_subjects_delete_admin ON public.school_subjects;
CREATE POLICY school_subjects_delete_admin ON public.school_subjects
  FOR DELETE USING (
    (public.fn_is_admin() AND school_id = public.current_school_id()) OR public.is_super_admin()
  );

-- ── 3. Связь назначения со справочником ──────────────────────────────────────
-- ON DELETE SET NULL, а не CASCADE: удаление записи справочника не должно
-- уносить назначения вместе с привязанными к ним уроками.
ALTER TABLE public.subjects
  ADD COLUMN IF NOT EXISTS catalog_id uuid NULL
  REFERENCES public.school_subjects(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_subjects_catalog_id ON public.subjects (catalog_id);

COMMENT ON COLUMN public.subjects.catalog_id IS
  'Ссылка на запись справочника school_subjects. NULL = назначение, заведённое до Z.2.1 или после удаления записи справочника.';

-- ── 4. Бэкфилл справочника из существующих назначений ────────────────────────
-- DISTINCT ON (school_id, name) — у одного названия в пределах школы iconов и
-- цветов может быть в теории несколько; живой проверкой подтверждено, что
-- сейчас у всех 14 названий ровно по одному варианту каждого, так что выбор
-- «первой» строки однозначен.
INSERT INTO public.school_subjects (school_id, name, icon, color, is_active)
SELECT DISTINCT ON (s.school_id, s.name)
       s.school_id, s.name, s.icon, s.color, true
FROM public.subjects s
ORDER BY s.school_id, s.name, s.created_at
ON CONFLICT (school_id, name) DO NOTHING;

-- ── 5. Проставить catalog_id ─────────────────────────────────────────────────
-- Затрагивает ТОЛЬКО catalog_id. teacher_id не участвует → чат-триггер молчит.
UPDATE public.subjects s
   SET catalog_id = cs.id
  FROM public.school_subjects cs
 WHERE cs.school_id = s.school_id
   AND cs.name = s.name
   AND s.catalog_id IS NULL;

-- ── 6. Скрыть предметы без единого использования ─────────────────────────────
-- Критерий — фактическое использование (уроки / ДЗ / учебные планы), а не
-- флаг is_stub: живой проверкой подтверждено, что оба критерия дают ровно
-- один и тот же набор, но использование — свойство данных, а is_stub лишь
-- отметка, проставленная миграцией 98.
--
-- ВАЖНО ПРО АРИФМЕТИКУ: 13 «пустых» — это количество СТРОК subjects, а
-- справочник хранит НАЗВАНИЯ. Те 13 строк схлопываются в 9 названий
-- (Биология ×2, История ×2, Физика ×2, Химия ×2 = 8 строк → 4 названия, плюс
-- География, ИЗО, Музыка, Обществознание, Природоведение = 5 строк → 5
-- названий). Поэтому здесь скрывается ровно 9 записей справочника, и это
-- согласовано с заказчиком.
UPDATE public.school_subjects cs
   SET is_active = false
 WHERE cs.is_active
   AND NOT EXISTS (
     SELECT 1
       FROM public.subjects s
      WHERE s.catalog_id = cs.id
        AND (
             EXISTS (SELECT 1 FROM public.lessons          l  WHERE l.subject_id  = s.id)
          OR EXISTS (SELECT 1 FROM public.homework         h  WHERE h.subject_id  = s.id)
          OR EXISTS (SELECT 1 FROM public.curriculum_plans cp WHERE cp.subject_id = s.id)
        )
   );

COMMIT;
