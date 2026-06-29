// store/notificationsStore.ts — Zustand store for in-app notifications with SQLite persistence
import { create } from 'zustand';
import { openDatabase } from '@/lib/database';
import { generateUUID } from '@/utils/uuid';

/** Maximum notifications loaded into memory. Older ones are not discarded — just not shown. */
const MAX_NOTIFICATIONS = 100;

// ─── Types ────────────────────────────────────────────────
export type NotificationType =
  | 'new_job'
  | 'urgent_job'
  | 'sync_complete'
  | 'defect_flagged'
  | 'general';

export interface AppNotification {
  id: string;
  type: NotificationType;
  title: string;
  message: string;
  job_id: string | null;
  user_id: string | null; // which technician this notification is for (null = broadcast)
  is_read: boolean;       // SQLite stores as 0/1; we convert to bool
  created_at: string;     // ISO 8601
}

interface NotificationsState {
  notifications: AppNotification[];
  unreadCount: number;
  totalCount: number;    // total rows in DB (may exceed MAX_NOTIFICATIONS)
  isLoading: boolean;
  error: string | null;

  loadNotifications: () => void;
  markAsRead: (id: string) => void;
  markAllAsRead: () => void;
  addNotification: (n: Omit<AppNotification, 'id' | 'is_read' | 'created_at'>) => void;
  clearAll: () => void;
  clearError: () => void;
}

// ─── Helper — extract a message from an unknown catch value ─
function errorMessage(err: unknown): string {
  return err instanceof Error ? err.message : 'An unexpected error occurred.';
}

// ─── Row → AppNotification mapper ────────────────────────
function mapRow(row: Record<string, unknown>): AppNotification {
  return {
    id: row.id as string,
    type: (row.type as NotificationType) ?? 'general',
    title: row.title as string,
    message: row.message as string,
    job_id: (row.job_id as string | null) ?? null,
    user_id: (row.user_id as string | null) ?? null,
    is_read: (row.is_read as number) === 1,
    created_at: row.created_at as string,
  };
}

// ─── Store ─────────────────────────────────────────────
export const useNotificationsStore = create<NotificationsState>((set) => ({
  notifications: [],
  unreadCount: 0,
  totalCount: 0,
  isLoading: false,
  error: null,

  loadNotifications: () => {
    try {
      set({ isLoading: true, error: null });
      const db = openDatabase();
      // Get total count first so we can tell the user if they're seeing a capped view
      const countRow = db.getFirstSync<{ count: number }>(`SELECT COUNT(*) AS count FROM notifications`);
      const totalCount = countRow?.count ?? 0;

      const rows = db.getAllSync<Record<string, unknown>>(
        `SELECT * FROM notifications ORDER BY created_at DESC LIMIT ${MAX_NOTIFICATIONS}`
      );
      const notifications = rows.map(mapRow);
      set({
        notifications,
        unreadCount: notifications.filter((n) => !n.is_read).length,
        totalCount,
        isLoading: false,
      });
    } catch (err: unknown) {
      console.error('[NotificationsStore] loadNotifications error:', err);
      set({ error: errorMessage(err), isLoading: false });
    }
  },

  markAsRead: (id) => {
    try {
      const db = openDatabase();
      db.runSync(`UPDATE notifications SET is_read = 1 WHERE id = ?`, [id]);
      set((state) => {
        const notifications = state.notifications.map((n) =>
          n.id === id ? { ...n, is_read: true } : n
        );
        return { notifications, unreadCount: notifications.filter((n) => !n.is_read).length };
      });
    } catch (err: unknown) {
      console.error('[NotificationsStore] markAsRead error:', err);
      set({ error: errorMessage(err) });
    }
  },

  markAllAsRead: () => {
    try {
      const db = openDatabase();
      db.runSync(`UPDATE notifications SET is_read = 1`);
      set((state) => ({
        notifications: state.notifications.map((n) => ({ ...n, is_read: true })),
        unreadCount: 0,
      }));
    } catch (err: unknown) {
      console.error('[NotificationsStore] markAllAsRead error:', err);
      set({ error: errorMessage(err) });
    }
  },

  addNotification: (data) => {
    try {
      const id = generateUUID();
      const now = new Date().toISOString();
      const db = openDatabase();
      db.runSync(
        `INSERT INTO notifications (id, type, title, message, job_id, user_id, is_read, created_at)
         VALUES (?, ?, ?, ?, ?, ?, 0, ?)`,
        [id, data.type, data.title, data.message, data.job_id ?? null, (data as AppNotification).user_id ?? null, now]
      );
      const newNotif: AppNotification = {
        id,
        type: data.type,
        title: data.title,
        message: data.message,
        job_id: data.job_id ?? null,
        user_id: (data as AppNotification).user_id ?? null,
        is_read: false,
        created_at: now,
      };
      set((state) => ({
        notifications: [newNotif, ...state.notifications],
        unreadCount: state.unreadCount + 1,
      }));
    } catch (err: unknown) {
      console.error('[NotificationsStore] addNotification error:', err);
      set({ error: errorMessage(err) });
    }
  },

  clearAll: () => {
    try {
      const db = openDatabase();
      db.runSync(`DELETE FROM notifications`);
      set({ notifications: [], unreadCount: 0, totalCount: 0, error: null });
    } catch (err: unknown) {
      console.error('[NotificationsStore] clearAll error:', err);
      set({ error: errorMessage(err) });
    }
  },

  clearError: () => set({ error: null }),
}));
