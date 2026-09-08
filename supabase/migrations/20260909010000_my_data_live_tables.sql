-- ============================================================
-- Migration: enable Supabase Realtime for notifications, users,
-- properties, assets
-- ============================================================
-- Backs the new "my data" live channel (lib/sync.ts's
-- subscribeToMyDataLive) — a second, whole-session realtime channel
-- alongside the existing per-job one (subscribeToJobLive). This one feeds
-- the screens that show data across MANY jobs/properties at once and so
-- can't use a per-job channel at all: Home, the Schedule tab, the global
-- Defects list, Property Detail, the Property Asset Register, the single
-- Asset detail screen, Notifications, and Profile.
--
-- jobs/job_technicians/defects are already in this publication (see
-- 20260901010000_job_assets_defects_realtime.sql and
-- 20260908000000_jobs_realtime.sql) — only these four are new.
--
-- Same DELETE caveat as every other table in this publication: not
-- subscribed by the client, and the REST pull these tables already get
-- never pruned server-side deletes either — same limitation, not a
-- regression.
--
-- Run this once in the Supabase SQL Editor.
-- ============================================================

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'notifications'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'users'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.users;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'properties'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.properties;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'assets'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.assets;
  END IF;
END $$;
