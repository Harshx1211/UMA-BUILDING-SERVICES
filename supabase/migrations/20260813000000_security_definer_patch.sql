-- ============================================================
-- SECURITY DEFINER PATCH
-- ============================================================
-- Fixes search_path vulnerability for SECURITY DEFINER functions
-- by pinning search_path to '' and relying on fully qualified names.
--
-- DO NOT DROP these functions before replacing them, or dependent
-- triggers/policies will break. Use CREATE OR REPLACE only.

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
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = '';

CREATE OR REPLACE FUNCTION public.on_company_created_catalogue()
RETURNS TRIGGER AS $$
BEGIN
  PERFORM public.clone_catalogue_for_company(NEW.id);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = '';

CREATE OR REPLACE FUNCTION public.process_audit_log()
RETURNS TRIGGER AS $$
DECLARE
    current_user_id UUID;
BEGIN
    -- Try to get the user ID from Supabase auth context
    current_user_id := auth.uid();
    
    IF (TG_OP = 'DELETE') THEN
        INSERT INTO public.audit_logs (table_name, record_id, action, old_data, changed_by)
        VALUES (TG_TABLE_NAME, OLD.id, 'DELETE', row_to_json(OLD)::jsonb, current_user_id);
        RETURN OLD;
    ELSIF (TG_OP = 'UPDATE') THEN
        INSERT INTO public.audit_logs (table_name, record_id, action, old_data, new_data, changed_by)
        VALUES (TG_TABLE_NAME, NEW.id, 'UPDATE', row_to_json(OLD)::jsonb, row_to_json(NEW)::jsonb, current_user_id);
        RETURN NEW;
    ELSIF (TG_OP = 'INSERT') THEN
        INSERT INTO public.audit_logs (table_name, record_id, action, new_data, changed_by)
        VALUES (TG_TABLE_NAME, NEW.id, 'INSERT', row_to_json(NEW)::jsonb, current_user_id);
        RETURN NEW;
    END IF;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = '';
