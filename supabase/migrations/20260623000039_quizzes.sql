-- =============================================================================
-- Migration 39: Quizzes in lessons — QIA self-paced test + Kahoot live game.
-- Both quiz kinds (content_type='quiz_qia' / 'quiz_kahoot') share the same
-- question structure; the difference is the live mode (self-paced vs teacher-driven).
-- Single choice only, text + emoji questions (no images in this MVP).
-- =============================================================================

-- 1. quiz_questions ──────────────────────────────────────────────────────────
CREATE TABLE public.quiz_questions (
  id                        uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  stage_id                  uuid NOT NULL REFERENCES public.lesson_stages(id) ON DELETE CASCADE,
  position                  int  NOT NULL,
  question_text             text NOT NULL,
  options                   jsonb NOT NULL,            -- ["Ответ 1", "Ответ 2", ...]
  correct_option_index      int  NOT NULL,             -- 0-based index into options
  points                    int  NOT NULL DEFAULT 1,   -- QIA only; Kahoot uses the speed formula
  time_per_question_seconds int  NOT NULL DEFAULT 20,  -- Kahoot per-question timer
  UNIQUE (stage_id, position)
);
CREATE INDEX quiz_questions_stage_idx ON public.quiz_questions (stage_id);

-- 2. quiz_attempts ───────────────────────────────────────────────────────────
CREATE TABLE public.quiz_attempts (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  stage_id        uuid NOT NULL REFERENCES public.lesson_stages(id) ON DELETE CASCADE,
  student_id      uuid NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  started_at      timestamptz NOT NULL DEFAULT now(),
  finished_at     timestamptz,
  total_questions int  NOT NULL DEFAULT 0,
  correct_count   int  NOT NULL DEFAULT 0,
  total_score     int  NOT NULL DEFAULT 0,             -- QIA: sum(points); Kahoot: sum(speed score)
  is_finalized    boolean NOT NULL DEFAULT false,
  UNIQUE (stage_id, student_id)                        -- one attempt per student per stage
);
CREATE INDEX quiz_attempts_student_idx ON public.quiz_attempts (student_id);

-- 3. quiz_answers ────────────────────────────────────────────────────────────
CREATE TABLE public.quiz_answers (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  attempt_id            uuid NOT NULL REFERENCES public.quiz_attempts(id) ON DELETE CASCADE,
  question_id           uuid NOT NULL REFERENCES public.quiz_questions(id) ON DELETE CASCADE,
  selected_option_index int,                           -- null = not answered
  is_correct            boolean,
  answered_at           timestamptz NOT NULL DEFAULT now(),
  response_time_ms      int,                            -- Kahoot: answer time in ms
  score                 int NOT NULL DEFAULT 0,         -- points for this answer
  UNIQUE (attempt_id, question_id)
);

-- 4. kahoot_sessions ─────────────────────────────────────────────────────────
CREATE TABLE public.kahoot_sessions (
  id                     uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  stage_id               uuid NOT NULL REFERENCES public.lesson_stages(id) ON DELETE CASCADE,
  started_at             timestamptz,
  finished_at            timestamptz,
  current_question_index int NOT NULL DEFAULT -1,       -- -1 = lobby; 0..N-1 = question; N = end
  question_started_at    timestamptz,
  status                 text NOT NULL DEFAULT 'lobby'
                           CHECK (status IN ('lobby','question_active','question_revealed','finished')),
  UNIQUE (stage_id)                                     -- one session per stage (teacher reset = recreate)
);

-- 5. REPLICA IDENTITY FULL + realtime publication ────────────────────────────
-- (teacher RLS references non-PK columns via joins → FULL is required for UPDATE
--  events to reach subscribers; see migration 37 rationale.)
ALTER TABLE public.kahoot_sessions REPLICA IDENTITY FULL;
ALTER TABLE public.quiz_answers    REPLICA IDENTITY FULL;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
    IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname='supabase_realtime' AND schemaname='public' AND tablename='kahoot_sessions') THEN
      ALTER PUBLICATION supabase_realtime ADD TABLE public.kahoot_sessions;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname='supabase_realtime' AND schemaname='public' AND tablename='quiz_answers') THEN
      ALTER PUBLICATION supabase_realtime ADD TABLE public.quiz_answers;
    END IF;
  ELSE
    CREATE PUBLICATION supabase_realtime FOR TABLE public.kahoot_sessions, public.quiz_answers;
  END IF;
END $$;

-- 6. RLS ─────────────────────────────────────────────────────────────────────
ALTER TABLE public.quiz_questions  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quiz_attempts   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quiz_answers    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.kahoot_sessions ENABLE ROW LEVEL SECURITY;

-- Helper expression: group_id of the lesson that owns a stage.
--   (SELECT l.group_id FROM lesson_stages ls JOIN lessons l ON l.id = ls.lesson_id WHERE ls.id = <stage_id>)

-- ── quiz_questions ──
CREATE POLICY "student reads quiz questions"
  ON public.quiz_questions FOR SELECT TO authenticated
  USING (public.is_my_group(
    (SELECT l.group_id FROM public.lesson_stages ls JOIN public.lessons l ON l.id = ls.lesson_id WHERE ls.id = stage_id)));

CREATE POLICY "teacher manages quiz questions"
  ON public.quiz_questions FOR ALL TO authenticated
  USING (public.is_my_teacher_group(
    (SELECT l.group_id FROM public.lesson_stages ls JOIN public.lessons l ON l.id = ls.lesson_id WHERE ls.id = stage_id)))
  WITH CHECK (public.is_my_teacher_group(
    (SELECT l.group_id FROM public.lesson_stages ls JOIN public.lessons l ON l.id = ls.lesson_id WHERE ls.id = stage_id)));

-- ── quiz_attempts ──
CREATE POLICY "student reads own quiz attempts"
  ON public.quiz_attempts FOR SELECT TO authenticated
  USING (student_id = public.current_student_id());

CREATE POLICY "student inserts own quiz attempts"
  ON public.quiz_attempts FOR INSERT TO authenticated
  WITH CHECK (student_id = public.current_student_id());

CREATE POLICY "student updates own quiz attempts"
  ON public.quiz_attempts FOR UPDATE TO authenticated
  USING (student_id = public.current_student_id())
  WITH CHECK (student_id = public.current_student_id());

CREATE POLICY "teacher reads group quiz attempts"
  ON public.quiz_attempts FOR SELECT TO authenticated
  USING (public.is_my_teacher_group(
    (SELECT l.group_id FROM public.lesson_stages ls JOIN public.lessons l ON l.id = ls.lesson_id WHERE ls.id = stage_id)));

-- teacher needs to finalize Kahoot scores at game end
CREATE POLICY "teacher updates group quiz attempts"
  ON public.quiz_attempts FOR UPDATE TO authenticated
  USING (public.is_my_teacher_group(
    (SELECT l.group_id FROM public.lesson_stages ls JOIN public.lessons l ON l.id = ls.lesson_id WHERE ls.id = stage_id)));

-- ── quiz_answers ──
CREATE POLICY "student reads own quiz answers"
  ON public.quiz_answers FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.quiz_attempts a WHERE a.id = attempt_id AND a.student_id = public.current_student_id()));

CREATE POLICY "student inserts own quiz answers"
  ON public.quiz_answers FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM public.quiz_attempts a WHERE a.id = attempt_id AND a.student_id = public.current_student_id()));

CREATE POLICY "student updates own quiz answers"
  ON public.quiz_answers FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.quiz_attempts a WHERE a.id = attempt_id AND a.student_id = public.current_student_id()));

CREATE POLICY "teacher reads group quiz answers"
  ON public.quiz_answers FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.quiz_attempts a
    JOIN public.lesson_stages ls ON ls.id = a.stage_id
    JOIN public.lessons l ON l.id = ls.lesson_id
    WHERE a.id = attempt_id AND public.is_my_teacher_group(l.group_id)));

-- ── kahoot_sessions ──
CREATE POLICY "student reads kahoot sessions"
  ON public.kahoot_sessions FOR SELECT TO authenticated
  USING (public.is_my_group(
    (SELECT l.group_id FROM public.lesson_stages ls JOIN public.lessons l ON l.id = ls.lesson_id WHERE ls.id = stage_id)));

CREATE POLICY "teacher manages kahoot sessions"
  ON public.kahoot_sessions FOR ALL TO authenticated
  USING (public.is_my_teacher_group(
    (SELECT l.group_id FROM public.lesson_stages ls JOIN public.lessons l ON l.id = ls.lesson_id WHERE ls.id = stage_id)))
  WITH CHECK (public.is_my_teacher_group(
    (SELECT l.group_id FROM public.lesson_stages ls JOIN public.lessons l ON l.id = ls.lesson_id WHERE ls.id = stage_id)));

-- Kahoot: teacher writes a grade row per student at game end. Existing
-- lesson_stage_progress policies (migration 35) only allow teacher SELECT+UPDATE;
-- add INSERT so finishKahootGame can upsert grades for students without a row yet.
CREATE POLICY "teacher inserts stage progress in own groups"
  ON public.lesson_stage_progress FOR INSERT TO authenticated
  WITH CHECK (public.is_my_teacher_group(
    (SELECT l.group_id FROM public.lessons l
     JOIN public.lesson_stages ls ON ls.lesson_id = l.id
     WHERE ls.id = stage_id LIMIT 1)));

-- 7. Grants ──────────────────────────────────────────────────────────────────
GRANT SELECT ON public.quiz_questions  TO authenticated, anon;
GRANT INSERT, UPDATE, DELETE ON public.quiz_questions TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.quiz_attempts  TO authenticated;
GRANT SELECT ON public.quiz_attempts TO anon;
GRANT SELECT, INSERT, UPDATE ON public.quiz_answers   TO authenticated;
GRANT SELECT ON public.quiz_answers TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.kahoot_sessions TO authenticated;
GRANT SELECT ON public.kahoot_sessions TO anon;
