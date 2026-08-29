/**
 * lib/photoUpload.ts
 *
 * Handles uploading locally-captured photos to Supabase Storage and
 * keeping the local SQLite record in sync with the resulting public URL.
 *
 * Fix summary (this revision):
 *   1. uploadAsync httpMethod changed from POST → PUT (Supabase Storage upsert endpoint)
 *   2. getValidLocalUri applied to localUri before upload to handle stale Expo Go paths
 *   3. uploaded_by included in the SyncOperation.Insert payload (was silently missing,
 *      causing Supabase FK constraint failures on servers with NOT NULL uploaded_by)
 *   4. processPhotoQueue: early-exit if no pending photo tasks (avoids unnecessary work)
 *   5. queuePhotoUpload: recordId fallback made explicit (was relying on 'new' string)
 */

import { supabase } from '@/lib/supabase';
import {
  addToSyncQueue,
  getPendingSyncItems,
  markSyncItemComplete,
  updateRecord,
  getRecord,
  incrementSyncRetry,
  queryRecords,
} from '@/lib/database';
import { SyncOperation } from '@/constants/Enums';
import { PHOTO_BUCKET } from '@/constants/Config';
import * as FileSystem from 'expo-file-system/legacy';
import { getValidLocalUri } from '@/utils/fileHelpers';



/** Max concurrent photo binary uploads per sync cycle */
const UPLOAD_CONCURRENCY = 3;
/** M3: Max retries before a photo task is permanently abandoned (mirrors sync engine limit) */
const MAX_PHOTO_RETRIES = 5;

// ─── Upload a single photo to Supabase Storage ───────────────

/**
 * Uploads a local photo file to Supabase Storage under jobs/{jobId}/{filename}.
 *
 * Uses expo-file-system's uploadAsync with PUT (not POST) — Supabase Storage's
 * upsert endpoint requires PUT for binary uploads. Using POST returns a 405.
 *
 * @returns Public URL string on success, null on failure
 */
export async function uploadPhoto(
  localUri: string,
  jobId: string,
  assetId?: string,
): Promise<string | null> {
  try {
    // Normalise path for the current Expo Go session — stale absolute paths fail silently
    const resolvedUri = getValidLocalUri(localUri);

    const timestamp = Date.now();
    const random    = Math.random().toString(36).substring(7);
    const fileName  = `${timestamp}-${random}.jpg`;
    const filePath  = `jobs/${jobId}/${fileName}`;

    const session  = await supabase.auth.getSession();
    const token    = session.data.session?.access_token;
    const anonKey  = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? '';
    const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL ?? '';

    if (!supabaseUrl) {
      throw new Error('[PhotoUpload] EXPO_PUBLIC_SUPABASE_URL is not set');
    }

    const uploadUrl = `${supabaseUrl}/storage/v1/object/${PHOTO_BUCKET}/${filePath}`;

    // PUT is required for Supabase Storage binary upserts — POST returns 405
    const uploadResult = await FileSystem.uploadAsync(uploadUrl, resolvedUri, {
      httpMethod: 'PUT',
      uploadType: FileSystem.FileSystemUploadType.BINARY_CONTENT,
      headers: {
        Authorization: `Bearer ${token ?? anonKey}`,
        apikey: anonKey,
        'Content-Type': 'image/jpeg',
        'x-upsert': 'true',
      },
    });

    if (uploadResult.status !== 200 && uploadResult.status !== 201) {
      throw new Error(
        `[PhotoUpload] Upload failed (status ${uploadResult.status}): ${uploadResult.body}`,
      );
    }

    const { data: { publicUrl } } = supabase.storage
      .from(PHOTO_BUCKET)
      .getPublicUrl(filePath);

    return publicUrl;
  } catch (err) {
    console.error('[PhotoUpload] uploadPhoto error:', err);
    return null;
  }
}

// ─── Queue a photo upload for later processing ───────────────

/**
 * Adds a photo upload task to the local sync queue.
 * Synchronous — `addToSyncQueue` is a synchronous SQLite write.
 *
 * @param localUri  Local file:// URI of the captured photo
 * @param jobId     Job the photo belongs to
 * @param assetId   Asset the photo is linked to (optional)
 * @param recordId  The inspection_photos SQLite row id (required to update after upload)
 * @param defectId  Defect the photo is linked to (optional)
 */
export function queuePhotoUpload(
  localUri: string,
  jobId: string,
  assetId?: string,
  recordId?: string,
  defectId?: string,
): void {
  if (!recordId) {
    console.warn('[PhotoUpload] queuePhotoUpload called without recordId — skipping queue');
    return;
  }
  const payload = { localUri, jobId, assetId: assetId ?? null, recordId, defectId: defectId ?? null };
  addToSyncQueue('inspection_photos', recordId, 'photo_upload', payload);
}

// ─── Process the photo upload queue ──────────────────────────

/**
 * Processes all pending photo upload tasks from the sync queue.
 *
 * For each task:
 *   1. Uploads the local file to Supabase Storage
 *   2. Updates the local SQLite inspection_photos row with the public URL
 *   3. Queues a SyncOperation.Insert (with caption) to replicate to Supabase DB
 *   4. Marks the upload task complete so it won't retry
 *
 * Uploads run in parallel batches of UPLOAD_CONCURRENCY (default 3) for speed.
 * Failed uploads are left in the queue for retry on the next sync cycle.
 */
export async function processPhotoQueue(currentUserId: string): Promise<void> {
  try {
    const pending    = getPendingSyncItems();
    const photoTasks = pending.filter(i => String(i.operation) === 'photo_upload');

    if (photoTasks.length === 0) return;

    if (__DEV__) console.log(`[PhotoUpload] Processing ${photoTasks.length} queued photo(s) in batches of ${UPLOAD_CONCURRENCY}`);

    // H1: Guard — don't attempt photo sync without a valid user ID.
    // An empty uploaded_by value causes Supabase FK constraint failures silently.
    if (!currentUserId) {
      if (__DEV__) console.warn('[PhotoUpload] No authenticated user — deferring photo queue until next sync');
      return;
    }

    // Process in parallel batches — 3 concurrent uploads is safe on mobile connections
    for (let i = 0; i < photoTasks.length; i += UPLOAD_CONCURRENCY) {
      const batch = photoTasks.slice(i, i + UPLOAD_CONCURRENCY);

      await Promise.all(batch.map(async task => {
        // M3: Skip permanently-failed photo tasks (same retry limit as regular sync items)
        if ((task.retry_count ?? 0) >= MAX_PHOTO_RETRIES) {
          if (__DEV__) console.warn(`[PhotoUpload] Task ${task.id} has exceeded max retries — skipping permanently`);
          return;
        }

        let payload: {
          localUri: string;
          jobId: string;
          assetId?: string;
          recordId?: string;
          defectId?: string;
        };

        try {
          payload = JSON.parse(task.payload);
        } catch {
          console.warn('[PhotoUpload] Malformed task payload, skipping:', task.id);
          markSyncItemComplete(task.id);
          return;
        }

        if (__DEV__) console.log(`[PhotoUpload] Uploading photo for job ${payload.jobId}`);

        const publicUrl = await uploadPhoto(payload.localUri, payload.jobId, payload.assetId);

        if (publicUrl && payload.recordId) {
          // Update local SQLite row with the now-public URL
          updateRecord('inspection_photos', payload.recordId, { photo_url: publicUrl });

          // Read caption/asset_id/defect_id fresh from the local SQLite row rather
          // than trusting this task's queued payload — the payload's assetId/defectId
          // were captured when the photo was FIRST taken, which for the common
          // "photograph the fault before tapping Fail" flow is often before the
          // defect even existed. inspectionStore.ts back-fills defect_id onto this
          // row locally (synchronously) the moment the defect is created, and queues
          // its own Update to carry that fix to Supabase — but that Update was
          // queued earlier (at defect-creation time) than this Insert (queued only
          // now, after the upload finished), so the sync queue's created_at-ASC FIFO
          // order runs the Update first, against a row that doesn't exist remotely
          // yet, where it's a silent no-op — then this Insert lands with the stale
          // defect_id: null, permanently losing the link. Reading the row's current
          // local values here (always as-fresh-or-fresher than the queued payload)
          // means this Insert already carries the correct link, making that
          // redundant Update harmless instead of destructive.
          const localRow = getRecord<{
            caption: string | null;
            company_id: string | null;
            asset_id: string | null;
            defect_id: string | null;
          }>('inspection_photos', payload.recordId);

          // Insert the row into Supabase via sync queue.
          // uploaded_by AND company_id are required — include both so Supabase RLS is satisfied.
          addToSyncQueue('inspection_photos', payload.recordId, SyncOperation.Insert, {
            id:          payload.recordId,
            job_id:      payload.jobId,
            asset_id:    localRow?.asset_id ?? payload.assetId ?? null,
            defect_id:   localRow?.defect_id ?? payload.defectId ?? null,
            photo_url:   publicUrl,
            caption:     localRow?.caption ?? null,
            company_id:  localRow?.company_id ?? null,
            uploaded_at: new Date().toISOString(),
            uploaded_by: currentUserId,
          });

          markSyncItemComplete(task.id);

          if (__DEV__) console.log(`[PhotoUpload] Uploaded: ${publicUrl}`);
        } else {
          if (__DEV__) console.log(`[PhotoUpload] Upload failed for task ${task.id} — will retry next cycle`);
          incrementSyncRetry(task.id, 'Upload failed');
        }
      }));
    }
  } catch (err) {
    console.error('[PhotoUpload] processPhotoQueue error:', err);
  }
}

// ─── Local photo cleanup ──────────────────────────────────────

/** How long to keep local photo files on the device after a job is completed */
const LOCAL_PHOTO_RETENTION_DAYS = 15;

/**
 * Deletes local device photo files (local_uri) for jobs that:
 *   1. Are in 'completed' or 'cancelled' status
 *   2. Were last updated more than LOCAL_PHOTO_RETENTION_DAYS ago
 *   3. Have already been successfully uploaded to Supabase (photo_url starts with https://)
 *
 * Safety guarantee: We NEVER delete local_uri if photo_url is still a file:// URI,
 * meaning the upload hasn't completed yet. This ensures we never lose the only copy
 * of a photo.
 *
 * After deletion, local_uri is set to NULL in SQLite so this row is never processed again.
 *
 * This is called automatically at the end of each sync cycle so no background
 * task permission or OS scheduling is required.
 */
export async function cleanupLocalPhotos(): Promise<void> {
  try {
    const cutoffMs   = LOCAL_PHOTO_RETENTION_DAYS * 24 * 60 * 60 * 1000;
    const cutoffDate = new Date(Date.now() - cutoffMs).toISOString();

    // Find all inspection_photos rows that:
    //   - Have a local_uri still set (haven't been cleaned up yet)
    //   - Have an https:// photo_url (upload confirmed successful)
    const candidates = queryRecords<{
      id: string;
      local_uri: string;
      photo_url: string;
      job_id: string;
    }>('inspection_photos', {});

    // Filter in JS — queryRecords uses simple equality matching so we do
    // the richer checks (LIKE, date compare) manually. The set is small.
    const uploaded = candidates.filter(
      r => r.local_uri &&
           r.photo_url &&
           r.photo_url.startsWith('https://')
    );

    if (uploaded.length === 0) return;

    // Get the unique job IDs and check their completion date
    const jobIds = [...new Set(uploaded.map(r => r.job_id))];
    const eligibleJobIds = new Set<string>();

    for (const jobId of jobIds) {
      const job = queryRecords<{ id: string; status: string; updated_at: string }>(
        'jobs', { id: jobId }
      )[0];
      if (!job) continue;
      // Only clean up photos for completed/cancelled jobs older than the retention window
      const isEligibleStatus = job.status === 'completed' || job.status === 'cancelled';
      const isOldEnough      = job.updated_at < cutoffDate;
      if (isEligibleStatus && isOldEnough) {
        eligibleJobIds.add(jobId);
      }
    }

    if (eligibleJobIds.size === 0) return;

    const toClean = uploaded.filter(r => eligibleJobIds.has(r.job_id));
    let deletedCount = 0;

    // Delete in small concurrent batches rather than one file at a time —
    // on large sites (1000+ photos) a sequential loop here delays the end
    // of every sync cycle. Uses the same concurrency as photo uploads.
    for (let i = 0; i < toClean.length; i += UPLOAD_CONCURRENCY) {
      const batch = toClean.slice(i, i + UPLOAD_CONCURRENCY);
      await Promise.all(batch.map(async (photo) => {
        try {
          const localPath = getValidLocalUri(photo.local_uri);
          const info = await FileSystem.getInfoAsync(localPath);
          if (info.exists) {
            await FileSystem.deleteAsync(localPath, { idempotent: true });
            deletedCount++;
          }
        } catch (e) {
          // File already gone or path invalid — not a problem, just clear the column
          if (__DEV__) console.warn(`[PhotoCleanup] Could not delete ${photo.local_uri}:`, e);
        }
        // Regardless of whether the file existed, clear local_uri so we don't
        // attempt deletion again on the next sync cycle.
        updateRecord('inspection_photos', photo.id, { local_uri: null });
      }));
    }

    if (deletedCount > 0 && __DEV__) {
      console.log(
        `[PhotoCleanup] Deleted ${deletedCount} local photo file(s) for ${
          eligibleJobIds.size
        } completed job(s) older than ${LOCAL_PHOTO_RETENTION_DAYS} days`
      );
    }
  } catch (err) {
    // Never crash the sync cycle — cleanup is best-effort
    console.warn('[PhotoCleanup] cleanupLocalPhotos error:', err);
  }
}

