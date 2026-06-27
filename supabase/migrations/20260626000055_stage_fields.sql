-- =============================================================================
-- Migration 55: lesson_stages — сложность (difficulty) + длительность (duration_min)
-- Используется ИИ-генератором урока (Итерация 3, Промт 4):
--   · difficulty   — сложность этапа (easy/medium/hard), default 'medium'
--   · duration_min — длительность этапа в минутах (видна только учителю), nullable
-- =============================================================================

-- Сложность этапа
ALTER TABLE public.lesson_stages
  ADD COLUMN IF NOT EXISTS difficulty text
    CHECK (difficulty IN ('easy', 'medium', 'hard'))
    DEFAULT 'medium';

-- Длительность этапа в минутах (NULL = не задана; ИИ сам распределит время)
ALTER TABLE public.lesson_stages
  ADD COLUMN IF NOT EXISTS duration_min int DEFAULT NULL;

-- Индекс для быстрого вычисления суммарной длительности этапов урока
CREATE INDEX IF NOT EXISTS idx_lesson_stages_lesson_position
  ON public.lesson_stages(lesson_id, position);

-- GRANT INSERT/UPDATE на lesson_stages для authenticated уже выдан в миграции 35
-- (табличный, покрывает новые столбцы) — дополнительных грантов не требуется.
