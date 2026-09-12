export interface TocSectionEntry {
  label: string;
  startPage: number;
  endPage: number;
}

/**
 * Turns a sequence of sections into consecutive, non-overlapping page ranges
 * from their MEASURED start-page positions (see pdf/pageMarkers.ts — the
 * whole report renders as one combined document now, with an invisible
 * marker at the start of each section, rather than each section being a
 * separately-rendered PDF whose own page count could be read directly).
 * `nextStartPage` is where the section right after this whole sequence
 * begins (or the final page + 1, for the very last sequence in the
 * document). Pure arithmetic — no Gotenberg or pdf-lib involved here — so
 * this is fully unit-testable without ever rendering a page (see
 * test/templates.smoketest.ts).
 */
export function rangesFromMarkers(
  entries: Array<{ key: string; label: string }>,
  markerPages: Map<string, number>,
  nextStartPage: number,
): TocSectionEntry[] {
  return entries.map((entry, i) => {
    const startPage = markerPages.get(entry.key);
    if (startPage == null) {
      throw new Error(`Internal error: no measured page position for section "${entry.key}"`);
    }
    const followingStart = i + 1 < entries.length ? markerPages.get(entries[i + 1].key) : nextStartPage;
    if (followingStart == null) {
      throw new Error(`Internal error: no measured page position for section "${entries[i + 1].key}"`);
    }
    return { label: entry.label, startPage, endPage: followingStart - 1 };
  });
}
