-- =====================================================================
-- Migration 166: media_source для lesson_stages (какой провайдер сгенерил картинку)
-- =====================================================================
-- Заказчик 05.08.2026, доп. решение по ходу backfill'а: gemini-2.5-flash-image
-- (модель 165) под устойчивым HTTP 503 "high demand" — добавлен fallback на
-- Pollinations.ai (тот же паттерн, что apps/web/lib/ai-imagen.ts уже
-- использует для слайдов). media_source различает, каким провайдером
-- реально сгенерена картинка конкретного этапа — нужно для статистики
-- backfill'а и на будущее (автогенерация на новые этапы).

BEGIN;

ALTER TABLE public.lesson_stages
  ADD COLUMN IF NOT EXISTS media_source text;

ALTER TABLE public.lesson_stages
  DROP CONSTRAINT IF EXISTS lesson_stages_media_source_check;
ALTER TABLE public.lesson_stages
  ADD CONSTRAINT lesson_stages_media_source_check
    CHECK (media_source IS NULL OR media_source IN ('gemini', 'pollinations'));

COMMENT ON COLUMN public.lesson_stages.media_source IS
  'Какой провайдер сгенерил image_url: gemini (gemini-2.5-flash-image) или pollinations (fallback при 503/недоступности Gemini). NULL = картинки нет вовсе.';

COMMIT;
