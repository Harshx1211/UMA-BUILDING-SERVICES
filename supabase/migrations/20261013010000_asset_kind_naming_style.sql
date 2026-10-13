-- ============================================================
-- Migration: one consistent writing style for asset kinds (variants)
-- ============================================================
-- Owner-approved style (2026-10-13):
--   1. Capitalised words; acronyms in capitals ("Double Even Pair",
--      "Duct Probe", "Detector - CO2", "VESDA").
--   2. One pattern per type, general to specific ("Exit Sign - Box (Wall
--      Mount)", not "Box (Wall Mount) - Exit").
--   3. Units the Australian way: "CO2 3.5 kg", "Wet Chemical 7.0 L",
--      "36 m - 19 mm - Fire", "2 ft - Single Bare Batten".
--   4. One name per thing ("Smoke Door - Uneven Pair" merges into
--      "Smoke Door - Double Uneven Pair").
--
-- Renames the kinds in every company's catalogue (and the template new
-- companies are seeded from) AND every existing asset that uses one, in a
-- single transaction, so nothing is left on the old wording. Only the
-- display text changes: no asset is re-typed or removed. Each catalogue
-- list is re-sorted alphabetically and de-duplicated.
--
-- Safe to run more than once (old names simply no longer match).
-- Run this once in the Supabase SQL Editor.
-- ============================================================

BEGIN;

CREATE TEMP TABLE variant_renames (asset_type text, old_name text, new_name text) ON COMMIT DROP;
INSERT INTO variant_renames (asset_type, old_name, new_name) VALUES
  ('Emergency - Exit Signs', 'Blade (Ceiling Mount) - Exit', 'Exit Sign - Blade (Ceiling Mount)'),
  ('Emergency - Exit Signs', 'Blade (Recessed) - Exit', 'Exit Sign - Blade (Recessed)'),
  ('Emergency - Exit Signs', 'Box (Wall Mount) - Exit', 'Exit Sign - Box (Wall Mount)'),
  ('Emergency - Exit Signs', 'Exit Sign (Non-Illuminated)', 'Exit Sign - Non-Illuminated'),
  ('Emergency - Exit Signs', 'Exit Sign (Thin Blade)', 'Exit Sign - Thin Blade'),
  ('Emergency - Exit Signs', 'Exit Sign Gear Tray', 'Exit Sign - Gear Tray'),
  ('Emergency - Exit Signs', 'Exit Sign Weather Proof', 'Exit Sign - Weatherproof'),
  ('Emergency - Exit Signs', 'Exit Sign Wide Body', 'Exit Sign - Wide Body'),
  ('Emergency - Exit Signs', 'Jumbo (Ceiling Mount) - Exit', 'Exit Sign - Jumbo (Ceiling Mount)'),
  ('Emergency - Exit Signs', 'Jumbo (Wall Mount) - Exit', 'Exit Sign - Jumbo (Wall Mount)'),
  ('Emergency - Exit Signs', 'Pyramid (Ceiling Mount) - Exit', 'Exit Sign - Pyramid (Ceiling Mount)'),
  ('Emergency - Exit Signs', 'Quick Fit (Ceiling Mount geartray) - Exit', 'Exit Sign - Quick Fit (Ceiling Mount, Gear Tray)'),
  ('Emergency - Exit Signs', 'Quick Fit (Ceiling Mount) - Exit', 'Exit Sign - Quick Fit (Ceiling Mount)'),
  ('Emergency - Exit Signs', 'Quick Fit (Wall Mount) - Exit', 'Exit Sign - Quick Fit (Wall Mount)'),
  ('Emergency - Exit Signs', 'Weatherproof (Ceiling Mount) - Exit', 'Exit Sign - Weatherproof (Ceiling Mount)'),
  ('Emergency - Exit Signs', 'Weatherproof (Wall Mount) - Exit', 'Exit Sign - Weatherproof (Wall Mount)'),
  ('Emergency - Lighting', '1FT - Geartray Diffused', '1 ft - Gear Tray Diffused'),
  ('Emergency - Lighting', '2FT - Single Bare Batten', '2 ft - Single Bare Batten'),
  ('Emergency - Lighting', '2FT - Single Diffused Batten', '2 ft - Single Diffused Batten'),
  ('Emergency - Lighting', '2FT - Single Weatherproof Batten', '2 ft - Single Weatherproof Batten'),
  ('Emergency - Lighting', '2FT - Single Wireguard Batten', '2 ft - Single Wireguard Batten'),
  ('Emergency - Lighting', '2FT - Twin Bare Batten', '2 ft - Twin Bare Batten'),
  ('Emergency - Lighting', '2FT - Twin Diffused Batten', '2 ft - Twin Diffused Batten'),
  ('Emergency - Lighting', '2FT - Twin Weatherproof Batten', '2 ft - Twin Weatherproof Batten'),
  ('Emergency - Lighting', '2FT - Twin Wireguard Batten', '2 ft - Twin Wireguard Batten'),
  ('Emergency - Lighting', '4FT - Single Bare Batten', '4 ft - Single Bare Batten'),
  ('Emergency - Lighting', '4FT - Single Diffused Batten', '4 ft - Single Diffused Batten'),
  ('Emergency - Lighting', '4FT - Single Weatherproof Batten', '4 ft - Single Weatherproof Batten'),
  ('Emergency - Lighting', '4FT - Single Wireguard Batten', '4 ft - Single Wireguard Batten'),
  ('Emergency - Lighting', '4FT - Twin Bare Batten', '4 ft - Twin Bare Batten'),
  ('Emergency - Lighting', '4FT - Twin Diffused Batten', '4 ft - Twin Diffused Batten'),
  ('Emergency - Lighting', '4FT - Twin Weatherproof Batten', '4 ft - Twin Weatherproof Batten'),
  ('Emergency - Lighting', '4FT - Twin Wireguard Batten', '4 ft - Twin Wireguard Batten'),
  ('Emergency - Lighting', 'Box Ceiling/Wall', 'Box (Ceiling/Wall Mount)'),
  ('Emergency - Lighting', 'Flood Twin Weatherproof', 'Flood Twin (Weatherproof)'),
  ('Emergency - Lighting', 'Main Switch Board', 'Main Switchboard'),
  ('Emergency - Lighting', 'Spitfire - (Surface Mount)', 'Spitfire (Surface Mount)'),
  ('Emergency - Lighting', 'Square Ceiling/Wall - Light', 'Square (Ceiling/Wall Mount)'),
  ('Fire Detection Devices (MCP, Detector, strobe, Flow Switch)', 'Detector - Co2', 'Detector - CO2'),
  ('Fire Detection Devices (MCP, Detector, strobe, Flow Switch)', 'Duct probe', 'Duct Probe'),
  ('Fire Detection Devices (MCP, Detector, strobe, Flow Switch)', 'Vesda', 'VESDA'),
  ('Fire Door (CA)', 'Exit Door - Double Even pair', 'Exit Door - Double Even Pair'),
  ('Fire Door (CA)', 'Exit Door - Double Uneven pair', 'Exit Door - Double Uneven Pair'),
  ('Fire Door (CA)', 'Fire Door - Double Even pair', 'Fire Door - Double Even Pair'),
  ('Fire Door (CA)', 'Fire Door - Double Uneven pair', 'Fire Door - Double Uneven Pair'),
  ('Fire Door (CA)', 'Smoke Door - Double Uneven pair', 'Smoke Door - Double Uneven Pair'),
  ('Fire Door (CA)', 'Smoke Door - Uneven Pair', 'Smoke Door - Double Uneven Pair'),
  ('Fire Door (SOU)', 'Exit Door - Double Even pair', 'Exit Door - Double Even Pair'),
  ('Fire Door (SOU)', 'Exit Door - Double Uneven pair', 'Exit Door - Double Uneven Pair'),
  ('Fire Door (SOU)', 'Fire Door - Double Even pair', 'Fire Door - Double Even Pair'),
  ('Fire Door (SOU)', 'Fire Door - Double Uneven pair', 'Fire Door - Double Uneven Pair'),
  ('Fire Door (SOU)', 'Smoke Door - Double Uneven pair', 'Smoke Door - Double Uneven Pair'),
  ('Fire Door (SOU)', 'Smoke Door - Uneven Pair', 'Smoke Door - Double Uneven Pair'),
  ('Fire Extinguishers - Portable', 'Air/Water 9.0LT', 'Air/Water 9.0 L'),
  ('Fire Extinguishers - Portable', 'CO2 2.0KG', 'CO2 2.0 kg'),
  ('Fire Extinguishers - Portable', 'CO2 3.5KG', 'CO2 3.5 kg'),
  ('Fire Extinguishers - Portable', 'CO2 5.0KG', 'CO2 5.0 kg'),
  ('Fire Extinguishers - Portable', 'DCP AB(E) 1.0KG', 'DCP AB(E) 1.0 kg'),
  ('Fire Extinguishers - Portable', 'DCP AB(E) 1.5KG', 'DCP AB(E) 1.5 kg'),
  ('Fire Extinguishers - Portable', 'DCP AB(E) 2.0KG', 'DCP AB(E) 2.0 kg'),
  ('Fire Extinguishers - Portable', 'DCP AB(E) 2.3KG', 'DCP AB(E) 2.3 kg'),
  ('Fire Extinguishers - Portable', 'DCP AB(E) 2.5KG', 'DCP AB(E) 2.5 kg'),
  ('Fire Extinguishers - Portable', 'DCP AB(E) 4.5KG', 'DCP AB(E) 4.5 kg'),
  ('Fire Extinguishers - Portable', 'DCP AB(E) 6.0KG', 'DCP AB(E) 6.0 kg'),
  ('Fire Extinguishers - Portable', 'DCP AB(E) 9.0KG', 'DCP AB(E) 9.0 kg'),
  ('Fire Extinguishers - Portable', 'DCP B(E) 2.3KG', 'DCP B(E) 2.3 kg'),
  ('Fire Extinguishers - Portable', 'DCP B(E) 4.5KG', 'DCP B(E) 4.5 kg'),
  ('Fire Extinguishers - Portable', 'DCP B(E) 9.0KG', 'DCP B(E) 9.0 kg'),
  ('Fire Extinguishers - Portable', 'Foam AFFF 9.0LT', 'Foam AFFF 9.0 L'),
  ('Fire Extinguishers - Portable', 'Foam F3 (Fluorine Free) 9.0LT', 'Foam F3 (Fluorine-Free) 9.0 L'),
  ('Fire Extinguishers - Portable', 'Wet Chemical 2.0Lt', 'Wet Chemical 2.0 L'),
  ('Fire Extinguishers - Portable', 'Wet Chemical 7.0Lt', 'Wet Chemical 7.0 L'),
  ('Fire Hose Reels', '100m - 19mm - Fire', '100 m - 19 mm - Fire'),
  ('Fire Hose Reels', '100m - 25mm - Fire', '100 m - 25 mm - Fire'),
  ('Fire Hose Reels', '36m - 19mm - Green Wash Down', '36 m - 19 mm - Green Wash Down'),
  ('Fire Hose Reels', '36m - 19mm - Fire', '36 m - 19 mm - Fire'),
  ('Fire Hose Reels', '36m - 25mm - Fire', '36 m - 25 mm - Fire'),
  ('Fire Hose Reels', '50m - 19mm - Fire', '50 m - 19 mm - Fire'),
  ('Fire Hose Reels', '50m - 25mm - Fire', '50 m - 25 mm - Fire'),
  ('Fire Hydrant System', '20Lt Foam pail', 'Foam Pail 20 L'),
  ('Fire Hydrant System', 'Hydrant System Flow test', 'Hydrant System Flow Test'),
  ('Fire Hydrant System', 'Hydrant landing valves', 'Hydrant Landing Valve'),
  ('Fire Hydrant System', 'In-ground Spring Hydrant', 'In-Ground Spring Hydrant'),
  ('Fire Hydrant System', 'Sprinkler head', 'Sprinkler Head'),
  ('Fire Sprinkler System - Wet Pipe', 'Sprinkler head', 'Sprinkler Head'),
  ('Fire Sprinkler System - Wet Pipe', 'sprinkler (heads) cabinet', 'Sprinkler Head Cabinet');

-- Existing assets
UPDATE public.assets a
SET variant = r.new_name, updated_at = now()
FROM variant_renames r
WHERE a.asset_type = r.asset_type AND a.variant = r.old_name;

-- Catalogue lists
UPDATE public.asset_type_definitions d
SET variants = (
      SELECT array_agg(v ORDER BY lower(v))
      FROM (
        SELECT DISTINCT coalesce(r.new_name, x.v) AS v
        FROM unnest(d.variants) AS x(v)
        LEFT JOIN variant_renames r ON r.asset_type = d.value AND r.old_name = x.v
      ) renamed
    ),
    updated_at = now()
WHERE EXISTS (
  SELECT 1 FROM variant_renames r WHERE r.asset_type = d.value AND r.old_name = ANY (d.variants)
);

COMMIT;

-- Check: should return no rows (nothing left on an old name)
SELECT a.asset_type, a.variant, count(*)
FROM public.assets a
WHERE a.variant IN ('100m - 19mm - Fire', '100m - 25mm - Fire', '1FT - Geartray Diffused', '20Lt Foam pail', '2FT - Single Bare Batten', '2FT - Single Diffused Batten', '2FT - Single Weatherproof Batten', '2FT - Single Wireguard Batten', '2FT - Twin Bare Batten', '2FT - Twin Diffused Batten', '2FT - Twin Weatherproof Batten', '2FT - Twin Wireguard Batten', '36m - 19mm - Fire', '36m - 19mm - Green Wash Down', '36m - 25mm - Fire', '4FT - Single Bare Batten', '4FT - Single Diffused Batten', '4FT - Single Weatherproof Batten', '4FT - Single Wireguard Batten', '4FT - Twin Bare Batten', '4FT - Twin Diffused Batten', '4FT - Twin Weatherproof Batten', '4FT - Twin Wireguard Batten', '50m - 19mm - Fire', '50m - 25mm - Fire', 'Air/Water 9.0LT', 'Blade (Ceiling Mount) - Exit', 'Blade (Recessed) - Exit', 'Box (Wall Mount) - Exit', 'Box Ceiling/Wall', 'CO2 2.0KG', 'CO2 3.5KG', 'CO2 5.0KG', 'DCP AB(E) 1.0KG', 'DCP AB(E) 1.5KG', 'DCP AB(E) 2.0KG', 'DCP AB(E) 2.3KG', 'DCP AB(E) 2.5KG', 'DCP AB(E) 4.5KG', 'DCP AB(E) 6.0KG', 'DCP AB(E) 9.0KG', 'DCP B(E) 2.3KG', 'DCP B(E) 4.5KG', 'DCP B(E) 9.0KG', 'Detector - Co2', 'Duct probe', 'Exit Door - Double Even pair', 'Exit Door - Double Uneven pair', 'Exit Sign (Non-Illuminated)', 'Exit Sign (Thin Blade)', 'Exit Sign Gear Tray', 'Exit Sign Weather Proof', 'Exit Sign Wide Body', 'Fire Door - Double Even pair', 'Fire Door - Double Uneven pair', 'Flood Twin Weatherproof', 'Foam AFFF 9.0LT', 'Foam F3 (Fluorine Free) 9.0LT', 'Hydrant System Flow test', 'Hydrant landing valves', 'In-ground Spring Hydrant', 'Jumbo (Ceiling Mount) - Exit', 'Jumbo (Wall Mount) - Exit', 'Main Switch Board', 'Pyramid (Ceiling Mount) - Exit', 'Quick Fit (Ceiling Mount geartray) - Exit', 'Quick Fit (Ceiling Mount) - Exit', 'Quick Fit (Wall Mount) - Exit', 'Smoke Door - Double Uneven pair', 'Smoke Door - Uneven Pair', 'Spitfire - (Surface Mount)', 'Sprinkler head', 'Square Ceiling/Wall - Light', 'Vesda', 'Weatherproof (Ceiling Mount) - Exit', 'Weatherproof (Wall Mount) - Exit', 'Wet Chemical 2.0Lt', 'Wet Chemical 7.0Lt', 'sprinkler (heads) cabinet')
GROUP BY 1, 2;
