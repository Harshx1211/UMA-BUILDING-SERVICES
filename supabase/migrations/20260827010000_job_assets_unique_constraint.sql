-- ============================================================
-- Migration: job_assets uniqueness — one row per (job, asset)
-- ============================================================
-- With multiple technicians now assignable to the same job (job_technicians),
-- two devices working offline could each independently mint their own
-- job_assets row for the same never-before-actioned asset, since neither
-- device knows the other already created one. That produced duplicate,
-- contradictory rows for the same asset in the same job (one Pass, one
-- Fail) with nothing to merge them.
--
-- This constraint makes that impossible going forward: a second INSERT for
-- the same (job_id, asset_id) is rejected by Postgres, and the app's sync
-- engine (lib/sync.ts) catches that specific conflict and resolves it by
-- policy — whichever technician's submission has the later actioned_at
-- timestamp wins, applied to the single canonical row.
--
-- Safety: this ALTER TABLE will fail loudly (with a clear message) instead
-- of silently corrupting data if any duplicate (job_id, asset_id) pairs
-- already exist. If it fails, find them with:
--
--   SELECT job_id, asset_id, COUNT(*), array_agg(id ORDER BY actioned_at DESC NULLS LAST)
--   FROM public.job_assets
--   GROUP BY job_id, asset_id
--   HAVING COUNT(*) > 1;
--
-- ...decide (per row group) which one should remain — normally the one
-- with the latest actioned_at — and re-run this migration once resolved.
-- Do NOT delete the losing rows blindly without checking whether any
-- defects/inspection_photos reference their id first.
--
-- Run this once in the Supabase SQL Editor.
-- ============================================================

DO $$
DECLARE
  dup_count integer;
BEGIN
  SELECT COUNT(*) INTO dup_count FROM (
    SELECT job_id, asset_id
    FROM public.job_assets
    GROUP BY job_id, asset_id
    HAVING COUNT(*) > 1
  ) d;

  IF dup_count > 0 THEN
    RAISE EXCEPTION
      'job_assets has % duplicate (job_id, asset_id) pair(s) — resolve before adding the uniqueness constraint. See this migration''s header comment for the query to find them.',
      dup_count;
  END IF;
END $$;

ALTER TABLE public.job_assets
  ADD CONSTRAINT job_assets_job_asset_unique UNIQUE (job_id, asset_id);
