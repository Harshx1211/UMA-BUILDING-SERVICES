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
 * section's wrapper. Deliberately opacity:0 (not display:none/
 * visibility:hidden, which some renderers can omit from the page's actual
 * content entirely) and kept in NORMAL FLOW (not position:absolute) so its
 * page placement is exactly wherever normal pagination puts the first
 * thing in this section — no risk of an out-of-flow element getting
 * assigned to a different page than the content right after it.
 * height:0/overflow:hidden keeps it from taking any visible vertical space
 * despite being real, present text.
 */
export function markerHtml(key: string): string {
  return `<div style="opacity:0;height:0;overflow:hidden;font-size:1px;line-height:0" aria-hidden="true">${MARKER_PREFIX}${key}${MARKER_SUFFIX}</div>`;
}

export interface MarkerScanResult {
  /** First page (1-indexed) each marker key appears on. A key that never
   * appears (shouldn't happen — every section that needs measuring always
   * emits one) is simply absent; callers should treat that as a hard error
   * rather than guessing a fallback position. */
  pages: Map<string, number>;
  totalPages: number;
}

export async function findMarkerPages(pdfBuffer: Buffer, keys: string[]): Promise<MarkerScanResult> {
  // Dynamic import: pdfjs-dist ships ESM-only, this project compiles to
  // CommonJS — a static import would become a `require()` that fails.
  const pdfjs = await import('pdfjs-dist');
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

  for (let pageNum = 1; pageNum <= doc.numPages && remaining.size > 0; pageNum++) {
    const page = await doc.getPage(pageNum);
    const textContent = await page.getTextContent();
    const pageText = textContent.items.map((item) => ('str' in item ? item.str : '')).join('');

    for (const key of remaining) {
      if (pageText.includes(`${MARKER_PREFIX}${key}${MARKER_SUFFIX}`)) {
        found.set(key, pageNum);
      }
    }
    for (const key of found.keys()) remaining.delete(key);
    page.cleanup();
  }

  const totalPages = doc.numPages;
  await doc.destroy();
  return { pages: found, totalPages };
}
