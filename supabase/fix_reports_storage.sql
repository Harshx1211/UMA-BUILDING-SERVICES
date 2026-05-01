-- 1. Create the 'job-reports' bucket and make it public (if not already exists)
INSERT INTO storage.buckets (id, name, public)
VALUES ('job-reports', 'job-reports', true)
ON CONFLICT (id) DO NOTHING;

-- 2. Allow authenticated users to upload files to this bucket
CREATE POLICY "Authenticated users can upload reports"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK ( bucket_id = 'job-reports' );

-- 3. Allow anyone to view the reports (Required for URLs to load)
CREATE POLICY "Anyone can view reports"
ON storage.objects FOR SELECT
USING ( bucket_id = 'job-reports' );

-- 4. Allow users to update (or overwrite) files
CREATE POLICY "Authenticated users can update reports"
ON storage.objects FOR UPDATE
TO authenticated
USING ( bucket_id = 'job-reports' );

-- 5. Allow users to delete files (useful for cleanup)
CREATE POLICY "Authenticated users can delete reports"
ON storage.objects FOR DELETE
TO authenticated
USING ( bucket_id = 'job-reports' );
