/**
 * Invisible per-section text markers + the PDF text-extraction that finds
 * them afterward — this is what lets the whole report render as ONE single
 * Chromium document (see generation/pipeline.ts for why that matters: it's
 * the fix for ~57 duplicate embedded font subsets, one per previously-
 * separate section) while still knowing exactly which page every section
 * starts on, for a page-accurate Table of Contents.
 *
 * A plain string search on the PDF's raw bytes won't work: Chromium embeds
 * this report's substitute font as a subsetted, custom-encoded font, so
 * text-showing operators in the content stream contain glyph-index bytes,
 * not the original ASCII — there is no guarantee the literal marker string
 * appears anywhere in the raw file. pdfjs-dist decodes glyphs back to real
 * Unicode text per page (via the font's embedded ToUnicode map) the same
 * way a "select all + copy" in a PDF viewer would, which is what makes
 * marker detection actually reliable here.
 */
import { Buffer } from 'node:buffer';

const MARKER_PREFIX = '__SECTION_MARK_';
const MARKER_SUFFIX = '__';

/**
 * The invisible marker element to place as the very first thing inside a
 * section's wrapper. opacity:0 (not display:none/visibility:hidden, which
 * some renderers can omit from the page's actual content entirely) and kept
 * in NORMAL FLOW (not position:absolute) so its page placement is exactly
 * wherever normal pagination puts the first thing in this section.
 *
 * Confirmed by direct inspection: height:0 + overflow:hidden (an earlier
 * version of this) made Chromium skip painting the text altogether — a
 * clipped-to-zero-height box gets no layout area, so print-to-PDF never
 * emits a text-showing operator for it at all, and pdfjs-dist correctly
 * finds nothing (the marker was never actually IN the file, not a search
 * bug). A tiny but non-zero line-height keeps it genuinely painted — the
 * ~1px vertical footprint is identical on every section, so it doesn't
 * throw off page breaks relative to each other.
 */
export function markerHtml(key: string, color = '#ffffff'): string {
  // FIX: was a 6px-tall block in normal flow. Two problems once sections
  // stopped each starting a fresh page: (1) the marker could be left behind
  // at the bottom of a page when its section's first block moved to the
  // next one (the Index then pointed a page early — "Sign-off: Pages
  // 13–14" for a sign-off entirely on page 14); (2) pass 1 had the markers'
  // height and pass 2 (markers stripped) didn't, so pagination could differ
  // between the pass that measures and the pass that's delivered. Now it's
  // absolutely positioned (no height, no effect on layout) and placed INSIDE
  // the section's own heading bar by the pipeline (see wrapSection), painted
  // in the bar's own colour so it's invisible but still a real text paint
  // that pdfjs can find. text-transform/letter-spacing pinned: the bars are
  // uppercase + letter-spaced, which would turn "c1" into "C1" (or split
  // it with spaces) and the token would never match.
  // White-on-white, not opacity:0 — confirmed by direct testing that
  // Chromium's print-to-PDF genuinely skips painting (not just visually
  // hiding) content with opacity:0 or a zero-height clipped box: neither
  // produced a text-showing operator in the output at all, so pdfjs-dist
  // correctly found nothing (the marker was never in the file, not a
  // search bug — verified by making it fully visible, which round-tripped
  // successfully end to end). White text is a real, fully-opaque paint
  // operation matching the report's own white page background (theme.ts's
  // BASE_STYLE sets no background-color, so it's the default), which
  // Chromium has no reason to optimize away.
  return `<span style="position:absolute;left:2px;top:0;color:${color};font-size:6px;line-height:6px;white-space:nowrap;text-transform:none;letter-spacing:0;font-weight:400">${MARKER_PREFIX}${key}${MARKER_SUFFIX}</span>`;
}

export interface MarkerScanResult {
  /** First page (1-indexed) each marker key appears on. A key that never
   * appears (shouldn't happen — every section that needs measuring always
   * emits one) is simply absent; callers should treat that as a hard error
   * rather than guessing a fallback position. */
  pages: Map<string, number>;
  totalPages: number;
  /** True when nothing visible sits above the section's marker on its page
   * — i.e. the section starts at the top of a fresh page. With sections
   * flowing continuously, that's what tells the Index whether the previous
   * section ends on the page before or shares this one. */
  atTop: Map<string, boolean>;
}

type TextItem = { str?: string; transform?: number[] };

function startsAtTop(items: TextItem[], markerToken: string): boolean {
  const marker = items.find((it) => it.str?.includes(markerToken));
  const markerY = marker?.transform?.[5];
  if (markerY == null) return false; // split across items — assume it shares the page
  // PDF y grows upward: anything visible with a larger y is above the marker.
  return !items.some((it) =>
    it !== marker
    && !!it.str?.trim()
    && !it.str.includes(MARKER_PREFIX)
    && (it.transform?.[5] ?? -Infinity) > markerY + 2,
  );
}

/** Loads pdfjs ahead of the first report. Its first import costs ~2s (a
 * large ESM bundle) — paid at instance start-up instead of inside the first
 * technician's report on every fresh instance. Never throws. */
export function warmUpPdfjs(): void {
  import('pdfjs-dist/legacy/build/pdf.mjs').catch(() => {});
}

export async function findMarkerPages(pdfBuffer: Buffer, keys: string[]): Promise<MarkerScanResult> {
  // Dynamic import: pdfjs-dist ships ESM-only, this project compiles to
  // CommonJS — a static import would become a `require()` that fails.
  const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs');
  const doc = await pdfjs.getDocument({
    data: new Uint8Array(pdfBuffer),
    // No fonts/images need to actually be rendered/rasterized here — only
    // text extraction — and there's no display to attach a worker to in a
    // server process.
    isEvalSupported: false,
    useWorkerFetch: false,
  }).promise;

  const remaining = new Set(keys);
  const found = new Map<string, number>();
  const atTop = new Map<string, boolean>();

  for (let pageNum = 1; pageNum <= doc.numPages && remaining.size > 0; pageNum++) {
    const page = await doc.getPage(pageNum);
    const textContent = await page.getTextContent();
    const pageText = textContent.items.map((item) => ('str' in item ? item.str : '')).join('');

    for (const key of remaining) {
      if (pageText.includes(`${MARKER_PREFIX}${key}${MARKER_SUFFIX}`)) {
        found.set(key, pageNum);
        atTop.set(key, startsAtTop(textContent.items as TextItem[], `${MARKER_PREFIX}${key}`));
      }
    }
    for (const key of found.keys()) remaining.delete(key);
    page.cleanup();
  }

  const totalPages = doc.numPages;
  await doc.destroy();
  return { pages: found, totalPages, atTop };
}
