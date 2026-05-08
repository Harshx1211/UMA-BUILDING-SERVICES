// store/quotesStore.ts — Zustand store for job quotes with offline-first persistence
import { create } from 'zustand';
import type { Quote, QuoteItem } from '@/types';
import {
  openDatabase,
  queryRecords,
  insertRecord,
  updateRecord,
  deleteRecord,
  addToSyncQueue,
} from '@/lib/database';
import { SyncOperation, QuoteStatus } from '@/constants/Enums';
import { onSyncComplete, offSyncComplete } from '@/lib/sync';
import { useInventoryStore } from './inventoryStore';
import { generateUUID } from '@/utils/uuid';

// ─── Helper — extract a message from an unknown catch value ─
function errorMessage(err: unknown): string {
  return err instanceof Error ? err.message : 'An unexpected error occurred.';
}

// ─── State & Actions ──────────────────────────────────────
interface QuotesState {
  currentQuote: Quote | null;
  items: QuoteItem[];
  isLoading: boolean;
  error: string | null;
  /** Internal — ref to the current sync listener so we can cleanly unsubscribe */
  _syncListenerRef: (() => void) | null;

  loadQuoteForJob: (jobId: string) => void;
  createDraftQuote: (jobId: string) => void;
  addItem: (inventoryItemId: string, defectId: string | null, quantity: number) => void;
  removeItem: (itemId: string) => void;
  approveQuote: () => void;
  subscribeToSync: (jobId: string) => void;
  unsubscribeFromSync: () => void;
  clearError: () => void;
}

// ─── Store ────────────────────────────────────────────────
export const useQuotesStore = create<QuotesState>((set, get) => ({
  currentQuote: null,
  items: [],
  isLoading: false,
  error: null,
  _syncListenerRef: null,

  loadQuoteForJob: (jobId) => {
    try {
      // FLOW-9 FIX: Clear previous job's quote immediately so navigating
      // from Job A (£500) to Job B (no quote) never flashes "£500".
      set({ currentQuote: null, items: [], isLoading: true, error: null });
      const db = openDatabase();
      // Use ORDER BY created_at DESC to always get the most recent quote,
      // not an arbitrary one — guards against duplicates during offline sync conflicts
      const quote = db.getFirstSync<Quote>(
        `SELECT * FROM quotes WHERE job_id = ? ORDER BY created_at DESC LIMIT 1`,
        [jobId]
      );
      if (quote) {
        const items = queryRecords<QuoteItem>('quote_items', { quote_id: quote.id });
        set({ currentQuote: quote, items, isLoading: false });
      } else {
        set({ currentQuote: null, items: [], isLoading: false });
      }
    } catch (err: unknown) {
      console.error('[QuotesStore] loadQuoteForJob error:', err);
      set({ error: errorMessage(err), isLoading: false });
    }
  },

  createDraftQuote: (jobId) => {
    try {
      const id = generateUUID();
      const payload: Quote = {
        id,
        job_id: jobId,
        status: QuoteStatus.Draft,
        total_amount: 0,
        created_at: new Date().toISOString(),
      };
      insertRecord('quotes', payload as unknown as Record<string, string | number | boolean | null>);
      addToSyncQueue('quotes', id, SyncOperation.Insert, payload as unknown as Record<string, string | number | boolean | null>);
      set({ currentQuote: payload, items: [], error: null });
    } catch (err: unknown) {
      console.error('[QuotesStore] createDraftQuote error:', err);
      set({ error: errorMessage(err) });
    }
  },

  addItem: (inventoryItemId, defectId, quantity) => {
    try {
      const { currentQuote, items } = get();
      if (!currentQuote) return;

      // C4 fix: if an item with the same inventory+defect combo already exists,
      // increment its quantity instead of inserting a duplicate row.
      const existing = items.find(
        (i) => i.inventory_item_id === inventoryItemId && i.defect_id === defectId
      );
      if (existing) {
        const newQty = existing.quantity + quantity;
        updateRecord('quote_items', existing.id, { quantity: newQty });
        addToSyncQueue('quote_items', existing.id, SyncOperation.Update, { quantity: newQty });

        const newItems = items.map((i) => i.id === existing.id ? { ...i, quantity: newQty } : i);
        const newTotal = newItems.reduce((sum, item) => sum + item.quantity * item.unit_price, 0);
        const updatedQuote: Quote = { ...currentQuote, total_amount: newTotal };
        updateRecord('quotes', currentQuote.id, { total_amount: newTotal });
        addToSyncQueue('quotes', currentQuote.id, SyncOperation.Update, { total_amount: newTotal });
        set({ items: newItems, currentQuote: updatedQuote });
        return;
      }

      // New item — resolve price from inventory store
      const invItem = useInventoryStore.getState().items.find((i) => i.id === inventoryItemId);
      const unitPrice = invItem?.price ?? 0;

      const id = generateUUID();
      const payload: QuoteItem = {
        id,
        quote_id: currentQuote.id,
        inventory_item_id: inventoryItemId,
        defect_id: defectId,
        quantity,
        unit_price: unitPrice,
      };

      insertRecord('quote_items', payload as unknown as Record<string, string | number | boolean | null>);
      addToSyncQueue('quote_items', id, SyncOperation.Insert, payload as unknown as Record<string, string | number | boolean | null>);

      const newItems = [...items, payload];
      const newTotal = newItems.reduce((sum, item) => sum + item.quantity * item.unit_price, 0);

      const updatedQuote: Quote = { ...currentQuote, total_amount: newTotal };
      updateRecord('quotes', currentQuote.id, { total_amount: newTotal });
      addToSyncQueue('quotes', currentQuote.id, SyncOperation.Update, { total_amount: newTotal });

      set({ items: newItems, currentQuote: updatedQuote });
    } catch (err: unknown) {
      console.error('[QuotesStore] addItem error:', err);
      set({ error: errorMessage(err) });
    }
  },

  removeItem: (itemId) => {
    try {
      const { currentQuote, items } = get();
      if (!currentQuote) return;

      deleteRecord('quote_items', itemId);
      addToSyncQueue('quote_items', itemId, SyncOperation.Delete, { id: itemId });

      const newItems = items.filter((i) => i.id !== itemId);
      const newTotal = newItems.reduce((sum, item) => sum + item.quantity * item.unit_price, 0);

      const updatedQuote: Quote = { ...currentQuote, total_amount: newTotal };
      updateRecord('quotes', currentQuote.id, { total_amount: newTotal });
      addToSyncQueue('quotes', currentQuote.id, SyncOperation.Update, { total_amount: newTotal });

      set({ items: newItems, currentQuote: updatedQuote });
    } catch (err: unknown) {
      console.error('[QuotesStore] removeItem error:', err);
      set({ error: errorMessage(err) });
    }
  },

  approveQuote: () => {
    try {
      const { currentQuote } = get();
      if (!currentQuote) return;

      const updatedQuote: Quote = { ...currentQuote, status: QuoteStatus.Approved };
      updateRecord('quotes', currentQuote.id, { status: QuoteStatus.Approved });
      addToSyncQueue('quotes', currentQuote.id, SyncOperation.Update, { status: QuoteStatus.Approved });

      set({ currentQuote: updatedQuote });
    } catch (err: unknown) {
      console.error('[QuotesStore] approveQuote error:', err);
      set({ error: errorMessage(err) });
    }
  },

  clearError: () => set({ error: null }),

  subscribeToSync: (jobId: string) => {
    // Clean up any previously registered listener before subscribing again
    const prev = get()._syncListenerRef;
    if (prev) offSyncComplete(prev);

    const listener = () => {
      if (__DEV__) console.log('[QuotesStore] sync complete — reloading quote');
      useQuotesStore.getState().loadQuoteForJob(jobId);
    };
    onSyncComplete(listener);
    set({ _syncListenerRef: listener });
  },

  unsubscribeFromSync: () => {
    const listener = get()._syncListenerRef;
    if (listener) {
      offSyncComplete(listener);
      set({ _syncListenerRef: null });
    }
  },
}));
