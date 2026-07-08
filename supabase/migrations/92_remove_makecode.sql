-- УЧ.9 часть 1: полное удаление MakeCode из сервисов этапов уроков.
--
-- Решения (см. отчёт):
-- - 5 существующих строк content_type='makecode' -> по правилу спеки
--   ("DELETE если 5 или меньше") УДАЛЯЮТСЯ. Проверено перед применением:
--   все FK на lesson_stages каскадные (lesson_stage_progress, quiz_questions,
--   quiz_attempts, kahoot_sessions) или SET NULL (ai_chat_messages,
--   lessons.active_stage_id), progress-строк по этим этапам 0.
-- - lesson_stages.content_type -- это TEXT + CHECK, НЕ Postgres ENUM
--   (в отличие от homework.content_type). Пересоздание ENUM не требуется,
--   только перезапись CHECK-констрейнта.

DELETE FROM public.lesson_stages WHERE content_type = 'makecode';

ALTER TABLE public.lesson_stages DROP CONSTRAINT lesson_stages_content_type_check;

ALTER TABLE public.lesson_stages ADD CONSTRAINT lesson_stages_content_type_check
  CHECK (content_type = ANY (ARRAY[
    'presentation'::text, 'code'::text, 'wokwi'::text, 'codesandbox'::text,
    'quiz_qia'::text, 'quiz_kahoot'::text,
    'geogebra'::text, 'phet'::text, 'desmos'::text, 'blockly_games'::text, 'visualgo'::text,
    'p5js'::text, 'excalidraw'::text, 'learningapps'::text, 'sqlonline'::text
  ]));
