-- ============================================================
-- Migration: job_assets.actioned_by — who inspected this asset
-- ============================================================
-- job_assets already records WHEN an asset was actioned (actioned_at) and
-- WHAT the result was, but not WHO did it — there was no way to tell which
-- technician on a multi-tech job inspected a given asset. Purely additive:
-- a nullable column, no backfill possible (no historical record of who
-- actioned existing rows), no RLS changes needed (job_assets' existing
-- tenant-isolation policy already covers this column like any other).
--
-- Run this once in the Supabase SQL Editor.
-- ============================================================

ALTER TABLE public.job_assets
  ADD COLUMN IF NOT EXISTS actioned_by uuid REFERENCES public.users(id);

CREATE INDEX IF NOT EXISTS idx_job_assets_actioned_by ON public.job_assets(actioned_by);
