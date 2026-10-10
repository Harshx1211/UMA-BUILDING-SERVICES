-- ============================================================
-- Migration: remove cross-tenant Storage policies
-- ============================================================
-- CRITICAL. Running 20261010000000 printed every storage.objects policy
-- left in the live database. Thirteen of them — all created by hand in the
-- dashboard, none recorded in this repo — check ONLY the bucket, never the
-- company. Permissive policies are OR'd together, so each one on its own
-- overrides the careful company-scoped policies below it, letting ANY
-- signed-in user of ANY company:
--   job-reports: upload, overwrite and delete any company's report PDFs
--   job-photos:  read, upload, overwrite and delete any company's photos
-- (tenant_photos_* look company-scoped but aren't: "my own user id is in my
-- own company's user list" is true for every signed-in user, and nothing
-- ties the object path to that company.)
--
-- What legitimately needs Storage access, checked against the code
-- 2026-10-10 — every path below is covered by a policy that stays:
--   - App photo upload/read/re-sign/delete: jobs/<jobId>/<uuid>.jpg
--     (lib/photoUpload.ts, lib/sync.ts) -> job_photos_company_*
--   - App report viewing: <jobId>.pdf (lib/pdfGenerator.ts createSignedUrl)
--     -> job_reports_company_read
--   - Report writing: the report service only, with the service role key,
--     which bypasses RLS — no user-facing write policy is needed at all
--   - App document upload/read: properties/<propertyId>/<uuid>.pdf
--     (lib/documentUpload.ts) -> site_documents_company_*
--   - Admin portal: service role (bypasses RLS)
--   - Signatures are stored in the database, not Storage (the
--     job-photos/signatures/ folder only holds a placeholder).
--
-- Run the whole file in the Supabase SQL Editor; the final grid shows every
-- storage.objects policy that remains — it should be exactly the 9
-- company-scoped ones (job_photos_company_* x4, job_reports_company_read,
-- site_documents_company_* x4).
-- ============================================================

-- job-reports: users never write reports (the service role does) and
-- reading is covered by job_reports_company_read.
DROP POLICY IF EXISTS "Authenticated users can delete reports" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can update reports" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can upload reports" ON storage.objects;
DROP POLICY IF EXISTS "reports_insert_auth" ON storage.objects;

-- job-photos: everything is covered by job_photos_company_{insert,read,update,delete}.
DROP POLICY IF EXISTS "Authenticated users can update photos" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can upload photos" ON storage.objects;
DROP POLICY IF EXISTS "auth_delete_job_photos" ON storage.objects;
DROP POLICY IF EXISTS "auth_read_job_photos" ON storage.objects;
DROP POLICY IF EXISTS "auth_update_job_photos" ON storage.objects;
DROP POLICY IF EXISTS "auth_upload_job_photos" ON storage.objects;
DROP POLICY IF EXISTS "tenant_photos_delete" ON storage.objects;
DROP POLICY IF EXISTS "tenant_photos_insert" ON storage.objects;
DROP POLICY IF EXISTS "tenant_photos_select" ON storage.objects;

-- site-documents had no DELETE policy at all, so the app's own cleanup of a
-- deleted document's PDF (lib/sync.ts, Delete branch) was always denied and
-- left the file behind. Same company check as site_documents_company_read.
DROP POLICY IF EXISTS "site_documents_company_delete" ON storage.objects;
CREATE POLICY "site_documents_company_delete" ON storage.objects
  FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'site-documents'
    AND EXISTS (
      SELECT 1
      FROM public.properties p
      JOIN public.users u ON u.company_id = p.company_id
      WHERE u.id = auth.uid()
        AND p.id::text = split_part(storage.objects.name, '/', 2)
    )
  );

-- What remains (should be exactly the 9 company-scoped policies):
SELECT policyname, roles::text, cmd
FROM pg_policies
WHERE schemaname = 'storage' AND tablename = 'objects'
ORDER BY policyname;
