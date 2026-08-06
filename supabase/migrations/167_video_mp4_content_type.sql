-- =====================================================================
-- Migration 167: video_mp4 content_type + bucket lesson-videos (K.1)
-- (166 уже занят 166_stage_media_source.sql — применён в БД по паузной
-- задаче StageMedia, хоть сам backfill ещё не закоммичен)
-- =====================================================================
-- Заказчик 05.08.2026: учитель может загрузить .mp4 файлом (не только
-- вставить ссылку YouTube/RuTube — K.3, коммит d567cec) в lesson_materials,
-- teacher_library_materials, homework.attachment. course_materials не
-- трогаем — там нет CHECK-constraint вовсе (проверено живым pg_constraint),
-- уже принимает файл любого типа как есть.
--
-- Существующие shape-constraint'ы у lesson_materials/teacher_library_materials
-- требуют для video_youtube/video_rutube storage_path быть NULL; у homework —
-- то же самое (attachment_storage_path IS NULL для video_*). Для video_mp4
-- нужна ОБРАТНАЯ форма (storage_path NOT NULL, external_url/source_url NULL) —
-- поэтому не просто добавляем значение в список, а добавляем новую ветку
-- OR в каждый shape-constraint.

BEGIN;

-- ── homework ──────────────────────────────────────────────────────────────

ALTER TABLE public.homework
  DROP CONSTRAINT IF EXISTS homework_attachment_content_type_check;
ALTER TABLE public.homework
  ADD CONSTRAINT homework_attachment_content_type_check
    CHECK (attachment_content_type = ANY (ARRAY['file'::text, 'video_youtube'::text, 'video_rutube'::text, 'video_mp4'::text]));

ALTER TABLE public.homework
  DROP CONSTRAINT IF EXISTS homework_attachment_shape_chk;
ALTER TABLE public.homework
  ADD CONSTRAINT homework_attachment_shape_chk
    CHECK (
      ((attachment_content_type = 'file'::text)
        AND (attachment_external_url IS NULL) AND (attachment_source_url IS NULL))
      OR
      ((attachment_content_type = ANY (ARRAY['video_youtube'::text, 'video_rutube'::text]))
        AND (attachment_external_url IS NOT NULL) AND (attachment_source_url IS NOT NULL)
        AND (attachment_storage_path IS NULL) AND (attachment_filename IS NULL) AND (attachment_size_bytes IS NULL))
      OR
      ((attachment_content_type = 'video_mp4'::text)
        AND (attachment_storage_path IS NOT NULL)
        AND (attachment_external_url IS NULL) AND (attachment_source_url IS NULL))
    );

-- ── lesson_materials ─────────────────────────────────────────────────────

ALTER TABLE public.lesson_materials
  DROP CONSTRAINT IF EXISTS lesson_materials_content_type_check;
ALTER TABLE public.lesson_materials
  ADD CONSTRAINT lesson_materials_content_type_check
    CHECK (content_type = ANY (ARRAY['file'::text, 'video_youtube'::text, 'video_rutube'::text, 'video_mp4'::text]));

ALTER TABLE public.lesson_materials
  DROP CONSTRAINT IF EXISTS lesson_materials_content_shape_chk;
ALTER TABLE public.lesson_materials
  ADD CONSTRAINT lesson_materials_content_shape_chk
    CHECK (
      ((content_type = 'file'::text) AND (file_storage_path IS NOT NULL))
      OR
      ((content_type = ANY (ARRAY['video_youtube'::text, 'video_rutube'::text]))
        AND (external_url IS NOT NULL) AND (source_url IS NOT NULL))
      OR
      ((content_type = 'video_mp4'::text) AND (file_storage_path IS NOT NULL))
    );

-- ── teacher_library_materials ────────────────────────────────────────────

ALTER TABLE public.teacher_library_materials
  DROP CONSTRAINT IF EXISTS teacher_library_materials_content_type_check;
ALTER TABLE public.teacher_library_materials
  ADD CONSTRAINT teacher_library_materials_content_type_check
    CHECK (content_type = ANY (ARRAY['file'::text, 'video_youtube'::text, 'video_rutube'::text, 'video_mp4'::text]));

ALTER TABLE public.teacher_library_materials
  DROP CONSTRAINT IF EXISTS teacher_library_materials_content_shape_chk;
ALTER TABLE public.teacher_library_materials
  ADD CONSTRAINT teacher_library_materials_content_shape_chk
    CHECK (
      ((content_type = 'file'::text) AND (storage_path IS NOT NULL))
      OR
      ((content_type = ANY (ARRAY['video_youtube'::text, 'video_rutube'::text]))
        AND (external_url IS NOT NULL) AND (source_url IS NOT NULL))
      OR
      ((content_type = 'video_mp4'::text) AND (storage_path IS NOT NULL))
    );

-- ── Storage bucket: lesson-videos ────────────────────────────────────────
-- Общий бакет на все 4 места (не по одному на таблицу) — путь
-- <teacher_id>/<uuid>.mp4, владение определяется первым сегментом пути.
-- Приватный, 50MB (дефолтный Supabase-лимит, не поднимаем), только video/mp4.

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('lesson-videos', 'lesson-videos', false, 52428800, ARRAY['video/mp4'])
ON CONFLICT (id) DO UPDATE
  SET public             = EXCLUDED.public,
      file_size_limit    = EXCLUDED.file_size_limit,
      allowed_mime_types = EXCLUDED.allowed_mime_types;

DROP POLICY IF EXISTS "authenticated reads lesson-videos" ON storage.objects;
DROP POLICY IF EXISTS "teacher uploads lesson-videos"      ON storage.objects;
DROP POLICY IF EXISTS "teacher manages own lesson-videos"  ON storage.objects;

-- Бакет приватный — обычный SELECT всё равно не отдаёт файл без signed URL,
-- реальный гейт доступа — RLS родительской таблицы (lesson_materials/
-- teacher_library_materials/homework), через которую signed URL выписывается
-- сервер-экшеном. Та же схема, что уже применена для lesson-stage-images
-- (миграция 165).
CREATE POLICY "authenticated reads lesson-videos"
  ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'lesson-videos');

CREATE POLICY "teacher uploads lesson-videos"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'lesson-videos'
    AND (storage.foldername(name))[1] = (public.current_teacher_id())::text
  );

-- UPDATE/DELETE только автор (первый сегмент пути = его teacher_id).
CREATE POLICY "teacher manages own lesson-videos"
  ON storage.objects FOR ALL TO authenticated
  USING (
    bucket_id = 'lesson-videos'
    AND (storage.foldername(name))[1] = (public.current_teacher_id())::text
  )
  WITH CHECK (
    bucket_id = 'lesson-videos'
    AND (storage.foldername(name))[1] = (public.current_teacher_id())::text
  );

COMMIT;
