import { AssetTypeDefinition } from '../types';

export interface ParsedCategory {
  /** null when the source string has no leading "NN - " number, e.g. custom company asset types. */
  number: number | null;
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
    return { number: Number.parseInt(match[1], 10), name: match[2], label };
  }
  return { number: null, name: label, label };
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
): Array<{ label: string; number: number | null; items: T[] }> {
  const groups = new Map<string, { label: string; number: number | null; items: T[] }>();

  for (const item of items) {
    const typeDef = assetTypesByValue.get(getAssetTypeValue(item));
    const parsed = parseCategory(typeDef?.inspection_routine ?? 'General Inspection');
    const key = parsed.number != null ? `n:${parsed.number}:${parsed.label}` : `o:${parsed.label}`;
    if (!groups.has(key)) {
      groups.set(key, { label: parsed.label, number: parsed.number, items: [] });
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
