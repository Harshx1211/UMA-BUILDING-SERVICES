-- ============================================================
-- Migration: move quote/job business rules from browser-only to
-- server-enforced (DB constraints + triggers)
-- ============================================================
-- A hostile due-diligence pass found that "no negative quote prices",
-- "locked after approval", and "signature required to complete a job"
-- only existed as client-side checks in admin/src/app/(dashboard)/quotes/
-- page.tsx and the mobile app's jobs/[id]/index.tsx. Every one of those
-- checks can be bypassed by a raw request: the admin dashboard's generic
-- CRUD API (src/app/api/admin/route.ts) uses the service_role key and
-- validates none of this, and a technician's own mobile session (anon key
-- + real JWT, both extractable from the shipped app) can write directly to
-- Supabase via RLS-scoped `defects`/`jobs` policies that are FOR ALL with
-- no status/column restriction.
--
-- Triggers fire regardless of RLS or service_role, so this closes the gap
-- for BOTH write paths at once, without touching either app's UI logic
-- (which stays as the fast, friendly first line of defence it already is).
--
-- Run this once in the Supabase SQL Editor.
-- ============================================================

-- ── 1. No negative prices, at the DB level ─────────────────────────────
ALTER TABLE public.defects
  DROP CONSTRAINT IF EXISTS defects_quote_price_non_negative,
  ADD CONSTRAINT defects_quote_price_non_negative CHECK (quote_price IS NULL OR quote_price >= 0);

ALTER TABLE public.quotes
  DROP CONSTRAINT IF EXISTS quotes_total_amount_non_negative,
  ADD CONSTRAINT quotes_total_amount_non_negative CHECK (total_amount >= 0);

-- ── 2. A defect's quote_price can't move once its quote is decided ────
-- defects has no quote_id column — a defect belongs to "the quote for its
-- job", found the same way the admin dashboard itself resolves it
-- (quotes/page.tsx: the latest quotes row for that job_id, by created_at).
CREATE OR REPLACE FUNCTION public.prevent_locked_quote_defect_price_edit() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_status text;
BEGIN
  IF NEW.quote_price IS NOT DISTINCT FROM OLD.quote_price THEN
    RETURN NEW;
  END IF;

  SELECT status INTO v_status
  FROM public.quotes
  WHERE job_id = NEW.job_id
  ORDER BY created_at DESC
  LIMIT 1;

  IF v_status IN ('approved', 'rejected') THEN
    RAISE EXCEPTION 'Cannot change quote_price on a defect whose quote is %. Revise the quote back to draft first.', v_status;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_prevent_locked_quote_defect_price_edit ON public.defects;
CREATE TRIGGER trg_prevent_locked_quote_defect_price_edit
  BEFORE UPDATE ON public.defects
  FOR EACH ROW EXECUTE FUNCTION public.prevent_locked_quote_defect_price_edit();

-- ── 3. A decided quote's total_amount can't move without reopening it ─
-- Allows approveQuote/rejectQuote (status changes INTO approved/rejected
-- together with total_amount) and reviseQuote (status back to draft) —
-- blocks only "total_amount changes while status stays approved/rejected".
CREATE OR REPLACE FUNCTION public.prevent_locked_quote_amount_edit() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF OLD.status IN ('approved', 'rejected')
     AND NEW.status = OLD.status
     AND NEW.total_amount IS DISTINCT FROM OLD.total_amount THEN
    RAISE EXCEPTION 'Cannot change total_amount on a % quote without first reverting it to draft.', OLD.status;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_prevent_locked_quote_amount_edit ON public.quotes;
CREATE TRIGGER trg_prevent_locked_quote_amount_edit
  BEFORE UPDATE ON public.quotes
  FOR EACH ROW EXECUTE FUNCTION public.prevent_locked_quote_amount_edit();

-- ── 4. A job can't be flipped to completed (via UPDATE) without a
--       captured signature ─────────────────────────────────────────────
-- Mirrors the mobile app's OWN existing rule exactly (jobs/[id]/index.tsx's
-- "last-line-of-defence signature guard") — not a new, stricter rule.
-- Deliberately does NOT also require every job_asset to have a result:
-- the app itself has no such gate today (only the signature check), so
-- adding one here would reject completions the app currently allows.
--
-- Deliberately UPDATE-only, not INSERT: app/(app)/properties/site-inspect/
-- [id].tsx's "quick on-site inspection" flow INSERTS a job that's already
-- status='completed' in one step, with no signature step anywhere in that
-- screen — that's how it's designed today, not a bug this migration should
-- silently break. This closes the exploit the audit actually demonstrated
-- (a raw PATCH flipping an existing scheduled/in-progress job straight to
-- completed, skipping the app's own signature screen) without touching
-- that separate, intentionally-lighter-weight flow. Flagged separately:
-- whether on-site walkthroughs should also require sign-off is a real,
-- distinct product question, not folded into this fix.
ALTER TABLE public.jobs ADD COLUMN IF NOT EXISTS completed_at timestamp with time zone;

CREATE OR REPLACE FUNCTION public.enforce_job_completion_requirements() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.status = 'completed' AND OLD.status IS DISTINCT FROM 'completed' THEN
    IF NOT EXISTS (SELECT 1 FROM public.signatures WHERE job_id = NEW.id) THEN
      RAISE EXCEPTION 'Cannot complete job: no signature has been captured yet.';
    END IF;
    IF NEW.completed_at IS NULL THEN
      NEW.completed_at = now();
    END IF;
  ELSIF NEW.status IS DISTINCT FROM 'completed' AND OLD.status = 'completed' THEN
    NEW.completed_at = NULL;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_enforce_job_completion_requirements ON public.jobs;
CREATE TRIGGER trg_enforce_job_completion_requirements
  BEFORE UPDATE ON public.jobs
  FOR EACH ROW EXECUTE FUNCTION public.enforce_job_completion_requirements();
