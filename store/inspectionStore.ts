/**
 * store/inspectionStore.ts
 *
 * Fix summary (this revision):
 *   1. updateAssetResult: photos[] now written to the in-memory asset after a FAIL result.
 *      Previously photos were inserted into inspection_photos + queued for upload, but the
 *      in-memory AssetWithResult.photos array was never updated. This caused getReferencedPhotoIds
 *      in pdfGenerator to correctly include the asset, but loadAssetsForInspection had to be
 *      called again to see the photos — meaning a PDF generated in the same session as the
 *      inspection would always have blank photo slots for fail assets.
 *
 *   2. updateAssetResult: when updating an existing defect, photos are now also re-queued
 *      so a re-inspection with new photos doesn't silently drop them.
 *
 *   3. addPhotoToAsset: passes defect_id: null explicitly to queuePhotoUpload via photosStore
 *      (no change to behaviour, just made explicit for clarity).
 *
 *   4. Minor: consistent null coalescing, removed a stray indent on newAssets declaration.
 */

import { create } from 'zustand';
import type { Asset, JobAsset } from '@/types';
import {
  getAssetsForProperty,
  queryRecords,
  queryRecordsIn,
  upsertRecord,
  addToSyncQueue,
  insertRecord,
  updateRecord,
  deleteRecord,
  getJobById,
  cancelPendingPhotoUpload,
  recordDeletedPhoto,
  openDatabase,
} from '@/lib/database';
import { SyncOperation, InspectionResult, DefectStatus, DefectSeverity } from '@/constants/Enums';
import { usePhotosStore } from '@/store/photosStore';
import { useAuthStore } from '@/store/authStore';
import { useDefectsStore } from '@/store/defectsStore';
import { generateUUID } from '@/utils/uuid';
import { queuePhotoUpload } from '@/lib/photoUpload';

// ─── Helper ───────────────────────────────────────────────────
function errorMessage(err: unknown): string {
  return err instanceof Error ? err.message : 'An unexpected error occurred.';
}

// ─── Types ────────────────────────────────────────────────────

export type AssetWithResult = Asset & {
  result: InspectionResult | null;
  checklist_data: string | null;
  is_compliant: boolean;
  defect_reason: string | null;
  technician_notes: string | null;
  job_asset_id: string | null;
  photos: string[];
  previousResult: InspectionResult | null;
  previousDate: string | null;
};

interface InspectionState {
  assets: AssetWithResult[];
  currentJobId: string | null;
  isLoading: boolean;
  isSaving: boolean;
  error: string | null;
  progress: { inspected: number; total: number };

  loadAssetsForInspection: (jobId: string) => void;
  updateAssetResult: (
    assetId: string,
    result: InspectionResult | null,
    checklistData?: string,
    isCompliant?: boolean,
    defectReason?: string,
    notes?: string,
    photos?: string[],
    severity?: DefectSeverity,
    defectCode?: string | null,
    quotePrice?: number | null,
  ) => void;
  addPhotoToAsset: (assetId: string, photoUri: string) => void;
  isInspectionComplete: () => boolean;
  reset: () => void;
  hardReset: () => void;
}

// ─── Helpers ──────────────────────────────────────────────────

function calcProgress(assets: AssetWithResult[]) {
  return {
    total: assets.length,
    inspected: assets.filter(a => a.result !== null).length,
  };
}

// ─── Store ────────────────────────────────────────────────────

export const useInspectionStore = create<InspectionState>((set, get) => ({
  assets: [],
  currentJobId: null,
  isLoading: false,
  isSaving: false,
  error: null,
  progress: { inspected: 0, total: 0 },

  loadAssetsForInspection: (jobId) => {
    try {
      set({ isLoading: true, error: null, currentJobId: jobId });

      const job = getJobById<{ property_id: string }>(jobId);
      if (!job) throw new Error('Job not found');

      const dbAssets         = getAssetsForProperty<Asset>(job.property_id);
      const jobAssets        = queryRecords<JobAsset>('job_assets', { job_id: jobId });
      const inspectionPhotos = queryRecords<{ asset_id: string; photo_url: string }>(
        'inspection_photos', { job_id: jobId }
      );

      // Load previous results only for assets in this property (avoids full table scan)
      const assetIds = dbAssets.map(a => a.id);
      const allPreviousJobAssets = queryRecordsIn<{
        asset_id: string; result: string; actioned_at: string; job_id: string;
      }>('job_assets', 'asset_id', assetIds);

      const merged: AssetWithResult[] = dbAssets.map(asset => {
        const ja = jobAssets.find(j => j.asset_id === asset.id);
        const photosForAsset = inspectionPhotos
          .filter(p => p.asset_id === asset.id)
          .map(p => p.photo_url);

        const prevRecords = allPreviousJobAssets
          .filter(r => r.asset_id === asset.id && r.job_id !== jobId && r.result != null)
          .sort((a, b) => (b.actioned_at ?? '').localeCompare(a.actioned_at ?? ''));
        const prev = prevRecords[0] ?? null;

        return {
          ...asset,
          result: ja?.result ?? null,
          checklist_data: ja?.checklist_data ?? null,
          is_compliant: Boolean(ja?.is_compliant),
          defect_reason: ja?.defect_reason ?? null,
          technician_notes: ja?.technician_notes ?? null,
          job_asset_id: ja?.id ?? null,
          photos: photosForAsset,
          previousResult: prev ? (prev.result as InspectionResult) : null,
          previousDate: prev?.actioned_at ? prev.actioned_at.slice(0, 10) : null,
        };
      });

      set({ assets: merged, progress: calcProgress(merged), isLoading: false });
    } catch (err: unknown) {
      set({ error: errorMessage(err), isLoading: false });
    }
  },

  updateAssetResult: (
    assetId, result, checklistData, isCompliant,
    defectReason, notes, photos, severity, defectCode, quotePrice,
  ) => {
    try {
      set({ isSaving: true, error: null });
      const { assets, currentJobId } = get();
      if (!currentJobId) throw new Error('No active job');

      const assetIndex = assets.findIndex(a => a.id === assetId);
      if (assetIndex === -1) throw new Error('Asset not found');
      const asset = assets[assetIndex];

      // Resolve the job_asset id — prefer the in-memory one (fastest path), then fall
      // back to a DB lookup.  This prevents duplicate rows when the modal is saved
      // before the in-memory state has been refreshed with the newly-assigned id.
      let jobAssetId = asset.job_asset_id;
      if (!jobAssetId) {
        const existing = queryRecords<{ id: string }>(
          'job_assets', { job_id: currentJobId, asset_id: assetId }
        )[0];
        jobAssetId = existing?.id ?? generateUUID();
      }
      const isExistingRecord = Boolean(asset.job_asset_id) ||
        queryRecords('job_assets', { job_id: currentJobId, asset_id: assetId }).length > 0;

      const jobAssetPayload: Record<string, string | number | null> = {
        id: jobAssetId,
        job_id: currentJobId,
        asset_id: assetId,
        result: result ?? null,
        checklist_data: checklistData ?? null,
        is_compliant: isCompliant ? 1 : 0,
        defect_reason: defectReason ?? null,
        technician_notes: notes ?? null,
        actioned_at: new Date().toISOString(),
      };

      upsertRecord('job_assets', jobAssetPayload);

      // Purge any duplicate rows for this asset+job that have a different id.
      // These can accumulate from rapid taps before the first save completes.
      try {
        const db = openDatabase();
        db.runSync(
          `DELETE FROM job_assets WHERE job_id = ? AND asset_id = ? AND id != ?`,
          [currentJobId, assetId, jobAssetId],
        );
      } catch { /* non-fatal */ }

      const syncOp = isExistingRecord ? SyncOperation.Update : SyncOperation.Insert;
      addToSyncQueue('job_assets', jobAssetId, syncOp, jobAssetPayload);


      // ── Photo reconciliation ────────────────────────────────────────────────
      // `photos` is the FINAL desired set of URIs the user left in the modal.
      // We diff it against what is currently in SQLite:
      //   • Deleted photos  → remove from SQLite immediately.
      //                       If the photo was already uploaded (https://) → also
      //                       queue a Supabase DB row delete + Storage binary delete.
      //                       If still local (file://) → cancel the pending
      //                       photo_upload task so it never reaches Supabase.
      //   • Kept photos     → leave as-is (preserve upload state).
      //   • New photos      → insert into SQLite and queue for upload.
      const userId = useAuthStore.getState().user?.id ?? '';
      let savedPhotoUris: string[] = []; // newly-inserted URIs (for defect back-fill)

      if (photos !== undefined) {
        const existingRows = queryRecords<{ id: string; photo_url: string }>(
          'inspection_photos',
          { job_id: currentJobId, asset_id: assetId },
        );

        const desiredUrlSet  = new Set(photos);
        const existingUrlSet = new Set(existingRows.map(r => r.photo_url));

        // ── Deletions ────────────────────────────────────────────────────────
        for (const row of existingRows) {
          if (!desiredUrlSet.has(row.photo_url)) {
            // 1. Remove from local SQLite immediately
            deleteRecord('inspection_photos', row.id);

            // 2. Permanently record in tombstone — survives retries/reinstalls
            recordDeletedPhoto(row.id);

            if (row.photo_url.startsWith('https://')) {
              // Photo is already in Supabase — queue a delete for both the DB row
              // and the Storage binary (sync.ts _pushQueue handles both).
              addToSyncQueue('inspection_photos', row.id, SyncOperation.Delete, {
                id: row.id,
                photo_url: row.photo_url,
              });
            } else {
              // Photo only exists locally (file:// URI, not yet uploaded).
              // Cancel the pending photo_upload task so it is never sent to Supabase.
              // No Supabase row exists yet, so no DB delete is needed.
              cancelPendingPhotoUpload(row.id);
            }
          }
        }

        // ── Insertions ────────────────────────────────────────────────────────
        const newPhotoUris = photos.filter(uri => !existingUrlSet.has(uri));
        savedPhotoUris = newPhotoUris;

        for (const uri of newPhotoUris) {
          const photoId = generateUUID();
          const photoObj = {
            id: photoId,
            job_id: currentJobId,
            asset_id: assetId,
            defect_id: null as string | null,
            photo_url: uri,
            caption: null,
            uploaded_at: new Date().toISOString(),
            uploaded_by: userId,
          };
          insertRecord('inspection_photos', photoObj as unknown as Record<string, string | number | boolean | null>);
          queuePhotoUpload(uri, currentJobId, assetId, photoId, undefined);
        }
      }

      // ── Auto-delete defect when asset passes / not-tested ─
      // If the previous result was Fail and the new result is Pass or NotTested,
      // the defect is no longer valid — remove it automatically.
      if (result !== InspectionResult.Fail) {
        const staleDefects = queryRecords<{ id: string }>('defects', {
          job_id: currentJobId,
          asset_id: assetId,
        });
        for (const stale of staleDefects) {
          deleteRecord('defects', stale.id);
          addToSyncQueue('defects', stale.id, SyncOperation.Delete, { id: stale.id });
        }
        if (staleDefects.length > 0) {
          // Refresh defects store so the badge and list update immediately
          useDefectsStore.getState().loadDefects(currentJobId);
        }
      }

      // ── Defect auto-create / update ───────────────────────
      if (result === InspectionResult.Fail && defectReason) {
        const existingDefects = queryRecords<{ id: string }>('defects', {
          job_id: currentJobId,
          asset_id: assetId,
        });

        if (existingDefects.length === 0) {
          const defectId = generateUUID();
          const resolvedSeverity = severity ?? DefectSeverity.Major;
          const resolvedPhotos = savedPhotoUris.length > 0
            ? JSON.stringify(savedPhotoUris)
            : '[]';

          const defectPayload: Record<string, string | number | null> = {
            id: defectId,
            job_id: currentJobId,
            asset_id: assetId,
            property_id: asset.property_id,
            description: defectReason,
            severity: resolvedSeverity,
            status: DefectStatus.Open,
            photos: resolvedPhotos,
            created_at: new Date().toISOString(),
            defect_code: defectCode ?? null,
            quote_price: quotePrice ?? null,
          };
          insertRecord('defects', defectPayload);
          addToSyncQueue('defects', defectId, SyncOperation.Insert, defectPayload);

          // Back-fill defect_id on the inspection_photos rows we just inserted
          // so pdfGenerator can correctly link them to the defect box in the report.
          if (savedPhotoUris.length > 0) {
            const recentPhotos = queryRecords<{ id: string; photo_url: string }>(
              'inspection_photos',
              { job_id: currentJobId, asset_id: assetId },
            );
            for (const p of recentPhotos) {
              if (savedPhotoUris.includes(p.photo_url)) {
                updateRecord('inspection_photos', p.id, { defect_id: defectId });
              }
            }
          }

          // Refresh defects store so the badge updates immediately
          useDefectsStore.getState().loadDefects(currentJobId);
        } else {
          // Update existing defect description/severity and reconcile photos
          const existingId = existingDefects[0].id;
          const updates: Record<string, string | number | null> = {
            description: defectReason,
            severity: severity ?? DefectSeverity.Major,
          };

          // Replace defect.photos with the COMPLETE current desired set.
          // Using the full desired photos array (not just new ones) ensures that:
          //   • Photos deleted by the user are removed from the defect record.
          //   • New photos are added to the defect record.
          //   • Previously saved photos that the user kept are preserved.
          if (photos !== undefined) {
            updates.photos = JSON.stringify(photos);
          }

          // Back-fill defect_id on newly inserted inspection_photos rows
          if (savedPhotoUris.length > 0) {
            const recentPhotos = queryRecords<{ id: string; photo_url: string }>(
              'inspection_photos',
              { job_id: currentJobId, asset_id: assetId },
            );
            for (const p of recentPhotos) {
              if (savedPhotoUris.includes(p.photo_url)) {
                updateRecord('inspection_photos', p.id, { defect_id: existingId });
              }
            }
          }

          updateRecord('defects', existingId, updates);
          addToSyncQueue('defects', existingId, SyncOperation.Update, updates);
        }
      }

      // ── Update in-memory state ─────────────────────────────
      // Set in-memory photos to exactly what is currently in SQLite after reconciliation.
      // This is critical: using an additive merge (old + new) means deleted photos
      // remain in memory and get passed back into the modal the next time it opens,
      // causing them to be re-saved as if the user kept them.
      const finalPhotoUris = photos !== undefined
        ? photos  // the modal's desired set IS the final set
        : asset.photos;

      const newAssets = [...assets];
      newAssets[assetIndex] = {
        ...asset,
        result,
        checklist_data: checklistData ?? null,
        is_compliant: isCompliant ?? false,
        defect_reason: defectReason ?? null,
        technician_notes: notes ?? null,
        job_asset_id: jobAssetId,
        photos: finalPhotoUris,
      };

      set({
        assets: newAssets,
        progress: calcProgress(newAssets),
        isSaving: false,
      });
    } catch (err: unknown) {
      set({ error: errorMessage(err), isSaving: false });
    }
  },

  addPhotoToAsset: (assetId, photoUri) => {
    const { assets, currentJobId } = get();
    if (!currentJobId) return;

    const userId = useAuthStore.getState().user?.id;
    if (!userId) {
      console.warn('[InspectionStore] addPhotoToAsset: no authenticated user — skipping');
      return;
    }

    usePhotosStore.getState().addPhoto({
      job_id: currentJobId,
      asset_id: assetId,
      defect_id: null,
      photo_url: photoUri,
      caption: null,
      uploaded_by: userId,
    });

    const newAssets = assets.map(a =>
      a.id === assetId ? { ...a, photos: [...a.photos, photoUri] } : a
    );
    set({ assets: newAssets });
  },

  isInspectionComplete: () => {
    const { assets } = get();
    const hasActualResult = assets.some(
      a => a.result === InspectionResult.Pass || a.result === InspectionResult.Fail
    );
    const allAnswered = assets.length > 0 && assets.every(a => a.result !== null);
    return allAnswered && hasActualResult;
  },

  reset: () => {
    set({ isSaving: false, error: null });
  },

  hardReset: () => {
    set({
      assets: [],
      currentJobId: null,
      error: null,
      progress: { inspected: 0, total: 0 },
    });
  },
}));
