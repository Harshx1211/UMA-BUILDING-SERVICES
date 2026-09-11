-- ============================================================
-- Migration: explicit tenant-isolation RLS for every table the mobile
-- app's whole-session Realtime channel subscribes to unfiltered
-- ============================================================
-- Found by a dedicated audit of the sync/realtime architecture: the
-- whole-session live channel (subscribeToMyDataLive, lib/sync.ts)
-- subscribes to jobs/assets/properties/notifications/users with NO
-- Realtime-level filter — it relies entirely on Postgres RLS to make sure
-- a row never reaches a device it doesn't belong to in the first place,
-- the same way job_assets/defects already had this restored earlier
-- (20260901020000_job_assets_defects_rls.sql) and the catalogue tables
-- (20260907000000_catalogue_rls.sql). This repo's own supabase/schema.sql
-- is explicitly "columns only, not full DDL/RLS" and a standalone script
-- (supabase/scripts/check_properties_rls.sql) exists purely to query the
-- LIVE database for whether jobs/properties actually have policies — i.e.
-- these were never committed as tracked migrations, so there's no way to
-- confirm from this repo alone that they're correct today. This migration
-- doesn't assume they're broken; it (re)asserts the intended policy
-- explicitly and idempotently, so running it is safe whether they were
-- already correct, missing, or wrong — DROP POLICY IF EXISTS + CREATE
-- POLICY either replaces an identical policy with itself or fixes a gap,
-- with nothing in between that could make it worse.
--
-- What each table actually needs was checked against real app code (not
-- guessed) — grepped every addToSyncQueue call site to see what the
-- mobile app genuinely reads and writes:
--   - properties, assets, jobs: mobile app both reads AND writes these
--     (compliance_status, asset create/edit, job status/notes/report_url)
--     — same FOR ALL / company_id pattern as job_assets/defects.
--   - users: technicians need to see colleagues' names (crew lists,
--     actioned_by resolution) — company-wide SELECT — but should only
--     ever be able to WRITE their own row (profile.tsx only ever updates
--     phone on the logged-in user's own id) — SELECT is company-wide,
--     UPDATE is restricted to id = auth.uid().
--   - companies: the mobile app reads its own company's profile
--     (subscription status, branding for reports) but never writes it —
--     SELECT-only, own company only.
--   - notifications: has NO company_id column at all (see schema.sql) —
--     company-wide scoping isn't even expressible here. The mobile app
--     never pushes a write to this table (grepped for
--     addToSyncQueue('notifications', ...) — none exists; markAsRead is
--     local-SQLite-only) — SELECT-only, own notifications or a genuine
--     broadcast (user_id IS NULL).
--   - quotes, quote_items, time_logs: the mobile app currently only ever
--     reads these (no addToSyncQueue call site writes any of them) —
--     SELECT-only. quotes.company_id and quote_items.company_id are both
--     nullable (unlike every other table here) — same fallback-via-job_id
--     (quotes) / via-quote_id (quote_items) pattern already established
--     in log_deletion() (20260911000000_deletion_log_trigger_hardening.sql).
--
-- Confirmed safe the same way the job_assets/defects migration was: the
-- admin dashboard and report-generator service both use a service-role
-- client, which bypasses RLS entirely regardless of policy content — only
-- the mobile app's authenticated-role session is affected here.
--
-- Run this once in the Supabase SQL Editor.
-- ============================================================

-- Defensive — recreates the lookup function every tenant-isolation policy
-- in this schema depends on, in case it's ever missing. Identical
-- definition to the one already live (job_assets_defects_rls.sql).
CREATE OR REPLACE FUNCTION public.get_user_company_id()
RETURNS uuid
LANGUAGE sql SECURITY DEFINER SET search_path = public
STABLE
AS $$
  SELECT company_id FROM public.users WHERE id = auth.uid();
$$;

-- ── properties / assets / jobs — read+write, company-scoped ──────────────
ALTER TABLE public.properties ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.assets     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.jobs       ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "properties_tenant_isolation" ON public.properties;
CREATE POLICY "properties_tenant_isolation" ON public.properties
  FOR ALL USING (company_id = public.get_user_company_id());

DROP POLICY IF EXISTS "assets_tenant_isolation" ON public.assets;
CREATE POLICY "assets_tenant_isolation" ON public.assets
  FOR ALL USING (company_id = public.get_user_company_id());

DROP POLICY IF EXISTS "jobs_tenant_isolation" ON public.jobs;
CREATE POLICY "jobs_tenant_isolation" ON public.jobs
  FOR ALL USING (company_id = public.get_user_company_id());

-- ── users — company-wide read (colleague names), own-row-only write ──────
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "users_select_company" ON public.users;
CREATE POLICY "users_select_company" ON public.users
  FOR SELECT USING (company_id = public.get_user_company_id());

DROP POLICY IF EXISTS "users_update_own_row" ON public.users;
CREATE POLICY "users_update_own_row" ON public.users
  FOR UPDATE USING (id = auth.uid());

-- ── companies — read own company only, no mobile-app writes ──────────────
ALTER TABLE public.companies ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "companies_select_own" ON public.companies;
CREATE POLICY "companies_select_own" ON public.companies
  FOR SELECT USING (id = public.get_user_company_id());

-- ── notifications — no company_id column; own rows or a real broadcast ───
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "notifications_select_own_or_broadcast" ON public.notifications;
CREATE POLICY "notifications_select_own_or_broadcast" ON public.notifications
  FOR SELECT USING (user_id = auth.uid() OR user_id IS NULL);

-- ── quotes / quote_items / time_logs — read-only from the mobile app ─────
ALTER TABLE public.quotes      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quote_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.time_logs   ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "quotes_select_company" ON public.quotes;
CREATE POLICY "quotes_select_company" ON public.quotes
  FOR SELECT USING (
    COALESCE(company_id, (SELECT j.company_id FROM public.jobs j WHERE j.id = quotes.job_id))
      = public.get_user_company_id()
  );

DROP POLICY IF EXISTS "quote_items_select_company" ON public.quote_items;
CREATE POLICY "quote_items_select_company" ON public.quote_items
  FOR SELECT USING (
    COALESCE(
      company_id,
      (SELECT COALESCE(q.company_id, j.company_id)
         FROM public.quotes q JOIN public.jobs j ON j.id = q.job_id
        WHERE q.id = quote_items.quote_id)
    ) = public.get_user_company_id()
  );

DROP POLICY IF EXISTS "time_logs_select_company" ON public.time_logs;
CREATE POLICY "time_logs_select_company" ON public.time_logs
  FOR SELECT USING (company_id = public.get_user_company_id());
