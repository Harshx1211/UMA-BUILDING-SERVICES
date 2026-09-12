-- ============================================================
-- Migration: job_assets.internal_notes — a second per-visit free-text
-- field alongside technician_notes ("Remarks"), available regardless of
-- PASS/FAIL/NOT_TESTED just like Remarks is. Unlike Remarks, this one is
-- deliberately never read by the report-generator service (see its
-- fetchReportData.ts/types.ts — this column is not present in either),
-- so it can never appear in a client-facing PDF. Team-internal
-- communication only (visible in-app to technicians and in the admin
-- dashboard's Assets tab / audit Timeline).
--
-- Resets to blank every new job like Remarks does — a deliberate choice
-- (not carried forward from the previous visit's job_assets row) so
-- anything worth keeping long-term goes in Timeline history instead of
-- a field that would otherwise need active copying-forward.
-- ============================================================

ALTER TABLE public.job_assets ADD COLUMN IF NOT EXISTS internal_notes text;

-- Run this once in the Supabase SQL Editor.
