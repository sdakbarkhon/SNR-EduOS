-- ============================================================
-- Migration 36: auto-schedule + material visibility
-- ============================================================

-- 1. Trigger: auto-compute ends_at = starts_at + duration_minutes
-- ============================================================
CREATE OR REPLACE FUNCTION public.fn_compute_lesson_end()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.starts_at IS NOT NULL AND NEW.duration_minutes IS NOT NULL THEN
    NEW.ends_at := NEW.starts_at + (NEW.duration_minutes * interval '1 minute');
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_compute_lesson_end ON public.lessons;
CREATE TRIGGER trg_compute_lesson_end
  BEFORE INSERT OR UPDATE OF starts_at, duration_minutes
  ON public.lessons
  FOR EACH ROW EXECUTE PROCEDURE public.fn_compute_lesson_end();

-- 2. Trigger: reject past starts_at for authenticated users
-- ============================================================
CREATE OR REPLACE FUNCTION public.fn_validate_lesson_start()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  -- On UPDATE, skip if starts_at is unchanged
  IF TG_OP = 'UPDATE' AND NEW.starts_at IS NOT DISTINCT FROM OLD.starts_at THEN
    RETURN NEW;
  END IF;
  IF NEW.starts_at < now() - interval '1 minute' THEN
    RAISE EXCEPTION 'Нельзя создать урок в прошедшее время' USING ERRCODE = 'P0001';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_validate_lesson_start ON public.lessons;
CREATE TRIGGER trg_validate_lesson_start
  BEFORE INSERT OR UPDATE OF starts_at
  ON public.lessons
  FOR EACH ROW
  WHEN (current_user = 'authenticated')
  EXECUTE PROCEDURE public.fn_validate_lesson_start();

-- 3. Add visibility column to lesson_materials
-- ============================================================
ALTER TABLE public.lesson_materials
  ADD COLUMN IF NOT EXISTS visibility text
    NOT NULL DEFAULT 'all'
    CHECK (visibility IN ('all', 'teacher_only'));

-- 4. pg_cron: auto-start lessons
-- ============================================================
CREATE OR REPLACE FUNCTION public.fn_auto_start_lessons()
RETURNS void LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public AS $$
BEGIN
  -- scheduled → in_progress when starts_at is within last 5 minutes
  UPDATE public.lessons
  SET status = 'in_progress', started_at = now()
  WHERE status = 'scheduled'
    AND starts_at <= now()
    AND starts_at > now() - interval '5 minutes';

  -- Auto-complete Start stage for newly started lessons
  UPDATE public.lesson_stages ls
  SET is_completed = true, completed_at = now()
  FROM public.lessons l
  WHERE ls.lesson_id = l.id
    AND l.status = 'in_progress'
    AND l.started_at >= now() - interval '2 minutes'
    AND ls.stage_role = 'start'
    AND NOT ls.is_completed;
END;
$$;

-- 5. pg_cron: auto-end lessons
-- ============================================================
CREATE OR REPLACE FUNCTION public.fn_auto_end_lessons()
RETURNS void LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public AS $$
DECLARE
  r record;
BEGIN
  FOR r IN
    SELECT id, group_id FROM public.lessons
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
    INSERT INTO public.attendance (lesson_id, student_id, status, marked_at, is_finalized)
    SELECT r.id, sg.student_id, 'absent_unexcused', now(), true
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
$$;

-- 6. Schedule cron jobs (idempotent)
-- ============================================================
DO $$ BEGIN
  PERFORM cron.unschedule('auto-start-lessons');
EXCEPTION WHEN others THEN NULL;
END $$;
SELECT cron.schedule('auto-start-lessons', '* * * * *', $$SELECT public.fn_auto_start_lessons()$$);

DO $$ BEGIN
  PERFORM cron.unschedule('auto-end-lessons');
EXCEPTION WHEN others THEN NULL;
END $$;
SELECT cron.schedule('auto-end-lessons', '* * * * *', $$SELECT public.fn_auto_end_lessons()$$);
