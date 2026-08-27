/**
 * lib/pdfGenerator.ts
 *
 * Client-side interface to the server-side PDF report pipeline.
 *
 * The actual PDF (fetch data → render HTML → convert via Gotenberg → upload
 * to Storage) is produced entirely by the standalone `services/report-generator`
 * service deployed on Render — this file only talks to it:
 *   - queueReportGeneration()  queues a `report_generate` sync-queue item so
 *     the sync engine (lib/sync.ts) calls the service's POST /generate-report
 *     next cycle (or immediately, if online).
 *   - pollReportStatus()       polls the service's GET /report-status directly
 *     (not via the sync queue) so the UI can show live progress/completion.
 *   - getOrRefreshReportUrl()  turns a stored Storage path into a fresh
 *     1-hour signed URL, caching it locally so repeat calls are instant.
 *   - hasReportUrl()           synchronous existence check for UI gating.
 *
 * There used to also be a fully on-device PDF pipeline here (expo-print +
 * pdf-lib, base64-encoding every photo client-side) from before this service
 * existed. It's been removed — the server pipeline has no asset-count ceiling
 * and doesn't hit WebView memory limits on large sites. See git history if
 * you ever need to look at how the on-device version worked.
 */

import {
  getRecord,
  updateRecord,
  addToSyncQueue,
  getPendingSyncItems,
} from '@/lib/database';
import { SyncOperation } from '@/constants/Enums';
import { REPORT_BUCKET } from '@/constants/Config';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/store/authStore';

// ─── Server-side PDF via sync queue ────────────────────────────────────────
//
// Always server-side, queue-backed:
//   Online  → sync engine calls the report-generator service on next cycle
//   Offline → request stored in sync_queue, fires automatically on reconnect
//
// This has no on-device asset-count ceiling — the report-generator service
// chunks large sites server-side (see services/report-generator's own
// MAX_ASSETS_PER_CHUNK), so any site size works identically from here.

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
 *   2. The polling loop in preview.tsx waits for the new result instead of
 *      short-circuiting with an expired URL.
 *   3. Duplicate queue entries are still prevented (idempotent per jobId).
 */
export function queueReportGeneration(jobId: string): ReportQueueResult {
  // Clear stale report_url from local DB BEFORE queuing. Otherwise getRecord
  // would return the old signed URL and the preview screen would immediately
  // show it — bypassing generation entirely and displaying an outdated PDF.
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

/**
 * Returns a valid signed URL for the job's PDF report.
 *
 * The Supabase DB (and SQLite after a PULL) stores only the permanent storage
 * PATH (e.g. "5f422fdb-....pdf"), not a signed URL. This function detects that
 * case and generates a fresh 1-hour signed URL from the path, then caches it
 * in SQLite so subsequent calls within the hour are instant.
 *
 * Returns null if no report has been generated yet.
 */
export async function getOrRefreshReportUrl(jobId: string): Promise<string | null> {
  const stored = getRecord<{ report_url: string | null }>('jobs', jobId)?.report_url ?? null;
  if (!stored) return null;

  // Already a full signed URL — return it directly
  if (stored.startsWith('https://')) return stored;

  // It's a raw storage path — generate a fresh signed URL
  const { data, error } = await supabase.storage
    .from(REPORT_BUCKET)
    .createSignedUrl(stored, 60 * 60); // 1-hour TTL

  if (error || !data?.signedUrl) {
    console.warn('[PDF] Failed to re-sign report URL for', jobId, error?.message);
    return null;
  }

  // Cache the signed URL in SQLite so the next call within the hour is instant
  updateRecord('jobs', jobId, { report_url: data.signedUrl });
  return data.signedUrl;
}

/** Synchronous check — returns true if a report exists (path or URL), false if none yet. */
export function hasReportUrl(jobId: string): boolean {
  return !!(getRecord<{ report_url: string | null }>('jobs', jobId)?.report_url);
}

// ─── Async generation status polling ───────────────────────────────────────
//
// Report generation runs in the background on the report-generator service
// (POST /generate-report responds as soon as the job is queued, not once the
// PDF is done — a multi-minute request was too fragile to hold open over a
// mobile network for large sites). This polls the service directly for real
// completion/failure, fully decoupled from the local sync queue: the sync
// queue item is only responsible for kicking generation off, never for
// reporting how it turned out.

export type ReportStatusResult =
  | { status: 'not_started' }
  | { status: 'generating'; startedAt: string | null }
  | { status: 'completed'; pdfUrl: string }
  | { status: 'failed'; error: string };

export async function pollReportStatus(jobId: string): Promise<ReportStatusResult> {
  const reportServiceUrl = process.env.EXPO_PUBLIC_REPORT_SERVICE_URL;
  if (!reportServiceUrl) {
    throw new Error('EXPO_PUBLIC_REPORT_SERVICE_URL is not configured');
  }
  const session = useAuthStore.getState().session;
  if (!session?.access_token) {
    throw new Error('No auth session');
  }

  const res = await fetch(`${reportServiceUrl}/report-status?jobId=${encodeURIComponent(jobId)}`, {
    headers: { Authorization: `Bearer ${session.access_token}` },
  });
  const data = await res.json().catch(() => null);
  if (!res.ok) {
    throw new Error(data?.error ?? `report-status returned HTTP ${res.status}`);
  }
  return data as ReportStatusResult;
}
