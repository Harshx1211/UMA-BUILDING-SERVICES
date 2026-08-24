-- ============================================================
-- Migration: job_technicians — many-to-many job assignment
-- ============================================================
-- Phase 1 of moving jobs from a single `assigned_to` technician to a flat
-- list of assigned technicians (no "primary"). This migration is purely
-- additive — it does NOT touch jobs.assigned_to, its FK, or the existing
-- `photos_delete_via_job` RLS policy on inspection_photos. Every existing
-- code path (mobile sync, PDF reports, admin job lists) keeps reading
-- assigned_to exactly as before and is unaffected by this migration.
--
-- Rationale for going additive-first rather than replacing assigned_to in
-- one shot: the live RLS policy set for this project isn't fully tracked in
-- this repo (verified — the one assigned_to-based policy, the DELETE policy
-- on inspection_photos below, only survives in a generated doc snapshot of
-- already-deleted migrations, not in any file here). Rewriting or dropping
-- a policy without being able to see its current live definition is exactly
-- the kind of change that should never be done blind. Phase 2 (switching
-- every consumer to read job_technicians instead of assigned_to, then
-- retiring assigned_to and its policy) is a deliberate follow-up once this
-- table is confirmed working in production.
--
-- Run this once in the Supabase SQL Editor.
-- ============================================================

CREATE TABLE IF NOT EXISTS public.job_technicians (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL,
  job_id uuid NOT NULL,
  user_id uuid NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT job_technicians_pkey PRIMARY KEY (id),
  CONSTRAINT job_technicians_company_id_fkey FOREIGN KEY (company_id) REFERENCES public.companies(id),
  CONSTRAINT job_technicians_job_id_fkey FOREIGN KEY (job_id) REFERENCES public.jobs(id) ON DELETE CASCADE,
  CONSTRAINT job_technicians_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id),
  -- Same tech can't be added to the same job twice.
  CONSTRAINT job_technicians_job_user_unique UNIQUE (job_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_job_technicians_job_id  ON public.job_technicians(job_id);
CREATE INDEX IF NOT EXISTS idx_job_technicians_user_id ON public.job_technicians(user_id);

ALTER TABLE public.job_technicians ENABLE ROW LEVEL SECURITY;

-- Matches the tenant-isolation pattern used by every other table
-- (company_id = public.get_user_company_id()) — see jobs_tenant_isolation,
-- job_assets_tenant_isolation, etc.
DROP POLICY IF EXISTS "job_technicians_tenant_isolation" ON public.job_technicians;
CREATE POLICY "job_technicians_tenant_isolation" ON public.job_technicians
  FOR ALL
  USING (company_id = public.get_user_company_id());

-- Backfill: every existing job's current single assignee becomes a row
-- here too, so no job starts out with an empty crew list.
INSERT INTO public.job_technicians (company_id, job_id, user_id)
SELECT company_id, id, assigned_to FROM public.jobs
ON CONFLICT (job_id, user_id) DO NOTHING;

-- Additive-only grant: a technician who's assigned via job_technicians but
-- is NOT (yet) jobs.assigned_to can still delete their own uploaded photos
-- on that job. This does not replace or narrow the existing
-- photos_delete_via_job policy — Postgres OR's multiple permissive
-- policies for the same command, so this only ever grants additional
-- access, never revokes what already worked.
DROP POLICY IF EXISTS "photos_delete_via_job_technicians" ON public.inspection_photos;
CREATE POLICY "photos_delete_via_job_technicians" ON public.inspection_photos
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.job_technicians jt
      WHERE jt.job_id = inspection_photos.job_id
        AND jt.user_id = auth.uid()
    )
  );
