-- ====================================================================
-- Migration 34: Announcements (rich) + Notifications + auto-notify triggers
-- Extends the legacy announcements table (migration 8) instead of recreating.
-- ====================================================================

-- 1. Extend announcements
ALTER TABLE public.announcements
  ADD COLUMN IF NOT EXISTS created_by        uuid REFERENCES public.teachers(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS scope             text,
  ADD COLUMN IF NOT EXISTS group_id          uuid REFERENCES public.groups(id)   ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS target_student_id uuid REFERENCES public.students(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS is_pinned         boolean NOT NULL DEFAULT false;

-- Backfill legacy rows (target_group_id) and drop ones with no group (no
-- equivalent scope in the new model).
UPDATE public.announcements SET group_id = target_group_id WHERE group_id IS NULL AND target_group_id IS NOT NULL;
UPDATE public.announcements SET scope = 'group' WHERE scope IS NULL AND group_id IS NOT NULL;
DELETE FROM public.announcements WHERE scope IS NULL;

ALTER TABLE public.announcements ALTER COLUMN scope SET NOT NULL;
ALTER TABLE public.announcements DROP CONSTRAINT IF EXISTS announcements_scope_check;
ALTER TABLE public.announcements ADD CONSTRAINT announcements_scope_check CHECK (
  (scope = 'group'         AND group_id IS NOT NULL AND target_student_id IS NULL)
  OR (scope = 'all_my_groups' AND group_id IS NULL     AND target_student_id IS NULL)
  OR (scope = 'student'    AND target_student_id IS NOT NULL AND group_id IS NULL)
);
CREATE INDEX IF NOT EXISTS announcements_created_by_idx ON public.announcements (created_by);

-- 2. announcement_reads
CREATE TABLE IF NOT EXISTS public.announcement_reads (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  announcement_id uuid NOT NULL REFERENCES public.announcements(id) ON DELETE CASCADE,
  student_id      uuid NOT NULL REFERENCES public.students(id)      ON DELETE CASCADE,
  read_at         timestamptz NOT NULL DEFAULT now(),
  UNIQUE (announcement_id, student_id)
);
CREATE INDEX IF NOT EXISTS announcement_reads_ann_idx ON public.announcement_reads (announcement_id);

-- 3. notifications
CREATE TABLE IF NOT EXISTS public.notifications (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  recipient_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  kind              text NOT NULL CHECK (kind IN (
    'announcement','new_homework','new_grade','homework_graded',
    'lesson_material','student_excused','student_submitted')),
  title             text NOT NULL,
  body              text,
  link              text,
  source_id         uuid,
  is_read           boolean NOT NULL DEFAULT false,
  read_at           timestamptz,
  created_at        timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS notifications_recipient_idx ON public.notifications (recipient_user_id, created_at DESC);

-- 4. Realtime
ALTER TABLE public.notifications  REPLICA IDENTITY FULL;
ALTER TABLE public.announcements  REPLICA IDENTITY FULL;
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
    IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname='supabase_realtime' AND schemaname='public' AND tablename='notifications') THEN
      ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname='supabase_realtime' AND schemaname='public' AND tablename='announcements') THEN
      ALTER PUBLICATION supabase_realtime ADD TABLE public.announcements;
    END IF;
  ELSE
    CREATE PUBLICATION supabase_realtime FOR TABLE public.notifications, public.announcements;
  END IF;
END $$;

-- 5. RLS
ALTER TABLE public.announcement_reads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications      ENABLE ROW LEVEL SECURITY;

-- announcements: replace legacy student policy
DROP POLICY IF EXISTS "student reads announcements" ON public.announcements;
CREATE POLICY "student reads announcements"
  ON public.announcements FOR SELECT TO authenticated
  USING (
    (scope = 'group' AND public.is_my_group(group_id))
    OR (scope = 'all_my_groups' AND EXISTS (
      SELECT 1 FROM public.groups g WHERE g.teacher_id = announcements.created_by AND public.is_my_group(g.id)))
    OR (scope = 'student' AND target_student_id = public.current_student_id())
  );
CREATE POLICY "teacher reads own announcements"
  ON public.announcements FOR SELECT TO authenticated
  USING (created_by = public.current_teacher_id());
CREATE POLICY "teacher creates announcements"
  ON public.announcements FOR INSERT TO authenticated
  WITH CHECK (
    created_by = public.current_teacher_id()
    AND (scope <> 'group' OR public.is_my_teacher_group(group_id))
    AND (scope <> 'student' OR EXISTS (
      SELECT 1 FROM public.student_groups sg JOIN public.groups g ON g.id = sg.group_id
      WHERE sg.student_id = target_student_id AND g.teacher_id = public.current_teacher_id()))
  );
CREATE POLICY "teacher updates own announcements"
  ON public.announcements FOR UPDATE TO authenticated
  USING (created_by = public.current_teacher_id()) WITH CHECK (created_by = public.current_teacher_id());
CREATE POLICY "teacher deletes own announcements"
  ON public.announcements FOR DELETE TO authenticated
  USING (created_by = public.current_teacher_id());

-- announcement_reads
CREATE POLICY "student reads own reads"
  ON public.announcement_reads FOR SELECT TO authenticated
  USING (student_id = public.current_student_id());
CREATE POLICY "student inserts own reads"
  ON public.announcement_reads FOR INSERT TO authenticated
  WITH CHECK (student_id = public.current_student_id());
CREATE POLICY "teacher reads reads of own announcements"
  ON public.announcement_reads FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.announcements a WHERE a.id = announcement_id AND a.created_by = public.current_teacher_id()));

-- notifications: own only
CREATE POLICY "user reads own notifications"
  ON public.notifications FOR SELECT TO authenticated
  USING (recipient_user_id = auth.uid());
CREATE POLICY "user updates own notifications"
  ON public.notifications FOR UPDATE TO authenticated
  USING (recipient_user_id = auth.uid()) WITH CHECK (recipient_user_id = auth.uid());
CREATE POLICY "user deletes own notifications"
  ON public.notifications FOR DELETE TO authenticated
  USING (recipient_user_id = auth.uid());
CREATE POLICY "user inserts own notifications"
  ON public.notifications FOR INSERT TO authenticated
  WITH CHECK (recipient_user_id = auth.uid());

-- 6. GRANTs
GRANT SELECT, INSERT, UPDATE, DELETE ON public.announcements      TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.announcement_reads TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.notifications      TO authenticated;

-- ====================================================================
-- 7. Notification triggers (SECURITY DEFINER so they bypass notifications RLS)
-- ====================================================================

-- 7.1 New announcement → notify recipients
CREATE OR REPLACE FUNCTION public.fn_announcement_notify() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.scope = 'group' THEN
    INSERT INTO public.notifications (recipient_user_id, kind, title, body, link, source_id)
    SELECT s.user_id, 'announcement', NEW.title, left(NEW.body, 100), '/announcements', NEW.id
    FROM public.student_groups sg JOIN public.students s ON s.id = sg.student_id
    WHERE sg.group_id = NEW.group_id AND s.user_id IS NOT NULL;
  ELSIF NEW.scope = 'all_my_groups' THEN
    INSERT INTO public.notifications (recipient_user_id, kind, title, body, link, source_id)
    SELECT DISTINCT s.user_id, 'announcement', NEW.title, left(NEW.body, 100), '/announcements', NEW.id
    FROM public.groups g
    JOIN public.student_groups sg ON sg.group_id = g.id
    JOIN public.students s ON s.id = sg.student_id
    WHERE g.teacher_id = NEW.created_by AND s.user_id IS NOT NULL;
  ELSIF NEW.scope = 'student' THEN
    INSERT INTO public.notifications (recipient_user_id, kind, title, body, link, source_id)
    SELECT s.user_id, 'announcement', NEW.title, left(NEW.body, 100), '/announcements', NEW.id
    FROM public.students s WHERE s.id = NEW.target_student_id AND s.user_id IS NOT NULL;
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS trg_announcement_notify ON public.announcements;
CREATE TRIGGER trg_announcement_notify AFTER INSERT ON public.announcements
  FOR EACH ROW EXECUTE FUNCTION public.fn_announcement_notify();

-- 7.2 New homework → notify group students
CREATE OR REPLACE FUNCTION public.fn_homework_notify() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.notifications (recipient_user_id, kind, title, body, link, source_id)
  SELECT s.user_id, 'new_homework', 'Новое задание', NEW.title, '/homework/' || NEW.id, NEW.id
  FROM public.student_groups sg JOIN public.students s ON s.id = sg.student_id
  WHERE sg.group_id = NEW.group_id AND s.user_id IS NOT NULL;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS trg_homework_notify ON public.homework;
CREATE TRIGGER trg_homework_notify AFTER INSERT ON public.homework
  FOR EACH ROW EXECUTE FUNCTION public.fn_homework_notify();

-- 7.3 Student submitted homework → notify teacher
CREATE OR REPLACE FUNCTION public.fn_homework_submission_notify() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE t_user uuid; sname text; htitle text;
BEGIN
  IF NEW.submitted_at IS NULL THEN RETURN NEW; END IF;
  SELECT t.user_id, h.title INTO t_user, htitle
  FROM public.homework h JOIN public.teachers t ON t.id = h.teacher_id WHERE h.id = NEW.homework_id;
  SELECT full_name INTO sname FROM public.students WHERE id = NEW.student_id;
  IF t_user IS NOT NULL THEN
    INSERT INTO public.notifications (recipient_user_id, kind, title, body, link, source_id)
    VALUES (t_user, 'student_submitted', 'Ученик сдал работу',
            coalesce(sname,'') || ': ' || coalesce(htitle,''), '/teacher/homework/' || NEW.homework_id, NEW.id);
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS trg_homework_submission_notify ON public.homework_submissions;
CREATE TRIGGER trg_homework_submission_notify AFTER INSERT ON public.homework_submissions
  FOR EACH ROW EXECUTE FUNCTION public.fn_homework_submission_notify();

-- 7.4 Grade set → notify student (generic helper per table)
CREATE OR REPLACE FUNCTION public.fn_notify_student_grade(p_student_id uuid, p_grade int, p_what text, p_source uuid) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE s_user uuid;
BEGIN
  SELECT user_id INTO s_user FROM public.students WHERE id = p_student_id;
  IF s_user IS NOT NULL THEN
    INSERT INTO public.notifications (recipient_user_id, kind, title, body, link, source_id)
    VALUES (s_user, 'new_grade', 'Новая оценка', 'Оценка ' || p_grade || ' за ' || coalesce(p_what,''), '/grades', p_source);
  END IF;
END $$;

CREATE OR REPLACE FUNCTION public.fn_homework_grade_notify() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE w text;
BEGIN
  IF OLD.grade IS NOT NULL OR NEW.grade IS NULL THEN RETURN NEW; END IF;
  SELECT title INTO w FROM public.homework WHERE id = NEW.homework_id;
  PERFORM public.fn_notify_student_grade(NEW.student_id, NEW.grade, w, NEW.id);
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS trg_homework_grade_notify ON public.homework_submissions;
CREATE TRIGGER trg_homework_grade_notify AFTER UPDATE ON public.homework_submissions
  FOR EACH ROW EXECUTE FUNCTION public.fn_homework_grade_notify();

CREATE OR REPLACE FUNCTION public.fn_classwork_grade_notify() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE w text;
BEGIN
  IF OLD.grade IS NOT NULL OR NEW.grade IS NULL THEN RETURN NEW; END IF;
  SELECT title INTO w FROM public.classwork WHERE id = NEW.classwork_id;
  PERFORM public.fn_notify_student_grade(NEW.student_id, NEW.grade, w, NEW.id);
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS trg_classwork_grade_notify ON public.classwork_submissions;
CREATE TRIGGER trg_classwork_grade_notify AFTER UPDATE ON public.classwork_submissions
  FOR EACH ROW EXECUTE FUNCTION public.fn_classwork_grade_notify();

CREATE OR REPLACE FUNCTION public.fn_project_grade_notify() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE w text;
BEGIN
  IF OLD.grade IS NOT NULL OR NEW.grade IS NULL THEN RETURN NEW; END IF;
  SELECT title INTO w FROM public.projects WHERE id = NEW.project_id;
  PERFORM public.fn_notify_student_grade(NEW.student_id, NEW.grade, w, NEW.id);
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS trg_project_grade_notify ON public.project_submissions;
CREATE TRIGGER trg_project_grade_notify AFTER UPDATE ON public.project_submissions
  FOR EACH ROW EXECUTE FUNCTION public.fn_project_grade_notify();

CREATE OR REPLACE FUNCTION public.fn_test_grade_notify() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE w text;
BEGIN
  IF OLD.grade IS NOT NULL OR NEW.grade IS NULL THEN RETURN NEW; END IF;
  SELECT title INTO w FROM public.homework WHERE id = NEW.homework_id;
  PERFORM public.fn_notify_student_grade(NEW.student_id, NEW.grade, w, NEW.id);
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS trg_test_grade_notify ON public.test_submissions;
CREATE TRIGGER trg_test_grade_notify AFTER UPDATE ON public.test_submissions
  FOR EACH ROW EXECUTE FUNCTION public.fn_test_grade_notify();

-- 7.5 Student excused → notify lesson's teacher
CREATE OR REPLACE FUNCTION public.fn_excuse_notify() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE t_user uuid; sname text;
BEGIN
  SELECT t.user_id INTO t_user
  FROM public.lessons l JOIN public.groups g ON g.id = l.group_id JOIN public.teachers t ON t.id = g.teacher_id
  WHERE l.id = NEW.lesson_id;
  SELECT full_name INTO sname FROM public.students WHERE id = NEW.student_id;
  IF t_user IS NOT NULL THEN
    INSERT INTO public.notifications (recipient_user_id, kind, title, body, link, source_id)
    VALUES (t_user, 'student_excused', 'Ученик отпросился',
            coalesce(sname,'') || ': ' || coalesce(NEW.reason,''), '/teacher/lessons/' || NEW.lesson_id, NEW.id);
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS trg_excuse_notify ON public.lesson_excuse_requests;
CREATE TRIGGER trg_excuse_notify AFTER INSERT ON public.lesson_excuse_requests
  FOR EACH ROW EXECUTE FUNCTION public.fn_excuse_notify();

-- 7.6 New lesson material → notify group students
CREATE OR REPLACE FUNCTION public.fn_lesson_material_notify() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE gid uuid;
BEGIN
  SELECT group_id INTO gid FROM public.lessons WHERE id = NEW.lesson_id;
  INSERT INTO public.notifications (recipient_user_id, kind, title, body, link, source_id)
  SELECT s.user_id, 'lesson_material', 'Новый материал', NEW.title, '/lessons/' || NEW.lesson_id, NEW.id
  FROM public.student_groups sg JOIN public.students s ON s.id = sg.student_id
  WHERE sg.group_id = gid AND s.user_id IS NOT NULL;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS trg_lesson_material_notify ON public.lesson_materials;
CREATE TRIGGER trg_lesson_material_notify AFTER INSERT ON public.lesson_materials
  FOR EACH ROW EXECUTE FUNCTION public.fn_lesson_material_notify();
