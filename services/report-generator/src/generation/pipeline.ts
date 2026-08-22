import { SupabaseClient } from '@supabase/supabase-js';
import { config } from '../config';
import { fetchReportData } from '../data/fetchReportData';
import { buildAssetLogChunks } from '../data/chunking';
import { mapWithConcurrency } from '../concurrency';
import { convertHtmlToPdf, mergePdfs } from '../gotenberg/client';
import { renderCover } from '../templates/cover';
import { renderAssetLogChunk } from '../templates/assetLogChunk';
import { renderUnlinkedDefects } from '../templates/unlinkedDefects';
import { renderRepairs } from '../templates/repairs';
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

export async function generateReport(db: SupabaseClient, jobId: string): Promise<PipelineResult> {
  const started = Date.now();
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

  // Build every document's HTML up front (cheap, pure string work — never the
  // bottleneck), then render each through Gotenberg with bounded concurrency so
  // a 1000-asset job doesn't fire dozens of simultaneous Chromium jobs at a
  // single free-tier instance (see config.gotenbergConcurrency).
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

  const unlinkedHtml = renderUnlinkedDefects(data.defects, data.photosByDefect, data.signedPhotoUrls);
  if (unlinkedHtml) documents.push({ name: '02_unlinked_defects', html: unlinkedHtml });

  const repairsHtml = renderRepairs(data.defects, data.approvedQuote, data.photosByDefect, data.signedPhotoUrls);
  if (repairsHtml) documents.push({ name: '03_repairs', html: repairsHtml });

  documents.push({ name: '04_signoff', html: renderSignoff(data) });

  const footerTemplate = buildFooterTemplate(data.company);

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
    // Never publish a partial report — abort the whole generation with a clear
    // error rather than silently omitting whatever section failed to render.
    throw new ReportGenerationError(
      `Rendering failed, report generation aborted: ${err instanceof Error ? err.message : err}`,
    );
  }

  rendered.sort((a, b) => a.name.localeCompare(b.name));

  let merged: Buffer;
  try {
    merged = rendered.length === 1 ? rendered[0].buffer : await mergePdfs(rendered);
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
    chunkCount: chunks.length,
    durationMs: Date.now() - started,
  };
}
