-- Migration 63: synchronous PDF page / video playback state during a live
-- class demonstration (teacher drives, students follow — same pattern as
-- migration 61's current_slide_index for theory slides).

ALTER TABLE lessons
  ADD COLUMN IF NOT EXISTS demo_current_page integer DEFAULT 1;

ALTER TABLE lessons
  ADD COLUMN IF NOT EXISTS demo_video_time real DEFAULT 0;

ALTER TABLE lessons
  ADD COLUMN IF NOT EXISTS demo_video_playing boolean DEFAULT false;

COMMENT ON COLUMN lessons.demo_current_page IS
  'Текущая страница PDF при демонстрации (управляет учитель)';
COMMENT ON COLUMN lessons.demo_video_time IS
  'Текущая позиция видео в секундах при демонстрации';
COMMENT ON COLUMN lessons.demo_video_playing IS
  'Играет ли видео сейчас (управляет учитель)';

GRANT UPDATE (demo_current_page, demo_video_time, demo_video_playing)
  ON lessons TO authenticated;
