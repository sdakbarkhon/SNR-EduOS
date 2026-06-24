-- Migration 43: Remove 'late' from attendance status
-- Convert any existing 'late' rows to 'present', then tighten the CHECK constraint.
-- (Migration 42 re-added 'late'; this migration removes it for good.)

-- 1. Convert
UPDATE public.attendance SET status = 'present' WHERE status = 'late';

-- 2. Drop old constraint (name used in migration 42)
ALTER TABLE public.attendance DROP CONSTRAINT IF EXISTS chk_attendance_status;

-- 3. Add updated constraint without 'late'
ALTER TABLE public.attendance
  ADD CONSTRAINT chk_attendance_status
  CHECK (status IN ('present', 'absent_excused', 'absent_unexcused'));
