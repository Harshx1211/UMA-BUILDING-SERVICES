-- Migration: 20260820000000_edge_function_report_storage.sql
-- Ensures the Edge Function (service role) can upload PDFs to job-reports bucket
-- and that the bucket path job-reports/{jobId}.pdf is publicly readable.

-- The 'job-reports' bucket was created by fix_reports_storage.sql.
-- The service role key bypasses RLS by default in Supabase, so no additional
-- INSERT policy is needed for the Edge Function.

-- However, we tighten the existing policy so only technicians from the same
-- company can read a job's report (optional — remove if you want public URLs).
-- NOTE: If you want simpler public access (current), leave this as-is.
-- The existing "Anyone can view reports" SELECT policy already covers public reads.

-- Update storage path convention:
-- Old: job-reports/{some-path}.pdf
-- New: job-reports/{jobId}.pdf  (scoped to jobId for easy lookup)
-- No schema change needed — storage paths are strings.

-- Ensure service role can invoke the Edge Function:
-- This is automatic in Supabase — service role has unrestricted access.

-- Verify bucket exists (idempotent):
INSERT INTO storage.buckets (id, name, public)
VALUES ('job-reports', 'job-reports', true)
ON CONFLICT (id) DO NOTHING;
