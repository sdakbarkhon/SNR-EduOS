-- УЧ.8: remove Scratch/TurboWarp lesson-stage service, add 9 new iframe-safe services.
--
-- Investigation findings (see final report):
-- - lesson_stages.content_type is TEXT + CHECK, NOT a Postgres ENUM (unlike
--   homework.content_type, which IS an enum with values file/test/programming/
--   bundle and never contained 'scratch' at all). So no ENUM recreation is
--   needed here -- only a CHECK constraint rewrite.
-- - 14 existing rows have content_type='scratch'. Per the spec's own decision
--   rule ("if a handful, delete; if many, convert to presentation + note"),
--   14 is treated as "many" -- converting preserves FK-referencing rows
--   (lesson_stage_progress, attachments, live-code state, etc. all key off
--   stage id) instead of risking orphaned data via DELETE.

UPDATE public.lesson_stages
SET
  content_type = 'presentation',
  description = trim(both from (coalesce(description, '') || E'\n\n[Этап отключён: сервис Scratch удалён из платформы. Содержимое сохранено для истории.]'))
WHERE content_type = 'scratch';

ALTER TABLE public.lesson_stages DROP CONSTRAINT lesson_stages_content_type_check;

ALTER TABLE public.lesson_stages ADD CONSTRAINT lesson_stages_content_type_check
  CHECK (content_type = ANY (ARRAY[
    'presentation'::text, 'code'::text, 'wokwi'::text, 'codesandbox'::text, 'makecode'::text,
    'quiz_qia'::text, 'quiz_kahoot'::text,
    'geogebra'::text, 'phet'::text, 'desmos'::text, 'blockly_games'::text, 'visualgo'::text,
    'p5js'::text, 'excalidraw'::text, 'learningapps'::text, 'sqlonline'::text
  ]));
