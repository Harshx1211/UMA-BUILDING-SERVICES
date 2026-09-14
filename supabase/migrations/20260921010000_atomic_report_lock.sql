-- ============================================================
-- Migration: atomic report-generation lock acquisition
-- ============================================================
-- services/report-generator/src/generation/lock.ts's tryAcquireLock() used
-- to SELECT the current status, then separately UPSERT to 'generating' —
-- two round trips with a window between them. Two near-simultaneous
-- requests for the same job (a double-tapped "Generate Report", or a
-- client retrying a timed-out request) could both pass the SELECT's "not
-- already generating" check before either UPSERT landed, both then set
-- status='generating' and both return {acquired: true} — running two full
-- Gotenberg PDF pipelines for the same job at once, with whichever
-- finishes last silently deciding the job's final report.
--
-- Postgres's `INSERT ... ON CONFLICT DO UPDATE ... WHERE <condition>` is a
-- single atomic statement — the WHERE clause is evaluated against the
-- conflicting row as part of the same operation that would update it, not
-- as a separate prior check, so there's no window for a second call to
-- slip through. ROW_COUNT tells the caller whether its own call was the
-- one that actually acquired the lock.
--
-- Run this once in the Supabase SQL Editor.
-- ============================================================

CREATE OR REPLACE FUNCTION public.try_acquire_report_lock(p_job_id uuid, p_stale_before timestamptz)
RETURNS boolean
LANGUAGE plpgsql
AS $$
DECLARE
  v_rows integer;
BEGIN
  INSERT INTO public.report_generation_status (job_id, status, last_error, updated_at)
  VALUES (p_job_id, 'generating', NULL, now())
  ON CONFLICT (job_id) DO UPDATE
    SET status = 'generating', last_error = NULL, updated_at = now()
    WHERE report_generation_status.status IS DISTINCT FROM 'generating'
       OR report_generation_status.updated_at < p_stale_before;

  GET DIAGNOSTICS v_rows = ROW_COUNT;
  RETURN v_rows > 0;
END;
$$;

-- The report-generator service calls this via a service-role client, which
-- already bypasses RLS entirely — this grant just lets that role execute
-- the function at all (Postgres functions aren't executable by default).
GRANT EXECUTE ON FUNCTION public.try_acquire_report_lock(uuid, timestamptz) TO service_role;
