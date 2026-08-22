import { SupabaseClient } from '@supabase/supabase-js';

const STALE_LOCK_MS = 10 * 60 * 1000; // a crashed generation shouldn't lock a job forever

export type LockResult = { acquired: true } | { acquired: false; reason: string };

export interface GenerationStatus {
  status: 'not_started' | 'generating' | 'completed' | 'failed';
  lastError: string | null;
  /** When the current status was last set — for 'generating', this is the
   * real generation start time (tryAcquireLock is the only thing that sets
   * status to 'generating'), letting the client show accurate elapsed time
   * that survives app restarts and revisiting the screen, instead of a local
   * timer that resets to 0 every time the polling screen remounts. */
  updatedAt: string | null;
}

/**
 * Idempotency guard — a retried request (network hiccup, user double-tapping
 * "Generate Report") must not spin up a second full Gotenberg pipeline for the
 * same job. Table: report_generation_status(job_id PK, status, last_error,
 * updated_at) — see the migrations in supabase/migrations/.
 *
 * This table doubles as the async status the mobile app polls (see
 * GET /report-status in index.ts) — the request that kicks off generation
 * responds immediately once this lock is acquired, rather than holding the
 * HTTP connection open for the entire generation, which turned out to be
 * fragile on mobile networks for anything but the smallest jobs.
 */
export async function tryAcquireLock(db: SupabaseClient, jobId: string): Promise<LockResult> {
  const { data: existing } = await db
    .from('report_generation_status')
    .select('status, updated_at')
    .eq('job_id', jobId)
    .maybeSingle();

  if (existing?.status === 'generating') {
    const age = Date.now() - new Date(existing.updated_at).getTime();
    if (age < STALE_LOCK_MS) {
      return { acquired: false, reason: 'A report is already being generated for this job.' };
    }
    // Stale lock from a crashed/timed-out run — safe to reclaim.
  }

  const { error } = await db
    .from('report_generation_status')
    .upsert({ job_id: jobId, status: 'generating', last_error: null, updated_at: new Date().toISOString() }, { onConflict: 'job_id' });

  if (error) return { acquired: false, reason: `Failed to acquire generation lock: ${error.message}` };
  return { acquired: true };
}

export async function markGenerationResult(
  db: SupabaseClient,
  jobId: string,
  status: 'completed' | 'failed',
  lastError: string | null = null,
): Promise<void> {
  await db
    .from('report_generation_status')
    .upsert({ job_id: jobId, status, last_error: lastError, updated_at: new Date().toISOString() }, { onConflict: 'job_id' });
}

export async function getGenerationStatus(db: SupabaseClient, jobId: string): Promise<GenerationStatus> {
  const { data } = await db
    .from('report_generation_status')
    .select('status, last_error, updated_at')
    .eq('job_id', jobId)
    .maybeSingle();

  if (!data) return { status: 'not_started', lastError: null, updatedAt: null };
  return { status: data.status, lastError: data.last_error ?? null, updatedAt: data.updated_at ?? null };
}
