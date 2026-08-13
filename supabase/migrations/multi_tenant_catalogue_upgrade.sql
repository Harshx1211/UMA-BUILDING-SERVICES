-- ============================================================
-- MULTI-TENANT CATALOGUE UPGRADE SCRIPT
-- ============================================================
-- Run this script directly in your Supabase SQL Editor.
-- 
-- What this does:
-- 1. Adds company_id to catalogue tables
-- 2. Makes Unique constraints company-specific (so different companies can have a defect code called "GEN-01")
-- 3. Creates an auto-cloning trigger for new companies
-- 4. Clones the global templates for all currently existing companies
-- 5. Enables strict RLS so companies only see their own private clones

-- 1. Ensure inventory_items table exists
CREATE TABLE IF NOT EXISTS public.inventory_items (
  id          UUID        NOT NULL DEFAULT gen_random_uuid(),
  name        TEXT        NOT NULL,
  description TEXT,
  price       NUMERIC     NOT NULL DEFAULT 0.0,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT inventory_items_pkey PRIMARY KEY (id)
);

-- 2. Add company_id columns
ALTER TABLE public.asset_type_definitions ADD COLUMN IF NOT EXISTS company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE;
ALTER TABLE public.defect_codes           ADD COLUMN IF NOT EXISTS company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE;
ALTER TABLE public.inventory_items        ADD COLUMN IF NOT EXISTS company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE;

-- 3. Update Unique Constraints to be Company-Specific
-- First drop the global unique constraints
ALTER TABLE public.asset_type_definitions DROP CONSTRAINT IF EXISTS asset_type_definitions_value_key;
ALTER TABLE public.defect_codes           DROP CONSTRAINT IF EXISTS defect_codes_code_key;

-- Add scoped unique constraints (Company A and Company B can both have value="extinguisher")
ALTER TABLE public.asset_type_definitions ADD CONSTRAINT asset_type_definitions_company_value_key UNIQUE NULLS NOT DISTINCT (company_id, value);
ALTER TABLE public.defect_codes           ADD CONSTRAINT defect_codes_company_code_key UNIQUE NULLS NOT DISTINCT (company_id, code);


-- 4. Create the cloning logic function
CREATE OR REPLACE FUNCTION public.clone_catalogue_for_company(new_company_id UUID)
RETURNS void AS $$
BEGIN
  -- Clone Asset Types
  INSERT INTO public.asset_type_definitions (
    company_id, value, label, full_label, icon, color, inspection_routine, variants, is_active, sort_order
  )
  SELECT 
    new_company_id, value, label, full_label, icon, color, inspection_routine, variants, is_active, sort_order
  FROM public.asset_type_definitions
  WHERE company_id IS NULL
  ON CONFLICT DO NOTHING;

  -- Clone Defect Codes
  INSERT INTO public.defect_codes (
    company_id, code, description, quote_price, category, is_active, sort_order
  )
  SELECT 
    new_company_id, code, description, quote_price, category, is_active, sort_order
  FROM public.defect_codes
  WHERE company_id IS NULL
  ON CONFLICT DO NOTHING;
  
  -- Clone Inventory Items
  INSERT INTO public.inventory_items (
    company_id, name, description, price
  )
  SELECT 
    new_company_id, name, description, price
  FROM public.inventory_items
  WHERE company_id IS NULL
  ON CONFLICT DO NOTHING;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- 5. Create Trigger for future companies
CREATE OR REPLACE FUNCTION public.on_company_created_catalogue()
RETURNS TRIGGER AS $$
BEGIN
  PERFORM public.clone_catalogue_for_company(NEW.id);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trigger_clone_catalogue ON public.companies;
CREATE TRIGGER trigger_clone_catalogue
AFTER INSERT ON public.companies
FOR EACH ROW EXECUTE FUNCTION public.on_company_created_catalogue();


-- 6. Execute cloning immediately for all CURRENT companies
DO $$
DECLARE
  comp RECORD;
BEGIN
  FOR comp IN SELECT id FROM public.companies LOOP
    PERFORM public.clone_catalogue_for_company(comp.id);
  END LOOP;
END;
$$;


-- 7. Apply Strict Row Level Security (RLS)
ALTER TABLE public.asset_type_definitions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.defect_codes           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inventory_items        ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "asset_types_tenant_isolation" ON public.asset_type_definitions;
CREATE POLICY "asset_types_tenant_isolation" ON public.asset_type_definitions 
  FOR ALL USING (company_id = public.get_user_company_id());

DROP POLICY IF EXISTS "defect_codes_tenant_isolation" ON public.defect_codes;
CREATE POLICY "defect_codes_tenant_isolation" ON public.defect_codes 
  FOR ALL USING (company_id = public.get_user_company_id());

DROP POLICY IF EXISTS "inventory_tenant_isolation" ON public.inventory_items;
CREATE POLICY "inventory_tenant_isolation" ON public.inventory_items 
  FOR ALL USING (company_id = public.get_user_company_id());

-- ============================================================
-- DONE! The platform is now fully multi-tenant for catalogues.
-- ============================================================
