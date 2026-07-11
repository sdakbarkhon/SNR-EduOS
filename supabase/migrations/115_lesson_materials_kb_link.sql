-- =====================================================================
-- Migration 115 — "Прикрепить материал" (/teacher/lessons/[id]) может
-- линковать существующий файл из Базы знаний (course_materials/books)
-- вместо повторной загрузки — тот же принцип, что Этап 3.4 уже сделал
-- для домашних заданий (homework.attachment_storage_path с префиксом
-- kb:materials:/kb:books:), но здесь — явными колонками, т.к. пользователь
-- прямо попросил флаг from_knowledge_base, а lesson_materials (в отличие
-- от homework) ещё не имеет prefix-конвенции на file_storage_path.
--
-- kb_bucket нужен отдельно от from_knowledge_base: file_storage_path у
-- линкованной записи — это ЧУЖОЙ путь (из бакета "materials" или "books"),
-- не "lesson-materials" — getLessonMaterialUrl/deleteLessonMaterial должны
-- знать, из какого бакета читать/НЕ удалять при линке.
-- =====================================================================

BEGIN;

ALTER TABLE public.lesson_materials
  ADD COLUMN IF NOT EXISTS from_knowledge_base boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS kb_bucket text;

ALTER TABLE public.lesson_materials
  DROP CONSTRAINT IF EXISTS lesson_materials_kb_bucket_check;
ALTER TABLE public.lesson_materials
  ADD CONSTRAINT lesson_materials_kb_bucket_check
  CHECK (kb_bucket IS NULL OR kb_bucket IN ('materials', 'books'));

COMMENT ON COLUMN public.lesson_materials.from_knowledge_base IS
  'true — файл линкован из Базы знаний (course_materials/books), не загружен заново.';
COMMENT ON COLUMN public.lesson_materials.kb_bucket IS
  'Storage-бакет для file_storage_path, когда from_knowledge_base=true: materials | books. NULL для обычной загрузки (бакет lesson-materials).';

INSERT INTO supabase_migrations.schema_migrations (version)
VALUES ('115')
ON CONFLICT (version) DO NOTHING;

COMMIT;
