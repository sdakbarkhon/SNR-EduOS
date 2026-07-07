-- Migration 83: notify triggers reach parents + sync identity_data.email with auth.users.email
--
-- Part A: every notification kind that currently reaches only the student
-- (grades, homework, lesson materials, new lessons, leave decisions,
-- announcements) is extended to also insert a row for every linked parent
-- via parent_students. Teacher-facing notify functions (fn_excuse_notify,
-- fn_leave_request_notify, fn_homework_submission_notify) are untouched —
-- parents don't need copies of "student asked to leave" / "student submitted"
-- notices sent to the teacher. Chat notify triggers (tg_add_parent_to_group_thread,
-- tg_group_created, tg_group_curator_changed) are untouched per explicit scope.
--
-- Shared helper: notify_user_and_parents() inserts one row for the student and
-- one row per linked parent (parent_students), reusing notifications' existing
-- school_id DEFAULT current_school_id() — safe because the DEFAULT resolves off
-- the acting user (teacher/admin), who is always in the same school as the
-- target student/parent.
--
-- Part B: 3 legacy accounts (aziz_03, nodira_07, sherzod_10) have
-- auth.identities.identity_data->>'email' still set to the old
-- <username>@snr.local synthetic domain while auth.users.email was already
-- migrated to <username>@students.snr.local. Login is unaffected (auth
-- resolves by auth.users.email), but this is noise on every audit. One UPDATE
-- brings identity_data.email back in sync.

-- ============================================================
-- Part A — notify_user_and_parents() helper
-- ============================================================

CREATE OR REPLACE FUNCTION public.notify_user_and_parents(
  p_student_id uuid,
  p_type text,
  p_title text,
  p_body text,
  p_link text,
  p_source_id uuid
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  -- Student
  INSERT INTO public.notifications (recipient_user_id, kind, title, body, link, source_id)
  SELECT s.user_id, p_type, p_title, p_body, p_link, p_source_id
  FROM public.students s
  WHERE s.id = p_student_id AND s.user_id IS NOT NULL;

  -- Parents linked to this student
  INSERT INTO public.notifications (recipient_user_id, kind, title, body, link, source_id)
  SELECT p.user_id, p_type, p_title, p_body, p_link, p_source_id
  FROM public.parents p
  JOIN public.parent_students ps ON ps.parent_id = p.id
  WHERE ps.student_id = p_student_id AND p.user_id IS NOT NULL;
END;
$function$;

-- ============================================================
-- fn_notify_student_grade — shared by classwork/homework/project/test grade
-- triggers (fn_classwork_grade_notify, fn_homework_grade_notify,
-- fn_project_grade_notify, fn_test_grade_notify all PERFORM this unchanged) —
-- fixing it here fixes all 4 callers transitively.
-- ============================================================

CREATE OR REPLACE FUNCTION public.fn_notify_student_grade(p_student_id uuid, p_grade integer, p_what text, p_source uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  PERFORM public.notify_user_and_parents(
    p_student_id, 'new_grade', 'Новая оценка',
    'Оценка ' || p_grade || ' за ' || coalesce(p_what,''), '/grades', p_source
  );
END;
$function$;

-- ============================================================
-- fn_lesson_grade_notify
-- ============================================================

CREATE OR REPLACE FUNCTION public.fn_lesson_grade_notify()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  l_title text;
BEGIN
  SELECT coalesce(title, topic, 'урок') INTO l_title FROM public.lessons WHERE id = NEW.lesson_id;
  PERFORM public.notify_user_and_parents(
    NEW.student_id, 'grade_received',
    'Новая оценка: ' || NEW.grade::text || '/5',
    'Урок: ' || coalesce(l_title, '') ||
      CASE WHEN NEW.comment IS NOT NULL AND NEW.comment <> '' THEN ', Комментарий: ' || NEW.comment ELSE '' END,
    '/grades',
    NEW.id
  );
  RETURN NEW;
END;
$function$;

-- ============================================================
-- fn_stage_grade_notify
-- ============================================================

CREATE OR REPLACE FUNCTION public.fn_stage_grade_notify()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  -- Only fire when graded_at transitions from NULL to a value
  IF OLD.graded_at IS NOT NULL OR NEW.graded_at IS NULL THEN
    RETURN NEW;
  END IF;
  IF NEW.grade IS NULL THEN
    RETURN NEW;
  END IF;
  PERFORM public.notify_user_and_parents(
    NEW.student_id, 'grade_received',
    'Оценка за этап: ' || NEW.grade::text || '/5',
    CASE WHEN NEW.teacher_comment IS NOT NULL AND NEW.teacher_comment <> ''
         THEN 'Комментарий: ' || NEW.teacher_comment ELSE 'Этап проверен' END,
    '/grades',
    NEW.id
  );
  RETURN NEW;
END;
$function$;

-- ============================================================
-- fn_leave_decision_notify
-- ============================================================

CREATE OR REPLACE FUNCTION public.fn_leave_decision_notify()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  ltitle text;
BEGIN
  IF OLD.status = 'pending' AND NEW.status IN ('approved', 'rejected') THEN
    SELECT coalesce(title, topic, 'урок') INTO ltitle FROM public.lessons WHERE id = NEW.lesson_id;
    PERFORM public.notify_user_and_parents(
      NEW.student_id,
      'leave_decision',
      CASE WHEN NEW.status = 'approved' THEN 'Запрос одобрен' ELSE 'Запрос отклонён' END,
      'Урок: ' || coalesce(ltitle, ''),
      '/schedule',
      NEW.id
    );
  END IF;
  RETURN NEW;
END;
$function$;

-- ============================================================
-- fn_homework_notify — bulk (whole group), loop per student
-- ============================================================

CREATE OR REPLACE FUNCTION public.fn_homework_notify()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE r record;
BEGIN
  FOR r IN
    SELECT sg.student_id
    FROM public.student_groups sg
    WHERE sg.group_id = NEW.group_id
  LOOP
    PERFORM public.notify_user_and_parents(
      r.student_id, 'new_homework', 'Новое задание: ' || NEW.title, NEW.description, '/homework/' || NEW.id, NEW.id
    );
  END LOOP;
  RETURN NEW;
END;
$function$;

-- ============================================================
-- fn_lesson_created_notify — bulk (whole group), loop per student
-- ============================================================

CREATE OR REPLACE FUNCTION public.fn_lesson_created_notify()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  lesson_date text;
  lesson_time text;
  r record;
BEGIN
  lesson_date := to_char((NEW.starts_at AT TIME ZONE 'Asia/Tashkent'), 'DD.MM.YYYY');
  lesson_time := to_char((NEW.starts_at AT TIME ZONE 'Asia/Tashkent'), 'HH24:MI');

  FOR r IN
    SELECT sg.student_id
    FROM public.student_groups sg
    WHERE sg.group_id = NEW.group_id
  LOOP
    PERFORM public.notify_user_and_parents(
      r.student_id, 'lesson_created',
      'Новый урок: ' || coalesce(NEW.title, NEW.topic, 'Урок'),
      'Дата: ' || lesson_date || ', Время: ' || lesson_time,
      '/lessons/' || NEW.id,
      NEW.id
    );
  END LOOP;
  RETURN NEW;
END;
$function$;

-- ============================================================
-- fn_lesson_material_notify — bulk (whole group), loop per student
-- ============================================================

CREATE OR REPLACE FUNCTION public.fn_lesson_material_notify()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE gid uuid; r record;
BEGIN
  SELECT group_id INTO gid FROM public.lessons WHERE id = NEW.lesson_id;
  FOR r IN
    SELECT sg.student_id
    FROM public.student_groups sg
    WHERE sg.group_id = gid
  LOOP
    PERFORM public.notify_user_and_parents(
      r.student_id, 'lesson_material', 'Новый материал', NEW.title, '/lessons/' || NEW.lesson_id, NEW.id
    );
  END LOOP;
  RETURN NEW;
END;
$function$;

-- ============================================================
-- fn_announce_notify — 3 scope branches, student-facing branches loop per
-- student; teacher-facing branches (is_admin_author) untouched.
-- ============================================================

CREATE OR REPLACE FUNCTION public.fn_announce_notify()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  is_admin_author boolean;
  r record;
BEGIN
  SELECT EXISTS(SELECT 1 FROM public.admins WHERE id = NEW.created_by) INTO is_admin_author;

  IF NEW.scope = 'group' THEN
    FOR r IN
      SELECT sg.student_id
      FROM public.student_groups sg
      WHERE sg.group_id = NEW.group_id
    LOOP
      PERFORM public.notify_user_and_parents(
        r.student_id, 'announcement', NEW.title, left(NEW.body, 100), '/announcements', NEW.id
      );
    END LOOP;

    IF is_admin_author THEN
      INSERT INTO public.notifications (recipient_user_id, kind, title, body, link, source_id)
      SELECT t.user_id, 'announcement_new', NEW.title, left(NEW.body, 100), '/teacher/announcements', NEW.id
      FROM public.groups g JOIN public.teachers t ON t.id = g.teacher_id
      WHERE g.id = NEW.group_id AND t.user_id IS NOT NULL;
    END IF;

  ELSIF NEW.scope = 'all_my_groups' THEN
    FOR r IN
      SELECT DISTINCT sg.student_id
      FROM public.groups g
      JOIN public.student_groups sg ON sg.group_id = g.id
      WHERE g.teacher_id = NEW.created_by
    LOOP
      PERFORM public.notify_user_and_parents(
        r.student_id, 'announcement', NEW.title, left(NEW.body, 100), '/announcements', NEW.id
      );
    END LOOP;

    IF is_admin_author THEN
      INSERT INTO public.notifications (recipient_user_id, kind, title, body, link, source_id)
      SELECT t.user_id, 'announcement_new', NEW.title, left(NEW.body, 100), '/teacher/announcements', NEW.id
      FROM public.teachers t WHERE t.user_id IS NOT NULL;
    END IF;

  ELSIF NEW.scope = 'student' THEN
    PERFORM public.notify_user_and_parents(
      NEW.target_student_id, 'announcement', NEW.title, left(NEW.body, 100), '/announcements', NEW.id
    );
  END IF;
  RETURN NEW;
END;
$function$;

-- ============================================================
-- Part B — sync identity_data.email with auth.users.email
-- ============================================================

UPDATE auth.identities i
SET identity_data = i.identity_data || jsonb_build_object('email', u.email)
FROM auth.users u
WHERE i.user_id = u.id
  AND (i.identity_data->>'email') != u.email;
