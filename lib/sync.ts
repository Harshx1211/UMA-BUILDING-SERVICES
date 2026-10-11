// Background sync service — pulls from Supabase and pushes the offline sync queue every 60 seconds
import NetInfo from '@react-native-community/netinfo';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { RealtimeChannel } from '@supabase/supabase-js';
import { supabase, getCurrentUser } from '@/lib/supabase';
import {
  getPendingSyncItems,
  getUnsyncedItemsIncludingBackoff,
  markSyncItemComplete,
  incrementSyncRetry,
  upsertRecord,
  upsertRecordBulk,
  getJobStatus,
  getDeletedPhotoIds,
  getDeletedDocumentIds,
  getDeletedNotebookItemIds,
  getFailedSyncItems,
  getRecord,
  deleteRecord,
  remapSyncQueueRecordId,
  supersedeEarlierDeletes,
  getPendingJobFieldMap,
  deferSyncItem,
  updateSyncQueuePayload,
  applyRemoteDeletion,
  hasTerminalInsertFailure,
  // retryAllFailedSyncItems is reserved for a future "Retry All" button in the UI
} from '@/lib/database';
import { useAuthStore } from '@/store/authStore';
import { SYNC_INTERVAL_MS, LAST_SYNCED_KEY, LAST_DELETION_LOG_ID_KEY, LAST_NOTIFICATION_PULL_KEY, PHOTO_BUCKET, DOCUMENT_BUCKET } from '@/constants/Config';
import { SyncOperation } from '@/constants/Enums';
import type { SyncStatus, SyncQueueItem } from '@/types';
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
 * Blocks until the report service answers its own /health check, or gives
 * up quietly after REPORT_SERVICE_WARMUP_MAX_WAIT_MS. See the call site in
 * the report_generate handler below for why this exists (cold starts).
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
 * What a server copy of a job is allowed to overwrite locally. Shared by
 * the periodic pull (_pullJobs) and both realtime channels so the three can
 * never disagree.
 *
 * Rule: a column this device has changed but NOT YET PUSHED keeps its local
 * value (see getPendingJobFieldMap); every other column takes the server's.
 * An office cancellation always applies — it's an administrative override,
 * not something a pending local edit should hold back.
 *
 * FIX (reopened job snapping back to "completed"): this used to be a status
 * ladder — scheduled < in_progress < completed — that only protected a local
 * status AHEAD of the server's. "Continue Working" moves a job BACKWARDS
 * (completed → in_progress), so any server copy still saying "completed"
 * (the report service writing report_url, a periodic pull, a realtime echo
 * of the earlier completion) arriving before the reopen had synced won
 * outright: the job re-locked and the inspection form shut mid-edit. Worse,
 * the reopen's own echo then lost to the ladder (local "completed" was now
 * "ahead" and freshly stamped), leaving it stuck completed locally for up
 * to 6 hours. Basing the decision on "is there an unpushed local edit"
 * instead of "which status is further along" handles both directions.
 */
function _mergeServerJob(
  serverRow: Record<string, unknown>,
  pendingFields: Map<string, Set<string>> = getPendingJobFieldMap(),
): Record<string, string | number | boolean | null> {
  const row = serverRow as Record<string, string | number | boolean | null>;
  if (row.status === 'cancelled') return row;
  const fields = pendingFields.get(row.id as string);
  if (!fields || fields.size === 0) return row;
  const local = getRecord<Record<string, string | number | boolean | null>>('jobs', row.id as string);
  if (!local) return row;
  const merged = { ...row };
  for (const k of fields) {
    if (k in local) merged[k] = local[k];
  }
  return merged;
}

// ─────────────────────────────────────────────
// Internal state
// ─────────────────────────────────────────────

let _syncInterval: ReturnType<typeof setInterval> | null = null;
let _isSyncing  = false;
let _shouldStop = false;   // Set by stopSync() to abort an in-progress runSync()
let _cachedUserId: string | null = null;
// FIX: _pushQueue() itself had no mutex of its own — only the OUTER
// functions that call it were individually guarded (_isSyncing for
// runSync, _isPushingNow for syncNow), and pushPendingWork() had no guard
// at all beyond a bounded WAIT for _isSyncing that proceeded regardless of
// whether the wait actually succeeded. Two overlapping passes both
// attempting the same pending sync_queue rows is exactly the condition
// that makes the job_assets/signatures conflict handlers mistake a same-
// device race for a genuine two-device conflict and delete their own
// just-inserted row (see those handlers' own FIX comments). This single
// shared flag, checked-and-set synchronously (no `await` in between)
// immediately before every direct call to _pushQueue(), closes the gap for
// all three entry points at once instead of each guarding it separately.
let _isPushingQueue = false;

// Set when a push is requested while one is already running. FIX: the
// overlapping call used to just be dropped — so work queued mid-push (e.g.
// the PDF request, queued a moment after the job's completion started
// pushing) sat until some unrelated later trigger. Now the running pass
// goes round once more when it finishes, picking it up straight away.
let _pushRequestedAgain = false;

async function _pushQueueGuarded(userId: string): Promise<void> {
  if (_isPushingQueue) {
    if (__DEV__) console.log('[SiteTrack Sync] _pushQueue already running — will run once more when it finishes');
    _pushRequestedAgain = true;
    return;
  }
  _isPushingQueue = true;
  try {
    do {
      _pushRequestedAgain = false;
      await _pushQueue(userId);
    } while (_pushRequestedAgain && !_shouldStop);
  } finally {
    _isPushingQueue = false;
    _pushRequestedAgain = false;
  }
}

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

/**
 * Stops the background sync loop — call on app unmount / sign-out.
 *
 * FIX (cross-account data exposure race): this used to be synchronous and
 * fire-and-forget the channel teardowns, returning before either had
 * actually finished unsubscribing server-side. authStore's signOut() and
 * its SIGNED_OUT listener counterpart both call this then, after a short
 * wait for any in-flight runSync() (waitForSyncIdle), wipe local SQLite —
 * but neither of those ever waited for the REALTIME CHANNELS specifically
 * to finish closing, so a postgres_changes message already in flight at
 * that exact moment could still reach a `.on(...)` callback and write into
 * local SQLite after it had just been cleared for whichever user signs in
 * next on this device. Now genuinely async — callers that care about this
 * ordering (sign-out) must await it; callers that don't (there are none
 * left — this is only ever called on sign-out) get the same behavior they
 * always had, since not awaiting an async function is always valid JS.
 */
export async function stopSync(): Promise<void> {
  _shouldStop = true;
  if (_syncInterval) {
    clearInterval(_syncInterval);
    _syncInterval = null;
    if (__DEV__) console.log('[SiteTrack Sync] Sync stopped');
  }
  if (_pushSoonTimer) {
    clearTimeout(_pushSoonTimer);
    _pushSoonTimer = null;
  }
  _cachedUserId = null;
  // Hard reset, not the refcounted unsubscribeFromJobLive() — sign-out must
  // guarantee no channel survives into a different user's session on this
  // device, regardless of how many job screens think they still want it
  // open. Awaited (not `void`) specifically here — see this function's own
  // comment above for why this is the one place that ordering matters.
  await Promise.all([_teardownLiveChannel(), _teardownMyDataChannel()]);
  // H2: Purge all listeners on sign-out to prevent stale refs from previous session
  clearSyncListeners();
  clearSyncFailureListeners();
}

let _pushSoonTimer: ReturnType<typeof setTimeout> | null = null;
const PUSH_SOON_DEBOUNCE_MS = 1500;

/**
 * Schedules a push-only sync shortly after a local write reaches the sync
 * queue, so a technician's work (an inspection result, a defect, a photo, a
 * note — anything written via addToSyncQueue in lib/database.ts) reaches the
 * server within a couple of seconds instead of sitting until the next
 * periodic cycle (SYNC_INTERVAL_MS, currently 10 minutes) or some unrelated
 * screen action that happens to trigger one.
 *
 * Debounced, not called-once-per-write: a burst of writes (ticking through a
 * 50-asset checklist, or several photos taken in a row) coalesces into ONE
 * push shortly after the burst settles, rather than one push per write —
 * the whole point of SYNC_INTERVAL_MS being stretched out (see its own
 * comment in constants/Config.ts) was to stop the app hammering the network
 * on a fixed timer regardless of activity; this restores immediacy for
 * actual edits without reintroducing that.
 *
 * Uses pushPendingWork (push-only, no full pull of jobs/properties/assets)
 * rather than runSync() — getting THIS device's own recent edit up quickly
 * is the entire point; there's no reason to also re-pull everything else on
 * every debounced tick the way the periodic full sync does. Does its own
 * offline check first (pushPendingWork has none of its own) so a burst of
 * writes made offline doesn't repeatedly attempt and fail a network call —
 * the reconnect listener in useNetworkStatus.ts already handles catching up
 * once back online.
 *
 * Called from addToSyncQueue via a lazy `import('@/lib/sync')` (see its own
 * comment) rather than a static import, to avoid a circular dependency —
 * lib/database.ts is a lower-level module this file already imports from.
 */
export function schedulePushSoon(): void {
  if (_pushSoonTimer) clearTimeout(_pushSoonTimer);
  _pushSoonTimer = setTimeout(() => {
    _pushSoonTimer = null;
    void (async () => {
      if (!_cachedUserId) return; // not logged in (yet), or already signed out
      const netState = await NetInfo.fetch();
      const online = netState.isConnected === true && netState.isInternetReachable !== false;
      if (!online) return;
      await pushPendingWork(_cachedUserId);
    })();
  }, PUSH_SOON_DEBOUNCE_MS);
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
  // FIX (race condition — two runSync() calls could run fully concurrently):
  // this used to set _isSyncing = true AFTER the network check below, which
  // contains an `await`. Two calls arriving close together — a very real
  // scenario, since app foreground fires both subscribeToMyDataLive's own
  // reconnect runSync() and useNetworkStatus's reconnect runSync() off the
  // same OS event — could both pass the `if (_isSyncing)` guard above
  // before either one actually set the flag, then both proceed to run a
  // full sync at once, defeating the entire point of this mutex (confirmed:
  // this let two concurrent _pushQueue() passes both attempt the same
  // pending rows, and the job_assets unique-constraint-conflict handler
  // could mistake that for a genuine two-device conflict and delete its own
  // just-inserted row). Claiming the mutex here, before any `await`, closes
  // the gap — JS can't interleave anything between this check and this
  // assignment.
  _isSyncing = true;

  // Reset abort flag at the start of each new run
  _shouldStop = false;

  try {
    // ── 1. Network check ─────────────────────────────────────────
    const netState = await NetInfo.fetch();
    const isOnline =
      netState.isConnected === true && netState.isInternetReachable !== false;

    if (!isOnline) {
      if (__DEV__) console.log('[SiteTrack Sync] Offline — skipping sync');
      return false;
    }

    if (__DEV__) console.log('[SiteTrack Sync] Starting sync run...');

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

    // FIX (cold-start perf — "2-3 seconds of data loading" after login):
    // this used to run its OWN "is this account still active/subscribed"
    // check right here — two sequential, awaited network round trips
    // (users, then companies) BEFORE any pull/push even started — on
    // EVERY sync cycle, including the very first one that fires the
    // instant a session starts. app/(app)/_layout.tsx's own heartbeat
    // effect already runs this EXACT same check (identical queries,
    // identical 'suspended'/'cancelled' condition, identical
    // forceFinalSyncAndSignOut() action) on a TIGHTER cadence (throttled
    // to 5 minutes, vs. this running effectively every 10 minutes per
    // SYNC_INTERVAL_MS) — and it also fires immediately on login, same as
    // this did. Two independent copies of the identical revocation check
    // were racing each other on every cold start for zero added safety
    // margin. Removed here; the heartbeat is now the single source of
    // truth for this, and it already covers a shorter window than this
    // copy ever did.

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

    await _pushQueueGuarded(resolvedUserId);
    if (_shouldStop) return false;

    // ── 3. PULL — server → local SQLite ──────────────────────────
    const lastSynced = await AsyncStorage.getItem(LAST_SYNCED_KEY);
    if (_shouldStop) return false;
    await _pullJobs(resolvedUserId, lastSynced);
    if (_shouldStop) return false;
    await _pullDeletions();
    if (_shouldStop) return false;
    await _pullNotifications(resolvedUserId);
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
 * Originally added for ONLY authStore's signOut()/forceFinalSyncAndSignOut(),
 * which can't just call runSync(): runSync's revocation/subscription check
 * would immediately re-detect the same deactivated/suspended account and
 * re-call forceFinalSyncAndSignOut() (a no-op re-entrancy guard),
 * short-circuiting before the push step ever runs — the whole reason those
 * callers do their own push instead. Previously that bypass called
 * processPhotoQueue()/_pushQueue() directly with no mutex at all: a
 * technician signing out while the background 60s interval was mid-upload
 * could run two concurrent processPhotoQueue() passes, each uploading the
 * same local photo under a different generated filename and racing to
 * insert the same inspection_photos.id, orphaning a Storage object.
 *
 * Now also used by schedulePushSoon() below (its own comment explains why),
 * for the same reason it originally suited sign-out: it's push-only, with no
 * full pull of jobs/properties/assets — a debounced "get my recent edits up
 * quickly" trigger has no reason to also re-pull everything else, unlike the
 * periodic full runSync(). Any OTHER caller wanting normal sync triggering
 * (pull included, revocation check included) should still use runSync().
 */
export async function pushPendingWork(userId: string): Promise<void> {
  for (let waited = 0; _isSyncing && waited < 10; waited++) {
    await new Promise((r) => setTimeout(r, 500));
  }
  // FIX: this used to fall through to _pushQueue() unconditionally once the
  // bounded wait above ended, with NO re-check of _isSyncing and no mutex of
  // its own — so a still-in-progress runSync() (the 5s wait timed out, or a
  // slow/rural connection just made it take that long) and this call could
  // run _pushQueue() concurrently. That's exactly the overlap that made the
  // job_assets/signatures conflict handlers mistake a same-device race for a
  // genuine two-device conflict and delete their own just-inserted row (see
  // those handlers' own FIX comments). If a sync is still running, it will
  // push these same pending items itself as part of its own cycle — bail
  // out instead of racing it.
  if (_isSyncing) {
    if (__DEV__) console.log('[SiteTrack Sync] pushPendingWork: runSync still in progress after wait — skipping, it will push pending items itself');
    return;
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
  await _pushQueueGuarded(userId);
}

/**
 * Pending items that actually belong to (or predate) this user — see
 * _pushQueue's own comment on sync_queue.user_id for why this filter
 * exists: a shared/pool device can have a previous account's queued edits
 * still sitting here after a forced sign-out that deliberately preserved
 * rather than wiped them. Used everywhere a "is there still unsynced
 * work" decision is made, not just where the actual push happens —
 * without this, a stale FOREIGN user's stuck item would show up as this
 * user's own unsynced work and could block them from ever signing out.
 */
function getPendingSyncItemsForUser(userId: string): SyncQueueItem[] {
  const all = getPendingSyncItems();
  return userId ? all.filter((p) => !p.user_id || p.user_id === userId) : all;
}

/**
 * Retries pushPendingWork up to `maxAttempts` times (1s/2s/3s/4s/5s
 * backoff between attempts), stopping early once nothing is pending.
 * Returns whatever is still pending when it stops — the caller decides
 * what that means (abort with a warning, in every current caller).
 *
 * FIX: this exact retry loop was copy-pasted 3 times in authStore.ts
 * (signOut, forceFinalSyncAndSignOut, and the SIGNED_OUT auth listener)
 * and had already started drifting — the SIGNED_OUT copy wraps its call
 * in its own try/catch (it also fires on a background token-refresh
 * failure, where a throw must not skip the "is it safe to wipe local
 * data" check that follows), the other two don't need to since they're
 * already inside an outer try/catch. That difference is still each
 * caller's responsibility — this helper doesn't swallow errors, a throw
 * from pushPendingWork here propagates out exactly like the inlined
 * version did.
 */
export async function flushPendingSyncWithRetry(userId: string, maxAttempts = 5): Promise<SyncQueueItem[]> {
  let pending = getPendingSyncItemsForUser(userId);
  if (pending.length === 0) return pending;
  for (let i = 0; i < maxAttempts; i++) {
    await pushPendingWork(userId);
    pending = getPendingSyncItemsForUser(userId);
    if (pending.length === 0) break;
    await new Promise((r) => setTimeout(r, (i + 1) * 1000));
  }
  return pending;
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
    // Fire-and-forget is fine here — ordering only matters for the
    // sign-out security boundary, which stopSync() awaits explicitly.
    void _teardownLiveChannel();
  }

  _liveJobId = jobId;
  _liveOnChange = onChange;
  _liveRefCount++;

  if (_liveChannel) return; // already open for this job — just swapped the handler in and bumped the count

  // FIX: job_assets.asset_id and defects.asset_id are both NOT NULL FK
  // references to assets(id), enforced unconditionally (PRAGMA foreign_keys
  // = ON at schema init). If a brand-new asset is created server-side and a
  // job_assets/defect row against it arrives over this channel before the
  // asset's own row has been applied locally (two independent realtime
  // subscriptions — this job channel and the asset's own creation event —
  // with no cross-channel ordering guarantee, and this channel's reconnect
  // catch-up pull doesn't include `assets`), upsertRecord throws an FK
  // violation that doesn't match the "unknown column" pattern its own catch
  // block forgives, so it's silently dropped with no retry. Same fetch-
  // parent-first pattern applyJobTechnician below already uses for its own
  // FK (job_technicians.user_id -> users), applied here for the asset_id
  // parent instead.
  const _ensureAssetLocal = async (assetId: string | undefined): Promise<boolean> => {
    if (!assetId || getRecord('assets', assetId)) return true;
    const { data } = await supabase.from('assets').select('*').eq('id', assetId).maybeSingle();
    if (!data) return false; // fetch failed, or the row's gone — periodic pull retries once possible
    upsertRecord('assets', data as Record<string, string | number | boolean | null>);
    return true;
  };

  const applyJobAsset = (row: Record<string, unknown>) => {
    void (async () => {
      if (!(await _ensureAssetLocal(row.asset_id as string | undefined))) return;
      const localRow = getRecord<{ result: string | null; actioned_at: string | null }>(
        'job_assets', row.id as string
      );
      if (_shouldPreserveLocalJobAsset(row, localRow)) {
        if (__DEV__) console.log(`[SiteTrack Sync] Realtime: preserving local job_asset result over incoming row for ${row.id}`);
        return;
      }
      upsertRecord('job_assets', row as Record<string, string | number | boolean | null>);
      _liveOnChange?.('job_assets');
    })();
  };

  const applyDefect = (row: Record<string, unknown>) => {
    void (async () => {
      if (!(await _ensureAssetLocal(row.asset_id as string | undefined))) return;
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
    })();
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
    if ((row.id as string) !== jobId) return;
    upsertRecord('jobs', _mergeServerJob(row));
    _liveOnChange?.('jobs');
  };

  // No local write path exists for job_technicians (crew assignment is
  // admin-only, bar the one self-assign Insert in site-inspect.tsx which
  // never races a live echo of itself) or time_logs (not written by the
  // mobile app at all yet) — plain upsert, same as the periodic pull.
  //
  // FIX: same FK-violation-silently-swallowed failure mode as
  // applyMyJobTechnician above, just against the OTHER parent. This
  // channel is unfiltered by user_id — it fires for ANY crew member added
  // to whichever job this screen has open, not just this device's own
  // user (applyMyJobTechnician only ever needs to fetch the PARENT JOB,
  // never the parent USER, because it's scoped to user_id=eq.me — you
  // can't be logged in without your own users row already existing
  // locally). Here, job_technicians.user_id can reference a technician
  // this device has never synced before (a new hire just added to this
  // job's crew while someone else already has it open) — inserting
  // against that unseen user_id threw inside upsertRecord exactly the
  // same way an unseen job_id did, silently dropping the crew membership
  // until the next periodic pull happened to catch it.
  const applyJobTechnician = (row: Record<string, unknown>) => {
    void (async () => {
      const uid = row.user_id as string | undefined;
      if (uid && !getRecord('users', uid)) {
        const { data } = await supabase.from('users').select('*').eq('id', uid).maybeSingle();
        if (data) {
          upsertRecord('users', data as Record<string, string | number | boolean | null>);
        } else {
          return; // fetch failed, or the row's gone — periodic pull retries once possible
        }
      }
      upsertRecord('job_technicians', row as Record<string, string | number | boolean | null>);
      _liveOnChange?.('job_technicians');
    })();
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
  if (_liveRefCount === 0) void _teardownLiveChannel();
}

// FIX (race condition — a stray realtime write could land after sign-out's
// clearDatabase()): this used to fire-and-forget supabase.removeChannel()
// (`void supabase.removeChannel(...)`) and null the local variable
// immediately, without waiting for the unsubscribe to actually take effect
// server-side. Nulling the variable stops NEW subscribe calls from reusing
// a stale channel, but does nothing to stop a `postgres_changes` message
// already in flight over the socket at that exact moment from still
// reaching its `.on(...)` callback and calling upsertRecord() — those
// closures aren't gated on the module-level variable at all. On a shared
// device, a stray write landing between stopSync() and clearDatabase()
// during sign-out is exactly the cross-account data exposure class this
// codebase has fixed several times already. Now genuinely async and
// awaited by stopSync() specifically (the one caller where this ordering
// is a real security boundary, not just a nice-to-have) — every other
// caller (job-switch, screen blur, AppState background) stays
// fire-and-forget via `void`, since ordering doesn't matter there.
async function _teardownLiveChannel(): Promise<void> {
  const channel = _liveChannel;
  _liveChannel = null;
  _liveJobId = null;
  _liveOnChange = null;
  _liveRefCount = 0;
  if (channel) await supabase.removeChannel(channel);
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
 * exists (_mergeServerJob for jobs, _shouldPreserveLocalRow for
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
  if (_myDataChannel) void _teardownMyDataChannel();
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
  const doUpsertJob = (row: Record<string, unknown>) => {
    upsertRecord('jobs', _mergeServerJob(row));
    _emitSyncComplete();
  };

  const applyJob = (row: Record<string, unknown>, requireLocal: boolean) => {
    const rowId = row.id as string;
    const localStatus = getJobStatus(rowId);
    if (requireLocal && !localStatus) return;
    if (localStatus) {
      doUpsertJob(row);
      return;
    }
    // FIX: a genuinely new job locally (only reachable here when
    // requireLocal=false — a fresh assignment or a new crew addition) can
    // reference a property/assignee this device has never synced before.
    // jobs.property_id and jobs.assigned_to are both NOT NULL, FK-enforced
    // locally (initializeSchema turns PRAGMA foreign_keys ON, and unlike
    // the bulk pull's upsertRecordBulk, upsertRecord never disables it) —
    // inserting the job before its parents exist threw and was silently
    // swallowed inside upsertRecord's own catch-all error handling,
    // permanently dropping the job. This channel also has no catch-up pull
    // on (re)connect the way subscribeToJobLive does, so nothing else would
    // ever retry it before the next full periodic sync. Fetch+insert any
    // missing parent first.
    void (async () => {
      const propertyId = row.property_id as string | undefined;
      const assignedTo = row.assigned_to as string | undefined;
      if (propertyId && !getRecord('properties', propertyId)) {
        const { data } = await supabase.from('properties').select('*').eq('id', propertyId).maybeSingle();
        if (data) upsertRecord('properties', data as Record<string, string | number | boolean | null>);
      }
      if (assignedTo && !getRecord('users', assignedTo)) {
        const { data } = await supabase.from('users').select('*').eq('id', assignedTo).maybeSingle();
        if (data) upsertRecord('users', data as Record<string, string | number | boolean | null>);
      }
      doUpsertJob(row);
    })();
  };

  // Being newly ADDED to a job's crew — job_technicians alone doesn't carry
  // the job's own fields, so fetch that job's row too, same one-time
  // catch-up shape subscribeToJobLive already uses elsewhere.
  //
  // FIX: local job_technicians has a foreign key to jobs(id), enforced
  // (initializeSchema turns PRAGMA foreign_keys ON). This used to upsert
  // the crew row FIRST, synchronously, then fetch+insert the job
  // afterward — but this handler exists specifically for the case where
  // the technician has never had this job synced locally before, meaning
  // the parent jobs row doesn't exist yet at the moment the crew row tries
  // to insert. That threw inside upsertRecord, which only retries on a
  // missing-column error and otherwise just logs and swallows everything
  // else — so the crew membership was silently dropped, invisible until
  // whatever next full periodic sync happened to re-pull it. The job row
  // now goes in first (awaited), then the crew row.
  const applyMyJobTechnician = (row: Record<string, unknown>) => {
    void (async () => {
      const jobId = row.job_id as string;
      if (!getJobStatus(jobId)) {
        const { data } = await supabase.from('jobs').select('*').eq('id', jobId).maybeSingle();
        if (data) {
          applyJob(data as Record<string, unknown>, false);
        } else {
          // Fetch failed, or the job doesn't exist server-side — inserting
          // the crew row now would just hit the same FK violation. Skip;
          // the periodic pull's own catch-up retries both once possible.
          return;
        }
      }
      upsertRecord('job_technicians', row as Record<string, string | number | boolean | null>);
      _emitSyncComplete();
    })();
  };

  // FIX: this table is subscribed company-wide/unfiltered below (Realtime
  // can't filter by "job_id IN (my jobs)"), but the periodic pull has
  // ALWAYS scoped defects to this technician's own jobs only
  // (_pullRelated('defects', 'job_id', jobIds)) — "the global Defects list"
  // has only ever meant "across my own jobs," never company-wide. Without
  // this gate, a defect logged on a completely unrelated technician's job
  // would get upserted here with no ownership check at all, leaking into
  // getAllDefects() (app/(app)/defects/index.tsx) for a job/property this
  // technician has no relationship to. Same requireLocal reasoning as
  // applyJob — only apply if the defect's own job is already known locally.
  const applyDefect = (row: Record<string, unknown>) => {
    const rowId = row.id as string;
    const jobId = row.job_id as string | null;
    if (!jobId || !getJobStatus(jobId)) return;
    // FIX: defects.asset_id is a NOT NULL FK to assets(id), enforced
    // unconditionally — same silent-drop failure mode subscribeToJobLive's
    // own applyDefect was fixed for (see its _ensureAssetLocal comment). The
    // job-ownership gate above only proves the PARENT JOB is known locally;
    // a brand-new asset added to that job could still arrive here (this
    // channel is company-wide) before its own row does. Fetch it first if
    // missing, same fetch-parent-first pattern used throughout this file.
    void (async () => {
      const assetId = row.asset_id as string | undefined;
      if (assetId && !getRecord('assets', assetId)) {
        const { data } = await supabase.from('assets').select('*').eq('id', assetId).maybeSingle();
        if (!data) return; // fetch failed, or the row's gone — periodic pull retries once possible
        upsertRecord('assets', data as Record<string, string | number | boolean | null>);
      }
      const localRow = getRecord<{ updated_at: string | null }>('defects', rowId);
      if (_shouldPreserveLocalRow(row, localRow)) return;
      // Same text[] -> JSON string normalisation subscribeToJobLive's own
      // applyDefect already does.
      const photos: string = Array.isArray(row.photos) ? JSON.stringify(row.photos) : String(row.photos ?? '[]');
      upsertRecord('defects', { ...row, photos } as Record<string, string | number | boolean | null>);
      _emitSyncComplete();
    })();
  };

  // Same leak risk and same fix as applyDefect above — assets is also
  // subscribed company-wide, and the periodic pull only ever fetches assets
  // for this technician's own properties (_pullJobs's own properties/assets
  // fetch, scoped to propertyIds derived from this technician's jobs).
  // Gate on the asset's property already being known locally.
  const applyAsset = (row: Record<string, unknown>) => {
    const rowId = row.id as string;
    const propertyId = row.property_id as string | null;
    if (!propertyId || !getRecord('properties', propertyId)) return;
    const localRow = getRecord<{ updated_at: string | null }>('assets', rowId);
    if (_shouldPreserveLocalRow(row, localRow)) return;
    upsertRecord('assets', row as Record<string, string | number | boolean | null>);
    _emitSyncComplete();
  };

  // Add/delete only (no edit), so unlike applyAsset/applyDefect there's no
  // "preserve a newer local edit" case to guard — a fresh id just gets
  // inserted. Same leak-prevention gate: only apply to a property this
  // device already knows about.
  const applyNotebookItem = (row: Record<string, unknown>) => {
    const propertyId = row.property_id as string | null;
    if (!propertyId || !getRecord('properties', propertyId)) return;
    upsertRecord('property_notebook_items', row as Record<string, string | number | boolean | null>);
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
    .on<Record<string, unknown>>('postgres_changes', { event: 'INSERT', schema: 'public', table: 'property_notebook_items' }, (p) => applyNotebookItem(p.new))
    // FIX: UPDATE-only was the one real structural gap in this channel — a
    // brand-new property (created by an admin, or by this technician's own
    // first job there) never arrived live at all, only via the next
    // periodic pull. applyProperty is already unfiltered/ungated (properties
    // are company-wide reference data here, not scoped to "your assigned
    // jobs" the way jobs/defects/assets are — see its own definition above,
    // which never had a requireLocal-style check to begin with), so adding
    // INSERT is exactly the same trust boundary as the UPDATE binding
    // already had, not a new one.
    .on<Record<string, unknown>>('postgres_changes', { event: 'INSERT', schema: 'public', table: 'properties' }, (p) => applyProperty(p.new))
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
        // FIX: unlike subscribeToJobLive (which runs an explicit catch-up
        // pull on every (re)connect), this channel had none at all — so
        // anything that changed while the device was offline, backgrounded
        // (app/(app)/_layout.tsx tears this channel down and rebuilds it on
        // every background/foreground transition), or simply before this
        // first connection completed would silently wait for the next full
        // periodic sync. runSync() already has its own _isSyncing mutex, so
        // this is a safe, bounded no-op if one happens to already be
        // running — same pattern useNetworkStatus's own reconnect trigger
        // already uses for the same reason.
        void runSync(userId);
      } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
        if (__DEV__) console.warn(`[SiteTrack Sync] my-data-live ${status} for user ${userId} — auto-retrying:`, err);
      }
    });
}

/** Call on sign-out / app teardown — mirrors unsubscribeFromJobLive's hard reset. */
export function unsubscribeFromMyDataLive(): void {
  void _teardownMyDataChannel();
}

// See _teardownLiveChannel's own comment for why this is genuinely async
// and awaited — same fix, same reasoning, applied to the whole-session
// channel (which covers far more tables, so the exposure window matters
// even more here).
async function _teardownMyDataChannel(): Promise<void> {
  const channel = _myDataChannel;
  _myDataChannel = null;
  _myDataUserId = null;
  if (channel) await supabase.removeChannel(channel);
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
      await _pushQueueGuarded(resolvedUserId);
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
    // FIX: this used to advance the checkpoint unconditionally, regardless
    // of whether any individual deletion actually applied. applyRemoteDeletion
    // already catches its own errors (a genuine local failure — lock
    // contention, an unexpected constraint — shouldn't abort the rest of
    // the batch), but nothing here ever surfaced that to anyone: the
    // checkpoint moves past that id either way, and this pull is the ONLY
    // path that will ever apply it (Realtime never replays a missed event,
    // and a device that's already past this checkpoint will never re-fetch
    // it). A silently-failed deletion just left that row as a permanent
    // local ghost with zero indication anything went wrong. Still advances
    // the checkpoint the same way (retrying the same row forever would
    // block every deletion AFTER it too, which is worse) — but now reuses
    // the existing sync-failure alert bus so a real failure is at least
    // visible instead of invisible.
    const failed: { table: string; recordId: string }[] = [];
    for (const row of data) {
      const ok = applyRemoteDeletion(row.table_name as string, row.record_id as string);
      if (!ok) failed.push({ table: row.table_name as string, recordId: row.record_id as string });
    }
    const highestId = data[data.length - 1].id as number;
    await AsyncStorage.setItem(LAST_DELETION_LOG_ID_KEY, String(highestId));
    if (__DEV__) console.log(`[SiteTrack Sync] Applied ${data.length - failed.length}/${data.length} remote deletion(s), checkpoint now ${highestId}`);
    if (failed.length > 0) {
      _emitSyncFailureAlert({
        failedCount: failed.length,
        tables: [...new Set(failed.map((f) => f.table))],
        lastError: `Failed to apply a remote deletion on ${failed[failed.length - 1].table}/${failed[failed.length - 1].recordId} — it may still show locally even though it was deleted elsewhere.`,
        terminalCount: failed.length,
      });
    }
  } catch (err) {
    console.error('[SiteTrack Sync] _pullDeletions unexpected error:', err);
  }
}

/**
 * Catch-up for notifications created while this device was
 * offline/backgrounded. Unlike jobs/defects/assets, notifications have no
 * other periodic pull path at all — they were built Realtime-only (see
 * applyNotification above), so a notification created while disconnected
 * would otherwise never arrive. Checkpointed on created_at rather than an
 * id (notifications.id is a UUID, not sequential) — ties within the same
 * millisecond are rare enough for a notification feed that the tiny risk
 * of re-applying one (upsertRecord is idempotent on id) is preferable to
 * missing one on a boundary.
 */
async function _pullNotifications(userId: string): Promise<void> {
  try {
    const lastPulled = await AsyncStorage.getItem(LAST_NOTIFICATION_PULL_KEY);
    let query = supabase
      .from('notifications')
      .select('*')
      .or(`user_id.eq.${userId},user_id.is.null`)
      .order('created_at', { ascending: true })
      .limit(200);
    if (lastPulled) query = query.gt('created_at', lastPulled);
    const { data, error } = await query;
    if (error) {
      console.error('[SiteTrack Sync] PULL notifications error:', error.message);
      return;
    }
    if (!data || data.length === 0) return;
    for (const row of data) {
      upsertRecord('notifications', row as Record<string, string | number | boolean | null>);
    }
    const newestCreatedAt = data[data.length - 1].created_at as string;
    await AsyncStorage.setItem(LAST_NOTIFICATION_PULL_KEY, newestCreatedAt);
    // Not calling _emitSyncComplete() here — runSync's own final step already
    // fires it unconditionally after every pull phase (same pattern as
    // _pullDeletions/_pullJobs above), so a second call here would just be a
    // redundant, wasted reload.
    if (__DEV__) console.log(`[SiteTrack Sync] Pulled ${data.length} notification(s), checkpoint now ${newestCreatedAt}`);
  } catch (err) {
    console.error('[SiteTrack Sync] _pullNotifications unexpected error:', err);
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
      // Every status, not just 'active'. FIX: filtering here meant an asset
      // the office decommissioned never had that change reach this device
      // (unless the realtime channel happened to be connected at that
      // moment) — it stayed 'active' locally and on the checklist forever.
      // Local queries already filter to status = 'active' themselves.
      supabase.from('assets').select('*').in('property_id', propertyIds),
    ]);

    const { data: properties, error: propError } = propsResult;
    if (propError) {
      console.error('[UMA BUILDING SERVICES Sync] PULL properties error:', propError.message);
    } else if (properties) {
      for (const prop of properties) {
        upsertRecord('properties', prop as Record<string, string | number | boolean | null>);
      }
      if (__DEV__) console.log(`[UMA BUILDING SERVICES Sync] PULL: upserted ${properties.length} property/ies`);

      // Pull scanned documents for these properties — property-scoped like
      // assets above (not job-scoped like inspection_photos), so a document
      // captured during one job still shows up from every other job at the
      // same site. Safe to run without awaiting here (FK-disabled bulk
      // upsert) — collected below alongside the other independent pulls.
    }

    // FIX: this used to be nested inside the `properties` success branch
    // even though the two fetches have no real data dependency for a
    // property this device already has locally from a previous sync — so a
    // transient error on the properties endpoint discarded an ALREADY-
    // successful, independent assets fetch entirely for this cycle instead
    // of applying it, adding a full sync-cycle of unnecessary staleness.
    // Processed after properties (not concurrently) to preserve the
    // original dependency-safe write order for a property that's genuinely
    // new to this device.
    const { data: assets, error: assetError } = assetsResult;
    if (assetError) {
      console.error('[UMA BUILDING SERVICES Sync] PULL assets error:', assetError.message);
    } else if (assets) {
      // FIX: this pull path upserted assets blindly — the "never revert an
      // unsynced local edit" guard (_shouldPreserveLocalRow) only lived in
      // _pullRelated, which assets don't go through. An offline asset edit
      // or Delete Asset (decommission) could be reverted by the very next
      // pull, before its own queued push landed.
      let preserved = 0;
      for (const asset of assets) {
        const localRow = getRecord<{ updated_at: string | null }>('assets', asset.id as string);
        if (_shouldPreserveLocalRow(asset as Record<string, unknown>, localRow)) { preserved++; continue; }
        upsertRecord('assets', asset as Record<string, string | number | boolean | null>);
      }
      if (__DEV__) console.log(`[UMA BUILDING SERVICES Sync] PULL: upserted ${assets.length - preserved} asset(s), kept ${preserved} newer local`);
    }
  }

  // Now safe to upsert jobs since properties and user exist locally. Each
  // row goes through _mergeServerJob, so a field with an unpushed local edit
  // (a reopen, a status change, field notes) keeps its local value. The
  // pending-edit map is read once for the whole batch, not per job.
  const pendingJobFields = getPendingJobFieldMap();
  let preservedCount = 0;
  for (const job of jobs) {
    if (pendingJobFields.has(job.id as string) && job.status !== 'cancelled') preservedCount++;
    upsertRecord('jobs', _mergeServerJob(job as Record<string, unknown>, pendingJobFields));
  }
  if (__DEV__) {
    console.log(`[UMA BUILDING SERVICES Sync] PULL: upserted ${jobs.length} job(s), kept unsynced local edits on ${preservedCount}`);
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
    relatedPulls.push(_pullRelated('property_notebook_items', 'property_id', propertyIds));
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
    // FIX: this device's own clock stamps localMs — if it runs slow, a
    // genuinely newer local result can compare as "older" than the
    // incoming server/realtime row, so an in-flight (not-yet-pushed) edit
    // gets visibly reverted on screen until its own queued push eventually
    // lands. _guardedUpdate (push side) already gives clock skew a
    // tolerance window before trusting an apparent "newer" comparison —
    // same margin here, so only a server row genuinely newer by more than
    // that margin actually wins.
    if (serverMs <= localMs + CLOCK_SKEW_TOLERANCE_MS) return true;
  }
  return false;
}

/**
 * Generalized version of _shouldPreserveLocalJobAsset for tables keyed by a
 * plain `updated_at` column (defects, assets) rather than job_assets' own
 * actioned_at. FIX: previously only job_assets (via the function above) and
 * jobs (via _mergeServerJob) had any protection against a pull
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
  // FIX: same clock-skew tolerance as _shouldPreserveLocalJobAsset just
  // above — see its comment. Without this, this device's own slow clock
  // could make a genuinely newer local edit compare as older than an
  // incoming pull/realtime row, visibly reverting it until the already-
  // correct queued push lands.
  return serverMs <= localMs + CLOCK_SKEW_TOLERANCE_MS;
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
    } else if (table === 'property_notebook_items') {
      tombstoneIds = getDeletedNotebookItemIds();
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

      // Counterpart of the field_audit_log push fix in _pushQueue: rows
      // written since then come back from PostgREST as a real array, which
      // isn't a valid SQLite bind value (it would silently fail the whole
      // row's upsert). Older rows are still a jsonb string and already
      // arrive as the string getFieldAuditLog expects — leave those alone.
      if (table === 'field_audit_log') {
        const auditRow = row as Record<string, unknown>;
        if (Array.isArray(auditRow.changes)) {
          auditRow.changes = JSON.stringify(auditRow.changes);
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

// A device's own clock running a few seconds behind server time is normal
// (no NTP sync guarantee on a phone); minutes behind is not. This is
// deliberately generous toward "trust the edit" — see _guardedUpdate's own
// comment for why erring toward retrying beats erring toward silent loss.
const CLOCK_SKEW_TOLERANCE_MS = 10_000;

/**
 * Runs the "only overwrite if genuinely newer" conflict-resolution update
 * used for job_assets/defects/assets/jobs — "whoever actually edited later
 * wins," not "whoever's device happened to sync last" (see its call
 * sites' own comments for the full policy reasoning).
 *
 * FIX (silent, undetectable data loss from device clock skew): the guard
 * compares THIS DEVICE'S OWN clock-stamped updated_at/actioned_at against
 * whatever's already on the server via `.lt(guardColumn, guardValue)`. A
 * phone whose clock runs behind real time — no guaranteed NTP sync, a
 * manually-set wrong time, a long offline stretch with a drifted RTC, all
 * real on field devices — stamps every edit with a timestamp that looks
 * OLDER than it really is, so a genuinely-latest edit can match 0 rows
 * here for no reason other than that skew. Supabase reports this as
 * `error: null` (an update that legitimately matched nothing isn't a
 * database error), so this used to just log at __DEV__ level and move on
 * — silently discarding a real edit with zero signal to the technician,
 * no retry, no failure alert. Now: on a 0-row match, re-fetches the
 * server's CURRENT guard-column value and checks whether it's genuinely
 * newer, beyond a small clock-skew tolerance. If it isn't, this was very
 * likely a false rejection, not a real conflict — retries once,
 * unconditionally, rather than accepting the loss. Worst case (a true,
 * within-tolerance-window simultaneous edit from two different devices)
 * this device's edit wins instead of the other one's — no worse than the
 * plain "whoever pushes last wins" behavior every OTHER table in this app
 * already has with no guard at all.
 */
async function _guardedUpdate(
  table: string,
  recordId: string,
  payload: Record<string, unknown>,
  guardColumn: 'actioned_at' | 'updated_at',
): Promise<{ error: { message: string } | null }> {
  const guardValue = payload[guardColumn] as string;
  const result = await supabase.from(table).update(payload).eq('id', recordId).lt(guardColumn, guardValue).select('id');
  if (result.error || (result.data?.length ?? 0) > 0) {
    return { error: result.error };
  }

  // 0 rows matched — find out whether that's a real supersede before
  // accepting the loss.
  const { data: current } = await supabase.from(table).select(guardColumn).eq('id', recordId).maybeSingle();
  const currentValue = current ? ((current as Record<string, unknown>)[guardColumn] as string | null) : null;
  const genuinelyNewer = currentValue != null
    && new Date(currentValue).getTime() > new Date(guardValue).getTime() + CLOCK_SKEW_TOLERANCE_MS;

  if (genuinelyNewer) {
    if (__DEV__) console.log(`[SiteTrack Sync] ${table} update for ${recordId} skipped — server already has a genuinely later edit`);
    return { error: null };
  }

  console.warn(
    `[SiteTrack Sync] ${table} update for ${recordId}: conflict guard rejected an edit that wasn't genuinely superseded ` +
    `(likely this device's clock running behind server time) — retrying unconditionally rather than silently discarding it.`
  );
  const retry = await supabase.from(table).update(payload).eq('id', recordId);
  return { error: retry.error };
}

/** Tables whose unsynced changes must reach the server before a job's PDF
 * is generated from server data. */
const PDF_CRITICAL_TABLES = ['jobs', 'assets', 'job_assets', 'defects', 'signatures', 'inspection_photos'];
// Tables whose local row carries its own job_id column — looked up fresh
// from SQLite rather than trusting the queued payload, because several call
// sites queue partial UPDATE payloads (only the changed fields, no job_id).
const TABLES_WITH_JOB_ID = ['job_assets', 'defects', 'signatures', 'inspection_photos'];

/**
 * Unsynced local changes for this job that its PDF has to wait for — the
 * report is generated from SERVER data, so generating before these land
 * produces a PDF missing what the technician just did.
 *
 * Counts items sitting out a retry backoff too (getUnsyncedItemsIncludingBackoff):
 * a change whose first push failed is still unsynced. Exported so the
 * report screen (useReportGeneration) can show what it's waiting for —
 * including a blocker's last error — instead of an unexplained spinner.
 */
export function getReportBlockers(jobId: string, excludeQueueId?: number): SyncQueueItem[] {
  return getUnsyncedItemsIncludingBackoff().filter(p => {
    if (p.id === excludeQueueId || !PDF_CRITICAL_TABLES.includes(p.table_name)) return false;
    // A sibling report request is a 'jobs' item but not data to wait for.
    if (p.operation === SyncOperation.ReportGenerate) return false;
    // A jobs row's own record_id IS the job id.
    if (p.table_name === 'jobs') return p.record_id === jobId;
    if (TABLES_WITH_JOB_ID.includes(p.table_name)) {
      const row = getRecord<{ job_id?: string }>(p.table_name, p.record_id);
      if (row?.job_id) return row.job_id === jobId;
    }
    // 'assets' has no job_id of its own; also the fallback for a row the
    // local lookup couldn't resolve (e.g. a Delete, whose row is gone).
    return (p.payload ?? '').includes(`"${jobId}"`);
  });
}

const BLOCKER_LABELS: Record<string, string> = {
  signatures: 'the signature',
  jobs: 'the job status',
  inspection_photos: 'photos',
  job_assets: 'inspection results',
  defects: 'defects',
  assets: 'assets',
};

/**
 * Plain-English answer to "why hasn't my report started?" for the report
 * screen, or null once the request has actually left this device (from
 * then on the report service's own status is the answer). Names the
 * blocker that's actually failing, with its last error, when there is one —
 * an upload that keeps failing used to look identical to a slow server.
 */
export function describeReportWait(jobId: string): string | null {
  const stillQueued = getUnsyncedItemsIncludingBackoff().some((i) => {
    if (i.operation !== SyncOperation.ReportGenerate) return false;
    try { return (JSON.parse(i.payload ?? '{}') as { jobId?: string }).jobId === jobId; } catch { return false; }
  });
  if (!stillQueued) return null;
  const blockers = getReportBlockers(jobId);
  if (blockers.length === 0) return 'Sending the report request…';
  const failing = blockers.find((b) => (b.retry_count ?? 0) > 0 && b.last_error);
  if (failing) {
    const label = BLOCKER_LABELS[failing.table_name] ?? failing.table_name;
    return `Waiting for ${label} to upload — the last attempt failed: ${failing.last_error}`;
  }
  const label = BLOCKER_LABELS[blockers[0].table_name] ?? blockers[0].table_name;
  return `Uploading ${blockers.length} change${blockers.length === 1 ? '' : 's'} first (${label})…`;
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
  // FIX: a shared/pool device can end up with a previous account's queued
  // edits still sitting here — a forced sign-out (a background token
  // refresh failing while offline, say) deliberately preserves local data
  // rather than wiping it when there's still unflushed work, exactly so it
  // isn't lost (see authStore.ts's SIGNED_OUT handler). Without this
  // filter, a DIFFERENT technician signing in next on that same device
  // would have that stale queue pushed under THEIR session — at best
  // mis-attributing who actually made the edit, at worst rejected by RLS
  // as a cross-company write if the two accounts belong to different
  // companies. Items queued before sync_queue.user_id existed are NULL and
  // still processed unconditionally, matching the old behavior exactly.
  const pending = uid ? getPendingSyncItemsForUser(uid) : getPendingSyncItems();

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
    // FIX: a JSON.parse failure here used to fall through to the generic
    // catch at the bottom of this loop, which classifies everything as a
    // transient, retryable failure (isTerminal=false). A malformed payload
    // is deterministic — it will fail identically on every retry — but
    // resetStaleFailedSyncItems() (called every successful sync cycle)
    // resets non-terminal failed items after 24h, so this would burn its
    // retry budget, "fail," then get silently reset and fail identically
    // again every 24 hours forever, firing another failure alert each time
    // with no way to ever actually clear it. Parsed separately, outside the
    // main try, so it can be classified terminal immediately instead.
    let payload: Record<string, unknown>;
    try {
      payload = JSON.parse(item.payload) as Record<string, unknown>;
    } catch (parseErr) {
      const msg = parseErr instanceof Error ? parseErr.message : String(parseErr);
      console.warn(`[UMA BUILDING SERVICES Sync] PUSH: queue item ${item.id} has unparsable payload, marking terminal: ${msg}`);
      incrementSyncRetry(item.id, `Corrupt payload (unparsable JSON): ${msg}`, MAX_SYNC_RETRIES, true);
      continue;
    }
    try {
      let error: { message: string; code?: string } | null = null;

      // Ensure defects photos is an array, not a stringified array
      if (item.table_name === 'defects' && typeof payload.photos === 'string') {
        try {
          payload.photos = JSON.parse(payload.photos);
        } catch {
          payload.photos = [];
        }
      }

      // FIX: same shape problem as defects.photos above. logFieldAudit
      // (lib/database.ts) stores `changes` as a JSON string — SQLite has no
      // array type — and it used to be pushed exactly like that, so the
      // server's jsonb column got a jsonb STRING containing the array's
      // text instead of the array itself. The admin dashboard's job
      // Timeline then crashed calling .map() on it. Parsed here so the
      // server gets a real array; covers items already sitting in the
      // queue too, since this runs at push time, not at enqueue time.
      if (item.table_name === 'field_audit_log' && typeof payload.changes === 'string') {
        try {
          payload.changes = JSON.parse(payload.changes);
        } catch {
          payload.changes = [];
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
            // FIX: if the "conflicting" row's id is literally the id THIS
            // device generated for its own insert, this isn't a two-device
            // conflict at all — it's an ordinary dropped connection or app
            // kill between "the insert committed server-side" and "this
            // device marked the queue item synced," so the retry collides
            // with a row it created itself. Since the retried payload is
            // byte-identical to what's already there, the tie-break below
            // always lands on "server's is already the more recent result"
            // (localTime === serverTime) and would delete this device's own
            // already-synced local row — no clock skew or second device
            // needed, just an ordinary reconnect in exactly the environment
            // (basements, rural sites) this app targets. Treat it as a
            // plain retry-success no-op: leave the local row alone.
            if (existing.id === item.record_id) {
              if (__DEV__) console.log(`[SiteTrack Sync] job_assets insert for ${payload.asset_id} already applied server-side (dropped-response retry) — no-op`);
            } else {
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
          }
          error = null; // handled — don't fall through to the generic error path
        }

        // ── signatures conflict: two devices (two techs, or one tech across
        // two devices/reinstalls) both captured a signature for the same
        // job while offline, so two rows exist locally for what the
        // signatures_job_id_key UNIQUE constraint only allows one of
        // server-side. Without this, the generic isDuplicate fast-path
        // below would assume "a previous attempt of MINE already
        // succeeded" — true for an id-keyed retry-after-dropped-connection,
        // but WRONG here: the row that already exists belongs to a
        // DIFFERENT device's capture (its own signature_url, signed_by_name
        // etc.), so this device's own signature would be silently thrown
        // away while the technician sees "Signature Saved". Same policy and
        // remap approach as the job_assets conflict just above.
        //
        // FIX (signature disappearing → "Signature Required" → re-sign): this
        // used to end by deleting this device's local row outright and
        // leaving the canonical one to "the next pull". Until that pull ran,
        // the job had NO local signature at all — Report Summary / Job
        // Detail showed "Signature Required" right after the technician had
        // signed, and re-signing just hit this same conflict again. Now the
        // winning row is written locally straight away under the server id.
        //
        // FIX (signature wiped on every device): the usual way a second row
        // exists is "Continue Working" — it queues a Delete for the old
        // signature, and the re-sign queues an Insert. If that Delete hadn't
        // reached the server yet (in retry backoff after a network blip),
        // this handler adopted the old row by UPDATEing the NEW signature
        // into it… and then the still-queued Delete ran and erased it,
        // with deletion_log spreading the loss to every device. Any such
        // earlier Delete is now retired the moment its row is adopted.
        if (error?.code === '23505' && item.table_name === 'signatures') {
          const { data: existing } = await supabase
            .from('signatures')
            .select('*')
            .eq('job_id', payload.job_id as string)
            .maybeSingle<Record<string, string | number | boolean | null>>();

          if (existing) {
            // FIX: same self-retry case as the job_assets conflict handler
            // just above — if the "conflicting" row's id is literally this
            // device's own insert id, it's a dropped-connection/app-kill
            // retry colliding with the row it already successfully created,
            // not a genuine second device. Leave it alone instead of running
            // the tie-break (which, on an identical retried payload, always
            // discards this device's own already-synced signature).
            if (existing.id === item.record_id) {
              if (__DEV__) console.log(`[SiteTrack Sync] signatures insert for job ${payload.job_id} already applied server-side (dropped-response retry) — no-op`);
            } else {
              const existingId = existing.id as string;
              const localTime = payload.signed_at ? new Date(payload.signed_at as string).getTime() : 0;
              const serverTime = existing.signed_at ? new Date(existing.signed_at as string).getTime() : 0;
              // The row this job should end up with locally, under the
              // server's id: this device's signature if it won and the
              // UPDATE landed, otherwise whatever the server already holds.
              let canonical: Record<string, string | number | boolean | null> = existing;
              if (localTime > serverTime) {
                const { id: _localId, ...updatePayload } = payload;
                const updateResult = await supabase.from('signatures').update(updatePayload).eq('id', existingId);
                if (updateResult.error) {
                  // Not adopted — leave the item failing so it retries,
                  // rather than marking it handled and losing this
                  // device's signature. The local row is untouched.
                  console.warn('[SiteTrack Sync] signatures conflict resolution UPDATE failed:', updateResult.error.message);
                  throw new Error(`signatures conflict UPDATE failed: ${updateResult.error.message}`);
                }
                canonical = { ...(payload as Record<string, string | number | boolean | null>), id: existingId };
                const retired = supersedeEarlierDeletes('signatures', existingId, item.id);
                if (__DEV__) {
                  console.log(`[SiteTrack Sync] signatures conflict for job ${payload.job_id}: this device's later signature applied to row ${existingId}` +
                    (retired ? ` (retired ${retired} stale delete(s) queued for it)` : ''));
                }
              } else if (__DEV__) {
                console.log(`[SiteTrack Sync] signatures conflict for job ${payload.job_id}: server row ${existingId} is already the more recent signature, discarding this device's older one`);
              }
              remapSyncQueueRecordId('signatures', item.record_id, existingId);
              for (const p of pending) {
                if (p.id === item.id || p.table_name !== 'signatures' || p.record_id !== item.record_id) continue;
                p.record_id = existingId;
                try {
                  const pPayload = JSON.parse(p.payload) as Record<string, unknown>;
                  if (pPayload.id === item.record_id) {
                    pPayload.id = existingId;
                    p.payload = JSON.stringify(pPayload);
                  }
                } catch { /* leave payload untouched if unparsable */ }
              }
              // Swap the local orphan for the canonical row. Delete first:
              // the local table has job_id UNIQUE, so writing the canonical
              // row while the orphan still holds this job_id would fail.
              deleteRecord('signatures', item.record_id);
              upsertRecord('signatures', canonical);
              _liveOnChange?.('signatures');
            }
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

        // FIX: the guard above only catches a same-pass race — it says
        // nothing about an Insert that already failed TERMINALLY on an
        // earlier cycle (dropped out of "pending" entirely, so it's no
        // longer in openInsertKeys). Without this check, this Update would
        // run against a row that will never exist, match zero rows
        // (Postgrest reports that as success, not an error), and get
        // marked synced — silently discarding this edit while reporting it
        // as saved. See hasTerminalInsertFailure's own comment.
        if (hasTerminalInsertFailure(item.table_name, item.record_id)) {
          incrementSyncRetry(item.id, `This record's own creation failed permanently, so this update can never be applied`, MAX_SYNC_RETRIES, true);
          console.warn(`[SiteTrack Sync] Update for ${item.table_name}/${item.record_id} abandoned — its own Insert failed terminally`);
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
        // See _guardedUpdate's own comment for why a 0-row match isn't
        // trusted blindly — a device clock running behind server time can
        // trigger this exact same shape with no real conflict at all.
        if (item.table_name === 'job_assets' && payload.actioned_at) {
          error = (await _guardedUpdate('job_assets', item.record_id, payload, 'actioned_at')).error;
        } else if (
          // FIX: site_documents added — it already has pull-side protection
          // against a stale echo overwriting a rename (updated_at exists on
          // this table specifically for that, added when the rename feature
          // shipped), but never got the equivalent push-side guard, so a
          // concurrent rename from two devices had no conflict protection
          // at all on the way up, only on the way back down.
          (item.table_name === 'defects' || item.table_name === 'assets' || item.table_name === 'jobs' || item.table_name === 'site_documents') &&
          payload.updated_at
        ) {
          // Same policy as job_assets, generalised: a stale, later-syncing edit
          // must never overwrite a genuinely more recent one already on the
          // server — "whoever actually edited later wins," not "whoever's
          // device happened to sync last." Matters most for jobs/defects since
          // multiple crew members (job_technicians) can share one job offline.
          error = (await _guardedUpdate(item.table_name, item.record_id, payload, 'updated_at')).error;
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
        // FIX: unlike the equivalent Update-side check, a terminally-failed
        // own-Insert means this Delete's goal (this row shouldn't exist) is
        // ALREADY true server-side — the row was never created. Mark it
        // complete outright rather than sending a pointless network
        // request; see hasTerminalInsertFailure's own comment for the
        // Update-side version of this same underlying gap, where the
        // correct resolution is the opposite (abandon, don't complete).
        if (hasTerminalInsertFailure(item.table_name, item.record_id)) {
          if (__DEV__) console.log(`[SiteTrack Sync] Delete for ${item.table_name}/${item.record_id} — its own Insert failed terminally, so it never existed; marking complete`);
          markSyncItemComplete(item.id);
          continue;
        }
        // If it's an inspection photo deletion, also attempt to delete the physical file from the storage bucket
        if (item.table_name === 'inspection_photos' && typeof payload.photo_url === 'string') {
          const url = payload.photo_url;
          // FIX: job-photos is now a private bucket (was public) — new uploads
          // store a long-lived SIGNED url (/object/sign/...), not a public one.
          // Still checking the old /object/public/ marker too so deletion
          // cleanup keeps working for any row uploaded before this change.
          const marker = [`/object/public/${PHOTO_BUCKET}/`, `/object/sign/${PHOTO_BUCKET}/`]
            .find((m) => url.includes(m));
          if (marker) {
            const filePath = url.split(marker)[1]?.split('?')[0];
            if (filePath) {
              const { error: storageErr } = await supabase.storage.from(PHOTO_BUCKET).remove([filePath]);
              if (storageErr && __DEV__) {
                console.warn(`[SiteTrack Sync] Failed to delete photo binary from storage:`, storageErr.message);
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
        // service (Node + headless Chromium on Cloud Run — see services/report-generator/)
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
        // FIX (job-level Field Notes race): 'jobs' was missing from this list
        // entirely — found while auditing the report pipeline after wiring
        // jobs.notes into the PDF (see cover.ts). A pending jobs Update (the
        // Field Notes save, a status change via "Continue Working", etc.)
        // was never treated as a blocker, so if that specific push failed
        // transiently, generation could proceed straight from Supabase's
        // stale jobs row — the exact same "edit didn't make it into the
        // PDF" bug the getUnsyncedItemsIncludingBackoff fix closed for
        // job_assets/defects, just left open for the jobs table itself.
        const blockers = getReportBlockers(reportJobId, item.id);
        if (blockers.length > 0) {
          if (__DEV__) console.warn(
            `[Sync] report_generate for ${reportJobId} waiting — ${blockers.length} item(s) still pending:`,
            blockers.map(b => `${b.table_name}/${b.operation}`).join(', ')
          );
          // FIX (a 15-asset report taking minutes, or never starting): this
          // used to call incrementSyncRetry — the FAILURE path — which puts
          // the request on exponential backoff (1, 2, 4, 8 min) every time
          // it found a blocker. "Your photos are still uploading" isn't a
          // failure, but each deferral hid the request from the queue for
          // longer, and useReportGeneration's 20s nudges couldn't reach it.
          // Now it just waits: no backoff, no retry spent, re-checked on the
          // very next push pass — which runs as soon as the blockers
          // themselves push (schedulePushSoon) or the screen nudges.
          deferSyncItem(item.id, `Waiting for ${blockers.length} change(s) to upload first`);
          continue;
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

        // The report service scales to zero when idle (Cloud Run; on its
        // earlier Render free-tier home a cold start took 30-60s+ and the
        // first request got a 502 from Render's proxy). Cloud Run usually
        // starts in a few seconds, but patiently waiting for /health before
        // the real request still costs nothing when it's warm and keeps a
        // slow cold start from failing this push and waiting for the next
        // sync cycle.
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
            error = (await _guardedUpdate('job_assets', item.record_id, payload, 'actioned_at')).error;
          } else if (
            (item.table_name === 'defects' || item.table_name === 'assets' || item.table_name === 'jobs' || item.table_name === 'site_documents') &&
            payload.updated_at
          ) {
            error = (await _guardedUpdate(item.table_name, item.record_id, payload, 'updated_at')).error;
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
