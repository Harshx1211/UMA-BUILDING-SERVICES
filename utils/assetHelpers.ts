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
// A tower is a number (1, 2A) or a letter or two (A, NW); a level is G, LG,
// UG, M, RF, or a number with an optional B/L/P prefix (1, L3, B1, P2). The
// Unit / Area box is free, so anything goes in the third slot ("Pump room").
// Ordinary text with hyphens ("North-East stair", "Lift-1-Lobby") doesn't
// fit the tower/level shape and is left as typed.
const isTowerCode = (p: string) => /^(\d{1,3}[A-Za-z]?|[A-Za-z]{1,2})$/.test(p);
const isLevelCode = (p: string) => /^(G|LG|UG|M|RF|[BLP]?\d{1,3}[A-Za-z]?)$/i.test(p);
function locationParts(location: string): string[] | null {
  const parts = location.split('-').map((p) => p.trim());
  if (parts.length < 2 || parts.some((p) => p.length === 0) || !isTowerCode(parts[0])) return null;
  if (parts.length === 2) return parts[1].length <= 6 && !parts[1].includes(' ') ? parts : null;
  return isLevelCode(parts[1]) ? [parts[0], parts[1], parts.slice(2).join('-')] : null;
}
/** Australian building usage: Ground, Lower/Upper Ground, Mezzanine, Roof,
 * otherwise "Level 3" / "Level B1". */
function levelName(p: string): string {
  const named: Record<string, string> = { G: 'Ground', LG: 'Lower Ground', UG: 'Upper Ground', M: 'Mezzanine', RF: 'Roof' };
  const code = p.toUpperCase();
  return named[code] ?? `Level ${code.replace(/^L(?=\d)/, '')}`;
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
  const level = isLevelNumber(parts[1]) ? `L${parts[1]}` : parts[1].toUpperCase();
  const unit = isUnitNumber(parts[2]) ? `U${parts[2]}` : parts[2];
  return `${tower} · ${level} · ${unit}`;
}

// ─── Location picker support (components/inspections/LocationPicker.tsx) ─────

/** A location split into its tower / level / unit-or-area. `level` is '' for
 * a two-part code ("2-CR"). Null for free text ("Plant room east"). */
export interface LocationParts { tower: string; level: string; unit: string }

export function parseLocation(location: string | null | undefined): LocationParts | null {
  if (!location) return null;
  const parts = locationParts(location);
  if (!parts) return null;
  return parts.length === 2
    ? { tower: parts[0], level: '', unit: parts[1] }
    : { tower: parts[0], level: parts[1], unit: parts[2] };
}

export function buildLocation(p: LocationParts): string {
  return p.level ? `${p.tower}-${p.level}-${p.unit}` : `${p.tower}-${p.unit}`;
}

export { isTowerCode, isUnitNumber };
export const formatLevelName = (level: string): string => levelName(level);
export const formatUnitName = (unit: string): string => (isUnitNumber(unit) ? `Unit ${unit}` : unit);

/** Ground first, basements below it, then levels by number. */
export function compareLevels(a: string, b: string): number {
  const key = (l: string) => {
    const c = l.toUpperCase();
    if (c === 'LG') return -0.5;
    if (c === 'G') return 0;
    if (c === 'UG') return 0.5;
    if (c === 'M') return 0.75;
    if (c === 'RF') return 10_000;
    const b = /^B(\d+)/.exec(c); if (b) return -Number(b[1]);
    const p = /^P(\d+)/.exec(c); if (p) return -100 - Number(p[1]);
    const n = /^L?(\d+)/.exec(c); return n ? Number(n[1]) : 9_999;
  };
  return key(a) - key(b) || a.localeCompare(b);
}

/** Unit numbers first in number order, then named areas A–Z. */
export function compareUnits(a: string, b: string): number {
  const na = isUnitNumber(a), nb = isUnitNumber(b);
  if (na && nb) return parseInt(a, 10) - parseInt(b, 10) || a.localeCompare(b);
  if (na !== nb) return na ? -1 : 1;
  return a.localeCompare(b);
}

/** What a technician types for a level, as the stored code: "Ground" -> G,
 * "Level 3" -> 3, "Basement 1" -> B1, "Roof" -> RF. Null if it isn't a level
 * the location format can hold. */
export function normalizeLevelInput(raw: string): string | null {
  const v = raw.trim().replace(/\s+/g, ' ');
  if (!v) return null;
  const named: Record<string, string> = {
    ground: 'G', 'ground floor': 'G', g: 'G', 'lower ground': 'LG', lg: 'LG', 'upper ground': 'UG', ug: 'UG',
    mezzanine: 'M', mezz: 'M', m: 'M', roof: 'RF', rooftop: 'RF', rf: 'RF',
  };
  const n = named[v.toLowerCase()];
  if (n) return n;
  const basement = /^basement\s*(\d{1,2})$/i.exec(v); if (basement) return `B${basement[1]}`;
  const level = /^(?:level|lvl|floor|l)\s*(\d{1,3}[A-Za-z]?)$/i.exec(v); if (level) return level[1].toUpperCase();
  const code = v.toUpperCase();
  return isLevelCode(code) ? code : null;
}

/** "Unit 12A" -> "12A"; anything else kept as typed. Hyphens become spaces
 * so the text can't be mistaken for extra location parts. */
export function normalizeUnitInput(raw: string): string {
  return raw.trim().replace(/^unit\s+/i, '').replace(/\s*-\s*/g, ' ').replace(/\s+/g, ' ');
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
  const level = levelName(parts[1]);
  const unit = isUnitNumber(parts[2]) ? `Unit ${parts[2]}` : parts[2];
  return `${tower} · ${level} · ${unit}`;
}

