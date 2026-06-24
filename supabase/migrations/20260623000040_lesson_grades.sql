-- Migration 40: lesson_grades — teacher can grade a student per lesson
-- (separate from stage-level grades in lesson_stage_progress)

-- ── Table ────────────────────────────────────────────────────────────────────
CREATE TABLE public.lesson_grades (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lesson_id  uuid NOT NULL REFERENCES public.lessons(id)  ON DELETE CASCADE,
  student_id uuid NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  grade      int  NOT NULL CHECK (grade BETWEEN 1 AND 5),
  comment    text,
  graded_by  uuid NOT NULL REFERENCES public.teachers(id),
  graded_at  timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (lesson_id, student_id)
);

CREATE INDEX ON public.lesson_grades (student_id);
CREATE INDEX ON public.lesson_grades (lesson_id);

-- ── updated_at trigger ───────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.set_lesson_grade_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_lesson_grades_updated_at
  BEFORE UPDATE ON public.lesson_grades
  FOR EACH ROW EXECUTE FUNCTION public.set_lesson_grade_updated_at();

-- ── Realtime ─────────────────────────────────────────────────────────────────
ALTER TABLE public.lesson_grades REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE public.lesson_grades;

-- ── RLS ──────────────────────────────────────────────────────────────────────
ALTER TABLE public.lesson_grades ENABLE ROW LEVEL SECURITY;

-- Student: SELECT own grades only
CREATE POLICY "student reads own lesson grades"
  ON public.lesson_grades FOR SELECT TO authenticated
  USING (student_id = public.current_student_id());

-- Teacher: SELECT grades for own group's lessons
CREATE POLICY "teacher reads lesson grades in own groups"
  ON public.lesson_grades FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.lessons l
      WHERE l.id = lesson_id AND public.is_my_teacher_group(l.group_id)
    )
  );

-- Teacher: INSERT/UPDATE/DELETE grades for own group's lessons only
CREATE POLICY "teacher inserts lesson grades"
  ON public.lesson_grades FOR INSERT TO authenticated
  WITH CHECK (
    graded_by = public.current_teacher_id()
    AND EXISTS (
      SELECT 1 FROM public.lessons l
      WHERE l.id = lesson_id AND public.is_my_teacher_group(l.group_id)
    )
  );

CREATE POLICY "teacher updates lesson grades"
  ON public.lesson_grades FOR UPDATE TO authenticated
  USING (graded_by = public.current_teacher_id())
  WITH CHECK (graded_by = public.current_teacher_id());

CREATE POLICY "teacher deletes lesson grades"
  ON public.lesson_grades FOR DELETE TO authenticated
  USING (graded_by = public.current_teacher_id());

-- ── GRANTs ───────────────────────────────────────────────────────────────────
GRANT SELECT ON public.lesson_grades TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.lesson_grades TO authenticated;
