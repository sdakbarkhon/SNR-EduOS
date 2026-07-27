-- =====================================================================
-- Migration 148 — Библиотека материалов учителей: видео-ссылки
-- (YouTube/RuTube) как альтернатива загрузке файла.
--
-- Зеркалит УЖЕ ПРИМЕНЁННУЮ миграцию 138_lesson_materials_video_links.sql
-- (та же задача для lesson_materials) — те же имена колонок и та же форма
-- CHECK-констрейнта, специально НЕ "kind"/"link_url"/"link_platform" из
-- исходной постановки: content_type/external_url/source_url уже
-- канонический паттерн этого проекта для "файл или видео-ссылка" (см.
-- также apps/web/lib/video-url.ts — parseVideoUrl/toEmbedUrl уже кодируют
-- платформу В content_type-подобном значении 'video_youtube'/'video_rutube',
-- отдельная колонка платформы избыточна). Совпадение имён колонок означает,
-- что готовый классификатор apps/web/lib/material-kind.ts (demoKind) и
-- apps/web/components/FileViewerModal.tsx (resolveFileViewerKind,
-- isVideoEmbedUrl) отрабатывают библиотечные видео-ссылки БЕЗ единой
-- правки — они уже классифицируют по external_url/содержимому, не по
-- таблице-источнику.
--
-- storage_path был NOT NULL (все материалы были файлами) — ослабляем,
-- т.к. видео-материал не имеет Storage-объекта, только внешний embed-URL.
-- content_type различает форму хранения; существующие строки получают
-- DEFAULT 'file' автоматически (ADD COLUMN ... DEFAULT на NOT NULL
-- бэкфиллит существующие строки тем же значением — они и есть файлы).
--
-- Идемпотентно: IF NOT EXISTS / DROP CONSTRAINT IF EXISTS везде, безопасно
-- перезапускать.
-- =====================================================================

BEGIN;

ALTER TABLE public.teacher_library_materials
  ALTER COLUMN storage_path DROP NOT NULL;

ALTER TABLE public.teacher_library_materials
  ADD COLUMN IF NOT EXISTS content_type text NOT NULL DEFAULT 'file'
    CHECK (content_type IN ('file', 'video_youtube', 'video_rutube')),
  ADD COLUMN IF NOT EXISTS external_url text,
  ADD COLUMN IF NOT EXISTS source_url text;

-- Форма данных зависит от content_type: файл обязан иметь storage-путь,
-- видео обязано иметь embed-URL (external_url) и исходную ссылку
-- (source_url, для показа пользователю "откуда" видео) — идентично
-- lesson_materials_content_shape_chk из миграции 138.
ALTER TABLE public.teacher_library_materials
  DROP CONSTRAINT IF EXISTS teacher_library_materials_content_shape_chk;
ALTER TABLE public.teacher_library_materials
  ADD CONSTRAINT teacher_library_materials_content_shape_chk CHECK (
    (content_type = 'file' AND storage_path IS NOT NULL)
    OR (content_type IN ('video_youtube', 'video_rutube')
        AND external_url IS NOT NULL AND source_url IS NOT NULL)
  );

COMMENT ON COLUMN public.teacher_library_materials.content_type IS
  '''file'' — обычная загрузка (storage_path в бакете materials); ''video_youtube''/''video_rutube'' — видео-ссылка (external_url = нормализованный embed-URL, source_url = то, что вставил учитель). См. apps/web/lib/video-url.ts.';
COMMENT ON COLUMN public.teacher_library_materials.external_url IS
  'Нормализованный embed-URL (youtube.com/embed/<id> | rutube.ru/play/embed/<id>) — только для content_type video_*. NULL для файлов.';
COMMENT ON COLUMN public.teacher_library_materials.source_url IS
  'Исходная ссылка, которую вставил учитель (watch?v=…, youtu.be/…, rutube.ru/video/<id>/…) — для отображения "откуда" видео. NULL для файлов.';

-- RLS/junction — без изменений: политики teacher_library_materials
-- (миграция 147) читают/пишут строку целиком по school_id/uploaded_by/
-- subject_slug и не ссылаются на storage_path/file_type — новые колонки
-- этим политикам не мешают, ничего добавлять не нужно.
-- teacher_library_material_groups (классы) тоже не меняется: видео-ссылка
-- целится в классы через тот же junction, что и файл.

INSERT INTO supabase_migrations.schema_migrations (version)
VALUES ('148')
ON CONFLICT (version) DO NOTHING;

COMMIT;
