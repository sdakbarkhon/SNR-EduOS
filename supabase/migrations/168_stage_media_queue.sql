-- Migration 168: media_queued_at для lesson_stages (K.2, 05.08.2026)
-- Отслеживает момент перехода media_status в 'pending', чтобы safety-net
-- крон (/api/cron/stage-media-backfill) мог найти "зависшие" этапы —
-- например если фоновый fire-and-forget fetch из addLessonStage() не
-- доехал, или сервер упал посреди генерации. Крон ищет
-- media_status='pending' AND media_queued_at старше 30 минут.
--
-- Важно: backfill-stage-media-jul29-aug1.mjs (29.07-01.08, на паузе,
-- 72/162) написан ДО этой миграции и никогда не устанавливал
-- media_queued_at — если от прерванного прогона остались зависшие
-- 'pending'-строки, их media_queued_at всегда NULL. "media_queued_at <
-- cutoff" на NULL в Postgres всегда false/неопределено — такие строки
-- краном НЕ подхватываются. Backfill остаётся нетронутым и не резюмируется
-- этим safety-net.

BEGIN;

ALTER TABLE public.lesson_stages
  ADD COLUMN IF NOT EXISTS media_queued_at timestamptz;

CREATE INDEX IF NOT EXISTS idx_lesson_stages_media_pending
  ON public.lesson_stages (media_queued_at)
  WHERE media_status = 'pending';

COMMENT ON COLUMN public.lesson_stages.media_queued_at IS
  'Момент установки media_status=pending — для safety-net крона (зависшие >30 минут генерации). NULL для строк, обработанных до введения этой колонки, включая backfill 29.07-01.08 (на паузе).';

COMMIT;
