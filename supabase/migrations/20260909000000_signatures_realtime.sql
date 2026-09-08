-- ============================================================
-- Migration: enable Supabase Realtime for signatures
-- ============================================================
-- Extends the per-job live channel (lib/sync.ts's subscribeToJobLive,
-- already covering job_assets/defects/inspection_photos/jobs/
-- job_technicians/quotes/time_logs/site_documents) to also carry
-- signatures — wires up jobs/[id]/signature.tsx (job-lock awareness) and
-- jobs/[id]/report.tsx (its own full reload), the last two job-scoped
-- screens that had never been connected to this channel at all.
--
-- Same DELETE caveat as every other table in this publication: not
-- subscribed (see 20260901010000_job_assets_defects_realtime.sql's own
-- comment for why), and the REST pull this table already gets via
-- _pullRelated never pruned server-side deletes either — same limitation,
-- not a regression. signatures.job_id is UNIQUE (one signature set per
-- job), so INSERT/UPDATE is really all that ever happens to a row here.
--
-- Run this once in the Supabase SQL Editor.
-- ============================================================

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'signatures'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.signatures;
  END IF;
END $$;
