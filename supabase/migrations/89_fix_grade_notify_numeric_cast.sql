-- Fix fn_homework_grade_notify(): NEW.grade is numeric (homework_submissions.grade),
-- but fn_notify_student_grade() expects integer. Postgres does not implicitly cast
-- numeric -> integer in plain function-call argument position (only in assignment
-- context), so every homework grading action was failing with:
--   42883 function public.fn_notify_student_grade(uuid, numeric, text, uuid) does not exist
-- Fix: explicit ::integer cast at the call site. No schema/type changes needed.

CREATE OR REPLACE FUNCTION public.fn_homework_grade_notify()
 RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE w text;
BEGIN
  IF OLD.grade IS NOT NULL OR NEW.grade IS NULL THEN RETURN NEW; END IF;
  SELECT title INTO w FROM public.homework WHERE id = NEW.homework_id;
  PERFORM public.fn_notify_student_grade(NEW.student_id, NEW.grade::integer, w, NEW.id);
  RETURN NEW;
END $function$;
