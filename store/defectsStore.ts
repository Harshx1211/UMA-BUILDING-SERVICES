// store/defectsStore.ts — Zustand store for defects with offline-first SQLite persistence
import { create } from 'zustand';
import type { Defect } from '@/types';
import {
  getDefectsForJob,
  getAllDefects,
  getJobById,
  getRecord,
  insertRecord,
  updateRecord,
  deleteRecord,
  addToSyncQueue,
  queryRecords,
  cancelPendingPhotoUpload,
  recordDeletedPhoto,
  logFieldAudit,
  reconcileJobAssetOnDefectDelete,
} from '@/lib/database';
import { DefectStatus, SyncOperation, JobStatus } from '@/constants/Enums';
import { generateUUID } from '@/utils/uuid';
import { queuePhotoUpload } from '@/lib/photoUpload';
import { useAuthStore } from '@/store/authStore';
import { syncNow } from '@/lib/sync';

// ─── State & Actions ──────────────────────────────────────
interface DefectsState {
  defects: Defect[];
  isLoading: boolean;
  isSaving: boolean;
  error: string | null;

  loadDefects: (jobId: string) => void;
  loadAllDefects: (statusFilter?: string) => void;
  addDefect: (defect: Omit<Defect, 'id' | 'created_at' | 'updated_at' | 'status' | 'company_id'>) => string | null;
  updateDefect: (defectId: string, updates: Partial<Defect>) => void;
  updateDefectStatus: (defectId: string, status: DefectStatus) => void;
  deleteDefect: (defectId: string) => void;
  clearError: () => void;
  reset: () => void;
}

// ─── Helper — extract a message from an unknown catch value ─
function errorMessage(err: unknown): string {
  return err instanceof Error ? err.message : 'An unexpected error occurred.';
}

// ─── Helper — reject any write against a locked job ────────
// FIX: addDefect already enforced "a completed/cancelled job's report is
// final" (the same invariant store/inspectionStore.ts's updateAssetResult
// uses) but updateDefect/updateDefectStatus/deleteDefect never checked this
// at all. Concretely reachable via asset/[assetId].tsx's leave-without-
// saving flush, which calls updateDefect on an in-progress additional-defect
// edit with no awareness the job locked mid-edit — that silently mutated a
// defect behind a report already treated as final. Looks the job up fresh
// via getRecord rather than trusting an in-memory `defects` array entry,
// since not every screen that calls these (e.g. defects/[defectId].tsx)
// necessarily keeps this defect inside useDefectsStore's own list.
function assertJobEditable(jobId: string | undefined | null): void {
  if (!jobId) return;
  const job = getJobById<{ status: string }>(jobId);
  if (job?.status === JobStatus.Completed) {
    throw new Error('This job is completed — tap "Continue Working" to make changes.');
  }
  if (job?.status === JobStatus.Cancelled) {
    throw new Error('This job has been cancelled and can no longer be edited.');
  }
}

// ─── Helper — normalise photos from SQLite JSON string ────
function normaliseDefects(records: Defect[]): Defect[] {
  return records.map((d) => ({
    ...d,
    photos: typeof d.photos === 'string'
      ? (() => { try { return JSON.parse(d.photos as unknown as string) as string[]; } catch { return []; } })()
      : (d.photos ?? []),
  }));
}

// ─── Store ────────────────────────────────────────────────
export const useDefectsStore = create<DefectsState>((set, get) => ({
  defects: [],
  isLoading: false,
  isSaving: false,
  error: null,

  loadDefects: (jobId) => {
    try {
      // BUG 26 FIX: clear previous job's defects before fetch so stale data doesn't flash
      set({ isLoading: true, error: null, defects: [] });
      const records = getDefectsForJob<Defect>(jobId);
      set({ defects: normaliseDefects(records), isLoading: false });
    } catch (err: unknown) {
      console.error('[DefectsStore] loadDefects error:', err);
      set({ error: errorMessage(err), isLoading: false });
    }
  },

  loadAllDefects: (statusFilter) => {
    try {
      set({ isLoading: true, error: null, defects: [] });
      const records = getAllDefects<Defect>(statusFilter);
      set({ defects: normaliseDefects(records), isLoading: false });
    } catch (err: unknown) {
      console.error('[DefectsStore] loadAllDefects error:', err);
      set({ error: errorMessage(err), isLoading: false });
    }
  },

  addDefect: (defectData) => {
    try {
      set({ isSaving: true, error: null });

      // Defense-in-depth: same "Continue Working is the only way back into edit
      // mode" invariant as store/inspectionStore.ts's updateAssetResult — a
      // completed job's report is treated as final.
      assertJobEditable(defectData.job_id);

      const id = generateUUID();

      const { photos, ...defectWithoutPhotos } = defectData;

      // FIX: inject company_id so the sync-queue INSERT satisfies Supabase RLS.
      const companyId = useAuthStore.getState().user?.company_id ?? null;

      const nowIso = new Date().toISOString();
      const payload: Defect = {
        ...defectWithoutPhotos,
        photos: photos || [], // keep for memory
        id,
        company_id: companyId,
        status: DefectStatus.Open,
        created_at: nowIso,
        updated_at: nowIso,
      };

      const dbPayload = {
        ...payload,
        photos: JSON.stringify(photos || []), // save actual photos to SQLite
        defect_code: payload.defect_code ?? null,
        quote_price: payload.quote_price ?? null,
      };

      insertRecord('defects', dbPayload as Record<string, string | number | boolean | null>);
      addToSyncQueue('defects', id, SyncOperation.Insert, dbPayload as Record<string, string | number | boolean | null>);

      const userId = useAuthStore.getState().user?.id ?? '';

      // A defect's Timeline should say when/by whom it first appeared, not
      // just show later edits — a synthetic entry, not a real field diff.
      logFieldAudit('defects', id, payload.job_id, companyId, userId || null, [
        { field: '_created', old: null, new: 'defect created' },
      ]);

      // Insert photos into inspection_photos and queue them
      if (photos && photos.length > 0) {
        for (const uri of photos) {
          const photoId = generateUUID();
          const photoObj = {
            id: photoId,
            job_id: payload.job_id,
            asset_id: payload.asset_id === 'unlinked' ? null : payload.asset_id,
            defect_id: id,
            photo_url: uri,
            local_uri: uri.startsWith('file://') || uri.startsWith('content://') ? uri : null,
            caption: null,
            uploaded_at: new Date().toISOString(),
            uploaded_by: userId,
          };
          insertRecord('inspection_photos', photoObj as unknown as Record<string, string | number | boolean | null>);
          queuePhotoUpload(uri, payload.job_id, photoObj.asset_id ?? undefined, photoId, id);
        }
      }

      set((state) => ({
        defects: [payload, ...state.defects],
        isSaving: false,
      }));

      // Push immediately so a crew-mate's inspect screen (which live-polls
      // defects for the job) picks this up in seconds, not on the next
      // background sync tick — same reasoning as inspectionStore.
      syncNow();

      return id;
    } catch (err: unknown) {
      console.error('[DefectsStore] addDefect error:', err);
      set({ error: errorMessage(err), isSaving: false });
      return null;
    }
  },

  updateDefect: (defectId, updates) => {
    try {
      set({ isSaving: true, error: null });

      // FIX: reject the write outright once the job's locked — see
      // assertJobEditable's own comment for why this was missing entirely.
      const currentRow = getRecord<{ job_id: string }>('defects', defectId);
      assertJobEditable(currentRow?.job_id);

      // Read the OLD row before any write touches it — the audit diff needs
      // this, and it must happen before updateRecord, not inside the set()
      // callback below (which only sees post-write in-memory state).
      const oldRow = get().defects.find((d) => d.id === defectId);

      // If photos array is updated, serialise before writing to SQLite
      // BUG-N10 FIX: inject company_id so UPDATE payload passes Supabase RLS on cold-start.
      const companyId = useAuthStore.getState().user?.company_id ?? null;
      const dbUpdates: Record<string, string | number | boolean | null> = {
        ...(updates as Record<string, string | number | boolean | null>),
        ...(updates.photos !== undefined
          ? { photos: JSON.stringify(updates.photos) }
          : {}),
        company_id: companyId,
        updated_at: new Date().toISOString(),
      };

      updateRecord('defects', defectId, dbUpdates);
      addToSyncQueue('defects', defectId, SyncOperation.Update, dbUpdates);

      if (oldRow) {
        const userId = useAuthStore.getState().user?.id ?? null;
        // Skip `photos` — it has its own dedicated UI already, a raw array
        // diff here would just be noise.
        const changes = (Object.keys(updates) as (keyof Defect)[])
          .filter((f) => f !== 'photos')
          .map((f) => ({ field: f, old: (oldRow as unknown as Record<string, unknown>)[f] ?? null, new: (updates as unknown as Record<string, unknown>)[f] ?? null }))
          .filter((c) => JSON.stringify(c.old) !== JSON.stringify(c.new));
        logFieldAudit('defects', defectId, oldRow.job_id, companyId, userId, changes);
      }

      set((state) => ({
        defects: state.defects.map((d) =>
          d.id === defectId ? { ...d, ...updates } : d
        ),
        isSaving: false,
      }));
      syncNow();
    } catch (err: unknown) {
      console.error('[DefectsStore] updateDefect error:', err);
      set({ error: errorMessage(err), isSaving: false });
    }
  },

  updateDefectStatus: (defectId, status) => {
    try {
      // FIX: same missing job-lock check as updateDefect — see
      // assertJobEditable's own comment.
      const currentRow = getRecord<{ job_id: string }>('defects', defectId);
      assertJobEditable(currentRow?.job_id);

      const oldRow = get().defects.find((d) => d.id === defectId);
      const companyId = useAuthStore.getState().user?.company_id ?? null;
      const dbUpdates = { status, updated_at: new Date().toISOString(), company_id: companyId };
      updateRecord('defects', defectId, dbUpdates);
      addToSyncQueue('defects', defectId, SyncOperation.Update, dbUpdates);

      if (oldRow && oldRow.status !== status) {
        const userId = useAuthStore.getState().user?.id ?? null;
        logFieldAudit('defects', defectId, oldRow.job_id, companyId, userId, [
          { field: 'status', old: oldRow.status, new: status },
        ]);
      }

      set((state) => ({
        defects: state.defects.map((d) =>
          d.id === defectId ? { ...d, status } : d
        ),
      }));
      syncNow();
    } catch (err: unknown) {
      console.error('[DefectsStore] updateDefectStatus error:', err);
      set({ error: errorMessage(err) });
    }
  },

  deleteDefect: (defectId) => {
    try {
      set({ isSaving: true, error: null });

      // FIX: same missing job-lock check as updateDefect — see
      // assertJobEditable's own comment. Looked up fresh rather than via
      // `defectRow` below (which comes from the in-memory store and may not
      // be populated depending on which screen called this).
      assertJobEditable(getRecord<{ job_id: string }>('defects', defectId)?.job_id);

      // Read before anything is deleted — need asset_id/job_id afterward to
      // check whether this was the asset's LAST defect (see clearOrphanedFail).
      const defectRow = get().defects.find((d) => d.id === defectId);

      // A4 FIX: Cancel / delete all inspection_photos associated with this defect
      // BEFORE deleting the defect row, so we don't leave orphaned upload tasks.
      const defectPhotos = queryRecords<{ id: string; photo_url: string; job_id: string }>(
        'inspection_photos', { defect_id: defectId }
      );
      for (const p of defectPhotos) {
        deleteRecord('inspection_photos', p.id);
        recordDeletedPhoto(p.id);
        if (p.photo_url.startsWith('https://')) {
          // FIX: job_id included so lib/sync.ts's report-generation blocker
          // check can see this pending Delete — its local-row lookup can
          // never resolve for a Delete (the row's gone by now), so it falls
          // back to a substring search over the payload, which a bare
          // {id, photo_url} payload gave it nothing to match.
          addToSyncQueue('inspection_photos', p.id, SyncOperation.Delete, {
            id: p.id,
            photo_url: p.photo_url,
            job_id: p.job_id,
          });
        } else {
          cancelPendingPhotoUpload(p.id);
        }
      }

      deleteRecord('defects', defectId);
      addToSyncQueue('defects', defectId, SyncOperation.Delete, { id: defectId, job_id: defectRow?.job_id ?? null });

      set((state) => ({
        defects: state.defects.filter((d) => d.id !== defectId),
        isSaving: false,
      }));

      // Reconciles job_assets after this delete: resets a now-defect-less
      // Fail back to not-inspected, or (if other defects remain) refreshes
      // defect_reason so it doesn't keep describing the one just deleted.
      // No-op if this defect was never linked to an asset or the asset
      // wasn't Fail.
      if (defectRow?.asset_id) {
        const companyId = useAuthStore.getState().user?.company_id ?? null;
        const userId = useAuthStore.getState().user?.id ?? null;
        reconcileJobAssetOnDefectDelete(defectRow.job_id, defectRow.asset_id, companyId, userId);
      }

      syncNow();
    } catch (err: unknown) {
      console.error('[DefectsStore] deleteDefect error:', err);
      set({ error: errorMessage(err), isSaving: false });
    }
  },

  clearError: () => set({ error: null }),

  reset: () => set({ defects: [], isLoading: false, isSaving: false, error: null }),
}));
