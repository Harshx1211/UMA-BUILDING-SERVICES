-- ============================================================
-- Migration: Allow "unlinked" defects (no tracked asset)
-- ============================================================
-- The app has always supported logging a defect without linking it to a
-- specific asset (asset_id = null) — see components/defects/AddDefectSheet.tsx.
-- The live schema still had defects.asset_id as NOT NULL, so every unlinked
-- defect was silently failing to sync forever (rejected by the constraint,
-- retried until the sync queue gave up and marked it permanently failed).
--
-- Run this once in the Supabase SQL Editor.
-- ============================================================

ALTER TABLE public.defects ALTER COLUMN asset_id DROP NOT NULL;
