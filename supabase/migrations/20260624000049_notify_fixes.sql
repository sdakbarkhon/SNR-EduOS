-- ====================================================================
-- Migration 49: notification trigger fixes + new student notifications
-- 1. Extend kind constraint with new kinds
-- 2. Fix homework trigger — students only
-- 3. Add lesson INSERT trigger → students
-- 4. Add lesson_grades INSERT trigger → student
-- 5. Add lesson_stage_progress grade trigger → student
-- 6. Fix announcement trigger — teachers only when admin created
-- 7. Clean up stale teacher notifications
-- ====================================================================

-- 1. Extend kind constraint
ALTER TABLE public.notifications
  DROP CONSTRAINT IF EXISTS notifications_kind_check;

ALTER TABLE public.notifications
  ADD CONSTRAINT notifications_kind_check CHECK (kind IN (
    'announcement', 'new_homework', 'new_grade', 'homework_graded',
    'lesson_material', 'student_excused', 'student_submitted',
    'leave_request', 'leave_decision', 'lesson_starting_soon',
    'lesson_created', 'grade_received', 'announcement_new'
  ));

-- 2. Fix homework INSERT trigger — notify only students, not all users
CREATE OR REPLACE FUNCTION public.fn_homework_notify() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.notifications (recipient_user_id, kind, title, body, link, source_id)
  SELECT s.user_id, 'new_homework', 'Новое задание: ' || NEW.title, NEW.description, '/homework/' || NEW.id, NEW.id
  FROM public.student_groups sg
  JOIN public.students s ON s.id = sg.student_id
  WHERE sg.group_id = NEW.group_id AND s.user_id IS NOT NULL;
  RETURN NEW;
END $$;

-- 3. Trigger: lesson INSERT → notify students of the group
CREATE OR REPLACE FUNCTION public.fn_lesson_created_notify() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  lesson_date text;
  lesson_time text;
BEGIN
  lesson_date := to_char((NEW.starts_at AT TIME ZONE 'Asia/Tashkent'), 'DD.MM.YYYY');
  lesson_time := to_char((NEW.starts_at AT TIME ZONE 'Asia/Tashkent'), 'HH24:MI');

  INSERT INTO public.notifications (recipient_user_id, kind, title, body, link, source_id)
  SELECT s.user_id, 'lesson_created',
         'Новый урок: ' || coalesce(NEW.title, NEW.topic, 'Урок'),
         'Дата: ' || lesson_date || ', Время: ' || lesson_time,
         '/lessons/' || NEW.id,
         NEW.id
  FROM public.student_groups sg
  JOIN public.students s ON s.id = sg.student_id
  WHERE sg.group_id = NEW.group_id AND s.user_id IS NOT NULL;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_lesson_created_notify ON public.lessons;
CREATE TRIGGER trg_lesson_created_notify
  AFTER INSERT ON public.lessons
  FOR EACH ROW EXECUTE FUNCTION public.fn_lesson_created_notify();

-- 4. Trigger: lesson_grades INSERT → notify student
CREATE OR REPLACE FUNCTION public.fn_lesson_grade_notify() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  s_user uuid;
  l_title text;
BEGIN
  SELECT user_id INTO s_user FROM public.students WHERE id = NEW.student_id;
  SELECT coalesce(title, topic, 'урок') INTO l_title FROM public.lessons WHERE id = NEW.lesson_id;
  IF s_user IS NOT NULL THEN
    INSERT INTO public.notifications (recipient_user_id, kind, title, body, link, source_id)
    VALUES (
      s_user, 'grade_received',
      'Новая оценка: ' || NEW.grade::text || '/5',
      'Урок: ' || coalesce(l_title, '') ||
        CASE WHEN NEW.comment IS NOT NULL AND NEW.comment <> '' THEN ', Комментарий: ' || NEW.comment ELSE '' END,
      '/grades',
      NEW.id
    );
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_lesson_grade_notify ON public.lesson_grades;
CREATE TRIGGER trg_lesson_grade_notify
  AFTER INSERT ON public.lesson_grades
  FOR EACH ROW EXECUTE FUNCTION public.fn_lesson_grade_notify();

-- 5. Trigger: lesson_stage_progress grade → notify student when graded_at set
CREATE OR REPLACE FUNCTION public.fn_stage_grade_notify() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  s_user uuid;
BEGIN
  -- Only fire when graded_at transitions from NULL to a value
  IF OLD.graded_at IS NOT NULL OR NEW.graded_at IS NULL THEN
    RETURN NEW;
  END IF;
  IF NEW.grade IS NULL THEN
    RETURN NEW;
  END IF;
  SELECT user_id INTO s_user FROM public.students WHERE id = NEW.student_id;
  IF s_user IS NOT NULL THEN
    INSERT INTO public.notifications (recipient_user_id, kind, title, body, link, source_id)
    VALUES (
      s_user, 'grade_received',
      'Оценка за этап: ' || NEW.grade::text || '/5',
      CASE WHEN NEW.teacher_comment IS NOT NULL AND NEW.teacher_comment <> ''
           THEN 'Комментарий: ' || NEW.teacher_comment ELSE 'Этап проверен' END,
      '/grades',
      NEW.id
    );
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_stage_grade_notify ON public.lesson_stage_progress;
CREATE TRIGGER trg_stage_grade_notify
  AFTER UPDATE ON public.lesson_stage_progress
  FOR EACH ROW EXECUTE FUNCTION public.fn_stage_grade_notify();

-- 6. Fix announcement trigger — for teachers, only notify if created_by is an admin
CREATE OR REPLACE FUNCTION public.fn_announce_notify() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  is_admin_author boolean;
BEGIN
  -- Check if announcement creator is an admin
  SELECT EXISTS(SELECT 1 FROM public.admins WHERE id = NEW.created_by) INTO is_admin_author;

  IF NEW.scope = 'group' THEN
    -- Notify students in the group
    INSERT INTO public.notifications (recipient_user_id, kind, title, body, link, source_id)
    SELECT s.user_id, 'announcement', NEW.title, left(NEW.body, 100), '/announcements', NEW.id
    FROM public.student_groups sg JOIN public.students s ON s.id = sg.student_id
    WHERE sg.group_id = NEW.group_id AND s.user_id IS NOT NULL;
    -- Notify teachers of the group (only if admin-created)
    IF is_admin_author THEN
      INSERT INTO public.notifications (recipient_user_id, kind, title, body, link, source_id)
      SELECT t.user_id, 'announcement_new', NEW.title, left(NEW.body, 100), '/teacher/announcements', NEW.id
      FROM public.groups g JOIN public.teachers t ON t.id = g.teacher_id
      WHERE g.id = NEW.group_id AND t.user_id IS NOT NULL;
    END IF;

  ELSIF NEW.scope = 'all_my_groups' THEN
    -- Notify all students in teacher's groups
    INSERT INTO public.notifications (recipient_user_id, kind, title, body, link, source_id)
    SELECT DISTINCT s.user_id, 'announcement', NEW.title, left(NEW.body, 100), '/announcements', NEW.id
    FROM public.groups g
    JOIN public.student_groups sg ON sg.group_id = g.id
    JOIN public.students s ON s.id = sg.student_id
    WHERE g.teacher_id = NEW.created_by AND s.user_id IS NOT NULL;
    -- Notify teacher only if admin-created
    IF is_admin_author THEN
      INSERT INTO public.notifications (recipient_user_id, kind, title, body, link, source_id)
      SELECT t.user_id, 'announcement_new', NEW.title, left(NEW.body, 100), '/teacher/announcements', NEW.id
      FROM public.teachers t WHERE t.user_id IS NOT NULL;
    END IF;

  ELSIF NEW.scope = 'student' THEN
    -- Notify specific student
    INSERT INTO public.notifications (recipient_user_id, kind, title, body, link, source_id)
    SELECT s.user_id, 'announcement', NEW.title, left(NEW.body, 100), '/announcements', NEW.id
    FROM public.students s WHERE s.id = NEW.target_student_id AND s.user_id IS NOT NULL;
  END IF;
  RETURN NEW;
END $$;

-- Drop and recreate the trigger
DROP TRIGGER IF EXISTS trg_announce_notify ON public.announcements;
CREATE TRIGGER trg_announce_notify
  AFTER INSERT ON public.announcements
  FOR EACH ROW EXECUTE FUNCTION public.fn_announce_notify();

-- 7. Clean up stale teacher notifications (types only students should receive)
DELETE FROM public.notifications n
WHERE EXISTS (
    SELECT 1 FROM public.teachers t WHERE t.user_id = n.recipient_user_id
  )
  AND n.kind NOT IN (
    'student_submitted', 'student_excused',
    'leave_request', 'leave_decision', 'lesson_starting_soon', 'announcement_new'
  );
