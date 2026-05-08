// store/catalogueStore.ts
// Provides live asset types and defect codes from SQLite (synced from Supabase).
// Falls back to the hardcoded constants when the SQLite tables are empty (offline / first install).
import { create } from 'zustand';
import { openDatabase } from '@/lib/database';
import { ASSET_TYPES } from '@/constants/AssetData';
import { DEFECT_CODES } from '@/constants/DefectCodes';
import type { AssetTypeDefinition } from '@/constants/AssetData';
import type { DefectCode, DefectCategory } from '@/constants/DefectCodes';
import { onSyncComplete, offSyncComplete } from '@/lib/sync';

interface CatalogueState {
  assetTypes: AssetTypeDefinition[];
  defectCodes: DefectCode[];
  /** Stable listener ref so we can cleanly deregister on unmount */
  _syncListenerRef: (() => void) | null;
  load: () => void;
  /** Wire up automatic reload after every sync cycle (mirrors dashboardStore pattern) */
  subscribeToSync: () => void;
  unsubscribeFromSync: () => void;
}

export const useCatalogueStore = create<CatalogueState>((set, get) => ({
  assetTypes: ASSET_TYPES,   // start with constants so UI is never blank
  defectCodes: DEFECT_CODES,
  _syncListenerRef: null,

  load: () => {
    try {
      const db = openDatabase();

      // ── Asset Types ──────────────────────────────────────
      const rows = db.getAllSync<{
        value: string; label: string; full_label: string;
        icon: string; color: string; inspection_routine: string; variants: string;
      }>('SELECT * FROM asset_type_definitions WHERE is_active = 1 ORDER BY sort_order ASC');

      if (rows.length > 0) {
        const types: AssetTypeDefinition[] = rows.map(r => ({
          value:             r.value,
          label:             r.label,
          fullLabel:         r.full_label,
          icon:              r.icon as any,
          color:             r.color,
          inspectionRoutine: r.inspection_routine,
          variants:          (() => { try { return JSON.parse(r.variants); } catch { return []; } })(),
        }));
        set({ assetTypes: types });
      }

      // ── Defect Codes ─────────────────────────────────────
      const codes = db.getAllSync<{
        code: string; description: string; quote_price: number | null; category: string;
      }>('SELECT * FROM defect_codes WHERE is_active = 1 ORDER BY sort_order ASC');

      if (codes.length > 0) {
        set({
          defectCodes: codes.map(c => ({
            code:        c.code,
            description: c.description,
            quote_price: c.quote_price ?? undefined,
            category:    c.category as DefectCategory,
          })),
        });
      }
    } catch (e) {
      console.warn('[CatalogueStore] load error:', e);
    }
  },

  subscribeToSync: () => {
    // Deregister any stale listener before creating a new one
    const prev = get()._syncListenerRef;
    if (prev) offSyncComplete(prev);

    const listener = () => {
      if (__DEV__) console.log('[CatalogueStore] sync complete — refreshing catalogue');
      useCatalogueStore.getState().load();
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
