export interface TocSectionEntry {
  label: string;
  startPage: number;
  endPage: number;
}

/**
 * Turns a sequence of already-measured page counts into consecutive page
 * ranges, given the page number the sequence starts on. Pure arithmetic —
 * no Gotenberg or pdf-lib involved here — so this is fully unit-testable
 * without ever rendering a page (see test/templates.smoketest.ts).
 */
export function computeSequentialRanges(
  sections: Array<{ label: string; pageCount: number }>,
  firstPage: number,
): TocSectionEntry[] {
  let cursor = firstPage;
  return sections.map(({ label, pageCount }) => {
    const startPage = cursor;
    // A section should never legitimately render as 0 pages, but guard
    // against it anyway so a bad measurement can't collapse the whole
    // downstream page range onto a single number.
    const endPage = cursor + Math.max(pageCount, 1) - 1;
    cursor = endPage + 1;
    return { label, startPage, endPage };
  });
}
