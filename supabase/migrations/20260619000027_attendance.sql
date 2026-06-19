-- Migration 27: attendance — convert enum to text, add roll-call columns + teacher RLS
-- ──────────────────────────────────────────────────────────────────────────────

-- ── 1. Convert attendance_status enum → text + CHECK ─────────────────────────

ALTER TABLE public.attendance ADD COLUMN status_v2 text;

UPDATE public.attendance
SET status_v2 = CASE
  WHEN status::text = 'present' THEN 'present'
  WHEN status::text = 'late'    THEN 'present'
  WHEN status::text = 'absent'  THEN 'absent_unexcused'
  ELSE 'present'
END;

ALTER TABLE public.attendance DROP COLUMN status;
ALTER TABLE public.attendance RENAME COLUMN status_v2 TO status;
ALTER TABLE public.attendance ALTER COLUMN status SET NOT NULL;
ALTER TABLE public.attendance ALTER COLUMN status SET DEFAULT 'present';
ALTER TABLE public.attendance
  ADD CONSTRAINT chk_attendance_status
  CHECK (status IN ('present', 'absent_excused', 'absent_unexcused'));

DROP TYPE IF EXISTS public.attendance_status;

-- ── 2. New roll-call columns ──────────────────────────────────────────────────

ALTER TABLE public.attendance
  ADD COLUMN IF NOT EXISTS marked_at    timestamptz NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS marked_by    uuid        REFERENCES public.teachers(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS is_finalized boolean     NOT NULL DEFAULT false;

-- Back-fill: seed rows are historical, mark as finalized
UPDATE public.attendance SET marked_at = recorded_at, is_finalized = true;

-- ── 3. Index ──────────────────────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS attendance_lesson_id_idx ON public.attendance (lesson_id);

-- ── 4. Teacher RLS policies ───────────────────────────────────────────────────
-- SELECT policy already exists from migration 18.
-- Adding INSERT and UPDATE (new).

CREATE POLICY "teacher inserts attendance"
  ON public.attendance FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.lessons l
      WHERE l.id = lesson_id AND public.is_my_teacher_group(l.group_id)
    )
  );

-- USING = old row: only while not finalized → immutable after finalize
CREATE POLICY "teacher updates attendance"
  ON public.attendance FOR UPDATE TO authenticated
  USING (
    is_finalized = false
    AND EXISTS (
      SELECT 1 FROM public.lessons l
      WHERE l.id = lesson_id AND public.is_my_teacher_group(l.group_id)
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.lessons l
      WHERE l.id = lesson_id AND public.is_my_teacher_group(l.group_id)
    )
  );

-- ── 5. Grants ─────────────────────────────────────────────────────────────────

GRANT SELECT, INSERT, UPDATE ON public.attendance TO authenticated, anon;
