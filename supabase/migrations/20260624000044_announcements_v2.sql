-- ====================================================================
-- Migration 44: announcements_v2
-- Adds category, is_ticker, valid_until to announcements.
-- Cleanup function + conditional pg_cron job.
-- ====================================================================

-- 1. Category enum
DO $$ BEGIN
  CREATE TYPE public.announcement_category AS ENUM (
    'general', 'academic', 'event', 'urgent', 'reminder'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 2. New columns on announcements
ALTER TABLE public.announcements
  ADD COLUMN IF NOT EXISTS category    public.announcement_category NOT NULL DEFAULT 'general',
  ADD COLUMN IF NOT EXISTS is_ticker   boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS valid_until timestamptz;

-- Index for efficient ticker queries (only live rows where is_ticker = true)
CREATE INDEX IF NOT EXISTS announcements_ticker_idx
  ON public.announcements (is_ticker, valid_until)
  WHERE is_ticker = true;

-- Index for efficient cleanup scan
CREATE INDEX IF NOT EXISTS announcements_valid_until_idx
  ON public.announcements (valid_until)
  WHERE valid_until IS NOT NULL;

-- 3. Cleanup function: hard-delete announcements whose valid_until has passed
CREATE OR REPLACE FUNCTION public.fn_cleanup_expired_announcements()
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  DELETE FROM public.announcements
  WHERE valid_until IS NOT NULL AND valid_until < now();
END $$;

-- 4. pg_cron: schedule daily cleanup at 02:00 UTC (no-op if extension absent)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    -- Remove stale schedule if it exists (idempotent re-run)
    PERFORM cron.unschedule('cleanup-expired-announcements')
      WHERE EXISTS (
        SELECT 1 FROM cron.job WHERE jobname = 'cleanup-expired-announcements'
      );
    PERFORM cron.schedule(
      'cleanup-expired-announcements',
      '0 2 * * *',
      'SELECT public.fn_cleanup_expired_announcements()'
    );
  END IF;
END $$;
