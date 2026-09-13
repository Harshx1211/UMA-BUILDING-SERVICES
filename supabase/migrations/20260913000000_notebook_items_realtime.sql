-- ============================================================
-- Migration: enable Supabase Realtime for property_notebook_items
-- ============================================================
-- The original notebook migration (20260919000000_property_notebook_items.sql)
-- deliberately left this table off the realtime publication — "periodic
-- pull is sufficient cadence" for a low-traffic, per-property note list.
-- Revisited: a technician reading "bring the tall ladder" only after the
-- next 10-minute sync (or a manual pull) defeats the point of a same-visit
-- heads-up between teammates, so this brings it onto the same whole-session
-- "my data" live channel (lib/sync.ts's subscribeToMyDataLive) that
-- properties/assets already use.
--
-- Deletes still ride the existing deletion_log channel — this table
-- already has a trg_log_deletion trigger and is already in
-- REMOTE_DELETABLE_TABLES (lib/database.ts), so only the ADD side was
-- ever missing live coverage.
--
-- Run this once in the Supabase SQL Editor.
-- ============================================================

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'property_notebook_items'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.property_notebook_items;
  END IF;
END $$;
