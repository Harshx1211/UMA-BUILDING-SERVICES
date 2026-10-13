-- ============================================================
-- Migration: separate door type for Sole Occupancy Units (SOU)
-- ============================================================
-- User feedback (2026-10-13): every door showed as "Fire Door (CA)" and a
-- door inside a unit couldn't be recorded as such. AS 1851 servicing (and
-- Uptick, which technicians compare us with) treats them as two routines:
--   12 - Passive Fire (Hinged and Pivoted Doorsets - Common) (Annual)
--   12 - Passive Fire (Hinged and Pivoted Doorsets - SOU) (Annual)
-- The report groups assets by routine, so a door's type decides which one
-- it's listed under. This adds "Fire Door (SOU)" next to "Fire Door (CA)"
-- for every company and for the template new companies are seeded from,
-- with the same icon, colour and door kinds (variants).
--
-- Also relabels the picker tiles so the two are told apart at a glance —
-- "Fire Door / Common Area" and "Fire Door / SOU (Unit)". Only labels
-- change on the existing type; its value ('Fire Door (CA)'), which every
-- existing door references, stays exactly as it is.
--
-- Safe to run more than once. Run this once in the Supabase SQL Editor.
-- ============================================================

BEGIN;

UPDATE public.asset_type_definitions
SET label = 'Fire Door' || chr(10) || 'Common Area',
    full_label = 'Fire Door - Common Area',
    updated_at = now()
WHERE value = 'Fire Door (CA)';

INSERT INTO public.asset_type_definitions
  (value, label, full_label, icon, color, inspection_routine, variants, is_active, sort_order, company_id)
SELECT 'Fire Door (SOU)',
       'Fire Door' || chr(10) || 'SOU (Unit)',
       'Fire Door - Sole Occupancy Unit',
       ca.icon,
       ca.color,
       '12 - Passive Fire (Hinged and Pivoted Doorsets - SOU) (Annual)',
       ca.variants,
       ca.is_active,
       ca.sort_order,
       ca.company_id
FROM public.asset_type_definitions ca
WHERE ca.value = 'Fire Door (CA)'
  AND NOT EXISTS (
    SELECT 1 FROM public.asset_type_definitions sou
    WHERE sou.value = 'Fire Door (SOU)'
      AND sou.company_id IS NOT DISTINCT FROM ca.company_id
  );

COMMIT;

-- Check: one SOU row per CA row (template + each company)
SELECT value, count(*) FROM public.asset_type_definitions
WHERE value IN ('Fire Door (CA)', 'Fire Door (SOU)') GROUP BY value;
