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
  /** Per-key "starts at the top of its page" (see pageMarkers.ts). Omitted =
   * every section starts on a fresh page (the old behaviour). */
  startsAtTop?: Map<string, boolean>,
  /** Same, for whatever comes after this whole sequence. */
  nextStartsAtTop = true,
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
    // A following section that starts mid-page shares that page with this
    // one, so this one ends there; one that starts on a fresh page means
    // this one ended on the page before.
    const followingAtTop = i + 1 < entries.length
      ? (startsAtTop?.get(entries[i + 1].key) ?? true)
      : nextStartsAtTop;
    const endPage = Math.max(startPage, followingAtTop ? followingStart - 1 : followingStart);
    return { label: entry.label, startPage, endPage };
  });
}
