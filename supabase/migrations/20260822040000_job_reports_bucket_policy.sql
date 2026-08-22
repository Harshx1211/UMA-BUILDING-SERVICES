-- ============================================================
-- Migration: job-reports Storage bucket + access policy (documentation)
-- ============================================================
-- The `job-reports` private bucket already exists in production — it was
-- configured directly via the Supabase dashboard/SQL editor at some point,
-- with no migration ever committed for it (verified: no such migration
-- exists anywhere in git history for this repo). That's not reproducible, so
-- this migration captures it properly going forward.
--
-- This is written defensively (IF NOT EXISTS / DROP POLICY IF EXISTS) so it's
-- safe to run even though the bucket and an equivalent policy most likely
-- already exist out-of-band — the mobile app's client-side signed-URL refresh
-- (lib/pdfGenerator.ts -> getOrRefreshReportUrl) already works today, which
-- would not be possible without SOME such policy already in place.
--
-- Run this once in the Supabase SQL Editor.
-- ============================================================

INSERT INTO storage.buckets (id, name, public)
VALUES ('job-reports', 'job-reports', false)
ON CONFLICT (id) DO NOTHING;

-- Authenticated users may read (and therefore sign a download URL for) a
-- report belonging to a job in their own company. Object name is the job id
-- with a .pdf extension (see services/report-generator/src/storage.ts).
DROP POLICY IF EXISTS "job_reports_company_read" ON storage.objects;
CREATE POLICY "job_reports_company_read" ON storage.objects
  FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'job-reports'
    AND EXISTS (
      SELECT 1
      FROM public.jobs j
      JOIN public.users u ON u.company_id = j.company_id
      WHERE u.id = auth.uid()
        AND j.id::text = split_part(storage.objects.name, '.', 1)
    )
  );
