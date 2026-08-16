-- Migration: Add missing columns to signatures table
-- ============================================================
-- Both columns exist in the local SQLite schema (added in migrations
-- 19 and 23 respectively) but were never applied to Supabase.
-- This causes every signature sync to permanently fail with:
--   "Could not find the 'device_info' column of 'signatures' in the schema cache"

-- tech_signature_url: Stores the technician's own captured signature.
-- AS1851-2012 compliance requires BOTH a client signature AND a technician
-- sign-off on every completed inspection report. Without this column,
-- the technician's signature is captured on-device but never uploaded.
ALTER TABLE public.signatures
  ADD COLUMN IF NOT EXISTS tech_signature_url text;

-- device_info: Audit trail metadata recording which platform (iOS/Android)
-- the signature was captured on. Required for legal/compliance evidence.
ALTER TABLE public.signatures
  ADD COLUMN IF NOT EXISTS device_info text;
