-- Migration 51: replace Tinkercad / App Inventor / Code Monkey
--              with Wokwi / CodeSandbox / MakeCode Arcade

-- 1. Remove stage progress for old services (FK cascade doesn't help here
--    because we're removing by content_type, not stage id).
DELETE FROM public.lesson_stage_progress
WHERE stage_id IN (
  SELECT id FROM public.lesson_stages
  WHERE content_type IN ('tinkercad', 'app_inventor', 'code_monkey')
);

-- 2. Remove the old stages themselves.
DELETE FROM public.lesson_stages
WHERE content_type IN ('tinkercad', 'app_inventor', 'code_monkey');

-- 3. Drop + recreate the CHECK constraint on lesson_stages.content_type.
ALTER TABLE public.lesson_stages
  DROP CONSTRAINT IF EXISTS lesson_stages_content_type_check;

ALTER TABLE public.lesson_stages
  ADD CONSTRAINT lesson_stages_content_type_check CHECK (content_type IN (
    'presentation', 'code', 'scratch',
    'wokwi', 'codesandbox', 'makecode',
    'quiz_qia', 'quiz_kahoot'
  ));
