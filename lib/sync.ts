// Background sync service — pulls from Supabase and pushes the offline sync queue every 60 seconds
import NetInfo from '@react-native-community/netinfo';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase, getCurrentUser } from '@/lib/supabase';
import {
  getPendingSyncItems,
  markSyncItemComplete,
  upsertRecord,
} from '@/lib/database';
import { SYNC_INTERVAL_MS, LAST_SYNCED_KEY } from '@/constants/Config';
import { SyncOperation } from '@/constants/Enums';
import type { SyncStatus } from '@/types';

// ─────────────────────────────────────────────
// Internal state
// ─────────────────────────────────────────────

let _syncInterval: ReturnType<typeof setInterval> | null = null;
let _isSyncing = false;

// ─────────────────────────────────────────────
// Public API
// ─────────────────────────────────────────────

/** Starts the background sync loop — call once from the root layout on mount */
export function startSync(): void {
  if (_syncInterval) {
    console.log('[SiteTrack Sync] Already running — skipping startSync()');
    return;
  }
  console.log(`[SiteTrack Sync] Starting sync interval (${SYNC_INTERVAL_MS / 1000}s)`);
  // Run immediately on start, then repeat on interval
  void runSync();
  _syncInterval = setInterval(() => {
    void runSync();
  }, SYNC_INTERVAL_MS);
}

/** Stops the background sync loop — call on app unmount / sign-out */
export function stopSync(): void {
  if (_syncInterval) {
    clearInterval(_syncInterval);
    _syncInterval = null;
    console.log('[SiteTrack Sync] Sync stopped');
  }
}

/**
 * Returns the current sync status snapshot:
 * - lastSynced: ISO timestamp from AsyncStorage, or null
 * - pendingCount: number of items waiting in the sync queue
 * - isOnline: current network reachability
 */
export async function getSyncStatus(): Promise<SyncStatus> {
  const netState = await NetInfo.fetch();
  const lastSynced = await AsyncStorage.getItem(LAST_SYNCED_KEY);
  const pending = getPendingSyncItems();
  return {
    lastSynced,
    pendingCount: pending.length,
    isOnline: netState.isConnected === true && netState.isInternetReachable !== false,
  };
}

// ─────────────────────────────────────────────
// Core sync logic
// ─────────────────────────────────────────────

/**
 * Main sync function:
 * 1. Checks network connectivity
 * 2. PULL: fetches jobs, properties, assets from Supabase → upserts locally
 * 3. PUSH: sends pending sync_queue items to Supabase
 * 4. Updates last_synced timestamp
 */
export async function runSync(): Promise<void> {
  if (_isSyncing) {
    console.log('[SiteTrack Sync] Already in progress — skipping');
    return;
  }

  // ── 1. Network check ────────────────────────
  const netState = await NetInfo.fetch();
  const isOnline =
    netState.isConnected === true && netState.isInternetReachable !== false;

  if (!isOnline) {
    console.log('[SiteTrack Sync] Offline — skipping sync');
    return;
  }

  _isSyncing = true;
  console.log('[SiteTrack Sync] Starting sync run...');

  try {
    const user = await getCurrentUser();
    if (!user) {
      console.log('[SiteTrack Sync] No authenticated user — skipping sync');
      return;
    }

    // ── 2. PULL — Jobs assigned to this technician ──
    await _pullJobs(user.id);

    // ── 3. PUSH — Offline queue ──────────────────
    await _pushQueue();

    // ── 4. Update last-synced timestamp ──────────
    const now = new Date().toISOString();
    await AsyncStorage.setItem(LAST_SYNCED_KEY, now);
    console.log(`[SiteTrack Sync] Sync complete at ${now}`);
  } catch (err) {
    console.error('[SiteTrack Sync] Unexpected error during sync:', err);
  } finally {
    _isSyncing = false;
  }
}

// ─────────────────────────────────────────────
// Private helpers
// ─────────────────────────────────────────────

/** Pulls all jobs assigned to the user and the related properties/assets */
async function _pullJobs(userId: string): Promise<void> {
  // Pull jobs
  const { data: jobs, error: jobsError } = await supabase
    .from('jobs')
    .select('*')
    .eq('assigned_to', userId)
    .neq('status', 'cancelled');

  if (jobsError) {
    console.error('[SiteTrack Sync] PULL jobs error:', jobsError.message);
    return;
  }

  if (!jobs || jobs.length === 0) {
    console.log('[SiteTrack Sync] No jobs to pull');
    return;
  }

  // Preemptively fetch and upsert the current user to satisfy job's assigned_to FK
  const { data: techUser } = await supabase.from('users').select('*').eq('id', userId).single();
  if (techUser) {
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
      console.error('[SiteTrack Sync] PULL properties error:', propError.message);
    } else if (properties) {
      for (const prop of properties) {
        upsertRecord('properties', prop as Record<string, string | number | boolean | null>);
      }
      console.log(`[SiteTrack Sync] PULL: upserted ${properties.length} property/ies`);

      // Pull assets for these properties
      const { data: assets, error: assetError } = await supabase
        .from('assets')
        .select('*')
        .in('property_id', propertyIds)
        .eq('status', 'active');

      if (assetError) {
        console.error('[SiteTrack Sync] PULL assets error:', assetError.message);
      } else if (assets) {
        for (const asset of assets) {
          upsertRecord('assets', asset as Record<string, string | number | boolean | null>);
        }
        console.log(`[SiteTrack Sync] PULL: upserted ${assets.length} asset(s)`);
      }
    }
  }

  // Now safe to upsert jobs since properties and user exist locally
  for (const job of jobs) {
    upsertRecord('jobs', job as Record<string, string | number | boolean | null>);
  }
  console.log(`[SiteTrack Sync] PULL: upserted ${jobs.length} job(s)`);

  // Pull job_assets, defects, and inspection_photos for these jobs
  if (jobIds.length > 0) {
    await _pullRelated('job_assets', 'job_id', jobIds);
    await _pullRelated('defects', 'job_id', jobIds);
    await _pullRelated('inspection_photos', 'job_id', jobIds);
    await _pullRelated('signatures', 'job_id', jobIds);
    await _pullRelated('time_logs', 'job_id', jobIds);
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
    console.error(`[SiteTrack Sync] PULL ${table} error:`, error.message);
    return;
  }
  if (data) {
    for (const row of data) {
      upsertRecord(table, row as Record<string, string | number | boolean | null>);
    }
    if (data.length > 0) {
      console.log(`[SiteTrack Sync] PULL: upserted ${data.length} ${table} row(s)`);
    }
  }
}

/** Pushes all pending sync_queue items to Supabase, marking each complete on success */
async function _pushQueue(): Promise<void> {
  const pending = getPendingSyncItems();

  if (pending.length === 0) {
    console.log('[SiteTrack Sync] PUSH: no pending items');
    return;
  }

  console.log(`[SiteTrack Sync] PUSH: processing ${pending.length} queue item(s)`);

  for (const item of pending) {
    try {
      const payload = JSON.parse(item.payload) as Record<string, unknown>;
      let error: { message: string } | null = null;

      if (item.operation === SyncOperation.Insert) {
        const result = await supabase.from(item.table_name).insert(payload);
        error = result.error;
      } else if (item.operation === SyncOperation.Update) {
        const result = await supabase
          .from(item.table_name)
          .update(payload)
          .eq('id', item.record_id);
        error = result.error;
      } else if (item.operation === SyncOperation.Delete) {
        const result = await supabase
          .from(item.table_name)
          .delete()
          .eq('id', item.record_id);
        error = result.error;
      }

      if (error) {
        console.error(
          `[SiteTrack Sync] PUSH failed for queue item ${item.id} (${item.table_name}/${item.operation}):`,
          error.message
        );
        // Leave in queue for retry on next sync cycle
      } else {
        markSyncItemComplete(item.id);
        console.log(
          `[SiteTrack Sync] PUSH: queue item ${item.id} (${item.table_name}/${item.operation}) complete`
        );
      }
    } catch (err) {
      console.error(
        `[SiteTrack Sync] PUSH unexpected error for queue item ${item.id}:`,
        err
      );
      // Leave in queue for retry
    }
  }
}
