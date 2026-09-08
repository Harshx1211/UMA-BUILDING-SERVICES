-- ============================================================
-- Migration: harden log_deletion() — exception safety + company_id fallback
-- ============================================================
-- Two gaps found by a follow-up review of 20260910000000_deletion_log.sql:
--
-- 1. The trigger function had no exception handling at all. Any failure
--    inside it (an unexpected constraint, a future RLS/schema change on
--    deletion_log) propagates out of an AFTER trigger and rolls back the
--    whole transaction — meaning a broken deletion LOG could start
--    silently blocking the actual DELETE it's attached to, on all 9
--    tables. Wrapped in EXCEPTION WHEN OTHERS so a logging failure can
--    never block a real delete.
--
-- 2. quotes/quote_items both have a NULLABLE company_id column (unlike
--    every other table this trigger is attached to, which is NOT NULL).
--    If a row's own company_id is ever null, (to_jsonb(OLD)->>'company_id')
--    produces a NULL deletion_log row — and since `NULL = anything` is
--    never true in SQL, that row silently fails every tenant's RLS SELECT
--    filter forever, so the deletion never propagates to any device, live
--    or via the periodic catch-up. Falls back to looking up company_id via
--    the row's own job_id (covers job_assets/defects/inspection_photos/
--    site_documents/signatures/quotes/time_logs/job_technicians — all of
--    which carry job_id) or, for quote_items specifically (no job_id of
--    its own), via its quote_id -> quotes.company_id.
--
-- Run this once in the Supabase SQL Editor.
-- ============================================================

CREATE OR REPLACE FUNCTION public.log_deletion() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_company_id uuid;
  v_row jsonb;
BEGIN
  v_row := to_jsonb(OLD);
  v_company_id := (v_row ->> 'company_id')::uuid;

  IF v_company_id IS NULL THEN
    IF (v_row ? 'job_id') AND (v_row ->> 'job_id') IS NOT NULL THEN
      SELECT company_id INTO v_company_id FROM public.jobs WHERE id = (v_row ->> 'job_id')::uuid;
    ELSIF (v_row ? 'quote_id') AND (v_row ->> 'quote_id') IS NOT NULL THEN
      SELECT company_id INTO v_company_id FROM public.quotes WHERE id = (v_row ->> 'quote_id')::uuid;
    END IF;
  END IF;

  INSERT INTO public.deletion_log (company_id, table_name, record_id)
  VALUES (v_company_id, TG_TABLE_NAME, OLD.id);
  RETURN OLD;
EXCEPTION WHEN OTHERS THEN
  -- Never let a logging failure block the real delete it's attached to.
  RETURN OLD;
END;
$$;
