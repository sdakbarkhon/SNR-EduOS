-- ====================================================================
-- Migration 28: Classwork (in-lesson assignments with grading)
-- ====================================================================

-- 1. classwork table (one per lesson)
CREATE TABLE public.classwork (
  id                      uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lesson_id               uuid NOT NULL REFERENCES public.lessons(id) ON DELETE CASCADE,
  title                   text NOT NULL,
  description             text,
  work_type               text NOT NULL DEFAULT 'file'
                            CHECK (work_type IN ('file','test','learning','programming')),
  created_by              uuid REFERENCES public.teachers(id) ON DELETE SET NULL,
  created_at              timestamptz NOT NULL DEFAULT now(),
  -- Optional teacher attachment (methodical material)
  attachment_storage_path text,
  attachment_filename     text,
  attachment_size_bytes   bigint,
  UNIQUE (lesson_id)
);
CREATE INDEX classwork_lesson_id_idx ON public.classwork (lesson_id);

-- 2. classwork_questions (test type only)
CREATE TABLE public.classwork_questions (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  classwork_id   uuid NOT NULL REFERENCES public.classwork(id) ON DELETE CASCADE,
  position       int  NOT NULL DEFAULT 0,
  question_text  text NOT NULL,
  options        jsonb NOT NULL DEFAULT '[]',  -- ["option a","option b",...]
  correct_index  int  NOT NULL DEFAULT 0
);
CREATE INDEX classwork_questions_cw_idx ON public.classwork_questions (classwork_id);

-- 3. classwork_submissions (student answers + teacher grade)
CREATE TABLE public.classwork_submissions (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  classwork_id        uuid NOT NULL REFERENCES public.classwork(id) ON DELETE CASCADE,
  student_id          uuid NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  -- File type fields
  text_answer         text,
  file_storage_path   text,
  file_original_name  text,
  file_size_bytes     bigint,
  -- Test type fields
  test_answers        jsonb,   -- array of selected option indices
  test_score          int,
  test_max            int,
  submitted_at        timestamptz NOT NULL DEFAULT now(),
  -- Grading (teacher fills these)
  grade               int CHECK (grade BETWEEN 1 AND 5),
  teacher_comment     text,
  graded_at           timestamptz,
  graded_by           uuid REFERENCES public.teachers(id) ON DELETE SET NULL,
  UNIQUE (classwork_id, student_id)
);
CREATE INDEX classwork_submissions_cw_idx  ON public.classwork_submissions (classwork_id);
CREATE INDEX classwork_submissions_stu_idx ON public.classwork_submissions (student_id);

-- 4. RLS
ALTER TABLE public.classwork            ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.classwork_questions  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.classwork_submissions ENABLE ROW LEVEL SECURITY;

-- classwork: student can see classwork for lessons of their groups
CREATE POLICY "student reads classwork in own group"
  ON public.classwork FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.lessons l
    WHERE l.id = lesson_id AND public.is_my_group(l.group_id)
  ));

-- classwork: teacher can see classwork in own groups
CREATE POLICY "teacher reads classwork in own group"
  ON public.classwork FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.lessons l
    WHERE l.id = lesson_id AND public.is_my_teacher_group(l.group_id)
  ));

CREATE POLICY "teacher inserts classwork"
  ON public.classwork FOR INSERT TO authenticated
  WITH CHECK (
    created_by = public.current_teacher_id()
    AND EXISTS (
      SELECT 1 FROM public.lessons l
      WHERE l.id = lesson_id AND public.is_my_teacher_group(l.group_id)
    )
  );

CREATE POLICY "teacher updates classwork"
  ON public.classwork FOR UPDATE TO authenticated
  USING (created_by = public.current_teacher_id())
  WITH CHECK (created_by = public.current_teacher_id());

CREATE POLICY "teacher deletes classwork"
  ON public.classwork FOR DELETE TO authenticated
  USING (created_by = public.current_teacher_id());

-- classwork_questions: student reads ONLY after submitting
CREATE POLICY "student reads classwork questions after submit"
  ON public.classwork_questions FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.classwork_submissions cs
    JOIN public.classwork c ON c.id = cs.classwork_id
    JOIN public.lessons l ON l.id = c.lesson_id
    WHERE cs.classwork_id = classwork_id
      AND cs.student_id = public.current_student_id()
  ) OR EXISTS (
    -- also let student read questions to answer the test
    SELECT 1 FROM public.classwork c
    JOIN public.lessons l ON l.id = c.lesson_id
    WHERE c.id = classwork_id AND public.is_my_group(l.group_id)
  ));

CREATE POLICY "teacher reads classwork questions"
  ON public.classwork_questions FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.classwork c
    JOIN public.lessons l ON l.id = c.lesson_id
    WHERE c.id = classwork_id AND public.is_my_teacher_group(l.group_id)
  ));

CREATE POLICY "teacher manages classwork questions"
  ON public.classwork_questions FOR ALL TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.classwork c WHERE c.id = classwork_id AND c.created_by = public.current_teacher_id()
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.classwork c WHERE c.id = classwork_id AND c.created_by = public.current_teacher_id()
  ));

-- classwork_submissions: student reads own
CREATE POLICY "student reads own classwork submissions"
  ON public.classwork_submissions FOR SELECT TO authenticated
  USING (student_id = public.current_student_id());

CREATE POLICY "student inserts own classwork submission"
  ON public.classwork_submissions FOR INSERT TO authenticated
  WITH CHECK (
    student_id = public.current_student_id()
    AND EXISTS (
      SELECT 1 FROM public.classwork c
      JOIN public.lessons l ON l.id = c.lesson_id
      WHERE c.id = classwork_id AND public.is_my_group(l.group_id)
    )
  );

CREATE POLICY "student updates own ungraded submission"
  ON public.classwork_submissions FOR UPDATE TO authenticated
  USING (student_id = public.current_student_id() AND grade IS NULL)
  WITH CHECK (student_id = public.current_student_id());

-- teacher reads submissions in own groups
CREATE POLICY "teacher reads classwork submissions"
  ON public.classwork_submissions FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.classwork c
    JOIN public.lessons l ON l.id = c.lesson_id
    WHERE c.id = classwork_id AND public.is_my_teacher_group(l.group_id)
  ));

CREATE POLICY "teacher grades classwork submissions"
  ON public.classwork_submissions FOR UPDATE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.classwork c
    JOIN public.lessons l ON l.id = c.lesson_id
    WHERE c.id = classwork_id AND public.is_my_teacher_group(l.group_id)
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.classwork c
    JOIN public.lessons l ON l.id = c.lesson_id
    WHERE c.id = classwork_id AND public.is_my_teacher_group(l.group_id)
  ));

-- 5. GRANTs
GRANT SELECT, INSERT, UPDATE, DELETE ON public.classwork TO authenticated;
GRANT SELECT ON public.classwork TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.classwork_questions TO authenticated;
GRANT SELECT ON public.classwork_questions TO anon;
GRANT SELECT, INSERT, UPDATE ON public.classwork_submissions TO authenticated;
GRANT SELECT ON public.classwork_submissions TO anon;
