-- ============================================================
-- Migration: restore missing RLS on job_assets + defects
-- ============================================================
-- These two tables currently have NO row-level security at all — found
-- while verifying the Realtime live-sync feature (which needs RLS enabled
-- to push events to a normal app client). This is a regression, not a new
-- design: the app's own write code already defends against RLS being
-- enforced here (see store/inspectionStore.ts's "FIX: inject company_id
-- for RLS on job_assets INSERT/UPDATE" and store/defectsStore.ts's two
-- equivalent comments), and a snapshot of now-deleted migrations
-- (docs/EXHAUSTIVE_CODEBASE_REFERENCE.md) shows both tables used to carry
-- exactly this policy. Three currently-live sibling tables
-- (job_technicians, asset_tags, site_documents) already use this identical
-- pattern successfully today.
--
-- Confirmed safe: the admin dashboard and the report-generator service
-- both access these tables exclusively via a service-role client, which
-- bypasses RLS regardless of policy content — only the mobile app's
-- authenticated-role session is affected, and it already sends the correct
-- company_id on every write.
--
-- Run this once in the Supabase SQL Editor.
-- ============================================================

-- Defensive — recreates the lookup function every other tenant-isolation
-- policy in this schema already depends on, in case it's ever missing.
-- Identical definition to the one already live.
CREATE OR REPLACE FUNCTION public.get_user_company_id()
RETURNS uuid
LANGUAGE sql SECURITY DEFINER SET search_path = public
STABLE
AS $$
  SELECT company_id FROM public.users WHERE id = auth.uid();
$$;

ALTER TABLE public.job_assets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.defects ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "job_assets_tenant_isolation" ON public.job_assets;
CREATE POLICY "job_assets_tenant_isolation" ON public.job_assets
  FOR ALL
  USING (company_id = public.get_user_company_id());

DROP POLICY IF EXISTS "defects_tenant_isolation" ON public.defects;
CREATE POLICY "defects_tenant_isolation" ON public.defects
  FOR ALL
  USING (company_id = public.get_user_company_id());
