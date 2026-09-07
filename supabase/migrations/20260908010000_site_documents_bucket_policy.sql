-- ============================================================
-- Migration: site-documents Storage bucket access policy
-- ============================================================
-- The 20260901000000_site_documents.sql migration created the
-- `site-documents` bucket itself but never added a storage.objects RLS
-- policy for it — unlike `job-reports` (20260822040000_job_reports_bucket_policy.sql),
-- which documents that its policy already existed, set up out-of-band via
-- the dashboard. No equivalent was ever created here, so every document
-- scan's upload (lib/documentUpload.ts's uploadDocument(), which PUTs
-- directly to Storage using the technician's own session token, never a
-- service-role key) has been hitting Postgres's default-deny RLS on
-- storage.objects and failing outright. The failure is silent in the UI —
-- documentUpload.ts's processDocumentQueue() just retries (up to 5 times,
-- lib/documentUpload.ts's MAX_DOCUMENT_RETRIES) then abandons the task,
-- leaving the document stuck showing "Uploading…" in DocumentCard forever
-- with no local indication of *why*.
--
-- The bucket is public (public: true) so the eventual read (Sharing/Linking
-- to the public URL) never touched RLS at all — this is why the gap wasn't
-- obvious from reading the client code alone.
--
-- Run this once in the Supabase SQL Editor.
-- ============================================================

-- Object path is properties/{propertyId}/{timestamp}-{random}.pdf
-- (lib/documentUpload.ts's uploadDocument()) — same shape as job-reports'
-- own policy, just keyed off property_id (segment 2) instead of a job id.

DROP POLICY IF EXISTS "site_documents_company_insert" ON storage.objects;
CREATE POLICY "site_documents_company_insert" ON storage.objects
  FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'site-documents'
    AND EXISTS (
      SELECT 1
      FROM public.properties p
      JOIN public.users u ON u.company_id = p.company_id
      WHERE u.id = auth.uid()
        AND p.id::text = split_part(storage.objects.name, '/', 2)
    )
  );

-- Uploads always use a fresh, unique filename (timestamp + random suffix),
-- so a real collision is essentially impossible — but the client sends
-- `x-upsert: true` on every PUT, and Supabase's upsert semantics evaluate
-- the UPDATE policy whenever an object at that path already exists. Without
-- this, a would-be-rare collision fails with the same silent stuck-upload
-- symptom as the missing INSERT policy above.
DROP POLICY IF EXISTS "site_documents_company_update" ON storage.objects;
CREATE POLICY "site_documents_company_update" ON storage.objects
  FOR UPDATE
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
  )
  WITH CHECK (
    bucket_id = 'site-documents'
    AND EXISTS (
      SELECT 1
      FROM public.properties p
      JOIN public.users u ON u.company_id = p.company_id
      WHERE u.id = auth.uid()
        AND p.id::text = split_part(storage.objects.name, '/', 2)
    )
  );

-- Authenticated read scoped to the technician's own company — the bucket's
-- own `public: true` flag already lets anyone read via the public URL, so
-- this only matters for any future signed-URL/listing use of this bucket
-- that goes through RLS instead. Harmless, and matches job_reports_company_read's
-- own belt-and-braces reasoning.
DROP POLICY IF EXISTS "site_documents_company_read" ON storage.objects;
CREATE POLICY "site_documents_company_read" ON storage.objects
  FOR SELECT
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
