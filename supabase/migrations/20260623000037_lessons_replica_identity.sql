-- Migration 37: realtime fix for the lessons table.
--
-- The `lessons` table is in the supabase_realtime publication (migration 13) but
-- was never given REPLICA IDENTITY FULL. Every other lesson-related table
-- (lesson_stages, lesson_stage_progress, lesson_excuse_requests,
-- lesson_raised_hands) already has it.
--
-- Why it matters: the teacher SELECT policy on lessons is
--   USING (public.is_my_teacher_group(group_id))
-- i.e. it references a NON-primary-key column (group_id). Supabase Realtime
-- evaluates the RLS SELECT policy against the WAL record to decide whether to
-- deliver a postgres_changes event to a subscriber. For UPDATE/DELETE events,
-- non-PK columns are only present in the WAL when REPLICA IDENTITY is FULL.
-- Without it, the authorizer cannot evaluate is_my_teacher_group(group_id) and
-- SILENTLY DROPS the event for the teacher.
--
-- Symptom this fixes: teacher had to press F5 to see scheduled -> in_progress
-- (pg_cron auto-start) and in_progress -> completed (pg_cron auto-end). With
-- FULL set, both transitions arrive over realtime with no reload.

ALTER TABLE public.lessons REPLICA IDENTITY FULL;

-- Defensive: make sure lessons is actually in the publication (idempotent).
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
    IF NOT EXISTS (
      SELECT 1 FROM pg_publication_tables
      WHERE pubname = 'supabase_realtime'
        AND schemaname = 'public'
        AND tablename = 'lessons'
    ) THEN
      ALTER PUBLICATION supabase_realtime ADD TABLE public.lessons;
    END IF;
  ELSE
    CREATE PUBLICATION supabase_realtime FOR TABLE public.lessons;
  END IF;
END $$;
