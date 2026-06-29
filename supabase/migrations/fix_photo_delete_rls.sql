-- ============================================================
-- UMA BUILDING SERVICES — Fix: Missing DELETE RLS on inspection_photos
-- ============================================================
-- ROOT CAUSE: The inspection_photos table had SELECT and INSERT
-- policies but NO DELETE policy.  Supabase silently blocked every
-- delete from the mobile app, causing the sync retry counter to
-- exhaust after 5 attempts.  After that, the photo stayed in
-- Supabase forever and reappeared on every reinstall / pull.
--
-- Run this ONCE in your Supabase → SQL Editor.
-- ============================================================

-- 1. Add the missing DELETE policy ──────────────────────────
--    Allows the technician to delete photos for jobs assigned to them.
CREATE POLICY "photos_delete_via_job" ON public.inspection_photos
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM public.jobs j
      WHERE j.id = job_id
        AND j.assigned_to = auth.uid()
    )
  );


-- 2. Add defect_id column if not present (Migration 7) ─────
--    Safe to run — ALTER TABLE ADD COLUMN is idempotent with the catch below.
DO $$
BEGIN
  ALTER TABLE public.inspection_photos ADD COLUMN defect_id UUID
    REFERENCES public.defects(id) ON DELETE SET NULL;
EXCEPTION
  WHEN duplicate_column THEN NULL;
END $$;


-- 3. Verify the policy was created ──────────────────────────
SELECT policyname, cmd
FROM pg_policies
WHERE tablename = 'inspection_photos'
ORDER BY policyname;
