// Zustand store — full jobs state: loading, filtering, searching, status updates
import { create } from 'zustand';
import { getJobsForTechnician, updateRecord, addToSyncQueue, getRecord, getJobById, getAssetsWithJobResults } from '@/lib/database';
import { JobStatus, SyncOperation, ComplianceStatus, InspectionResult } from '@/constants/Enums';
import { onSyncComplete, offSyncComplete } from '@/lib/sync';
import { useAuthStore } from '@/store/authStore';
import type { Job } from '@/types';

// ─── Extended type — includes property JOIN columns ───────────
export type JobWithProperty = Job & {
  property_name: string | null;
  property_address: string | null;
  property_suburb: string | null;
  property_state: string | null;
  property_postcode: string | null;
  property_compliance_status: string | null;
  access_notes: string | null;
  hazard_notes: string | null;
  site_note: string | null;
  site_contact_name: string | null;
  site_contact_phone: string | null;
};

export type JobFilter = 'today' | 'week' | 'all';

// ─── Date helpers ─────────────────────────────────────────────
function todayISO(): string {
  return new Date().toISOString().slice(0, 10); // YYYY-MM-DD
}

function weekRange(): { start: string; end: string } {
  const now = new Date();
  const day = now.getDay(); // 0=Sun
  const diff = day === 0 ? -6 : 1 - day; // adjust so Mon=start
  const mon = new Date(now);
  mon.setDate(now.getDate() + diff);
  const sun = new Date(mon);
  sun.setDate(mon.getDate() + 6);
  return {
    start: mon.toISOString().slice(0, 10),
    end: sun.toISOString().slice(0, 10),
  };
}

// ─── State & Actions types ────────────────────────────────────
interface JobsState {
  jobs: JobWithProperty[];
  selectedJob: JobWithProperty | null;
  isLoading: boolean;
  error: string | null;
  activeFilter: JobFilter;
  searchQuery: string;
  /** Internal — ref to the current sync listener so we can cleanly unsubscribe */
  _syncListenerRef: (() => void) | null;
}

interface JobsActions {
  loadJobs: (userId: string) => void;
  subscribeToSync: (userId: string) => void;
  unsubscribeFromSync: () => void;
  getFilteredJobs: () => JobWithProperty[];
  selectJob: (jobId: string) => void;
  clearSelectedJob: () => void;
  setFilter: (filter: JobFilter) => void;
  setSearchQuery: (q: string) => void;
  updateJobStatus: (jobId: string, newStatus: JobStatus) => void;
  clearError: () => void;
}

// ─── Store ────────────────────────────────────────────────────
export const useJobsStore = create<JobsState & JobsActions>((set, get) => ({
  jobs: [],
  selectedJob: null,
  isLoading: false,
  error: null,
  activeFilter: 'all',
  searchQuery: '',
  _syncListenerRef: null,

  loadJobs: (userId) => {
    set({ isLoading: true, error: null });
    try {
      const jobs = getJobsForTechnician<JobWithProperty>(userId);
      set({ jobs, isLoading: false });
    } catch (err) {
      console.error('[JobsStore] loadJobs error:', err);
      set({ error: 'Failed to load jobs. Pull down to retry.', isLoading: false });
    }
  },

  subscribeToSync: (userId) => {
    // Clean up any previously registered listener before subscribing again
    const prev = get()._syncListenerRef;
    if (prev) offSyncComplete(prev);

    const listener = () => {
      if (__DEV__) console.log('[JobsStore] sync complete — reloading jobs');
      useJobsStore.getState().loadJobs(userId);
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

  getFilteredJobs: () => {
    const { jobs, activeFilter, searchQuery } = get();
    const today = todayISO();
    const { start, end } = weekRange();

    let filtered = jobs;

    // Date filter
    if (activeFilter === 'today') {
      filtered = jobs.filter((j) => j.scheduled_date === today);
    } else if (activeFilter === 'week') {
      filtered = jobs.filter(
        (j) => j.scheduled_date >= start && j.scheduled_date <= end
      );
    }

    // Search filter — all relevant fields
    const q = searchQuery.toLowerCase().trim();
    if (q) {
      filtered = filtered.filter(
        (j) =>
          (j.property_name ?? '').toLowerCase().includes(q) ||
          (j.property_address ?? '').toLowerCase().includes(q) ||
          (j.property_suburb ?? '').toLowerCase().includes(q) ||
          (j.property_state ?? '').toLowerCase().includes(q) ||
          (j.job_type ?? '').toLowerCase().includes(q) ||
          (j.notes ?? '').toLowerCase().includes(q)
      );
    }

    return filtered;
  },

  selectJob: (jobId) => {
    const job = get().jobs.find((j) => j.id === jobId) ?? null;
    set({ selectedJob: job });
  },

  clearSelectedJob: () => set({ selectedJob: null }),

  setFilter: (filter) => set({ activeFilter: filter }),

  setSearchQuery: (q) => set({ searchQuery: q }),

  updateJobStatus: (jobId, newStatus) => {
    try {
      const now = new Date().toISOString();
      // Include company_id so the UPDATE sync payload passes Supabase RLS.
      // Read from local SQLite users table (never trust the in-memory store alone
      // since the store could be mid-rehydration on cold start).
      const userId = useAuthStore.getState().user?.id ?? null;
      const localUser = userId ? getRecord<{ company_id: string | null }>('users', userId) : null;
      const companyId = localUser?.company_id ?? useAuthStore.getState().user?.company_id ?? null;

      const update = { status: newStatus, updated_at: now, company_id: companyId };
      updateRecord('jobs', jobId, update);
      addToSyncQueue('jobs', jobId, SyncOperation.Update, update);

      // Recompute the property's overall compliance whenever a job actually
      // completes. This was previously the one thing missing from the normal
      // job-completion path — only the separate, less-common "Site Inspect"
      // quick-flow (app/(app)/properties/site-inspect/[id].tsx) ever wrote
      // properties.compliance_status, so a property inspected exclusively
      // through ordinary scheduled jobs stayed "Pending" in the admin
      // dashboard forever, no matter how many jobs were completed against
      // it. Same formula as that flow: any Fail among the property's
      // (job-scoped) asset results makes it non-compliant.
      if (newStatus === JobStatus.Completed) {
        const completedJob = getJobById<{ property_id: string }>(jobId);
        if (completedJob?.property_id) {
          const propertyAssets = getAssetsWithJobResults<{ result: string | null }>(jobId, completedJob.property_id);
          const compliance = propertyAssets.some(a => a.result === InspectionResult.Fail)
            ? ComplianceStatus.NonCompliant
            : ComplianceStatus.Compliant;
          const propertyUpdate = { compliance_status: compliance, updated_at: now };
          updateRecord('properties', completedJob.property_id, propertyUpdate);
          addToSyncQueue('properties', completedJob.property_id, SyncOperation.Update, propertyUpdate);
        }
      }

      // Optimistic UI update — reflects change before the next sync cycle
      set((state) => ({
        jobs: state.jobs.map((j) =>
          j.id === jobId ? { ...j, status: newStatus, updated_at: now } : j
        ),
        selectedJob:
          state.selectedJob?.id === jobId
            ? { ...state.selectedJob, status: newStatus, updated_at: now }
            : state.selectedJob,
      }));
    } catch (err) {
      console.error('[JobsStore] updateJobStatus error:', err);
    }
  },

  clearError: () => set({ error: null }),
}));
