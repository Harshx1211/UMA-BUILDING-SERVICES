import { SupabaseClient } from '@supabase/supabase-js';
import { config } from '../config';
import { fetchReportData } from '../data/fetchReportData';
import { buildAssetLogChunks } from '../data/chunking';
import { mapWithConcurrency } from '../concurrency';
import { convertHtmlToPdf, mergePdfs, waitForGotenbergReady } from '../gotenberg/client';
import { renderCover } from '../templates/cover';
import { renderAssetLogChunk } from '../templates/assetLogChunk';
import { renderUnlinkedDefects } from '../templates/unlinkedDefects';
import { renderRepairs } from '../templates/repairs';
import { renderSignoff } from '../templates/signoff';
import { buildFooterTemplate, EMPTY_HEADER_TEMPLATE } from '../templates/headerFooter';
import { BASE_STYLE } from '../templates/theme';
import { extractBody } from '../templates/helpers';
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

  const chunks = buildAssetLogChunks(data.assets, assetTypesByValue, config.maxAssetsPerChunk);
  const footerTemplate = buildFooterTemplate(data.company);

  const unlinkedHtml = renderUnlinkedDefects(data.defects, data.photosByDefect, data.signedPhotoUrls);
  const repairsHtml = renderRepairs(data.defects, data.approvedQuote, data.photosByDefect, data.signedPhotoUrls);

  // By now the data fetch (and Gotenberg's cold-start window, if it needed
  // one) have had time to overlap; this resolves instantly if Gotenberg was
  // already warm.
  await gotenbergReady;

  let merged: Buffer;

  // Fast path: when everything fits in a single chunk (true for the large
  // majority of real jobs — chunking only exists for the 1000+ asset case),
  // combine every section into ONE HTML document and make exactly one
  // Gotenberg call instead of N separate render round-trips plus a merge
  // call. Each of those round-trips carries its own Chromium page-load
  // overhead, which is what made the very first real end-to-end test slower
  // than it needed to be for a ~10-asset job.
  if (chunks.length <= 1) {
    const sections = [
      renderCover(data, assetTypesByValue),
      ...(chunks[0]
        ? [renderAssetLogChunk(chunks[0], defectsByAsset, data.photosByAsset, data.photosByDefect, data.signedPhotoUrls)]
        : []),
      ...(unlinkedHtml ? [unlinkedHtml] : []),
      ...(repairsHtml ? [repairsHtml] : []),
      renderSignoff(data),
    ];
    const combinedHtml = `<!DOCTYPE html>
<html><head><meta charset="utf-8" /><style>${BASE_STYLE}</style></head>
<body>${sections.map(extractBody).join('')}</body></html>`;

    try {
      merged = await convertHtmlToPdf(combinedHtml, 'combined', {
        headerTemplateHtml: EMPTY_HEADER_TEMPLATE,
        footerTemplateHtml: footerTemplate,
      });
    } catch (err) {
      throw new ReportGenerationError(
        `Rendering failed, report generation aborted: ${err instanceof Error ? err.message : err}`,
      );
    }
  } else {
    // Large-job path: chunk-and-merge, so no single Chromium render ever has
    // to lay out more than config.maxAssetsPerChunk rows at once.
    const documents: Array<{ name: string; html: string }> = [];
    documents.push({ name: '00_cover', html: renderCover(data, assetTypesByValue) });

    chunks.forEach((chunk, i) => {
      const html = renderAssetLogChunk(
        chunk,
        defectsByAsset,
        data.photosByAsset,
        data.photosByDefect,
        data.signedPhotoUrls,
      );
      documents.push({ name: `01_asset_log_${String(i).padStart(4, '0')}`, html });
    });

    if (unlinkedHtml) documents.push({ name: '02_unlinked_defects', html: unlinkedHtml });
    if (repairsHtml) documents.push({ name: '03_repairs', html: repairsHtml });
    documents.push({ name: '04_signoff', html: renderSignoff(data) });

    let rendered: Array<{ name: string; buffer: Buffer }>;
    try {
      rendered = await mapWithConcurrency(documents, config.gotenbergConcurrency, async (doc) => ({
        name: `${doc.name}.pdf`,
        buffer: await convertHtmlToPdf(doc.html, doc.name, {
          headerTemplateHtml: EMPTY_HEADER_TEMPLATE,
          footerTemplateHtml: footerTemplate,
        }),
      }));
    } catch (err) {
      // Never publish a partial report — abort the whole generation with a
      // clear error rather than silently omitting whatever section failed.
      throw new ReportGenerationError(
        `Rendering failed, report generation aborted: ${err instanceof Error ? err.message : err}`,
      );
    }

    rendered.sort((a, b) => a.name.localeCompare(b.name));

    try {
      merged = await mergePdfs(rendered);
    } catch (err) {
      throw new ReportGenerationError(
        `Merging rendered sections failed, report generation aborted: ${err instanceof Error ? err.message : err}`,
      );
    }
  }

  const { storagePath, signedUrl } = await uploadReport(db, jobId, merged);

  return {
    storagePath,
    signedUrl,
    assetCount: data.assets.length,
    chunkCount: chunks.length,
    durationMs: Date.now() - started,
  };
}
