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
import Constants from 'expo-constants';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';

import {
  getJobById,
  getAssetsWithJobResults,
  getDefectsForJob,
  getSignatureForJob,
  getPhotosForJob,
  queryRecords,
  getRecord,
  updateRecord,
  addToSyncQueue,
  getPendingSyncItems,
} from '@/lib/database';
import { SyncOperation, JobStatus } from '@/constants/Enums';
import {
  Job,
  JoinedJob,
  Defect,
  Signature,
  InspectionPhoto,
  Quote,
  QuoteItem,
  InventoryItem,
  User,
  TechUser,
} from '@/types';
import { buildReportHtml, ReportData, AssetWithResult } from '@/lib/reportTemplate';
import { getValidLocalUri } from '@/utils/fileHelpers';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/store/authStore';
// FIX: FALLBACK_IMG now lives in a shared constants module so reportTemplate.ts
// can import the exact same value and tell a "failed" photo apart from a real
// one (previously it was defined only here, so reportTemplate had no way to
// distinguish a fallback pixel from a genuine data: URI — see reportTemplate.ts).
import { FALLBACK_IMG } from '@/lib/pdfConstants';

// ─── Public types ──────────────────────────────────────────────────────────────

export type ReportProgressCallback = (stage: ReportStage, detail?: string) => void;

export type ReportStage =
  | 'fetching_data'
  | 'processing_photos'
  | 'building_html'
  | 'generating_pdf'
  | 'uploading'
  | 'sharing'
  | 'cached';

// ─── Image size presets ────────────────────────────────────────────────────────
// CSS sizes in reportTemplate.ts:
//   .photo-thumb:  72 × 72   → encode at 110px (1.53×)
//   .photo-defect: 220 × 165 → encode at 320px (1.45×)
//   .sig-img:      max-height 64px → encode at 260px wide

// FIX B6: Defect photos display at 220×165 CSS px. Old encode at 320px q0.70
// was 45% over display resolution with no visual benefit.
// 260px q0.60 gives near-identical quality with ~35% smaller base64 strings.
const THUMB_W  = 90;    // was 110 — thumbs display at 72×72, 90px is already 1.25× HiDPI
const THUMB_Q  = 0.55;  // was 0.60
const DEFECT_W = 260;   // was 320 — defects display at 220×165
const DEFECT_Q = 0.60;  // was 0.70
const SIG_W    = 260;
const SIG_Q    = 0.80;

// FIX A4: Old cap of 60 silently dropped photos from large reports.
// 120 gives headroom for a 100-page report with a comfortable margin.
const MAX_ENCODED_PHOTOS = 120;

// FIX A3: Raise concurrency 5 → 8.
// ImageManipulator is a native op — more parallel calls = faster wall-clock time.
const ENCODE_CONCURRENCY = 8;

// FIX D11: 90s is routinely exceeded on large first-renders.
// 150s gives a 100-page report with ~80 photos room to complete on mid-range hardware.
const PDF_TIMEOUT_MS       = 150_000;
const PDF_STAMP_TIMEOUT_MS = 60_000;

// ─── Adaptive photo budget for large sites ─────────────────────────────────────
// On-device PDF cannot handle 1000-asset sites with full photo embedding.
// The WebView has a hard memory ceiling — a 20MB+ HTML payload OOM-crashes.
//
// Strategy: degrade pass thumbnail inclusion as asset count grows.
// Defect/fail photos are ALWAYS included (they are AS1851 compliance evidence).
// Pass thumbnails are the largest payload and least critical.
//
// 150+ assets → cap pass thumbnails at 30
// 400+ assets → zero pass thumbnails (defect photos only)
//
// NOTE: For sites >400 assets the correct long-term fix is server-side PDF
// generation via the admin API route (see generateJobReportServerSide()).
const LARGE_JOB_ASSET_THRESHOLD = 150;
const HUGE_JOB_ASSET_THRESHOLD  = 400;

function getPhotoBudget(totalAssets: number): { maxDefect: number; maxPass: number } {
  if (totalAssets >= HUGE_JOB_ASSET_THRESHOLD) {
    return { maxDefect: 80, maxPass: 0 };
  }
  if (totalAssets >= LARGE_JOB_ASSET_THRESHOLD) {
    return { maxDefect: 90, maxPass: 30 };
  }
  return { maxDefect: MAX_ENCODED_PHOTOS, maxPass: MAX_ENCODED_PHOTOS };
}
// ─── Utilities ─────────────────────────────────────────────────────────────────

function withTimeout<T>(p: Promise<T>, ms: number, label: string): Promise<T> {
  return Promise.race([
    p,
    new Promise<never>((_, rej) =>
      setTimeout(() => rej(new Error(`[UMA BUILDING SERVICES] Timeout: ${label} exceeded ${ms}ms`)), ms)
    ),
  ]);
}

// Minify HTML removed: the regex replacement was aggressively stripping spaces
// and corrupting the base64 data URIs and CSS blocks, causing 200x zoom and broken images.
// minifyHtml was removed: the regex replacement corrupted base64 data URIs
// and CSS blocks. expo-print's bridge handles raw HTML fine at this size.

function hashCode(str: string): string {
  let hash = 0;
  for (let i = 0, len = str.length; i < len; i++) {
    hash = Math.imul(31, hash) + str.charCodeAt(i) | 0;
  }
  return hash.toString();
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
 * Returns FALLBACK_IMG (never throws) — reportTemplate.ts renders this as an
 * explicit "Photo unavailable" placeholder rather than a blank image.
 */
async function toDataUri(
  url: string,
  width: number,
  quality: number,
  format: ImageManipulator.SaveFormat = ImageManipulator.SaveFormat.JPEG,
  cache: Map<string, string>,
  pending: Map<string, Promise<string>>,
): Promise<string> {
  if (!url?.trim()) return FALLBACK_IMG;

  const cached = cache.get(url);
  if (cached) return cached;

  // If another concurrent call is already encoding this exact URL, wait for it
  // instead of starting a duplicate encode operation.
  const inFlight = pending.get(url);
  if (inFlight) return inFlight;

  const promise = (async (): Promise<string> => {
    let downloadedPath: string | null = null;
    let compressedPath: string | null = null;
    try {
      // ── Step 1: resolve to local file URI ───────────────────────────────────
      let localUri: string;

      if (url.startsWith('data:')) {
        const base64Data = url.split(',')[1];
        const destPath = `${FileSystem.cacheDirectory}uma_signature_${Date.now()}_${Math.random().toString(36).substring(7)}.png`;
        await FileSystem.writeAsStringAsync(destPath, base64Data, { encoding: FileSystem.EncodingType.Base64 });
        localUri = destPath;
        downloadedPath = destPath; // Ensures it gets cleaned up in the finally block
      } else if (url.startsWith('http://') || url.startsWith('https://')) {
        // Fix localhost resolution for physical mobile devices running Expo Go
        let downloadUrl = url;
        if (url.includes('127.0.0.1') || url.includes('localhost')) {
          const hostUri = Constants.expoConfig?.hostUri || Constants.manifest2?.extra?.expoGo?.debuggerHost;
          if (hostUri) {
            const lanIp = hostUri.split(':')[0];
            downloadUrl = url.replace(/127\.0\.0\.1|localhost/, lanIp);
          }
        }

        const safeName = downloadUrl.split('/').pop()?.split('?')[0] ?? `dl-${Date.now()}.jpg`;
        const destPath = `${FileSystem.cacheDirectory}uma-building-services_${Date.now()}_${safeName}`;
        const dl       = await FileSystem.downloadAsync(downloadUrl, destPath);
        downloadedPath = dl.uri;
        localUri       = downloadedPath;
      } else {
        const validUri = getValidLocalUri(url);
        const info     = await FileSystem.getInfoAsync(validUri);
        if (!info.exists) {
          console.warn('[UMA PDF] toDataUri: file not found:', validUri);
          cache.set(url, FALLBACK_IMG);
          return FALLBACK_IMG;
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
      cache.set(url, FALLBACK_IMG);
      return FALLBACK_IMG;
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
  const job = getJobById<JoinedJob>(jobId);
  if (!job) throw new Error(`Report: job "${jobId}" not found`);

  const [assets, defects, signature, photos, quotes, timeLogs] = await Promise.all([
    Promise.resolve(getAssetsWithJobResults<AssetWithResult>(jobId, job.property_id)),
    Promise.resolve(getDefectsForJob<Defect>(jobId)),
    Promise.resolve(getSignatureForJob<Signature>(jobId)),
    Promise.resolve(getPhotosForJob<InspectionPhoto>(jobId)),
    Promise.resolve(queryRecords<Quote>('quotes', { job_id: jobId })),
    Promise.resolve(queryRecords<Record<string, unknown>>('time_logs', { job_id: jobId })),
  ]);

  const tech     = getRecord<TechUser>('users', job.assigned_to);
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

  const company = useAuthStore.getState().company;

  return {
    job, assets, defects, signature, photos, timeLogs,
    techName, tech: tech ?? undefined, reportId,
    approvedQuote, quoteItems, inventory, company,
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

// ─── Local URI resolver ────────────────────────────────────────────────────────

/**
 * Picks the best URI to encode for a given photo.
 *
 * Priority:
 *   1. local_uri — the original device file:// path, stored at capture time.
 *      If the file still exists on disk, this is fastest (no download) and
 *      works fully offline even after the Supabase upload has completed.
 *   2. photo_url — the https:// Supabase Storage URL. Requires network.
 *
 * This resolves the key offline PDF bug:
 *   Once a photo is uploaded, photo_url becomes https://... and the local
 *   file:// path is lost — meaning PDF generation fails offline even though
 *   the binary is sitting on the device.
 *   Storing local_uri (Migration 29) and preferring it here fixes this.
 */
async function resolvePhotoUri(
  photo: InspectionPhoto | { photo_url: string; local_uri?: string | null },
): Promise<string> {
  const localUri = (photo as InspectionPhoto).local_uri;
  if (localUri) {
    try {
      const info = await FileSystem.getInfoAsync(getValidLocalUri(localUri));
      if (info.exists) return localUri;
    } catch {
      // File check failed — fall through to photo_url
    }
  }
  return (photo as InspectionPhoto).photo_url;
}



async function processPhotos(
  data: ReportData,
  onProgress?: (detail: string) => void
): Promise<ReportData> {
  // result cache: URL → data URI (shared across all encode calls in this run)
  const cache   = new Map<string, string>();
  // pending cache: URL → in-flight Promise (prevents duplicate parallel encodes)
  const pending = new Map<string, Promise<string>>();

  const failAssetIds   = new Set(data.assets.filter(a => a.result === 'fail').map(a => a.id));
  const defectAssetIds = new Set(data.defects.map(d => d.asset_id));

  // ── Signature ────────────────────────────────────────────────────────────────
  // FIX: The canvas outputs a data:image/png;base64,... string directly.
  // Previously we passed this through toDataUri() → ImageManipulator → temp file
  // write → re-read, which failed silently for large base64 strings and returned
  // FALLBACK_IMG (a 1×1 pixel). Now we detect already-encoded data: URIs and embed
  // them directly — they are already the correct format for WKWebView.
  let signature = data.signature;
  if (signature) {
    // 1. Client Signature
    if (signature.signature_url && signature.signature_url !== 'UNAVAILABLE') {
      onProgress?.('Encoding signature…');
      let sigUri: string;
      if (signature.signature_url.startsWith('data:')) {
        // Already a base64 data URI from the canvas — embed directly, no re-encode needed
        sigUri = signature.signature_url;
      } else {
        sigUri = await toDataUri(
          signature.signature_url, SIG_W, SIG_Q,
          ImageManipulator.SaveFormat.PNG, cache, pending
        );
      }
      signature = { ...signature, signature_url: sigUri };
    }

    // 2. Technician Signature
    if (signature.tech_signature_url) {
      onProgress?.('Encoding technician signature…');
      let techUri: string;
      if (signature.tech_signature_url.startsWith('data:')) {
        // Already a base64 data URI from the canvas — embed directly
        techUri = signature.tech_signature_url;
      } else {
        techUri = await toDataUri(
          signature.tech_signature_url, SIG_W, SIG_Q,
          ImageManipulator.SaveFormat.PNG, cache, pending
        );
      }
      signature = { ...signature, tech_signature_url: techUri };
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


  if (__DEV__) {
    console.log(
      `[PDF] Photos: total=${data.photos.length} referenced=${relevantPhotos.length} ` +
      `defect/fail=${defectPhotos.length} pass=${passPhotos.length} ` +
      `encoding=${toEncode.length} assets=${data.assets.length}`
    );
  }

  // ── Adaptive budget based on site size ───────────────────────────────────────
  const { maxDefect, maxPass } = getPhotoBudget(data.assets.length);

  const cappedDefects = defectPhotos.slice(0, maxDefect);
  const budgetForPass = Math.max(0, maxPass - cappedDefects.length);
  const toEncode      = [...cappedDefects, ...passPhotos.slice(0, budgetForPass)];

  const droppedDefect = defectPhotos.length - cappedDefects.length;
  const droppedPass   = passPhotos.length - Math.min(passPhotos.length, budgetForPass);

  if (droppedPass > 0 || droppedDefect > 0) {
    const reason = data.assets.length >= HUGE_JOB_ASSET_THRESHOLD
      ? `Large site (${data.assets.length} assets) — pass thumbnails excluded to prevent memory crash.`
      : `Large site (${data.assets.length} assets) — pass thumbnails capped at ${maxPass}.`;
    onProgress?.(`\u26a0\ufe0f Photo budget: ${reason}`);
    if (__DEV__) console.warn(`[PDF] Photo budget enforced: dropped ${droppedDefect} defect + ${droppedPass} pass photos. ${reason}`);
  }
  // ── Encode InspectionPhoto records — parallel batches ────────────────────────
  // For each photo, resolvePhotoUri() returns the best local file path when
  // available — skipping the https:// download entirely (works offline too).
  const encodedPhotos: InspectionPhoto[] = new Array(toEncode.length);
  for (let i = 0; i < toEncode.length; i += ENCODE_CONCURRENCY) {
    const batch = toEncode.slice(i, i + ENCODE_CONCURRENCY);
    const batchEnd = Math.min(i + ENCODE_CONCURRENCY, toEncode.length);
    onProgress?.(`Encoding photos ${i + 1}–${batchEnd} of ${toEncode.length}…`);

    const results = await Promise.all(
      batch.map(async photo => {
        const isDefect = !!(photo.defect_id || (photo.asset_id && (defectAssetIds.has(photo.asset_id) || failAssetIds.has(photo.asset_id))));
        const w = isDefect ? DEFECT_W : THUMB_W;
        const q = isDefect ? DEFECT_Q : THUMB_Q;
        // OFFLINE FIX: prefer local_uri (device file) over https:// Supabase URL
        const bestUri = await resolvePhotoUri(photo);
        const encoded = await toDataUri(bestUri, w, q, ImageManipulator.SaveFormat.JPEG, cache, pending);
        return { ...photo, photo_url: encoded };
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

// ─── PDF-lib footer stamping ───────────────────────────────────────────────────────

/**
 * Strips characters outside WinAnsi encoding (the only range StandardFonts.Helvetica
 * can render). Removes emoji, accented chars, and replaces common typographic
 * punctuation with ASCII equivalents.
 */
function pdfSafeText(s: string | null | undefined): string {
  if (!s) return '';
  return s
    .replace(/[\u2013\u2014]/g, '-')
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[\u201C\u201D]/g, '"')
    .replace(/[^\x00-\x7F]/g, '');
}

/**
 * Opens the raw PDF generated by expo-print and stamps a corporate footer bar
 * (navy rectangle + company name, ABN, centred page X of Y in orange, contact info)
 * onto every real physical page using pdf-lib's drawing API.
 *
 * This is done AFTER pagination so the page count and positions are guaranteed
 * correct, regardless of how much content any section contained.
 */
async function addFooterToPdf(
  pdfUri: string,
  company: Record<string, string | null | undefined>,
  _reportId: string,
): Promise<string> {
  // FIX A5: Avoid the double atob/btoa round-trip.
  // Old code: base64 → 8KB-chunked atob loop → string → Uint8Array → pdf-lib
  //           pdf-lib save() Uint8Array → 8KB String.fromCharCode loop → btoa → FileSystem
  // That's two full O(n) string passes over a multi-MB file.
  //
  // New code: base64 → Uint8Array in one pass (no intermediate string) → pdf-lib
  //           pdf-lib save() Uint8Array → FileSystem directly as base64 (one pass).
  const base64 = await FileSystem.readAsStringAsync(pdfUri, {
    encoding: FileSystem.EncodingType.Base64,
  });

  // Decode base64 → Uint8Array without an intermediate binary string
  const binaryStr = atob(base64);
  const bytes = Uint8Array.from({ length: binaryStr.length }, (_, i) => binaryStr.charCodeAt(i));

  const pdfDoc  = await PDFDocument.load(bytes);
  const font     = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  const pages    = pdfDoc.getPages();
  const total    = pages.length;

  const NAVY        = rgb(0x1C / 255, 0x30 / 255, 0x48 / 255);
  const ORANGE      = rgb(0xE9 / 255, 0x73 / 255, 0x16 / 255);
  const WHITE       = rgb(1, 1, 1);
  const WHITE_DIM   = rgb(0.7, 0.7, 0.7);
  const FOOTER_H    = 44;

  const companyName = pdfSafeText(company?.name)   || 'Company Name';
  const abn         = pdfSafeText(company?.abn)    || 'Not Provided';
  const phone       = pdfSafeText(company?.phone)  || 'Not Provided';
  const email       = pdfSafeText(company?.contact_email) || 'Not Provided';
  const contactLine = `P: ${phone} | E: ${email}`;

  pages.forEach((page: { getSize: () => { width: number }; drawRectangle: (opts: Record<string, unknown>) => void; drawText: (text: string, opts: Record<string, unknown>) => void }, i: number) => {
    const { width } = page.getSize();
    const pageNum   = i + 1;

    // Solid opaque navy bar — covers any overflow content beneath it
    page.drawRectangle({ x: 0, y: 0, width, height: FOOTER_H, color: NAVY });

    // Left: company name + ABN
    const nameW = fontBold.widthOfTextAtSize(companyName, 8.5);
    const maxLeft = (width - 200) / 2; // leave room for centred label + right text
    const safeName = nameW > maxLeft
      ? companyName.slice(0, Math.floor(companyName.length * maxLeft / nameW) - 1) + '…'
      : companyName;
    page.drawText(safeName,         { x: 28, y: 27, size: 8.5, font: fontBold, color: WHITE });
    page.drawText(`ABN: ${abn}`,    { x: 28, y: 14, size: 8,   font,           color: WHITE_DIM });

    // Centre: Page X of Y
    const pageLabel = `Page ${pageNum} of ${total}`;
    const labelW    = fontBold.widthOfTextAtSize(pageLabel, 9);
    page.drawText(pageLabel, {
      x: (width - labelW) / 2, y: 18, size: 9, font: fontBold, color: ORANGE,
    });

    // Right: contact info
    const contactW = font.widthOfTextAtSize(contactLine, 8);
    page.drawText(contactLine, {
      x: Math.max(width / 2 + labelW / 2 + 8, width - 28 - contactW),
      y: 18, size: 8, font, color: WHITE_DIM,
    });
  });

  // Write stamped PDF directly from pdf-lib's Uint8Array — chunk to avoid
  // call-stack overflow on large arrays from spread operator.
  const stampedBytes = await pdfDoc.save();
  const CHUNK = 8192;
  let b64Out = '';
  for (let i = 0; i < stampedBytes.length; i += CHUNK) {
    b64Out += btoa(String.fromCharCode(...stampedBytes.subarray(i, i + CHUNK)));
  }
  const stampedPath = `${FileSystem.cacheDirectory}stamped_${Date.now()}.pdf`;
  await FileSystem.writeAsStringAsync(stampedPath, b64Out, {
    encoding: FileSystem.EncodingType.Base64,
  });
  return stampedPath;
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
      console.warn('[UMA BUILDING SERVICES] Failed to update jobs in Supabase — queuing for retry:', dbError.message);
      // FIX: If the direct update fails (e.g. transient network error), queue it for
      // the next sync cycle so report_url is never permanently lost.
      addToSyncQueue('jobs', jobId, SyncOperation.Update, updatePayload);
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


// ─── Server-side PDF via sync queue (new primary path) ────────────────────────
//
// Always server-side, queue-backed:
//   Online  → sync engine calls Edge Function on next cycle (≤60s)
//   Offline → request stored in sync_queue, fires automatically on reconnect
//
// Eliminates on-device base64 encoding, WebView memory pressure, and the
// asset-count ceiling. Any site size works identically.

export type ReportQueueResult = {
  /** Existing report URL if one already exists (show immediately) */
  existingUrl: string | null;
  /** True if a new generation was queued */
  queued: boolean;
};

/**
 * Queue a server-side PDF generation request.
 *
 * Always forces a fresh generation — clears the locally cached report_url
 * before queuing so that:
 *   1. Signed URLs (1h TTL) are never returned as a stale cached value.
 *   2. The polling loop in preview.tsx waits for the new Edge Function result
 *      instead of short-circuiting with an expired URL.
 *   3. Duplicate queue entries are still prevented (idempotent per jobId).
 */
export function queueReportGeneration(jobId: string): ReportQueueResult {
  // FIX: Clear stale report_url from local DB BEFORE queuing.
  // Previously, getRecord returned the old signed URL and the preview screen
  // immediately showed it — bypassing the Edge Function entirely and displaying
  // an expired/outdated PDF. Now we wipe it first so polling waits for fresh output.
  updateRecord('jobs', jobId, { report_url: null });

  // Don't double-queue if already pending — use exact JSON match not substring
  const pending = getPendingSyncItems();
  const alreadyQueued = pending.some(i => {
    if (i.operation !== SyncOperation.ReportGenerate) return false;
    try {
      const p = JSON.parse(i.payload ?? '{}') as { jobId?: string };
      return p.jobId === jobId;
    } catch { return false; }
  });
  if (alreadyQueued) return { existingUrl: null, queued: false };

  addToSyncQueue('jobs', jobId, SyncOperation.ReportGenerate, { jobId });
  if (__DEV__) console.log(`[PDF] report_generate queued for job ${jobId}`);
  return { existingUrl: null, queued: true };
}

/** Returns the current report_url for a job from local SQLite — used to poll for completion. */
export function getReportUrl(jobId: string): string | null {
  return getRecord<{ report_url: string | null }>('jobs', jobId)?.report_url ?? null;
}

// ─── Legacy on-device export (kept for reference — no longer called by preview.tsx) ──

export async function generateJobReport(
  jobId: string,
  onProgress?: ReportProgressCallback
): Promise<{ pdfUri: string; html: string; title: string; reportUrl: string | null; completed: boolean; wasCacheHit: boolean }> {
  try {
    onProgress?.('fetching_data');
    const rawData = await fetchReportData(jobId);

    onProgress?.('processing_photos');
    const data = await processPhotos(rawData, detail =>
      onProgress?.('processing_photos', detail)
    );

    onProgress?.('building_html');
    const html = buildReportHtml(data);
    const htmlHash = hashCode(html);

    onProgress?.('generating_pdf');
    const jobRecord = rawData.job;
    const propertyName = jobRecord.property_name;
    const title        = `Service Report — ${propertyName ?? data.reportId}`;

    const alreadyCompleted = jobRecord.status === JobStatus.Completed;
    // BUG-N6 FIX: Cache key must be scoped to user so two technicians sharing
    // a device never get each other's report. useAuthStore is synchronous.
    const userId  = useAuthStore.getState().user?.id ?? 'anon';
    const cacheKey = `@report_hash_${userId}_${jobId}`;
    const lastHash = await AsyncStorage.getItem(cacheKey);

    // BUG-N3 FIX: Only bypass the hash cache for genuine data-change operations.
    // Exclude photo_upload tasks (photos are encoded from local_uri — binary upload
    // status does not change the PDF HTML) and permanently-failed items (they will
    // never succeed so forcing regeneration forever is pointless and slow).
    const pending = getPendingSyncItems();
    const PDF_TABLES = new Set(['job_assets', 'defects', 'signatures', 'jobs']);
    const PDF_MAX_RETRIES = 5;
    const hasPendingForThisJob = pending.some(i => {
      const op = String(i.operation);
      if (op === 'photo_upload') return false;
      if ((i.retry_count ?? 0) >= PDF_MAX_RETRIES) return false;
      if (!PDF_TABLES.has(i.table_name)) return false;
      return (i.payload ?? '').includes(`"${jobId}"`);
    });

    // FIX: initialize to '' — prevents 'used before assigned' in the slow-path
    // guard below (line: if (!pdfUri || !reportUrl)). TypeScript narrows correctly
    // but Hermes runtime would silently treat undefined as falsy without this.
    let pdfUri = '';
    let reportUrl: string | null = jobRecord.report_url;

    // Fast path: If the HTML hasn't changed AND no pending local changes AND we
    // already have a report URL, skip generation and upload for speed.
    let wasCacheHit = false;
    if (lastHash === htmlHash && reportUrl && !hasPendingForThisJob) {
      console.log('[UMA BUILDING SERVICES] Report HTML unchanged. Skipping PDF generation and upload.');
      onProgress?.('cached', 'Report is up to date.');
      wasCacheHit = true;
      // We still need a local PDF in case they click Share.
      // BUG-N9 FIX: Wrap download in try/catch — if offline or URL expired,
      // fall through to full regeneration rather than throwing to the caller.
      try {
        // FIX: use a stable (non-timestamped) path so we never accumulate stale
        // PDF files in cacheDirectory. Each jobId maps to exactly one cached file.
        const destPath = `${FileSystem.cacheDirectory}preview_${jobId}.pdf`;
        await FileSystem.downloadAsync(reportUrl, destPath);
        pdfUri = destPath;
      } catch (dlErr) {
        console.warn('[UMA BUILDING SERVICES] Cached PDF download failed — regenerating:', dlErr);
        // Fall through to slow path below
        reportUrl = null; // force the slow path
        pdfUri = '';
      }
    }

    if (!pdfUri || !reportUrl) {
      // Slow path: Generate and upload new PDF
      pdfUri = await generatePdf(html);

      // Stamp footer onto every real physical page now that pagination is done
      onProgress?.('generating_pdf', 'Stamping page numbers…');
      const rawUri = pdfUri;
      let stampedUri: string | null = null;
      try {
        stampedUri = await withTimeout(
          addFooterToPdf(rawUri, data.company, data.reportId),
          PDF_STAMP_TIMEOUT_MS,
          'addFooterToPdf',
        );
      } catch (stampErr) {
        console.warn('[UMA BUILDING SERVICES] PDF stamping failed, using unstamped fallback:', stampErr);
      } finally {
        // BUG-N17 FIX: Always clean up the raw unstamped temp file even on timeout,
        // to prevent accumulating garbage on low-storage devices.
        // Only skip deletion if stampedUri is null (stamping failed) since rawUri IS pdfUri in that case.
        if (stampedUri && stampedUri !== rawUri) {
          FileSystem.deleteAsync(rawUri, { idempotent: true }).catch(() => {});
        }
      }

      if (stampedUri) {
        pdfUri = stampedUri;
      }

      onProgress?.('uploading');
      reportUrl = await uploadPdfToStorage(jobId, pdfUri, alreadyCompleted);
      
      // Cache the new hash only if upload succeeded
      if (reportUrl) {
        await AsyncStorage.setItem(cacheKey, htmlHash);
      }
    }

    // `completed` is true only when the job was already completed AND the PDF uploaded/exists OK.
    const completed = alreadyCompleted && reportUrl !== null;

    return { pdfUri, html, title, reportUrl, completed, wasCacheHit };
  } catch (error) {
    console.error('[UMA BUILDING SERVICES] PDF generation error:', error);
    throw error;
  }
}
