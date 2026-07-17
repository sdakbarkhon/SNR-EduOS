-- Пачка 4 — материалы урока: ссылка на видео (YouTube/RuTube) как
-- альтернатива загрузке файла. Применить вручную через Supabase Dashboard
-- SQL Editor.
--
-- file_storage_path был NOT NULL (все материалы были файлами) — ослабляем,
-- т.к. видео-материал не имеет Storage-объекта, только внешний embed-URL.
-- content_type различает форму хранения; existing rows получают default
-- 'file' автоматически (они и есть файлы).

BEGIN;

ALTER TABLE public.lesson_materials
  ALTER COLUMN file_storage_path DROP NOT NULL;

ALTER TABLE public.lesson_materials
  ADD COLUMN IF NOT EXISTS content_type text NOT NULL DEFAULT 'file'
    CHECK (content_type IN ('file', 'video_youtube', 'video_rutube')),
  ADD COLUMN IF NOT EXISTS external_url text,
  ADD COLUMN IF NOT EXISTS source_url text;

-- Форма данных зависит от content_type: файл обязан иметь storage-путь,
-- видео обязано иметь embed-URL (external_url) и исходную ссылку
-- (source_url, для показа пользователю "откуда" видео).
ALTER TABLE public.lesson_materials
  ADD CONSTRAINT lesson_materials_content_shape_chk CHECK (
    (content_type = 'file' AND file_storage_path IS NOT NULL)
    OR (content_type IN ('video_youtube', 'video_rutube')
        AND external_url IS NOT NULL AND source_url IS NOT NULL)
  );

COMMIT;
