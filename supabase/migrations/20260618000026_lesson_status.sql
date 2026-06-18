-- Migration 26: lesson status → 'scheduled'/'in_progress'/'completed' + started_at/ended_at
-- Replaces lesson_status enum (scheduled/ongoing/done/cancelled) with text + CHECK.

-- ── 1. Convert status column from enum to text ────────────────────────────────
ALTER TABLE public.lessons ALTER COLUMN status DROP DEFAULT;
ALTER TABLE public.lessons ALTER COLUMN status TYPE text;
ALTER TABLE public.lessons ALTER COLUMN status SET DEFAULT 'scheduled';

-- ── 2. Migrate old enum values ────────────────────────────────────────────────
UPDATE public.lessons SET status = 'completed'  WHERE status = 'done';
UPDATE public.lessons SET status = 'in_progress' WHERE status = 'ongoing';
UPDATE public.lessons SET status = 'scheduled'  WHERE status = 'cancelled';

-- ── 3. Add CHECK constraint ────────────────────────────────────────────────────
ALTER TABLE public.lessons
  ADD CONSTRAINT lessons_status_check
  CHECK (status IN ('scheduled', 'in_progress', 'completed'));

-- ── 4. Add actual start/end timestamps (different from planned starts_at/ends_at) ──
ALTER TABLE public.lessons ADD COLUMN IF NOT EXISTS started_at timestamptz;
ALTER TABLE public.lessons ADD COLUMN IF NOT EXISTS ended_at   timestamptz;

-- ── 5. Drop the now-unused enum type ──────────────────────────────────────────
DROP TYPE IF EXISTS public.lesson_status;
