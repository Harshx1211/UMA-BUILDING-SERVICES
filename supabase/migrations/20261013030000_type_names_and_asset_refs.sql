-- ============================================================
-- Migration: standard display names, reference prefixes, missing refs
-- ============================================================
-- Owner-approved (2026-10-13), kept to Australian standard terminology:
--
-- 1. Display names (full_label) in the wording of the standards each type
--    is serviced under — AS 1851 (fire equipment), AS 2293 (emergency
--    escape lighting and exit signs), AS 1670.1 (manual call points). The
--    stored type value is unchanged, so no asset or rule is affected; only
--    what's printed changes. Admins can still edit them in the Catalogue.
--
-- 2. asset_type_definitions.ref_prefix — the prefix for automatic asset
--    references, taken from the convention already used on site
--    (FE-001, FD-001, FDR-001, EXIT-001...). The app gives a new asset
--    left without a reference the next number for its type at that
--    property.
--
-- 3. Existing assets with no reference get one the same way (in the order
--    they were added), so no two cards in a report read identically.
--    References already set are never changed.
--
-- Safe to run more than once. Run in the Supabase SQL Editor.
-- ============================================================

ALTER TABLE public.asset_type_definitions ADD COLUMN IF NOT EXISTS ref_prefix text;

WITH names (value, full_label, ref_prefix) AS (
  VALUES
    ('Fire Sprinkler System - Wet Pipe',                              'Fire Sprinkler System (Wet Pipe)',  'FSS'),
    ('Fire Hydrant System',                                           'Fire Hydrant System',               'FH'),
    ('Fire Detection Devices (MCP, Detector, strobe, Flow Switch)',   'Fire Detection Device',             'FD'),
    ('Fire Hose Reels',                                               'Fire Hose Reel',                    'FHR'),
    ('Fire Extinguishers - Portable',                                 'Portable Fire Extinguisher',        'FE'),
    ('Fire Door (CA)',                                                'Fire Door',                         'FDR'),
    ('Emergency - Lighting',                                          'Emergency Light',                   'EL'),
    ('Emergency - Exit Signs',                                        'Exit Sign',                         'EXIT'),
    ('BGA, MCP or Manual Call Point',                                 'Manual Call Point (MCP / BGA)',     'MCP')
)
UPDATE public.asset_type_definitions d
SET full_label = n.full_label,
    ref_prefix = coalesce(d.ref_prefix, n.ref_prefix),
    updated_at = now()
FROM names n
WHERE d.value = n.value
  AND (d.full_label IS DISTINCT FROM n.full_label OR d.ref_prefix IS NULL);

-- Missing references: next number per property + prefix, oldest first.
WITH prefixes AS (
  SELECT value, max(ref_prefix) AS prefix
  FROM public.asset_type_definitions
  WHERE ref_prefix IS NOT NULL
  GROUP BY value
),
taken AS (
  SELECT a.property_id, p.prefix,
         max((regexp_match(a.asset_ref, '^' || p.prefix || '-(\d+)$', 'i'))[1]::int) AS max_n
  FROM public.assets a
  JOIN prefixes p ON p.value = a.asset_type
  WHERE coalesce(btrim(a.asset_ref), '') <> ''
  GROUP BY a.property_id, p.prefix
),
todo AS (
  SELECT a.id, a.property_id, p.prefix,
         row_number() OVER (PARTITION BY a.property_id, p.prefix ORDER BY a.created_at, a.id) AS rn
  FROM public.assets a
  JOIN prefixes p ON p.value = a.asset_type
  WHERE coalesce(btrim(a.asset_ref), '') = ''
)
UPDATE public.assets a
SET asset_ref = t.prefix || '-' || lpad((coalesce(tk.max_n, 0) + t.rn)::text, 3, '0'),
    updated_at = now()
FROM todo t
LEFT JOIN taken tk ON tk.property_id = t.property_id AND tk.prefix = t.prefix
WHERE a.id = t.id;

-- Check: types with their name/prefix, and assets still without a reference (expect 0)
SELECT value, full_label, ref_prefix, count(*) AS rows
FROM public.asset_type_definitions WHERE is_active GROUP BY 1, 2, 3 ORDER BY 1;
SELECT count(*) AS assets_without_ref FROM public.assets WHERE coalesce(btrim(asset_ref), '') = '';
