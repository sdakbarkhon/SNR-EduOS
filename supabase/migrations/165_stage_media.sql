-- =====================================================================
-- Migration 165: stage media (AI-generated картинки + mermaid-схемы)
-- =====================================================================
-- Заказчик 05.08.2026: этапы уроков Programming/Robotics за 29.07-01.08.2026
-- получают визуальные материалы — картинки через Gemini 2.5 Flash Image
-- ("Nano Banana") и mermaid-схемы алгоритмов, рендерятся на клиенте через
-- mermaid.js. Это ТОЛЬКО схема под backfill существующих этапов (см.
-- apps/web/scripts/backfill-stage-media-jul29-aug1.mjs) — автогенерация на
-- создание новых этапов НЕ подключена, отдельная будущая задача.
--
-- media_status семантика:
--   NULL      — медиа для этапа не запрашивалось вовсе (стартовые/итоговые
--               администативные этапы без содержимого backfill не трогает)
--   'pending' — генерация в процессе (партиальный индекс ниже — под будущий
--               воркер автогенерации, который будет выбирать pending-этапы)
--   'generated' — решение принято: либо картинка/схема сгенерились, либо AI
--               решил что этапу медиа не нужно — в обоих случаях проход завершён
--   'failed'  — провал после 3 retry, media_error содержит текст последней ошибки

BEGIN;

ALTER TABLE public.lesson_stages
  ADD COLUMN IF NOT EXISTS image_url    text,
  ADD COLUMN IF NOT EXISTS mermaid_code text,
  ADD COLUMN IF NOT EXISTS media_status text,
  ADD COLUMN IF NOT EXISTS media_error  text;

ALTER TABLE public.lesson_stages
  DROP CONSTRAINT IF EXISTS lesson_stages_media_status_check;
ALTER TABLE public.lesson_stages
  ADD CONSTRAINT lesson_stages_media_status_check
    CHECK (media_status IS NULL OR media_status IN ('pending', 'generated', 'failed'));

COMMENT ON COLUMN public.lesson_stages.image_url IS
  'Signed URL картинки этапа в bucket lesson-stage-images (Gemini 2.5 Flash Image). NULL = картинка не запрашивалась/не нужна.';
COMMENT ON COLUMN public.lesson_stages.mermaid_code IS
  'Код mermaid flowchart для рендера алгоритма на клиенте. NULL = схема не запрашивалась/не нужна.';
COMMENT ON COLUMN public.lesson_stages.media_status IS
  'NULL = не запрашивалось; pending = генерация идёт; generated = решение принято (с медиа или без); failed = провал после retry.';
COMMENT ON COLUMN public.lesson_stages.media_error IS
  'Текст последней ошибки Gemini при failed, для диагностики.';

-- Партиальный индекс под воркер, который будет выбирать pending-этапы
-- (задел на будущую автогенерацию, см. комментарий выше).
CREATE INDEX IF NOT EXISTS idx_lesson_stages_media_status
  ON public.lesson_stages (media_status)
  WHERE media_status = 'pending';

-- Storage bucket для картинок этапов — приватный (в отличие от публичного
-- slide-images из миграции 60), доступ строго через signed URL, которые
-- generateStageImage()/uploadStageImageToStorage() выписывают один раз при
-- загрузке и сохраняют готовую ссылку в lesson_stages.image_url.
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'lesson-stage-images', 'lesson-stage-images', false, 10485760,
  ARRAY['image/png', 'image/jpeg', 'image/webp']
)
ON CONFLICT (id) DO UPDATE
  SET public             = EXCLUDED.public,
      file_size_limit    = EXCLUDED.file_size_limit,
      allowed_mime_types = EXCLUDED.allowed_mime_types;

DROP POLICY IF EXISTS "authenticated reads lesson-stage-images" ON storage.objects;
DROP POLICY IF EXISTS "teacher uploads lesson-stage-images"      ON storage.objects;

-- Приватный bucket — обычный SELECT всё равно не отдаёт файл без токена
-- (signed URL перекрывает RLS), политика тут для порядка/на случай прямого
-- доступа с сервисной ролью с проверкой bucket_id.
CREATE POLICY "authenticated reads lesson-stage-images"
  ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'lesson-stage-images');

CREATE POLICY "teacher uploads lesson-stage-images"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'lesson-stage-images'
    AND EXISTS (SELECT 1 FROM public.teachers WHERE user_id = auth.uid())
  );

COMMIT;
