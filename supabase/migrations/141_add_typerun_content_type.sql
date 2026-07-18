-- =====================================================================
-- Migration 141 — Пачка 6.1: TypeRun (тренажёр печати) как 13-й
-- external-service content_type для lesson_stages.
-- Применить вручную через Supabase Dashboard SQL Editor.
--
-- Источник истины для текущего списка — миграция 94 (последняя, что
-- трогала lesson_stages_content_type_check; проверено grep по всем
-- supabase/migrations/*.sql — после 94 констрейнт больше нигде не
-- менялся). Live-схема (PostgREST OpenAPI) констрейнт как enum не
-- отдаёт, поэтому список значений восстановлен из 94, не из БД
-- напрямую.
--
-- MonkeyType (изначальный кандидат из промта) НЕ добавлен — отдаёт
-- X-Frame-Options: DENY + CSP frame-ancestors 'none' (проверено curl -I
-- в этой же сессии), iframe физически не встраивается. Заменён на
-- typerun.top — тот же проверкой подтверждено отсутствие блокирующих
-- заголовков.
--
-- Область: ТОЛЬКО lesson_stages (как просили — "этап урока"). homework.
-- content_type / homework_subtask_submissions используют отдельный
-- констрейнт (homework_content_type_check, миграция 95) с тем же
-- набором внешних сервисов — он НЕ тронут, 'typerun' там пока
-- недоступен. TS-тип ExternalServiceType общий для обеих таблиц
-- (использовался и раньше без 1:1 соответствия БД), так что это не
-- новая проблема, но стоит знать: SERVICE_CONFIG.typerun технически
-- "виден" и в homework-related коде, а в БД — только для lesson_stages
-- до отдельной миграции, если/когда понадобится.

BEGIN;

ALTER TABLE public.lesson_stages
  DROP CONSTRAINT lesson_stages_content_type_check;

ALTER TABLE public.lesson_stages
  ADD CONSTRAINT lesson_stages_content_type_check
  CHECK (content_type = ANY (ARRAY[
    'presentation'::text, 'code'::text, 'wokwi'::text, 'codesandbox'::text,
    'quiz_qia'::text, 'quiz_kahoot'::text,
    'geogebra'::text, 'phet'::text, 'desmos'::text, 'blockly_games'::text, 'visualgo'::text,
    'p5js'::text, 'excalidraw'::text, 'learningapps'::text, 'sqlonline'::text,
    'h5p'::text, 'typerun'::text
  ]));

COMMIT;

-- Проверить после применения:
--   UPDATE lesson_stages SET content_type = 'typerun' WHERE id = '<тестовый stage id>';
--   -- ожидание: успех, без ошибки constraint violation
