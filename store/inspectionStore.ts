import { create } from 'zustand';
import type { Asset, JobAsset } from '@/types';
import { getAssetsForProperty, queryRecords, queryRecordsIn, upsertRecord, addToSyncQueue, insertRecord, updateRecord, getJobById } from '@/lib/database';

import { SyncOperation, InspectionResult, DefectStatus, DefectSeverity } from '@/constants/Enums';
import { usePhotosStore } from '@/store/photosStore';
import { useAuthStore } from '@/store/authStore';
import { useDefectsStore } from '@/store/defectsStore';
import { generateUUID } from '@/utils/uuid';

// ─── Helper — extract a message from an unknown catch value ─
function errorMessage(err: unknown): string {
  return err instanceof Error ? err.message : 'An unexpected error occurred.';
}

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
  /** Returns true if the inspection meets completion criteria (has at least one Pass/Fail, all assets answered) */
  isInspectionComplete: () => boolean;
  reset: () => void;
  hardReset: () => void;
}



function calcProgress(assets: AssetWithResult[]) {
  return {
    total: assets.length,
    inspected: assets.filter(a => a.result !== null).length
  };
}

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

      const dbAssets = getAssetsForProperty<Asset>(job.property_id);
      const jobAssets = queryRecords<JobAsset>('job_assets', { job_id: jobId });
      const inspectionPhotos = queryRecords<{ asset_id: string; photo_url: string }>(
        'inspection_photos', { job_id: jobId }
      );

      // Load previous results ONLY for assets in this property — avoids scanning the
      // entire job_assets table (HIGH-4: was O(all_records), now O(property_assets))
      const assetIds = dbAssets.map(a => a.id);
      const allPreviousJobAssets = queryRecordsIn<{
        asset_id: string; result: string; actioned_at: string; job_id: string;
      }>('job_assets', 'asset_id', assetIds);


      const merged: AssetWithResult[] = dbAssets.map(asset => {
        const ja = jobAssets.find(j => j.asset_id === asset.id);
        const photosForAsset = inspectionPhotos
          .filter(p => p.asset_id === asset.id)
          .map(p => p.photo_url);

        // Find the most recent result for this asset from a DIFFERENT job
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

  updateAssetResult: (assetId, result, checklistData, isCompliant, defectReason, notes, photos, severity, defectCode, quotePrice) => {
    try {
      set({ isSaving: true, error: null });
      const { assets, currentJobId } = get();
      if (!currentJobId) throw new Error('No active job');

      const assetIndex = assets.findIndex(a => a.id === assetId);
      if (assetIndex === -1) throw new Error('Asset not found');
      const asset = assets[assetIndex];

      // Determine if this is a new record or an update (re-inspection)
      const isExistingRecord = Boolean(asset.job_asset_id);
      const jobAssetId = asset.job_asset_id || generateUUID();

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
      // Use Update if record already existed to avoid Supabase duplicate-key error
      const syncOp = isExistingRecord ? SyncOperation.Update : SyncOperation.Insert;
      addToSyncQueue('job_assets', jobAssetId, syncOp, jobAssetPayload);

      // Auto-create defect for failed assets
      if (result === InspectionResult.Fail && defectReason) {
        const existingDefects = queryRecords<{ id: string }>('defects', { job_id: currentJobId, asset_id: assetId });
        if (existingDefects.length === 0) {
          const defectId = generateUUID();
          // BUG 5 FIX: use passed severity (default Major) and photos array
          const resolvedSeverity = severity ?? DefectSeverity.Major;
          const resolvedPhotos = photos && photos.length > 0 ? JSON.stringify(photos) : '[]';
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
          // Refresh defects store so the Defects tab badge updates immediately
          useDefectsStore.getState().loadDefects(currentJobId);
        } else {
          // Update existing defect with any new reason/severity
          const existingId = existingDefects[0].id;
          const updates = {
            description: defectReason,
            severity: severity ?? DefectSeverity.Major,
          };
          updateRecord('defects', existingId, updates);
          addToSyncQueue('defects', existingId, SyncOperation.Update, updates);
        }
      }

        const newAssets = [...assets];
      newAssets[assetIndex] = {
        ...asset,
        result,
        checklist_data: checklistData ?? null,
        is_compliant: isCompliant ?? false,
        defect_reason: defectReason ?? null,
        technician_notes: notes ?? null,
        job_asset_id: jobAssetId,
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

    // BUG 34 FIX: only save photo if user is authenticated
    const userId = useAuthStore.getState().user?.id;
    if (!userId) {
      console.warn('[InspectionStore] addPhotoToAsset: no authenticated user — skipping photo save');
      return;
    }

    // Save to persistent db via photo store
    usePhotosStore.getState().addPhoto({
      job_id: currentJobId,
      asset_id: assetId,
      photo_url: photoUri,
      caption: null,
      uploaded_by: userId,
    });

    const newAssets = assets.map(a => {
      if (a.id === assetId) {
        return { ...a, photos: [...(a.photos), photoUri] };
      }
      return a;
    });
    set({ assets: newAssets });
  },

  isInspectionComplete: () => {
    // Requires at least one Pass or Fail — all N/T is not a valid completed inspection
    const { assets } = get();
    const hasActualResult = assets.some(
      a => a.result === InspectionResult.Pass || a.result === InspectionResult.Fail
    );
    const allAnswered = assets.length > 0 && assets.every(a => a.result !== null);
    return allAnswered && hasActualResult;
  },

  reset: () => {
    // BUG 3 FIX: only clear transient state — do not wipe currentJobId/assets
    // so navigating away and back does not show blank state until DB reload
    set({
      isSaving: false,
      error: null,
    });
  },

  /** Hard-reset for when the user fully exits the inspection (e.g. job complete or cancel) */
  hardReset: () => {
    set({
      assets: [],
      currentJobId: null,
      error: null,
      progress: { inspected: 0, total: 0 },
    });
  },
}));
