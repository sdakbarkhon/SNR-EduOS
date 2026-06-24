-- Migration 41: AI chat history table + daily limit helper
-- Stores messages between students and the AI assistant per lesson/stage.

-- ── Table ────────────────────────────────────────────────────────────────────

CREATE TABLE public.ai_chat_messages (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id  uuid        NOT NULL REFERENCES public.students(id)       ON DELETE CASCADE,
  lesson_id   uuid        NOT NULL REFERENCES public.lessons(id)        ON DELETE CASCADE,
  stage_id    uuid                 REFERENCES public.lesson_stages(id)  ON DELETE SET NULL,
  role        text        NOT NULL CHECK (role IN ('user', 'assistant', 'system')),
  content     text        NOT NULL,
  tokens_used int         NOT NULL DEFAULT 0,
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_ai_chat_messages_lookup
  ON public.ai_chat_messages (student_id, lesson_id, created_at);

-- ── RLS ──────────────────────────────────────────────────────────────────────

ALTER TABLE public.ai_chat_messages ENABLE ROW LEVEL SECURITY;

-- Student: read and write own messages only
CREATE POLICY "student reads own ai messages"
  ON public.ai_chat_messages FOR SELECT TO authenticated
  USING (student_id = public.current_student_id());

CREATE POLICY "student inserts own ai messages"
  ON public.ai_chat_messages FOR INSERT TO authenticated
  WITH CHECK (student_id = public.current_student_id());

-- Teacher: read messages of students in own groups (audit)
CREATE POLICY "teacher reads ai messages of own groups"
  ON public.ai_chat_messages FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1
        FROM public.students s
        JOIN public.student_groups sg ON sg.student_id = s.id
        JOIN public.groups g          ON g.id = sg.group_id
       WHERE s.id = ai_chat_messages.student_id
         AND g.teacher_id = public.current_teacher_id()
    )
  );

-- DELETE / UPDATE: no policy defined → default-deny enforced by RLS
-- GRANT also excludes DELETE/UPDATE to add a second layer of protection.

GRANT SELECT, INSERT ON public.ai_chat_messages TO authenticated;

-- ── Daily limit helper ───────────────────────────────────────────────────────

-- Returns the number of 'user' messages the student has sent today
-- (Asia/Tashkent midnight as the day boundary).
CREATE OR REPLACE FUNCTION public.fn_ai_messages_today(p_student_id uuid)
RETURNS int LANGUAGE sql STABLE
AS $$
  SELECT count(*)::int
    FROM public.ai_chat_messages
   WHERE student_id = p_student_id
     AND role       = 'user'
     AND created_at >= (now() AT TIME ZONE 'Asia/Tashkent')::date
                        AT TIME ZONE 'Asia/Tashkent';
$$;
