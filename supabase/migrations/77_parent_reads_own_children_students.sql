-- =====================================================================
-- Migration 77 — parent visibility gap on students / student_groups / charges.
--
-- Found during live browser-click verification of И6-П5 (parent web
-- dashboard): parent logs in, /parent/dashboard shows "Нет детей" despite
-- valid parent_students links. Root cause: the `students` table has no
-- parent SELECT policy at all (only admin/student-self/teacher-of-group),
-- so getParentContext() and getStudentById() silently get zero rows back
-- for a parent session even though parent_students resolves correctly.
--
-- Audit (Part 1.5 of the hotfix prompt) of every table touched by the
-- parent-context queries added in И6-П5 found three MORE gaps of the same
-- shape, not yet exercised by live clicks:
--   - student_groups: used by getStudentGroupIds() to resolve a specific
--     child's group_ids (which getHomeworkWithSubmissions/
--     getStudentLessonsForDate/Week then filter by). No parent policy —
--     the app would silently get an empty group list for parent sessions,
--     falling back to a placeholder UUID filter, making homework/lessons
--     appear empty even when real data exists.
--   - charges: used by getCharges() for the Payments screen "списания"
--     history. Only "student reads own charges" existed — parent would
--     see an empty charges history even with a correct payments history.
--   - groups: getStudentLessonsForDate/Week and getHomeworkWithSubmissions
--     both embed `group:groups!inner(...)`. PostgREST's `!inner` modifier
--     drops the WHOLE row when the embedded table isn't visible to the
--     caller's RLS — so even though `lessons`/`homework` themselves have a
--     working parent policy, the inner-joined `groups` row being invisible
--     would silently zero out every lessons/homework result for parent.
--     Reuses is_my_child_group() (SECURITY DEFINER, added in migration 75)
--     rather than a new helper, since the predicate is identical.
--
-- Fix: 4 new SELECT policies, identical pattern to the already-applied
-- parent policies from migration 74/75/76 — no RLS-recursion risk, no new
-- helper functions beyond the existing is_my_child()/is_my_child_group().
--
-- Idempotent: DO block + NOT EXISTS check against pg_policies.
-- =====================================================================

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'students'
      AND policyname = 'parent reads own children students'
  ) THEN
    CREATE POLICY "parent reads own children students" ON public.students
      FOR SELECT
      USING (
        is_my_child(id)
        OR (school_id = current_school_id() AND fn_is_admin())
        OR is_super_admin()
      );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'student_groups'
      AND policyname = 'parent reads own children group memberships'
  ) THEN
    CREATE POLICY "parent reads own children group memberships" ON public.student_groups
      FOR SELECT
      USING (
        is_my_child(student_id)
        OR (school_id = current_school_id() AND fn_is_admin())
        OR is_super_admin()
      );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'charges'
      AND policyname = 'parent reads own children charges'
  ) THEN
    CREATE POLICY "parent reads own children charges" ON public.charges
      FOR SELECT
      USING (
        is_my_child(student_id)
        OR (school_id = current_school_id() AND fn_is_admin())
        OR is_super_admin()
      );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'groups'
      AND policyname = 'parent reads own children groups'
  ) THEN
    CREATE POLICY "parent reads own children groups" ON public.groups
      FOR SELECT
      USING (
        is_my_child_group(id)
        OR (school_id = current_school_id() AND fn_is_admin())
        OR is_super_admin()
      );
  END IF;
END $$;
