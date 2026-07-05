-- =====================================================================
-- Migration 75 — fix: parent visibility on lessons/lesson_stages/
-- homework/course_materials returned zero rows for legitimate children.
--
-- Found during live post-apply verification of migration 74 (scenario C:
-- parent_test saw 0 lessons instead of the expected 22 for their two
-- children's groups). Root cause: those 4 policies checked group
-- membership with a raw `EXISTS (SELECT 1 FROM public.student_groups
-- sg WHERE ...)` subquery. student_groups is itself RLS-protected, and
-- a parent has no policy granting direct visibility into it — so the
-- subquery silently returned no rows for the parent's session, even
-- though is_my_child() (SECURITY DEFINER, bypasses RLS) correctly
-- returned true for the same student. This is exactly the RLS-recursion
-- trap the existing is_my_group()/is_my_teacher_group() helpers exist
-- to avoid; the 6 other new parent-visibility policies (on
-- homework_submissions, grades, attendance, payments, lesson_grades,
-- lesson_raised_hands) call is_my_child(student_id) directly and were
-- unaffected — audited, only these 4 use the group_id/lesson_id join
-- shape.
--
-- Fix: two new SECURITY DEFINER helpers (is_my_child_group,
-- is_my_child_lesson) that resolve group/lesson membership without
-- going through RLS, matching the existing is_my_group() pattern
-- exactly. Rewrites the 4 affected policies to use them.
--
-- Idempotent: CREATE OR REPLACE FUNCTION and ALTER POLICY both
-- converge to the same final state regardless of prior state.
-- =====================================================================

CREATE OR REPLACE FUNCTION public.is_my_child_group(p_group_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.parents p
    JOIN public.parent_students ps ON ps.parent_id = p.id
    JOIN public.student_groups sg ON sg.student_id = ps.student_id
    WHERE p.user_id = auth.uid()
      AND sg.group_id = p_group_id
  )
$$;

CREATE OR REPLACE FUNCTION public.is_my_child_lesson(p_lesson_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.parents p
    JOIN public.parent_students ps ON ps.parent_id = p.id
    JOIN public.student_groups sg ON sg.student_id = ps.student_id
    JOIN public.lessons l ON l.group_id = sg.group_id
    WHERE p.user_id = auth.uid()
      AND l.id = p_lesson_id
  )
$$;

ALTER POLICY "parent reads own children lessons" ON public.lessons
  USING (
    is_my_child_group(group_id)
    OR (school_id = current_school_id() AND fn_is_admin())
    OR is_super_admin()
  );

ALTER POLICY "parent reads own children lesson stages" ON public.lesson_stages
  USING (
    is_my_child_lesson(lesson_id)
    OR (school_id = current_school_id() AND fn_is_admin())
    OR is_super_admin()
  );

ALTER POLICY "parent reads own children homework" ON public.homework
  USING (
    is_my_child_group(group_id)
    OR (school_id = current_school_id() AND fn_is_admin())
    OR is_super_admin()
  );

ALTER POLICY "parent reads own children course materials" ON public.course_materials
  USING (
    is_my_child_group(group_id)
    OR (school_id = current_school_id() AND fn_is_admin())
    OR is_super_admin()
  );
