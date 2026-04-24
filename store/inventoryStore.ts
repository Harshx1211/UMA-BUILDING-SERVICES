// store/inventoryStore.ts — Zustand store for inventory items with SQLite persistence
import { create } from 'zustand';
import { queryRecords } from '@/lib/database';
import type { InventoryItem } from '@/types';

// ─── Helper — extract a message from an unknown catch value ─
function errorMessage(err: unknown): string {
  return err instanceof Error ? err.message : 'An unexpected error occurred.';
}

// ─── State & Actions ──────────────────────────────────────
interface InventoryState {
  items: InventoryItem[];
  isLoading: boolean;
  error: string | null;

  loadInventory: () => void;
  clearError: () => void;
}

// ─── Store ────────────────────────────────────────────────
export const useInventoryStore = create<InventoryState>((set) => ({
  items: [],
  isLoading: false,
  error: null,

  loadInventory: () => {
    set({ isLoading: true, error: null });
    try {
      const dbItems = queryRecords<InventoryItem>('inventory_items');
      set({
        items: [...dbItems].sort((a, b) => a.name.localeCompare(b.name)),
        isLoading: false,
      });
    } catch (err: unknown) {
      console.error('[InventoryStore] loadInventory error:', err);
      set({ error: errorMessage(err), isLoading: false });
    }
  },

  clearError: () => set({ error: null }),
}));
