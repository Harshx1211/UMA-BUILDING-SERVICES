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
      'Exit Sign - Blade (Ceiling Mount)',
      'Exit Sign - Blade (Recessed)',
      'Exit Sign - Box (Wall Mount)',
      'Exit Sign - Non-Illuminated',
      'Exit Sign - Thin Blade',
      'Exit Sign - Gear Tray',
      'Exit Sign - Weatherproof',
      'Exit Sign - Wide Body',
      'Exit Sign - Jumbo (Ceiling Mount)',
      'Exit Sign - Jumbo (Wall Mount)',
      'Exit Sign - Pyramid (Ceiling Mount)',
      'Exit Sign - Quick Fit (Ceiling Mount, Gear Tray)',
      'Exit Sign - Quick Fit (Ceiling Mount)',
      'Exit Sign - Quick Fit (Wall Mount)',
      'Exit Sign - Weatherproof (Ceiling Mount)',
      'Exit Sign - Weatherproof (Wall Mount)',
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
      '1 ft - Gear Tray Diffused',
      '2 ft - Single Bare Batten',
      '2 ft - Single Diffused Batten',
      '2 ft - Single Weatherproof Batten',
      '2 ft - Single Wireguard Batten',
      '2 ft - Twin Bare Batten',
      '2 ft - Twin Diffused Batten',
      '2 ft - Twin Weatherproof Batten',
      '2 ft - Twin Wireguard Batten',
      '4 ft - Single Bare Batten',
      '4 ft - Single Diffused Batten',
      '4 ft - Single Weatherproof Batten',
      '4 ft - Single Wireguard Batten',
      '4 ft - Twin Bare Batten',
      '4 ft - Twin Diffused Batten',
      '4 ft - Twin Weatherproof Batten',
      '4 ft - Twin Wireguard Batten',
      'Box (Ceiling/Wall Mount)',
      'Circuit Breaker',
      'Flood Twin',
      'Flood Twin (Weatherproof)',
      'Main Switchboard',
      'Oyster',
      'Oyster (Weatherproof)',
      'Panel LED T-Bar',
      'Spitfire (Flush Mount)',
      'Spitfire (Surface Mount)',
      'Square (Ceiling/Wall Mount)',
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
      'Detector - CO2',
      'Detector - Concealed Heat',
      'Detector - Concealed Smoke',
      'Detector - Flame',
      'Detector - Heat',
      'Detector - Smoke',
      'Duct Probe',
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
      'VESDA',
    ],
  },

  {
    value: 'Fire Door (CA)',
    label: 'Fire Door\nCommon Area',
    fullLabel: 'Fire Door - Common Area',
    icon: 'door',
    color: '#8B5CF6',
    inspectionRoutine: '12 - Passive Fire (Hinged and Pivoted Doorsets - Common) (Annual)',
    variants: [
      'Automatic Door',
      'Exit Door - Double Even Pair',
      'Exit Door - Double Uneven Pair',
      'Exit Door - Single',
      'Fire Door - Double Even Pair',
      'Fire Door - Double Uneven Pair',
      'Fire Door - Single',
      'Fire Door - Single Double Action',
      'Fire Safety Door',
      'Smoke & Fire Door - Single',
      'Smoke Door - Double Even Pair',
      'Smoke Door - Double Uneven Pair',
      'Smoke Door - Single',
      'Smoke Door - Single Double Action',
      'Solid Core Doorset - Double',
      'Solid Core Doorset - Single',
    ],
  },
  // Doors in a Sole Occupancy Unit are serviced under their own routine
  // ("12 - Passive Fire ... - SOU"), separate from common-area doors — so
  // they're their own type, as in Uptick. See utils/assetHelpers.ts for
  // how doors are named (by their kind, e.g. "Exit Door - Single").
  {
    value: 'Fire Door (SOU)',
    label: 'Fire Door\nSOU (Unit)',
    fullLabel: 'Fire Door - Sole Occupancy Unit',
    icon: 'door',
    color: '#8B5CF6',
    inspectionRoutine: '12 - Passive Fire (Hinged and Pivoted Doorsets - SOU) (Annual)',
    variants: [
      'Automatic Door',
      'Exit Door - Double Even Pair',
      'Exit Door - Double Uneven Pair',
      'Exit Door - Single',
      'Fire Door - Double Even Pair',
      'Fire Door - Double Uneven Pair',
      'Fire Door - Single',
      'Fire Door - Single Double Action',
      'Fire Safety Door',
      'Smoke & Fire Door - Single',
      'Smoke Door - Double Even Pair',
      'Smoke Door - Double Uneven Pair',
      'Smoke Door - Single',
      'Smoke Door - Single Double Action',
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
      'Air/Water 9.0 L',
      'CO2 2.0 kg',
      'CO2 3.5 kg',
      'CO2 5.0 kg',
      'DCP AB(E) 1.0 kg',
      'DCP AB(E) 1.5 kg',
      'DCP AB(E) 2.0 kg',
      'DCP AB(E) 2.3 kg',
      'DCP AB(E) 2.5 kg',
      'DCP AB(E) 4.5 kg',
      'DCP AB(E) 6.0 kg',
      'DCP AB(E) 9.0 kg',
      'DCP B(E) 2.3 kg',
      'DCP B(E) 4.5 kg',
      'DCP B(E) 9.0 kg',
      'Foam AFFF 9.0 L',
      'Foam F3 (Fluorine-Free) 9.0 L',
      'Wet Chemical 2.0 L',
      'Wet Chemical 7.0 L',
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
      '100 m - 19 mm - Fire',
      '100 m - 25 mm - Fire',
      '36 m - 19 mm - Green Wash Down',
      '36 m - 19 mm - Fire',
      '36 m - 25 mm - Fire',
      '50 m - 19 mm - Fire',
      '50 m - 25 mm - Fire',
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
      'Foam Pail 20 L',
      'Booster - Hydrant',
      'Booster - Sprinkler',
      'Hydrant System Flow Test',
      'Hydrant Landing Valve',
      'In-Ground Spring Hydrant',
      'Pillar Landing Valve',
      'Sprinkler Head',
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
      'Sprinkler Head',
      'Wall Wetting System',
      'Window Wetter System',
      'Sprinkler Head Cabinet',
    ],
  },
];

// ─── Lookup Helpers ───────────────────────────────────────────────────────────

/** Map from asset type value → AssetTypeDefinition, for O(1) lookups */
export const ASSET_TYPE_MAP: Record<string, AssetTypeDefinition> = Object.fromEntries(
  ASSET_TYPES.map((t) => [t.value, t])
);

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
