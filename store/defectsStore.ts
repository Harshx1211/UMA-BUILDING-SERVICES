// store/defectsStore.ts — Zustand store for defects with offline-first SQLite persistence
import { create } from 'zustand';
import type { Defect } from '@/types';
import {
  getDefectsForJob,
  getAllDefects,
  insertRecord,
  updateRecord,
  deleteRecord,
  addToSyncQueue,
} from '@/lib/database';
import { DefectStatus, SyncOperation } from '@/constants/Enums';
import { generateUUID } from '@/utils/uuid';
import { queuePhotoUpload } from '@/lib/photoUpload';
import { useAuthStore } from '@/store/authStore';

// ─── State & Actions ──────────────────────────────────────
interface DefectsState {
  defects: Defect[];
  isLoading: boolean;
  isSaving: boolean;
  error: string | null;

  loadDefects: (jobId: string) => void;
  loadAllDefects: (statusFilter?: string) => void;
  addDefect: (defect: Omit<Defect, 'id' | 'created_at' | 'status'>) => string | null;
  updateDefect: (defectId: string, updates: Partial<Defect>) => void;
  updateDefectStatus: (defectId: string, status: DefectStatus) => void;
  deleteDefect: (defectId: string) => void;
  clearError: () => void;
}

// ─── Helper — extract a message from an unknown catch value ─
function errorMessage(err: unknown): string {
  return err instanceof Error ? err.message : 'An unexpected error occurred.';
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
      const id = generateUUID();
      
      const { photos, ...defectWithoutPhotos } = defectData;

      const payload: Defect = {
        ...defectWithoutPhotos,
        photos: photos || [], // keep for memory
        id,
        status: DefectStatus.Open,
        created_at: new Date().toISOString(),
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

      // If photos array is updated, serialise before writing to SQLite
      const dbUpdates: Record<string, string | number | boolean | null> = {
        ...(updates as Record<string, string | number | boolean | null>),
        ...(updates.photos !== undefined
          ? { photos: JSON.stringify(updates.photos) }
          : {}),
      };

      updateRecord('defects', defectId, dbUpdates);
      addToSyncQueue('defects', defectId, SyncOperation.Update, dbUpdates);

      set((state) => ({
        defects: state.defects.map((d) =>
          d.id === defectId ? { ...d, ...updates } : d
        ),
        isSaving: false,
      }));
    } catch (err: unknown) {
      console.error('[DefectsStore] updateDefect error:', err);
      set({ error: errorMessage(err), isSaving: false });
    }
  },

  updateDefectStatus: (defectId, status) => {
    try {
      const dbUpdates = { status, updated_at: new Date().toISOString() };
      updateRecord('defects', defectId, dbUpdates);
      addToSyncQueue('defects', defectId, SyncOperation.Update, dbUpdates);

      set((state) => ({
        defects: state.defects.map((d) =>
          d.id === defectId ? { ...d, status } : d
        ),
      }));
    } catch (err: unknown) {
      console.error('[DefectsStore] updateDefectStatus error:', err);
      set({ error: errorMessage(err) });
    }
  },

  deleteDefect: (defectId) => {
    try {
      set({ isSaving: true, error: null });

      deleteRecord('defects', defectId);
      addToSyncQueue('defects', defectId, SyncOperation.Delete, { id: defectId });

      set((state) => ({
        defects: state.defects.filter((d) => d.id !== defectId),
        isSaving: false,
      }));
    } catch (err: unknown) {
      console.error('[DefectsStore] deleteDefect error:', err);
      set({ error: errorMessage(err), isSaving: false });
    }
  },

  clearError: () => set({ error: null }),
}));
