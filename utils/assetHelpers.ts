/**
 * assetHelpers.ts — Display helpers for fire-safety asset types and variants.
 * Delegates to AssetData.ts for all icon/colour lookups so there is only
 * one source of truth.
 */

import { ASSET_TYPE_MAP } from '@/constants/AssetData';
export { getAssetTypeIcon } from '@/constants/AssetData';

// ─── formatAssetType ──────────────────────────────────────────────────────────

/**
 * Returns a clean display string for an asset_type value.
 * For known types, returns the canonical `fullLabel`.
 * For legacy/custom types (snake_case or freeform), converts to Title Case.
 *
 * Examples:
 *   'Fire Extinguishers - Portable'         → 'Fire Extinguishers - Portable'
 *   'fire_extinguisher'                     → 'Fire Extinguisher'
 *   'My Custom Asset'                       → 'My Custom Asset'
 */
export function formatAssetType(assetType: string): string {
  if (!assetType) return '';

  // If it's a known official type, return its fullLabel
  if (ASSET_TYPE_MAP[assetType]) {
    return ASSET_TYPE_MAP[assetType].fullLabel;
  }

  // Legacy snake_case or freeform — Title Case conversion
  return assetType
    .split('_')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

// ─── formatLocationCode ───────────────────────────────────────────────────────

/**
 * Expands a structured location code ("1-1-1" or "1-CR") into a readable
 * label: "Tower 1 · Floor 1 · Unit 1" or "Tower 1 · CR". Legacy free-text
 * locations (spaces, long segments) are left untouched — only strings that
 * actually look like the Tower/Floor/Unit builder's output get expanded.
 *
 * Examples:
 *   '1-1-1'                → 'Tower 1 · Floor 1 · Unit 1'
 *   '2-6-3'                → 'Tower 2 · Floor 6 · Unit 3'
 *   '1-CR'                 → 'Tower 1 · CR'
 *   'Level 2 corridor'     → 'Level 2 corridor'   (untouched — legacy free text)
 */
export function formatLocationCode(location: string): string {
  if (!location) return '';
  const parts = location.split('-').map((p) => p.trim());
  const looksStructured =
    parts.length >= 2 &&
    parts.length <= 3 &&
    parts.every((p) => p.length > 0 && p.length <= 6 && !p.includes(' '));
  if (!looksStructured) return location;
  if (parts.length === 3) return `Tower ${parts[0]} · Floor ${parts[1]} · Unit ${parts[2]}`;
  return `Tower ${parts[0]} · ${parts[1]}`;
}
