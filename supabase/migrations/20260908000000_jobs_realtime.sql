-- ============================================================
-- Migration: enable Realtime for jobs
-- ============================================================
-- Extends the live-sync feature (lib/sync.ts's subscribeToJobLive) to cover
-- the job's own status column, not just job_assets/defects/inspection_photos.
-- Without this, a plain status change — most visibly "Start Job" (Scheduled
-- -> In Progress) — never reached a teammate's device already sitting on
-- that same job's screen; it only appeared to eventually catch up because
-- completing a job is normally preceded by a flurry of job_assets/defects
-- changes that already trigger a refresh, or because the next periodic 60s
-- sync cycle happened to land.
--
-- RLS: unlike inspection_photos/job_assets/defects (each found missing or
-- unreliable earlier this session), jobs' own tenant-isolation policy
-- ("jobs_tenant_isolation") predates every migration file in this repo and
-- is already referenced as an established fact by 20260824020000's own
-- comment — no RLS change needed here, only the realtime publication.
--
-- Run this once in the Supabase SQL Editor.
-- ============================================================

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'jobs'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.jobs;
  END IF;
END $$;
