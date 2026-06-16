-- =====================================================================
-- homework_v2: content_type + homework_source + test tables (RLS)
-- =====================================================================

-- Новые enum-типы
DO $$ BEGIN
  CREATE TYPE public.content_type AS ENUM ('file', 'test');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  CREATE TYPE public.homework_source AS ENUM ('curriculum', 'teacher');
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- Расширяем homework
ALTER TABLE public.homework
  ADD COLUMN IF NOT EXISTS content_type public.content_type    NOT NULL DEFAULT 'file',
  ADD COLUMN IF NOT EXISTS source       public.homework_source NOT NULL DEFAULT 'curriculum';

-- ── Вопросы теста ─────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.test_questions (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  homework_id   uuid NOT NULL REFERENCES public.homework(id)  ON DELETE CASCADE,
  question_text text NOT NULL,
  question_type text NOT NULL CHECK (question_type IN ('single_choice', 'open')),
  order_index   int  NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS test_questions_homework_id_idx ON public.test_questions (homework_id);

-- ── Варианты ответа (только single_choice) ────────────────────────────

CREATE TABLE IF NOT EXISTS public.test_question_options (
  id          uuid    PRIMARY KEY DEFAULT gen_random_uuid(),
  question_id uuid    NOT NULL REFERENCES public.test_questions(id) ON DELETE CASCADE,
  option_text text    NOT NULL,
  is_correct  boolean NOT NULL DEFAULT false,
  order_index int     NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS test_question_options_question_id_idx
  ON public.test_question_options (question_id);

-- ── Сдача теста (одна попытка) ────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.test_submissions (
  id           uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  homework_id  uuid        NOT NULL REFERENCES public.homework(id)  ON DELETE CASCADE,
  student_id   uuid        NOT NULL REFERENCES public.students(id)  ON DELETE CASCADE,
  submitted_at timestamptz NOT NULL DEFAULT now(),
  score        int,
  max_score    int,
  UNIQUE (homework_id, student_id)
);
CREATE INDEX IF NOT EXISTS test_submissions_student_id_idx ON public.test_submissions (student_id);

-- ── Ответы на вопросы ─────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.test_answers (
  id                 uuid    PRIMARY KEY DEFAULT gen_random_uuid(),
  submission_id      uuid    NOT NULL REFERENCES public.test_submissions(id) ON DELETE CASCADE,
  question_id        uuid    NOT NULL REFERENCES public.test_questions(id)   ON DELETE CASCADE,
  selected_option_id uuid    REFERENCES public.test_question_options(id),
  open_text          text,
  is_correct         boolean
);
CREATE INDEX IF NOT EXISTS test_answers_submission_id_idx ON public.test_answers (submission_id);

-- ── RLS ───────────────────────────────────────────────────────────────

ALTER TABLE public.test_questions        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.test_question_options ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.test_submissions      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.test_answers          ENABLE ROW LEVEL SECURITY;

-- test_questions: видны если homework в группе ученика
CREATE POLICY "student reads test questions"
  ON public.test_questions FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.homework h
      WHERE h.id = homework_id AND public.is_my_group(h.group_id)
    )
  );

-- test_question_options: видны если вопрос доступен ученику
CREATE POLICY "student reads test options"
  ON public.test_question_options FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1
        FROM public.test_questions q
        JOIN public.homework h ON h.id = q.homework_id
       WHERE q.id = question_id
         AND public.is_my_group(h.group_id)
    )
  );

-- test_submissions: собственная запись (SELECT + INSERT)
CREATE POLICY "student reads own test submissions"
  ON public.test_submissions FOR SELECT TO authenticated
  USING (student_id = public.current_student_id());

CREATE POLICY "student creates own test submission"
  ON public.test_submissions FOR INSERT TO authenticated
  WITH CHECK (
    student_id = public.current_student_id()
    AND EXISTS (
      SELECT 1 FROM public.homework h
      WHERE h.id = homework_id AND public.is_my_group(h.group_id)
    )
  );

-- test_answers: через submission (SELECT + INSERT)
CREATE POLICY "student reads own test answers"
  ON public.test_answers FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.test_submissions ts
      WHERE ts.id = submission_id
        AND ts.student_id = public.current_student_id()
    )
  );

CREATE POLICY "student creates own test answers"
  ON public.test_answers FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.test_submissions ts
      WHERE ts.id = submission_id
        AND ts.student_id = public.current_student_id()
    )
  );

-- ── GRANTs ────────────────────────────────────────────────────────────

GRANT SELECT
  ON public.test_questions, public.test_question_options
  TO authenticated, anon;

GRANT SELECT, INSERT
  ON public.test_submissions, public.test_answers
  TO authenticated;

-- ── Realtime ──────────────────────────────────────────────────────────

ALTER PUBLICATION supabase_realtime ADD TABLE public.test_submissions;
