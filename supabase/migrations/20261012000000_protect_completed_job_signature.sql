-- ============================================================
-- Migration: a completed job's signature can't be deleted
-- ============================================================
-- Found 2026-10-12: job e2ccc906 (completed since 17 Sept) lost its
-- client and technician signature at 2026-10-11 17:26:50 UTC, four seconds
-- before its report was generated — so that report went out with no
-- sign-off at all, and the signature images are gone for good.
--
-- How: the app's "Continue Working" queues two changes in one local
-- transaction — re-open the job (status -> in_progress) and delete its
-- signature (a re-opened job must be signed again). On the server they
-- arrive as two separate requests. The job update is a GUARDED one: sync
-- skips it, silently, when the server already holds a later edit of that
-- job (lib/sync.ts _guardedUpdate — right for ordinary edits). The delete
-- has no such guard. So the re-open can be dropped while the delete lands,
-- leaving a job that is still completed with its sign-off destroyed.
--
-- The rule enforced here is the one the app intends: a signature is only
-- ever removed from a job that has actually been re-opened. While the job
-- is still 'completed' on the server, nobody can delete its signature —
-- app, admin portal or a raw API call. Because it runs in the database it
-- covers every app build, including the ones already on devices.
--
-- The error is a check_violation (23514), which the app's sync treats as
-- permanent (lib/syncErrors.ts): a refused delete fails once and stops,
-- the signature stays on the server, and the next report still carries it.
--
-- Unaffected: re-open then re-sign works as before — the re-open is queued
-- first, so the job is no longer 'completed' when the delete arrives.
-- Deleting a job is already refused while it has a signature
-- (signatures_job_id_fkey has no cascade). SECURITY DEFINER so the check
-- always sees the job row, whatever the caller's RLS view of jobs.
--
-- Run this once in the Supabase SQL Editor.
-- ============================================================

CREATE OR REPLACE FUNCTION public.protect_completed_job_signature() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF EXISTS (SELECT 1 FROM public.jobs WHERE id = OLD.job_id AND status = 'completed') THEN
    RAISE EXCEPTION 'Cannot delete the signature of a completed job — re-open the job first.'
      USING ERRCODE = 'check_violation';
  END IF;
  RETURN OLD;
END;
$$;

-- Same policy as every other SECURITY DEFINER function here
-- (20261010020000): only the trigger may run it.
REVOKE EXECUTE ON FUNCTION public.protect_completed_job_signature() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_protect_completed_job_signature ON public.signatures;
CREATE TRIGGER trg_protect_completed_job_signature
  BEFORE DELETE ON public.signatures
  FOR EACH ROW EXECUTE FUNCTION public.protect_completed_job_signature();
