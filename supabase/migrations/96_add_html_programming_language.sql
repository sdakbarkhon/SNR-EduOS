-- Migration 96 (УЧ.11 Part 3+4): homework.programming_language CHECK widened
-- to include 'html' — HTML/CSS "Программирование" homework never reaches
-- Piston (it renders as a live srcdoc iframe preview client-side instead),
-- but the top-level column still needs to accept the value.
--
-- lesson_stages.programming_language has no CHECK constraint (plain text,
-- migration 62) so it already accepts 'html' without any change here.

ALTER TABLE public.homework DROP CONSTRAINT IF EXISTS homework_programming_language_check;
ALTER TABLE public.homework ADD CONSTRAINT homework_programming_language_check
  CHECK (programming_language IS NULL OR programming_language = ANY (ARRAY[
    'python'::text, 'javascript'::text, 'cpp'::text, 'java'::text, 'html'::text
  ]));
