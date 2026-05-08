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
} from '@/lib/database';
import { SyncOperation } from '@/constants/Enums';
import * as FileSystem from 'expo-file-system/legacy';
import { getValidLocalUri } from '@/utils/fileHelpers';
import { useAuthStore } from '@/store/authStore';

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

    const uploadUrl = `${supabaseUrl}/storage/v1/object/job-photos/${filePath}`;

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
      .from('job-photos')
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
  const payload = { localUri, jobId, assetId, recordId, defectId };
  addToSyncQueue('inspection_photos', recordId, 'photo_upload' as any, payload as any);
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
export async function processPhotoQueue(): Promise<void> {
  try {
    const pending    = getPendingSyncItems();
    const photoTasks = pending.filter(i => i.operation === ('photo_upload' as any));

    if (photoTasks.length === 0) return;

    if (__DEV__) console.log(`[PhotoUpload] Processing ${photoTasks.length} queued photo(s) in batches of ${UPLOAD_CONCURRENCY}`);

    // H1: Guard — don't attempt photo sync without a valid user ID.
    // An empty uploaded_by value causes Supabase FK constraint failures silently.
    const currentUserId = useAuthStore.getState().user?.id;
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

          // Read caption from the local SQLite row so it's included in the Supabase row.
          // Bug fix: caption was previously omitted, causing captions to be local-only.
          const localRow = getRecord<{ caption: string | null }>('inspection_photos', payload.recordId);

          // Insert the row into Supabase via sync queue.
          // uploaded_by is required — include it here so the Supabase constraint is satisfied.
          addToSyncQueue('inspection_photos', payload.recordId, SyncOperation.Insert, {
            id:          payload.recordId,
            job_id:      payload.jobId,
            asset_id:    payload.assetId ?? null,
            defect_id:   payload.defectId ?? null,
            photo_url:   publicUrl,
            caption:     localRow?.caption ?? null,
            uploaded_at: new Date().toISOString(),
            uploaded_by: currentUserId,
          });

          markSyncItemComplete(task.id);

          if (__DEV__) console.log(`[PhotoUpload] Uploaded: ${publicUrl}`);
        } else {
          if (__DEV__) console.log(`[PhotoUpload] Upload failed for task ${task.id} — will retry next cycle`);
          // Leave in queue — do NOT mark complete
        }
      }));
    }
  } catch (err) {
    console.error('[PhotoUpload] processPhotoQueue error:', err);
  }
}
