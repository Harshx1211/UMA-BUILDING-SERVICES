-- ============================================================
-- Migration: defects.resolved_on_site — a small informational flag a
-- technician can set when they've already fixed something themselves
-- during the visit (e.g. replaced a dead smoke-alarm battery), so there's
-- no quote/approval to wait on. Mobile side: lib/database.ts migration 47.
--
-- Deliberately orthogonal to `status`/pricing, which stay admin-only
-- exactly as before — nothing reads this flag to change access control,
-- it's purely a scannable signal for whoever reviews the defect next.
--
-- Run this once in the Supabase SQL Editor.
-- ============================================================

ALTER TABLE public.defects ADD COLUMN IF NOT EXISTS resolved_on_site boolean NOT NULL DEFAULT false;
