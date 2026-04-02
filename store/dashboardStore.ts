// Dashboard store — loads today's jobs and stats from local SQLite
import { create } from 'zustand';
import { openDatabase } from '@/lib/database';
import { JobStatus } from '@/constants/Enums';
import type { Job } from '@/types';

interface DashboardStats {
  total: number;
  completed: number;
  inProgress: number;
  pending: number;
}

interface WeekStats {
  total: number;
  completed: number;
}

interface DashboardState {
  todayJobs: Job[];
  todayStats: DashboardStats;
  weekStats: WeekStats;
  openDefects: number;
  isLoading: boolean;
  error: string | null;
}

interface DashboardActions {
  loadDashboard: (userId: string) => void;
  clearError: () => void;
}

const today = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

const weekRange = () => {
  const now = new Date();
  const dayOfWeek = now.getDay(); // 0=Sun
  const diffToMonday = (dayOfWeek + 6) % 7;
  const monday = new Date(now);
  monday.setDate(now.getDate() - diffToMonday);
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  const fmt = (d: Date) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  return { start: fmt(monday), end: fmt(sunday) };
};

export const useDashboardStore = create<DashboardState & DashboardActions>((set) => ({
  todayJobs: [],
  todayStats: { total: 0, completed: 0, inProgress: 0, pending: 0 },
  weekStats: { total: 0, completed: 0 },
  openDefects: 0,
  isLoading: false,
  error: null,

  loadDashboard: (userId: string) => {
    set({ isLoading: true, error: null });
    try {
      const db = openDatabase();
      const todayStr = today();

      // ── Today's jobs (with property info) ──────────────────
      const todayJobRows = db.getAllSync<Job>(
        `SELECT j.*, p.name AS property_name, p.address AS property_address,
                p.suburb AS property_suburb, p.state AS property_state
         FROM jobs j
         LEFT JOIN properties p ON j.property_id = p.id
         WHERE j.assigned_to = ?
           AND j.scheduled_date = ?
           AND j.status != ?
         ORDER BY j.scheduled_time ASC, j.priority DESC`,
        [userId, todayStr, JobStatus.Cancelled]
      );

      // ── Today stats ──────────────────────────────────────────
      const total = todayJobRows.length;
      const completed = todayJobRows.filter((j) => j.status === JobStatus.Completed).length;
      const inProgress = todayJobRows.filter((j) => j.status === JobStatus.InProgress).length;
      const pending = todayJobRows.filter((j) => j.status === JobStatus.Scheduled).length;

      // ── This week stats ──────────────────────────────────────
      const { start, end } = weekRange();
      const weekRows = db.getAllSync<{ status: string }>(
        `SELECT status FROM jobs
         WHERE assigned_to = ?
           AND scheduled_date BETWEEN ? AND ?
           AND status != ?`,
        [userId, start, end, JobStatus.Cancelled]
      );
      const weekTotal = weekRows.length;
      const weekCompleted = weekRows.filter((r) => r.status === JobStatus.Completed).length;

      // ── Open defects ─────────────────────────────────────────
      const defectRow = db.getFirstSync<{ count: number }>(
        `SELECT COUNT(*) as count FROM defects
         WHERE job_id IN (
           SELECT id FROM jobs WHERE assigned_to = ?
         ) AND status = 'open'`,
        [userId]
      );

      set({
        todayJobs: todayJobRows,
        todayStats: { total, completed, inProgress, pending },
        weekStats: { total: weekTotal, completed: weekCompleted },
        openDefects: defectRow?.count ?? 0,
        isLoading: false,
        error: null,
      });
    } catch (err) {
      console.error('[DashboardStore] loadDashboard error:', err);
      set({
        isLoading: false,
        error: 'Failed to load dashboard. Tap to retry.',
      });
    }
  },

  clearError: () => set({ error: null }),
}));
