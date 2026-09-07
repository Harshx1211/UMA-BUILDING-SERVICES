// store/documentsStore.ts — Zustand store for scanned site documents, mirrors store/photosStore.ts
import { create } from 'zustand';
import type { SiteDocument } from '@/types';
import {
  getDocumentsForProperty,
  getRecord,
  insertRecord,
  updateRecord,
  deleteRecord,
  addToSyncQueue,
  cancelPendingDocumentUpload,
  recordDeletedDocument,
} from '@/lib/database';
import { SyncOperation } from '@/constants/Enums';
import { queueDocumentUpload } from '@/lib/documentUpload';
import { generateUUID } from '@/utils/uuid';
import * as FileSystem from 'expo-file-system/legacy';
import { getValidLocalUri } from '@/utils/fileHelpers';

// ─── Helper — extract a message from an unknown catch value ─
function errorMessage(err: unknown): string {
  return err instanceof Error ? err.message : 'An unexpected error occurred.';
}

// ─── State & Actions ──────────────────────────────────────
interface DocumentsState {
  documents: SiteDocument[];
  isLoading: boolean;
  error: string | null;

  /** Loads every document for a property — not job-scoped, matches property.site_note's "shared across every job" model */
  loadDocuments: (propertyId: string) => void;
  addDocument: (doc: Omit<SiteDocument, 'id' | 'uploaded_at'>) => void;
  deleteDocument: (documentId: string) => void;
  renameDocument: (documentId: string, title: string) => void;
  /** Number of documents still stored as local file:// URIs (pending upload) */
  getPendingCount: () => number;
  clearError: () => void;
  reset: () => void;
}

// ─── Store ────────────────────────────────────────────────
export const useDocumentsStore = create<DocumentsState>((set, get) => ({
  documents: [],
  isLoading: false,
  error: null,

  loadDocuments: (propertyId) => {
    try {
      set({ documents: [], isLoading: true, error: null });
      const dbDocuments = getDocumentsForProperty<SiteDocument>(propertyId);
      set({ documents: dbDocuments, isLoading: false });
    } catch (err: unknown) {
      console.error('[DocumentsStore] loadDocuments error:', err);
      set({ error: errorMessage(err), isLoading: false });
    }
  },

  addDocument: (docData) => {
    try {
      const id = generateUUID();
      const newDocument: SiteDocument = {
        ...docData,
        id,
        uploaded_at: new Date().toISOString(),
        local_uri: (
          docData.document_url.startsWith('file://') ||
          docData.document_url.startsWith('content://')
        ) ? docData.document_url : (docData.local_uri ?? null),
      };

      // 1. Persist locally with the file:// URI immediately (offline-safe)
      insertRecord('site_documents', newDocument as unknown as Record<string, string | number | boolean | null>);

      // 2. Queue the binary upload — processDocumentQueue in sync.ts handles this.
      //    Does NOT also queue a SyncOperation.Insert here, same reasoning as
      //    photosStore.addPhoto: that would push the broken local file:// path
      //    to Supabase before the upload completes. processDocumentQueue inserts
      //    the Supabase row itself once the upload succeeds with the public URL.
      queueDocumentUpload(newDocument.document_url, newDocument.property_id, id, newDocument.job_id ?? undefined);

      set((state) => ({ documents: [newDocument, ...state.documents] }));
    } catch (err: unknown) {
      console.error('[DocumentsStore] addDocument error:', err);
      set({ error: errorMessage(err) });
    }
  },

  deleteDocument: (documentId) => {
    try {
      // Read current state from SQLite, not the in-memory store — same reasoning
      // as photosStore.deletePhoto: processDocumentQueue updates document_url in
      // SQLite but never touches the Zustand store.
      const dbDocument = getRecord<{ document_url: string | null; local_uri: string | null }>('site_documents', documentId);
      const documentUrl = dbDocument?.document_url ?? get().documents.find(d => d.id === documentId)?.document_url;
      const localUri = dbDocument?.local_uri ?? get().documents.find(d => d.id === documentId)?.local_uri;

      deleteRecord('site_documents', documentId);
      recordDeletedDocument(documentId);

      // FIX: mirrors photosStore.deletePhoto's equivalent fix — the local
      // PDF file was never removed here, only the database row, so every
      // deleted document's on-disk file stayed on the device forever.
      // Best-effort and non-blocking.
      if (localUri) {
        const path = getValidLocalUri(localUri);
        FileSystem.deleteAsync(path, { idempotent: true }).catch(() => {});
      }

      if (documentUrl?.startsWith('https://')) {
        addToSyncQueue('site_documents', documentId, SyncOperation.Delete, {
          id: documentId,
          document_url: documentUrl,
        });
      } else {
        cancelPendingDocumentUpload(documentId);
      }

      set((state) => ({ documents: state.documents.filter((d) => d.id !== documentId) }));
    } catch (err: unknown) {
      console.error('[DocumentsStore] deleteDocument error:', err);
      set({ error: errorMessage(err) });
    }
  },

  renameDocument: (documentId, title) => {
    try {
      updateRecord('site_documents', documentId, { title });
      addToSyncQueue('site_documents', documentId, SyncOperation.Update, { title });
      set((state) => ({
        documents: state.documents.map((d) =>
          d.id === documentId ? { ...d, title } : d
        ),
      }));
    } catch (err: unknown) {
      console.error('[DocumentsStore] renameDocument error:', err);
      set({ error: errorMessage(err) });
    }
  },

  getPendingCount: () => {
    const { documents } = get();
    return documents.filter(
      (d) => d.document_url.startsWith('file://') || d.document_url.startsWith('content://')
    ).length;
  },

  clearError: () => set({ error: null }),

  reset: () => set({ documents: [], isLoading: false, error: null }),
}));
