-- Migration 61: synchronous slide control (teacher drives, students follow)

ALTER TABLE public.lesson_stages
  ADD COLUMN IF NOT EXISTS current_slide_index integer NOT NULL DEFAULT 0;

COMMENT ON COLUMN public.lesson_stages.current_slide_index IS
  'Текущий отображаемый слайд презентации — управляет учитель во время урока, ученики следуют через Realtime';

-- No new GRANT/RLS needed: lesson_stages already has GRANT UPDATE for authenticated
-- (migration 35) and the "teacher manages own lesson stages" policy already
-- restricts writes to the owning teacher — students can only SELECT.
