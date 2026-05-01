/**
 * lib/pdfGenerator.ts
 *
 * Generates and shares a PDF service report for a completed job.
 *
 * Key improvements:
 *   - All images converted to data: URIs before HTML is built
 *     (expo-print WKWebView sandbox cannot load file:// or https:// URIs)
 *   - Sequential encoding with per-image error isolation
 *   - Defect photos prioritised in the MAX_ENCODED_PHOTOS budget
 *   - Signature encoded as JPEG (3× smaller than PNG)
 *   - Temp files cleaned up in finally blocks
 *   - Detailed progress stages for UI feedback
 *
 * Size presets (encode at ~1.2–1.5× CSS display size):
 *   CSS display          Encode at
 *   72 × 72  (thumb)  →  110px wide
 *   220 × 165 (defect) →  320px wide
 *   64px tall (sig)    →  260px wide
 */

import * as Print from 'expo-print';
import * as FileSystem from 'expo-file-system/legacy';
import * as ImageManipulator from 'expo-image-manipulator';

import {
  getJobById,
  getAssetsWithJobResults,
  getDefectsForJob,
  getSignatureForJob,
  getPhotosForJob,
  queryRecords,
  getRecord,
  updateRecord,
} from '@/lib/database';
import {
  Job,
  Defect,
  Signature,
  InspectionPhoto,
  Quote,
  QuoteItem,
  InventoryItem,
  User,
} from '@/types';
import { buildReportHtml, ReportData, AssetWithResult } from '@/lib/reportTemplate';
import { getValidLocalUri } from '@/utils/fileHelpers';
import { supabase } from '@/lib/supabase';

// ─── Public types ──────────────────────────────────────────────────────────────

export type ReportProgressCallback = (stage: ReportStage, detail?: string) => void;

export type ReportStage =
  | 'fetching_data'
  | 'processing_photos'
  | 'building_html'
  | 'generating_pdf'
  | 'uploading'
  | 'sharing';

// ─── Image size presets ────────────────────────────────────────────────────────
// CSS sizes in reportTemplate.ts:
//   .photo-thumb:  72 × 72   → encode at 110px (1.53×)
//   .photo-defect: 220 × 165 → encode at 320px (1.45×)
//   .sig-img:      max-height 64px → encode at 260px wide

const THUMB_W  = 110;
const THUMB_Q  = 0.60;
const DEFECT_W = 320;
const DEFECT_Q = 0.70;
const SIG_W    = 260;
const SIG_Q    = 0.80;

// Defect/fail photos consume budget first; pass thumbnails fill the remainder.
const MAX_ENCODED_PHOTOS = 60;

const PDF_TIMEOUT_MS = 180_000;

// ─── Utilities ─────────────────────────────────────────────────────────────────

function withTimeout<T>(p: Promise<T>, ms: number, label: string): Promise<T> {
  return Promise.race([
    p,
    new Promise<never>((_, rej) =>
      setTimeout(() => rej(new Error(`[SiteTrack] Timeout: ${label} exceeded ${ms}ms`)), ms)
    ),
  ]);
}

function minifyHtml(html: string): string {
  return html
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n[ \t]*/g, '\n')
    .replace(/\n{2,}/g, '\n')
    .replace(/>\n+</g, '><')
    .replace(/:\s+/g, ':')
    .replace(/;\s+/g, ';')
    .trim();
}

// ─── Image encoding ────────────────────────────────────────────────────────────

/**
 * Converts any local/remote image URI to a base64 data: URI.
 *
 * Cache key = source URL. First caller's width/quality wins.
 * Files already starting with data: are returned as-is.
 *
 * Returns null (never throws) — callers show original URL as fallback.
 */
async function toDataUri(
  url: string,
  width: number,
  quality: number,
  format: ImageManipulator.SaveFormat = ImageManipulator.SaveFormat.JPEG,
  cache: Map<string, string>
): Promise<string | null> {
  if (!url?.trim()) return null;
  if (url.startsWith('data:')) return url;

  const cached = cache.get(url);
  if (cached) return cached;

  let downloadedPath: string | null = null;
  let compressedPath: string | null = null;

  try {
    // ── Step 1: resolve to local file URI ─────────────────────────────────────
    let localUri: string;

    if (url.startsWith('http://') || url.startsWith('https://')) {
      const safeName  = url.split('/').pop()?.split('?')[0] ?? `dl-${Date.now()}.jpg`;
      const destPath  = `${FileSystem.cacheDirectory}sitetrack_${Date.now()}_${safeName}`;
      const dl        = await FileSystem.downloadAsync(url, destPath);
      downloadedPath  = dl.uri;
      localUri        = downloadedPath;
    } else {
      const validUri = getValidLocalUri(url);
      const info     = await FileSystem.getInfoAsync(validUri);
      if (!info.exists) {
        console.warn('[SiteTrack] toDataUri: file not found:', validUri);
        return null;
      }
      localUri = validUri;
    }

    // ── Step 2: resize + compress ─────────────────────────────────────────────
    try {
      const result = await ImageManipulator.manipulateAsync(
        localUri,
        [{ resize: { width } }],
        { compress: quality, format }
      );
      compressedPath = result.uri;
      localUri       = compressedPath;
    } catch (manipErr) {
      // Non-fatal — proceed with original file at original size
      console.warn('[SiteTrack] toDataUri: ImageManipulator failed (using original):', manipErr);
    }

    // ── Step 3: read as base64 ────────────────────────────────────────────────
    const b64     = await FileSystem.readAsStringAsync(localUri, {
      encoding: FileSystem.EncodingType.Base64,
    });
    const mime    = format === ImageManipulator.SaveFormat.PNG ? 'image/png' : 'image/jpeg';
    const dataUri = `data:${mime};base64,${b64}`;

    cache.set(url, dataUri);
    return dataUri;
  } catch (err) {
    console.warn('[SiteTrack] toDataUri failed:', url, err);
    return null;
  } finally {
    // Always clean up temp files
    if (downloadedPath) {
      FileSystem.deleteAsync(downloadedPath, { idempotent: true }).catch(() => {});
    }
    if (compressedPath && compressedPath !== downloadedPath) {
      FileSystem.deleteAsync(compressedPath, { idempotent: true }).catch(() => {});
    }
  }
}

// ─── Data fetching ─────────────────────────────────────────────────────────────

async function fetchReportData(jobId: string): Promise<ReportData> {
  const job = getJobById<Job>(jobId);
  if (!job) throw new Error(`Report: job "${jobId}" not found`);

  const [assets, defects, signature, photos, quotes] = await Promise.all([
    Promise.resolve(getAssetsWithJobResults<AssetWithResult>(jobId, (job as any).property_id)),
    Promise.resolve(getDefectsForJob<Defect>(jobId)),
    Promise.resolve(getSignatureForJob<Signature>(jobId)),
    Promise.resolve(getPhotosForJob<InspectionPhoto>(jobId)),
    Promise.resolve(queryRecords<Quote>('quotes', { job_id: jobId })),
  ]);

  const tech     = getRecord<User>('users', (job as any).assigned_to);
  const techName = tech?.full_name ?? 'Assigned Technician';
  const reportId = jobId.substring(0, 8).toUpperCase();

  const approvedQuote = quotes.find(q => q.status === 'approved');
  let quoteItems: QuoteItem[]    = [];
  let inventory: InventoryItem[] = [];

  if (approvedQuote) {
    [quoteItems, inventory] = await Promise.all([
      Promise.resolve(queryRecords<QuoteItem>('quote_items', { quote_id: approvedQuote.id })),
      Promise.resolve(queryRecords<InventoryItem>('inventory_items')),
    ]);
  }

  return {
    job, assets, defects, signature, photos, timeLogs: [],
    techName, reportId, approvedQuote, quoteItems, inventory,
  };
}

// ─── Photo selection ───────────────────────────────────────────────────────────

/**
 * Returns the set of photo IDs that are actually referenced in the report
 * (i.e. linked to a rendered asset or defect).
 * Unreferenced photos are excluded before encoding to save time and size.
 */
function getReferencedPhotoIds(
  assets: AssetWithResult[],
  defects: Defect[],
  photos: InspectionPhoto[]
): Set<string> {
  const assetIds       = new Set(assets.map(a => a.id));
  const defectAssetIds = new Set(defects.filter(d => assetIds.has(d.asset_id)).map(d => d.asset_id));
  const defectIds      = new Set(defects.map(d => d.id));

  const referenced = new Set<string>();
  for (const p of photos) {
    // Photos linked to a defect in this job
    if (p.defect_id && defectIds.has(p.defect_id)) {
      referenced.add(p.id);
    // Photos linked to an active asset (pass thumbnails) or a fail asset's pre-defect shots
    } else if (p.asset_id && (assetIds.has(p.asset_id) || defectAssetIds.has(p.asset_id))) {
      referenced.add(p.id);
    }
    // General photos with no asset_id are intentionally excluded:
    // they render nowhere in the current template and only waste encoding budget.
  }
  return referenced;
}

// ─── Photo processing ──────────────────────────────────────────────────────────

async function processPhotos(
  data: ReportData,
  onProgress?: (detail: string) => void
): Promise<ReportData> {
  const cache         = new Map<string, string>();
  const defectAssetIds = new Set(data.defects.map(d => d.asset_id));

  // ── Signature ────────────────────────────────────────────────────────────────
  let signature = data.signature;
  if (signature?.signature_url) {
    onProgress?.('Encoding signature…');
    // IMPORTANT: Signatures are PNG with a transparent background.
    // Encoding as JPEG (which has no alpha channel) fills transparency with BLACK,
    // causing the "black box" in the PDF. We must encode as PNG to preserve transparency.
    const uri = await toDataUri(
      signature.signature_url, SIG_W, SIG_Q,
      ImageManipulator.SaveFormat.PNG, cache
    );
    if (uri) signature = { ...signature, signature_url: uri };
    else {
      // If encoding fails entirely, try reading the file as raw base64 (no resize)
      // so we at least get something rather than a missing signature.
      try {
        const { getValidLocalUri } = await import('@/utils/fileHelpers');
        const localUri = getValidLocalUri(signature.signature_url);
        const b64 = await (await import('expo-file-system/legacy')).readAsStringAsync(localUri, {
          encoding: (await import('expo-file-system/legacy')).EncodingType.Base64,
        });
        if (b64) signature = { ...signature, signature_url: `data:image/png;base64,${b64}` };
      } catch {
        // Leave signature_url as-is — buildSig isSafe check will handle it
      }
    }
  }

  // ── Filter to referenced photos only ─────────────────────────────────────────
  const referencedIds  = getReferencedPhotoIds(data.assets, data.defects, data.photos);
  const relevantPhotos = data.photos.filter(p => referencedIds.has(p.id));

  const defectPhotos = relevantPhotos.filter(
    p => p.defect_id || (p.asset_id && defectAssetIds.has(p.asset_id))
  );
  const passPhotos = relevantPhotos.filter(
    p => !p.defect_id && !(p.asset_id && defectAssetIds.has(p.asset_id))
  );

  const budgetForPass = Math.max(0, MAX_ENCODED_PHOTOS - defectPhotos.length);
  const toEncode      = [...defectPhotos, ...passPhotos.slice(0, budgetForPass)];

  // ── Encode InspectionPhoto records ───────────────────────────────────────────
  const encodedPhotos: InspectionPhoto[] = [];
  for (let i = 0; i < toEncode.length; i++) {
    const photo    = toEncode[i];
    const isDefect = !!(photo.defect_id || (photo.asset_id && defectAssetIds.has(photo.asset_id)));
    const w        = isDefect ? DEFECT_W : THUMB_W;
    const q        = isDefect ? DEFECT_Q : THUMB_Q;

    onProgress?.(`Encoding photo ${i + 1} of ${toEncode.length}…`);

    const uri = await toDataUri(photo.photo_url, w, q, ImageManipulator.SaveFormat.JPEG, cache);
    // If encoding fails, keep the original URL — reportTemplate will skip non-data: URIs
    encodedPhotos.push(uri ? { ...photo, photo_url: uri } : photo);
  }

  // ── Encode defect.photos[] raw URL arrays ─────────────────────────────────────
  const encodedDefects: Defect[] = [];
  for (const defect of data.defects) {
    let rawPhotos: string[];
    if (Array.isArray(defect.photos)) {
      rawPhotos = defect.photos as string[];
    } else if (typeof defect.photos === 'string' && (defect.photos as string).length > 0) {
      try { rawPhotos = JSON.parse(defect.photos as unknown as string); }
      catch { rawPhotos = []; }
    } else {
      rawPhotos = [];
    }

    if (!rawPhotos.length) {
      encodedDefects.push(defect);
      continue;
    }

    const encodedUrls: string[] = [];
    for (const rawUrl of rawPhotos) {
      const enc = await toDataUri(rawUrl, DEFECT_W, DEFECT_Q, ImageManipulator.SaveFormat.JPEG, cache);
      encodedUrls.push(enc ?? rawUrl);
    }
    encodedDefects.push({ ...defect, photos: encodedUrls } as Defect);
  }

  return {
    ...data,
    signature,
    photos: encodedPhotos,
    defects: encodedDefects,
  };
}

// ─── PDF generation ────────────────────────────────────────────────────────────

async function generatePdf(html: string): Promise<string> {
  const result = await withTimeout(
    Print.printToFileAsync({ html, width: 794, height: 1123 }),
    PDF_TIMEOUT_MS,
    'printToFileAsync'
  );
  return result.uri;
}

// ─── Supabase Storage upload ────────────────────────────────────────────────────

/**
 * Uploads the generated PDF to Supabase Storage at job-reports/{jobId}.pdf,
 * then IMMEDIATELY updates jobs.report_url AND jobs.status = 'completed'
 * directly in Supabase (not via sync queue) since we're already online.
 *
 * The local SQLite record is also updated for UI consistency.
 * Non-fatal — returns null on any failure so the share flow still works.
 */
async function uploadPdfToStorage(jobId: string, pdfUri: string): Promise<string | null> {
  try {
    // Read the local PDF file as base64
    const base64 = await FileSystem.readAsStringAsync(pdfUri, {
      encoding: FileSystem.EncodingType.Base64,
    });

    // Convert base64 → Uint8Array (works in React Native / Hermes)
    const binaryStr = atob(base64);
    const bytes = new Uint8Array(binaryStr.length);
    for (let i = 0; i < binaryStr.length; i++) {
      bytes[i] = binaryStr.charCodeAt(i);
    }

    const storagePath = `${jobId}.pdf`;

    // Upload — upsert:true so re-generating overwrites the previous PDF cleanly
    const { error: uploadError } = await supabase.storage
      .from('job-reports')
      .upload(storagePath, bytes.buffer, {
        contentType: 'application/pdf',
        upsert: true,
      });

    if (uploadError) {
      console.warn('[SiteTrack] PDF upload error:', uploadError.message);
      return null;
    }

    // Get the permanent public URL
    const { data } = supabase.storage.from('job-reports').getPublicUrl(storagePath);
    const reportUrl = data.publicUrl;

    // ── DIRECTLY update Supabase — we are online right now (just uploaded the PDF).
    // This is NOT deferred to the sync queue because the admin must see it immediately.
    // We set BOTH report_url AND status=completed in one atomic update.
    const now = new Date().toISOString();
    const { error: dbError } = await supabase
      .from('jobs')
      .update({ report_url: reportUrl, status: 'completed', updated_at: now })
      .eq('id', jobId);

    if (dbError) {
      console.warn('[SiteTrack] Failed to update jobs in Supabase:', dbError.message);
    } else {
      console.log('[SiteTrack] Supabase jobs row updated: report_url + status=completed');
    }

    // Also update local SQLite so the UI reflects completion immediately
    try {
      updateRecord('jobs', jobId, { report_url: reportUrl, status: 'completed', updated_at: now });
    } catch (e) {
      console.warn('[SiteTrack] Local DB update failed (non-fatal):', e);
    }

    console.log('[SiteTrack] PDF uploaded successfully:', reportUrl);
    return reportUrl;
  } catch (err) {
    console.warn('[SiteTrack] uploadPdfToStorage unexpected error:', err);
    return null;
  }
}


// ─── Main export ───────────────────────────────────────────────────────────────

export async function generateJobReport(
  jobId: string,
  onProgress?: ReportProgressCallback
): Promise<{ pdfUri: string; html: string; title: string; reportUrl: string | null }> {
  try {
    onProgress?.('fetching_data');
    const rawData = await fetchReportData(jobId);

    onProgress?.('processing_photos');
    const data = await processPhotos(rawData, detail =>
      onProgress?.('processing_photos', detail)
    );

    onProgress?.('building_html');
    const html = minifyHtml(buildReportHtml(data));

    onProgress?.('generating_pdf');
    const j            = rawData.job as any;
    const propertyName = j.property_name as string | null;
    const title        = `Service Report — ${propertyName ?? data.reportId}`;

    const pdfUri = await generatePdf(html);

    // Upload to Supabase Storage — non-fatal, sharing works regardless
    onProgress?.('uploading');
    const reportUrl = await uploadPdfToStorage(jobId, pdfUri);

    return { pdfUri, html, title, reportUrl };
  } catch (error) {
    console.error('[SiteTrack] PDF generation error:', error);
    throw error;
  }
}
