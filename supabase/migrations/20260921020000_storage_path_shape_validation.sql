-- ============================================================
-- Migration: validate the FULL object-name shape on new Storage writes,
-- not just the ownership segment
-- ============================================================
-- job_photos_company_insert/update (20260918000000) and
-- site_documents_company_insert/update (20260908010000) both authorize a
-- write purely by checking that split_part(name, '/', 2) matches a
-- job/property id owned by the caller's own company. That ownership check
-- is the real security boundary and is NOT weakened by anything below — a
-- caller can never make it succeed for another company's job/property no
-- matter what the rest of the path looks like. What it does NOT check is
-- the rest of the shape: a still-authenticated, still-same-company caller
-- could today write to a path with a missing/extra segment (e.g. just
-- "jobs/{ownJobId}", or "jobs/{ownJobId}/sub/dir/x.jpg"), which the app
-- itself never produces (lib/photoUpload.ts / lib/documentUpload.ts always
-- write "jobs/{jobId}/{file}.jpg" and "properties/{propertyId}/{file}.pdf")
-- and which downstream code that assumes the 3-segment shape (URL signing,
-- path parsing) was never written to tolerate.
--
-- This adds a regex check for the full shape to the INSERT/UPDATE
-- policies only — SELECT/DELETE are deliberately left untouched so any
-- pre-existing object (including ones from before this app used UUID
-- filenames) stays readable/removable regardless of its exact filename
-- text; only NEW writes are required to match the shape.
--
-- Run this once in the Supabase SQL Editor.
-- ============================================================

DROP POLICY IF EXISTS "job_photos_company_insert" ON storage.objects;
CREATE POLICY "job_photos_company_insert" ON storage.objects
  FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'job-photos'
    AND storage.objects.name ~ '^jobs/[^/]+/[^/]+\.jpg$'
    AND EXISTS (
      SELECT 1
      FROM public.jobs j
      JOIN public.users u ON u.company_id = j.company_id
      WHERE u.id = auth.uid()
        AND j.id::text = split_part(storage.objects.name, '/', 2)
    )
  );

DROP POLICY IF EXISTS "job_photos_company_update" ON storage.objects;
CREATE POLICY "job_photos_company_update" ON storage.objects
  FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'job-photos'
    AND EXISTS (
      SELECT 1
      FROM public.jobs j
      JOIN public.users u ON u.company_id = j.company_id
      WHERE u.id = auth.uid()
        AND j.id::text = split_part(storage.objects.name, '/', 2)
    )
  )
  WITH CHECK (
    bucket_id = 'job-photos'
    AND storage.objects.name ~ '^jobs/[^/]+/[^/]+\.jpg$'
    AND EXISTS (
      SELECT 1
      FROM public.jobs j
      JOIN public.users u ON u.company_id = j.company_id
      WHERE u.id = auth.uid()
        AND j.id::text = split_part(storage.objects.name, '/', 2)
    )
  );

DROP POLICY IF EXISTS "site_documents_company_insert" ON storage.objects;
CREATE POLICY "site_documents_company_insert" ON storage.objects
  FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'site-documents'
    AND storage.objects.name ~ '^properties/[^/]+/[^/]+\.pdf$'
    AND EXISTS (
      SELECT 1
      FROM public.properties p
      JOIN public.users u ON u.company_id = p.company_id
      WHERE u.id = auth.uid()
        AND p.id::text = split_part(storage.objects.name, '/', 2)
    )
  );

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
    AND storage.objects.name ~ '^properties/[^/]+/[^/]+\.pdf$'
    AND EXISTS (
      SELECT 1
      FROM public.properties p
      JOIN public.users u ON u.company_id = p.company_id
      WHERE u.id = auth.uid()
        AND p.id::text = split_part(storage.objects.name, '/', 2)
    )
  );
