-- =====================================================================
-- Migration 23: Index on homework.lesson_id
-- The FK column (lesson_id → lessons.id ON DELETE SET NULL) already
-- exists from migration 5.  This migration adds a covering index so
-- the getLessonById query (homework JOIN lessons) is fast.
-- =====================================================================

CREATE INDEX IF NOT EXISTS homework_lesson_id_idx
  ON public.homework (lesson_id)
  WHERE lesson_id IS NOT NULL;
