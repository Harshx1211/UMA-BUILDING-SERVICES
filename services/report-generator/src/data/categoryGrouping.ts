import { AssetTypeDefinition } from '../types';

/**
 * AS1851-2012's real Section 2-14 list, verified against the standard text — it
 * defines no Section 0, 1, or 15+ for asset-servicing categories. SiteTrack (and
 * the reference report this app's PDF was modelled on) uses "15 - Emergency escape
 * lighting and exit signs" as an industry-convention category number, but that's
 * actually AS 2293's territory, not AS1851's — so it, and any other out-of-range
 * number, must never be presented as a real AS1851 Section in compliance output.
 */
export const AS1851_SECTIONS: Record<number, string> = {
  2: 'Automatic fire sprinkler systems',
  3: 'Fire pumpset systems',
  4: 'Fire hydrant systems',
  5: 'Fire water storage tanks',
  6: 'Automatic fire detection and alarm systems',
  7: 'Special hazard fire suppression systems',
  8: 'Lay flat fire hoses',
  9: 'Fire hose reel systems',
  10: 'Portable and wheeled fire extinguishers',
  11: 'Fire blankets',
  12: 'Passive fire and smoke systems',
  13: 'Air handling systems used for smoke hazard management',
  14: 'Emergency planning in facilities',
};

/** Verifies a parsed leading number against the real Section list — null if it isn't one. */
export function officialSectionFor(number: number | null): number | null {
  return number != null && number in AS1851_SECTIONS ? number : null;
}

export interface ParsedCategory {
  /** null when the source string has no leading "NN - " number, e.g. custom company asset types. */
  number: number | null;
  /** `number`, but only when it's a real AS1851 Section 2-14 — null otherwise (e.g. "15"). */
  officialSection: number | null;
  /** Category name with the number/frequency stripped, e.g. "Fire Hydrant Systems". */
  name: string;
  /** Full original string, used as the display label, e.g. "04 - Fire Hydrant Systems (Annual)". */
  label: string;
}

// Matches "10 - Portable and Wheeled Fire Extinguishers (Annual)" -> number=10, name=rest.
// `inspection_routine` is freeform text (verified against live data — 8 of 9 current
// asset types follow this pattern, one custom type and the column default don't).
// Rather than force every asset type into a fake AS1851 number, anything that
// doesn't match this shape falls back to an "Other" bucket, sorted after the
// numbered categories — see groupByCategory() below.
const NUMBERED_PREFIX = /^\s*(\d+)\s*-\s*(.+?)\s*$/;

export function parseCategory(inspectionRoutine: string): ParsedCategory {
  const label = inspectionRoutine.trim() || 'General Inspection';
  const match = NUMBERED_PREFIX.exec(label);
  if (match) {
    const number = Number.parseInt(match[1], 10);
    return { number, officialSection: officialSectionFor(number), name: match[2], label };
  }
  return { number: null, officialSection: null, name: label, label };
}

export const OTHER_CATEGORY_LABEL = 'Other';

/**
 * Groups items by their asset type's category, sorted numbered-categories-first
 * (ascending), then any unnumbered types alphabetically under "Other" — matching
 * the reference report's per-category grouping without requiring every asset type
 * to have an official AS1851 number.
 */
export function groupByCategory<T>(
  items: T[],
  getAssetTypeValue: (item: T) => string,
  assetTypesByValue: Map<string, AssetTypeDefinition>,
): Array<{ label: string; number: number | null; officialSection: number | null; items: T[] }> {
  const groups = new Map<string, { label: string; number: number | null; officialSection: number | null; items: T[] }>();

  for (const item of items) {
    const typeDef = assetTypesByValue.get(getAssetTypeValue(item));
    const parsed = parseCategory(typeDef?.inspection_routine ?? 'General Inspection');
    const key = parsed.number != null ? `n:${parsed.number}:${parsed.label}` : `o:${parsed.label}`;
    if (!groups.has(key)) {
      groups.set(key, { label: parsed.label, number: parsed.number, officialSection: parsed.officialSection, items: [] });
    }
    groups.get(key)!.items.push(item);
  }

  return [...groups.values()].sort((a, b) => {
    if (a.number != null && b.number != null) return a.number - b.number;
    if (a.number != null) return -1; // numbered categories always sort before "Other"
    if (b.number != null) return 1;
    return a.label.localeCompare(b.label);
  });
}
