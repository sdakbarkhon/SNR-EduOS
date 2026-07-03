BEGIN;

-- Iter5 P16: full rename of lesson_stages.content_type 'scratch' -> 'turbowarp'
-- at the DATA level (Prompt 14 / migration 68 only renamed one demo lesson's
-- TITLE; this migration renames the actual content_type value on every row).
-- content_type is `text` + a CHECK constraint (not an enum), so this is a
-- straight UPDATE + constraint swap rather than an ALTER TYPE ... RENAME VALUE.
--
-- Ordering note: a plain UPDATE-then-swap-constraint sequence deadlocks itself
-- -- the OLD constraint doesn't allow 'turbowarp' yet, so the UPDATE fails
-- first; and a constraint that already excludes 'scratch' can't be ADDed while
-- rows still hold 'scratch' (ADD CONSTRAINT validates all existing rows
-- immediately, CHECK constraints are not deferrable in Postgres). So we swap
-- to an INTERIM constraint that allows both values, migrate the data, then
-- swap again to the FINAL constraint that only allows 'turbowarp'.

-- Step 1: interim constraint permitting both 'scratch' and 'turbowarp'
ALTER TABLE public.lesson_stages
  DROP CONSTRAINT lesson_stages_content_type_check;

ALTER TABLE public.lesson_stages
  ADD CONSTRAINT lesson_stages_content_type_check
  CHECK (content_type = ANY (ARRAY[
    'presentation'::text, 'code'::text, 'scratch'::text, 'turbowarp'::text,
    'wokwi'::text, 'codesandbox'::text, 'makecode'::text, 'quiz_qia'::text,
    'quiz_kahoot'::text
  ]));

-- Step 2: migrate the data now that both values are permitted
UPDATE public.lesson_stages
SET content_type = 'turbowarp'
WHERE content_type = 'scratch';

-- Step 3: final constraint — 'scratch' retired, only 'turbowarp' remains
ALTER TABLE public.lesson_stages
  DROP CONSTRAINT lesson_stages_content_type_check;

ALTER TABLE public.lesson_stages
  ADD CONSTRAINT lesson_stages_content_type_check
  CHECK (content_type = ANY (ARRAY[
    'presentation'::text, 'code'::text, 'turbowarp'::text, 'wokwi'::text,
    'codesandbox'::text, 'makecode'::text, 'quiz_qia'::text, 'quiz_kahoot'::text
  ]));

-- Verification
DO $$
DECLARE
  scratch_count int;
  turbowarp_count int;
BEGIN
  SELECT COUNT(*) INTO scratch_count
  FROM public.lesson_stages WHERE content_type = 'scratch';

  SELECT COUNT(*) INTO turbowarp_count
  FROM public.lesson_stages WHERE content_type = 'turbowarp';

  IF scratch_count > 0 THEN
    RAISE EXCEPTION 'Migration failed: % scratch stages remain', scratch_count;
  END IF;

  RAISE NOTICE 'Migration success: % turbowarp stages', turbowarp_count;
END $$;

COMMIT;
