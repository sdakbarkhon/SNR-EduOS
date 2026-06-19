-- ====================================================================
-- Migration 30: Lesson features — excuse requests + raised hands
-- ====================================================================

-- 1. lesson_excuse_requests — student asks to be excused before the lesson
CREATE TABLE public.lesson_excuse_requests (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lesson_id   uuid NOT NULL REFERENCES public.lessons(id)  ON DELETE CASCADE,
  student_id  uuid NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  reason      text NOT NULL,
  created_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (lesson_id, student_id)
);
CREATE INDEX lesson_excuse_requests_lesson_idx ON public.lesson_excuse_requests (lesson_id);

-- 2. lesson_raised_hands — student raises hand during a live lesson
CREATE TABLE public.lesson_raised_hands (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lesson_id   uuid NOT NULL REFERENCES public.lessons(id)  ON DELETE CASCADE,
  student_id  uuid NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  raised_at   timestamptz NOT NULL DEFAULT now(),
  lowered_at  timestamptz,                                    -- null = currently raised
  lowered_by  uuid REFERENCES public.teachers(id) ON DELETE SET NULL,
  UNIQUE (lesson_id, student_id, raised_at)
);
CREATE INDEX lesson_raised_hands_lesson_idx ON public.lesson_raised_hands (lesson_id);
CREATE INDEX lesson_raised_hands_active_idx ON public.lesson_raised_hands (lesson_id) WHERE lowered_at IS NULL;

-- 3. Realtime needs full row images for UPDATE/DELETE payloads
ALTER TABLE public.lesson_excuse_requests REPLICA IDENTITY FULL;
ALTER TABLE public.lesson_raised_hands    REPLICA IDENTITY FULL;

-- 4. Add to realtime publication (create it if it doesn't exist yet)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.lesson_excuse_requests;
    ALTER PUBLICATION supabase_realtime ADD TABLE public.lesson_raised_hands;
  ELSE
    CREATE PUBLICATION supabase_realtime
      FOR TABLE public.lesson_excuse_requests, public.lesson_raised_hands;
  END IF;
END $$;

-- 5. RLS
ALTER TABLE public.lesson_excuse_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lesson_raised_hands    ENABLE ROW LEVEL SECURITY;

-- ── lesson_excuse_requests ──────────────────────────────────────────
-- Student reads own requests
CREATE POLICY "student reads own excuse requests"
  ON public.lesson_excuse_requests FOR SELECT TO authenticated
  USING (student_id = public.current_student_id());

-- Teacher reads requests for lessons in own groups
CREATE POLICY "teacher reads excuse requests in own groups"
  ON public.lesson_excuse_requests FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.lessons l
    WHERE l.id = lesson_id AND public.is_my_teacher_group(l.group_id)
  ));

-- Student inserts own request, only for own-group lesson that is still scheduled
CREATE POLICY "student creates own excuse request"
  ON public.lesson_excuse_requests FOR INSERT TO authenticated
  WITH CHECK (
    student_id = public.current_student_id()
    AND EXISTS (
      SELECT 1 FROM public.lessons l
      WHERE l.id = lesson_id
        AND public.is_my_group(l.group_id)
        AND l.status = 'scheduled'
    )
  );

-- Student updates own request (change reason) while lesson still scheduled
CREATE POLICY "student updates own excuse request"
  ON public.lesson_excuse_requests FOR UPDATE TO authenticated
  USING (
    student_id = public.current_student_id()
    AND EXISTS (
      SELECT 1 FROM public.lessons l
      WHERE l.id = lesson_id AND l.status = 'scheduled'
    )
  )
  WITH CHECK (student_id = public.current_student_id());

-- Student cancels own request
CREATE POLICY "student deletes own excuse request"
  ON public.lesson_excuse_requests FOR DELETE TO authenticated
  USING (student_id = public.current_student_id());

-- ── lesson_raised_hands ─────────────────────────────────────────────
-- Student reads own hands
CREATE POLICY "student reads own raised hands"
  ON public.lesson_raised_hands FOR SELECT TO authenticated
  USING (student_id = public.current_student_id());

-- Teacher reads hands for lessons in own groups
CREATE POLICY "teacher reads raised hands in own groups"
  ON public.lesson_raised_hands FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.lessons l
    WHERE l.id = lesson_id AND public.is_my_teacher_group(l.group_id)
  ));

-- Student raises hand only for own-group lesson that is in progress
CREATE POLICY "student raises own hand"
  ON public.lesson_raised_hands FOR INSERT TO authenticated
  WITH CHECK (
    student_id = public.current_student_id()
    AND EXISTS (
      SELECT 1 FROM public.lessons l
      WHERE l.id = lesson_id
        AND public.is_my_group(l.group_id)
        AND l.status = 'in_progress'
    )
  );

-- Teacher lowers a hand (sets lowered_at / lowered_by) in own groups
CREATE POLICY "teacher lowers raised hand"
  ON public.lesson_raised_hands FOR UPDATE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.lessons l
    WHERE l.id = lesson_id AND public.is_my_teacher_group(l.group_id)
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.lessons l
    WHERE l.id = lesson_id AND public.is_my_teacher_group(l.group_id)
  ));

-- NOTE: no DELETE policy + no DELETE grant on lesson_raised_hands → deletes
-- are denied for everyone (raised-hand history is immutable).

-- 6. GRANTs
GRANT SELECT, INSERT, UPDATE, DELETE ON public.lesson_excuse_requests TO authenticated;
GRANT SELECT, INSERT, UPDATE         ON public.lesson_raised_hands    TO authenticated;
