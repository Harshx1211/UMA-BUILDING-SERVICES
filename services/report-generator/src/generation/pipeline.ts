import { SupabaseClient } from '@supabase/supabase-js';
import { config } from '../config';
import { fetchReportData } from '../data/fetchReportData';
import { buildAssetLogChunksByCategory } from '../data/chunking';
import { TocSectionEntry, rangesFromMarkers } from '../data/tableOfContents';
import { convertHtmlToPdf, launchBrowser } from '../render/chromium';
import type { Browser } from 'puppeteer-core';
import { stampPageNumbers } from '../pdf/stampPageNumbers';
import { optimizePdf } from '../pdf/optimizePdf';
import { markerHtml, findMarkerPages } from '../pdf/pageMarkers';
import { renderCover } from '../templates/cover';
import { renderAssetLogChunk } from '../templates/assetLogChunk';
import { renderTableOfContents } from '../templates/tableOfContents';
import { renderUnlinkedDefects } from '../templates/unlinkedDefects';
import { renderRepairs } from '../templates/repairs';
import { renderYearlyConditionReport } from '../templates/yearlyConditionReport';
import { renderSignoff } from '../templates/signoff';
import { buildFooterTemplate, EMPTY_HEADER_TEMPLATE } from '../templates/headerFooter';
import { BASE_STYLE, COLORS } from '../templates/theme';
import { uploadReport } from '../storage';
import { StageTimer } from './stageTimer';

export { StageTimer };
import { AssetTypeDefinition, Defect, ReportData } from '../types';

export class ReportGenerationError extends Error {}

export interface PipelineResult {
  storagePath: string;
  signedUrl: string;
  assetCount: number;
  chunkCount: number;
  durationMs: number;
  /** Per-stage wall-clock breakdown, e.g. "fetch=1200ms pass1=900ms …" —
   * logged with every generation so a slow report shows WHERE it was slow. */
  timings: string;
}


// Human-facing labels for the tail sections' Index entries — the internal
// keys below are just marker/lookup keys, not display text.
const TAIL_LABELS: Record<string, string> = {
  unlinked_defects: 'Additional Observations',
  repairs: 'Repairs & Quotation',
  yearly_condition_report: 'Yearly Condition Report (Appendix E)',
  signoff: 'Sign-off',
};

interface Section {
  /** Marker key, omitted for interior chunks of a multi-chunk category —
   * see categorySections below for why only the first chunk needs one. */
  key?: string;
  html: string;
  /** Keep the whole section on one page (e.g. the sign-off). */
  keep?: boolean;
  /** False only for the very first section (the cover) — every section
   * after it starts on a fresh page, matching what merging separately-
   * rendered PDFs used to do unconditionally. */
  breakBefore: boolean;
}

// The first heading bar of a section — a page-break can never separate it
// from the section's own content (theme.ts), so it's the one reliable place
// to anchor the section's page marker.
const FIRST_BAR = /<(?:div|th)[^>]*class="(?:section-bar|cat-th)"[^>]*>/;

function wrapSection({ key, html, breakBefore, keep }: Section): string {
  let body = html;
  let topMarker = '';
  if (key) {
    const bar = breakBefore ? null : FIRST_BAR.exec(body);
    if (bar) {
      // Inside the bar, painted in the bar's own navy: invisible, zero height.
      const at = bar.index + bar[0].length;
      body = body.slice(0, at) + markerHtml(key, COLORS.NAVY) + body.slice(at);
    } else {
      // A section that starts on a fresh page: its top IS the page top.
      topMarker = markerHtml(key);
    }
  }
  const style = `position:relative${breakBefore ? ';break-before:page' : ''}`;
  return `<div${keep ? ' class="keep"' : ''} style="${style}">${topMarker}${body}</div>`;
}

/**
 * Wraps every section in ONE combined document instead of each becoming its
 * own separate Gotenberg-rendered PDF later merged together. This is the
 * actual fix for a real, measured problem: every one of those separate
 * Chromium renders independently embedded its own subset of whatever font
 * the container substitutes for Helvetica/Arial (Docker/Linux images
 * essentially never have the real thing installed) — 57 duplicate font
 * objects, 350-375KB, on both an 11-asset AND a 140-asset test report
 * (fixed cost, driven by section count, not report size). One document
 * means Chromium subsets the font exactly once.
 */
function buildDocument(sections: Section[]): string {
  return `<!DOCTYPE html>
<html><head><meta charset="utf-8" /><style>${BASE_STYLE}</style></head>
<body>${sections.map(wrapSection).join('')}</body></html>`;
}

async function convertCombined(html: string, footerTemplate: string, browser?: Browser): Promise<Buffer> {
  return convertHtmlToPdf(html, 'combined_report', {
    headerTemplateHtml: EMPTY_HEADER_TEMPLATE,
    footerTemplateHtml: footerTemplate,
  }, browser);
}

export async function generateReport(db: SupabaseClient, jobId: string): Promise<PipelineResult> {
  const started = Date.now();
  const timer = new StageTimer();

  // PERF: start Chromium now so its launch — the slowest single step on a
  // freshly started instance — overlaps the data fetch instead of following
  // it. Never rejects (renderReportPdf falls back to its own launch).
  const browserPromise = launchBrowser().catch(() => undefined);

  let data: Awaited<ReturnType<typeof fetchReportData>>;
  try {
    data = await fetchReportData(db, jobId, timer);
  } catch (err) {
    void browserPromise.then((b) => b?.close().catch(() => {}));
    throw err;
  }

  // Fetched inside fetchReportData (in the same concurrent round as
  // everything else) and checked there — a failed read aborts generation
  // rather than producing a report with every category label missing.
  const assetTypesByValue = data.assetTypesByValue;

  const { pdf, chunkCount } = await renderReportPdf(data, assetTypesByValue, timer, browserPromise);

  const { storagePath, signedUrl } = await uploadReport(db, jobId, pdf);
  timer.lap('upload');

  return {
    storagePath,
    signedUrl,
    assetCount: data.assets.length,
    chunkCount,
    durationMs: Date.now() - started,
    timings: timer.toString(),
  };
}

/**
 * Everything between "data fetched" and "PDF ready to upload": both render
 * passes, page-number stamping and the Ghostscript pass. Pure function of
 * the report data — no Supabase access — so test/render.localtest.ts can
 * drive the real renderer with synthetic data at any scale.
 */
export async function renderReportPdf(
  data: ReportData,
  assetTypesByValue: Map<string, AssetTypeDefinition>,
  timer: StageTimer = new StageTimer(),
  /** An already-launching browser (see generateReport); launched here if omitted. */
  browserPromise?: Promise<Browser | undefined>,
): Promise<{ pdf: Buffer; chunkCount: number }> {
  const defectsByAsset = new Map<string, Defect[]>();
  for (const d of data.defects) {
    if (!d.asset_id) continue;
    const list = defectsByAsset.get(d.asset_id) ?? [];
    list.push(d);
    defectsByAsset.set(d.asset_id, list);
  }

  const categoryLogs = buildAssetLogChunksByCategory(data.assets, assetTypesByValue, config.maxAssetsPerChunk);
  const footerTemplate = buildFooterTemplate(data.company);

  const unlinkedHtml = renderUnlinkedDefects(data.defects, data.photosByDefect, data.signedPhotoUrls, data.fullResPhotoUrls);
  const repairsHtml = renderRepairs(data.defects, data.approvedQuote, data.photosByDefect, data.signedPhotoUrls, data.fullResPhotoUrls);
  const ycrHtml = renderYearlyConditionReport(data, assetTypesByValue);
  const signoffHtml = renderSignoff(data);

  const tailDocs: Array<{ key: string; html: string }> = [
    ...(unlinkedHtml ? [{ key: 'unlinked_defects', html: unlinkedHtml }] : []),
    ...(repairsHtml ? [{ key: 'repairs', html: repairsHtml }] : []),
    { key: 'yearly_condition_report', html: ycrHtml },
    { key: 'signoff', html: signoffHtml },
  ];

  // Marker keys are short, plain alphanumeric tokens (c0, c1, t0, ...) —
  // deliberately NOT the real category/tail labels, which contain spaces,
  // punctuation and parentheses. A descriptive label is exactly the kind of
  // string a PDF text layer can fragment into several separate text-content
  // items (kerning pairs, word-spacing runs), which broke a naive
  // concatenate-and-substring-search the first time this was tried — a
  // short single-run token isn't immune in principle, but is far less
  // likely to ever get split mid-token.
  const categoryEntries = categoryLogs.map((cat, i) => ({ key: `c${i}`, label: cat.label }));
  const tailEntries = tailDocs.map((doc, i) => ({ key: `t${i}`, label: TAIL_LABELS[doc.key] ?? doc.key }));
  const allMarkerKeys = ['idx', ...categoryEntries.map((e) => e.key), ...tailEntries.map((e) => e.key)];

  // A category almost always renders as exactly one chunk — chunking within
  // a category only kicks in on the rare 1000+-assets-of-one-type case (see
  // chunking.ts). Only the FIRST chunk of a category carries a marker: a
  // category's page range is derived from where IT starts and where the
  // NEXT category starts, so interior chunks don't need their own measured
  // position, just their own page-break to keep chunk boundaries where they
  // were before (each used to be a separately-merged PDF, always starting a
  // fresh page).
  // Only the asset log as a whole starts on a fresh page (after the
  // Index); categories then flow one after another. FIX: every category used
  // to start a new page — a small job came out as 17 mostly-empty pages for
  // 17 assets. Each asset block still never splits (theme.ts).
  const categorySections: Section[] = categoryLogs.flatMap((cat, catIndex) =>
    cat.chunks.map((chunk, chunkIndex): Section => ({
      key: chunkIndex === 0 ? categoryEntries[catIndex].key : undefined,
      html: renderAssetLogChunk(chunk, defectsByAsset, data.photosByAsset, data.photosByDefect, data.signedPhotoUrls, data.fullResPhotoUrls),
      breakBefore: catIndex === 0 && chunkIndex === 0,
    })),
  );
  // The Yearly Condition Report is a formal appendix — it keeps its own
  // fresh page. Additional observations, repairs and the sign-off flow on,
  // and the sign-off is kept in one piece.
  const tailSections: Section[] = tailDocs.map((doc, i): Section => ({
    key: tailEntries[i].key,
    html: doc.html,
    keep: doc.key === 'signoff',
    breakBefore: doc.key === 'yearly_condition_report',
  }));

  // ── Pass 1: render with a placeholder Index — same real row labels, dummy
  // page numbers. Its own page count depends on how many rows it has to
  // print, not on the specific digits shown (same assumption the old
  // two-pass design already relied on), so this single render tells us
  // both the Index's true length AND exactly which page every other
  // section actually landed on.
  const placeholderCategoryEntries: TocSectionEntry[] = categoryEntries.map((e) => ({ label: e.label, startPage: 1, endPage: 1 }));
  const placeholderTailEntries: TocSectionEntry[] = tailEntries.map((e) => ({ label: e.label, startPage: 1, endPage: 1 }));

  // One browser for both passes (see convertHtmlToPdf's sharedBrowser note).
  // If launching it fails, each pass just launches its own as before.
  const browser = await (browserPromise ?? launchBrowser().catch(() => undefined));
  timer.lap('browser');
  let finalBuffer: Buffer;
  try {
    let draftMarkers: Map<string, number>;
    let draftTotalPages: number;
    let draftAtTop: Map<string, boolean>;
    try {
      const draftDoc = buildDocument([
        { html: renderCover(data, assetTypesByValue), breakBefore: false },
        { key: 'idx', html: renderTableOfContents(placeholderCategoryEntries, placeholderTailEntries), breakBefore: true },
        ...categorySections,
        ...tailSections,
      ]);
      timer.lap('html');
      const draftBuffer = await convertCombined(draftDoc, footerTemplate, browser);
      timer.lap('pass1');
      const scan = await findMarkerPages(draftBuffer, allMarkerKeys);
      timer.lap('markers');
      draftMarkers = scan.pages;
      draftTotalPages = scan.totalPages;
      draftAtTop = scan.atTop;
      // A section with a forced page break starts at the top by definition
      // (the scan can't always tell — e.g. a title precedes its first bar).
      for (const s of [...categorySections, ...tailSections]) {
        if (s.key && s.breakBefore) draftAtTop.set(s.key, true);
      }
    } catch (err) {
      throw new ReportGenerationError(
        `Rendering failed, report generation aborted: ${err instanceof Error ? err.message : err}`,
      );
    }

    const firstTailStart = tailEntries.length > 0 ? draftMarkers.get(tailEntries[0].key) : undefined;
    const firstTailAtTop = tailEntries.length > 0 ? (draftAtTop.get(tailEntries[0].key) ?? true) : true;
    const categoryRanges = rangesFromMarkers(categoryEntries, draftMarkers, firstTailStart ?? draftTotalPages + 1, draftAtTop, firstTailAtTop);
    const tailRanges = rangesFromMarkers(tailEntries, draftMarkers, draftTotalPages + 1, draftAtTop, true);

    // ── Pass 2: same document, real Index in place of the placeholder. The
    // asset-log/tail section HTML is byte-for-byte identical to pass 1, so
    // their internal pagination is unaffected — only the Index's own content
    // changes. Markers are dropped entirely here — this is the document that
    // actually gets delivered, and it never needs to re-measure itself, so
    // there's no reason for the (invisible-but-copy/paste-visible) marker
    // text to exist in what a client could select or run through a text
    // extractor.
    const stripMarkers = (sections: Section[]): Section[] => sections.map((s) => ({ ...s, key: undefined }));
    try {
      const finalDoc = buildDocument([
        { html: renderCover(data, assetTypesByValue), breakBefore: false },
        { html: renderTableOfContents(categoryRanges, tailRanges), breakBefore: true },
        ...stripMarkers(categorySections),
        ...stripMarkers(tailSections),
      ]);
      finalBuffer = await convertCombined(finalDoc, footerTemplate, browser);
      timer.lap('pass2');
    } catch (err) {
      throw new ReportGenerationError(
        `Rendering the final report failed, report generation aborted: ${err instanceof Error ? err.message : err}`,
      );
    }

  } finally {
    if (browser) await browser.close().catch(() => {});
  }

  let output: Buffer;
  try {
    // Gotenberg's own page-number placeholders are left out of the footer
    // template (see headerFooter.ts) — even with a single render, Chromium's
    // native header/footer numbering can't be trusted mid-pass-1-vs-2, so
    // this still draws the correct final "Page X of Y" once everything is
    // settled, same as before.
    output = await stampPageNumbers(finalBuffer);
    timer.lap('stamp');
    // Ghostscript pass — mainly stream/image optimization now; the big win
    // (deduplicate 14 separate font subsets) no longer applies since there's
    // only ever one subset to begin with. Fails open if unavailable.
    output = await optimizePdf(output);
    timer.lap('ghostscript');
  } catch (err) {
    throw new ReportGenerationError(
      `Post-processing the rendered report failed, report generation aborted: ${err instanceof Error ? err.message : err}`,
    );
  }

  return { pdf: output, chunkCount: categorySections.length };
}
