-- Migration 62: promote code-stage fields from lesson_stages.config (jsonb)
-- to top-level columns. Fixes a real bug: the AI's programming-progression
-- DEMO stage (stage_type='theory') put its example code into teacher_notes
-- only — students never saw it because it wasn't in a queryable, student-
-- visible field the UI could render a Monaco editor from.

ALTER TABLE lesson_stages
  ADD COLUMN IF NOT EXISTS starter_code text;

ALTER TABLE lesson_stages
  ADD COLUMN IF NOT EXISTS programming_language text;

ALTER TABLE lesson_stages
  ADD COLUMN IF NOT EXISTS expected_output text;

COMMENT ON COLUMN lesson_stages.starter_code IS
  'Стартовый код для code этапов (полный для demo, скелет для практики, комментарии для задания)';
COMMENT ON COLUMN lesson_stages.programming_language IS
  'Язык программирования для запуска (python | cpp — см. CodeLanguage)';
COMMENT ON COLUMN lesson_stages.expected_output IS
  'Ожидаемый вывод для автопроверки';
