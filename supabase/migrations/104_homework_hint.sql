-- =====================================================================
-- Migration 104 — БОЛЬШОЕ ОБНОВЛЕНИЕ Этап 8: подсказка учителя для ДЗ
-- (изображение/PDF), отдельная от общего attachment_storage_path
-- (§3.4/КБ-прикрепление) — та вкладывается как скачиваемый файл сверху
-- страницы, эта показывается ученику постоянно рядом с рабочей областью
-- (side panel, §8.2), поэтому не переиспользуется тот же столбец.
-- =====================================================================

ALTER TABLE public.homework
  ADD COLUMN IF NOT EXISTS hint_storage_path text,
  ADD COLUMN IF NOT EXISTS hint_filename text,
  ADD COLUMN IF NOT EXISTS hint_mime_type text;
