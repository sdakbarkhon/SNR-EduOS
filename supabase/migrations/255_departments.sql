-- ============================================================================
-- Миграция 255: кафедра как сущность. Библиотека переходит со слага на неё.
-- ============================================================================
--
-- ═══ ЧТО БЫЛО ══════════════════════════════════════════════════════════════
--
-- «Кафедра» существовала только как слово в интерфейсе. На деле материалы
-- лежали с колонкой `subject_slug` — пятью словами из списка в коде, а право
-- на них считала функция `fn_my_subject_slugs()` (миграции 190/191) вот так:
--
--     слаг моей карточки
--     ∪ слаг карточки ОДНОПРЕДМЕТНОГО коллеги по тому же предмету справочника
--
-- Вторая половина — обход, а не правило. Слага у предмета в базе нет вовсе:
-- ни в `subjects`, ни в `school_subjects`. Соответствие «название → слаг»
-- живёт в коде, и функция добывала слаг оттуда, где он в базе всё-таки
-- лежит, — с чужих карточек. Отсюда прямые следствия, записанные в шапке 190:
-- предмет, которого нет в словаре кода («Схемотехника», «Science»), кафедры
-- не получал НИКОГДА и материалов иметь не мог.
--
-- ═══ ЧТО СТАНОВИТСЯ ════════════════════════════════════════════════════════
--
-- Кафедра — своя таблица. У неё есть имя, которое переименовывают, и она
-- держит материалы. Предмет справочника ссылается на кафедру, материал
-- ссылается на кафедру. Слаг в расчёте права больше не участвует.
--
-- Право становится одной строкой: мои кафедры — это кафедры предметов, на
-- которые я назначен. Никаких чужих карточек.
--
-- ═══ ПЕРЕЕЗД: ОДНА КАФЕДРА НА ПРЕДМЕТ ══════════════════════════════════════
--
-- Решение заказчика: девятнадцать кафедр из девятнадцати предметов, имя то
-- же. Группировать по смыслу («Математика и Физика — точные науки») нельзя:
-- угадывание ошибётся, а объединить две кафедры руками админ сможет потом.
--
-- ═══ КТО ТЕРЯЕТ ДОСТУП ═════════════════════════════════════════════════════
--
-- Учитель с карточкой, но без единого назначения (teacher_svr27, SNR School)
-- сегодня видит кафедру по слагу карточки; после переезда — не видит ничего.
-- Это согласовано: карточка говорит про первое назначение, а не про то, что
-- человек ведёт сейчас. Материалов у него нет, терять нечего.
--
-- ═══ ЧЕГО ЭТА МИГРАЦИЯ НЕ ДЕЛАЕТ ═══════════════════════════════════════════
--
-- Слаг не удаляется ни у материалов, ни у учителей: у материала он остаётся
-- подписью предмета на карточке, у витрины — способом выбрать демо-учителя.
-- Слаг уходит в конце цепочки заходов, отдельно и осознанно.
-- ============================================================================

-- ── 1. Таблица кафедр ───────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.departments (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id  uuid NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  name       text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT departments_name_unique UNIQUE (school_id, name)
);

COMMENT ON TABLE public.departments IS
  'Кафедра школы: имя плюс библиотека материалов. Предмет справочника ссылается на кафедру (school_subjects.department_id), материал — тоже (teacher_library_materials.department_id). Одна кафедра может держать несколько предметов: две кафедры сливают, переставив ссылки предметов и материалов на одну из них.';

CREATE INDEX IF NOT EXISTS idx_departments_school ON public.departments (school_id);

CREATE OR REPLACE FUNCTION public.fn_departments_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_departments_updated_at ON public.departments;
CREATE TRIGGER trg_departments_updated_at
  BEFORE UPDATE ON public.departments
  FOR EACH ROW EXECUTE FUNCTION public.fn_departments_updated_at();

-- RLS — дословно по образцу school_subjects (миграция 171). Только
-- PERMISSIVE: RESTRICTIVE-политик в схеме ноль, прецедент не заводим.
ALTER TABLE public.departments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS departments_select_authenticated ON public.departments;
CREATE POLICY departments_select_authenticated ON public.departments
  FOR SELECT USING (public.is_super_admin() OR school_id = public.current_school_id());

DROP POLICY IF EXISTS departments_insert_admin ON public.departments;
CREATE POLICY departments_insert_admin ON public.departments
  FOR INSERT WITH CHECK (
    (public.fn_is_admin() AND school_id = public.current_school_id()) OR public.is_super_admin()
  );

DROP POLICY IF EXISTS departments_update_admin ON public.departments;
CREATE POLICY departments_update_admin ON public.departments
  FOR UPDATE USING (
    (public.fn_is_admin() AND school_id = public.current_school_id()) OR public.is_super_admin()
  ) WITH CHECK (
    (public.fn_is_admin() AND school_id = public.current_school_id()) OR public.is_super_admin()
  );

DROP POLICY IF EXISTS departments_delete_admin ON public.departments;
CREATE POLICY departments_delete_admin ON public.departments
  FOR DELETE USING (
    (public.fn_is_admin() AND school_id = public.current_school_id()) OR public.is_super_admin()
  );

-- ── 2. Предмет справочника знает свою кафедру ───────────────────────────────
-- ON DELETE RESTRICT: кафедру с предметами удалить нельзя. SET NULL здесь
-- означал бы предмет без кафедры — состояние, которого по решению заказчика
-- быть не должно; CASCADE унёс бы предметы вместе с уроками.
ALTER TABLE public.school_subjects
  ADD COLUMN IF NOT EXISTS department_id uuid NULL
  REFERENCES public.departments(id) ON DELETE RESTRICT;

CREATE INDEX IF NOT EXISTS idx_school_subjects_department
  ON public.school_subjects (department_id);

COMMENT ON COLUMN public.school_subjects.department_id IS
  'Кафедра предмета. Обязательна: NOT NULL ставится ниже, после переезда. Одна кафедра на предмет; несколько предметов на кафедру — можно.';

-- Одна кафедра на каждый предмет, имя то же. Уже существующие по имени не
-- дублируются: если админ успел завести кафедру с таким именем, предмет
-- прицепится к ней.
INSERT INTO public.departments (school_id, name)
SELECT ss.school_id, ss.name
  FROM public.school_subjects ss
 WHERE NOT EXISTS (
   SELECT 1 FROM public.departments d
    WHERE d.school_id = ss.school_id AND d.name = ss.name
 )
ON CONFLICT (school_id, name) DO NOTHING;

UPDATE public.school_subjects AS ss
   SET department_id = d.id
  FROM public.departments AS d
 WHERE ss.department_id IS NULL
   AND d.school_id = ss.school_id
   AND d.name = ss.name;

-- Обязательность — на уровне схемы, а не на честном слове формы.
ALTER TABLE public.school_subjects ALTER COLUMN department_id SET NOT NULL;

-- ── 3. Материал библиотеки знает свою кафедру ───────────────────────────────
ALTER TABLE public.teacher_library_materials
  ADD COLUMN IF NOT EXISTS department_id uuid NULL
  REFERENCES public.departments(id) ON DELETE RESTRICT;

CREATE INDEX IF NOT EXISTS idx_teacher_library_materials_department
  ON public.teacher_library_materials (department_id);

COMMENT ON COLUMN public.teacher_library_materials.department_id IS
  'Кафедра материала — единственное, по чему считается право доступа. Колонка subject_slug остаётся подписью предмета и в правах не участвует.';

-- Переезд: слаг → подпись словаря кода → предмет справочника той же школы →
-- его кафедра. Мост тот же, что у книг в миграции 254; список повторяет
-- packages/core/src/config/subjects.ts для слагов, которые вообще встречаются
-- в этой колонке (её заполняет teachers.subject_slug).
UPDATE public.teacher_library_materials AS m
   SET department_id = ss.department_id
  FROM (VALUES
          ('programming', 'Программирование'),
          ('robotics',    'Робототехника'),
          ('math',        'Математика'),
          ('english',     'Английский язык'),
          ('russian',     'Русский язык'),
          ('physics',     'Физика'),
          ('chemistry',   'Химия'),
          ('biology',     'Биология'),
          ('history',     'История'),
          ('geography',   'География'),
          ('informatics', 'Информатика')
       ) AS map(slug, name),
       public.school_subjects AS ss
 WHERE m.department_id IS NULL
   AND m.subject_slug   = map.slug
   AND ss.school_id     = m.school_id
   AND ss.name          = map.name;

-- ── 4. Право: политики, функция, гранты ─────────────────────────────────────
--
-- ПОРЯДОК ВАЖЕН. Функция возвращает не тот тип, что раньше (uuid вместо
-- text), поэтому CREATE OR REPLACE её не переживёт — только снести и собрать
-- заново. А снести её нельзя, пока на неё смотрят политики: DROP FUNCTION
-- откажется. Значит сначала политики, потом функция, потом политики обратно.
DROP POLICY IF EXISTS "teacher reads own subject library materials" ON public.teacher_library_materials;
DROP POLICY IF EXISTS "teacher inserts own library materials" ON public.teacher_library_materials;

DROP FUNCTION IF EXISTS public.fn_my_subject_slugs();

-- Мои кафедры = кафедры предметов, на которые я назначен. Одна строка вместо
-- прежнего обхода через карточки коллег.
--
-- SECURITY DEFINER — как и у предшественницы: политике нужно видеть строки
-- `subjects` и `school_subjects` независимо от того, что видит сам вызывающий,
-- иначе правило зациклится на собственных политиках этих таблиц.
CREATE FUNCTION public.fn_my_departments()
RETURNS TABLE(id uuid, name text, icon text, color text)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  -- icon/color — вид кафедры на экране. Берём их у предмета ТОЛЬКО пока
  -- предмет у кафедры один: тогда вид кафедры и вид предмета — про одно и то
  -- же. Слили две кафедры — общего значка у них нет, и подставлять чей-то
  -- один значило бы угадывать; экран покажет запасной.
  SELECT DISTINCT d.id, d.name,
         (SELECT CASE WHEN count(*) = 1 THEN min(x.icon)  END
            FROM public.school_subjects x WHERE x.department_id = d.id) AS icon,
         (SELECT CASE WHEN count(*) = 1 THEN min(x.color) END
            FROM public.school_subjects x WHERE x.department_id = d.id) AS color
    FROM public.subjects s
    JOIN public.school_subjects ss ON ss.id = s.catalog_id
    JOIN public.departments d ON d.id = ss.department_id
   WHERE s.teacher_id = public.current_teacher_id()
     AND s.is_active
     AND NOT s.is_stub
     AND d.school_id = public.current_school_id();
$$;

COMMENT ON FUNCTION public.fn_my_departments() IS
  'Кафедры текущего учителя: кафедры предметов, на которые он назначен. Единственное место, где считается «моя кафедра» — и для политик библиотеки, и для экрана базы знаний.';

REVOKE ALL ON FUNCTION public.fn_my_departments() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.fn_my_departments() TO authenticated;

CREATE POLICY "teacher reads own department library materials"
  ON public.teacher_library_materials FOR SELECT
  USING (
    (
      school_id = public.current_school_id()
      AND department_id IN (SELECT d.id FROM public.fn_my_departments() AS d)
    )
    OR public.is_super_admin()
  );

CREATE POLICY "teacher inserts own department library materials"
  ON public.teacher_library_materials FOR INSERT
  WITH CHECK (
    (
      uploaded_by = public.current_teacher_id()
      AND department_id IS NOT NULL
      AND department_id IN (SELECT d.id FROM public.fn_my_departments() AS d)
      AND school_id = public.current_school_id()
    )
    OR public.is_super_admin()
  );

-- ── 5. Самопроверка ─────────────────────────────────────────────────────────
-- Падает вся миграция, если что-то не сошлось.
DO $$
DECLARE
  v_subjects    integer;
  v_departments integer;
  v_no_dept     integer;
  v_materials   integer;
  v_orphans     integer;
  v_policies    integer;
BEGIN
  SELECT count(*) INTO v_subjects    FROM public.school_subjects;
  SELECT count(*) INTO v_departments FROM public.departments;
  SELECT count(*) INTO v_no_dept     FROM public.school_subjects WHERE department_id IS NULL;
  RAISE NOTICE '255: предметов %, кафедр %, предметов без кафедры %',
    v_subjects, v_departments, v_no_dept;
  IF v_no_dept <> 0 THEN
    RAISE EXCEPTION '255: % предметов остались без кафедры', v_no_dept;
  END IF;

  SELECT count(*) INTO v_materials FROM public.teacher_library_materials;
  SELECT count(*) INTO v_orphans
    FROM public.teacher_library_materials WHERE department_id IS NULL;
  RAISE NOTICE '255: материалов %, из них без кафедры %', v_materials, v_orphans;
  IF v_orphans <> 0 THEN
    RAISE EXCEPTION
      '255: % материалов не нашли кафедру. Слаг такого материала не совпал ни с одним предметом справочника его школы — заведите предмет с нужным названием и повторите, либо проставьте department_id вручную.',
      v_orphans;
  END IF;

  -- Право считается по кафедре, а не по слагу.
  SELECT count(*) INTO v_policies FROM pg_policies
   WHERE schemaname = 'public' AND tablename = 'teacher_library_materials'
     AND (coalesce(qual,'') || coalesce(with_check,'')) LIKE '%fn_my_departments%';
  IF v_policies <> 2 THEN
    RAISE EXCEPTION '255: политик библиотеки на кафедре % из 2', v_policies;
  END IF;

  SELECT count(*) INTO v_policies FROM pg_policies
   WHERE schemaname = 'public' AND tablename = 'teacher_library_materials'
     AND (coalesce(qual,'') || coalesce(with_check,'')) LIKE '%fn_my_subject_slugs%';
  IF v_policies <> 0 THEN
    RAISE EXCEPTION '255: в политиках библиотеки осталась ссылка на слаги';
  END IF;

  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'fn_my_subject_slugs') THEN
    RAISE EXCEPTION '255: старая функция fn_my_subject_slugs не снесена';
  END IF;

  IF NOT has_function_privilege('authenticated', 'public.fn_my_departments()', 'EXECUTE') THEN
    RAISE EXCEPTION '255: authenticated не может выполнить fn_my_departments';
  END IF;
  IF has_function_privilege('anon', 'public.fn_my_departments()', 'EXECUTE') THEN
    RAISE EXCEPTION '255: anon может выполнить fn_my_departments';
  END IF;
END $$;
