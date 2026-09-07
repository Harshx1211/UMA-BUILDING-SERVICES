/**
 * lib/documentUpload.ts
 *
 * Uploads locally-scanned site documents (PDFs) to Supabase Storage and
 * keeps the local SQLite `site_documents` record in sync with the resulting
 * public URL. Mirrors lib/photoUpload.ts's pipeline exactly — same PUT-based
 * expo-file-system upload, same 'document_upload' non-enum sync-queue escape
 * hatch (see lib/sync.ts's _pushQueue(), which only special-cases
 * Insert/Update/Delete/ReportGenerate and deliberately leaves anything else,
 * including this, for its own dedicated processor).
 */

import { supabase } from '@/lib/supabase';
import {
  addToSyncQueue,
  getPendingSyncItems,
  markSyncItemComplete,
  updateRecord,
  getRecord,
  incrementSyncRetry,
} from '@/lib/database';
import { SyncOperation } from '@/constants/Enums';
import { DOCUMENT_BUCKET } from '@/constants/Config';
import * as FileSystem from 'expo-file-system/legacy';
import { getValidLocalUri } from '@/utils/fileHelpers';

/** Max concurrent document binary uploads per sync cycle */
const UPLOAD_CONCURRENCY = 3;
/** Max retries before a document upload task is permanently abandoned (mirrors photo limit) */
const MAX_DOCUMENT_RETRIES = 5;

// ─── Upload a single document to Supabase Storage ───────────────

/**
 * Uploads a local scanned-document PDF to Supabase Storage under
 * properties/{propertyId}/{filename}.pdf.
 *
 * @returns Public URL string on success, null on failure
 */
export async function uploadDocument(
  localUri: string,
  propertyId: string,
): Promise<string | null> {
  try {
    const resolvedUri = getValidLocalUri(localUri);

    const timestamp = Date.now();
    const random    = Math.random().toString(36).substring(7);
    const fileName  = `${timestamp}-${random}.pdf`;
    const filePath  = `properties/${propertyId}/${fileName}`;

    const session  = await supabase.auth.getSession();
    const token    = session.data.session?.access_token;
    const anonKey  = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? '';
    const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL ?? '';

    if (!supabaseUrl) {
      throw new Error('[DocumentUpload] EXPO_PUBLIC_SUPABASE_URL is not set');
    }

    const uploadUrl = `${supabaseUrl}/storage/v1/object/${DOCUMENT_BUCKET}/${filePath}`;

    // PUT is required for Supabase Storage binary upserts — POST returns 405
    const uploadResult = await FileSystem.uploadAsync(uploadUrl, resolvedUri, {
      httpMethod: 'PUT',
      uploadType: FileSystem.FileSystemUploadType.BINARY_CONTENT,
      headers: {
        Authorization: `Bearer ${token ?? anonKey}`,
        apikey: anonKey,
        'Content-Type': 'application/pdf',
        'x-upsert': 'true',
      },
    });

    if (uploadResult.status !== 200 && uploadResult.status !== 201) {
      throw new Error(
        `[DocumentUpload] Upload failed (status ${uploadResult.status}): ${uploadResult.body}`,
      );
    }

    const { data: { publicUrl } } = supabase.storage
      .from(DOCUMENT_BUCKET)
      .getPublicUrl(filePath);

    return publicUrl;
  } catch (err) {
    console.error('[DocumentUpload] uploadDocument error:', err);
    return null;
  }
}

// ─── Queue a document upload for later processing ───────────────

/**
 * Adds a document upload task to the local sync queue.
 * Synchronous — `addToSyncQueue` is a synchronous SQLite write.
 *
 * @param localUri  Local file:// URI of the assembled PDF
 * @param propertyId Property the document belongs to
 * @param recordId  The site_documents SQLite row id (required to update after upload)
 * @param jobId     Job the document was captured during (optional)
 */
export function queueDocumentUpload(
  localUri: string,
  propertyId: string,
  recordId: string,
  jobId?: string,
): void {
  const payload = { localUri, propertyId, jobId: jobId ?? null, recordId };
  addToSyncQueue('site_documents', recordId, 'document_upload', payload);
}

// ─── Process the document upload queue ───────────────────────────

/**
 * Processes all pending document upload tasks from the sync queue.
 * Mirrors processPhotoQueue exactly — see lib/photoUpload.ts.
 */
export async function processDocumentQueue(currentUserId: string): Promise<void> {
  try {
    const pending       = getPendingSyncItems();
    const documentTasks = pending.filter(i => String(i.operation) === 'document_upload');

    if (documentTasks.length === 0) return;

    if (__DEV__) console.log(`[DocumentUpload] Processing ${documentTasks.length} queued document(s) in batches of ${UPLOAD_CONCURRENCY}`);

    if (!currentUserId) {
      if (__DEV__) console.warn('[DocumentUpload] No authenticated user — deferring document queue until next sync');
      return;
    }

    for (let i = 0; i < documentTasks.length; i += UPLOAD_CONCURRENCY) {
      const batch = documentTasks.slice(i, i + UPLOAD_CONCURRENCY);

      await Promise.all(batch.map(async task => {
        if ((task.retry_count ?? 0) >= MAX_DOCUMENT_RETRIES) {
          if (__DEV__) console.warn(`[DocumentUpload] Task ${task.id} has exceeded max retries — skipping permanently`);
          return;
        }

        let payload: {
          localUri: string;
          propertyId: string;
          recordId?: string;
          jobId?: string | null;
        };

        try {
          payload = JSON.parse(task.payload);
        } catch {
          console.warn('[DocumentUpload] Malformed task payload, skipping:', task.id);
          markSyncItemComplete(task.id);
          return;
        }

        if (__DEV__) console.log(`[DocumentUpload] Uploading document for property ${payload.propertyId}`);

        const publicUrl = await uploadDocument(payload.localUri, payload.propertyId);

        if (publicUrl && payload.recordId) {
          // FIX: mirrors lib/photoUpload.ts's equivalent fix — re-check the
          // local row still exists before queuing anything further.
          // documentsStore.deleteDocument() deletes the local row and
          // tombstones the id synchronously, with no awareness of an
          // upload already in flight, so without this check a document
          // deleted mid-upload would still get its Insert queued below and
          // permanently resurrected on the server.
          const stillExists = getRecord<{ id: string }>('site_documents', payload.recordId);
          if (!stillExists) {
            if (__DEV__) console.log(`[DocumentUpload] Document ${payload.recordId} was deleted during upload — discarding, not queuing Insert`);
            markSyncItemComplete(task.id);
            return;
          }

          updateRecord('site_documents', payload.recordId, { document_url: publicUrl });

          const localRow = getRecord<{
            title: string | null;
            company_id: string | null;
            job_id: string | null;
            page_count: number | null;
            uploaded_at: string | null;
          }>('site_documents', payload.recordId);

          addToSyncQueue('site_documents', payload.recordId, SyncOperation.Insert, {
            id:           payload.recordId,
            property_id:  payload.propertyId,
            job_id:       localRow?.job_id ?? payload.jobId ?? null,
            title:        localRow?.title ?? null,
            document_url: publicUrl,
            page_count:   localRow?.page_count ?? null,
            company_id:   localRow?.company_id ?? null,
            // FIX: mirrors lib/photoUpload.ts's equivalent fix — preserve
            // the true capture-time value already recorded locally instead
            // of stamping a fresh one at upload-completion time, which
            // could invert real order under concurrent uploads.
            uploaded_at:  localRow?.uploaded_at ?? new Date().toISOString(),
            uploaded_by:  currentUserId,
          });

          markSyncItemComplete(task.id);

          if (__DEV__) console.log(`[DocumentUpload] Uploaded: ${publicUrl}`);
        } else {
          if (__DEV__) console.log(`[DocumentUpload] Upload failed for task ${task.id} — will retry next cycle`);
          incrementSyncRetry(task.id, 'Upload failed');
        }
      }));
    }
  } catch (err) {
    console.error('[DocumentUpload] processDocumentQueue error:', err);
  }
}
