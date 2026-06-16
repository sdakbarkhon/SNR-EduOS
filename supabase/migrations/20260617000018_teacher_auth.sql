-- =====================================================================
-- Migration 18: Teacher auth — username, homework.teacher_id, RLS
-- =====================================================================

-- ── Schema additions ──────────────────────────────────────────────────

ALTER TABLE public.teachers
  ADD COLUMN IF NOT EXISTS username text UNIQUE;

ALTER TABLE public.homework
  ADD COLUMN IF NOT EXISTS teacher_id uuid REFERENCES public.teachers(id) ON DELETE SET NULL;

-- ── Helper functions ──────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.current_teacher_id()
RETURNS uuid
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT id FROM public.teachers WHERE user_id = auth.uid() LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.is_my_teacher_group(p_group_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.groups
    WHERE id = p_group_id
      AND teacher_id = (SELECT id FROM public.teachers WHERE user_id = auth.uid() LIMIT 1)
  );
$$;

-- ── RLS: teachers table ───────────────────────────────────────────────

-- Students can read teachers (name display on schedule etc.)
-- Already covered by existing "authenticated reads teachers" policy if present.
-- Add teacher self-read policy:
CREATE POLICY "teacher reads own profile"
  ON public.teachers FOR SELECT TO authenticated
  USING (user_id = auth.uid());

-- ── RLS: groups ───────────────────────────────────────────────────────

CREATE POLICY "teacher reads own groups"
  ON public.groups FOR SELECT TO authenticated
  USING (teacher_id = public.current_teacher_id());

-- ── RLS: student_groups ──────────────────────────────────────────────

-- Teachers need to read student_group rows to discover which students
-- are in their groups. Without this policy the EXISTS clause in the
-- students policy sees 0 rows and returns nothing.
CREATE POLICY "teacher reads memberships in own groups"
  ON public.student_groups FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.groups g
      WHERE g.id = group_id
        AND g.teacher_id = public.current_teacher_id()
    )
  );

-- ── RLS: students ────────────────────────────────────────────────────

CREATE POLICY "teacher reads students in own groups"
  ON public.students FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.student_groups sg
        JOIN public.groups g ON g.id = sg.group_id
      WHERE sg.student_id = public.students.id
        AND g.teacher_id = public.current_teacher_id()
    )
  );

-- ── RLS: lessons ─────────────────────────────────────────────────────

CREATE POLICY "teacher reads lessons in own groups"
  ON public.lessons FOR SELECT TO authenticated
  USING (public.is_my_teacher_group(group_id));

-- ── RLS: attendance ──────────────────────────────────────────────────

CREATE POLICY "teacher reads attendance in own groups"
  ON public.attendance FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.lessons l
      WHERE l.id = lesson_id AND public.is_my_teacher_group(l.group_id)
    )
  );

-- ── RLS: homework ────────────────────────────────────────────────────

CREATE POLICY "teacher reads homework in own groups"
  ON public.homework FOR SELECT TO authenticated
  USING (public.is_my_teacher_group(group_id));

CREATE POLICY "teacher creates homework"
  ON public.homework FOR INSERT TO authenticated
  WITH CHECK (
    public.is_my_teacher_group(group_id)
    AND teacher_id = public.current_teacher_id()
  );

CREATE POLICY "teacher updates own homework"
  ON public.homework FOR UPDATE TO authenticated
  USING (teacher_id = public.current_teacher_id())
  WITH CHECK (teacher_id = public.current_teacher_id());

CREATE POLICY "teacher deletes own homework"
  ON public.homework FOR DELETE TO authenticated
  USING (teacher_id = public.current_teacher_id());

-- ── RLS: homework_submissions ─────────────────────────────────────────

CREATE POLICY "teacher reads submissions in own groups"
  ON public.homework_submissions FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.homework h
      WHERE h.id = homework_id AND public.is_my_teacher_group(h.group_id)
    )
  );

CREATE POLICY "teacher grades submissions"
  ON public.homework_submissions FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.homework h
      WHERE h.id = homework_id AND public.is_my_teacher_group(h.group_id)
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.homework h
      WHERE h.id = homework_id AND public.is_my_teacher_group(h.group_id)
    )
  );

-- ── RLS: grades ───────────────────────────────────────────────────────

CREATE POLICY "teacher reads grades in own groups"
  ON public.grades FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.student_groups sg
        JOIN public.groups g ON g.id = sg.group_id
      WHERE sg.student_id = public.grades.student_id
        AND g.teacher_id = public.current_teacher_id()
    )
  );

-- ── RLS: test_questions ──────────────────────────────────────────────

CREATE POLICY "teacher manages test questions in own groups"
  ON public.test_questions FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.homework h
      WHERE h.id = homework_id AND public.is_my_teacher_group(h.group_id)
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.homework h
      WHERE h.id = homework_id AND public.is_my_teacher_group(h.group_id)
    )
  );

-- ── RLS: test_question_options ───────────────────────────────────────

CREATE POLICY "teacher manages test options in own groups"
  ON public.test_question_options FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.test_questions q
        JOIN public.homework h ON h.id = q.homework_id
      WHERE q.id = question_id AND public.is_my_teacher_group(h.group_id)
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.test_questions q
        JOIN public.homework h ON h.id = q.homework_id
      WHERE q.id = question_id AND public.is_my_teacher_group(h.group_id)
    )
  );

-- ── RLS: test_submissions ────────────────────────────────────────────

CREATE POLICY "teacher reads test submissions in own groups"
  ON public.test_submissions FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.homework h
      WHERE h.id = homework_id AND public.is_my_teacher_group(h.group_id)
    )
  );

CREATE POLICY "teacher updates test submissions"
  ON public.test_submissions FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.homework h
      WHERE h.id = homework_id AND public.is_my_teacher_group(h.group_id)
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.homework h
      WHERE h.id = homework_id AND public.is_my_teacher_group(h.group_id)
    )
  );

-- ── RLS: test_answers ─────────────────────────────────────────────────

CREATE POLICY "teacher reads test answers in own groups"
  ON public.test_answers FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.test_submissions ts
        JOIN public.homework h ON h.id = ts.homework_id
      WHERE ts.id = submission_id AND public.is_my_teacher_group(h.group_id)
    )
  );

-- ── GRANTs ────────────────────────────────────────────────────────────

GRANT SELECT, INSERT, UPDATE, DELETE ON public.homework TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.test_questions TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.test_question_options TO authenticated;
GRANT SELECT, UPDATE ON public.test_submissions TO authenticated;
GRANT SELECT ON public.test_answers TO authenticated;
GRANT SELECT ON public.attendance TO authenticated;
GRANT SELECT ON public.grades TO authenticated;
