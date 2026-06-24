-- ====================================================================
-- Migration 48: announcement_user_reads
-- Tracks which announcements each user has seen in the ticker.
-- Uses user_id (not student_id) so teachers are covered too.
-- The existing announcement_reads table (migration 34) tracks student reads
-- for the /announcements page; this is a separate, user-agnostic table.
-- ====================================================================

CREATE TABLE IF NOT EXISTS public.announcement_user_reads (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  announcement_id uuid        NOT NULL REFERENCES public.announcements(id) ON DELETE CASCADE,
  read_at         timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, announcement_id)
);

CREATE INDEX IF NOT EXISTS ann_user_reads_user_idx ON public.announcement_user_reads (user_id);
CREATE INDEX IF NOT EXISTS ann_user_reads_ann_idx  ON public.announcement_user_reads (announcement_id);

ALTER TABLE public.announcement_user_reads ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "user reads own ticker reads"   ON public.announcement_user_reads;
DROP POLICY IF EXISTS "user inserts own ticker reads" ON public.announcement_user_reads;

CREATE POLICY "user reads own ticker reads" ON public.announcement_user_reads
  FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "user inserts own ticker reads" ON public.announcement_user_reads
  FOR INSERT WITH CHECK (user_id = auth.uid());

GRANT SELECT, INSERT ON public.announcement_user_reads TO authenticated;
