import { SupabaseClient } from '@supabase/supabase-js';
import { config } from '../config';
import { fetchReportData } from '../data/fetchReportData';
import { buildAssetLogChunksByCategory } from '../data/chunking';
import { TocSectionEntry, rangesFromMarkers } from '../data/tableOfContents';
import { convertHtmlToPdf, waitForGotenbergReady } from '../gotenberg/client';
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
import { BASE_STYLE } from '../templates/theme';
import { uploadReport } from '../storage';
import { AssetTypeDefinition, Defect } from '../types';

export class ReportGenerationError extends Error {}

export interface PipelineResult {
  storagePath: string;
  signedUrl: string;
  assetCount: number;
  chunkCount: number;
  durationMs: number;
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
  /** False only for the very first section (the cover) — every section
   * after it starts on a fresh page, matching what merging separately-
   * rendered PDFs used to do unconditionally. */
  breakBefore: boolean;
}

function wrapSection({ key, html, breakBefore }: Section): string {
  const marker = key ? markerHtml(key) : '';
  const style = breakBefore ? ' style="break-before:page"' : '';
  return `<div${style}>${marker}${html}</div>`;
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

async function convertCombined(html: string, footerTemplate: string): Promise<Buffer> {
  return convertHtmlToPdf(html, 'combined_report', {
    headerTemplateHtml: EMPTY_HEADER_TEMPLATE,
    footerTemplateHtml: footerTemplate,
  });
}

export async function generateReport(db: SupabaseClient, jobId: string): Promise<PipelineResult> {
  const started = Date.now();

  // Kick off Gotenberg's cold-start check in parallel with the data fetch
  // below rather than after it — on Render's free tier, Gotenberg is often
  // asleep by the time a report is requested, and its cold boot (30-60s+)
  // can otherwise dwarf the actual data-fetch time.
  const gotenbergReady = waitForGotenbergReady().catch((err) => {
    console.warn(`[generate-report] Gotenberg warm-up check: ${err instanceof Error ? err.message : err}`);
  });

  const data = await fetchReportData(db, jobId);

  const { data: assetTypeDefRows } = await db
    .from('asset_type_definitions')
    .select('value, label, full_label, inspection_routine')
    .or(`company_id.eq.${data.job.company_id},company_id.is.null`);
  const assetTypesByValue = new Map<string, AssetTypeDefinition>(
    (assetTypeDefRows ?? []).map((t: AssetTypeDefinition) => [t.value, t]),
  );

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

  await gotenbergReady;

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
  const categorySections: Section[] = categoryLogs.flatMap((cat, catIndex) =>
    cat.chunks.map((chunk, chunkIndex): Section => ({
      key: chunkIndex === 0 ? categoryEntries[catIndex].key : undefined,
      html: renderAssetLogChunk(chunk, defectsByAsset, data.photosByAsset, data.signedPhotoUrls, data.fullResPhotoUrls),
      breakBefore: true,
    })),
  );
  const tailSections: Section[] = tailDocs.map((doc, i): Section => ({
    key: tailEntries[i].key,
    html: doc.html,
    breakBefore: true,
  }));

  // ── Pass 1: render with a placeholder Index — same real row labels, dummy
  // page numbers. Its own page count depends on how many rows it has to
  // print, not on the specific digits shown (same assumption the old
  // two-pass design already relied on), so this single render tells us
  // both the Index's true length AND exactly which page every other
  // section actually landed on.
  const placeholderCategoryEntries: TocSectionEntry[] = categoryEntries.map((e) => ({ label: e.label, startPage: 1, endPage: 1 }));
  const placeholderTailEntries: TocSectionEntry[] = tailEntries.map((e) => ({ label: e.label, startPage: 1, endPage: 1 }));

  let draftMarkers: Map<string, number>;
  let draftTotalPages: number;
  try {
    const draftDoc = buildDocument([
      { html: renderCover(data, assetTypesByValue), breakBefore: false },
      { key: 'idx', html: renderTableOfContents(placeholderCategoryEntries, placeholderTailEntries), breakBefore: true },
      ...categorySections,
      ...tailSections,
    ]);
    const draftBuffer = await convertCombined(draftDoc, footerTemplate);
    const scan = await findMarkerPages(draftBuffer, allMarkerKeys);
    draftMarkers = scan.pages;
    draftTotalPages = scan.totalPages;
  } catch (err) {
    throw new ReportGenerationError(
      `Rendering failed, report generation aborted: ${err instanceof Error ? err.message : err}`,
    );
  }

  const firstTailStart = tailEntries.length > 0 ? draftMarkers.get(tailEntries[0].key) : undefined;
  const categoryRanges = rangesFromMarkers(categoryEntries, draftMarkers, firstTailStart ?? draftTotalPages + 1);
  const tailRanges = rangesFromMarkers(tailEntries, draftMarkers, draftTotalPages + 1);

  // ── Pass 2: same document, real Index in place of the placeholder. The
  // asset-log/tail section HTML is byte-for-byte identical to pass 1, so
  // their internal pagination is unaffected — only the Index's own content
  // changes.
  let finalBuffer: Buffer;
  try {
    const finalDoc = buildDocument([
      { html: renderCover(data, assetTypesByValue), breakBefore: false },
      { key: 'idx', html: renderTableOfContents(categoryRanges, tailRanges), breakBefore: true },
      ...categorySections,
      ...tailSections,
    ]);
    finalBuffer = await convertCombined(finalDoc, footerTemplate);
  } catch (err) {
    throw new ReportGenerationError(
      `Rendering the final report failed, report generation aborted: ${err instanceof Error ? err.message : err}`,
    );
  }

  let output: Buffer;
  try {
    // Gotenberg's own page-number placeholders are left out of the footer
    // template (see headerFooter.ts) — even with a single render, Chromium's
    // native header/footer numbering can't be trusted mid-pass-1-vs-2, so
    // this still draws the correct final "Page X of Y" once everything is
    // settled, same as before.
    output = await stampPageNumbers(finalBuffer);
    // Ghostscript pass — mainly stream/image optimization now; the big win
    // (deduplicate 14 separate font subsets) no longer applies since there's
    // only ever one subset to begin with. Fails open if unavailable.
    output = await optimizePdf(output);
  } catch (err) {
    throw new ReportGenerationError(
      `Post-processing the rendered report failed, report generation aborted: ${err instanceof Error ? err.message : err}`,
    );
  }

  const { storagePath, signedUrl } = await uploadReport(db, jobId, output);

  return {
    storagePath,
    signedUrl,
    assetCount: data.assets.length,
    chunkCount: categorySections.length,
    durationMs: Date.now() - started,
  };
}
