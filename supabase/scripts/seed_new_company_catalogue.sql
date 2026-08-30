-- Run this once, every time a new company is created (currently a manual
-- step — there's no in-app signup flow yet). Copies the current global
-- default catalogue (company_id IS NULL) into the new company's own
-- company_id, exactly the same way DK12/RKP Fire Compliance/UMA Building
-- Compliance already got theirs. After this runs, the new company's admin
-- can see and freely edit their own copy in the Catalogue page immediately —
-- editing their copy never touches the global defaults or any other
-- company's copy.
--
-- Edit the uuid below to the new company's real id, then run both INSERTs.

INSERT INTO asset_type_definitions (company_id, value, label, full_label, icon, color, inspection_routine, variants, is_active, sort_order)
SELECT 'PASTE-NEW-COMPANY-ID-HERE'::uuid, value, label, full_label, icon, color, inspection_routine, variants, is_active, sort_order
FROM asset_type_definitions
WHERE company_id IS NULL;

INSERT INTO defect_codes (company_id, code, description, quote_price, category, is_active, sort_order)
SELECT 'PASTE-NEW-COMPANY-ID-HERE'::uuid, code, description, quote_price, category, is_active, sort_order
FROM defect_codes
WHERE company_id IS NULL;
