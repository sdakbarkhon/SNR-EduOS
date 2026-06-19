-- ====================================================================
-- Migration 31: homework test extras — duration, auto-grade, start-gate
-- Extends the existing content_type='test' system (migration 17) rather
-- than introducing a parallel model. 'learning' / 'programming' types are
-- UI-only stubs (never written to the DB), so the content_type enum stays
-- 'file' | 'test' and no ALTER TYPE is required.
-- ====================================================================

-- 1. Test configuration on homework
ALTER TABLE public.homework
  ADD COLUMN IF NOT EXISTS test_duration_seconds int,
  ADD COLUMN IF NOT EXISTS test_auto_grade       boolean NOT NULL DEFAULT true;

-- 2. Start-gate + auto-grade on the existing test_submissions table
--    started_at: set when the student begins (questions stay hidden until then)
--    grade:      discrete 2..5 written by the auto-grade formula
ALTER TABLE public.test_submissions
  ADD COLUMN IF NOT EXISTS started_at timestamptz,
  ADD COLUMN IF NOT EXISTS grade      int;

-- 3. Student start-gate: replace the "any group member" SELECT policies so a
--    student can only read questions/options AFTER starting the test (i.e. has
--    a test_submission row with started_at set). Teacher FOR ALL policies
--    (migration 18) are untouched, so teacher read/manage keeps working.
DROP POLICY IF EXISTS "student reads test questions" ON public.test_questions;
CREATE POLICY "student reads test questions"
  ON public.test_questions FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.test_submissions ts
      WHERE ts.homework_id = public.test_questions.homework_id
        AND ts.student_id  = public.current_student_id()
        AND ts.started_at IS NOT NULL
    )
  );

DROP POLICY IF EXISTS "student reads test options" ON public.test_question_options;
CREATE POLICY "student reads test options"
  ON public.test_question_options FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1
        FROM public.test_questions q
        JOIN public.test_submissions ts ON ts.homework_id = q.homework_id
       WHERE q.id = public.test_question_options.question_id
         AND ts.student_id = public.current_student_id()
         AND ts.started_at IS NOT NULL
    )
  );

-- 4. Student must be able to finalize (UPDATE) their own started submission
--    (set score / max_score / grade on submit). INSERT/SELECT already exist;
--    UPDATE grant was added in migration 18.
CREATE POLICY "student updates own test submission"
  ON public.test_submissions FOR UPDATE TO authenticated
  USING (student_id = public.current_student_id())
  WITH CHECK (student_id = public.current_student_id());
