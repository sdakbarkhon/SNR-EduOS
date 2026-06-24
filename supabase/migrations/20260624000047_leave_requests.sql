-- ====================================================================
-- Migration 47: leave_requests
-- Student can request to leave an in-progress lesson; teacher approves/rejects.
-- ====================================================================

CREATE TABLE IF NOT EXISTS public.leave_requests (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  lesson_id   uuid        NOT NULL REFERENCES public.lessons(id) ON DELETE CASCADE,
  student_id  uuid        NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  reason      text        NOT NULL,
  status      text        NOT NULL DEFAULT 'pending'
                          CHECK (status IN ('pending', 'approved', 'rejected')),
  decided_by  uuid        REFERENCES public.teachers(id),
  decided_at  timestamptz,
  created_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (lesson_id, student_id)
);

CREATE INDEX IF NOT EXISTS leave_requests_lesson_idx  ON public.leave_requests (lesson_id);
CREATE INDEX IF NOT EXISTS leave_requests_student_idx ON public.leave_requests (student_id);

ALTER TABLE public.leave_requests ENABLE ROW LEVEL SECURITY;

-- Student can see and create their own
DROP POLICY IF EXISTS "student selects own leave_requests" ON public.leave_requests;
CREATE POLICY "student selects own leave_requests" ON public.leave_requests
  FOR SELECT USING (student_id = public.current_student_id());

DROP POLICY IF EXISTS "student inserts own leave_requests" ON public.leave_requests;
CREATE POLICY "student inserts own leave_requests" ON public.leave_requests
  FOR INSERT WITH CHECK (student_id = public.current_student_id());

-- Teacher can see and update requests for their lessons
DROP POLICY IF EXISTS "teacher manages leave_requests" ON public.leave_requests;
CREATE POLICY "teacher manages leave_requests" ON public.leave_requests
  FOR ALL USING (
    EXISTS (
      SELECT 1
      FROM public.lessons l
      JOIN public.groups g ON g.id = l.group_id
      WHERE l.id = leave_requests.lesson_id
        AND g.teacher_id = public.current_teacher_id()
    )
  );

-- GRANTs
GRANT SELECT, INSERT            ON public.leave_requests TO authenticated;
GRANT UPDATE (status, decided_by, decided_at) ON public.leave_requests TO authenticated;

-- ── Trigger: notify teacher on new leave request ─────────────────────────────
CREATE OR REPLACE FUNCTION public.fn_leave_request_notify()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  t_user  uuid;
  sname   text;
  ltitle  text;
BEGIN
  -- Find teacher user_id via lesson → group → teacher
  SELECT t.user_id INTO t_user
  FROM public.lessons l
  JOIN public.groups   g ON g.id = l.group_id
  JOIN public.teachers t ON t.id = g.teacher_id
  WHERE l.id = NEW.lesson_id
  LIMIT 1;

  SELECT full_name INTO sname FROM public.students WHERE id = NEW.student_id;
  SELECT coalesce(title, topic, 'урок') INTO ltitle FROM public.lessons WHERE id = NEW.lesson_id;

  IF t_user IS NOT NULL THEN
    INSERT INTO public.notifications (recipient_user_id, kind, title, body, link, source_id)
    VALUES (
      t_user,
      'leave_request',
      coalesce(sname, 'Ученик') || ' просит отпроситься',
      'Причина: ' || coalesce(NEW.reason, ''),
      '/teacher/lessons/' || NEW.lesson_id,
      NEW.id
    );
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_leave_request_notify ON public.leave_requests;
CREATE TRIGGER trg_leave_request_notify
  AFTER INSERT ON public.leave_requests
  FOR EACH ROW EXECUTE FUNCTION public.fn_leave_request_notify();

-- ── Trigger: notify student when teacher decides ─────────────────────────────
CREATE OR REPLACE FUNCTION public.fn_leave_decision_notify()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  s_user uuid;
  ltitle text;
BEGIN
  IF OLD.status = 'pending' AND NEW.status IN ('approved', 'rejected') THEN
    SELECT user_id INTO s_user FROM public.students WHERE id = NEW.student_id;
    SELECT coalesce(title, topic, 'урок') INTO ltitle FROM public.lessons WHERE id = NEW.lesson_id;

    IF s_user IS NOT NULL THEN
      INSERT INTO public.notifications (recipient_user_id, kind, title, body, link, source_id)
      VALUES (
        s_user,
        'leave_decision',
        CASE WHEN NEW.status = 'approved' THEN 'Запрос одобрен' ELSE 'Запрос отклонён' END,
        'Урок: ' || coalesce(ltitle, ''),
        '/schedule',
        NEW.id
      );
    END IF;
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_leave_decision_notify ON public.leave_requests;
CREATE TRIGGER trg_leave_decision_notify
  AFTER UPDATE ON public.leave_requests
  FOR EACH ROW EXECUTE FUNCTION public.fn_leave_decision_notify();
