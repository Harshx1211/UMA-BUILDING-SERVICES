// Background sync service — pulls from Supabase and pushes the offline sync queue every 60 seconds
import NetInfo from '@react-native-community/netinfo';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase, getCurrentUser } from '@/lib/supabase';
import {
  getPendingSyncItems,
  markSyncItemComplete,
  incrementSyncRetry,
  upsertRecord,
  getJobStatus,
  getDeletedPhotoIds,
  getFailedSyncItems,
  getRecord,
  retryAllFailedSyncItems,
} from '@/lib/database';
import { useAuthStore } from '@/store/authStore';
import { SYNC_INTERVAL_MS, LAST_SYNCED_KEY } from '@/constants/Config';
import { SyncOperation } from '@/constants/Enums';
import type { SyncStatus } from '@/types';
import { processPhotoQueue, cleanupLocalPhotos } from '@/lib/photoUpload';

/** Re-exported for convenience — UI components only need to import from sync.ts */
export { retryAllFailedSyncItems } from '@/lib/database';

/** Max consecutive push failures before a sync queue item is permanently abandoned */
const MAX_SYNC_RETRIES = 5;

// Mutex for processPhotoQueue — prevents overlapping manual + interval calls (BUG-N12)
let _isProcessingPhotos = false;

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
    await _pushQueue();
    if (_shouldStop) return false;

    // ── 3. PULL — server → local SQLite ──────────────────────────
    const lastSynced = await AsyncStorage.getItem(LAST_SYNCED_KEY);
    if (_shouldStop) return false;
    await _pullJobs(resolvedUserId, lastSynced);
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

// ─────────────────────────────────────────────
// Private helpers
// ─────────────────────────────────────────────

/** Pulls all jobs assigned to the user and the related properties/assets */
async function _pullJobs(userId: string, _lastSynced: string | null): Promise<void> {
  // Always pull all non-cancelled jobs for this technician.
  // Using a simple filter (no lastSynced delta) guarantees we never silently
  // drop jobs due to clock skew, timezone edge-cases, or status transitions.
  // The result set is small (one technician's workload) so this is fine.
  const { data: jobs, error: jobsError } = await supabase
    .from('jobs')
    .select('*')
    .eq('assigned_to', userId)
    .neq('status', 'cancelled');

  if (jobsError) {
    console.error('[UMA BUILDING SERVICES Sync] PULL jobs error:', jobsError.message);
    return;
  }

  if (!jobs || jobs.length === 0) {
    if (__DEV__) console.log('[UMA BUILDING SERVICES Sync] No jobs to pull');
    return;
  }

  // Preemptively fetch and upsert the current user to satisfy job's assigned_to FK
  const { data: techUser } = await supabase.from('users').select('*').eq('id', userId).maybeSingle();
  if (techUser) {
    if (techUser.is_active === false) {
      console.warn('[UMA BUILDING SERVICES Sync] User deactivated. Forcing logout.');
      import('@/store/authStore').then((m) => m.useAuthStore.getState().signOut());
      return;
    }
    if (techUser.company_id) {
      const { data: company } = await supabase.from('companies').select('*').eq('id', techUser.company_id).maybeSingle();
      if (company) {
        if (company.subscription_status !== 'active') {
          console.warn('[UMA BUILDING SERVICES Sync] Company suspended. Forcing logout.');
          import('@/store/authStore').then((m) => m.useAuthStore.getState().signOut());
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
    const { data: properties, error: propError } = await supabase
      .from('properties')
      .select('*')
      .in('id', propertyIds);

    if (propError) {
      console.error('[UMA BUILDING SERVICES Sync] PULL properties error:', propError.message);
    } else if (properties) {
      for (const prop of properties) {
        upsertRecord('properties', prop as Record<string, string | number | boolean | null>);
      }
      if (__DEV__) console.log(`[UMA BUILDING SERVICES Sync] PULL: upserted ${properties.length} property/ies`);

      // Pull assets for these properties
      const { data: assets, error: assetError } = await supabase
        .from('assets')
        .select('*')
        .in('property_id', propertyIds)
        .eq('status', 'active');

      if (assetError) {
        console.error('[UMA BUILDING SERVICES Sync] PULL assets error:', assetError.message);
      } else if (assets) {
        for (const asset of assets) {
          upsertRecord('assets', asset as Record<string, string | number | boolean | null>);
        }
        if (__DEV__) console.log(`[UMA BUILDING SERVICES Sync] PULL: upserted ${assets.length} asset(s)`);
      }
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
    if (localStatus) {
      const serverPriority = STATUS_PRIORITY[job.status as string] ?? 1;
      const localPriority  = STATUS_PRIORITY[localStatus.status]  ?? 1;
      if (localPriority > serverPriority) {
        // Local is ahead — only allow override if the local change is stale
        const localUpdateMs = new Date(localStatus.updated_at).getTime();
        const isStale = Date.now() - localUpdateMs > STALE_THRESHOLD_MS;
        if (!isStale) {
          // Preserve local status — still upsert all other fields from server
          if (__DEV__) {
            console.log(
              `[UMA BUILDING SERVICES Sync] PULL: preserving local '${localStatus.status}' over server '${job.status}' for job ${job.id}`
            );
          }
          const { status: _ignored, ...rest } = job as Record<string, unknown>;
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

  // Pull job_assets, defects, and inspection_photos for these jobs
  if (jobIds.length > 0) {
    await _pullRelated('job_assets', 'job_id', jobIds);
    await _pullRelated('defects', 'job_id', jobIds);
    // H6: _pullRelated already handles the deleted-photo tombstone internally
    // (it calls getDeletedPhotoIds() itself when table === 'inspection_photos')
    await _pullRelated('inspection_photos', 'job_id', jobIds);
    await _pullRelated('signatures', 'job_id', jobIds);
    await _pullRelated('time_logs', 'job_id', jobIds);
    await _pullRelated('quotes', 'job_id', jobIds);

    // quote_items — need quote IDs for this job batch first
    const { data: quoteRows } = await supabase.from('quotes').select('id').in('job_id', jobIds);
    if (quoteRows && quoteRows.length > 0) {
      const parentQuoteIds = quoteRows.map((q) => q.id as string);
      await _pullRelated('quote_items', 'quote_id', parentQuoteIds);
    }
  }

  // Pull global inventory items
  const { data: inventoryItems, error: invError } = await supabase.from('inventory_items').select('*');
  if (invError) {
    console.error('[UMA BUILDING SERVICES Sync] PULL inventory_items error:', invError.message);
  } else if (inventoryItems) {
    for (const item of inventoryItems) {
      upsertRecord('inventory_items', item as Record<string, string | number | boolean | null>);
    }
  }

  // Pull catalogue reference tables (asset types + defect codes)
  const { data: assetTypeDefs } = await supabase
    .from('asset_type_definitions')
    .select('id,value,label,full_label,icon,color,inspection_routine,variants,is_active,sort_order,created_at,updated_at')
    .eq('is_active', true);
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

  const { data: defectCodes } = await supabase
    .from('defect_codes')
    .select('id,code,description,quote_price,category,is_active,sort_order,created_at')
    .eq('is_active', true);
  if (defectCodes) {
    for (const row of defectCodes) {
      upsertRecord('defect_codes', {
        ...row, is_active: 1,
      } as Record<string, string | number | boolean | null>);
    }
    if (__DEV__ && defectCodes.length > 0)
      console.log(`[UMA BUILDING SERVICES Sync] PULL: upserted ${defectCodes.length} defect_codes`);
  }
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
    // For inspection_photos: skip any row whose ID is in the permanent tombstone.
    let tombstoneIds = new Set<string>();
    if (table === 'inspection_photos') {
      tombstoneIds = getDeletedPhotoIds();
    }

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
        if (localRow?.result && !serverRow.result) {
          // Local has an inspection result, server doesn't — preserve local.
          if (__DEV__)
            console.log(`[UMA BUILDING SERVICES Sync] PULL: preserving local job_asset result '${localRow.result}' over server null for ${rowId}`);
          skipped++;
          continue;
        }
        // If server has a result and local also has a result, trust server only if
        // server actioned_at is newer (the admin may have corrected the result remotely).
        if (localRow?.result && serverRow.result && localRow.actioned_at && serverRow.actioned_at) {
          const localMs  = new Date(localRow.actioned_at as string).getTime();
          const serverMs = new Date(serverRow.actioned_at as string).getTime();
          if (localMs > serverMs) {
            // Local is newer — preserve it.
            skipped++;
            continue;
          }
        }
      }

      upsertRecord(table, row as Record<string, string | number | boolean | null>);
    }
    if (__DEV__) {
      const upserted = data.length - skipped;
      if (upserted > 0) console.log(`[UMA BUILDING SERVICES Sync] PULL: upserted ${upserted} ${table} row(s)`);
      if (skipped > 0)  console.log(`[UMA BUILDING SERVICES Sync] PULL: skipped ${skipped} tombstoned/preserved ${table} row(s)`);
    }
  }
}

/**
 * Pushes all pending sync_queue items to Supabase, marking each complete on success.
 * Items that fail MAX_SYNC_RETRIES times are permanently abandoned to prevent infinite loops.
 */
async function _pushQueue(): Promise<void> {
  const pending = getPendingSyncItems();

  if (pending.length === 0) {
    if (__DEV__) console.log('[UMA BUILDING SERVICES Sync] PUSH: no pending items');
    return;
  }

  // Items returned by getPendingSyncItems already exclude those at/above MAX_SYNC_RETRIES.
  // We process all returned items — no secondary filter needed.
  if (__DEV__) console.log(`[UMA BUILDING SERVICES Sync] PUSH: processing ${pending.length} queue item(s)`);

  for (const item of pending) {
    try {
      const payload = JSON.parse(item.payload) as Record<string, unknown>;
      let error: { message: string } | null = null;

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
        if (_cachedUserId && !payload.company_id) {
          const u = getRecord<{ company_id: string }>('users', _cachedUserId);
          if (u?.company_id) {
            payload.company_id = u.company_id;
          }
        }
        const result = await supabase.from(item.table_name).insert(payload);
        error = result.error;
      } else if (item.operation === SyncOperation.Update) {
        // FIX: Inject company_id for UPDATE operations too.
        // Although RLS on UPDATE typically filters on existing column values (not
        // the payload), some Supabase policies check the payload's company_id to
        // prevent cross-tenant writes. Injecting it here is safe and idempotent.
        if (_cachedUserId && !payload.company_id) {
          const u = getRecord<{ company_id: string }>('users', _cachedUserId);
          if (u?.company_id) payload.company_id = u.company_id;
        }
        const result = await supabase
          .from(item.table_name)
          .update(payload)
          .eq('id', item.record_id);
        error = result.error;
      } else if (item.operation === SyncOperation.Delete) {
        // If it's an inspection photo deletion, also attempt to delete the physical file from the storage bucket
        if (item.table_name === 'inspection_photos' && typeof payload.photo_url === 'string') {
          const url = payload.photo_url;
          if (url.includes('/object/public/job-photos/')) {
            const filePath = url.split('/object/public/job-photos/')[1];
            if (filePath) {
              const { error: storageErr } = await supabase.storage.from('job-photos').remove([filePath]);
              if (storageErr && __DEV__) {
                console.warn(`[UMA BUILDING SERVICES Sync] Failed to delete photo binary from storage:`, storageErr.message);
              }
            }
          }
        }

        const result = await supabase
          .from(item.table_name)
          .delete()
          .eq('id', item.record_id);
        error = result.error;
      }

      if (error) {
        console.warn(
          `[UMA BUILDING SERVICES Sync] PUSH failed (retry ${(item.retry_count ?? 0) + 1}/${MAX_SYNC_RETRIES}) for item ${item.id} (${item.table_name}/${item.operation}): ${error.message}`
        );
        // Increment retry counter; marks synced=-1 when limit is reached
        incrementSyncRetry(item.id, error.message, MAX_SYNC_RETRIES);
      } else {
        markSyncItemComplete(item.id);
        if (__DEV__) console.log(
          `[UMA BUILDING SERVICES Sync] PUSH: queue item ${item.id} (${item.table_name}/${item.operation}) complete`
        );
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.warn(`[UMA BUILDING SERVICES Sync] PUSH unexpected error for queue item ${item.id}: ${msg}`);
      incrementSyncRetry(item.id, msg, MAX_SYNC_RETRIES);
    }
  }
}
