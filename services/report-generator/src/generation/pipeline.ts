import { SupabaseClient } from '@supabase/supabase-js';
import { config } from '../config';
import { fetchReportData } from '../data/fetchReportData';
import { buildAssetLogChunksByCategory } from '../data/chunking';
import { computeSequentialRanges } from '../data/tableOfContents';
import { mapWithConcurrency } from '../concurrency';
import { convertHtmlToPdf, mergePdfs, waitForGotenbergReady } from '../gotenberg/client';
import { getPdfPageCount } from '../pdf/pageCount';
import { stampPageNumbers } from '../pdf/stampPageNumbers';
import { renderCover } from '../templates/cover';
import { renderAssetLogChunk } from '../templates/assetLogChunk';
import { renderTableOfContents } from '../templates/tableOfContents';
import { renderUnlinkedDefects } from '../templates/unlinkedDefects';
import { renderRepairs } from '../templates/repairs';
import { renderYearlyConditionReport } from '../templates/yearlyConditionReport';
import { renderSignoff } from '../templates/signoff';
import { buildFooterTemplate, EMPTY_HEADER_TEMPLATE } from '../templates/headerFooter';
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
// document names below are just merge-order sort keys, not display text.
const TAIL_LABELS: Record<string, string> = {
  unlinked_defects: 'Additional Observations',
  repairs: 'Repairs & Quotation',
  yearly_condition_report: 'Yearly Condition Report (Appendix E)',
  signoff: 'Sign-off',
};

async function renderAndCount(
  html: string,
  label: string,
  footerTemplate: string,
): Promise<{ buffer: Buffer; pageCount: number }> {
  const buffer = await convertHtmlToPdf(html, label, {
    headerTemplateHtml: EMPTY_HEADER_TEMPLATE,
    footerTemplateHtml: footerTemplate,
  });
  const pageCount = await getPdfPageCount(buffer);
  return { buffer, pageCount };
}

export async function generateReport(db: SupabaseClient, jobId: string): Promise<PipelineResult> {
  const started = Date.now();

  // Kick off Gotenberg's cold-start check in parallel with the data fetch
  // below rather than after it — on Render's free tier, Gotenberg is often
  // asleep by the time a report is requested, and its cold boot (30-60s+)
  // can otherwise dwarf the actual data-fetch time. Not awaited yet; picked
  // up again just before the first real convert call.
  const gotenbergReady = waitForGotenbergReady().catch((err) => {
    // Don't fail generation on the warm-up check alone — the real convert
    // call still gets its own retries and will surface a proper error if
    // Gotenberg is genuinely unreachable, not just slow to wake up.
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

  const unlinkedHtml = renderUnlinkedDefects(data.defects, data.photosByDefect, data.signedPhotoUrls);
  const repairsHtml = renderRepairs(data.defects, data.approvedQuote, data.photosByDefect, data.signedPhotoUrls);
  const ycrHtml = renderYearlyConditionReport(data, assetTypesByValue);
  const signoffHtml = renderSignoff(data);

  const tailDocs: Array<{ key: string; html: string }> = [
    ...(unlinkedHtml ? [{ key: 'unlinked_defects', html: unlinkedHtml }] : []),
    ...(repairsHtml ? [{ key: 'repairs', html: repairsHtml }] : []),
    { key: 'yearly_condition_report', html: ycrHtml },
    { key: 'signoff', html: signoffHtml },
  ];

  // By now the data fetch (and Gotenberg's cold-start window, if it needed
  // one) have had time to overlap; this resolves instantly if Gotenberg was
  // already warm.
  await gotenbergReady;

  // ── Every top-level section (cover, each category chunk, each tail section)
  // gets its own Gotenberg render so its exact page count is knowable via
  // pdf-lib afterward — the only reliable way to build a page-accurate Index,
  // since Chromium's own pagination can't be predicted from the source HTML
  // alone. This trades away the old "one combined render for small jobs" fast
  // path, so even a small report is several separate Chromium round trips.
  //
  // These sections don't depend on each other, so they're all queued as one
  // flat batch here (instead of three sequential await stages: cover, then
  // ALL categories, then ALL tail docs) — config.gotenbergConcurrency workers
  // pull from the combined queue, keeping Gotenberg equally busy the whole
  // time rather than idling between stages. This was previously also the
  // only place gotenbergConcurrency could be silently exceeded: a category
  // split into multiple chunks fanned out via an inner unbounded Promise.all,
  // so a single large category could launch far more concurrent renders than
  // the configured limit. Flattening onto one queue fixes that too.
  type SectionJob =
    | { kind: 'cover' }
    | { kind: 'category'; catIndex: number; chunkIndex: number; label: string; html: string }
    | { kind: 'tail'; tailIndex: number; key: string; html: string };

  const jobs: SectionJob[] = [
    { kind: 'cover' },
    ...categoryLogs.flatMap((cat, catIndex) =>
      cat.chunks.map((chunk, chunkIndex) => ({
        kind: 'category' as const,
        catIndex,
        chunkIndex,
        label: cat.label,
        html: renderAssetLogChunk(chunk, defectsByAsset, data.photosByAsset, data.photosByDefect, data.signedPhotoUrls),
      })),
    ),
    ...tailDocs.map((doc, tailIndex) => ({ kind: 'tail' as const, tailIndex, key: doc.key, html: doc.html })),
  ];

  let coverRendered!: { buffer: Buffer; pageCount: number };
  const categoryBuffers: Buffer[][] = categoryLogs.map((cat) => new Array(cat.chunks.length));
  const categoryPageCounts: number[][] = categoryLogs.map((cat) => new Array(cat.chunks.length).fill(0));
  const tailResults: Array<{ key: string; buffer: Buffer; pageCount: number }> = new Array(tailDocs.length);

  try {
    await mapWithConcurrency(jobs, config.gotenbergConcurrency, async (job) => {
      if (job.kind === 'cover') {
        coverRendered = await renderAndCount(renderCover(data, assetTypesByValue), 'cover', footerTemplate);
        return;
      }
      if (job.kind === 'category') {
        const r = await renderAndCount(job.html, `asset_log_${job.label}`, footerTemplate);
        categoryBuffers[job.catIndex][job.chunkIndex] = r.buffer;
        categoryPageCounts[job.catIndex][job.chunkIndex] = r.pageCount;
        return;
      }
      const r = await renderAndCount(job.html, job.key, footerTemplate);
      tailResults[job.tailIndex] = { key: job.key, buffer: r.buffer, pageCount: r.pageCount };
    });
  } catch (err) {
    throw new ReportGenerationError(
      `Rendering failed, report generation aborted: ${err instanceof Error ? err.message : err}`,
    );
  }

  const categoryRendered = categoryLogs.map((cat, ci) => ({
    label: cat.label,
    buffers: categoryBuffers[ci],
    pageCount: categoryPageCounts[ci].reduce((sum, n) => sum + n, 0),
  }));
  const tailRendered = tailResults;

  // ── Build the Index. Pass 1 renders it with a placeholder page-count
  // assumption purely to measure the Index's OWN page count — that
  // measurement only depends on how many rows/labels it has to print, not on
  // the specific numbers shown, so it's stable regardless of the placeholder.
  // Pass 2 then renders the real, final version using that measured length,
  // so the page numbers it prints are correct. Two renders, but the only way
  // for the Index to correctly account for its own length without guessing.
  const tailSectionsForToc = tailRendered.map((r) => ({
    label: TAIL_LABELS[r.key] ?? r.key,
    pageCount: r.pageCount,
  }));

  const buildIndexHtml = (indexPageCount: number) => {
    const assetLogFirstPage = coverRendered.pageCount + indexPageCount + 1;
    const categoryRanges = computeSequentialRanges(
      categoryRendered.map((c) => ({ label: c.label, pageCount: c.pageCount })),
      assetLogFirstPage,
    );
    const lastCategoryEnd = categoryRanges.length > 0
      ? categoryRanges[categoryRanges.length - 1].endPage
      : assetLogFirstPage - 1;
    const tailRanges = computeSequentialRanges(tailSectionsForToc, lastCategoryEnd + 1);
    return renderTableOfContents(categoryRanges, tailRanges);
  };

  let indexRendered: { buffer: Buffer; pageCount: number };
  try {
    const draft = await renderAndCount(buildIndexHtml(0), 'index_draft', footerTemplate);
    indexRendered = await renderAndCount(buildIndexHtml(draft.pageCount), 'index', footerTemplate);
  } catch (err) {
    throw new ReportGenerationError(
      `Rendering the report index failed, report generation aborted: ${err instanceof Error ? err.message : err}`,
    );
  }

  // Gotenberg merges in the lexical order of filenames — asset-log entries
  // are zero-padded per category/chunk so they always sort right after the
  // Index regardless of how many categories exist, and tail sections are
  // numbered high enough (90+) to always sort after every asset-log entry.
  const files: Array<{ name: string; buffer: Buffer }> = [
    { name: '00_cover.pdf', buffer: coverRendered.buffer },
    { name: '01_index.pdf', buffer: indexRendered.buffer },
  ];
  categoryRendered.forEach((cat, ci) => {
    cat.buffers.forEach((buffer, bi) => {
      files.push({ name: `02_asset_log_${String(ci).padStart(3, '0')}_${String(bi).padStart(3, '0')}.pdf`, buffer });
    });
  });
  const TAIL_ORDER = ['unlinked_defects', 'repairs', 'yearly_condition_report', 'signoff'];
  tailRendered
    .slice()
    .sort((a, b) => TAIL_ORDER.indexOf(a.key) - TAIL_ORDER.indexOf(b.key))
    .forEach((r, i) => files.push({ name: `9${i}_${r.key}.pdf`, buffer: r.buffer }));

  let merged: Buffer;
  try {
    merged = await mergePdfs(files);
    // Each section above rendered as its own separate PDF, so Gotenberg's
    // own page-number placeholders (left out of the footer template
    // entirely — see headerFooter.ts) couldn't know the report's real page
    // count. Stamp the correct "Page X of Y" now that it's known.
    merged = await stampPageNumbers(merged);
  } catch (err) {
    throw new ReportGenerationError(
      `Merging rendered sections failed, report generation aborted: ${err instanceof Error ? err.message : err}`,
    );
  }

  const { storagePath, signedUrl } = await uploadReport(db, jobId, merged);

  return {
    storagePath,
    signedUrl,
    assetCount: data.assets.length,
    chunkCount: categoryRendered.reduce((sum, c) => sum + c.buffers.length, 0),
    durationMs: Date.now() - started,
  };
}
