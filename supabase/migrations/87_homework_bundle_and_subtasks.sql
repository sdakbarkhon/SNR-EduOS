-- Migration 87
-- УЧ.6: homework "bundle" type — a homework made of 1+ subtasks of mixed
-- types (file/test/code/scratch), solved independently, graded as one whole.
--
-- 1) Adds 'bundle' to the public.content_type ENUM (homework.content_type).
--    Per Postgres rules, a value added via ALTER TYPE ... ADD VALUE cannot be
--    referenced later in the SAME transaction — this migration does not
--    insert/update any row to content_type='bundle', so it's safe (same
--    pattern already used by 20260619000032_programming_homework.sql for
--    'programming').
-- 2) homework_subtasks — one row per subtask belonging to a bundle homework.
-- 3) homework_subtask_submissions — one row per (submission, subtask) pair,
--    tracking the student's per-subtask progress/content/completion.
--
-- RLS mirrors the canonical, post-migration-73 idiom used by
-- homework/homework_submissions themselves: student (own group) / teacher
-- (own homework) / parent (own child) / admin (own school) / super_admin
-- (unconditional bypass, always the outermost OR).

ALTER TYPE public.content_type ADD VALUE IF NOT EXISTS 'bundle';

-- ---------------------------------------------------------------------------
-- homework_subtasks
-- ---------------------------------------------------------------------------

CREATE TABLE public.homework_subtasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  homework_id uuid NOT NULL REFERENCES public.homework(id) ON DELETE CASCADE,
  order_index int NOT NULL DEFAULT 0,
  type text NOT NULL CHECK (type IN ('file', 'test', 'code', 'scratch')),
  title text NOT NULL,
  description text,
  config jsonb NOT NULL DEFAULT '{}'::jsonb,
  school_id uuid NOT NULL DEFAULT current_school_id(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX homework_subtasks_homework_id_idx ON public.homework_subtasks(homework_id);

ALTER TABLE public.homework_subtasks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "student reads subtasks of own homework" ON public.homework_subtasks
  FOR SELECT TO authenticated
  USING (
    ((EXISTS (
      SELECT 1 FROM public.homework h
      WHERE h.id = homework_subtasks.homework_id AND public.is_my_group(h.group_id)
    )) AND school_id = public.current_school_id())
    OR is_super_admin()
  );

CREATE POLICY "teacher reads subtasks of own-group homework" ON public.homework_subtasks
  FOR SELECT TO authenticated
  USING (
    ((EXISTS (
      SELECT 1 FROM public.homework h
      WHERE h.id = homework_subtasks.homework_id AND public.is_my_teacher_group(h.group_id)
    )) AND school_id = public.current_school_id())
    OR is_super_admin()
  );

CREATE POLICY "parent reads subtasks of child homework" ON public.homework_subtasks
  FOR SELECT TO authenticated
  USING (
    ((EXISTS (
      SELECT 1 FROM public.homework h
      JOIN public.student_groups sg ON sg.group_id = h.group_id
      WHERE h.id = homework_subtasks.homework_id AND public.is_my_child(sg.student_id)
    )) AND school_id = public.current_school_id())
    OR (school_id = public.current_school_id() AND public.fn_is_admin())
    OR is_super_admin()
  );

CREATE POLICY "teacher creates subtasks for own homework" ON public.homework_subtasks
  FOR INSERT TO authenticated
  WITH CHECK (
    ((EXISTS (
      SELECT 1 FROM public.homework h
      WHERE h.id = homework_subtasks.homework_id AND h.teacher_id = public.current_teacher_id()
    )) AND school_id = public.current_school_id())
    OR is_super_admin()
  );

CREATE POLICY "teacher updates subtasks of own homework" ON public.homework_subtasks
  FOR UPDATE TO authenticated
  USING (
    ((EXISTS (
      SELECT 1 FROM public.homework h
      WHERE h.id = homework_subtasks.homework_id AND h.teacher_id = public.current_teacher_id()
    )) AND school_id = public.current_school_id())
    OR is_super_admin()
  )
  WITH CHECK (
    ((EXISTS (
      SELECT 1 FROM public.homework h
      WHERE h.id = homework_subtasks.homework_id AND h.teacher_id = public.current_teacher_id()
    )) AND school_id = public.current_school_id())
    OR is_super_admin()
  );

CREATE POLICY "teacher deletes subtasks of own homework" ON public.homework_subtasks
  FOR DELETE TO authenticated
  USING (
    ((EXISTS (
      SELECT 1 FROM public.homework h
      WHERE h.id = homework_subtasks.homework_id AND h.teacher_id = public.current_teacher_id()
    )) AND school_id = public.current_school_id())
    OR is_super_admin()
  );

-- ---------------------------------------------------------------------------
-- homework_subtask_submissions
-- ---------------------------------------------------------------------------

CREATE TABLE public.homework_subtask_submissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  submission_id uuid NOT NULL REFERENCES public.homework_submissions(id) ON DELETE CASCADE,
  subtask_id uuid NOT NULL REFERENCES public.homework_subtasks(id) ON DELETE CASCADE,
  content jsonb NOT NULL DEFAULT '{}'::jsonb,
  completed boolean NOT NULL DEFAULT false,
  school_id uuid NOT NULL DEFAULT current_school_id(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (submission_id, subtask_id)
);

CREATE INDEX homework_subtask_submissions_submission_id_idx ON public.homework_subtask_submissions(submission_id);
CREATE INDEX homework_subtask_submissions_subtask_id_idx ON public.homework_subtask_submissions(subtask_id);

ALTER TABLE public.homework_subtask_submissions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "student reads own subtask submissions" ON public.homework_subtask_submissions
  FOR SELECT TO authenticated
  USING (
    ((EXISTS (
      SELECT 1 FROM public.homework_submissions hs
      WHERE hs.id = homework_subtask_submissions.submission_id AND hs.student_id = public.current_student_id()
    )) AND school_id = public.current_school_id())
    OR is_super_admin()
  );

CREATE POLICY "student creates own subtask submissions" ON public.homework_subtask_submissions
  FOR INSERT TO authenticated
  WITH CHECK (
    ((EXISTS (
      SELECT 1 FROM public.homework_submissions hs
      WHERE hs.id = homework_subtask_submissions.submission_id AND hs.student_id = public.current_student_id()
    )) AND school_id = public.current_school_id())
    OR is_super_admin()
  );

CREATE POLICY "student updates own subtask submissions" ON public.homework_subtask_submissions
  FOR UPDATE TO authenticated
  USING (
    ((EXISTS (
      SELECT 1 FROM public.homework_submissions hs
      WHERE hs.id = homework_subtask_submissions.submission_id AND hs.student_id = public.current_student_id()
    )) AND school_id = public.current_school_id())
    OR is_super_admin()
  )
  WITH CHECK (
    ((EXISTS (
      SELECT 1 FROM public.homework_submissions hs
      WHERE hs.id = homework_subtask_submissions.submission_id AND hs.student_id = public.current_student_id()
    )) AND school_id = public.current_school_id())
    OR is_super_admin()
  );

CREATE POLICY "teacher reads subtask submissions in own groups" ON public.homework_subtask_submissions
  FOR SELECT TO authenticated
  USING (
    ((EXISTS (
      SELECT 1 FROM public.homework_submissions hs
      JOIN public.homework h ON h.id = hs.homework_id
      WHERE hs.id = homework_subtask_submissions.submission_id AND public.is_my_teacher_group(h.group_id)
    )) AND school_id = public.current_school_id())
    OR is_super_admin()
  );

CREATE POLICY "parent reads child subtask submissions" ON public.homework_subtask_submissions
  FOR SELECT TO authenticated
  USING (
    ((EXISTS (
      SELECT 1 FROM public.homework_submissions hs
      WHERE hs.id = homework_subtask_submissions.submission_id AND public.is_my_child(hs.student_id)
    )) AND school_id = public.current_school_id())
    OR (school_id = public.current_school_id() AND public.fn_is_admin())
    OR is_super_admin()
  );

-- Registration in schema_migrations happens after this SQL is applied to hosted.
