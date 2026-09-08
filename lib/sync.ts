// Background sync service — pulls from Supabase and pushes the offline sync queue every 60 seconds
import NetInfo from '@react-native-community/netinfo';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { RealtimeChannel } from '@supabase/supabase-js';
import { supabase, getCurrentUser } from '@/lib/supabase';
import {
  getPendingSyncItems,
  markSyncItemComplete,
  incrementSyncRetry,
  upsertRecord,
  upsertRecordBulk,
  getJobStatus,
  getDeletedPhotoIds,
  getDeletedDocumentIds,
  getFailedSyncItems,
  getRecord,
  deleteRecord,
  remapSyncQueueRecordId,
  updateSyncQueuePayload,
  applyRemoteDeletion,
  // retryAllFailedSyncItems is reserved for a future "Retry All" button in the UI
} from '@/lib/database';
import { useAuthStore } from '@/store/authStore';
import { SYNC_INTERVAL_MS, LAST_SYNCED_KEY, LAST_DELETION_LOG_ID_KEY, PHOTO_BUCKET, DOCUMENT_BUCKET } from '@/constants/Config';
import { SyncOperation } from '@/constants/Enums';
import type { SyncStatus } from '@/types';
import { processPhotoQueue, cleanupLocalPhotos } from '@/lib/photoUpload';
import { processDocumentQueue } from '@/lib/documentUpload';
import { classifySyncError } from '@/lib/syncErrors';

/** Re-exported for convenience — UI components only need to import from sync.ts */
export { retryAllFailedSyncItems } from '@/lib/database';

/** Max consecutive push failures before a sync queue item is permanently abandoned */
const MAX_SYNC_RETRIES = 5;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

const REPORT_SERVICE_WARMUP_MAX_WAIT_MS = 120_000;
const REPORT_SERVICE_WARMUP_POLL_MS = 4_000;

/**
 * Blocks until sitetrack-report-generator answers its own /health check, or
 * gives up quietly after REPORT_SERVICE_WARMUP_MAX_WAIT_MS. See the call site
 * in the report_generate handler below for why this exists — same cold-start
 * problem as Gotenberg's waitForGotenbergReady, one network hop further out.
 * Never throws: if the service is genuinely down (not just cold), the real
 * POST that follows still gets its own error handling and normal sync retry.
 */
async function waitForReportServiceReady(baseUrl: string): Promise<void> {
  const deadline = Date.now() + REPORT_SERVICE_WARMUP_MAX_WAIT_MS;
  while (Date.now() < deadline) {
    try {
      const res = await fetch(`${baseUrl}/health`);
      if (res.ok) return;
    } catch {
      // Still asleep / mid-boot — keep waiting.
    }
    await sleep(REPORT_SERVICE_WARMUP_POLL_MS);
  }
}

// Mutex for processPhotoQueue — prevents overlapping manual + interval calls (BUG-N12)
let _isProcessingPhotos = false;
// Same idea for processDocumentQueue — see the photo mutex above.
let _isProcessingDocuments = false;

/**
 * Status priority ladder for conflict resolution.
 * Higher number = further along in the job lifecycle.
 * A local status should never be overwritten by a server status with a lower priority
 * unless the local change is stale (> 6 hours old).
 */
const STATUS_PRIORITY: Record<string, number> = {
  cancelled: 0,
  scheduled: 1,
  in_progress: 2,
  completed: 3,
};
const STALE_THRESHOLD_MS = 6 * 60 * 60 * 1000; // 6 hours

// ─────────────────────────────────────────────
// Internal state
// ─────────────────────────────────────────────

let _syncInterval: ReturnType<typeof setInterval> | null = null;
let _isSyncing  = false;
let _shouldStop = false;   // Set by stopSync() to abort an in-progress runSync()
let _cachedUserId: string | null = null;

// ─────────────────────────────────────────────
// Sync-complete event bus
// Stores subscribe here and reload from SQLite
// whenever a sync cycle finishes successfully.
// ─────────────────────────────────────────────
type SyncCompleteListener = () => void;
const _syncListeners = new Set<SyncCompleteListener>();

/** Subscribe to be notified after every successful sync run */
export function onSyncComplete(listener: SyncCompleteListener): void {
  _syncListeners.add(listener);
}

/** Unsubscribe a previously registered listener */
export function offSyncComplete(listener: SyncCompleteListener): void {
  _syncListeners.delete(listener);
}

/** H2: Clears ALL sync listeners — called on sign-out to prevent stale listener accumulation */
export function clearSyncListeners(): void {
  _syncListeners.clear();
}

/** Called internally after every successful sync to notify subscribers */
function _emitSyncComplete(): void {
  _syncListeners.forEach((fn) => {
    try { fn(); } catch (e) { console.warn('[SiteTrack Sync] listener error:', e); }
  });
}

// ─────────────────────────────────────────────
// Sync-failure alert event bus
// Fired when items permanently fail to sync.
// UI (SyncStatusBar / root layout) subscribes
// to show the user a dismissible alert.
// ─────────────────────────────────────────────
export interface SyncFailureAlert {
  /** Number of permanently-failed items */
  failedCount: number;
  /** Affected table names (de-duplicated) */
  tables: string[];
  /** Last error message from the most-recently failed item */
  lastError: string;
  /**
   * How many of the failed items are terminal — a real data/permission
   * problem that will never succeed on its own, as opposed to a transient
   * error that simply exhausted its retry budget while an outage was ongoing.
   */
  terminalCount: number;
}
type SyncFailureListener = (alert: SyncFailureAlert) => void;
const _failureListeners = new Set<SyncFailureListener>();

/** Subscribe to be notified when sync items permanently fail */
export function onSyncFailure(listener: SyncFailureListener): void {
  _failureListeners.add(listener);
}

/** Unsubscribe a sync failure listener */
export function offSyncFailure(listener: SyncFailureListener): void {
  _failureListeners.delete(listener);
}

/** Clears ALL failure listeners — called on sign-out */
export function clearSyncFailureListeners(): void {
  _failureListeners.clear();
}

/**
 * Called when permanently-failed items are detected during a sync run.
 * Emits to all registered UI listeners so the user sees an alert.
 */
function _emitSyncFailureAlert(alert: SyncFailureAlert): void {
  // Always console.warn — visible in Expo Go and production logs
  console.warn(
    `[SiteTrack Sync] ALERT: ${alert.failedCount} item(s) failed to sync permanently. ` +
    `Tables: ${alert.tables.join(', ')}. Last error: ${alert.lastError}`
  );
  _failureListeners.forEach((fn) => {
    try { fn(alert); } catch (e) { console.warn('[SiteTrack Sync] failure listener error:', e); }
  });
}

// ─────────────────────────────────────────────
// Public API
// ─────────────────────────────────────────────

/**
 * Starts the background sync loop — call once from the root layout on mount.
 * Pass userId so sync doesn't need to re-fetch auth (avoids race conditions on startup).
 */
export function startSync(userId?: string): void {
  // Always update the cached userId so a re-login with a different user works correctly
  if (userId) _cachedUserId = userId;

  if (_syncInterval) {
    // Already running — just trigger an immediate sync with the updated userId
    if (__DEV__) console.log('[SiteTrack Sync] Already running — triggering immediate sync');
    void runSync(userId);
    return;
  }
  if (__DEV__) console.log(`[SiteTrack Sync] Starting sync interval (${SYNC_INTERVAL_MS / 1000}s)`);
  // Run immediately on start, then repeat on interval
  void runSync(userId);
  _syncInterval = setInterval(() => {
    void runSync(_cachedUserId ?? undefined);
  }, SYNC_INTERVAL_MS);
}

/** Stops the background sync loop — call on app unmount / sign-out */
export function stopSync(): void {
  _shouldStop = true;
  if (_syncInterval) {
    clearInterval(_syncInterval);
    _syncInterval = null;
    if (__DEV__) console.log('[SiteTrack Sync] Sync stopped');
  }
  _cachedUserId = null;
  // Hard reset, not the refcounted unsubscribeFromJobLive() — sign-out must
  // guarantee no channel survives into a different user's session on this
  // device, regardless of how many job screens think they still want it open.
  _teardownLiveChannel();
  _teardownMyDataChannel();
  // H2: Purge all listeners on sign-out to prevent stale refs from previous session
  clearSyncListeners();
  clearSyncFailureListeners();
}

/** Returns the currently cached user ID — useful for fire-and-forget callers */
export function getCachedUserId(): string | null {
  return _cachedUserId;
}

/**
 * Returns the current sync status snapshot:
 * - lastSynced: ISO timestamp from AsyncStorage, or null
 * - pendingCount: number of items waiting in the sync queue
 * - failedCount: number of items permanently abandoned (synced = -1)
 * - isOnline: current network reachability
 */
export async function getSyncStatus(): Promise<SyncStatus> {
  const netState = await NetInfo.fetch();
  const lastSynced = await AsyncStorage.getItem(LAST_SYNCED_KEY);
  const pending = getPendingSyncItems();
  const failed  = getFailedSyncItems();
  return {
    lastSynced,
    pendingCount: pending.length,
    failedCount:  failed.length,
    isOnline: netState.isConnected === true && netState.isInternetReachable !== false,
  };
}

// ─────────────────────────────────────────────
// Core sync logic
// ─────────────────────────────────────────────

/**
 * Main sync function. Returns `true` if a sync cycle fully ran,
 * `false` if it was skipped (already in progress, offline, aborted, or no user).
 * Accepts an optional userId to avoid re-fetching auth on every call.
 */
export async function runSync(userId?: string): Promise<boolean> {
  if (_isSyncing) {
    if (__DEV__) console.log('[SiteTrack Sync] Already in progress — skipping');
    return false;
  }

  // Reset abort flag at the start of each new run
  _shouldStop = false;

  // ── 1. Network check ─────────────────────────────────────────
  const netState = await NetInfo.fetch();
  const isOnline =
    netState.isConnected === true && netState.isInternetReachable !== false;

  if (!isOnline) {
    if (__DEV__) console.log('[SiteTrack Sync] Offline — skipping sync');
    return false;
  }

  _isSyncing = true;
  if (__DEV__) console.log('[SiteTrack Sync] Starting sync run...');

  try {
    let resolvedUserId = userId ?? _cachedUserId;
    if (!resolvedUserId) {
      const user = await getCurrentUser();
      if (_shouldStop) return false;
      if (!user) {
        if (__DEV__) console.log('[SiteTrack Sync] No authenticated user — skipping');
        return false;
      }
      resolvedUserId = user.id;
      _cachedUserId  = resolvedUserId;
    }

    if (_shouldStop) return false;
    if (__DEV__) console.log(`[SiteTrack Sync] Syncing for user: ${resolvedUserId}`);

    // --- REALTIME REVOCATION CHECK ---
    const { data: profile } = await supabase.from('users').select('is_active, company_id').eq('id', resolvedUserId).single();
    if (profile?.is_active === false) {
      console.warn('[SiteTrack Sync] Access revoked (User inactive). Forcing sign out.');
      useAuthStore.getState().forceFinalSyncAndSignOut();
      return false;
    }
    if (profile?.company_id) {
      const { data: company } = await supabase.from('companies').select('subscription_status').eq('id', profile.company_id).single();
      if (company?.subscription_status === 'suspended' || company?.subscription_status === 'cancelled') {
        console.warn('[SiteTrack Sync] Access revoked (Company suspended/cancelled). Forcing sign out.');
        useAuthStore.getState().forceFinalSyncAndSignOut();
        return false;
      }
    }
    // ---------------------------------

    // ── 2. PUSH — upload photo binaries then flush sync queue ────
    // BUG-N12 FIX: Guard processPhotoQueue with a boolean mutex so a manual
    // call from the report/preview screen can't overlap with the sync interval.
    if (!_isProcessingPhotos) {
      _isProcessingPhotos = true;
      try {
        await processPhotoQueue(resolvedUserId);
      } finally {
        _isProcessingPhotos = false;
      }
    } else {
      if (__DEV__) console.log('[SiteTrack Sync] Photo queue already processing — skipping duplicate run');
    }
    if (_shouldStop) return false;

    if (!_isProcessingDocuments) {
      _isProcessingDocuments = true;
      try {
        await processDocumentQueue(resolvedUserId);
      } finally {
        _isProcessingDocuments = false;
      }
    } else {
      if (__DEV__) console.log('[SiteTrack Sync] Document queue already processing — skipping duplicate run');
    }
    if (_shouldStop) return false;

    await _pushQueue(resolvedUserId);
    if (_shouldStop) return false;

    // ── 3. PULL — server → local SQLite ──────────────────────────
    const lastSynced = await AsyncStorage.getItem(LAST_SYNCED_KEY);
    if (_shouldStop) return false;
    await _pullJobs(resolvedUserId, lastSynced);
    if (_shouldStop) return false;
    await _pullDeletions();
    if (_shouldStop) return false;

    // ── 4. Timestamp ──────────────────────────────────────────────
    const now = new Date().toISOString();
    await AsyncStorage.setItem(LAST_SYNCED_KEY, now);
    if (__DEV__) console.log(`[SiteTrack Sync] Sync complete at ${now}`);

    // ── 5. Warn about permanently-failed items and give stale ones a fresh retry
    // FIX: Items that have been permanently abandoned for >24h get their retry
    // budget reset. This prevents a transient network issue (RLS policy lag,
    // momentary offline) from permanently silencing a tech's field data.
    const { resetStaleFailedSyncItems } = await import('@/lib/database');
    const resetCount = resetStaleFailedSyncItems(24 * 60 * 60 * 1000);
    if (resetCount > 0 && __DEV__)
      console.log(`[SiteTrack Sync] Reset ${resetCount} stale permanently-failed item(s) for retry`);

    const failedItems = getFailedSyncItems();
    if (failedItems.length > 0) {
      // DECISION #3: never silently discard — always inform the user when data
      // cannot reach the server after exhausting all retries.
      _emitSyncFailureAlert({
        failedCount: failedItems.length,
        tables: [...new Set(failedItems.map(i => i.table_name))],
        lastError: failedItems[0]?.last_error ?? 'Unknown error',
        terminalCount: failedItems.filter(i => i.is_terminal === 1).length,
      });
    }

    // ── 6. Clean up local photo files (15-day retention policy) ──────
    // Runs AFTER the photo upload queue so we only ever delete a local file
    // once photo_url has been confirmed as an https:// Supabase URL.
    // cleanupLocalPhotos() catches all its own errors \u2014 it can never crash sync.
    await cleanupLocalPhotos();

    // ── 7. Notify subscribers (stores reload from SQLite) ─────────────
    _emitSyncComplete();
    return true;
  } catch (err) {
    console.error('[SiteTrack Sync] Unexpected error during sync:', err);
    return false;
  } finally {
    _isSyncing = false;
  }
}

/**
 * Bounded wait (up to 5s, polling every 500ms) for any in-flight runSync()
 * to actually finish, rather than merely being told to stop.
 *
 * FIX: stopSync() only sets a flag (_shouldStop) that a running _pullJobs()
 * checks at a few outer boundaries — it never aborts a pull already mid-
 * flight, whose network fetches and the local upsertRecord/upsertRecordBulk
 * writes they trigger all run to completion regardless. authStore's
 * signOut() and its SIGNED_OUT listener counterpart both call stopSync()
 * then, in the COMMON case where nothing is queued to push, went straight
 * to clearDatabase() with no wait at all — so a background sync tick that
 * happened to be mid-_pullJobs() when the user tapped Sign Out could still
 * write rows for the just-logged-out user into local SQLite *after* it had
 * just been wiped for the next login, a real cross-account data exposure on
 * a shared device. Both callers now await this before wiping. Bounded, not
 * indefinite — a stuck sync must never block sign-out forever; the worst
 * case if the wait times out is the pre-existing race, not a new hang.
 */
export async function waitForSyncIdle(maxWaitMs = 5000): Promise<void> {
  const stepMs = 500;
  for (let waited = 0; _isSyncing && waited < maxWaitMs; waited += stepMs) {
    await new Promise((r) => setTimeout(r, stepMs));
  }
}

/**
 * Pushes photo binaries then the sync queue, guarded by the same
 * `_isProcessingPhotos` mutex runSync() uses internally — plus a bounded wait
 * for any already-in-flight runSync() to finish its own push first.
 *
 * For use ONLY by authStore's signOut()/forceFinalSyncAndSignOut(), which
 * can't just call runSync(): runSync's revocation/subscription check would
 * immediately re-detect the same deactivated/suspended account and re-call
 * forceFinalSyncAndSignOut() (a no-op re-entrancy guard), short-circuiting
 * before the push step ever runs — the whole reason those callers do their
 * own push instead. Previously that bypass called processPhotoQueue()/
 * _pushQueue() directly with no mutex at all: a technician signing out while
 * the background 60s interval was mid-upload could run two concurrent
 * processPhotoQueue() passes, each uploading the same local photo under a
 * different generated filename and racing to insert the same
 * inspection_photos.id, orphaning a Storage object. Screens should still use
 * runSync() for normal sync triggering — this is not a general substitute.
 */
export async function pushPendingWork(userId: string): Promise<void> {
  for (let waited = 0; _isSyncing && waited < 10; waited++) {
    await new Promise((r) => setTimeout(r, 500));
  }
  if (!_isProcessingPhotos) {
    _isProcessingPhotos = true;
    try {
      await processPhotoQueue(userId);
    } finally {
      _isProcessingPhotos = false;
    }
  }
  if (!_isProcessingDocuments) {
    _isProcessingDocuments = true;
    try {
      await processDocumentQueue(userId);
    } finally {
      _isProcessingDocuments = false;
    }
  }
  await _pushQueue(userId);
}

/**
 * Live sync for ONE open job — a crew job can have several technicians
 * actioning different (or occasionally the same) assets at once, and
 * waiting on the full SYNC_INTERVAL_MS cycle (which also uploads
 * photo/document binaries, pulls every job, and re-checks
 * company/subscription status) made a teammate's change take up to two
 * minutes to appear. This used to be a 2.5s poll; it's now a Supabase
 * Realtime subscription — push instead of poll, so updates land in under a
 * second and only the row that actually changed is ever sent, instead of
 * re-fetching this job's entire asset/defect list on a timer regardless of
 * whether anything changed.
 *
 * Covers job_assets, defects, inspection_photos (see 20260906000000_*),
 * job_technicians, quotes, time_logs, site_documents (see
 * 20260908020000_*), and signatures (see 20260909000000_*) — matters more
 * now that SYNC_INTERVAL_MS itself has
 * been stretched way out (see its own comment in constants/Config.ts):
 * this channel, not the periodic pull, is now the primary way any of these
 * tables reach a device while it's actively looking at the job, not just a
 * safety net. Each incoming row is reconciled through the same guards
 * _pullRelated uses for that table where one exists (_shouldPreserveLocalJobAsset
 * for job_assets, the deleted-photo/deleted-document tombstone for
 * inspection_photos/site_documents) — job_technicians/quotes/time_logs get
 * a plain upsert, same as the periodic pull already gives them (no local
 * write path exists for job_technicians/time_logs, and quotes/quote_items
 * are admin-only edits, so there's nothing local to protect). quote_items
 * has no job_id column to filter a postgres_changes subscription on, so
 * it isn't subscribed directly — every quote_item write also updates its
 * parent quote's total_amount in the same action (see quote.tsx/
 * defectsStore's own write sites), so a quotes change re-pulls that
 * quote's items as a catch-up instead. DELETE is deliberately not
 * subscribed to for any of these tables — see the migration that enables
 * this (supabase/migrations/20260901010000_*) for why that's not a
 * regression versus the poll it replaces.
 */
let _liveChannel: RealtimeChannel | null = null;
let _liveJobId: string | null = null;
// Always points at the MOST RECENTLY focused screen's callback — updated on
// every subscribeToJobLive call, even when the channel itself doesn't need
// recreating, so events reach whichever screen is actually on-screen right
// now rather than whichever one happened to create the channel first.
let _liveOnChange: ((table: JobLiveChangeTable) => void) | null = null;
// How many currently-focused screens want this job's channel open — see
// subscribeToJobLive's comment for why this is counted rather than a plain
// on/off flag.
let _liveRefCount = 0;

export type JobLiveChangeTable =
  | 'job_assets' | 'defects' | 'inspection_photos' | 'jobs'
  | 'job_technicians' | 'quotes' | 'quote_items' | 'time_logs' | 'site_documents'
  | 'signatures';

/**
 * Opens (or re-opens, if jobId differs) a live channel for this job, and
 * registers as one more caller that wants it open.
 *
 * Reference-counted rather than a plain idempotency check: several of a
 * job's screens (checklist list, an asset's detail screen, the defects
 * list, the job overview) each call this on their own focus and
 * unsubscribeFromJobLive() on their own blur, via useJobLiveSync. Only one
 * screen is ever actually focused at a time, but React Navigation doesn't
 * guarantee whether the outgoing screen's blur or the incoming screen's
 * focus fires first during a transition — with a plain flag, an unlucky
 * order could have the outgoing screen's unconditional teardown kill a
 * channel the incoming screen just opened (or leave the channel silently
 * bound to a callback whose screen already left, since the original
 * version captured `onChange` once in a closure and skipped rebinding it
 * whenever a channel already existed). Counting wanting-callers instead
 * means the channel only actually closes once NOTHING wants it, in either
 * firing order — worst case one extra reconnect, never a dropped
 * connection or a stale callback.
 *
 * Every successful (re)connect runs a one-time catch-up pull via the
 * existing _pullRelated — a live channel never retroactively delivers
 * events missed while disconnected, so this also covers the
 * offline-reconnect gap and the brief handoff between two of this job's
 * screens if the channel did momentarily close and reopen.
 */
export function subscribeToJobLive(jobId: string, onChange: (table: JobLiveChangeTable) => void): void {
  if (!jobId) return;

  if (_liveJobId && _liveJobId !== jobId) {
    // Actually switching jobs, not a same-job screen handoff — the old
    // channel is unconditionally wrong now regardless of its refcount.
    _teardownLiveChannel();
  }

  _liveJobId = jobId;
  _liveOnChange = onChange;
  _liveRefCount++;

  if (_liveChannel) return; // already open for this job — just swapped the handler in and bumped the count

  const applyJobAsset = (row: Record<string, unknown>) => {
    const localRow = getRecord<{ result: string | null; actioned_at: string | null }>(
      'job_assets', row.id as string
    );
    if (_shouldPreserveLocalJobAsset(row, localRow)) {
      if (__DEV__) console.log(`[SiteTrack Sync] Realtime: preserving local job_asset result over incoming row for ${row.id}`);
      return;
    }
    upsertRecord('job_assets', row as Record<string, string | number | boolean | null>);
    _liveOnChange?.('job_assets');
  };

  const applyDefect = (row: Record<string, unknown>) => {
    // FIX: same anti-clobber protection applyJobAsset already had — a
    // realtime echo of someone else's write (or a stale replay from a
    // channel that only just reconnected) could otherwise overwrite a
    // locally-edited defect that hasn't pushed yet.
    const localRow = getRecord<{ updated_at: string | null }>('defects', row.id as string);
    if (_shouldPreserveLocalRow(row, localRow)) {
      if (__DEV__) console.log(`[SiteTrack Sync] Realtime: preserving local defect over incoming row for ${row.id}`);
      return;
    }
    // defects.photos is a Postgres text[] — arrives as a real JS array over
    // the wire; SQLite needs the same JSON string every other write path
    // into this column already uses (see defectsStore.ts's normaliseDefects).
    const photos: string = Array.isArray(row.photos) ? JSON.stringify(row.photos) : String(row.photos ?? '[]');
    upsertRecord('defects', { ...row, photos } as Record<string, string | number | boolean | null>);
    _liveOnChange?.('defects');
  };

  // Same tombstone check _pullRelated applies for this table — without it, a
  // photo this device (or another one, already synced here) deleted could
  // get resurrected by a stray/late INSERT or UPDATE event for that same id.
  const applyPhoto = (row: Record<string, unknown>) => {
    const rowId = row.id as string;
    if (getDeletedPhotoIds().has(rowId)) return;
    upsertRecord('inspection_photos', row as Record<string, string | number | boolean | null>);
    _liveOnChange?.('inspection_photos');
  };

  // FIX: the live channel never listened to the `jobs` table itself — only
  // job_assets/defects/inspection_photos. So a plain status change (e.g.
  // "Start Job", Scheduled -> In Progress) never reached a teammate's device
  // that already had this job open; it only APPEARED to eventually catch up
  // because completing a job is normally preceded by a flurry of job_assets/
  // defects changes that already trigger a refresh, or because the next
  // periodic 60s sync cycle happened to land. Same status-priority guard
  // _pullJobs already uses for the periodic pull, applied here too so a
  // stale/out-of-order realtime echo can't regress a locally-more-advanced
  // status.
  const applyJob = (row: Record<string, unknown>) => {
    const rowId = row.id as string;
    if (rowId !== jobId) return;
    const localStatus = getJobStatus(rowId);
    // FIX: same 'cancelled' fix as _pullJobs's own job-upsert loop — it's an
    // administrative override, not a step on the scheduled/in_progress/
    // completed progression STATUS_PRIORITY ranks, so it must always apply
    // immediately rather than being treated as a "stale, lower-priority"
    // regression of whatever the technician had gotten to locally.
    if (localStatus && row.status !== 'cancelled') {
      const serverPriority = STATUS_PRIORITY[row.status as string] ?? 1;
      const localPriority  = STATUS_PRIORITY[localStatus.status]   ?? 1;
      if (localPriority > serverPriority) {
        const localUpdateMs = new Date(localStatus.updated_at).getTime();
        if (Date.now() - localUpdateMs <= STALE_THRESHOLD_MS) return; // local wins
      }
    }
    upsertRecord('jobs', row as Record<string, string | number | boolean | null>);
    _liveOnChange?.('jobs');
  };

  // No local write path exists for job_technicians (crew assignment is
  // admin-only, bar the one self-assign Insert in site-inspect.tsx which
  // never races a live echo of itself) or time_logs (not written by the
  // mobile app at all yet) — plain upsert, same as the periodic pull.
  const applyJobTechnician = (row: Record<string, unknown>) => {
    upsertRecord('job_technicians', row as Record<string, string | number | boolean | null>);
    _liveOnChange?.('job_technicians');
  };

  const applyTimeLog = (row: Record<string, unknown>) => {
    upsertRecord('time_logs', row as Record<string, string | number | boolean | null>);
    _liveOnChange?.('time_logs');
  };

  // FIX: every quote_item write also bumps its parent quote's total_amount
  // in the same action (see this function's own doc comment), so an admin
  // editing several line items in one save fires one `quotes` UPDATE per
  // item — each independently kicking off its own quote_items re-fetch
  // below. Ordinary network jitter between concurrent requests means an
  // OLDER fetch can resolve AFTER a newer one, silently overwriting fresher
  // line items with stale ones. This sequence number lets each fetch tell
  // whether a newer one has since superseded it before it's allowed to
  // write anything.
  const quotePullSeq = new Map<string, number>();

  // Quotes are admin-only edits (quote.tsx is read-only on the mobile side)
  // so there's no local edit to protect against a stale echo — plain
  // upsert. See this function's own doc comment for why quote_items rides
  // along here instead of its own subscription.
  const applyQuote = (row: Record<string, unknown>) => {
    upsertRecord('quotes', row as Record<string, string | number | boolean | null>);
    _liveOnChange?.('quotes');
    const quoteId = row.id as string;
    const seq = (quotePullSeq.get(quoteId) ?? 0) + 1;
    quotePullSeq.set(quoteId, seq);
    void (async () => {
      const { data, error } = await supabase.from('quote_items').select('*').eq('quote_id', quoteId);
      // A newer quotes event for this same quote already superseded this
      // fetch — discard rather than write stale line items over it.
      if (quotePullSeq.get(quoteId) !== seq) return;
      if (error) {
        console.error('[SiteTrack Sync] Realtime: PULL quote_items error:', error.message);
        return;
      }
      if (data) {
        for (const item of data) {
          upsertRecord('quote_items', item as Record<string, string | number | boolean | null>);
        }
      }
      _liveOnChange?.('quote_items');
    })();
  };

  // Same tombstone check applyPhoto uses above — a document this device (or
  // one already synced here) deleted could otherwise be resurrected by a
  // stray/late event for that same id.
  const applyDocument = (row: Record<string, unknown>) => {
    const rowId = row.id as string;
    if (getDeletedDocumentIds().has(rowId)) return;
    // FIX: same anti-clobber protection _pullRelated now applies for this
    // table — without it, a rename could be silently reverted by a
    // realtime echo of this row's own upload-completion Insert (or a
    // reconnect catch-up pull racing right behind it) landing after the
    // rename but carrying the pre-rename title.
    const localRow = getRecord<{ updated_at: string | null }>('site_documents', rowId);
    if (_shouldPreserveLocalRow(row, localRow)) {
      if (__DEV__) console.log(`[SiteTrack Sync] Realtime: preserving local site_documents row over incoming row for ${rowId}`);
      return;
    }
    upsertRecord('site_documents', row as Record<string, string | number | boolean | null>);
    _liveOnChange?.('site_documents');
  };

  // Signature.tsx keeps its own in-progress draft in AsyncStorage, never in
  // this table, so there's nothing local this could clobber — plain upsert,
  // same as job_technicians/time_logs above.
  const applySignature = (row: Record<string, unknown>) => {
    upsertRecord('signatures', row as Record<string, string | number | boolean | null>);
    _liveOnChange?.('signatures');
  };

  _liveChannel = supabase
    .channel(`job-live:${jobId}`)
    .on<Record<string, unknown>>('postgres_changes', { event: 'INSERT', schema: 'public', table: 'job_assets', filter: `job_id=eq.${jobId}` }, (p) => applyJobAsset(p.new))
    .on<Record<string, unknown>>('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'job_assets', filter: `job_id=eq.${jobId}` }, (p) => applyJobAsset(p.new))
    .on<Record<string, unknown>>('postgres_changes', { event: 'INSERT', schema: 'public', table: 'defects',    filter: `job_id=eq.${jobId}` }, (p) => applyDefect(p.new))
    .on<Record<string, unknown>>('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'defects',    filter: `job_id=eq.${jobId}` }, (p) => applyDefect(p.new))
    .on<Record<string, unknown>>('postgres_changes', { event: 'INSERT', schema: 'public', table: 'inspection_photos', filter: `job_id=eq.${jobId}` }, (p) => applyPhoto(p.new))
    .on<Record<string, unknown>>('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'inspection_photos', filter: `job_id=eq.${jobId}` }, (p) => applyPhoto(p.new))
    .on<Record<string, unknown>>('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'jobs', filter: `id=eq.${jobId}` }, (p) => applyJob(p.new))
    .on<Record<string, unknown>>('postgres_changes', { event: 'INSERT', schema: 'public', table: 'job_technicians', filter: `job_id=eq.${jobId}` }, (p) => applyJobTechnician(p.new))
    .on<Record<string, unknown>>('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'job_technicians', filter: `job_id=eq.${jobId}` }, (p) => applyJobTechnician(p.new))
    .on<Record<string, unknown>>('postgres_changes', { event: 'INSERT', schema: 'public', table: 'quotes', filter: `job_id=eq.${jobId}` }, (p) => applyQuote(p.new))
    .on<Record<string, unknown>>('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'quotes', filter: `job_id=eq.${jobId}` }, (p) => applyQuote(p.new))
    .on<Record<string, unknown>>('postgres_changes', { event: 'INSERT', schema: 'public', table: 'time_logs', filter: `job_id=eq.${jobId}` }, (p) => applyTimeLog(p.new))
    .on<Record<string, unknown>>('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'time_logs', filter: `job_id=eq.${jobId}` }, (p) => applyTimeLog(p.new))
    .on<Record<string, unknown>>('postgres_changes', { event: 'INSERT', schema: 'public', table: 'site_documents', filter: `job_id=eq.${jobId}` }, (p) => applyDocument(p.new))
    .on<Record<string, unknown>>('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'site_documents', filter: `job_id=eq.${jobId}` }, (p) => applyDocument(p.new))
    .on<Record<string, unknown>>('postgres_changes', { event: 'INSERT', schema: 'public', table: 'signatures', filter: `job_id=eq.${jobId}` }, (p) => applySignature(p.new))
    .on<Record<string, unknown>>('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'signatures', filter: `job_id=eq.${jobId}` }, (p) => applySignature(p.new))
    .subscribe((status, err) => {
      if (status === 'SUBSCRIBED') {
        if (__DEV__) console.log(`[SiteTrack Sync] Realtime subscribed for job ${jobId}`);
        void _pullRelated('job_assets', 'job_id', [jobId]).then(() => _liveOnChange?.('job_assets'));
        void _pullRelated('defects', 'job_id', [jobId]).then(() => _liveOnChange?.('defects'));
        void _pullRelated('inspection_photos', 'job_id', [jobId]).then(() => _liveOnChange?.('inspection_photos'));
        void _pullRelated('job_technicians', 'job_id', [jobId]).then(() => _liveOnChange?.('job_technicians'));
        void _pullRelated('time_logs', 'job_id', [jobId]).then(() => _liveOnChange?.('time_logs'));
        void _pullRelated('site_documents', 'job_id', [jobId]).then(() => _liveOnChange?.('site_documents'));
        void _pullRelated('signatures', 'job_id', [jobId]).then(() => _liveOnChange?.('signatures'));
        void (async () => {
          await _pullRelated('quotes', 'job_id', [jobId]);
          _liveOnChange?.('quotes');
          const { data: quoteRows } = await supabase.from('quotes').select('id').eq('job_id', jobId);
          if (quoteRows && quoteRows.length > 0) {
            await _pullRelated('quote_items', 'quote_id', quoteRows.map((q) => q.id as string));
            _liveOnChange?.('quote_items');
          }
        })();
      } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
        if (__DEV__) console.warn(`[SiteTrack Sync] Realtime ${status} for job ${jobId} — auto-retrying:`, err);
      }
    });
}

/**
 * One fewer screen wants the live channel open. Only actually tears it down
 * once nothing does (see subscribeToJobLive's comment on the refcounting) —
 * call this on screen blur and app background, exactly once per matching
 * subscribeToJobLive call. Sign-out uses the internal hard reset instead
 * (see stopSync) since it must guarantee no channel survives regardless of
 * how many screens think they still want it.
 */
export function unsubscribeFromJobLive(): void {
  if (_liveRefCount > 0) _liveRefCount--;
  if (_liveRefCount === 0) _teardownLiveChannel();
}

function _teardownLiveChannel(): void {
  if (_liveChannel) void supabase.removeChannel(_liveChannel);
  _liveChannel = null;
  _liveJobId = null;
  _liveOnChange = null;
  _liveRefCount = 0;
}

// ─────────────────────────────────────────────
// "My data" live channel — everything for this technician, whole-session
// ─────────────────────────────────────────────
/**
 * subscribeToJobLive only ever covers ONE open job's screens — Home, the
 * Schedule tab, the global Defects list, Property Detail, and the Property
 * Asset Register all show data across MANY jobs/properties at once, so none
 * of them has a single job to "tune into." Their only path to fresh data
 * used to be the periodic SYNC_INTERVAL_MS pull (now 10 minutes — see its
 * own comment in constants/Config.ts), so a newly-assigned job, a
 * cancellation, or a new defect anywhere in the company could take up to
 * 10 minutes to show up there, even though every job-scoped screen already
 * gets the same kind of change within a second or two.
 *
 * Opened once per login (app/(app)/_layout.tsx, alongside startSync) and
 * stays open for the whole session — unlike subscribeToJobLive this is NOT
 * screen-focus-scoped, since there's no single screen that "owns" it the
 * way a job's screens hand a channel off between each other; every screen
 * that cares just wants to hear about the same events for as long as the
 * app is open.
 *
 * Every handler below (1) writes the incoming row to local SQLite with the
 * same guard the periodic pull already uses for that table where one
 * exists (STATUS_PRIORITY for jobs, _shouldPreserveLocalRow for
 * defects/assets — properties/notifications/users/catalogue tables have no
 * local-edit path from the mobile app to protect, so a plain upsert
 * matches what the periodic pull already does for them too), then (2)
 * calls _emitSyncComplete() — the EXACT signal the periodic sync already
 * fires when it finishes. Any screen already reloading on that signal
 * (jobsStore is subscribed globally in app/(app)/_layout.tsx, which is
 * what already keeps Home/Schedule's job lists current; the global Defects
 * screen already listens too) gets this for free. Screens that had no such
 * listener at all — Notifications, single Asset detail, Property Detail,
 * Property Asset Register — each gained one. Profile reads reactively from
 * authStore rather than local SQLite, so applyMyUser patches that store
 * directly instead. Because both this channel and the 10-minute fallback
 * end at that identical reload call, they can't disagree with each other —
 * whichever fires first does the real work; the other, if it fires later
 * and finds nothing new, is a harmless repeat.
 *
 * Covers, beyond the original set: catalogue/reference tables (rarely
 * change, but the channel already exists so there's no real cost — see
 * applyCatalogueRow), deletion_log (propagates a deletion made on ANOTHER
 * device — see supabase/migrations/20260910000000_deletion_log.sql and
 * _pullDeletions, its offline catch-up counterpart), and — the two gaps
 * this used to carry as known limitations, now closed:
 * - `jobs` UPDATE is unfiltered (RLS-scoped to this technician's own
 *   company) rather than assigned_to=eq.<userId>, specifically to catch a
 *   status change on a job this technician is only a job_technicians CREW
 *   member of. See applyJob's own `requireLocal` comment for how this
 *   avoids leaking every job in the company into a technician's own data.
 * - Notifications are also subscribed unfiltered, with the "mine or a
 *   broadcast" check done in JS (applyNotification) instead of relying on
 *   Realtime's filter grammar to support an IS NULL comparison, which
 *   isn't confirmed the way a plain REST query's is.
 */
let _myDataChannel: RealtimeChannel | null = null;
let _myDataUserId: string | null = null;

export function subscribeToMyDataLive(userId: string): void {
  if (!userId) return;
  if (_myDataChannel && _myDataUserId === userId) return; // already on for this user
  if (_myDataChannel) _teardownMyDataChannel();
  _myDataUserId = userId;

  // FIX: the UPDATE binding below is now unfiltered (RLS-scoped to this
  // technician's own company, not assigned_to=this user) specifically to
  // catch a status change on a job this technician is a job_technicians
  // CREW member of but not the primary assignee — Realtime's filter
  // grammar is a plain column comparison, it can't express "assigned_to =
  // me OR id IN (my crew job ids)" the way the periodic pull's own query
  // does. `requireLocal` (true for that unfiltered UPDATE binding) only
  // applies the update if this job is ALREADY known locally — meaning the
  // periodic pull's own correct assigned_to/crew check already decided
  // this technician should have it — otherwise every job in the company
  // would start appearing, not just this technician's own. The two callers
  // that pass requireLocal=false (a genuinely new assigned_to=eq.userId
  // INSERT, and applyMyJobTechnician's catch-up fetch right after being
  // added to a job's crew) are both cases where relevance is already
  // established a different way, so there's nothing to gate.
  const applyJob = (row: Record<string, unknown>, requireLocal: boolean) => {
    const rowId = row.id as string;
    const localStatus = getJobStatus(rowId);
    if (requireLocal && !localStatus) return;
    // Same 'cancelled' override as subscribeToJobLive's own applyJob — an
    // administrative override, not a step on the priority ladder.
    if (localStatus && row.status !== 'cancelled') {
      const serverPriority = STATUS_PRIORITY[row.status as string] ?? 1;
      const localPriority  = STATUS_PRIORITY[localStatus.status]   ?? 1;
      if (localPriority > serverPriority) {
        const localUpdateMs = new Date(localStatus.updated_at).getTime();
        if (Date.now() - localUpdateMs <= STALE_THRESHOLD_MS) return;
      }
    }
    upsertRecord('jobs', row as Record<string, string | number | boolean | null>);
    _emitSyncComplete();
  };

  // Being newly ADDED to a job's crew — job_technicians alone doesn't carry
  // the job's own fields, so fetch that job's row too, same one-time
  // catch-up shape subscribeToJobLive already uses elsewhere.
  const applyMyJobTechnician = (row: Record<string, unknown>) => {
    upsertRecord('job_technicians', row as Record<string, string | number | boolean | null>);
    void (async () => {
      const jobId = row.job_id as string;
      const { data } = await supabase.from('jobs').select('*').eq('id', jobId).maybeSingle();
      if (data) applyJob(data as Record<string, unknown>, false);
      else _emitSyncComplete();
    })();
  };

  const applyDefect = (row: Record<string, unknown>) => {
    const rowId = row.id as string;
    const localRow = getRecord<{ updated_at: string | null }>('defects', rowId);
    if (_shouldPreserveLocalRow(row, localRow)) return;
    // Same text[] -> JSON string normalisation subscribeToJobLive's own
    // applyDefect already does.
    const photos: string = Array.isArray(row.photos) ? JSON.stringify(row.photos) : String(row.photos ?? '[]');
    upsertRecord('defects', { ...row, photos } as Record<string, string | number | boolean | null>);
    _emitSyncComplete();
  };

  const applyAsset = (row: Record<string, unknown>) => {
    const rowId = row.id as string;
    const localRow = getRecord<{ updated_at: string | null }>('assets', rowId);
    if (_shouldPreserveLocalRow(row, localRow)) return;
    upsertRecord('assets', row as Record<string, string | number | boolean | null>);
    _emitSyncComplete();
  };

  const applyProperty = (row: Record<string, unknown>) => {
    upsertRecord('properties', row as Record<string, string | number | boolean | null>);
    _emitSyncComplete();
  };

  // FIX: subscribed unfiltered below (RLS-scoped to this technician's own
  // company) rather than filter: user_id=eq.userId — Realtime's filter
  // grammar isn't confirmed to support an IS NULL comparison the way a
  // plain REST query does, so a separate binding for broadcast
  // (user_id IS NULL) notifications risked silently never matching
  // anything. Filtering "mine or a broadcast" here in JS instead is correct
  // either way: if this company's RLS on notifications is itself narrow
  // (user_id = me OR IS NULL), this is a no-op double-check; if RLS is
  // broader (company-wide), this is what stops another technician's
  // personal notifications from polluting this device's own list.
  const applyNotification = (row: Record<string, unknown>) => {
    if (row.user_id !== userId && row.user_id !== null) return;
    upsertRecord('notifications', row as Record<string, string | number | boolean | null>);
    _emitSyncComplete();
  };

  // Catalogue/reference data (defect codes, asset type definitions,
  // pricing, tags) — changes rarely, but the channel already exists and
  // RLS already scopes these to this technician's own company, so there's
  // no real cost to including them too. Plain upsert, matching
  // _pullCatalogueTables's own unconditional treatment — nothing on the
  // mobile side ever edits these.
  const applyCatalogueRow = (table: string, row: Record<string, unknown>) => {
    let payload = row;
    // Same text[] -> JSON string normalisation _pullCatalogueTables already
    // does for this one column.
    if (table === 'asset_type_definitions') {
      const variants = Array.isArray(row.variants) ? JSON.stringify(row.variants) : (row.variants ?? '[]');
      payload = { ...row, variants };
    }
    // FIX: _pullCatalogueTables hardcodes is_active: 1 because its own
    // query already filters WHERE is_active = true — this subscription has
    // no such filter (a row being DEACTIVATED live is exactly the kind of
    // change worth reflecting immediately), so the real current value is
    // converted from Postgres's boolean to SQLite's 1/0 instead of assumed.
    if ('is_active' in payload) {
      payload = { ...payload, is_active: payload.is_active ? 1 : 0 };
    }
    upsertRecord(table, payload as Record<string, string | number | boolean | null>);
    _emitSyncComplete();
  };

  // See supabase/migrations/20260910000000_deletion_log.sql — the missing
  // half of the sync engine until now. Only handles what arrives WHILE this
  // channel is connected; _pullDeletions (called every runSync) is the
  // catch-up for whatever happened while this device was offline or
  // backgrounded, since Realtime never replays missed events.
  const applyDeletion = (row: Record<string, unknown>) => {
    applyRemoteDeletion(row.table_name as string, row.record_id as string);
    _emitSyncComplete();
  };

  // Profile screen reads the technician's own record reactively from
  // authStore (useAuth().user), not local SQLite — patch that store
  // directly so it updates with no reload wiring of its own needed.
  const applyMyUser = (row: Record<string, unknown>) => {
    upsertRecord('users', row as Record<string, string | number | boolean | null>);
    const current = useAuthStore.getState().user;
    if (current && current.id === row.id) {
      useAuthStore.setState({ user: { ...current, ...row } as typeof current });
    }
    _emitSyncComplete();
  };

  _myDataChannel = supabase
    .channel(`my-data-live:${userId}`)
    .on<Record<string, unknown>>('postgres_changes', { event: 'INSERT', schema: 'public', table: 'jobs', filter: `assigned_to=eq.${userId}` }, (p) => applyJob(p.new, false))
    .on<Record<string, unknown>>('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'jobs' }, (p) => applyJob(p.new, true))
    .on<Record<string, unknown>>('postgres_changes', { event: 'INSERT', schema: 'public', table: 'job_technicians', filter: `user_id=eq.${userId}` }, (p) => applyMyJobTechnician(p.new))
    .on<Record<string, unknown>>('postgres_changes', { event: 'INSERT', schema: 'public', table: 'defects' }, (p) => applyDefect(p.new))
    .on<Record<string, unknown>>('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'defects' }, (p) => applyDefect(p.new))
    .on<Record<string, unknown>>('postgres_changes', { event: 'INSERT', schema: 'public', table: 'assets' }, (p) => applyAsset(p.new))
    .on<Record<string, unknown>>('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'assets' }, (p) => applyAsset(p.new))
    .on<Record<string, unknown>>('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'properties' }, (p) => applyProperty(p.new))
    .on<Record<string, unknown>>('postgres_changes', { event: 'INSERT', schema: 'public', table: 'notifications' }, (p) => applyNotification(p.new))
    .on<Record<string, unknown>>('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'notifications' }, (p) => applyNotification(p.new))
    .on<Record<string, unknown>>('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'users', filter: `id=eq.${userId}` }, (p) => applyMyUser(p.new))
    .on<Record<string, unknown>>('postgres_changes', { event: 'INSERT', schema: 'public', table: 'inventory_items' }, (p) => applyCatalogueRow('inventory_items', p.new))
    .on<Record<string, unknown>>('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'inventory_items' }, (p) => applyCatalogueRow('inventory_items', p.new))
    .on<Record<string, unknown>>('postgres_changes', { event: 'INSERT', schema: 'public', table: 'asset_type_definitions' }, (p) => applyCatalogueRow('asset_type_definitions', p.new))
    .on<Record<string, unknown>>('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'asset_type_definitions' }, (p) => applyCatalogueRow('asset_type_definitions', p.new))
    .on<Record<string, unknown>>('postgres_changes', { event: 'INSERT', schema: 'public', table: 'defect_codes' }, (p) => applyCatalogueRow('defect_codes', p.new))
    .on<Record<string, unknown>>('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'defect_codes' }, (p) => applyCatalogueRow('defect_codes', p.new))
    .on<Record<string, unknown>>('postgres_changes', { event: 'INSERT', schema: 'public', table: 'asset_tags' }, (p) => applyCatalogueRow('asset_tags', p.new))
    .on<Record<string, unknown>>('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'asset_tags' }, (p) => applyCatalogueRow('asset_tags', p.new))
    .on<Record<string, unknown>>('postgres_changes', { event: 'INSERT', schema: 'public', table: 'asset_tag_assignments' }, (p) => applyCatalogueRow('asset_tag_assignments', p.new))
    .on<Record<string, unknown>>('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'asset_tag_assignments' }, (p) => applyCatalogueRow('asset_tag_assignments', p.new))
    .on<Record<string, unknown>>('postgres_changes', { event: 'INSERT', schema: 'public', table: 'deletion_log' }, (p) => applyDeletion(p.new))
    .subscribe((status, err) => {
      if (status === 'SUBSCRIBED') {
        if (__DEV__) console.log(`[SiteTrack Sync] my-data-live subscribed for user ${userId}`);
      } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
        if (__DEV__) console.warn(`[SiteTrack Sync] my-data-live ${status} for user ${userId} — auto-retrying:`, err);
      }
    });
}

/** Call on sign-out / app teardown — mirrors unsubscribeFromJobLive's hard reset. */
export function unsubscribeFromMyDataLive(): void {
  _teardownMyDataChannel();
}

function _teardownMyDataChannel(): void {
  if (_myDataChannel) void supabase.removeChannel(_myDataChannel);
  _myDataChannel = null;
  _myDataUserId = null;
}

// Own mutex for syncNow's push-only cycle — separate from _isProcessingPhotos/
// _isProcessingDocuments (which it still shares with runSync, intentionally,
// so the same photo/document is never uploaded twice concurrently).
let _isPushingNow = false;

/**
 * Fire-and-forget immediate PUSH trigger — call right after a local write
 * (e.g. marking an asset) so THIS device's own change reaches the server as
 * fast as possible, without waiting for the next SYNC_INTERVAL_MS tick.
 *
 * Deliberately NOT a full runSync(): this only uploads pending photo/document
 * binaries (both no-op instantly when nothing's queued) and pushes the sync
 * queue — it skips runSync()'s full pull of every job/property/asset, which
 * is the expensive part and isn't needed here (subscribeToJobLive's
 * Realtime channel already covers the one job that's actually on screen).
 * A technician tapping
 * through a 100+ asset checklist calls this on nearly every tap, so keeping
 * it cheap matters — the old version triggered a full runSync() each time.
 *
 * Skips entirely if a full runSync() is already in flight — that pass will
 * push this queue item anyway within its own push phase, so there's nothing
 * useful for a second concurrent push to do.
 */
export function syncNow(userId?: string): void {
  if (_isSyncing || _isPushingNow) return;
  void (async () => {
    _isPushingNow = true;
    try {
      const netState = await NetInfo.fetch();
      const isOnline = netState.isConnected === true && netState.isInternetReachable !== false;
      if (!isOnline) return;

      const resolvedUserId = userId ?? _cachedUserId;
      if (!resolvedUserId) return;

      if (!_isProcessingPhotos) {
        _isProcessingPhotos = true;
        try { await processPhotoQueue(resolvedUserId); } finally { _isProcessingPhotos = false; }
      }
      if (!_isProcessingDocuments) {
        _isProcessingDocuments = true;
        try { await processDocumentQueue(resolvedUserId); } finally { _isProcessingDocuments = false; }
      }
      await _pushQueue(resolvedUserId);
    } catch (err) {
      if (__DEV__) console.warn('[SiteTrack Sync] syncNow error:', err);
    } finally {
      _isPushingNow = false;
    }
  })();
}

// ─────────────────────────────────────────────
// Private helpers
// ─────────────────────────────────────────────

/**
 * Catch-up for deletions made on ANOTHER device while this one was
 * offline/backgrounded — see supabase/migrations/20260910000000_deletion_log.sql
 * for why this exists (Realtime never replays events missed while
 * disconnected, so the my-data-live channel's own deletion_log subscription
 * only ever covers what happens while it's actually connected). Reads
 * "everything since my last checkpoint" ordered by id (an IDENTITY column,
 * so a true insertion-order tiebreaker), applies each one locally, then
 * advances the checkpoint to the highest id actually seen — never skips
 * ahead past a batch it hasn't processed yet.
 */
async function _pullDeletions(): Promise<void> {
  try {
    const lastIdStr = await AsyncStorage.getItem(LAST_DELETION_LOG_ID_KEY);
    const lastId = lastIdStr ? Number(lastIdStr) : 0;
    const { data, error } = await supabase
      .from('deletion_log')
      .select('id, table_name, record_id')
      .gt('id', lastId)
      .order('id', { ascending: true })
      .limit(500);
    if (error) {
      console.error('[SiteTrack Sync] PULL deletion_log error:', error.message);
      return;
    }
    if (!data || data.length === 0) return;
    for (const row of data) {
      applyRemoteDeletion(row.table_name as string, row.record_id as string);
    }
    const highestId = data[data.length - 1].id as number;
    await AsyncStorage.setItem(LAST_DELETION_LOG_ID_KEY, String(highestId));
    if (__DEV__) console.log(`[SiteTrack Sync] Applied ${data.length} remote deletion(s), checkpoint now ${highestId}`);
  } catch (err) {
    console.error('[SiteTrack Sync] _pullDeletions unexpected error:', err);
  }
}

/** Pulls all jobs assigned to the user and the related properties/assets */
async function _pullJobs(userId: string, _lastSynced: string | null): Promise<void> {
  // FIX: this whole pull used to be one long chain of 20+ sequentially
  // awaited network round trips, and nothing in the UI could show any data
  // until the ENTIRE chain finished (onSyncComplete only fires once, at the
  // very end of runSync). On a real mobile connection that's what made a
  // first-ever sync (new install, or a fresh login with a real workload)
  // feel like it hung before any job appeared. Restructured to run every
  // genuinely-independent fetch concurrently — the local WRITE order that
  // actually matters for foreign-key safety (jobs before job_assets/defects,
  // properties before assets) is unchanged; only fetches with no real
  // dependency on each other now overlap. _pullRelated's bulk upserts are
  // safe to run concurrently with each other: each one disables/re-enables
  // FK checks in a single synchronous block with no `await` inside it, so
  // JS's single-threaded execution can never interleave two of them
  // mid-write — only their network fetches actually overlap.

  // Catalogue/reference tables (inventory, asset types, defect codes, tags)
  // have zero dependency on this user's own jobs — start them now and let
  // them run for this whole function's duration, only awaited at the end.
  const cataloguePromise = _pullCatalogueTables();

  // "Assigned to this technician" now means job_technicians membership (a
  // flat crew list, no primary) OR the legacy assigned_to column — the
  // latter kept as a fallback for any job whose job_technicians rows
  // haven't been created yet. See supabase/migrations/20260824020000_job_technicians.sql.
  const { data: assignedRows, error: assignedError } = await supabase
    .from('job_technicians')
    .select('job_id')
    .eq('user_id', userId);
  if (assignedError) {
    console.error('[UMA BUILDING SERVICES Sync] PULL job_technicians (own) error:', assignedError.message);
  }
  const assignedJobIds = (assignedRows ?? []).map((r) => r.job_id as string);

  // Always pull all of this technician's jobs, cancelled included.
  // Using a simple filter (no lastSynced delta) guarantees we never silently
  // drop jobs due to clock skew, timezone edge-cases, or status transitions.
  // The result set is small (one technician's workload) so this is fine.
  // FIX: this used to exclude cancelled jobs entirely — meant as "don't
  // bother pulling jobs there's no more work on," but it meant a job
  // cancelled by the office AFTER already being synced locally simply
  // vanished from every future pull's result set, so its cancellation never
  // reached this device — the job stayed at whatever status it last had
  // (scheduled/in_progress), fully visible and actionable, indefinitely.
  // getJobsForTechnician's own WHERE status != 'cancelled' (lib/database.ts)
  // still keeps a correctly-synced cancelled job out of every list — this
  // only changes whether the cancellation itself ever arrives.
  const orFilter = assignedJobIds.length > 0
    ? `assigned_to.eq.${userId},id.in.(${assignedJobIds.join(',')})`
    : `assigned_to.eq.${userId}`;

  // jobs and techUser both depend only on userId, not on each other — fetch
  // concurrently instead of sequentially.
  const [jobsResult, techUserResult] = await Promise.all([
    supabase.from('jobs').select('*').or(orFilter),
    supabase.from('users').select('*').eq('id', userId).maybeSingle(),
  ]);
  const { data: jobs, error: jobsError } = jobsResult;

  if (jobsError) {
    console.error('[UMA BUILDING SERVICES Sync] PULL jobs error:', jobsError.message);
    await cataloguePromise;
    return;
  }

  if (!jobs || jobs.length === 0) {
    if (__DEV__) console.log('[UMA BUILDING SERVICES Sync] No jobs to pull');
    await cataloguePromise;
    return;
  }

  // Preemptively upsert the current user to satisfy job's assigned_to FK
  const techUser = techUserResult.data;
  if (techUser) {
    if (techUser.is_active === false) {
      console.warn('[UMA BUILDING SERVICES Sync] User deactivated. Forcing logout.');
      // Use forceFinalSyncAndSignOut, not signOut directly — this flushes any
      // offline work first (and aborts the logout with a warning if it can't),
      // rather than risking a deactivated tech's queued inspection data.
      import('@/store/authStore').then((m) => m.useAuthStore.getState().forceFinalSyncAndSignOut());
      await cataloguePromise;
      return;
    }
    if (techUser.company_id) {
      const { data: company } = await supabase.from('companies').select('*').eq('id', techUser.company_id).maybeSingle();
      if (company) {
        if (company.subscription_status !== 'active') {
          console.warn('[UMA BUILDING SERVICES Sync] Company suspended. Forcing logout.');
          import('@/store/authStore').then((m) => m.useAuthStore.getState().forceFinalSyncAndSignOut());
          await cataloguePromise;
          return;
        }
        // Save company locally so PDFs have proper headers (name, ABN, etc.)
        upsertRecord('companies', company as Record<string, string | number | boolean | null>);
      }
    }
    upsertRecord('users', techUser as Record<string, string | number | boolean | null>);
  }

  // Collect unique property ids from jobs
  const propertyIds = [...new Set(jobs.map((j) => j.property_id as string))];
  const jobIds = jobs.map((j) => j.id as string);

  // Pull properties for these jobs
  if (propertyIds.length > 0) {
    // properties and assets both depend only on propertyIds, not on each
    // other's data — fetch concurrently, but still WRITE in the same
    // dependency-safe order the old sequential code used (assets.property_id
    // references properties.id via plain upsertRecord, which isn't
    // FK-disabled the way _pullRelated's bulk upsert is).
    const [propsResult, assetsResult] = await Promise.all([
      supabase.from('properties').select('*').in('id', propertyIds),
      supabase.from('assets').select('*').in('property_id', propertyIds).eq('status', 'active'),
    ]);

    const { data: properties, error: propError } = propsResult;
    if (propError) {
      console.error('[UMA BUILDING SERVICES Sync] PULL properties error:', propError.message);
    } else if (properties) {
      for (const prop of properties) {
        upsertRecord('properties', prop as Record<string, string | number | boolean | null>);
      }
      if (__DEV__) console.log(`[UMA BUILDING SERVICES Sync] PULL: upserted ${properties.length} property/ies`);

      const { data: assets, error: assetError } = assetsResult;
      if (assetError) {
        console.error('[UMA BUILDING SERVICES Sync] PULL assets error:', assetError.message);
      } else if (assets) {
        for (const asset of assets) {
          upsertRecord('assets', asset as Record<string, string | number | boolean | null>);
        }
        if (__DEV__) console.log(`[UMA BUILDING SERVICES Sync] PULL: upserted ${assets.length} asset(s)`);
      }

      // Pull scanned documents for these properties — property-scoped like
      // assets above (not job-scoped like inspection_photos), so a document
      // captured during one job still shows up from every other job at the
      // same site. Safe to run without awaiting here (FK-disabled bulk
      // upsert) — collected below alongside the other independent pulls.
    }
  }

  // Now safe to upsert jobs since properties and user exist locally.
  // Use conflict-aware upsert: never let the server overwrite a locally-advanced
  // status (in_progress or completed) with a less-advanced one (scheduled)
  // unless the local change is older than STALE_THRESHOLD_MS.
  let upsertedCount = 0;
  let preservedCount = 0;
  for (const job of jobs) {
    const localStatus = getJobStatus(job.id as string);
    // FIX: 'cancelled' used to be ranked lowest on STATUS_PRIORITY (a ladder
    // meant for "how far along" — scheduled < in_progress < completed), so
    // an office cancellation of an already in_progress/completed job looked
    // like "the server regressed this job" and was discarded as stale for up
    // to 6 hours below. Cancellation isn't part of that progression at all —
    // it's an administrative override that should always win immediately,
    // regardless of how far the technician had gotten locally.
    if (localStatus && job.status !== 'cancelled') {
      const serverPriority = STATUS_PRIORITY[job.status as string] ?? 1;
      const localPriority  = STATUS_PRIORITY[localStatus.status]  ?? 1;
      if (localPriority > serverPriority) {
        // Local is ahead — only allow override if the local change is stale
        const localUpdateMs = new Date(localStatus.updated_at).getTime();
        const isStale = Date.now() - localUpdateMs > STALE_THRESHOLD_MS;
        if (!isStale) {
          // FIX: Also strip updated_at from the server payload.
          // Previously we only stripped 'status' but wrote the server's updated_at.
          // On the next pull, the staleness check (Date.now() - updated_at > 6h)
          // treated the row as freshly-updated by the server and overwrote the
          // tech's in_progress/completed status. Stripping both columns ensures
          // the local updated_at (set when the tech changed status) is preserved.
          const { status: _ignored, updated_at: _updIgnored, ...rest } = job as Record<string, unknown>;
          upsertRecord('jobs', { ...rest, status: localStatus.status } as Record<string, string | number | boolean | null>);
          preservedCount++;
          continue;
        }
      }
    }
    upsertRecord('jobs', job as Record<string, string | number | boolean | null>);
    upsertedCount++;
  }
  if (__DEV__) {
    console.log(`[UMA BUILDING SERVICES Sync] PULL: upserted ${upsertedCount} job(s), preserved local status on ${preservedCount}`);
  }

  // Pull job_assets, defects, inspection_photos, and everything else these
  // jobs need. FIX: all of these are siblings — none of them reference each
  // other, only the already-upserted jobs/assets above — so they run
  // concurrently now instead of as 7+ sequential round trips. The two multi-
  // step chains (crew user_ids -> crew users, and quotes -> quote_items) each
  // stay internally sequential (real data dependency) but run as their own
  // branch alongside the independent ones.
  const relatedPulls: Promise<unknown>[] = [];
  if (jobIds.length > 0) {
    // Full crew list per job (everyone assigned, not just this user's own
    // membership) — needed locally so screens can show/name the whole crew.
    relatedPulls.push(_pullRelated('job_technicians', 'job_id', jobIds));

    // The crew may include technicians other than this device's own user —
    // fetch+upsert their user rows too so names resolve locally instead of
    // showing blank. (This device's own user row is already upserted above.)
    relatedPulls.push((async () => {
      const { data: crewRows, error: crewError } = await supabase
        .from('job_technicians')
        .select('user_id')
        .in('job_id', jobIds);
      if (crewError) {
        console.error('[UMA BUILDING SERVICES Sync] PULL crew user_ids error:', crewError.message);
        return;
      }
      if (!crewRows || crewRows.length === 0) return;
      const crewUserIds = [...new Set(crewRows.map((r) => r.user_id as string))].filter((id) => id !== userId);
      if (crewUserIds.length === 0) return;
      const { data: crewUsers, error: crewUsersError } = await supabase
        .from('users')
        .select('*')
        .in('id', crewUserIds);
      if (crewUsersError) {
        console.error('[UMA BUILDING SERVICES Sync] PULL crew users error:', crewUsersError.message);
      } else if (crewUsers) {
        for (const u of crewUsers) {
          upsertRecord('users', u as Record<string, string | number | boolean | null>);
        }
      }
    })());

    relatedPulls.push(_pullRelated('job_assets', 'job_id', jobIds));
    relatedPulls.push(_pullRelated('defects', 'job_id', jobIds));
    relatedPulls.push(_pullRelated('field_audit_log', 'job_id', jobIds));
    // H6: _pullRelated already handles the deleted-photo tombstone internally
    // (it calls getDeletedPhotoIds() itself when table === 'inspection_photos')
    relatedPulls.push(_pullRelated('inspection_photos', 'job_id', jobIds));
    relatedPulls.push(_pullRelated('signatures', 'job_id', jobIds));
    relatedPulls.push(_pullRelated('time_logs', 'job_id', jobIds));

    // quote_items needs quote IDs for this job batch first — stays its own
    // sequential chain, run alongside everything else in this group.
    relatedPulls.push((async () => {
      await _pullRelated('quotes', 'job_id', jobIds);
      const { data: quoteRows } = await supabase.from('quotes').select('id').in('job_id', jobIds);
      if (quoteRows && quoteRows.length > 0) {
        const parentQuoteIds = quoteRows.map((q) => q.id as string);
        await _pullRelated('quote_items', 'quote_id', parentQuoteIds);
      }
    })());
  }
  if (propertyIds.length > 0) {
    relatedPulls.push(_pullRelated('site_documents', 'property_id', propertyIds));
  }
  await Promise.all(relatedPulls);

  await cataloguePromise;
}

/**
 * Pulls the small, company-wide catalogue/reference tables that have no
 * dependency on this user's own jobs at all — split out so _pullJobs can
 * kick this off at the very start and run it concurrently with everything
 * else instead of tacking 5 more sequential round trips onto the end.
 */
async function _pullCatalogueTables(): Promise<void> {
  // None of these five depend on each other — fetch all concurrently.
  const [
    { data: inventoryItems, error: invError },
    { data: assetTypeDefs },
    { data: defectCodes },
    { data: assetTags },
    { data: assetTagAssignments },
  ] = await Promise.all([
    supabase.from('inventory_items').select('*'),
    supabase
      .from('asset_type_definitions')
      .select('id,company_id,value,label,full_label,icon,color,inspection_routine,variants,is_active,sort_order,created_at,updated_at')
      .eq('is_active', true),
    supabase
      .from('defect_codes')
      .select('id,company_id,code,description,quote_price,category,is_active,sort_order,created_at')
      .eq('is_active', true),
    // Asset tag vocabulary + assignments — small/company-wide like the
    // catalogue tables above, so pulled unconditionally rather than scoped
    // to this batch's asset ids (keeps this consistent/simple; a company's
    // total tag assignment count is not expected to be large).
    supabase.from('asset_tags').select('*'),
    supabase.from('asset_tag_assignments').select('*'),
  ]);

  if (invError) {
    console.error('[UMA BUILDING SERVICES Sync] PULL inventory_items error:', invError.message);
  } else if (inventoryItems) {
    for (const item of inventoryItems) {
      upsertRecord('inventory_items', item as Record<string, string | number | boolean | null>);
    }
  }

  if (assetTypeDefs) {
    for (const row of assetTypeDefs) {
      // PostgreSQL TEXT[] arrives as JS array; SQLite needs a JSON string
      const variants = Array.isArray(row.variants) ? JSON.stringify(row.variants) : (row.variants ?? '[]');
      upsertRecord('asset_type_definitions', {
        ...row, variants, is_active: 1,
      } as Record<string, string | number | boolean | null>);
    }
    if (__DEV__ && assetTypeDefs.length > 0)
      console.log(`[UMA BUILDING SERVICES Sync] PULL: upserted ${assetTypeDefs.length} asset_type_definitions`);
  }

  if (defectCodes) {
    for (const row of defectCodes) {
      upsertRecord('defect_codes', {
        ...row, is_active: 1,
      } as Record<string, string | number | boolean | null>);
    }
    if (__DEV__ && defectCodes.length > 0)
      console.log(`[UMA BUILDING SERVICES Sync] PULL: upserted ${defectCodes.length} defect_codes`);
  }

  if (assetTags) {
    for (const row of assetTags) {
      upsertRecord('asset_tags', row as Record<string, string | number | boolean | null>);
    }
    if (__DEV__ && assetTags.length > 0)
      console.log(`[UMA BUILDING SERVICES Sync] PULL: upserted ${assetTags.length} asset_tags`);
  }

  if (assetTagAssignments) {
    for (const row of assetTagAssignments) {
      upsertRecord('asset_tag_assignments', row as Record<string, string | number | boolean | null>);
    }
    if (__DEV__ && assetTagAssignments.length > 0)
      console.log(`[UMA BUILDING SERVICES Sync] PULL: upserted ${assetTagAssignments.length} asset_tag_assignments`);
  }
}

/**
 * BUG-N4 guard, extracted so the bulk REST pull (_pullRelated) and the
 * Realtime postgres_changes handler (subscribeToJobLive) apply the exact
 * same "don't let the server overwrite a locally-actioned-but-not-yet-
 * pushed result with a stale/null echo" rule, regardless of which path the
 * server data arrived through.
 *
 * @returns true if serverRow should be DISCARDED (local wins).
 */
function _shouldPreserveLocalJobAsset(
  serverRow: Record<string, unknown>,
  localRow: { result: string | null; actioned_at: string | null } | null,
): boolean {
  if (!localRow?.result) return false; // nothing local to protect
  if (!serverRow.result) return true;  // local has a result, server doesn't
  if (localRow.actioned_at && serverRow.actioned_at) {
    const localMs  = new Date(localRow.actioned_at as string).getTime();
    const serverMs = new Date(serverRow.actioned_at as string).getTime();
    if (localMs > serverMs) return true; // local is newer
  }
  return false;
}

/**
 * Generalized version of _shouldPreserveLocalJobAsset for tables keyed by a
 * plain `updated_at` column (defects, assets) rather than job_assets' own
 * actioned_at. FIX: previously only job_assets (via the function above) and
 * jobs.status (via STATUS_PRIORITY below) had any protection against a pull
 * overwriting a fresher local edit with a stale server copy — defects and
 * assets had none at all, so an edit made offline (or one whose push
 * attempt raced behind a pull in the same sync cycle) could be silently
 * reverted in the UI until the queued push eventually landed.
 *
 * @returns true if serverRow should be DISCARDED (local wins).
 */
function _shouldPreserveLocalRow(
  serverRow: Record<string, unknown>,
  localRow: { updated_at: string | null } | null,
): boolean {
  if (!localRow?.updated_at || !serverRow.updated_at) return false;
  const localMs  = new Date(localRow.updated_at as string).getTime();
  const serverMs = new Date(serverRow.updated_at as string).getTime();
  return localMs > serverMs;
}

/** Generic helper to pull a related table for a set of parent ids */
async function _pullRelated(
  table: string,
  column: string,
  ids: string[]
): Promise<void> {
  const { data, error } = await supabase
    .from(table)
    .select('*')
    .in(column, ids);

  if (error) {
    console.error(`[UMA BUILDING SERVICES Sync] PULL ${table} error:`, error.message);
    return;
  }
  if (data) {
    // For inspection_photos / site_documents: skip any row whose ID is in the
    // permanent tombstone.
    let tombstoneIds = new Set<string>();
    if (table === 'inspection_photos') {
      tombstoneIds = getDeletedPhotoIds();
    } else if (table === 'site_documents') {
      tombstoneIds = getDeletedDocumentIds();
    }

    // Collect rows to upsert after applying all local-override logic.
    // We build the list first, then call upsertRecordBulk() which wraps the
    // entire batch in PRAGMA foreign_keys=OFF.
    //
    // WHY: expo-sqlite enables FK enforcement by default on Android. When the
    // sync pulls job_assets before all their referenced asset rows exist locally
    // (e.g. first install, or after a cache wipe), the FK check fires and crashes
    // with "FOREIGN KEY constraint failed". The server is already the source of
    // referential truth, so we disable FK checks only for this server-pull batch.
    const rowsToUpsert: Record<string, string | number | boolean | null>[] = [];

    let skipped = 0;
    for (const row of data) {
      const rowId = (row as Record<string, unknown>).id as string;
      if (tombstoneIds.has(rowId)) {
        skipped++;
        continue; // permanently deleted — never re-insert
      }

      // BUG-N4 FIX: For job_assets, never let the server overwrite a locally-actioned
      // result (pass/fail/not-tested) with a stale null from the server.
      // This can happen when the tech saves an inspection result offline — the local
      // SQLite row has result='pass' but the server row still has result=null because
      // the push hasn't completed yet. A naive upsert would reset it to null.
      if (table === 'job_assets') {
        const serverRow = row as Record<string, unknown>;
        const localRow  = getRecord<{ result: string | null; actioned_at: string | null }>(
          'job_assets', rowId
        );
        if (_shouldPreserveLocalJobAsset(serverRow, localRow)) {
          if (__DEV__)
            console.log(`[UMA BUILDING SERVICES Sync] PULL: preserving local job_asset result over server for ${rowId}`);
          skipped++;
          continue;
        }
      }

      // FIX: same anti-clobber protection job_assets already had, applied
      // to defects/assets/site_documents — never let a pull overwrite a
      // locally-edited row with an older server copy. site_documents added
      // after a real gap: it was added to this table's own tombstone check
      // above, but a rename (documentsStore.renameDocument) had nothing
      // protecting it from being reverted by a stale pull of the
      // pre-rename row — see this table's migration 42 (lib/database.ts)
      // for the updated_at column that makes this comparison possible.
      if (table === 'defects' || table === 'assets' || table === 'site_documents') {
        const serverRow = row as Record<string, unknown>;
        const localRow = getRecord<{ updated_at: string | null }>(table, rowId);
        if (_shouldPreserveLocalRow(serverRow, localRow)) {
          if (__DEV__)
            console.log(`[UMA BUILDING SERVICES Sync] PULL: preserving local ${table} row over server for ${rowId}`);
          skipped++;
          continue;
        }
      }

      // defects.photos is a Postgres text[] — PostgREST hands it back as a
      // real JS array, but SQLite needs the JSON string every other write
      // path into this column already uses (see defectsStore.ts). Without
      // this, db.runSync's bind values include a raw array, which isn't a
      // valid SQLite bind type and silently fails the whole row's upsert.
      if (table === 'defects') {
        const defectRow = row as Record<string, unknown>;
        if (Array.isArray(defectRow.photos)) {
          defectRow.photos = JSON.stringify(defectRow.photos);
        }
      }

      rowsToUpsert.push(row as Record<string, string | number | boolean | null>);
    }

    // Bulk upsert with FK enforcement temporarily disabled
    upsertRecordBulk(table, rowsToUpsert);

    if (__DEV__) {
      if (rowsToUpsert.length > 0) console.log(`[UMA BUILDING SERVICES Sync] PULL: upserted ${rowsToUpsert.length} ${table} row(s)`);
      if (skipped > 0)  console.log(`[UMA BUILDING SERVICES Sync] PULL: skipped ${skipped} tombstoned/preserved ${table} row(s)`);
    }
  }
}

/**
 * Pushes all pending sync_queue items to Supabase, marking each complete on success.
 * Items that fail MAX_SYNC_RETRIES times are permanently abandoned to prevent infinite loops.
 */
// Exported for emergency use by authStore.forceFinalSyncAndSignOut only.
// The leading underscore signals this is an internal function — do not call
// it from screens or other stores. Use runSync() for normal sync triggering.
//
// FIX: the company_id-injection fallback below used to read only the
// module-level _cachedUserId — which stopSync() nulls out immediately, as
// part of sign-out, BEFORE authStore's own final flush (pushPendingWork ->
// this function) ever runs. A queued Insert/Update whose payload never
// carried its own company_id (e.g. documentsStore.renameDocument's {title}-
// only Update) then pushed with none at all, and got rejected by any RLS
// policy that checks the payload's company_id on write — leaving that item
// permanently stuck pending, which in turn made signOut() think there was
// still unsynced work and refuse to sign out at all. Callers that already
// know their own userId (every current caller does) now pass it explicitly
// so this doesn't depend on _cachedUserId still being set.
export async function _pushQueue(fallbackUserId?: string): Promise<void> {
  const uid = fallbackUserId ?? _cachedUserId;
  const pending = getPendingSyncItems();

  if (pending.length === 0) {
    if (__DEV__) console.log('[UMA BUILDING SERVICES Sync] PUSH: no pending items');
    return;
  }

  // Items returned by getPendingSyncItems already exclude those at/above MAX_SYNC_RETRIES.
  // We process all returned items — no secondary filter needed.
  if (__DEV__) console.log(`[UMA BUILDING SERVICES Sync] PUSH: processing ${pending.length} queue item(s)`);

  // Records whose own Insert is still outstanding at the start of this pass
  // (not yet confirmed to exist server-side). An Update for one of these
  // records is unsafe to run: `.eq('id', ...)` (or the conflict-guarded
  // `.lt(...)`) matches zero rows exactly the same way it would if a newer
  // server edit had legitimately already won — but here the row simply
  // isn't there yet, so the update has nowhere to land and would otherwise
  // be marked complete below having silently done nothing. Entries are
  // removed as their Insert is confirmed to have succeeded further down in
  // this same loop, so an Insert-then-Update pair queued together in the
  // normal case still runs in one pass without waiting an extra cycle.
  const openInsertKeys = new Set<string>(
    pending.filter(p => p.operation === SyncOperation.Insert).map(p => `${p.table_name}:${p.record_id}`),
  );

  for (const item of pending) {
    try {
      const payload = JSON.parse(item.payload) as Record<string, unknown>;
      let error: { message: string; code?: string } | null = null;

      // Ensure defects photos is an array, not a stringified array
      if (item.table_name === 'defects' && typeof payload.photos === 'string') {
        try {
          payload.photos = JSON.parse(payload.photos);
        } catch {
          payload.photos = [];
        }
      }

      if (item.operation === SyncOperation.Insert) {
        // Inject company_id from the active user profile so SaaS RLS doesn't reject it
        if (uid && !payload.company_id) {
          const u = getRecord<{ company_id: string }>('users', uid);
          if (u?.company_id) {
            payload.company_id = u.company_id;
          }
        }
        const result = await supabase.from(item.table_name).insert(payload);
        error = result.error;

        // ── job_assets conflict: two technicians both actioned the same
        // never-before-touched asset while offline, so two devices each
        // minted their own row for the same (job_id, asset_id). The
        // job_assets_job_asset_unique constraint rejects the second INSERT
        // with 23505 — resolve it here by policy ("whoever actually
        // submitted later wins") instead of falling into the generic
        // isDuplicate fast-path below, which would silently drop this
        // device's result without ever applying it.
        if (error?.code === '23505' && item.table_name === 'job_assets') {
          const { data: existing } = await supabase
            .from('job_assets')
            .select('id, actioned_at')
            .eq('job_id', payload.job_id as string)
            .eq('asset_id', payload.asset_id as string)
            .maybeSingle();

          if (existing) {
            const localTime = payload.actioned_at ? new Date(payload.actioned_at as string).getTime() : 0;
            const serverTime = existing.actioned_at ? new Date(existing.actioned_at).getTime() : 0;
            if (localTime > serverTime) {
              const { id: _localId, ...updatePayload } = payload;
              const updateResult = await supabase.from('job_assets').update(updatePayload).eq('id', existing.id);
              if (updateResult.error) {
                console.warn('[SiteTrack Sync] job_assets conflict resolution UPDATE failed:', updateResult.error.message);
              } else if (__DEV__) {
                console.log(`[SiteTrack Sync] job_assets conflict for ${payload.asset_id}: this device's later result applied to row ${existing.id}`);
              }
            } else if (__DEV__) {
              console.log(`[SiteTrack Sync] job_assets conflict for ${payload.asset_id}: server row ${existing.id} is already the more recent result, discarding this device's older one`);
            }
            // FIX: repoint any OTHER still-pending queue item for this local
            // row (e.g. a follow-up Update queued after this Insert, made
            // before the conflict was known) at the canonical existing.id —
            // otherwise it would silently target a local id that no longer
            // exists anywhere once deleted below, and be marked synced
            // without ever actually being applied.
            remapSyncQueueRecordId('job_assets', item.record_id, existing.id);
            // FIX: remapSyncQueueRecordId only persists the correction to
            // SQLite — `pending`, the in-memory array this whole _pushQueue
            // pass is still iterating over, is now stale for that same
            // follow-up item. Left unpatched, its own turn later in THIS
            // pass still carries the old record_id/payload.id, matches zero
            // rows server-side (a no-op success from Supabase's point of
            // view), and gets marked synced anyway — silently discarding
            // the technician's follow-up edit with no retry and no alert.
            for (const p of pending) {
              if (p.id === item.id || p.table_name !== 'job_assets' || p.record_id !== item.record_id) continue;
              p.record_id = existing.id;
              try {
                const pPayload = JSON.parse(p.payload) as Record<string, unknown>;
                if (pPayload.id === item.record_id) {
                  pPayload.id = existing.id;
                  p.payload = JSON.stringify(pPayload);
                }
              } catch { /* leave payload untouched if unparsable */ }
            }
            // This device's own locally-generated row is now an orphan either
            // way — the canonical row lives at `existing.id`. Drop it locally;
            // the next pull brings the canonical (winning) row down normally.
            deleteRecord('job_assets', item.record_id);
          }
          error = null; // handled — don't fall through to the generic error path
        }
      } else if (item.operation === SyncOperation.Update) {
        // Defer if this record's own Insert hasn't been confirmed yet this
        // pass — see openInsertKeys above. Soft retry, same idiom as the
        // report_generate dependency-blocker below: don't burn a real
        // attempt, just come back once the Insert has had its turn.
        if (openInsertKeys.has(`${item.table_name}:${item.record_id}`)) {
          if (__DEV__) console.warn(
            `[SiteTrack Sync] Update for ${item.table_name}/${item.record_id} deferred — its own Insert hasn't synced yet`
          );
          if ((item.retry_count ?? 0) < MAX_SYNC_RETRIES - 1) {
            incrementSyncRetry(item.id, `Deferred: waiting on this record's own Insert to sync first`, MAX_SYNC_RETRIES);
          }
          continue;
        }

        // FIX: Inject company_id for UPDATE operations too.
        // Although RLS on UPDATE typically filters on existing column values (not
        // the payload), some Supabase policies check the payload's company_id to
        // prevent cross-tenant writes. Injecting it here is safe and idempotent.
        if (uid && !payload.company_id) {
          const u = getRecord<{ company_id: string }>('users', uid);
          if (u?.company_id) payload.company_id = u.company_id;
        }

        // ── job_assets: guard the update so a stale, later-syncing result can
        // never overwrite a genuinely more recent one server-side ("whoever
        // actually submitted later wins", not "whoever's device synced
        // last"). Every job_assets write sets actioned_at, so this only
        // falls back to a plain update in the unexpected case it's missing.
        if (item.table_name === 'job_assets' && payload.actioned_at) {
          const result = await supabase
            .from('job_assets')
            .update(payload)
            .eq('id', item.record_id)
            .lt('actioned_at', payload.actioned_at as string)
            .select('id');
          error = result.error;
          if (!error && (result.data?.length ?? 0) === 0 && __DEV__) {
            console.log(`[SiteTrack Sync] job_assets update for ${item.record_id} skipped — server already has an equal-or-later result`);
          }
        } else if (
          (item.table_name === 'defects' || item.table_name === 'assets' || item.table_name === 'jobs') &&
          payload.updated_at
        ) {
          // Same policy as job_assets, generalised: a stale, later-syncing edit
          // must never overwrite a genuinely more recent one already on the
          // server — "whoever actually edited later wins," not "whoever's
          // device happened to sync last." Matters most for jobs/defects since
          // multiple crew members (job_technicians) can share one job offline.
          const result = await supabase
            .from(item.table_name)
            .update(payload)
            .eq('id', item.record_id)
            .lt('updated_at', payload.updated_at as string)
            .select('id');
          error = result.error;
          if (!error && (result.data?.length ?? 0) === 0 && __DEV__) {
            console.log(`[SiteTrack Sync] ${item.table_name} update for ${item.record_id} skipped — server already has an equal-or-later edit`);
          }
        } else {
          const result = await supabase
            .from(item.table_name)
            .update(payload)
            .eq('id', item.record_id);
          error = result.error;
        }
      } else if (item.operation === SyncOperation.Delete) {
        // FIX: same deferral idiom as Update above, applied to Delete too.
        // The id-tiebreaker in getPendingSyncItems now guarantees this
        // record's own Insert sorts earlier in `pending`, but if that
        // Insert attempt fails for a transient reason (network blip) right
        // before this Delete runs in the same pass, the Delete would just
        // no-op (0 rows match server-side) and mark itself complete — then
        // the Insert's own retry on a LATER pass would actually create the
        // row, resurrecting something the technician explicitly deleted.
        // Deferring instead means this always re-checks against
        // up-to-date state next pass.
        if (openInsertKeys.has(`${item.table_name}:${item.record_id}`)) {
          if (__DEV__) console.warn(
            `[SiteTrack Sync] Delete for ${item.table_name}/${item.record_id} deferred — its own Insert hasn't been confirmed yet`
          );
          if ((item.retry_count ?? 0) < MAX_SYNC_RETRIES - 1) {
            incrementSyncRetry(item.id, `Deferred: waiting on this record's own Insert to resolve first`, MAX_SYNC_RETRIES);
          }
          continue;
        }
        // If it's an inspection photo deletion, also attempt to delete the physical file from the storage bucket
        if (item.table_name === 'inspection_photos' && typeof payload.photo_url === 'string') {
          const url = payload.photo_url;
          if (url.includes(`/object/public/${PHOTO_BUCKET}/`)) {
            const filePath = url.split(`/object/public/${PHOTO_BUCKET}/`)[1];
            if (filePath) {
              const { error: storageErr } = await supabase.storage.from(PHOTO_BUCKET).remove([filePath]);
              if (storageErr && __DEV__) {
                console.warn(`[UMA BUILDING SERVICES Sync] Failed to delete photo binary from storage:`, storageErr.message);
              }
            }
          }
        }
        // Same cleanup for a deleted scanned document's PDF binary — without
        // this, deleting a site_documents row leaves its PDF orphaned in the
        // site-documents bucket forever (this table didn't exist when the
        // inspection_photos case above was written, so it was never added).
        if (item.table_name === 'site_documents' && typeof payload.document_url === 'string') {
          const url = payload.document_url;
          if (url.includes(`/object/public/${DOCUMENT_BUCKET}/`)) {
            const filePath = url.split(`/object/public/${DOCUMENT_BUCKET}/`)[1];
            if (filePath) {
              const { error: storageErr } = await supabase.storage.from(DOCUMENT_BUCKET).remove([filePath]);
              if (storageErr && __DEV__) {
                console.warn(`[SiteTrack Sync] Failed to delete document binary from storage:`, storageErr.message);
              }
            }
          }
        }

        const result = await supabase
          .from(item.table_name)
          .delete()
          .eq('id', item.record_id);
        error = result.error;

      } else if (item.operation === SyncOperation.ReportGenerate) {
        // ── Server-side PDF generation via the report-generator service ──────
        // The payload contains { jobId }. We call the standalone report-generator
        // service (Node + self-hosted Gotenberg — see services/report-generator/)
        // with the user's session token. It replaced the old Supabase Edge
        // Function, which used pdfmake and hit a hard ~150MB memory ceiling that
        // made it unreliable at real-world scale (500-unit / 1000-asset sites).
        // On success it uploads the PDF to Storage and updates jobs.report_url
        // server-side; we mirror that URL into local SQLite so the UI updates
        // immediately after sync.
        const { jobId: reportJobId } = payload as { jobId: string };

        // FIX (missing assets in PDF): Before calling the Edge Function, verify
        // all data-bearing sync items for THIS JOB have already been processed.
        // The queue is FIFO by created_at, so assets/job_assets added BEFORE
        // queueReportGeneration should flush first. However, if those items had
        // retries or the sync cycle started mid-queue, the Edge Function can run
        // with stale Supabase data and produce a PDF that is missing new assets.
        // Guard: if any pending items exist for this job, defer this cycle.
        const PDF_CRITICAL_TABLES = ['assets', 'job_assets', 'defects', 'signatures', 'inspection_photos'];
        // Tables whose local row carries its own job_id column — look this up
        // fresh from SQLite rather than trusting the queued payload to contain
        // it. Several call sites (e.g. editing an existing defect's
        // description/severity in inspectionStore.ts, or appending a photo to
        // defects.photos) queue partial UPDATE payloads carrying only the
        // changed fields, which never re-includes job_id. That silently
        // defeated the plain substring search below for exactly those edits —
        // report generation would run before they'd actually synced, producing
        // a PDF that looked unchanged even though the technician had just made
        // a change. The local row's job_id is always current and authoritative
        // regardless of what happens to be in any one queued payload.
        const TABLES_WITH_JOB_ID = ['job_assets', 'defects', 'signatures', 'inspection_photos'];
        const allPendingNow = getPendingSyncItems();
        const blockers = allPendingNow.filter(p => {
          if (p.id === item.id || !PDF_CRITICAL_TABLES.includes(p.table_name)) return false;
          if (TABLES_WITH_JOB_ID.includes(p.table_name)) {
            const row = getRecord<{ job_id?: string }>(p.table_name, p.record_id);
            if (row?.job_id) return row.job_id === reportJobId;
          }
          // 'assets' has no job_id of its own (it belongs to a property, not a
          // job) — a pending asset insert only matters for this report once
          // it's linked via job_assets, which the branch above already catches.
          // Also the fallback for any row the local lookup couldn't resolve.
          return (p.payload ?? '').includes(`"${reportJobId}"`);
        });
        if (blockers.length > 0) {
          if (__DEV__) console.warn(
            `[Sync] report_generate for ${reportJobId} deferred — ${blockers.length} item(s) still pending:`,
            blockers.map(b => `${b.table_name}/${b.operation}`).join(', ')
          );
          // Soft retry: increment counter so it runs next cycle AFTER blockers complete.
          // The retry limit is MAX_SYNC_RETRIES; a deferral should not permanently fail
          // this item, so we cap the synthetic error at limit-1.
          if ((item.retry_count ?? 0) < MAX_SYNC_RETRIES - 1) {
            incrementSyncRetry(item.id, `Deferred: ${blockers.length} data item(s) pending`, MAX_SYNC_RETRIES);
          }
          continue; // skip to next queue item — come back next cycle
        }

        const session = useAuthStore.getState().session;
        if (!session?.access_token) {
          // No session — can't call the Edge Function. Will retry next cycle.

          throw new Error('No auth session — report generation deferred');
        }

        const reportServiceUrl = process.env.EXPO_PUBLIC_REPORT_SERVICE_URL;
        if (!reportServiceUrl) {
          throw new Error('EXPO_PUBLIC_REPORT_SERVICE_URL is not configured — report generation deferred');
        }

        if (__DEV__) console.log(`[UMA BUILDING SERVICES Sync] PUSH: calling report-generator service for job ${reportJobId}`);

        // Render's free tier (see render.yaml) spins sitetrack-report-generator
        // down after ~15 min with no inbound traffic. This POST is the very
        // first thing to touch it, before generateReport() even gets a chance
        // to run its own internal Gotenberg warm-up — a cold instance can take
        // 30-60s+ to start listening, and the first request to hit it while
        // still booting gets a 502 from Render's own proxy. That's exactly the
        // failure mode already diagnosed and fixed one layer in for Gotenberg
        // (see gotenberg/client.ts's waitForGotenbergReady): the fix is the
        // same shape — patiently wait for /health before sending the real
        // request, instead of letting the first attempt eat a cold 502 and
        // silently waiting for the next 60s sync cycle (or the user manually
        // retrying) to paper over it.
        await waitForReportServiceReady(reportServiceUrl);

        // The service now responds immediately once generation is safely queued
        // (202) rather than blocking for the entire Chromium render — a
        // multi-minute request was too fragile to hold open over a mobile
        // network. This sync item is "done" once the job is accepted; actual
        // completion/failure is discovered separately by app/(app)/jobs/[id]/
        // preview.tsx polling GET /report-status, which is fully decoupled
        // from this sync queue.
        let respData: { status?: string; error?: string } | null = null;
        try {
          const httpRes = await fetch(`${reportServiceUrl}/generate-report`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${session.access_token}`,
            },
            body: JSON.stringify({ jobId: reportJobId }),
          });
          respData = await httpRes.json().catch(() => null);
          // 202 = newly queued. 409 = another request already has this job
          // generating (e.g. a retried sync cycle) — also fine, not an error.
          if (!httpRes.ok && httpRes.status !== 409) {
            error = { message: respData?.error ?? `report-generator returned HTTP ${httpRes.status}` };
          }
        } catch (fetchErr) {
          error = { message: fetchErr instanceof Error ? fetchErr.message : 'Network error calling report-generator' };
        }

        if (!error && __DEV__) {
          console.log(`[UMA BUILDING SERVICES Sync] PUSH: report generation queued for job ${reportJobId} (${respData?.status ?? 'accepted'})`);
        }
      }

      // ── Self-heal a stale/removed column in an already-queued payload ──────
      // If a field is removed from a table after some devices already had a
      // sync_queue item referencing it (e.g. a feature built then reverted
      // mid-rollout — this happened with assets.location_detail), PostgREST
      // rejects the push with "Could not find the 'X' column of 'Y' in the
      // schema cache" forever — retrying the same stale payload can never
      // succeed on its own. Strip the offending key, persist the corrected
      // payload so it isn't resent broken, and retry immediately.
      if (error && (item.operation === SyncOperation.Insert || item.operation === SyncOperation.Update)) {
        const colMatch = error.message?.match(/Could not find the '([a-zA-Z0-9_]+)' column of '[a-zA-Z0-9_]+' in the schema cache/);
        if (colMatch && colMatch[1] in payload) {
          const staleColumn = colMatch[1];
          console.warn(`[SiteTrack Sync] '${item.table_name}.${staleColumn}' no longer exists on the server — stripping it from queued item ${item.id} and retrying`);
          delete payload[staleColumn];
          updateSyncQueuePayload(item.id, JSON.stringify(payload));
          if (item.operation === SyncOperation.Insert) {
            const retry = await supabase.from(item.table_name).insert(payload);
            error = retry.error;
          } else if (item.table_name === 'job_assets' && payload.actioned_at) {
            const retry = await supabase.from('job_assets').update(payload).eq('id', item.record_id).lt('actioned_at', payload.actioned_at as string).select('id');
            error = retry.error;
          } else if (
            (item.table_name === 'defects' || item.table_name === 'assets' || item.table_name === 'jobs') &&
            payload.updated_at
          ) {
            const retry = await supabase.from(item.table_name).update(payload).eq('id', item.record_id).lt('updated_at', payload.updated_at as string).select('id');
            error = retry.error;
          } else {
            const retry = await supabase.from(item.table_name).update(payload).eq('id', item.record_id);
            error = retry.error;
          }
        }
      }

      if (error) {
        const { retryable, isDuplicate } = classifySyncError(error);

        if (isDuplicate && item.operation === SyncOperation.Insert) {
          // The row already exists server-side — a previous push attempt
          // actually succeeded, but the client never saw the confirmation
          // (dropped connection, app killed mid-request). The goal of this
          // queue item — get this row onto the server — is already met.
          markSyncItemComplete(item.id);
          openInsertKeys.delete(`${item.table_name}:${item.record_id}`);
          if (__DEV__) console.log(
            `[SiteTrack Sync] PUSH: item ${item.id} (${item.table_name}) already exists server-side — treating as complete`
          );
        } else {
          console.warn(
            `[UMA BUILDING SERVICES Sync] PUSH failed (retry ${(item.retry_count ?? 0) + 1}/${MAX_SYNC_RETRIES}) for item ${item.id} (${item.table_name}/${item.operation}): ${error.message}`
          );
          // Retryable errors get exponential backoff; terminal ones (bad data,
          // permission denial) fail immediately instead of burning all 5 attempts
          // rediscovering the same non-fixable error.
          incrementSyncRetry(item.id, error.message, MAX_SYNC_RETRIES, !retryable);
        }
      } else if (error === null && (
        item.operation === SyncOperation.Insert ||
        item.operation === SyncOperation.Update ||
        item.operation === SyncOperation.Delete ||
        item.operation === SyncOperation.ReportGenerate
      )) {
        // Only mark complete for operations we actually handled above.
        // FIX: Previously any unrecognised operation (e.g. 'photo_upload')
        // fell through to markSyncItemComplete() here — the photo binary was
        // never uploaded but the queue item was marked done, permanently
        // losing the photo. Now we only mark complete for handled operations.
        markSyncItemComplete(item.id);
        if (item.operation === SyncOperation.Insert) {
          openInsertKeys.delete(`${item.table_name}:${item.record_id}`);
        }
        if (__DEV__) console.log(
          `[UMA BUILDING SERVICES Sync] PUSH: queue item ${item.id} (${item.table_name}/${item.operation}) complete`
        );
      } else if (error === null) {
        // Unrecognised operation — leave in queue, log a warning so it's visible.
        // photo_upload items are handled separately by processPhotoQueue() in
        // photoUpload.ts and must NOT be marked complete here.
        console.warn(
          `[UMA BUILDING SERVICES Sync] PUSH: skipping unknown operation '${item.operation}' for item ${item.id} — not marking complete`
        );
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.warn(`[UMA BUILDING SERVICES Sync] PUSH unexpected error for queue item ${item.id}: ${msg}`);
      incrementSyncRetry(item.id, msg, MAX_SYNC_RETRIES);
    }
  }
}
