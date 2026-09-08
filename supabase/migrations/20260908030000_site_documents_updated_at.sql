-- ============================================================
-- Migration: add updated_at to site_documents
-- ============================================================
-- site_documents never had an updated_at column, so the mobile sync
-- engine's anti-clobber check (_shouldPreserveLocalRow, lib/sync.ts) had no
-- way to tell a fresh local rename apart from a stale server echo/pull of
-- the pre-rename row — a rename could be silently reverted. Same reasoning
-- as assets.updated_at (added directly via the app's own local-SQLite
-- migration 41; this is the equivalent for the server-side column).
--
-- Run this once in the Supabase SQL Editor.
-- ============================================================

ALTER TABLE public.site_documents ADD COLUMN IF NOT EXISTS updated_at timestamp with time zone;
