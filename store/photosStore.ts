// store/photosStore.ts — Zustand store for inspection photos with offline-first persistence
import { create } from 'zustand';
import type { InspectionPhoto } from '@/types';
import {
  getPhotosForJob,
  insertRecord,
  updateRecord,
  deleteRecord,
  addToSyncQueue,
  cancelPendingPhotoUpload,
  recordDeletedPhoto,
} from '@/lib/database';
import { SyncOperation } from '@/constants/Enums';
import { queuePhotoUpload } from '@/lib/photoUpload';
import { generateUUID } from '@/utils/uuid';

// ─── Helper — extract a message from an unknown catch value ─
function errorMessage(err: unknown): string {
  return err instanceof Error ? err.message : 'An unexpected error occurred.';
}

// ─── State & Actions ──────────────────────────────────────
interface PhotosState {
  photos: InspectionPhoto[];
  isLoading: boolean;
  error: string | null;

  loadPhotos: (jobId: string) => void;
  addPhoto: (photo: Omit<InspectionPhoto, 'id' | 'uploaded_at'>) => void;
  deletePhoto: (photoId: string) => void;
  updateCaption: (photoId: string, caption: string) => void;
  /** Number of photos still stored as local file:// URIs (pending upload) */
  getPendingCount: () => number;
  clearError: () => void;
}

// ─── Store ────────────────────────────────────────────────
export const usePhotosStore = create<PhotosState>((set, get) => ({
  photos: [],
  isLoading: false,
  error: null,

  loadPhotos: (jobId) => {
    try {
      set({ isLoading: true, error: null });
      const dbPhotos = getPhotosForJob<InspectionPhoto>(jobId);
      set({ photos: dbPhotos, isLoading: false });
    } catch (err: unknown) {
      console.error('[PhotosStore] loadPhotos error:', err);
      set({ error: errorMessage(err), isLoading: false });
    }
  },

  addPhoto: (photoData) => {
    try {
      const id = generateUUID();
      const newPhoto: InspectionPhoto = {
        ...photoData,
        id,
        uploaded_at: new Date().toISOString(),
      };

      // 1. Persist locally with the file:// URI immediately (offline-safe)
      insertRecord('inspection_photos', newPhoto as unknown as Record<string, string | number | boolean | null>);

      // 2. Queue the binary upload — processPhotoQueue in sync.ts handles this.
      //    BUG 8 FIX: do NOT also queue a SyncOperation.Insert here with the local file:// URI
      //    because sync.ts would push the broken local path to Supabase BEFORE the upload completes.
      //    processPhotoQueue will insert the Supabase row AFTER upload succeeds with the public URL.
      queuePhotoUpload(newPhoto.photo_url, newPhoto.job_id, newPhoto.asset_id ?? undefined, id);

      set((state) => ({ photos: [newPhoto, ...state.photos] }));
    } catch (err: unknown) {
      console.error('[PhotosStore] addPhoto error:', err);
      set({ error: errorMessage(err) });
    }
  },

  deletePhoto: (photoId) => {
    try {
      const photo = get().photos.find((p) => p.id === photoId);
      const photoUrl = photo?.photo_url;

      // 1. Remove from local SQLite immediately
      deleteRecord('inspection_photos', photoId);

      // 2. Permanently record in tombstone — survives retries/reinstalls
      recordDeletedPhoto(photoId);

      if (photoUrl?.startsWith('https://')) {
        // Photo already uploaded to Supabase — queue a delete for both the DB row
        // and the Storage binary (sync.ts _pushQueue handles the binary deletion).
        addToSyncQueue('inspection_photos', photoId, SyncOperation.Delete, {
          id: photoId,
          photo_url: photoUrl,
        });
      } else {
        // Photo only exists locally (file:// URI, never uploaded).
        // Cancel the pending photo_upload task so it is never sent to Supabase.
        // No Supabase row exists yet, so no DB delete is needed.
        cancelPendingPhotoUpload(photoId);
      }

      set((state) => ({ photos: state.photos.filter((p) => p.id !== photoId) }));
    } catch (err: unknown) {
      console.error('[PhotosStore] deletePhoto error:', err);
      set({ error: errorMessage(err) });
    }
  },


  updateCaption: (photoId, caption) => {
    try {
      updateRecord('inspection_photos', photoId, { caption });
      addToSyncQueue('inspection_photos', photoId, SyncOperation.Update, { caption });
      set((state) => ({
        photos: state.photos.map((p) =>
          p.id === photoId ? { ...p, caption } : p
        ),
      }));
    } catch (err: unknown) {
      console.error('[PhotosStore] updateCaption error:', err);
      set({ error: errorMessage(err) });
    }
  },

  getPendingCount: () => {
    const { photos } = get();
    // Local file:// URIs indicate the photo binary hasn't been uploaded yet
    return photos.filter((p) => p.photo_url.startsWith('file://')).length;
  },

  clearError: () => set({ error: null }),
}));
