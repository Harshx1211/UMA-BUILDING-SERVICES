-- ============================================================
-- Migration: enable Supabase Realtime for job_technicians, quotes,
-- time_logs, site_documents
-- ============================================================
-- Extends the per-job live channel (lib/sync.ts's subscribeToJobLive,
-- already covering job_assets/defects/inspection_photos/jobs — see
-- 20260901010000_job_assets_defects_realtime.sql and
-- 20260908000000_jobs_realtime.sql) to four more tables, now that the
-- background sync interval has been stretched from 60s to 10 minutes
-- (constants/Config.ts) — this channel, not the periodic pull, is now the
-- primary way a change to one of these reaches a device actively looking
-- at the job it belongs to.
--
-- quote_items is deliberately NOT added here — it has no job_id column to
-- filter a postgres_changes subscription on, so the client instead
-- re-pulls a quote's items whenever that quote itself changes (every
-- quote_item write already updates its parent quote's total_amount in the
-- same action — see quote.tsx / defectsStore.ts's own write sites).
--
-- Same DELETE caveat as every other table in this publication: not
-- subscribed (see 20260901010000_*'s own comment for why), and the REST
-- pull these tables already got via _pullRelated never pruned
-- server-side deletes either — same limitation, not a regression.
--
-- Run this once in the Supabase SQL Editor.
-- ============================================================

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'job_technicians'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.job_technicians;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'quotes'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.quotes;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'time_logs'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.time_logs;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'site_documents'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.site_documents;
  END IF;
END $$;
