import { SupabaseClient } from '@supabase/supabase-js';

const STALE_LOCK_MS = 10 * 60 * 1000; // a crashed generation shouldn't lock a job forever

export type LockResult = { acquired: true } | { acquired: false; reason: string };

/**
 * Idempotency guard — a retried request (network hiccup, user double-tapping
 * "Generate Report") must not spin up a second full Gotenberg pipeline for the
 * same job. Table: report_generation_status(job_id PK, status, updated_at) —
 * see the migration in supabase/migrations/.
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
    .upsert({ job_id: jobId, status: 'generating', updated_at: new Date().toISOString() }, { onConflict: 'job_id' });

  if (error) return { acquired: false, reason: `Failed to acquire generation lock: ${error.message}` };
  return { acquired: true };
}

export async function markGenerationResult(
  db: SupabaseClient,
  jobId: string,
  status: 'completed' | 'failed',
): Promise<void> {
  await db
    .from('report_generation_status')
    .upsert({ job_id: jobId, status, updated_at: new Date().toISOString() }, { onConflict: 'job_id' });
}
