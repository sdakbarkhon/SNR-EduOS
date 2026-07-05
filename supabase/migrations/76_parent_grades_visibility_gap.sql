-- =====================================================================
-- Migration 76 — parent visibility gap on grades-journal source tables.
--
-- Found during И6-П5 investigation (parent web dashboard build): the
-- student "оценки" journal (getStudentGrades() in packages/core) unions
-- 6 source tables — homework_submissions, test_submissions,
-- classwork_submissions, project_submissions, lesson_stage_progress,
-- lesson_grades. Migration 74's Part F only added parent-visibility
-- policies to 2 of the 6 (homework_submissions, lesson_grades). The
-- other 4 had no parent SELECT policy at all — a parent's grades screen
-- would silently return an incomplete list (missing test/classwork/
-- project/quiz-stage grades), with no error, since RLS just returns
-- zero rows for the unauthorized tables.
--
-- Fix: 4 new SELECT policies, identical pattern to the 6 already-applied
-- parent policies (is_my_child(student_id) directly — all 4 tables have
-- a direct student_id column per schema check, so no RLS-recursion risk
-- and no new helper functions needed, unlike migration 75's group/lesson
-- join case).
--
-- Idempotent: CREATE POLICY has no IF NOT EXISTS in Postgres, so this
-- uses a DO block to skip creation if the policy already exists.
-- =====================================================================

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'test_submissions'
      AND policyname = 'parent reads own children test submissions'
  ) THEN
    CREATE POLICY "parent reads own children test submissions" ON public.test_submissions
      FOR SELECT
      USING (
        is_my_child(student_id)
        OR (school_id = current_school_id() AND fn_is_admin())
        OR is_super_admin()
      );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'classwork_submissions'
      AND policyname = 'parent reads own children classwork submissions'
  ) THEN
    CREATE POLICY "parent reads own children classwork submissions" ON public.classwork_submissions
      FOR SELECT
      USING (
        is_my_child(student_id)
        OR (school_id = current_school_id() AND fn_is_admin())
        OR is_super_admin()
      );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'project_submissions'
      AND policyname = 'parent reads own children project submissions'
  ) THEN
    CREATE POLICY "parent reads own children project submissions" ON public.project_submissions
      FOR SELECT
      USING (
        is_my_child(student_id)
        OR (school_id = current_school_id() AND fn_is_admin())
        OR is_super_admin()
      );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'lesson_stage_progress'
      AND policyname = 'parent reads own children lesson stage progress'
  ) THEN
    CREATE POLICY "parent reads own children lesson stage progress" ON public.lesson_stage_progress
      FOR SELECT
      USING (
        is_my_child(student_id)
        OR (school_id = current_school_id() AND fn_is_admin())
        OR is_super_admin()
      );
  END IF;
END $$;
