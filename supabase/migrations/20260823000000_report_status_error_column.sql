-- ============================================================
-- Migration: last_error column on report_generation_status
-- ============================================================
-- Supports the async report-generation flow: the mobile app now gets an
-- immediate "accepted, generating" response and polls a status endpoint
-- instead of holding one HTTP request open for the entire generation (which
-- was fragile on mobile networks for large/slow jobs). This column lets a
-- failed generation surface a real reason to the app instead of a generic
-- "something went wrong".
--
-- Run this once in the Supabase SQL Editor.
-- ============================================================

ALTER TABLE public.report_generation_status ADD COLUMN IF NOT EXISTS last_error text;
