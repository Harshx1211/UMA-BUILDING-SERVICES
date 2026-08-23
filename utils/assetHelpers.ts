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
