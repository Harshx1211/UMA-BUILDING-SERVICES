-- ============================================================
-- Migration: make the job-photos Storage bucket private + add its RLS policy
-- ============================================================
-- job-photos was created out-of-band via the dashboard at some point (like
-- job-reports originally was) — no migration for it ever existed in this
-- repo, so neither prior security audit caught it: it's the exact same
-- "public bucket, obscure-but-guessable filename, no real access control"
-- problem already found and fixed for site-documents
-- (20260916000000_site_documents_bucket_private.sql). Object path is
-- jobs/{jobId}/{timestamp}-{random}.jpg (lib/photoUpload.ts's uploadPhoto()).
--
-- Unlike site-documents (which moved to sign-on-read, since documents are
-- viewed rarely via an explicit tap), photos are shown in dense grids all
-- over both apps — the app-side fix instead signs each photo with a
-- long-lived (10-year) URL at UPLOAD time (lib/photoUpload.ts) so every
-- existing `<Image source={{uri: photo_url}}>` call site keeps working
-- completely unchanged. The admin dashboard additionally re-signs on every
-- read regardless of what's stored (admin/src/lib/signPhotoUrls.ts), so it
-- self-heals even for a photo whose stored URL is somehow stale.
--
-- Existing rows uploaded before this fix still hold their OLD permanent
-- public URL, which will break the moment this bucket goes private — run
-- supabase/scripts/backfill_photo_signed_urls.js once, after this
-- migration, to re-sign every one of them.
--
-- Run this once in the Supabase SQL Editor, THEN run the backfill script.
-- ============================================================

UPDATE storage.buckets SET public = false WHERE id = 'job-photos';

DROP POLICY IF EXISTS "job_photos_company_insert" ON storage.objects;
CREATE POLICY "job_photos_company_insert" ON storage.objects
  FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'job-photos'
    AND EXISTS (
      SELECT 1
      FROM public.jobs j
      JOIN public.users u ON u.company_id = j.company_id
      WHERE u.id = auth.uid()
        AND j.id::text = split_part(storage.objects.name, '/', 2)
    )
  );

-- Uploads send x-upsert: true (see photoUpload.ts) — Supabase evaluates the
-- UPDATE policy whenever an object at that path already exists, same
-- reasoning as site_documents_company_update.
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
    AND EXISTS (
      SELECT 1
      FROM public.jobs j
      JOIN public.users u ON u.company_id = j.company_id
      WHERE u.id = auth.uid()
        AND j.id::text = split_part(storage.objects.name, '/', 2)
    )
  );

DROP POLICY IF EXISTS "job_photos_company_read" ON storage.objects;
CREATE POLICY "job_photos_company_read" ON storage.objects
  FOR SELECT
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
  );

DROP POLICY IF EXISTS "job_photos_company_delete" ON storage.objects;
CREATE POLICY "job_photos_company_delete" ON storage.objects
  FOR DELETE
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
  );
