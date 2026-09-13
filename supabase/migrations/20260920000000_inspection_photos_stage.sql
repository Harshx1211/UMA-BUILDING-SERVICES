-- ============================================================
-- Migration: inspection_photos.stage — before/after tagging for a
-- defect's own photos (mobile side: lib/database.ts migration 46).
-- Null means "not staged": every pre-existing row, and every general
-- (non-defect) asset photo, which has no before/after concept at all.
--
-- RLS is unaffected — inspection_photos' tenant-isolation policy is
-- row-level, not column-level.
--
-- Run this once in the Supabase SQL Editor.
-- ============================================================

ALTER TABLE public.inspection_photos ADD COLUMN IF NOT EXISTS stage text;

ALTER TABLE public.inspection_photos DROP CONSTRAINT IF EXISTS inspection_photos_stage_check;
ALTER TABLE public.inspection_photos ADD CONSTRAINT inspection_photos_stage_check
  CHECK (stage IS NULL OR stage = ANY (ARRAY['before'::text, 'after'::text]));
