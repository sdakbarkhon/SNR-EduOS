-- =====================================================================
-- Migration 120 — can_manage_curriculum_plan учитывает subjects.teacher_id.
--
-- Баг: миграция 116 (curriculum_plans) гейтит can_manage_curriculum_plan
-- ТОЛЬКО на groups.teacher_id = current_teacher_id() — "куратор группы"
-- модель, унаследованная от 97_full_reset_new_accounts.sql, где
-- groups.teacher_id жёстко указывает на teacher_karim для всех 3 групп.
-- Миграция 109 (per_subject_teachers), применённая на день раньше,
-- перешла на модель "1 предмет = 1 учитель" (subjects.teacher_id) и
-- сделала teacher_karim куратором-исключением, а не единственным
-- владельцем групп — но 116 об этом не знала и продолжила проверять
-- только groups.teacher_id. Итог: teacher_prog/robot/math/english/russian
-- получали 0 групп в селекторе "Учебные планы" (см. фикс в
-- apps/web/app/teacher/curriculum/page.tsx), а даже если бы получили —
-- INSERT всё равно упал бы на этой RLS-проверке.
--
-- Функция получает 4-й параметр (p_subject_id) — не совместимо со старой
-- 3-арг сигнатурой напрямую (CREATE OR REPLACE не может менять список
-- параметров), поэтому политики сносим и пересоздаём с новой сигнатурой в
-- одной транзакции; старую функцию дропаем явно, чтобы не плодить мёртвый
-- overload.
-- =====================================================================

BEGIN;

DROP POLICY IF EXISTS "curriculum_plans_insert" ON public.curriculum_plans;
DROP POLICY IF EXISTS "curriculum_plans_update" ON public.curriculum_plans;
DROP POLICY IF EXISTS "curriculum_plans_delete" ON public.curriculum_plans;
DROP POLICY IF EXISTS "curriculum_plan_topics_insert" ON public.curriculum_plan_topics;
DROP POLICY IF EXISTS "curriculum_plan_topics_update" ON public.curriculum_plan_topics;
DROP POLICY IF EXISTS "curriculum_plan_topics_delete" ON public.curriculum_plan_topics;

DROP FUNCTION IF EXISTS public.can_manage_curriculum_plan(uuid, uuid, uuid);

CREATE FUNCTION public.can_manage_curriculum_plan(
  p_school_id uuid, p_group_id uuid, p_subject_id uuid, p_teacher_id uuid
)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT
    (
      (
        EXISTS (SELECT 1 FROM public.subjects s WHERE s.id = p_subject_id AND s.teacher_id = public.current_teacher_id())
        OR EXISTS (SELECT 1 FROM public.groups g WHERE g.id = p_group_id AND g.teacher_id = public.current_teacher_id())
      )
      AND p_teacher_id = public.current_teacher_id()
    )
    OR (public.fn_is_admin() AND p_school_id = public.current_school_id())
    OR public.is_super_admin()
$$;

CREATE POLICY "curriculum_plans_insert" ON public.curriculum_plans FOR INSERT
  WITH CHECK (public.can_manage_curriculum_plan(school_id, group_id, subject_id, teacher_id));

CREATE POLICY "curriculum_plans_update" ON public.curriculum_plans FOR UPDATE
  USING (public.can_manage_curriculum_plan(school_id, group_id, subject_id, teacher_id))
  WITH CHECK (public.can_manage_curriculum_plan(school_id, group_id, subject_id, teacher_id));

CREATE POLICY "curriculum_plans_delete" ON public.curriculum_plans FOR DELETE
  USING (public.can_manage_curriculum_plan(school_id, group_id, subject_id, teacher_id));

CREATE POLICY "curriculum_plan_topics_insert" ON public.curriculum_plan_topics FOR INSERT
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.curriculum_plans cp
    WHERE cp.id = plan_id AND public.can_manage_curriculum_plan(cp.school_id, cp.group_id, cp.subject_id, cp.teacher_id)
  ));

CREATE POLICY "curriculum_plan_topics_update" ON public.curriculum_plan_topics FOR UPDATE
  USING (EXISTS (
    SELECT 1 FROM public.curriculum_plans cp
    WHERE cp.id = plan_id AND public.can_manage_curriculum_plan(cp.school_id, cp.group_id, cp.subject_id, cp.teacher_id)
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.curriculum_plans cp
    WHERE cp.id = plan_id AND public.can_manage_curriculum_plan(cp.school_id, cp.group_id, cp.subject_id, cp.teacher_id)
  ));

CREATE POLICY "curriculum_plan_topics_delete" ON public.curriculum_plan_topics FOR DELETE
  USING (EXISTS (
    SELECT 1 FROM public.curriculum_plans cp
    WHERE cp.id = plan_id AND public.can_manage_curriculum_plan(cp.school_id, cp.group_id, cp.subject_id, cp.teacher_id)
  ));

INSERT INTO supabase_migrations.schema_migrations (version)
VALUES ('120')
ON CONFLICT (version) DO NOTHING;

COMMIT;
