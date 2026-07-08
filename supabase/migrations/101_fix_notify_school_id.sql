-- =====================================================================
-- Migration 101 — fix two trigger functions relying on
-- <table>.school_id DEFAULT current_school_id(), which resolves via
-- auth.uid() and is NULL in ANY context without an authenticated session
-- (Management API raw SQL, and — more importantly — any future service-role
-- server action that inserts lessons/homework without a user JWT). Found
-- while bulk-inserting БОЛЬШОЕ ОБНОВЛЕНИЕ Этап 5's schedule (600 lesson
-- rows, each firing both triggers below via AFTER INSERT ON lessons).
--
-- Fix: derive school_id explicitly from data already in scope (the
-- recipient's own row / the lesson row that fired the trigger) instead of
-- the session-dependent default — correct in every context, not just a
-- workaround for this migration.
-- =====================================================================

CREATE OR REPLACE FUNCTION public.notify_user_and_parents(p_student_id uuid, p_type text, p_title text, p_body text, p_link text, p_source_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  -- Student
  INSERT INTO public.notifications (recipient_user_id, kind, title, body, link, source_id, school_id)
  SELECT s.user_id, p_type, p_title, p_body, p_link, p_source_id, s.school_id
  FROM public.students s
  WHERE s.id = p_student_id AND s.user_id IS NOT NULL;

  -- Parents linked to this student
  INSERT INTO public.notifications (recipient_user_id, kind, title, body, link, source_id, school_id)
  SELECT p.user_id, p_type, p_title, p_body, p_link, p_source_id, p.school_id
  FROM public.parents p
  JOIN public.parent_students ps ON ps.parent_id = p.id
  WHERE ps.student_id = p_student_id AND p.user_id IS NOT NULL;
END;
$function$;

CREATE OR REPLACE FUNCTION public.fn_create_default_stages()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  -- Старт (position 0)
  INSERT INTO public.lesson_stages (lesson_id, position, stage_role, title, school_id)
  VALUES (NEW.id, 0, 'start', 'Старт', NEW.school_id);
  -- Итог (position 9999 — всегда последний)
  INSERT INTO public.lesson_stages (lesson_id, position, stage_role, title, school_id)
  VALUES (NEW.id, 9999, 'summary', 'Итог', NEW.school_id);
  RETURN NEW;
END;
$function$;
