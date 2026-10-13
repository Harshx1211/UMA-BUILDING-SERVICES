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

// ─── formatAssetName / formatAssetSubtitle ────────────────────────────────────

/**
 * Door types, by the area they serve. Doors are named by what they ARE —
 * "Exit Door - Single", "Fire Door - Double Even pair" (the variant) — with
 * the type underneath, the way Uptick shows them. Users found every door
 * reading "Fire Door (CA)" with its real kind in small print confusing ("if
 * it's an exit door it should say exit door"). Other assets keep their type
 * as the name (an extinguisher's variant is a size, not a name).
 */
const DOOR_AREAS: Record<string, string> = {
  'Fire Door (CA)': 'Common Area',
  'Fire Door (SOU)': 'Sole Occupancy Unit',
};

export function isDoorType(assetType: string | null | undefined): boolean {
  return !!assetType && assetType in DOOR_AREAS;
}

/** The asset's name: a door's kind (its variant), otherwise its type. */
export function formatAssetName(assetType: string, variant?: string | null): string {
  return isDoorType(assetType) && variant ? variant : formatAssetType(assetType);
}

/** The line under the name: a door's type and area, otherwise the variant. */
export function formatAssetSubtitle(assetType: string, variant?: string | null): string | null {
  if (isDoorType(assetType)) return variant ? formatAssetType(assetType) : null;
  return variant || null;
}

// ─── formatRelativeDays ───────────────────────────────────────────────────────

/**
 * "today" / "yesterday" / "N days ago" for a given ISO date string. Same
 * day-truncated math as the PDF report's fmtRelativeDays (a separate service,
 * can't share the import) — kept consistent so "X days ago" means the same
 * thing whether a technician sees it in the app or in the generated report.
 */
export function formatRelativeDays(iso: string | null | undefined): string {
  if (!iso) return '';
  const then = new Date(iso);
  if (Number.isNaN(then.getTime())) return '';
  const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const days = Math.round((startOfDay(new Date()).getTime() - startOfDay(then).getTime()) / 86400000);
  if (days <= 0) return 'today';
  if (days === 1) return 'yesterday';
  return `${days} days ago`;
}

// ─── formatLocationCode ───────────────────────────────────────────────────────

/**
 * Expands a structured location code ("1-1-1" or "1-CR") into a short,
 * unambiguous label: "T1 · F1 · U1" or "T1 · CR". Kept compact on purpose —
 * this shows up on asset cards and group headers where space is tight, and
 * the full "Tower 1 · Floor 1 · Unit 1" wording was getting truncated.
 * Legacy free-text locations (spaces, long segments) are left untouched —
 * only strings that actually look like the Tower/Floor/Unit builder's
 * output get expanded.
 *
 * Examples:
 *   '1-1-1'                → 'T1 · F1 · U1'
 *   '2-6-3'                → 'T2 · F6 · U3'
 *   '1-CR'                 → 'T1 · CR'
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
  if (parts.length === 3) return `T${parts[0]} · F${parts[1]} · U${parts[2]}`;
  return `T${parts[0]} · ${parts[1]}`;
}
