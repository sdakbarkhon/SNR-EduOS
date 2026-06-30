ALTER TABLE lesson_stages
  ADD COLUMN IF NOT EXISTS teacher_notes text;

COMMENT ON COLUMN lesson_stages.description IS
  'Описание для ученика — что он будет делать на этапе';
COMMENT ON COLUMN lesson_stages.teacher_notes IS
  'Заметки для учителя — педагогические подсказки и нюансы';
