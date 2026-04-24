/**
 * AssetData.ts — Single source of truth for all fire-safety asset types,
 * their sub-variants, inspection routines, display icons and colours.
 *
 * Extracted from 25 real-world Uptick screenshots captured on a live job
 * (T-14231) CA 2026 - 153 Parramatta...
 *
 * Structure mirrors the "Edit Asset" form in the reference app:
 *   Type → Variant → Inspection Routine (auto-assigned) → Location → Ref
 */

import type { ComponentProps } from 'react';
import type { MaterialCommunityIcons } from '@expo/vector-icons';

type IconName = ComponentProps<typeof MaterialCommunityIcons>['name'];

// ─── Asset Type Definition ────────────────────────────────────────────────────

export interface AssetTypeDefinition {
  /** Canonical value stored in the database (asset_type column) */
  value: string;
  /** Short display label for grid tiles */
  label: string;
  /** Full label as shown in the "Type" heading of Edit Asset form */
  fullLabel: string;
  /** MaterialCommunityIcons icon name */
  icon: IconName;
  /** Hex accent colour for the tile and icon */
  color: string;
  /** Inspection routine auto-assigned when this type is selected */
  inspectionRoutine: string;
  /** Sub-variants available for this asset type */
  variants: string[];
}

// ─── Master List of Asset Types ───────────────────────────────────────────────

export const ASSET_TYPES: AssetTypeDefinition[] = [
  {
    value: 'BGA, MCP or Manual Call Point',
    label: 'MCP /\nCall Point',
    fullLabel: 'BGA, MCP or Manual Call Point',
    icon: 'alarm-light',
    color: '#7C3AED',
    inspectionRoutine: 'Access Control System (Annual)',
    variants: [
      'Break Glass',
    ],
  },

  {
    value: 'Emergency - Exit Signs',
    label: 'Exit\nSigns',
    fullLabel: 'Emergency - Exit Signs',
    icon: 'exit-run',
    color: '#059669',
    inspectionRoutine: '15 - Emergency escape lighting and exit signs (Annual)',
    variants: [
      'Blade (Ceiling Mount) - Exit',
      'Blade (Recessed) - Exit',
      'Box (Wall Mount) - Exit',
      'Exit Sign (Non-Illuminated)',
      'Exit Sign (Thin Blade)',
      'Exit Sign Gear Tray',
      'Exit Sign Weather Proof',
      'Exit Sign Wide Body',
      'Jumbo (Ceiling Mount) - Exit',
      'Jumbo (Wall Mount) - Exit',
      'Pyramid (Ceiling Mount) - Exit',
      'Quick Fit (Ceiling Mount geartray) - Exit',
      'Quick Fit (Ceiling Mount) - Exit',
      'Quick Fit (Wall Mount) - Exit',
      'Weatherproof (Ceiling Mount) - Exit',
      'Weatherproof (Wall Mount) - Exit',
    ],
  },

  {
    value: 'Emergency - Lighting',
    label: 'Emergency\nLighting',
    fullLabel: 'Emergency - Lighting',
    icon: 'lightning-bolt',
    color: '#F59E0B',
    inspectionRoutine: '15 - Emergency escape lighting and exit signs (Annual)',
    variants: [
      '1FT - Geartray Diffused',
      '2FT - Single Bare Batten',
      '2FT - Single Diffused Batten',
      '2FT - Single Weatherproof Batten',
      '2FT - Single Wireguard Batten',
      '2FT - Twin Bare Batten',
      '2FT - Twin Diffused Batten',
      '2FT - Twin Weatherproof Batten',
      '2FT - Twin Wireguard Batten',
      '4FT - Single Bare Batten',
      '4FT - Single Diffused Batten',
      '4FT - Single Weatherproof Batten',
      '4FT - Single Wireguard Batten',
      '4FT - Twin Bare Batten',
      '4FT - Twin Diffused Batten',
      '4FT - Twin Weatherproof Batten',
      '4FT - Twin Wireguard Batten',
      'Box Ceiling/Wall',
      'Circuit Breaker',
      'Flood Twin',
      'Flood Twin Weatherproof',
      'Main Switch Board',
      'Oyster',
      'Oyster (Weatherproof)',
      'Panel LED T-Bar',
      'Spitfire (Flush Mount)',
      'Spitfire - (Surface Mount)',
      'Square Ceiling/Wall - Light',
      'Test Switch',
    ],
  },

  {
    value: 'Fire Detection Devices (MCP, Detector, strobe, Flow Switch)',
    label: 'Fire\nDetection',
    fullLabel: 'Fire Detection Devices (MCP, Detector, strobe, Flow Switch)',
    icon: 'smoke-detector',
    color: '#DC2626',
    inspectionRoutine: '06 - Fire Detection (Devices) (Annual)',
    variants: [
      'ASE (Alarm Monitoring)',
      'Beam Detector',
      'Bell',
      'Detector - Co2',
      'Detector - Concealed Heat',
      'Detector - Concealed Smoke',
      'Detector - Flame',
      'Detector - Heat',
      'Detector - Smoke',
      'Duct probe',
      'Emergency Door Release',
      'Fail Safe Device',
      'Flow Switch',
      'Horn (Single)',
      'Horn (Twin)',
      'MCP (Indoor)',
      'MCP (Weatherproof)',
      'Pressure Switch',
      'Sounder',
      'Strobe',
      'Vesda',
    ],
  },

  {
    value: 'Fire Door (CA)',
    label: 'Fire\nDoor',
    fullLabel: 'Fire Door (CA)',
    icon: 'door',
    color: '#8B5CF6',
    inspectionRoutine: '12 - Passive Fire (Hinged and Pivoted Doorsets - Common) (Annual)',
    variants: [
      'Automatic Door',
      'Exit Door - Double Even pair',
      'Exit Door - Double Uneven pair',
      'Exit Door - Single',
      'Fire Door - Double Even pair',
      'Fire Door - Double Uneven pair',
      'Fire Door - Single',
      'Fire Door - Single Double Action',
      'Fire Safety Door',
      'Smoke & Fire Door - Single',
      'Smoke Door - Double Even Pair',
      'Smoke Door - Double Uneven pair',
      'Smoke Door - Single',
      'Smoke Door - Single Double Action',
      'Smoke Door - Uneven Pair',
      'Solid Core Doorset - Double',
      'Solid Core Doorset - Single',
    ],
  },

  {
    value: 'Fire Extinguishers - Portable',
    label: 'Fire\nExtinguisher',
    fullLabel: 'Fire Extinguishers - Portable',
    icon: 'fire-extinguisher',
    color: '#EF4444',
    inspectionRoutine: '10 - Portable and Wheeled Fire Extinguishers (Annual)',
    variants: [
      'Air/Water 9.0LT',
      'CO2 2.0KG',
      'CO2 3.5KG',
      'CO2 5.0KG',
      'DCP AB(E) 1.0KG',
      'DCP AB(E) 1.5KG',
      'DCP AB(E) 2.0KG',
      'DCP AB(E) 2.3KG',
      'DCP AB(E) 2.5KG',
      'DCP AB(E) 4.5KG',
      'DCP AB(E) 6.0KG',
      'DCP AB(E) 9.0KG',
      'DCP B(E) 2.3KG',
      'DCP B(E) 4.5KG',
      'DCP B(E) 9.0KG',
      'Foam AFFF 9.0LT',
      'Foam F3 (Fluorine Free) 9.0LT',
      'Wet Chemical 2.0Lt',
      'Wet Chemical 7.0Lt',
    ],
  },

  {
    value: 'Fire Hose Reels',
    label: 'Hose\nReels',
    fullLabel: 'Fire Hose Reels',
    icon: 'pipe',
    color: '#0891B2',
    inspectionRoutine: '09 - Fire Hose Reels (Annual)',
    variants: [
      '100m - 19mm - Fire',
      '100m - 25mm - Fire',
      '36m - 19mm - Green Wash Down',
      '36m - 19mm - Fire',
      '36m - 25mm - Fire',
      '50m - 19mm - Fire',
      '50m - 25mm - Fire',
      'Fire Hose Reel Flow Test',
    ],
  },

  {
    value: 'Fire Hydrant System',
    label: 'Fire\nHydrant',
    fullLabel: 'Fire Hydrant System',
    icon: 'pipe-valve',
    color: '#B91C1C',
    inspectionRoutine: '04 - Fire Hydrant Systems (Annual - Valves)',
    variants: [
      '20Lt Foam pail',
      'Booster - Hydrant',
      'Booster - Sprinkler',
      'Hydrant System Flow test',
      'Hydrant landing valves',
      'In-ground Spring Hydrant',
      'Pillar Landing Valve',
      'Sprinkler head',
    ],
  },

  {
    value: 'Fire Sprinkler System - Wet Pipe',
    label: 'Sprinkler\nSystem',
    fullLabel: 'Fire Sprinkler System - Wet Pipe',
    icon: 'water',
    color: '#2563EB',
    inspectionRoutine: '02 - Automatic Fire Sprinkler Systems (Annual Flow)',
    variants: [
      'Foam Water Systems',
      'General System',
      'Sprinkler Alarm Valve',
      'Sprinkler System Flow Test',
      'Sprinkler Valve',
      'Sprinkler head',
      'Wall Wetting System',
      'Window Wetter System',
      'sprinkler (heads) cabinet',
    ],
  },
];

// ─── Lookup Helpers ───────────────────────────────────────────────────────────

/** Map from asset type value → AssetTypeDefinition, for O(1) lookups */
export const ASSET_TYPE_MAP: Record<string, AssetTypeDefinition> = Object.fromEntries(
  ASSET_TYPES.map((t) => [t.value, t])
);

/** Returns the inspection routine string for a given asset type value */
export function getInspectionRoutine(assetType: string): string {
  return ASSET_TYPE_MAP[assetType]?.inspectionRoutine ?? 'General Inspection (Annual)';
}

/** Returns the variant list for a given asset type value */
export function getVariantsForType(assetType: string): string[] {
  return ASSET_TYPE_MAP[assetType]?.variants ?? [];
}

/** Returns icon name for a given asset type value */
export function getAssetTypeIcon(assetType: string): IconName {
  // Exact match first
  if (ASSET_TYPE_MAP[assetType]) return ASSET_TYPE_MAP[assetType].icon;

  // Legacy / freeform type fallback — fuzzy keyword matching
  const t = (assetType ?? '').toLowerCase();
  if (t.includes('extinguisher'))               return 'fire-extinguisher';
  if (t.includes('sprinkler'))                  return 'water';
  if (t.includes('door'))                       return 'door';
  if (t.includes('exit'))                       return 'exit-run';
  if (t.includes('light') || t.includes('emergency')) return 'lightning-bolt';
  if (t.includes('alarm') || t.includes('smoke'))     return 'smoke-detector';
  if (t.includes('hose'))                       return 'pipe';
  if (t.includes('hydrant'))                    return 'pipe-valve';
  if (t.includes('mcp') || t.includes('call'))  return 'alarm-light';
  if (t.includes('detect'))                     return 'smoke-detector';
  return 'shield-check-outline';
}

/** Returns accent colour for a given asset type value */
export function getAssetTypeColor(assetType: string): string {
  return ASSET_TYPE_MAP[assetType]?.color ?? '#6B7280';
}
