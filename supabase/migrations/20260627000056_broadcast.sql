-- Iteration 3 · Prompt 5/5 · Part 2 — "Показать классу" (demo material broadcast)
-- Teacher in an active lesson picks a material → it appears on every student who
-- is on that lesson page, synchronised via Supabase Realtime on `lessons`.

-- Currently demonstrated material for the lesson (NULL = nothing shown).
ALTER TABLE public.lessons
  ADD COLUMN IF NOT EXISTS demo_material_id uuid
  REFERENCES public.lesson_materials(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_lessons_demo_material
  ON public.lessons(demo_material_id);

-- `lessons` already has REPLICA IDENTITY FULL (migration 37) and is part of the
-- supabase_realtime publication (used for active_stage_id), so demo_material_id
-- updates are delivered to subscribed students automatically.

-- Column-level grant so a teacher can toggle the demonstrated material.
GRANT UPDATE (demo_material_id) ON public.lessons TO authenticated;

-- Auto-clear the demo when the lesson is completed (pg_cron flips the status).
CREATE OR REPLACE FUNCTION public.fn_clear_demo_on_complete()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.status = 'completed' AND OLD.status IS DISTINCT FROM 'completed' THEN
    NEW.demo_material_id := NULL;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_clear_demo_on_complete ON public.lessons;
CREATE TRIGGER trg_clear_demo_on_complete
  BEFORE UPDATE ON public.lessons
  FOR EACH ROW
  EXECUTE FUNCTION public.fn_clear_demo_on_complete();
