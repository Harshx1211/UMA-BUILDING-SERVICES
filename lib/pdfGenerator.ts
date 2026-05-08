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

// How many photos to encode concurrently.
// ImageManipulator is a native operation and runs truly parallel — 5 concurrent
// gives ~4-5x speedup over sequential with no quality change.
const ENCODE_CONCURRENCY = 5;

const PDF_TIMEOUT_MS = 90_000;

// ─── Utilities ─────────────────────────────────────────────────────────────────

function withTimeout<T>(p: Promise<T>, ms: number, label: string): Promise<T> {
  return Promise.race([
    p,
    new Promise<never>((_, rej) =>
      setTimeout(() => rej(new Error(`[UMA BUILDING SERVICES] Timeout: ${label} exceeded ${ms}ms`)), ms)
    ),
  ]);
}

function minifyHtml(html: string): string {
  return html
    // 1. Strip HTML comments
    .replace(/<!--[\s\S]*?-->/g, '')
    // 2. Collapse ALL whitespace runs to a single space
    //    (handles tabs, newlines, multiple spaces in one pass)
    .replace(/\s+/g, ' ')
    // 3. Remove space between closing/opening tags
    .replace(/> </g, '><')
    // 4. Tighten CSS inside <style> blocks
    .replace(/:\s+/g, ':').replace(/;\s+/g, ';').replace(/,\s+/g, ',')
    .replace(/\{\s+/g, '{').replace(/\s+\}/g, '}')
    // 5. Remove unnecessary attribute whitespace
    .replace(/\s*=\s*"/g, '="')
    .trim();
}

// ─── Image encoding ────────────────────────────────────────────────────────────

/**
 * Converts any local/remote image URI to a base64 data: URI.
 *
 * - `cache`   : result cache — same URL always returns same data URI
 * - `pending` : in-flight dedup — if two parallel callers request the same
 *               URL at once, only ONE encode runs; the second awaits the first.
 *               Without this, parallel batching would double-encode shared photos.
 *
 * Returns null (never throws) — callers show original URL as fallback.
 */
async function toDataUri(
  url: string,
  width: number,
  quality: number,
  format: ImageManipulator.SaveFormat = ImageManipulator.SaveFormat.JPEG,
  cache: Map<string, string>,
  pending: Map<string, Promise<string | null>>,
): Promise<string | null> {
  if (!url?.trim()) return null;
  if (url.startsWith('data:')) return url;

  const cached = cache.get(url);
  if (cached) return cached;

  // If another concurrent call is already encoding this exact URL, wait for it
  // instead of starting a duplicate encode operation.
  const inFlight = pending.get(url);
  if (inFlight) return inFlight;

  const promise = (async (): Promise<string | null> => {
    let downloadedPath: string | null = null;
    let compressedPath: string | null = null;
    try {
      // ── Step 1: resolve to local file URI ───────────────────────────────────
      let localUri: string;

      if (url.startsWith('http://') || url.startsWith('https://')) {
        const safeName = url.split('/').pop()?.split('?')[0] ?? `dl-${Date.now()}.jpg`;
        const destPath = `${FileSystem.cacheDirectory}uma-building-services_${Date.now()}_${safeName}`;
        const dl       = await FileSystem.downloadAsync(url, destPath);
        downloadedPath = dl.uri;
        localUri       = downloadedPath;
      } else {
        const validUri = getValidLocalUri(url);
        const info     = await FileSystem.getInfoAsync(validUri);
        if (!info.exists) {
          console.warn('[UMA PDF] toDataUri: file not found:', validUri);
          return null;
        }
        localUri = validUri;
      }

      // ── Step 2: resize + compress ──────────────────────────────────────────
      try {
        const result = await ImageManipulator.manipulateAsync(
          localUri,
          [{ resize: { width } }],
          { compress: quality, format }
        );
        compressedPath = result.uri;
        localUri       = compressedPath;
      } catch (manipErr) {
        console.warn('[UMA PDF] ImageManipulator failed (using original):', manipErr);
      }

      // ── Step 3: read as base64 ─────────────────────────────────────────────
      const b64     = await FileSystem.readAsStringAsync(localUri, {
        encoding: FileSystem.EncodingType.Base64,
      });
      const mime    = format === ImageManipulator.SaveFormat.PNG ? 'image/png' : 'image/jpeg';
      const dataUri = `data:${mime};base64,${b64}`;

      cache.set(url, dataUri);
      return dataUri;
    } catch (err) {
      console.warn('[UMA PDF] toDataUri failed:', url, err);
      return null;
    } finally {
      if (downloadedPath) FileSystem.deleteAsync(downloadedPath, { idempotent: true }).catch(() => {});
      if (compressedPath && compressedPath !== downloadedPath)
        FileSystem.deleteAsync(compressedPath, { idempotent: true }).catch(() => {});
    }
  })();

  pending.set(url, promise);
  try {
    return await promise;
  } finally {
    pending.delete(url);
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
 *
 * IMPORTANT: For FAIL assets, ALL photos linked to that asset are included
 * (not just defect-linked ones), because buildDefectBox() now renders the
 * full assetPhotos[] array alongside defect photos.
 */
function getReferencedPhotoIds(
  assets: AssetWithResult[],
  defects: Defect[],
  photos: InspectionPhoto[]
): Set<string> {
  const assetIds       = new Set(assets.map(a => a.id));
  const failAssetIds   = new Set(assets.filter(a => a.result === 'fail').map(a => a.id));
  const passAssetIds   = new Set(assets.filter(a => a.result === 'pass').map(a => a.id));
  const defectIds      = new Set(defects.map(d => d.id));

  const referenced = new Set<string>();
  for (const p of photos) {
    if (p.defect_id && defectIds.has(p.defect_id)) {
      // Photo is directly linked to a defect in this job
      referenced.add(p.id);
    } else if (p.asset_id && failAssetIds.has(p.asset_id)) {
      // Photo belongs to a FAIL asset — ALL such photos must be encoded
      // so every shot the tech took for this asset appears in the defect box
      referenced.add(p.id);
    } else if (p.asset_id && passAssetIds.has(p.asset_id) && !p.defect_id) {
      // Pass-asset thumbnails — include (budget trimmed later)
      referenced.add(p.id);
    }
    // Photos with no asset_id and no defect_id render nowhere — skip
  }
  return referenced;
}

// ─── Photo processing ──────────────────────────────────────────────────────────

async function processPhotos(
  data: ReportData,
  onProgress?: (detail: string) => void
): Promise<ReportData> {
  // result cache: URL → data URI (shared across all encode calls in this run)
  const cache   = new Map<string, string>();
  // pending cache: URL → in-flight Promise (prevents duplicate parallel encodes)
  const pending = new Map<string, Promise<string | null>>();

  const failAssetIds   = new Set(data.assets.filter(a => (a as any).result === 'fail').map(a => a.id));
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
      ImageManipulator.SaveFormat.PNG, cache, pending
    );
    if (uri) signature = { ...signature, signature_url: uri };
    else {
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

  // Separate fail-asset / defect photos from pass-asset thumbnails
  const defectPhotos = relevantPhotos.filter(
    p => p.defect_id || (p.asset_id && (defectAssetIds.has(p.asset_id) || failAssetIds.has(p.asset_id)))
  );
  const passPhotos = relevantPhotos.filter(
    p => !p.defect_id && !(p.asset_id && (defectAssetIds.has(p.asset_id) || failAssetIds.has(p.asset_id)))
  );

  // Defect/fail photos get priority; pass thumbnails fill the remaining budget
  const budgetForPass = Math.max(0, MAX_ENCODED_PHOTOS - defectPhotos.length);
  const toEncode      = [...defectPhotos, ...passPhotos.slice(0, budgetForPass)];

  if (__DEV__) {
    console.log(
      `[PDF] Photos: total=${data.photos.length} referenced=${relevantPhotos.length} ` +
      `defect/fail=${defectPhotos.length} pass=${Math.min(passPhotos.length, budgetForPass)} ` +
      `encoding=${toEncode.length}`
    );
  }

  // ── Encode InspectionPhoto records — parallel batches ────────────────────────
  // ImageManipulator runs natively and truly concurrently. Batching ENCODE_CONCURRENCY
  // photos at a time gives a 4-5x speedup over sequential encoding with no quality change.
  const encodedPhotos: InspectionPhoto[] = new Array(toEncode.length);
  for (let i = 0; i < toEncode.length; i += ENCODE_CONCURRENCY) {
    const batch = toEncode.slice(i, i + ENCODE_CONCURRENCY);
    const batchEnd = Math.min(i + ENCODE_CONCURRENCY, toEncode.length);
    onProgress?.(`Encoding photos ${i + 1}–${batchEnd} of ${toEncode.length}…`);

    const results = await Promise.all(
      batch.map(photo => {
        const isDefect = !!(photo.defect_id || (photo.asset_id && (defectAssetIds.has(photo.asset_id) || failAssetIds.has(photo.asset_id))));
        const w = isDefect ? DEFECT_W : THUMB_W;
        const q = isDefect ? DEFECT_Q : THUMB_Q;
        return toDataUri(photo.photo_url, w, q, ImageManipulator.SaveFormat.JPEG, cache, pending)
          .then(uri => uri ? { ...photo, photo_url: uri } : photo);
      })
    );
    results.forEach((r, j) => { encodedPhotos[i + j] = r; });
  }

  // ── Encode defect.photos[] raw URL arrays — also parallel ────────────────────
  // These are legacy URLs stored directly in the defect row's JSON column.
  const encodedDefects: Defect[] = await Promise.all(
    data.defects.map(async defect => {
      let rawPhotos: string[];
      if (Array.isArray(defect.photos)) {
        rawPhotos = defect.photos as string[];
      } else if (typeof defect.photos === 'string' && (defect.photos as string).length > 0) {
        try { rawPhotos = JSON.parse(defect.photos as unknown as string); }
        catch { rawPhotos = []; }
      } else {
        rawPhotos = [];
      }

      if (!rawPhotos.length) return defect;

      // Encode all raw URLs for this defect concurrently
      const encodedUrls = await Promise.all(
        rawPhotos.map(rawUrl =>
          toDataUri(rawUrl, DEFECT_W, DEFECT_Q, ImageManipulator.SaveFormat.JPEG, cache, pending)
            .then(enc => enc ?? rawUrl)
        )
      );
      return { ...defect, photos: encodedUrls } as Defect;
    })
  );

  return {
    ...data,
    signature,
    photos: encodedPhotos,
    defects: encodedDefects,
  };
}

// ─── PDF generation ────────────────────────────────────────────────────────────

/**
 * Generates the PDF from the minified HTML string.
 * expo-print's printToFileAsync transfers the HTML via the React Native bridge
 * and renders it in a headless WKWebView (iOS) / WebView (Android).
 * There is no way to bypass the bridge for this call, so we minimise the
 * HTML size as much as possible before calling it (done in minifyHtml).
 */
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
 * then updates jobs.report_url AND conditionally sets status = 'completed'
 * directly in Supabase (not via sync queue) since we're already online.
 *
 * IMPORTANT: `markComplete` must be true ONLY if the job was already in
 * 'completed' status before generation. Draft previews for in-progress jobs
 * must NOT promote job status — that would bypass the completion gate.
 *
 * The local SQLite record is also updated for UI consistency.
 * Non-fatal — returns null on any failure so the share flow still works.
 */
async function uploadPdfToStorage(
  jobId: string,
  pdfUri: string,
  markComplete: boolean,
): Promise<string | null> {
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
      console.warn('[UMA BUILDING SERVICES] PDF upload error:', uploadError.message);
      return null;
    }

    // Get the permanent public URL
    const { data } = supabase.storage.from('job-reports').getPublicUrl(storagePath);
    const reportUrl = data.publicUrl;

    // ── DIRECTLY update Supabase — we are online right now (just uploaded the PDF).
    // Only promote to 'completed' if the job was ALREADY completed before generation.
    // In-progress draft previews upload the PDF but MUST NOT change job status —
    // that would bypass the CompletionBottomSheet signature gate.
    const now = new Date().toISOString();
    const updatePayload: Record<string, string> = { report_url: reportUrl, updated_at: now };
    if (markComplete) updatePayload.status = 'completed';

    const { error: dbError } = await supabase
      .from('jobs')
      .update(updatePayload)
      .eq('id', jobId);

    if (dbError) {
      console.warn('[UMA BUILDING SERVICES] Failed to update jobs in Supabase:', dbError.message);
    } else {
      console.log('[UMA BUILDING SERVICES] Supabase jobs row updated: report_url + status=completed');
    }

    // Also update local SQLite so the UI reflects the report_url immediately.
    // Only write status=completed if markComplete is true.
    try {
      const localPayload: Record<string, string> = { report_url: reportUrl, updated_at: now };
      if (markComplete) localPayload.status = 'completed';
      updateRecord('jobs', jobId, localPayload);
    } catch (e) {
      console.warn('[UMA BUILDING SERVICES] Local DB update failed (non-fatal):', e);
    }

    console.log('[UMA BUILDING SERVICES] PDF uploaded successfully:', reportUrl);
    return reportUrl;
  } catch (err) {
    console.warn('[UMA BUILDING SERVICES] uploadPdfToStorage unexpected error:', err);
    return null;
  }
}


// ─── Main export ───────────────────────────────────────────────────────────────

export async function generateJobReport(
  jobId: string,
  onProgress?: ReportProgressCallback
): Promise<{ pdfUri: string; html: string; title: string; reportUrl: string | null; completed: boolean }> {
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

    // Upload to Supabase Storage — non-fatal, sharing works regardless.
    // Only mark the job completed if it was ALREADY completed before PDF generation.
    // In-progress "Draft Preview" flows must not bypass the completion gate.
    onProgress?.('uploading');
    const jobRecord = rawData.job as any;
    const alreadyCompleted = (jobRecord?.status as string) === 'completed';
    const reportUrl = await uploadPdfToStorage(jobId, pdfUri, alreadyCompleted);
    // `completed` is true only when the job was already completed AND the PDF uploaded OK.
    // Draft previews (in_progress) will have completed=false even if reportUrl is set.
    const completed = alreadyCompleted && reportUrl !== null;

    return { pdfUri, html, title, reportUrl, completed };
  } catch (error) {
    console.error('[UMA BUILDING SERVICES] PDF generation error:', error);
    throw error;
  }
}
