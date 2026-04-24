/**
 * assetHelpers.ts — Display helpers for fire-safety asset types and variants.
 * Delegates to AssetData.ts for all icon/colour lookups so there is only
 * one source of truth.
 */

import { getAssetTypeIcon, getAssetTypeColor, ASSET_TYPE_MAP } from '@/constants/AssetData';
export { getInspectionRoutine, getVariantsForType, getAssetTypeIcon, getAssetTypeColor } from '@/constants/AssetData';

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

// ─── getAssetEmoji ────────────────────────────────────────────────────────────

/**
 * Maps an asset_type to a representative emoji for use in PDF reports
 * and text-only contexts. Falls back to 🔥 for unknown types.
 */
export function getAssetEmoji(assetType: string): string {
  const t = (assetType ?? '').toLowerCase();
  if (t.includes('extinguisher'))                      return '🧯';
  if (t.includes('sprinkler'))                         return '💧';
  if (t.includes('exit sign') || t.includes('exit'))  return '🚪';
  if (t.includes('emergency') && t.includes('light')) return '🔦';
  if (t.includes('emergency'))                         return '⚡';
  if (t.includes('fire detection') || t.includes('detector') || t.includes('smoke')) return '🔔';
  if (t.includes('fire door') || t.includes('door'))  return '🚪';
  if (t.includes('hose'))                              return '🚿';
  if (t.includes('hydrant'))                           return '🔴';
  if (t.includes('mcp') || t.includes('call point') || t.includes('manual call')) return '🆘';
  return '🔥';
}

// ─── getAssetIconName (re-export with legacy compatibility) ───────────────────

/**
 * Returns a MaterialCommunityIcons icon name for the given asset type.
 * Handles both official type values from AssetData.ts and legacy freeform strings.
 */
export { getAssetTypeIcon as getAssetIconName };
