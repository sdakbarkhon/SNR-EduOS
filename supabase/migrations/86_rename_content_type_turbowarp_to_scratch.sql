-- Migration 86
-- Revert content_type 'turbowarp' -> 'scratch' (УЧ.4 confirmed scratch.mit.edu's
-- /embed endpoint has no X-Frame-Options/CSP frame-ancestors restriction, unlike
-- /editor which sends X-Frame-Options: SAMEORIGIN — so the earlier P16 rename to
-- TurboWarp is no longer needed; plain Scratch embeds work fine in an iframe).

-- Drop the constraint first so neither the old list (no 'scratch') nor a
-- premature new list (still has 12 'turbowarp' rows) rejects anything mid-flight.
ALTER TABLE public.lesson_stages DROP CONSTRAINT lesson_stages_content_type_check;

UPDATE public.lesson_stages SET content_type = 'scratch' WHERE content_type = 'turbowarp';

ALTER TABLE public.lesson_stages ADD CONSTRAINT lesson_stages_content_type_check
  CHECK (content_type = ANY (ARRAY['presentation'::text, 'code'::text, 'scratch'::text, 'wokwi'::text, 'codesandbox'::text, 'makecode'::text, 'quiz_qia'::text, 'quiz_kahoot'::text]));
