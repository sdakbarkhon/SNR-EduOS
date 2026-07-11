-- =====================================================================
-- Migration 116 — Промт 4: учебные планы (curriculum_plans).
--
-- Учитель загружает PDF/DOCX план по (группа, предмет); AI раскладывает
-- его на упорядоченный список тем (curriculum_plan_topics). При создании
-- НОВОГО урока учитель опционально привязывает lessons.curriculum_topic_id
-- к одной из тем. Существующие уроки НЕ трогаем: новая колонка на
-- lessons — ADD COLUMN nullable без DEFAULT-переписывания строк,
-- ON DELETE SET NULL — план можно удалить, уроки не пострадают.
--
-- Отклонения от спеки пользователя (см. resheniya_2.md):
-- 1. teacher_id → REFERENCES teachers(id), не profiles(id) — таблицы
--    profiles в этой схеме не существует ни в одной миграции (проверено
--    grep по всем supabase/migrations/*.sql), everywhere teachers(id) is
--    the FK target for teacher-authored rows.
-- 2. Добавлена school_id (не было в списке колонок пользователя) — без
--    неё RLS-пункт "SELECT: teacher из school школы" нереализуем чисто
--    (пришлось бы JOIN через groups на каждый policy-check); ЛЮБАЯ
--    другая таблица в этой схеме уже имеет school_id с DEFAULT
--    current_school_id() — сохраняем консистентность архитектуры.
--    curriculum_plan_topics своей school_id не имеет — достаточно
--    EXISTS-джойна на родительский plan_id (тот же паттерн, что
--    lesson_stages → lessons).
--
-- "Демо-учителя работают как реальные" (по прямому требованию) — НЕТ
-- триггера fn_stamp_is_demo на эти 2 таблицы, никакого is_demo-столбца:
-- демо-сессия учителя проходит те же RLS-проверки, что и реальная,
-- current_teacher_id() резолвится одинаково в обоих случаях.
-- =====================================================================

BEGIN;

-- ── 1. Таблицы ────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.curriculum_plans (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id         uuid NOT NULL REFERENCES public.groups(id) ON DELETE CASCADE,
  subject_id       uuid NOT NULL REFERENCES public.subjects(id) ON DELETE CASCADE,
  teacher_id       uuid NOT NULL REFERENCES public.teachers(id) ON DELETE CASCADE,
  school_id        uuid NOT NULL REFERENCES public.schools(id) DEFAULT public.current_school_id(),
  title            text NOT NULL,
  source_file_url  text,
  source_file_type text CHECK (source_file_type IN ('pdf', 'docx')),
  created_at       timestamptz NOT NULL DEFAULT now(),
  UNIQUE (group_id, subject_id)
);

CREATE TABLE IF NOT EXISTS public.curriculum_plan_topics (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_id            uuid NOT NULL REFERENCES public.curriculum_plans(id) ON DELETE CASCADE,
  order_index        int NOT NULL,
  title              text NOT NULL,
  description        text,
  estimated_lessons  int NOT NULL DEFAULT 1
);

CREATE INDEX IF NOT EXISTS idx_curriculum_plan_topics_plan_order
  ON public.curriculum_plan_topics (plan_id, order_index);

CREATE INDEX IF NOT EXISTS idx_curriculum_plans_school_id ON public.curriculum_plans (school_id);

-- ── 2. lessons.curriculum_topic_id — НЕ трогает существующие строки ────────

ALTER TABLE public.lessons
  ADD COLUMN IF NOT EXISTS curriculum_topic_id uuid
  REFERENCES public.curriculum_plan_topics(id) ON DELETE SET NULL;

-- ── 3. RLS helper functions (тот же стиль, что is_my_group/is_my_child_group) ──

CREATE OR REPLACE FUNCTION public.can_view_curriculum_plan(p_school_id uuid, p_group_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT
    EXISTS (SELECT 1 FROM public.teachers t WHERE t.user_id = auth.uid() AND t.school_id = p_school_id)
    OR public.is_my_group(p_group_id)
    OR public.is_my_child_group(p_group_id)
    OR (public.fn_is_admin() AND p_school_id = public.current_school_id())
    OR public.is_super_admin()
$$;

CREATE OR REPLACE FUNCTION public.can_manage_curriculum_plan(p_school_id uuid, p_group_id uuid, p_teacher_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT
    (
      EXISTS (SELECT 1 FROM public.groups g WHERE g.id = p_group_id AND g.teacher_id = public.current_teacher_id())
      AND p_teacher_id = public.current_teacher_id()
    )
    OR (public.fn_is_admin() AND p_school_id = public.current_school_id())
    OR public.is_super_admin()
$$;

-- ── 4. RLS policies ──────────────────────────────────────────────────────

ALTER TABLE public.curriculum_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.curriculum_plan_topics ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "curriculum_plans_select" ON public.curriculum_plans;
CREATE POLICY "curriculum_plans_select" ON public.curriculum_plans FOR SELECT
  USING (public.can_view_curriculum_plan(school_id, group_id));

DROP POLICY IF EXISTS "curriculum_plans_insert" ON public.curriculum_plans;
CREATE POLICY "curriculum_plans_insert" ON public.curriculum_plans FOR INSERT
  WITH CHECK (public.can_manage_curriculum_plan(school_id, group_id, teacher_id));

DROP POLICY IF EXISTS "curriculum_plans_update" ON public.curriculum_plans;
CREATE POLICY "curriculum_plans_update" ON public.curriculum_plans FOR UPDATE
  USING (public.can_manage_curriculum_plan(school_id, group_id, teacher_id))
  WITH CHECK (public.can_manage_curriculum_plan(school_id, group_id, teacher_id));

DROP POLICY IF EXISTS "curriculum_plans_delete" ON public.curriculum_plans;
CREATE POLICY "curriculum_plans_delete" ON public.curriculum_plans FOR DELETE
  USING (public.can_manage_curriculum_plan(school_id, group_id, teacher_id));

DROP POLICY IF EXISTS "curriculum_plan_topics_select" ON public.curriculum_plan_topics;
CREATE POLICY "curriculum_plan_topics_select" ON public.curriculum_plan_topics FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM public.curriculum_plans cp
    WHERE cp.id = plan_id AND public.can_view_curriculum_plan(cp.school_id, cp.group_id)
  ));

DROP POLICY IF EXISTS "curriculum_plan_topics_insert" ON public.curriculum_plan_topics;
CREATE POLICY "curriculum_plan_topics_insert" ON public.curriculum_plan_topics FOR INSERT
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.curriculum_plans cp
    WHERE cp.id = plan_id AND public.can_manage_curriculum_plan(cp.school_id, cp.group_id, cp.teacher_id)
  ));

DROP POLICY IF EXISTS "curriculum_plan_topics_update" ON public.curriculum_plan_topics;
CREATE POLICY "curriculum_plan_topics_update" ON public.curriculum_plan_topics FOR UPDATE
  USING (EXISTS (
    SELECT 1 FROM public.curriculum_plans cp
    WHERE cp.id = plan_id AND public.can_manage_curriculum_plan(cp.school_id, cp.group_id, cp.teacher_id)
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.curriculum_plans cp
    WHERE cp.id = plan_id AND public.can_manage_curriculum_plan(cp.school_id, cp.group_id, cp.teacher_id)
  ));

DROP POLICY IF EXISTS "curriculum_plan_topics_delete" ON public.curriculum_plan_topics;
CREATE POLICY "curriculum_plan_topics_delete" ON public.curriculum_plan_topics FOR DELETE
  USING (EXISTS (
    SELECT 1 FROM public.curriculum_plans cp
    WHERE cp.id = plan_id AND public.can_manage_curriculum_plan(cp.school_id, cp.group_id, cp.teacher_id)
  ));

-- ── 5. Storage bucket "curriculum-plans" (private, 20MB, PDF/DOCX) ─────────
-- Тот же паттерн, что materials/books (20260617000020_materials_storage.sql):
-- INSERT гейтится владением папки (storage.foldername(name))[1] =
-- current_teacher_id(), SELECT открыт всем authenticated — реальная
-- граница школы/роли уже обеспечена RLS на curriculum_plans (ни один
-- существующий bucket в этой схеме не фильтрует по school_id на уровне
-- storage.objects — паттерн всегда "storage открыт, таблица-метаданные
-- закрыта").

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'curriculum-plans', 'curriculum-plans', false, 20971520,
  ARRAY[
    'application/pdf',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  ]
)
ON CONFLICT (id) DO UPDATE SET
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

DROP POLICY IF EXISTS "teacher uploads to curriculum-plans bucket" ON storage.objects;
CREATE POLICY "teacher uploads to curriculum-plans bucket"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'curriculum-plans'
    AND (storage.foldername(name))[1] = (public.current_teacher_id())::text
  );

DROP POLICY IF EXISTS "authenticated reads curriculum-plans bucket" ON storage.objects;
CREATE POLICY "authenticated reads curriculum-plans bucket"
  ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'curriculum-plans');

DROP POLICY IF EXISTS "teacher deletes own curriculum-plans files" ON storage.objects;
CREATE POLICY "teacher deletes own curriculum-plans files"
  ON storage.objects FOR DELETE TO authenticated
  USING (
    bucket_id = 'curriculum-plans'
    AND (storage.foldername(name))[1] = (public.current_teacher_id())::text
  );

-- ── 6. Регистрация ───────────────────────────────────────────────────────
INSERT INTO supabase_migrations.schema_migrations (version)
VALUES ('116')
ON CONFLICT (version) DO NOTHING;

COMMIT;
