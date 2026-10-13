-- ============================================================
-- Migration: Common Area / Unit (SOU) on every asset
-- ============================================================
-- Replaces the separate "Fire Door (SOU)" type (20261013000000) with a
-- general design (owner-approved 2026-10-13):
--   * assets.area — 'common' (default) or 'unit': where the asset is.
--   * asset_type_definitions.unit_inspection_routine — the routine a type
--     is serviced under when the asset is inside a unit. NULL = the type
--     isn't split; the app only offers the Common Area / Unit choice for
--     types that have one. Admins can set or clear it per type in the
--     admin portal's Catalogue.
-- The report groups each asset under unit_inspection_routine when it's in
-- a unit, otherwise inspection_routine.
--
-- Pre-filled unit routines (only where none is set yet):
--   Fire Door             12 - Passive Fire (Hinged and Pivoted Doorsets - SOU) (Annual)
--   Fire Detection        06 - Fire Detection (Devices - SOU) (Annual)
--   Fire Extinguishers    10 - Portable and Wheeled Fire Extinguishers - SOU (Annual)
--
-- Doors added as "Fire Door (SOU)" move to "Fire Door (CA)" with area
-- 'unit' (same routine as before, nothing lost); the SOU type is switched
-- off rather than deleted. Fire Door labels go back to plain "Fire Door".
--
-- Run BEFORE deploying the report service / app build that read these
-- columns. Safe to run more than once. Run in the Supabase SQL Editor.
-- ============================================================

ALTER TABLE public.assets ADD COLUMN IF NOT EXISTS area text NOT NULL DEFAULT 'common';
ALTER TABLE public.assets DROP CONSTRAINT IF EXISTS assets_area_check;
ALTER TABLE public.assets ADD CONSTRAINT assets_area_check CHECK (area IN ('common', 'unit'));

ALTER TABLE public.asset_type_definitions ADD COLUMN IF NOT EXISTS unit_inspection_routine text;

UPDATE public.asset_type_definitions
SET unit_inspection_routine = '12 - Passive Fire (Hinged and Pivoted Doorsets - SOU) (Annual)',
    label = 'Fire Door', full_label = 'Fire Door', updated_at = now()
WHERE value = 'Fire Door (CA)' AND unit_inspection_routine IS NULL;

UPDATE public.asset_type_definitions
SET unit_inspection_routine = '06 - Fire Detection (Devices - SOU) (Annual)', updated_at = now()
WHERE value = 'Fire Detection Devices (MCP, Detector, strobe, Flow Switch)' AND unit_inspection_routine IS NULL;

UPDATE public.asset_type_definitions
SET unit_inspection_routine = '10 - Portable and Wheeled Fire Extinguishers - SOU (Annual)', updated_at = now()
WHERE value = 'Fire Extinguishers - Portable' AND unit_inspection_routine IS NULL;

UPDATE public.assets
SET asset_type = 'Fire Door (CA)', area = 'unit', updated_at = now()
WHERE asset_type = 'Fire Door (SOU)';

UPDATE public.asset_type_definitions
SET is_active = false, updated_at = now()
WHERE value = 'Fire Door (SOU)' AND is_active;

-- Check: unit routines per type, and assets per area
SELECT value, unit_inspection_routine, is_active, count(*) AS rows
FROM public.asset_type_definitions
WHERE unit_inspection_routine IS NOT NULL OR value = 'Fire Door (SOU)'
GROUP BY 1, 2, 3 ORDER BY 1;
