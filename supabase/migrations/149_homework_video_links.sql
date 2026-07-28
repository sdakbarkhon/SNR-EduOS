-- =====================================================================
-- Migration 149 — Задания (homework): видео-ссылка (YouTube/RuTube) как
-- альтернатива прикреплённому файлу учителя.
--
-- ВАЖНОЕ ОТЛИЧИЕ от 138 (lesson_materials) и 148 (teacher_library_materials):
-- у public.homework УЖЕ ЕСТЬ колонка `content_type` — это ОТДЕЛЬНАЯ ось,
-- тип самого ЗАДАНИЯ (file/test/programming/bundle/12 внешних сервисов
-- вроде wokwi/geogebra/desmos — констрейнт homework_content_type_check,
-- миграция 95), и колонка `external_url`, занятая теми же 12 внешними
-- сервисами (тоже миграция 95). Обе заняты существующей логикой —
-- переиспользовать голые имена content_type/external_url/source_url,
-- как в 138/148, здесь НЕЛЬЗЯ: столкнётся с типом задания.
--
-- Вместо этого — отдельная, параллельная ось для СОБСТВЕННОГО вложения
-- учителя к заданию (то, что сегодня хранится в attachment_storage_path/
-- attachment_filename/attachment_size_bytes, миграция
-- 20260617000022_homework_files.sql), названная в том же стиле:
-- attachment_content_type / attachment_external_url / attachment_source_url.
-- Принцип (файл vs видео-ссылка, DEFAULT 'file' бэкфиллит существующие
-- строки, CHECK на форму данных) — тот же, что в 138/148.
--
-- Второе отличие: attachment_storage_path/attachment_filename/
-- attachment_size_bytes НИКОГДА не имели NOT NULL (вложение к заданию
-- всегда было необязательным, в отличие от lesson_materials/
-- teacher_library_materials, где строка обязана быть файлом или видео).
-- Поэтому ALTER COLUMN ... DROP NOT NULL здесь не нужен, а CHECK мягче:
-- attachment_content_type='file' допускает ПОЛНОЕ отсутствие вложения
-- (все attachment_*-поля NULL — обычное состояние сегодня для заданий
-- без вложения), video_* требует оба URL и запрещает файловые поля
-- (файл и видео-ссылка взаимно исключают друг друга).
--
-- RLS: без изменений. Все 6 политик на public.homework ("student reads
-- own homework" / "teacher reads homework in own groups" / "teacher
-- creates homework" / "teacher updates own homework" / "teacher deletes
-- own homework" / "parent reads own children homework") проверяют
-- только group_id/teacher_id/school_id — RLS row-scoped, не
-- column-scoped, новые nullable-колонки им не мешают, добавлять нечего.
--
-- Применить вручную через Supabase Dashboard SQL Editor. Идемпотентно
-- (IF NOT EXISTS / DROP CONSTRAINT IF EXISTS), безопасно перезапускать.
-- =====================================================================

BEGIN;

ALTER TABLE public.homework
  ADD COLUMN IF NOT EXISTS attachment_content_type text NOT NULL DEFAULT 'file'
    CHECK (attachment_content_type IN ('file', 'video_youtube', 'video_rutube')),
  ADD COLUMN IF NOT EXISTS attachment_external_url text,
  ADD COLUMN IF NOT EXISTS attachment_source_url text;

-- Форма вложения зависит от attachment_content_type:
--  - 'file'                     — attachment_external_url/attachment_source_url
--                                  обязаны быть NULL; attachment_storage_path/
--                                  attachment_filename/attachment_size_bytes
--                                  могут быть заполнены (файл прикреплён) ИЛИ
--                                  все NULL (вложения вовсе нет — норма).
--  - video_youtube/video_rutube  — attachment_external_url (embed-URL) и
--                                  attachment_source_url (то, что вставил
--                                  учитель) обязаны быть заполнены, а файловые
--                                  поля обязаны быть NULL.
ALTER TABLE public.homework
  DROP CONSTRAINT IF EXISTS homework_attachment_shape_chk;
ALTER TABLE public.homework
  ADD CONSTRAINT homework_attachment_shape_chk CHECK (
    (
      attachment_content_type = 'file'
      AND attachment_external_url IS NULL
      AND attachment_source_url IS NULL
    )
    OR (
      attachment_content_type IN ('video_youtube', 'video_rutube')
      AND attachment_external_url IS NOT NULL
      AND attachment_source_url IS NOT NULL
      AND attachment_storage_path IS NULL
      AND attachment_filename IS NULL
      AND attachment_size_bytes IS NULL
    )
  );

COMMENT ON COLUMN public.homework.attachment_content_type IS
  '«file» — обычное вложение (attachment_storage_path в бакете homework-files; может быть NULL — вложения вовсе нет); «video_youtube»/«video_rutube» — видео-ссылка вместо файла (attachment_external_url = нормализованный embed-URL, attachment_source_url = то, что вставил учитель). НЕ путать с homework.content_type — это тип ЗАДАНИЯ (file/test/programming/bundle/внешний сервис, констрейнт homework_content_type_check, миграция 95), ось независимая. См. apps/web/lib/video-url.ts.';
COMMENT ON COLUMN public.homework.attachment_external_url IS
  'Нормализованный embed-URL (youtube.com/embed/<id> | rutube.ru/play/embed/<id>) — только для attachment_content_type video_*. NULL для файлов. НЕ путать с homework.external_url (используется 12 внешними сервисами вроде wokwi/geogebra, миграция 95) — разные колонки, разное назначение.';
COMMENT ON COLUMN public.homework.attachment_source_url IS
  'Исходная ссылка, которую вставил учитель (watch?v=…, youtu.be/…, rutube.ru/video/<id>/…) — для отображения "откуда" видео. NULL для файлов.';

INSERT INTO supabase_migrations.schema_migrations (version)
VALUES ('149')
ON CONFLICT (version) DO NOTHING;

COMMIT;
