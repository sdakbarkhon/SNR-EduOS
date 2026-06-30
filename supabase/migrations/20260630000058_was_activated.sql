-- Migration 58: track which lesson stages were actually activated during the lesson.
-- Adds was_activated column + trigger on lessons.active_stage_id change.

ALTER TABLE public.lesson_stages
  ADD COLUMN IF NOT EXISTS was_activated boolean NOT NULL DEFAULT false;

CREATE OR REPLACE FUNCTION public.fn_mark_stage_activated()
RETURNS trigger AS $$
BEGIN
  IF NEW.active_stage_id IS NOT NULL
     AND NEW.active_stage_id IS DISTINCT FROM OLD.active_stage_id THEN
    UPDATE public.lesson_stages
    SET was_activated = true
    WHERE id = NEW.active_stage_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_mark_stage_activated ON public.lessons;
CREATE TRIGGER trg_mark_stage_activated
  AFTER UPDATE OF active_stage_id ON public.lessons
  FOR EACH ROW
  EXECUTE FUNCTION public.fn_mark_stage_activated();
