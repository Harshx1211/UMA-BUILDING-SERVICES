// store/defectsStore.ts — Zustand store for defects with offline-first SQLite persistence
import { create } from 'zustand';
import type { Defect } from '@/types';
import {
  getDefectsForJob,
  insertRecord,
  updateRecord,
  deleteRecord,
  addToSyncQueue,
} from '@/lib/database';
import { DefectStatus, SyncOperation } from '@/constants/Enums';
import { generateUUID } from '@/utils/uuid';

// ─── State & Actions ──────────────────────────────────────
interface DefectsState {
  defects: Defect[];
  isLoading: boolean;
  isSaving: boolean;
  error: string | null;

  loadDefects: (jobId: string) => void;
  addDefect: (defect: Omit<Defect, 'id' | 'created_at' | 'status'>) => void;
  updateDefect: (defectId: string, updates: Partial<Defect>) => void;
  deleteDefect: (defectId: string) => void;
  clearError: () => void;
}

// ─── Helper — extract a message from an unknown catch value ─
function errorMessage(err: unknown): string {
  return err instanceof Error ? err.message : 'An unexpected error occurred.';
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
      // SQLite stores `photos` as a JSON string — normalise to string[]
      const normalised = records.map((d) => ({
        ...d,
        photos: typeof d.photos === 'string'
          ? (() => { try { return JSON.parse(d.photos as unknown as string) as string[]; } catch { return []; } })()
          : (d.photos ?? []),
      }));
      set({ defects: normalised, isLoading: false });
    } catch (err: unknown) {
      console.error('[DefectsStore] loadDefects error:', err);
      set({ error: errorMessage(err), isLoading: false });
    }
  },

  addDefect: (defectData) => {
    try {
      set({ isSaving: true, error: null });
      const id = generateUUID();
      const payload: Defect = {
        ...defectData,
        id,
        status: DefectStatus.Open,
        created_at: new Date().toISOString(),
      };

      // Serialise photos array to JSON string for SQLite
      const dbPayload = { ...payload, photos: JSON.stringify(payload.photos) };
      insertRecord('defects', dbPayload as Record<string, string | number | boolean | null>);
      addToSyncQueue('defects', id, SyncOperation.Insert, dbPayload as Record<string, string | number | boolean | null>);

      set((state) => ({
        defects: [payload, ...state.defects],
        isSaving: false,
      }));
    } catch (err: unknown) {
      console.error('[DefectsStore] addDefect error:', err);
      set({ error: errorMessage(err), isSaving: false });
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
