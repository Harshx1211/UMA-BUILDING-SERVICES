-- ============================================================
-- Migration: enable Realtime + confirm RLS for inspection_photos
-- ============================================================
-- Extends the live-sync feature (lib/sync.ts's subscribeToJobLive) to cover
-- photos, not just job_assets/defects results — a crew-mate attaching a
-- photo to an asset or defect previously only reached other devices on the
-- next background sync tick (up to 60s), same gap the original poll had.
--
-- RLS note: this repo's own migration history (see 20260824020000's own
-- comment) admits inspection_photos' live policy set predates what's
-- tracked here — only two DELETE-scoped policies exist in any migration
-- file. Rather than assume SELECT/INSERT/UPDATE coverage is already
-- correct (the exact assumption that turned out wrong for job_assets/
-- defects — see 20260901020000), this defensively (re)asserts RLS is on
-- and adds a full tenant-isolation policy. Safe either way: Postgres ORs
-- multiple permissive policies for the same command, so this only ever
-- widens access to a technician's own company's rows — it cannot narrow or
-- replace the existing DELETE policies.
--
-- Run this once in the Supabase SQL Editor.
-- ============================================================

CREATE OR REPLACE FUNCTION public.get_user_company_id()
RETURNS uuid
LANGUAGE sql SECURITY DEFINER SET search_path = public
STABLE
AS $$
  SELECT company_id FROM public.users WHERE id = auth.uid();
$$;

ALTER TABLE public.inspection_photos ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "inspection_photos_tenant_isolation" ON public.inspection_photos;
CREATE POLICY "inspection_photos_tenant_isolation" ON public.inspection_photos
  FOR ALL
  USING (company_id = public.get_user_company_id());

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'inspection_photos'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.inspection_photos;
  END IF;
END $$;
