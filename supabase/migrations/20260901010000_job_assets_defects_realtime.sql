-- ============================================================
-- Migration: enable Supabase Realtime for job_assets + defects
-- ============================================================
-- Backs the inspect screen's live-sync feature (lib/sync.ts's
-- subscribeToJobLive, replacing the old 2.5s livePollJob poll).
-- Scope deliberately narrow — only these two tables, matching exactly
-- what the poll it replaces pulled (_pullRelated('job_assets', ...) /
-- _pullRelated('defects', ...)).
--
-- REPLICA IDENTITY is left at its default (primary key only). The app only
-- subscribes to INSERT/UPDATE for these tables — for those, Postgres always
-- ships the full NEW row in the replication stream regardless of REPLICA
-- IDENTITY (that setting only controls how much of the OLD row is
-- included, which is what DELETE/UPDATE old_record needs — something this
-- app's merge logic never reads; see lib/sync.ts's
-- _shouldPreserveLocalJobAsset, which only looks at the incoming new row
-- plus a fresh local SQLite lookup). DELETE is intentionally not
-- subscribed to: filtering a DELETE by job_id would additionally require
-- REPLICA IDENTITY FULL (job_id isn't part of either table's primary key),
-- and a deleted row was never propagated to OTHER devices by the polling
-- mechanism either — only the deleting device's own local deleteRecord()
-- call removes it there; the REST pull in _pullRelated only ever upserts,
-- it never prunes rows that disappeared server-side. Same limitation, not
-- a regression.
--
-- Run this once in the Supabase SQL Editor.
-- ============================================================

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'job_assets'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.job_assets;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'defects'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.defects;
  END IF;
END $$;
