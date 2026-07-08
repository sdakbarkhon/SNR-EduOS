-- Migration 95 (УЧ.10 Part 3+4+6)
--
-- 1) homework.content_type: convert from a Postgres ENUM (public.content_type,
--    created in 20260616000017, extended via ALTER TYPE ADD VALUE for
--    'programming'/'bundle') to TEXT + CHECK, expanded to 16 values: the
--    existing file/test/programming/bundle plus the 12 SERVICE_CONFIG external
--    services (wokwi/codesandbox/geogebra/phet/desmos/blockly_games/visualgo/
--    p5js/excalidraw/learningapps/sqlonline/h5p). Mirrors the same conversion
--    already done for lesson_stages.content_type in migration 90 — TEXT+CHECK
--    can grow via a plain constraint rewrite, no ALTER-TYPE-outside-txn limit.
--    All 4 existing values (file/test/programming/bundle, verified via hosted
--    query: file=10, test=1, programming=3, bundle=2) fall inside the new set,
--    so no data rewrite is needed before the type conversion.
ALTER TABLE public.homework ALTER COLUMN content_type DROP DEFAULT;
ALTER TABLE public.homework ALTER COLUMN content_type TYPE text USING content_type::text;
ALTER TABLE public.homework ALTER COLUMN content_type SET DEFAULT 'file';

ALTER TABLE public.homework ADD CONSTRAINT homework_content_type_check
  CHECK (content_type = ANY (ARRAY[
    'file'::text, 'test'::text, 'programming'::text, 'bundle'::text,
    'wokwi'::text, 'codesandbox'::text, 'geogebra'::text, 'phet'::text, 'desmos'::text,
    'blockly_games'::text, 'visualgo'::text, 'p5js'::text, 'excalidraw'::text,
    'learningapps'::text, 'sqlonline'::text, 'h5p'::text
  ]));

DROP TYPE public.content_type;

-- 2) homework.external_url: teacher-supplied project link for the 12 external-
--    service homework types (mirrors lesson_stages.config->>'url' — homework
--    has no jsonb config column, so a dedicated column is simpler here).
ALTER TABLE public.homework ADD COLUMN IF NOT EXISTS external_url text;

-- 3) homework.programming_language: widen from python/cpp to python/javascript/
--    cpp/java (УЧ.10 Part 6 — Piston-backed "Запустить" button, 4 languages).
--    Existing rows are all python (verified: python=4, null=12) so no rewrite.
ALTER TABLE public.homework DROP CONSTRAINT IF EXISTS homework_programming_language_check;
ALTER TABLE public.homework ADD CONSTRAINT homework_programming_language_check
  CHECK (programming_language IS NULL OR programming_language = ANY (ARRAY[
    'python'::text, 'javascript'::text, 'cpp'::text, 'java'::text
  ]));

-- 4) homework_subtasks.type (already TEXT+CHECK since migration 87 — only the
--    constraint needs rewriting): drop 'scratch' (УЧ.10 Part 3 — remove Scratch
--    from the homework/bundle UI entirely), add the 12 external services so
--    bundle subtasks can use them too (Part 4). 2 existing rows have
--    type='scratch' (verified via hosted query) — one has a completed
--    submission referencing it. Converting (not deleting) preserves that
--    submission's history instead of cascading a delete through
--    homework_subtask_submissions; 'file' is a safe neutral type since its
--    student-facing editor only reads content.text and renders nothing when
--    absent.
UPDATE public.homework_subtasks
SET
  type = 'file',
  description = trim(both from (coalesce(description, '') || E'\n\n[Подзадача отключена: тип Scratch удалён из платформы. Содержимое сохранено для истории.]'))
WHERE type = 'scratch';

ALTER TABLE public.homework_subtasks DROP CONSTRAINT homework_subtasks_type_check;
ALTER TABLE public.homework_subtasks ADD CONSTRAINT homework_subtasks_type_check
  CHECK (type = ANY (ARRAY[
    'file'::text, 'test'::text, 'code'::text,
    'wokwi'::text, 'codesandbox'::text, 'geogebra'::text, 'phet'::text, 'desmos'::text,
    'blockly_games'::text, 'visualgo'::text, 'p5js'::text, 'excalidraw'::text,
    'learningapps'::text, 'sqlonline'::text, 'h5p'::text
  ]));
