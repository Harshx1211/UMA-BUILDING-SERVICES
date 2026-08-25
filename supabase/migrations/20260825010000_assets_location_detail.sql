-- ============================================================
-- Migration: assets.location_detail — free-text extra detail, separate
-- from the structured location code
-- ============================================================
-- location_on_site now holds a structured, technician-picked code (e.g.
-- "1-1-1" for Tower 1 / Floor 1 / Unit 1, or "1-CR" for a common area) so
-- that grouping/filtering by unit matches reliably. That structure means
-- there's no longer room in location_on_site for incidental free-text
-- notes ("near the fire exit", "storage room"), so this column holds that
-- instead — purely additive, nullable, does not participate in any
-- grouping/matching logic. No RLS changes needed (assets' existing
-- tenant-isolation policy already covers this column like any other).
--
-- Run this once in the Supabase SQL Editor.
-- ============================================================

ALTER TABLE public.assets
  ADD COLUMN IF NOT EXISTS location_detail text;
