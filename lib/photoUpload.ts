import { supabase } from '@/lib/supabase';
import { addToSyncQueue, getPendingSyncItems, markSyncItemComplete, updateRecord, openDatabase } from '@/lib/database';
import { SyncOperation } from '@/constants/Enums';
import * as FileSystem from 'expo-file-system/legacy';

export async function uploadPhoto(localUri: string, jobId: string, assetId?: string): Promise<string | null> {
  try {
    const timestamp = new Date().getTime();
    const random = Math.random().toString(36).substring(7);
    const fileName = `${timestamp}-${random}.jpg`;
    const filePath = `jobs/${jobId}/${fileName}`;

    const session = await supabase.auth.getSession();
    const token = session.data.session?.access_token;
    const anonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || '';
    const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL || '';

    const uploadUrl = `${supabaseUrl}/storage/v1/object/job-photos/${filePath}`;

    // Fix: Use native FileSystem upload to bypass React Native fetch/blob 'Network request failed' issues
    const uploadResult = await FileSystem.uploadAsync(uploadUrl, localUri, {
      httpMethod: 'POST',
      uploadType: FileSystem.FileSystemUploadType.BINARY_CONTENT,
      headers: {
        Authorization: `Bearer ${token || anonKey}`,
        apikey: anonKey,
        'Content-Type': 'image/jpeg',
        'x-upsert': 'true',
      },
    });

    if (uploadResult.status !== 200) {
      throw new Error(`Upload failed with status ${uploadResult.status}: ${uploadResult.body}`);
    }

    const { data: { publicUrl } } = supabase.storage
      .from('job-photos')
      .getPublicUrl(filePath);

    return publicUrl;
  } catch (err) {
    console.error('[PhotoUpload] Error uploading photo:', err);
    return null;
  }
}

export async function queuePhotoUpload(localUri: string, jobId: string, assetId?: string, recordId?: string): Promise<void> {
  // `recordId` is the SQLite inspection_photos id
  const payload = { localUri, jobId, assetId, recordId };
  // Add to sync queue with 'photo_upload' operation
  addToSyncQueue('inspection_photos', recordId || 'new', 'photo_upload' as any, payload as any);
}

export async function processPhotoQueue(): Promise<void> {
  try {
    const pending = getPendingSyncItems();
    const photoTasks = pending.filter(i => i.operation === ('photo_upload' as any));

    for (const task of photoTasks) {
      const payload = JSON.parse(task.payload);
      
      if (__DEV__) console.log(`[PhotoUpload] Processing queued photo for job ${payload.jobId}`);
      const publicUrl = await uploadPhoto(payload.localUri, payload.jobId, payload.assetId);

      if (publicUrl && payload.recordId) {
        // 1. Update the SQLite record with the public URL
        updateRecord('inspection_photos', payload.recordId, { photo_url: publicUrl });

        // BUG 8/18 FIX: insert the Supabase row NOW with the public URL
        // (photosStore intentionally does NOT queue a SyncOperation.Insert for the file:// path)
        addToSyncQueue('inspection_photos', payload.recordId, SyncOperation.Insert, {
          id: payload.recordId,
          job_id: payload.jobId,
          asset_id: payload.assetId ?? null,
          photo_url: publicUrl,
          uploaded_at: new Date().toISOString(),
        });

        // Mark the upload task complete so it doesn't retry
        markSyncItemComplete(task.id);
        if (__DEV__) console.log(`[PhotoUpload] Photo uploaded successfully: ${publicUrl}`);
      } else {
        if (__DEV__) console.log(`[PhotoUpload] Failed to upload photo, will retry later.`);
        // Leave in queue for retry — do NOT mark complete
      }
    }
  } catch (err) {
    console.error('[PhotoUpload] processPhotoQueue error:', err);
  }
}

export async function processDefectPhotos(): Promise<void> {
  try {
    const pending = getPendingSyncItems();
    const defectTasks = pending.filter(i => i.table_name === 'defects' && i.payload.includes('"file://'));

    if (defectTasks.length === 0) return;

    const db = openDatabase();

    for (const task of defectTasks) {
      const payload = JSON.parse(task.payload);
      if (typeof payload.photos === 'string' && payload.photos.includes('"file://')) {
        let photosArr: string[] = [];
        try {
          photosArr = JSON.parse(payload.photos);
        } catch { }

        let changed = false;
        const newPhotosArr: string[] = [];

        for (const uri of photosArr) {
          if (uri.startsWith('file://')) {
            if (__DEV__) console.log(`[PhotoUpload] Uploading defect photo: ${uri}`);
            const publicUrl = await uploadPhoto(uri, payload.job_id, payload.asset_id ?? 'unlinked');
            if (publicUrl) {
              newPhotosArr.push(publicUrl);
              changed = true;
            } else {
              newPhotosArr.push(uri);
            }
          } else {
            newPhotosArr.push(uri);
          }
        }

        if (changed) {
          payload.photos = JSON.stringify(newPhotosArr);

          // Update the SQLite defects record with the new URL array
          updateRecord('defects', task.record_id, { photos: payload.photos });

          // Update the sync queue payload so it pushes the remote URLs
          db.runSync(`UPDATE sync_queue SET payload = ? WHERE id = ?`, [JSON.stringify(payload), task.id]);
        }
      }
    }
  } catch (err) {
    console.error('[PhotoUpload] processDefectPhotos error:', err);
  }
}
