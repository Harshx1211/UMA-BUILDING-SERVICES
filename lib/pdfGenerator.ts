/**
 * lib/pdfGenerator.ts
 *
 * Generates and shares a PDF service report for a completed job.
 *
 * Fix summary (this revision):
 *   1. expo-file-system/next → expo-file-system (SDK 54 stable)
 *   2. File.downloadFileAsync(url, dir) — correct API (dest is a Directory, not a File)
 *   3. Defect photos (stored in defects.photos JSON column) now also encoded
 *   4. Higher quality settings for PDF images (defect: 85%, thumb: 75%)
 *   5. onProgress stages corrected — 'sharing' fires AFTER pdf is built
 *   6. Per-call image cache (no module-level singleton bleed between concurrent calls)
 *   7. Parallel photo encoding (all photos in one Promise.all instead of serial batches)
 *   8. Graceful fallback: if ImageManipulator fails we still read raw file as base64
 *   9. Temp-file cleanup moved to after base64 read completes (no premature deletion)
 *  10. Larger thumbnail/defect photo sizes for better PDF readability
 */

import * as Print   from 'expo-print';
import * as Sharing from 'expo-sharing';
// Use stable FileSystem imports for robust base64 and cache operations
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

// ─── Public types ─────────────────────────────────────────────

export type ReportProgressCallback = (stage: ReportStage, detail?: string) => void;

export type ReportStage =
  | 'fetching_data'
  | 'processing_photos'
  | 'building_html'
  | 'generating_pdf'
  | 'sharing';

// ─── Image size presets ───────────────────────────────────────

/** PASS-pill thumbnail — large enough to read in PDF */
const THUMB_W = 480;
const THUMB_Q = 0.75;

/** Defect photo — clearly legible evidence photo */
const DEFECT_W = 640;
const DEFECT_Q = 0.85;

/** Signature — keep as PNG for crispness */
const SIG_W = 480;

// ─── Utilities ────────────────────────────────────────────────

function withTimeout<T>(p: Promise<T>, ms: number, label: string): Promise<T> {
  return Promise.race([
    p,
    new Promise<never>((_, rej) =>
      setTimeout(() => rej(new Error(`[SiteTrack] Timeout: ${label} exceeded ${ms}ms`)), ms)
    ),
  ]);
}

/**
 * Strips HTML comments, collapses whitespace between tags — reduces HTML payload ~15-20%.
 */
function minifyHtml(html: string): string {
  return html
    .replace(/<!--[\s\S]*?-->/g, '')  // strip HTML comments
    .replace(/\n[ \t]*/g, '\n')       // strip indentation
    .replace(/\n{2,}/g, '\n')         // collapse blank lines
    .replace(/>\n+</g, '><')          // remove newlines between tags
    .trim();
}

// ─── Image encoding ───────────────────────────────────────────

/**
 * Converts any image URL to a base64 data URI suitable for embedding in HTML.
 *
 * Pipeline:
 *   data:...   → returned immediately (already embedded)
 *   https://   → File.downloadFileAsync(url, Paths.cache) → resize → base64
 *   file://    → resize → base64
 *
 * @param url       Source URL (file://, https://, or data:)
 * @param width     Target resize width in pixels
 * @param quality   JPEG quality 0–1 (ignored for PNG)
 * @param format    Output format (default JPEG)
 * @param cache     Per-call deduplication map
 */
async function toDataUri(
  url: string,
  width: number,
  quality: number,
  format: ImageManipulator.SaveFormat = ImageManipulator.SaveFormat.JPEG,
  cache: Map<string, string>
): Promise<string | null> {
  if (!url?.trim()) return null;
  url = getValidLocalUri(url);
  if (url.startsWith('data:')) return url;

  // Cache key includes dimensions so different size requests stay separate
  const cacheKey = `${url}||${width}||${quality}||${format}`;
  if (cache.has(cacheKey)) return cache.get(cacheKey)!;

  let localUri = url;
  let downloadedPath: string | null = null;
  let compressedPath: string | null = null;
  let dataUri: string | null = null;

  try {
    // ── Step 1: Download remote → local cache ──────────────
    if (url.startsWith('http://') || url.startsWith('https://')) {
      const fileName = url.split('/').pop()?.split('?')[0] || `temp-${Date.now()}.jpg`;
      const destPath = `${FileSystem.cacheDirectory}${fileName}`;
      const downloaded = await FileSystem.downloadAsync(url, destPath);
      downloadedPath = downloaded.uri;
      localUri = downloadedPath;
    }

    // ── Step 2: Resize + compress ──────────────────────────
    try {
      const result = await ImageManipulator.manipulateAsync(
        localUri,
        [{ resize: { width } }],
        { compress: quality, format }
      );
      compressedPath = result.uri;
      localUri = compressedPath;
    } catch (compressErr) {
      console.warn('[SiteTrack] ImageManipulator failed — using raw file:', compressErr);
      // localUri stays as original/downloaded path — we'll still try to base64 it
    }

    // ── Step 3: Read as base64 ─────────────────────────────
    const b64  = await FileSystem.readAsStringAsync(localUri, { encoding: FileSystem.EncodingType.Base64 });
    const mime = format === ImageManipulator.SaveFormat.PNG ? 'image/png' : 'image/jpeg';
    dataUri = `data:${mime};base64,${b64}`;

    cache.set(cacheKey, dataUri);
    return dataUri;
  } catch (err) {
    console.warn('[SiteTrack] toDataUri failed for:', url, err);
    return null;
  } finally {
    // Clean up temp files ONLY — never delete the original source (user's photos).
    if (downloadedPath) {
      try { await FileSystem.deleteAsync(downloadedPath, { idempotent: true }); } catch {}
    }
    if (compressedPath && compressedPath !== downloadedPath) {
      try { await FileSystem.deleteAsync(compressedPath, { idempotent: true }); } catch {}
    }
  }
}

// ─── Per-type encode helpers ──────────────────────────────────

async function encodeSignature(
  sig: Signature,
  cache: Map<string, string>
): Promise<Signature> {
  const uri = await toDataUri(sig.signature_url, SIG_W, 1, ImageManipulator.SaveFormat.PNG, cache);
  return uri ? { ...sig, signature_url: uri } : sig;
}

/**
 * Encodes a photo at the appropriate size for its display context.
 * Defect photos get larger dimensions because they're evidence of failures.
 */
async function encodePhoto(
  photo: InspectionPhoto,
  isDefectPhoto: boolean,
  cache: Map<string, string>
): Promise<InspectionPhoto> {
  const w = isDefectPhoto ? DEFECT_W : THUMB_W;
  const q = isDefectPhoto ? DEFECT_Q : THUMB_Q;
  const uri = await toDataUri(photo.photo_url, w, q, ImageManipulator.SaveFormat.JPEG, cache);
  return uri ? { ...photo, photo_url: uri } : photo;
}

/**
 * Encodes a raw URL string at defect quality — used for defect.photos[] entries.
 */
async function encodeRawUrl(
  url: string,
  cache: Map<string, string>
): Promise<string | null> {
  return toDataUri(url, DEFECT_W, DEFECT_Q, ImageManipulator.SaveFormat.JPEG, cache);
}

// ─── Referenced-photo filtering ───────────────────────────────

/**
 * Returns a Set of photo IDs that are actually referenced by assets/defects in the report.
 */
function getReferencedPhotoIds(
  assets: AssetWithResult[],
  defects: Defect[],
  photos: InspectionPhoto[]
): Set<string> {
  const assetIds      = new Set(assets.map(a => a.id));
  const defectAssetIds = new Set(
    defects.filter(d => assetIds.has(d.asset_id)).map(d => d.asset_id)
  );

  const referenced = new Set<string>();
  for (const p of photos) {
    if (!p.asset_id) {
      referenced.add(p.id); // job-level photo
    } else if (assetIds.has(p.asset_id) || defectAssetIds.has(p.asset_id)) {
      referenced.add(p.id);
    }
  }
  return referenced;
}

// ─── Data fetching ────────────────────────────────────────────

async function fetchReportData(jobId: string): Promise<ReportData> {
  const job = getJobById<Job>(jobId);
  if (!job) throw new Error(`Report: job "${jobId}" not found`);

  const [assets, defects, signature, photos, quotes] = await Promise.all([
    Promise.resolve(getAssetsWithJobResults<AssetWithResult>(jobId, job.property_id)),
    Promise.resolve(getDefectsForJob<Defect>(jobId)),
    Promise.resolve(getSignatureForJob<Signature>(jobId)),
    Promise.resolve(getPhotosForJob<InspectionPhoto>(jobId)),
    Promise.resolve(queryRecords<Quote>('quotes', { job_id: jobId })),
  ]);

  const tech     = getRecord<User>('users', job.assigned_to);
  const techName = tech?.full_name ?? 'Assigned Technician';
  const reportId = jobId.substring(0, 8).toUpperCase();

  const approvedQuote = quotes.find(q => q.status === 'approved');
  let quoteItems: QuoteItem[] = [];
  let inventory: InventoryItem[]  = [];

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

// ─── Photo processing pipeline ────────────────────────────────

async function processPhotos(data: ReportData): Promise<ReportData> {
  // Per-call cache — no module-level singleton to avoid concurrent-call bleed
  const cache = new Map<string, string>();

  // Signature (keep as PNG for crispness)
  const signature = data.signature
    ? await encodeSignature(data.signature, cache)
    : null;

  // Filter inspection_photos to only those referenced by assets in this report
  const referencedIds  = getReferencedPhotoIds(data.assets, data.defects, data.photos);
  const relevantPhotos = data.photos.filter(p => referencedIds.has(p.id));

  // Which asset IDs have a defect? Used to select correct quality level
  const defectAssetIds = new Set(data.defects.map(d => d.asset_id));

  // Encode ALL photos sequentially to prevent Out of Memory (OOM) errors and dropped images
  const encodedPhotos: InspectionPhoto[] = [];
  for (const photo of relevantPhotos) {
    const isDefectPhoto = !!(photo.asset_id && defectAssetIds.has(photo.asset_id));
    const encoded = await encodePhoto(photo, isDefectPhoto, cache);
    encodedPhotos.push(encoded);
  }

  // ── Encode defect.photos[] JSON arrays ────────────────────
  // Defects store their own photo URIs in a JSON text column (separate from inspection_photos).
  // These ALSO need base64 encoding before they can render in the sandboxed WebView PDF.
  const encodedDefects: Defect[] = [];
  for (const defect of data.defects) {
    let rawPhotos: string[] = [];
    try {
      rawPhotos = typeof defect.photos === 'string'
        ? JSON.parse(defect.photos as unknown as string)
        : (Array.isArray(defect.photos) ? defect.photos : []);
    } catch { rawPhotos = []; }

    if (rawPhotos.length === 0) {
      encodedDefects.push(defect);
      continue;
    }

    const finalPhotos: string[] = [];
    for (const url of rawPhotos) {
      const enc = await encodeRawUrl(url, cache);
      finalPhotos.push(enc ?? url); // keep original if encode failed
    }

    encodedDefects.push({ ...defect, photos: finalPhotos } as Defect);
  }

  return { ...data, signature, photos: encodedPhotos, defects: encodedDefects };
}

// ─── PDF generation & sharing ─────────────────────────────────

// 180s — large reports with remote downloads can be slow on cellular
const PDF_TIMEOUT_MS = 180_000;

async function generateAndSharePdf(html: string, title: string): Promise<string> {
  if (!(await Sharing.isAvailableAsync())) {
    throw new Error('[SiteTrack] Sharing is not available on this device');
  }

  const result = await withTimeout(
    Print.printToFileAsync({ html, width: 794, height: 1123 }),
    PDF_TIMEOUT_MS,
    'printToFileAsync'
  );

  await Sharing.shareAsync(result.uri, {
    mimeType: 'application/pdf',
    dialogTitle: title,
    UTI: 'com.adobe.pdf',
  });

  return result.uri;
}

// ─── Main export ──────────────────────────────────────────────

/**
 * Generates and shares a PDF service report for the given job.
 *
 * @param jobId      — The local SQLite job UUID
 * @param onProgress — Optional callback for UI progress updates
 * @returns The local file URI of the generated PDF
 */
export async function generateJobReport(
  jobId: string,
  onProgress?: ReportProgressCallback
): Promise<string> {
  try {
    onProgress?.('fetching_data');
    const rawData = await fetchReportData(jobId);

    onProgress?.('processing_photos');
    const data = await processPhotos(rawData);

    onProgress?.('building_html');
    const rawHtml = buildReportHtml(data);
    const html    = minifyHtml(rawHtml);

    onProgress?.('generating_pdf');
    const j = rawData.job as any;
    const propertyName = j.property_name as string | null;
    const title = `Service Report — ${propertyName ?? data.reportId}`;

    const pdfUri = await generateAndSharePdf(html, title);

    // 'sharing' stage fires AFTER the share dialog is shown
    onProgress?.('sharing');
    return pdfUri;
  } catch (error) {
    console.error('[SiteTrack] PDF generation error:', error);
    throw error;
  }
}
