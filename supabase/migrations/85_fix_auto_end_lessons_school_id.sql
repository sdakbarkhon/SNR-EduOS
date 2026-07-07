-- Migration 85
-- Fix fn_auto_end_lessons(): its attendance backfill INSERT never set
-- school_id, which migration 71 made NOT NULL on public.attendance. Every
-- cron tick since then has thrown "null value in column school_id" and
-- rolled back the ENTIRE function body for that lesson — including the
-- status flip to 'completed' — which is why lessons were observed stuck
-- on "in_progress" indefinitely (confirmed via cron.job_run_details: every
-- run of jobid=2 "auto-end-lessons" has been failing on this same error).

CREATE OR REPLACE FUNCTION public.fn_auto_end_lessons()
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  r record;
BEGIN
  FOR r IN
    SELECT id, group_id, school_id FROM public.lessons
    WHERE status = 'in_progress'
      AND ends_at IS NOT NULL
      AND ends_at <= now()
  LOOP
    UPDATE public.lessons
    SET status = 'completed', ended_at = now()
    WHERE id = r.id;

    -- Auto-complete Summary stage
    UPDATE public.lesson_stages
    SET is_completed = true, completed_at = now()
    WHERE lesson_id = r.id
      AND stage_role = 'summary'
      AND NOT is_completed;

    -- Auto-finalize attendance: absent_unexcused for missing records
    INSERT INTO public.attendance (lesson_id, student_id, school_id, status, marked_at, is_finalized)
    SELECT r.id, sg.student_id, r.school_id, 'absent_unexcused', now(), true
    FROM public.student_groups sg
    WHERE sg.group_id = r.group_id
      AND NOT EXISTS (
        SELECT 1 FROM public.attendance a
        WHERE a.lesson_id = r.id AND a.student_id = sg.student_id
      );

    UPDATE public.attendance
    SET is_finalized = true
    WHERE lesson_id = r.id AND NOT is_finalized;
  END LOOP;
END;
$function$;

-- Process currently-stuck lessons immediately rather than waiting for the
-- next cron tick (up to 60s) — fixes the rows already found overdue.
SELECT public.fn_auto_end_lessons();
