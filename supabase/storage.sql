-- Run this in your Supabase SQL Editor to set up the Phase 6 Storage Bucket
-- It creates the bucket and sets the necessary security policies so the app can upload photos.

-- 1. Create the 'job-photos' bucket and make it public
INSERT INTO storage.buckets (id, name, public)
VALUES ('job-photos', 'job-photos', true)
ON CONFLICT (id) DO NOTHING;

-- 2. Allow authenticated users to upload files to this bucket
CREATE POLICY "Authenticated users can upload photos"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK ( bucket_id = 'job-photos' );

-- 3. Allow anyone to view the photos (Required for image URLs to load in the app)
CREATE POLICY "Anyone can view photos"
ON storage.objects FOR SELECT
USING ( bucket_id = 'job-photos' );

-- 4. Allow users to update (or overwrite) files if needed
CREATE POLICY "Authenticated users can update photos"
ON storage.objects FOR UPDATE
TO authenticated
USING ( bucket_id = 'job-photos' );
