-- ============================================================
-- Migration: auto-seed a new company's catalogue from the global defaults
-- ============================================================
-- Right now, DK12/RKP Fire Compliance/UMA Building Compliance each have an
-- exact duplicate of the global (company_id IS NULL) asset_type_definitions
-- and defect_codes rows — someone copied them in manually. There's no
-- signup/company-creation code anywhere in either app (companies are
-- created directly via SQL today), so there was never a code path to hook
-- an "auto-copy defaults" step into.
--
-- A trigger fixes this at the database level instead: it fires on every
-- INSERT into companies, regardless of how that insert happens (manual SQL
-- now, an admin UI action or real signup flow later — doesn't matter), and
-- copies whatever the CURRENT global catalogue is into the new company's
-- own company_id. From that point on it's the new company's own editable
-- copy, exactly like DK12/RKP/UMA's today — editing it never touches the
-- global rows or any other company.
--
-- Run this once in the Supabase SQL Editor.
-- ============================================================

CREATE OR REPLACE FUNCTION public.seed_default_catalogue_for_new_company()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.asset_type_definitions
    (company_id, value, label, full_label, icon, color, inspection_routine, variants, is_active, sort_order)
  SELECT NEW.id, value, label, full_label, icon, color, inspection_routine, variants, is_active, sort_order
  FROM public.asset_type_definitions
  WHERE company_id IS NULL;

  INSERT INTO public.defect_codes
    (company_id, code, description, quote_price, category, is_active, sort_order)
  SELECT NEW.id, code, description, quote_price, category, is_active, sort_order
  FROM public.defect_codes
  WHERE company_id IS NULL;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS trg_seed_default_catalogue_for_new_company ON public.companies;
CREATE TRIGGER trg_seed_default_catalogue_for_new_company
  AFTER INSERT ON public.companies
  FOR EACH ROW
  EXECUTE FUNCTION public.seed_default_catalogue_for_new_company();
