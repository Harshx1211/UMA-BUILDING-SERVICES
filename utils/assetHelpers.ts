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
// Display names from the company's own catalogue (admins can edit them),
// registered by store/catalogueStore.ts whenever it loads. Falls back to the
// built-in list for anything not in it.
let catalogueNames = new Map<string, string>();
export function registerCatalogueNames(names: Map<string, string>): void {
  catalogueNames = names;
}

export function formatAssetType(assetType: string): string {
  if (!assetType) return '';

  const fromCatalogue = catalogueNames.get(assetType);
  if (fromCatalogue) return fromCatalogue;

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
const DOOR_TYPES = new Set(['Fire Door (CA)', 'Fire Door (SOU)']);

export function isDoorType(assetType: string | null | undefined): boolean {
  return !!assetType && DOOR_TYPES.has(assetType);
}

/** The asset's name: a door's kind (its variant), otherwise its type. */
export function formatAssetName(assetType: string, variant?: string | null): string {
  if (isDoorType(assetType)) return variant || 'Fire Door';
  return formatAssetType(assetType);
}

/** The line under the name: a door's type and area ("Fire Door · Unit
 * (SOU)"); otherwise the variant, plus "Unit (SOU)" for anything in a unit. */
export function formatAssetSubtitle(assetType: string, variant?: string | null, area?: string | null): string | null {
  const inUnit = areaOf({ area, asset_type: assetType }) === 'unit';
  if (isDoorType(assetType)) {
    return [variant ? 'Fire Door' : null, AREA_LABEL[inUnit ? 'unit' : 'common']].filter(Boolean).join(' · ');
  }
  return [variant || null, inUnit ? AREA_LABEL.unit : null].filter(Boolean).join(' · ') || null;
}

// ─── Area (Common Area / Unit) ────────────────────────────────────────────────

export type AssetArea = 'common' | 'unit';

export const AREA_LABEL: Record<AssetArea, string> = {
  common: 'Common Area',
  unit: 'Unit (SOU)',
};

/** An asset's area, defaulting to Common Area for anything unset. The
 * retired "Fire Door (SOU)" type (migration 20261013020000 moved its doors
 * onto Fire Door + unit) still reads as a unit if a stale row turns up. */
export function areaOf(asset: { area?: string | null; asset_type?: string | null }): AssetArea {
  if (asset.area === 'unit' || asset.asset_type === 'Fire Door (SOU)') return 'unit';
  return 'common';
}

/**
 * The inspection routine an asset is serviced under: its type's unit
 * routine when it's inside a unit and the type has one, otherwise the
 * normal one. Same rule as the PDF report (categoryGrouping.ts there).
 */
export function effectiveRoutine(
  typeDef: { inspectionRoutine?: string | null; unitInspectionRoutine?: string | null } | null | undefined,
  area: AssetArea,
): string {
  if (area === 'unit' && typeDef?.unitInspectionRoutine) return typeDef.unitInspectionRoutine;
  return typeDef?.inspectionRoutine || 'Other';
}

// ─── Automatic asset references ───────────────────────────────────────────────

/** A type's reference prefix: the catalogue's (FE, FD, FDR...), otherwise
 * the initials of its name ("Smoke Damper" -> "SD"), otherwise "AST". */
export function refPrefixOf(typeDef: { refPrefix?: string | null; fullLabel?: string | null } | null | undefined, typeValue: string): string {
  const set = typeDef?.refPrefix?.trim();
  if (set) return set.toUpperCase();
  const words = (typeDef?.fullLabel || typeValue).replace(/\(.*?\)/g, ' ').split(/[^A-Za-z0-9]+/).filter(Boolean);
  const initials = words.map((w) => w[0]).join('').toUpperCase().slice(0, 4);
  return initials || 'AST';
}

/**
 * The next `count` references for a prefix at one property, after the
 * highest number already used there: ["FE-008", "FE-009"]. Three digits
 * minimum, matching the existing FE-001 convention. A technician's own
 * reference is always kept as typed — this only fills an empty one.
 */
export function nextAssetRefs(existingRefs: ReadonlyArray<string | null | undefined>, prefix: string, count: number): string[] {
  const pattern = new RegExp(`^${prefix.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}-(\\d+)$`, 'i');
  let max = 0;
  for (const ref of existingRefs) {
    const m = ref ? pattern.exec(ref.trim()) : null;
    if (m) max = Math.max(max, Number(m[1]));
  }
  return Array.from({ length: count }, (_, i) => `${prefix}-${String(max + i + 1).padStart(3, '0')}`);
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

// ─── formatLocationCode / formatLocationFull ─────────────────────────────────

// Location codes from the Tower / Level / Unit-or-Area builder: "1-1-2",
// "1-G-12A", "1-B1-CR", or "2-CR" (tower + area). Australian usage: "Level",
// with G = Ground; a unit is a number (optionally with a letter), anything
// else in that slot is an area code kept as typed (CR, PLANT...).
function locationParts(location: string): string[] | null {
  const parts = location.split('-').map((p) => p.trim());
  const structured = parts.length >= 2 && parts.length <= 3
    && parts.every((p) => p.length > 0 && p.length <= 6 && !p.includes(' '));
  return structured ? parts : null;
}
const isUnitNumber = (p: string) => /^\d+[A-Za-z]?$/.test(p);
const isLevelNumber = (p: string) => /^\d+$/.test(p);

/**
 * Compact form for cards, chips and group headers, where space is tight:
 *   '1-1-2'   -> 'T1 · L1 · U2'      '1-G-12A' -> 'T1 · G · U12A'
 *   '1-B1-CR' -> 'T1 · B1 · CR'      '2-CR'    -> 'T2 · CR'
 * Free-text locations ('Level 2 corridor') are returned unchanged.
 * FIX: an area code in the third slot used to print as "UCR"; and "Floor"
 * became "Level" (Australian usage) everywhere — app, report and admin.
 */
export function formatLocationCode(location: string): string {
  if (!location) return '';
  const parts = locationParts(location);
  if (!parts) return location;
  const tower = `T${parts[0]}`;
  if (parts.length === 2) return `${tower} · ${parts[1]}`;
  const level = isLevelNumber(parts[1]) ? `L${parts[1]}` : parts[1];
  const unit = isUnitNumber(parts[2]) ? `U${parts[2]}` : parts[2];
  return `${tower} · ${level} · ${unit}`;
}

/**
 * Written-out form, as printed in the PDF report:
 *   '1-1-2' -> 'Tower 1 · Level 1 · Unit 2'   '1-G-12A' -> 'Tower 1 · Ground · Unit 12A'
 *   '1-B1-CR' -> 'Tower 1 · Level B1 · CR'    '2-CR'    -> 'Tower 2 · CR'
 */
export function formatLocationFull(location: string | null | undefined): string {
  if (!location) return '';
  const parts = locationParts(location);
  if (!parts) return location;
  const tower = `Tower ${parts[0]}`;
  if (parts.length === 2) return `${tower} · ${parts[1]}`;
  const level = /^g$/i.test(parts[1]) ? 'Ground' : `Level ${parts[1]}`;
  const unit = isUnitNumber(parts[2]) ? `Unit ${parts[2]}` : parts[2];
  return `${tower} · ${level} · ${unit}`;
}

