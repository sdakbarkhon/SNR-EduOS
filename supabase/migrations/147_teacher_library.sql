-- =====================================================================
-- Migration 147 — Библиотека материалов учителей (teacher_library_materials).
--
-- Новый раздел "Библиотека" для учителей (веб): учитель загружает файл,
-- предмет проставляется автоматически из его роли (teachers.subject_slug),
-- учитель выбирает один/несколько классов или "Все классы". Первая
-- версия: ВСЕ учителя видят ВСЕ материалы независимо от предмета
-- (жёсткое ограничение "только свой предмет" сознательно отложено на
-- будущий раунд) — фильтры по классу/предмету в UI НЕ являются
-- ограничением доступа, только удобство поиска. Куратор
-- (teachers.subject_slug IS NULL, teacher_karim) может смотреть, но не
-- может загружать.
--
-- ВАЖНОЕ ОТКЛОНЕНИЕ от исходной постановки задачи: колонка называется
-- subject_slug, а не subject_id. subjects — это каталог ПО КЛАССАМ
-- (миграция 20260625000053_subjects.sql: subjects.group_id NOT NULL;
-- есть отдельная строка "Программирование" для каждого из 3-А/7-А/10-А
-- классов, миграция 98), поэтому у предметника нет одного канонического
-- subjects.id — только teachers.subject_slug (programming/robotics/math/
-- english/russian, миграция 109_per_subject_teachers.sql). subject_slug
-- однозначно идентифицирует предмет учителя независимо от класса и
-- используется как есть — и для автопроставления при загрузке, и как
-- значение фильтра в UI.
--
-- Классы: junction-таблица teacher_library_material_groups, форма 1:1 с
-- student_groups (миграция 20260614000002_identity.sql). Пустой набор
-- строк для material_id = "видно всем классам" — конвенция уровня
-- приложения/запроса (как announcements.target_group_id IS NULL уже
-- трактуется как "вся школа"), но для набора из НЕСКОЛЬКИХ классов сразу
-- нужна отдельная M:N таблица, не одна nullable FK.
--
-- Прикрепление материала к уроку ("база знаний") НЕ требует новых
-- колонок/таблиц. Существующий механизм lesson_materials.
-- from_knowledge_base + kb_bucket (миграция 115_lesson_materials_kb_link.sql,
-- функция linkLessonMaterialFromKnowledgeBase() в packages/core/src/
-- queries/index.ts:2662) уже принимает kb_bucket = 'materials' — если
-- файлы библиотеки лежат в СУЩЕСТВУЮЩЕМ бакете "materials" (что эта
-- миграция и делает, с новым префиксом пути .../library/...), этот
-- механизм работает БЕЗ ИЗМЕНЕНИЙ в Round C. Storage-политики бакета
-- "materials" (миграция 20260617000020_materials_storage.sql) тоже не
-- трогаются: INSERT/DELETE там проверяют только сегмент пути [1] =
-- teacher_id, а не весь путь целиком — новый префикс уже разрешён
-- существующими политиками, отдельная CREATE POLICY на storage.objects
-- в этой миграции НЕ нужна.
--
-- Идемпотентно: IF NOT EXISTS / DROP POLICY IF EXISTS везде, безопасно
-- перезапускать.
-- =====================================================================

BEGIN;

-- ── 1. Таблица teacher_library_materials ─────────────────────────────────

CREATE TABLE IF NOT EXISTS public.teacher_library_materials (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id        uuid NOT NULL REFERENCES public.schools(id) DEFAULT public.current_school_id(),
  uploaded_by      uuid REFERENCES public.teachers(id) ON DELETE SET NULL,
  subject_slug     text,
  title            text NOT NULL,
  storage_path     text NOT NULL,
  file_type        text,
  file_size_bytes  bigint,
  created_at       timestamptz NOT NULL DEFAULT now()
);

COMMENT ON COLUMN public.teacher_library_materials.subject_slug IS
  'Предмет загрузившего учителя (teachers.subject_slug на момент загрузки): programming/robotics/math/english/russian. Куратор загружать не может (см. RLS insert), поэтому реально NULL здесь не встречается — колонка nullable по той же причине, что uploaded_by (ON DELETE SET NULL при удалении учителя).';
COMMENT ON COLUMN public.teacher_library_materials.storage_path IS
  'Путь в бакете "materials" (переиспользуем существующий бакет, миграция 20260617000020_materials_storage.sql): <teacher_id>/library/<material_id>/<filename>. Сегмент [1] = teacher_id — тот же, что уже проверяют существующие storage-политики бакета, поэтому новых storage-политик не требуется.';
COMMENT ON TABLE public.teacher_library_materials IS
  'Библиотека материалов учителей — раздел, видимый только учителям (см. RLS). v1: все учителя видят все материалы независимо от предмета; subject_slug/классы — это фильтры для удобства, не ограничение доступа.';

CREATE INDEX IF NOT EXISTS idx_teacher_library_materials_school_id ON public.teacher_library_materials(school_id);
CREATE INDEX IF NOT EXISTS idx_teacher_library_materials_uploaded_by ON public.teacher_library_materials(uploaded_by);
CREATE INDEX IF NOT EXISTS idx_teacher_library_materials_subject_slug ON public.teacher_library_materials(subject_slug);

-- ── 2. Junction-таблица: материал <-> классы (M:N) ────────────────────────

CREATE TABLE IF NOT EXISTS public.teacher_library_material_groups (
  material_id uuid NOT NULL REFERENCES public.teacher_library_materials(id) ON DELETE CASCADE,
  group_id    uuid NOT NULL REFERENCES public.groups(id) ON DELETE CASCADE,
  school_id   uuid NOT NULL REFERENCES public.schools(id) DEFAULT public.current_school_id(),
  PRIMARY KEY (material_id, group_id)
);

COMMENT ON TABLE public.teacher_library_material_groups IS
  'M:N материал <-> класс. Ноль строк для данного material_id = "видно всем классам" (конвенция уровня запроса, аналог announcements.target_group_id IS NULL = "вся школа").';

CREATE INDEX IF NOT EXISTS idx_teacher_library_material_groups_group_id ON public.teacher_library_material_groups(group_id);

-- ── 3. RLS: teacher_library_materials ──────────────────────────────────────

ALTER TABLE public.teacher_library_materials ENABLE ROW LEVEL SECURITY;

-- SELECT: любой учитель школы (включая куратора) + super_admin.
-- Студенты/родители исключены — у них нет строки в teachers.
DROP POLICY IF EXISTS "teacher reads library materials" ON public.teacher_library_materials;
CREATE POLICY "teacher reads library materials" ON public.teacher_library_materials
  FOR SELECT TO authenticated
  USING (
    (
      EXISTS (SELECT 1 FROM public.teachers t WHERE t.user_id = auth.uid())
      AND school_id = public.current_school_id()
    )
    OR public.is_super_admin()
  );

-- INSERT: только предметник (subject_slug IS NOT NULL на его teachers-
-- строке) — куратор блокируется тем, что его собственный subject_slug
-- IS NULL и не проходит проверку ниже; студент/родитель блокируются тем,
-- что current_teacher_id() = NULL, а uploaded_by = NULL никогда не TRUE.
-- subject_slug материала обязан совпадать с subject_slug самого
-- загрузившего — значение нельзя подделать на произвольный предмет.
DROP POLICY IF EXISTS "teacher inserts own library materials" ON public.teacher_library_materials;
CREATE POLICY "teacher inserts own library materials" ON public.teacher_library_materials
  FOR INSERT TO authenticated
  WITH CHECK (
    (
      uploaded_by = public.current_teacher_id()
      AND subject_slug IS NOT NULL
      AND subject_slug = (SELECT t.subject_slug FROM public.teachers t WHERE t.id = public.current_teacher_id())
      AND school_id = public.current_school_id()
    )
    OR public.is_super_admin()
  );

-- UPDATE: только автор (например, переименовать файл).
DROP POLICY IF EXISTS "teacher updates own library materials" ON public.teacher_library_materials;
CREATE POLICY "teacher updates own library materials" ON public.teacher_library_materials
  FOR UPDATE TO authenticated
  USING ((uploaded_by = public.current_teacher_id() AND school_id = public.current_school_id()) OR public.is_super_admin())
  WITH CHECK ((uploaded_by = public.current_teacher_id() AND school_id = public.current_school_id()) OR public.is_super_admin());

-- DELETE: только автор. Будущее расширение (не реализовано здесь): дать
-- школьному админу удалять чужие материалы — is_super_admin() это уже
-- покрывает бесплатно; для school-admin достаточно добавить ветку
-- `OR (public.fn_is_admin() AND school_id = public.current_school_id())`.
DROP POLICY IF EXISTS "teacher deletes own library materials" ON public.teacher_library_materials;
CREATE POLICY "teacher deletes own library materials" ON public.teacher_library_materials
  FOR DELETE TO authenticated
  USING ((uploaded_by = public.current_teacher_id() AND school_id = public.current_school_id()) OR public.is_super_admin());

-- ── 4. RLS: teacher_library_material_groups ────────────────────────────────

ALTER TABLE public.teacher_library_material_groups ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "teacher reads library material groups" ON public.teacher_library_material_groups;
CREATE POLICY "teacher reads library material groups" ON public.teacher_library_material_groups
  FOR SELECT TO authenticated
  USING (
    (
      EXISTS (SELECT 1 FROM public.teachers t WHERE t.user_id = auth.uid())
      AND school_id = public.current_school_id()
    )
    OR public.is_super_admin()
  );

DROP POLICY IF EXISTS "author inserts own library material groups" ON public.teacher_library_material_groups;
CREATE POLICY "author inserts own library material groups" ON public.teacher_library_material_groups
  FOR INSERT TO authenticated
  WITH CHECK (
    (
      EXISTS (
        SELECT 1 FROM public.teacher_library_materials m
        WHERE m.id = material_id AND m.uploaded_by = public.current_teacher_id()
      )
      AND school_id = public.current_school_id()
    )
    OR public.is_super_admin()
  );

DROP POLICY IF EXISTS "author deletes own library material groups" ON public.teacher_library_material_groups;
CREATE POLICY "author deletes own library material groups" ON public.teacher_library_material_groups
  FOR DELETE TO authenticated
  USING (
    (
      EXISTS (
        SELECT 1 FROM public.teacher_library_materials m
        WHERE m.id = material_id AND m.uploaded_by = public.current_teacher_id()
      )
      AND school_id = public.current_school_id()
    )
    OR public.is_super_admin()
  );

-- ── 5. Grants ───────────────────────────────────────────────────────────

GRANT SELECT, INSERT, UPDATE, DELETE ON public.teacher_library_materials TO authenticated;
GRANT SELECT, INSERT, DELETE ON public.teacher_library_material_groups TO authenticated;

-- ── 6. Регистрация ──────────────────────────────────────────────────────
INSERT INTO supabase_migrations.schema_migrations (version)
VALUES ('147')
ON CONFLICT (version) DO NOTHING;

COMMIT;
