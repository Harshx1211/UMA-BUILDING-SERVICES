import { getJobById } from '@/lib/database';
import { JobStatus } from '@/constants/Enums';

/**
 * Rejects any write against a locked job. A completed job's report is final
 * — "Continue Working" (which reopens the job and clears its report and
 * signature) is the only sanctioned way back into edit mode — and a
 * cancelled job can't be edited at all. Looks the job up fresh from SQLite
 * rather than trusting in-memory store state, since callers reach these
 * writes from several screens that don't all keep the job loaded.
 *
 * Shared by every store that writes job data (defects, photos) so the rule
 * can't drift between them; inspectionStore.updateAssetResult applies the
 * same check inline.
 */
export function assertJobEditable(jobId: string | undefined | null): void {
  if (!jobId) return;
  const job = getJobById<{ status: string }>(jobId);
  if (job?.status === JobStatus.Completed) {
    throw new Error('This job is completed — tap "Continue Working" to make changes.');
  }
  if (job?.status === JobStatus.Cancelled) {
    throw new Error('This job has been cancelled and can no longer be edited.');
  }
}
