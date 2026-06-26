-- Migration 54: active_stage_id — teacher controls current stage, students follow

-- 1. Column
ALTER TABLE public.lessons
  ADD COLUMN IF NOT EXISTS active_stage_id uuid
    REFERENCES public.lesson_stages(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_lessons_active_stage ON public.lessons(active_stage_id);

-- 2. Trigger: auto-activate first middle stage when lesson starts
CREATE OR REPLACE FUNCTION public.fn_auto_activate_first_stage()
RETURNS trigger AS $$
DECLARE
  v_stage_id uuid;
BEGIN
  IF NEW.status = 'in_progress' AND OLD.status <> 'in_progress' THEN
    SELECT id INTO v_stage_id
    FROM public.lesson_stages
    WHERE lesson_id = NEW.id
      AND stage_role = 'middle'
    ORDER BY position
    LIMIT 1;
    NEW.active_stage_id := v_stage_id;  -- NULL when no middle stages → fine
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_auto_activate_first_stage ON public.lessons;
CREATE TRIGGER trg_auto_activate_first_stage
  BEFORE UPDATE ON public.lessons
  FOR EACH ROW
  EXECUTE FUNCTION public.fn_auto_activate_first_stage();

-- 3. REPLICA IDENTITY FULL so realtime sends old + new on UPDATE
--    (needed to diff active_stage_id changes on client)
ALTER TABLE public.lessons REPLICA IDENTITY FULL;

-- 4. GRANTs: teachers need UPDATE on active_stage_id
--    (existing UPDATE policy on lessons covers this — just ensure column is grantable)
GRANT UPDATE (active_stage_id) ON public.lessons TO authenticated;
