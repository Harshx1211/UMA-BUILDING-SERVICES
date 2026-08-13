-- ============================================================
-- AIRTIGHT MULTI-TENANT ISOLATION PATCH FOR CATALOGUE
-- ============================================================
-- Run this in your Supabase SQL Editor.
-- It adds company_id to the catalogue tables (asset_type_definitions, 
-- defect_codes, inventory_items) so each tenant has their own catalogue.

-- 1. Create inventory_items table if it was missed previously
CREATE TABLE IF NOT EXISTS public.inventory_items (
  id          UUID        NOT NULL DEFAULT gen_random_uuid(),
  name        TEXT        NOT NULL,
  description TEXT,
  price       NUMERIC     NOT NULL DEFAULT 0.0,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT inventory_items_pkey PRIMARY KEY (id)
);

-- 2. Add company_id columns
ALTER TABLE public.asset_type_definitions ADD COLUMN IF NOT EXISTS company_id UUID REFERENCES public.companies(id);
ALTER TABLE public.defect_codes ADD COLUMN IF NOT EXISTS company_id UUID REFERENCES public.companies(id);
ALTER TABLE public.inventory_items ADD COLUMN IF NOT EXISTS company_id UUID REFERENCES public.companies(id);

-- 3. Enable RLS
ALTER TABLE public.asset_type_definitions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.defect_codes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inventory_items ENABLE ROW LEVEL SECURITY;

-- 4. Create airtight policies
DROP POLICY IF EXISTS "asset_types_tenant_isolation" ON public.asset_type_definitions;
CREATE POLICY "asset_types_tenant_isolation" ON public.asset_type_definitions 
  FOR ALL USING (company_id = public.get_user_company_id());

DROP POLICY IF EXISTS "defect_codes_tenant_isolation" ON public.defect_codes;
CREATE POLICY "defect_codes_tenant_isolation" ON public.defect_codes 
  FOR ALL USING (company_id = public.get_user_company_id());

DROP POLICY IF EXISTS "inventory_tenant_isolation" ON public.inventory_items;
CREATE POLICY "inventory_tenant_isolation" ON public.inventory_items 
  FOR ALL USING (company_id = public.get_user_company_id());

-- Note: Because we added company_id to these tables, the old seeded data 
-- (which has company_id = NULL) will be invisible to all companies. 
-- In a real multi-tenant system, you should seed default catalogue items 
-- for a company whenever a new company is created!
