// store/notebookStore.ts — Zustand store for the shared per-property
// notebook, mirrors store/documentsStore.ts minus the file-upload half
// (a notebook item is just text, nothing to queue a binary upload for).
import { create } from 'zustand';
import type { PropertyNotebookItem } from '@/types';
import {
  getNotebookItemsForProperty,
  insertRecord,
  deleteRecord,
  addToSyncQueue,
  recordDeletedNotebookItem,
} from '@/lib/database';
import { SyncOperation } from '@/constants/Enums';
import { generateUUID } from '@/utils/uuid';

function errorMessage(err: unknown): string {
  return err instanceof Error ? err.message : 'An unexpected error occurred.';
}

interface NotebookState {
  items: PropertyNotebookItem[];
  isLoading: boolean;
  error: string | null;

  /** Loads every notebook item for a property — not job-scoped, shared
   * across the whole company like site documents. */
  loadItems: (propertyId: string) => void;
  addItem: (propertyId: string, text: string, createdBy: string | null, companyId: string | null) => void;
  deleteItem: (itemId: string) => void;
  clearError: () => void;
  reset: () => void;
}

export const useNotebookStore = create<NotebookState>((set, get) => ({
  items: [],
  isLoading: false,
  error: null,

  loadItems: (propertyId) => {
    try {
      set({ items: [], isLoading: true, error: null });
      const dbItems = getNotebookItemsForProperty<PropertyNotebookItem>(propertyId);
      set({ items: dbItems, isLoading: false });
    } catch (err: unknown) {
      console.error('[NotebookStore] loadItems error:', err);
      set({ error: errorMessage(err), isLoading: false });
    }
  },

  addItem: (propertyId, text, createdBy, companyId) => {
    const trimmed = text.trim();
    if (!trimmed) return;
    try {
      const id = generateUUID();
      const now = new Date().toISOString();
      const newItem: PropertyNotebookItem = {
        id,
        company_id: companyId,
        property_id: propertyId,
        text: trimmed,
        created_by: createdBy,
        created_at: now,
      };

      const payload = newItem as unknown as Record<string, string | number | boolean | null>;
      insertRecord('property_notebook_items', payload);
      addToSyncQueue('property_notebook_items', id, SyncOperation.Insert, payload);

      set((state) => ({ items: [newItem, ...state.items] }));
    } catch (err: unknown) {
      console.error('[NotebookStore] addItem error:', err);
      set({ error: errorMessage(err) });
    }
  },

  deleteItem: (itemId) => {
    try {
      deleteRecord('property_notebook_items', itemId);
      recordDeletedNotebookItem(itemId);
      addToSyncQueue('property_notebook_items', itemId, SyncOperation.Delete, { id: itemId });

      set((state) => ({ items: state.items.filter((i) => i.id !== itemId) }));
    } catch (err: unknown) {
      console.error('[NotebookStore] deleteItem error:', err);
      set({ error: errorMessage(err) });
    }
  },

  clearError: () => set({ error: null }),

  reset: () => set({ items: [], isLoading: false, error: null }),
}));
