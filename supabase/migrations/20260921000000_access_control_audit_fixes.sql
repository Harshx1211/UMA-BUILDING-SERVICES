-- ============================================================
-- Migration: close the access-control gaps found by a full auth/RLS
-- due-diligence audit (2026-09-14)
-- ============================================================
-- Each fix below closes one specific, independently-verified finding.
-- Grouped in one file since they're all part of the same audit and the
-- same review pass should apply them together — but each block is
-- self-contained and safe to reason about on its own.
--
-- Confirmed safe the same way every prior RLS migration in this schema
-- was: the admin dashboard and the report-generator service both access
-- Postgres via a service-role client, which bypasses RLS and column
-- privileges entirely regardless of anything below — only the mobile
-- app's `authenticated`-role session is affected.
--
-- Run this once in the Supabase SQL Editor.
-- ============================================================

-- ── 1. CRITICAL: users can self-promote to admin / hijack another tenant ──
-- users_update_own_row (20260913000000_tenant_isolation_rls_hardening.sql)
-- is `FOR UPDATE USING (id = auth.uid())` with no WITH CHECK — Postgres
-- reuses USING as the check, which only re-confirms the row's own id is
-- unchanged, never role or company_id. A technician's own session could
-- set role='admin' or move company_id to a different tenant and pass RLS.
--
-- Fix is a column-level lock, not a smarter policy: grepped every write
-- call site in this app (addToSyncQueue and direct supabase.from('users')
-- calls) and confirmed the mobile app never writes to `users` at all
-- today, so this REVOKE breaks nothing currently working. Any future
-- "edit your own profile" feature needs its own explicit, narrower grant
-- when it's actually built — not this one left permissive by default.
REVOKE UPDATE (role, company_id) ON public.users FROM authenticated;

-- ── 2. HIGH: "defect status is admin-only" was a UI convention, not a
-- database rule ──────────────────────────────────────────────────────────
-- defects_tenant_isolation (20260901020000_job_assets_defects_rls.sql) is
-- FOR ALL with no column restriction. store/defectsStore.ts's own
-- updateDefect never includes `status` in its update payload — the only
-- function that would (updateDefectStatus) has zero current call sites,
-- confirmed by repo-wide grep — so this REVOKE only closes a currently-
-- unused capability, it doesn't break anything live.
REVOKE UPDATE (status) ON public.defects FROM authenticated;

-- ── 3. HIGH: the company's pricing catalogue is technician-writable ──────
-- asset_type_definitions/defect_codes/inventory_items
-- (20260907000000_catalogue_rls.sql) are FOR ALL with no role check, even
-- though store/catalogueStore.ts and lib/sync.ts only ever SELECT these —
-- confirmed zero .insert()/.update() call sites anywhere in the mobile app.
REVOKE INSERT, UPDATE, DELETE ON public.asset_type_definitions FROM authenticated;
REVOKE INSERT, UPDATE, DELETE ON public.defect_codes           FROM authenticated;
REVOKE INSERT, UPDATE, DELETE ON public.inventory_items        FROM authenticated;

-- ── 4. HIGH: public.signatures has no RLS policy in the tracked history ──
-- Every sibling table on the same per-job realtime channel (job_assets,
-- defects, inspection_photos, job_technicians, time_logs) already has its
-- own explicit hardening migration; this one never did. Unlike those other
-- tables, the mobile app DOES write to signatures (app/(app)/jobs/[id]/
-- signature.tsx, jobs/[id]/index.tsx — Insert/Update/Delete), so this needs
-- the same read+write, company-scoped FOR ALL pattern those use, not a
-- read-only one.
ALTER TABLE public.signatures ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "signatures_tenant_isolation" ON public.signatures;
CREATE POLICY "signatures_tenant_isolation" ON public.signatures
  FOR ALL USING (company_id = public.get_user_company_id());

-- ── 5. HIGH: any technician can reassign any job's crew, company-wide ────
-- job_technicians_tenant_isolation (20260824020000_job_technicians.sql) is
-- FOR ALL, company-scoped only — the app's own code comment on that same
-- migration says this should be "admin-only, bar the one self-assign
-- Insert in site-inspect.tsx," confirmed as the only mobile write call
-- site by repo-wide grep. Split into SELECT (company-wide, so crew lists
-- still resolve names) and INSERT (self-assign only) — no UPDATE/DELETE
-- grant for the mobile role at all, since nothing mobile-side does either.
DROP POLICY IF EXISTS "job_technicians_tenant_isolation" ON public.job_technicians;

CREATE POLICY "job_technicians_select_company" ON public.job_technicians
  FOR SELECT USING (company_id = public.get_user_company_id());

CREATE POLICY "job_technicians_self_assign_insert" ON public.job_technicians
  FOR INSERT WITH CHECK (
    company_id = public.get_user_company_id()
    AND user_id = auth.uid()
  );

-- ── 6. HIGH: every technician can see every colleague's GPS clock-in/out,
-- company-wide ────────────────────────────────────────────────────────────
-- time_logs_select_company was company-scoped only. The mobile app DOES
-- need to see a job's whole crew's time logs while viewing that job (the
-- per-job live channel in lib/sync.ts subscribes to time_logs unfiltered
-- by user, matching the PDF sign-off page's "every assigned technician"
-- crew list) — so this narrows to "your own rows, or a job you're actually
-- assigned to," not just "your own rows," which would have broken that
-- legitimate crew-visibility feature.
DROP POLICY IF EXISTS "time_logs_select_company" ON public.time_logs;
CREATE POLICY "time_logs_select_own_or_assigned_job" ON public.time_logs
  FOR SELECT USING (
    company_id = public.get_user_company_id()
    AND (
      user_id = auth.uid()
      OR EXISTS (
        SELECT 1 FROM public.job_technicians jt
        WHERE jt.job_id = time_logs.job_id AND jt.user_id = auth.uid()
      )
    )
  );

-- ── 7. HIGH: jobs/properties/assets can be permanently DELETEd by any
-- technician, a capability neither app's UI ever offers ──────────────────
-- properties_tenant_isolation/assets_tenant_isolation/jobs_tenant_isolation
-- (20260913000000_tenant_isolation_rls_hardening.sql) are FOR ALL, which
-- includes DELETE. Repo-wide grep for a delete call site against any of
-- these three tables from the mobile app returns none. Revoking DELETE
-- from the mobile role leaves SELECT/INSERT/UPDATE exactly as they are —
-- only removes a capability nothing legitimate uses.
REVOKE DELETE ON public.jobs, public.properties, public.assets FROM authenticated;
