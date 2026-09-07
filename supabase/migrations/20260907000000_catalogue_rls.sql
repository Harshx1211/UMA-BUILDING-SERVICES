-- ============================================================
-- Migration: restore missing RLS on the catalogue reference tables
-- ============================================================
-- asset_type_definitions, defect_codes, and inventory_items have NO row-
-- level security at all today — found while auditing for cross-tenant data
-- leaks. Same regression pattern already fixed once for job_assets/defects
-- (see 20260901020000_job_assets_defects_rls.sql): a table was created
-- without ever getting a tenant-isolation policy attached.
--
-- Impact: any authenticated user, from any company, can currently read
-- (and write) every OTHER company's custom defect codes, asset type
-- definitions/pricing, and inventory item pricing via a plain
-- `select('*')` — not just merged locally on a reused device, but exposed
-- directly from the server regardless of which client asks.
--
-- These three tables allow a NULL company_id by design — that's the
-- platform's global template, copied into a brand-new company's own rows
-- by a SECURITY DEFINER trigger on company creation (see
-- 20260829000000_auto_seed_company_catalogue.sql), which bypasses RLS
-- regardless of policy. Every real company already has its own full
-- company_id-scoped clone, so no authenticated technician needs to see the
-- NULL-company_id template directly — the same strict
-- `company_id = get_user_company_id()` policy already used everywhere else
-- in this schema is correct here too.
--
-- Confirmed safe: the admin dashboard and report-generator service access
-- these tables via a service-role client, which bypasses RLS regardless of
-- policy content.
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

ALTER TABLE public.asset_type_definitions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.defect_codes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inventory_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "asset_type_definitions_tenant_isolation" ON public.asset_type_definitions;
CREATE POLICY "asset_type_definitions_tenant_isolation" ON public.asset_type_definitions
  FOR ALL
  USING (company_id = public.get_user_company_id());

DROP POLICY IF EXISTS "defect_codes_tenant_isolation" ON public.defect_codes;
CREATE POLICY "defect_codes_tenant_isolation" ON public.defect_codes
  FOR ALL
  USING (company_id = public.get_user_company_id());

DROP POLICY IF EXISTS "inventory_items_tenant_isolation" ON public.inventory_items;
CREATE POLICY "inventory_items_tenant_isolation" ON public.inventory_items
  FOR ALL
  USING (company_id = public.get_user_company_id());
