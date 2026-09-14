-- ============================================================
-- Migration: wrap public.get_user_company_id() as (select ...) in every
-- RLS policy that calls it, so Postgres evaluates it once per statement
-- instead of once per row scanned
-- ============================================================
-- Pure performance change, not a security fix — get_user_company_id() is
-- STABLE (supabase/migrations/20260913000000_tenant_isolation_rls_hardening.sql),
-- so its result can't change mid-statement; wrapping it as a scalar
-- subquery is the documented Postgres/Supabase pattern that lets the
-- planner cache the one result instead of re-invoking the function (which
-- itself does a SELECT against public.users) for every row a policy scans.
-- This was flagged as a code-quality finding, not a bug: every WHERE
-- condition below is copied verbatim from the CURRENT live definition of
-- each policy (traced through all 42 migrations to account for ones that
-- were later DROP+CREATE'd under a new name or shape — e.g. time_logs and
-- job_technicians were both replaced by 20260921000000_access_control_
-- audit_fixes.sql, so this migration matches THOSE definitions, not their
-- now-superseded originals) — only the function call itself changes.
--
-- Run this once in the Supabase SQL Editor, after the other 20260921
-- migrations.
-- ============================================================

DROP POLICY IF EXISTS "properties_tenant_isolation" ON public.properties;
CREATE POLICY "properties_tenant_isolation" ON public.properties
  FOR ALL USING (company_id = (select public.get_user_company_id()));

DROP POLICY IF EXISTS "assets_tenant_isolation" ON public.assets;
CREATE POLICY "assets_tenant_isolation" ON public.assets
  FOR ALL USING (company_id = (select public.get_user_company_id()));

DROP POLICY IF EXISTS "jobs_tenant_isolation" ON public.jobs;
CREATE POLICY "jobs_tenant_isolation" ON public.jobs
  FOR ALL USING (company_id = (select public.get_user_company_id()));

DROP POLICY IF EXISTS "users_select_company" ON public.users;
CREATE POLICY "users_select_company" ON public.users
  FOR SELECT USING (company_id = (select public.get_user_company_id()));

DROP POLICY IF EXISTS "companies_select_own" ON public.companies;
CREATE POLICY "companies_select_own" ON public.companies
  FOR SELECT USING (id = (select public.get_user_company_id()));

DROP POLICY IF EXISTS "quotes_select_company" ON public.quotes;
CREATE POLICY "quotes_select_company" ON public.quotes
  FOR SELECT USING (
    COALESCE(company_id, (SELECT j.company_id FROM public.jobs j WHERE j.id = quotes.job_id))
      = (select public.get_user_company_id())
  );

DROP POLICY IF EXISTS "quote_items_select_company" ON public.quote_items;
CREATE POLICY "quote_items_select_company" ON public.quote_items
  FOR SELECT USING (
    COALESCE(
      company_id,
      (SELECT COALESCE(q.company_id, j.company_id)
         FROM public.quotes q JOIN public.jobs j ON j.id = q.job_id
        WHERE q.id = quote_items.quote_id)
    ) = (select public.get_user_company_id())
  );

-- Current live definition (replaced the original time_logs_select_company
-- in 20260921000000_access_control_audit_fixes.sql) — matched exactly.
DROP POLICY IF EXISTS "time_logs_select_own_or_assigned_job" ON public.time_logs;
CREATE POLICY "time_logs_select_own_or_assigned_job" ON public.time_logs
  FOR SELECT USING (
    company_id = (select public.get_user_company_id())
    AND (
      user_id = auth.uid()
      OR EXISTS (
        SELECT 1 FROM public.job_technicians jt
        WHERE jt.job_id = time_logs.job_id AND jt.user_id = auth.uid()
      )
    )
  );

-- Current live definitions (replaced the original job_technicians_tenant_isolation
-- in 20260921000000_access_control_audit_fixes.sql) — matched exactly.
DROP POLICY IF EXISTS "job_technicians_select_company" ON public.job_technicians;
CREATE POLICY "job_technicians_select_company" ON public.job_technicians
  FOR SELECT USING (company_id = (select public.get_user_company_id()));

DROP POLICY IF EXISTS "job_technicians_self_assign_insert" ON public.job_technicians;
CREATE POLICY "job_technicians_self_assign_insert" ON public.job_technicians
  FOR INSERT WITH CHECK (
    company_id = (select public.get_user_company_id())
    AND user_id = auth.uid()
  );

DROP POLICY IF EXISTS "asset_tags_tenant_isolation" ON public.asset_tags;
CREATE POLICY "asset_tags_tenant_isolation" ON public.asset_tags
  FOR ALL
  USING (company_id = (select public.get_user_company_id()));

DROP POLICY IF EXISTS "asset_tag_assignments_tenant_isolation" ON public.asset_tag_assignments;
CREATE POLICY "asset_tag_assignments_tenant_isolation" ON public.asset_tag_assignments
  FOR ALL
  USING (company_id = (select public.get_user_company_id()));

DROP POLICY IF EXISTS "site_documents_tenant_isolation" ON public.site_documents;
CREATE POLICY "site_documents_tenant_isolation" ON public.site_documents
  FOR ALL
  USING (company_id = (select public.get_user_company_id()));

DROP POLICY IF EXISTS "job_assets_tenant_isolation" ON public.job_assets;
CREATE POLICY "job_assets_tenant_isolation" ON public.job_assets
  FOR ALL
  USING (company_id = (select public.get_user_company_id()));

DROP POLICY IF EXISTS "defects_tenant_isolation" ON public.defects;
CREATE POLICY "defects_tenant_isolation" ON public.defects
  FOR ALL
  USING (company_id = (select public.get_user_company_id()));

DROP POLICY IF EXISTS "field_audit_log_tenant_isolation" ON public.field_audit_log;
CREATE POLICY "field_audit_log_tenant_isolation" ON public.field_audit_log
  FOR ALL
  USING (company_id = (select public.get_user_company_id()));

DROP POLICY IF EXISTS "inspection_photos_tenant_isolation" ON public.inspection_photos;
CREATE POLICY "inspection_photos_tenant_isolation" ON public.inspection_photos
  FOR ALL
  USING (company_id = (select public.get_user_company_id()));

DROP POLICY IF EXISTS "asset_type_definitions_tenant_isolation" ON public.asset_type_definitions;
CREATE POLICY "asset_type_definitions_tenant_isolation" ON public.asset_type_definitions
  FOR ALL
  USING (company_id = (select public.get_user_company_id()));

DROP POLICY IF EXISTS "defect_codes_tenant_isolation" ON public.defect_codes;
CREATE POLICY "defect_codes_tenant_isolation" ON public.defect_codes
  FOR ALL
  USING (company_id = (select public.get_user_company_id()));

DROP POLICY IF EXISTS "inventory_items_tenant_isolation" ON public.inventory_items;
CREATE POLICY "inventory_items_tenant_isolation" ON public.inventory_items
  FOR ALL
  USING (company_id = (select public.get_user_company_id()));

DROP POLICY IF EXISTS "deletion_log_tenant_isolation" ON public.deletion_log;
CREATE POLICY "deletion_log_tenant_isolation" ON public.deletion_log
  FOR SELECT
  USING (company_id = (select public.get_user_company_id()));

DROP POLICY IF EXISTS "property_notebook_items_tenant_isolation" ON public.property_notebook_items;
CREATE POLICY "property_notebook_items_tenant_isolation" ON public.property_notebook_items
  FOR ALL
  USING (company_id = (select public.get_user_company_id()));

-- Current live definition (created earlier today by
-- 20260921000000_access_control_audit_fixes.sql — the signatures table had
-- no RLS policy anywhere before that) — matched exactly.
DROP POLICY IF EXISTS "signatures_tenant_isolation" ON public.signatures;
CREATE POLICY "signatures_tenant_isolation" ON public.signatures
  FOR ALL USING (company_id = (select public.get_user_company_id()));

-- ============================================================
-- Verification: every policy above should now show `(SELECT ...)` in its
-- qual/with_check when inspected — run this after applying, expect 0 rows:
--
-- SELECT schemaname, tablename, policyname, qual, with_check
-- FROM pg_policies
-- WHERE schemaname = 'public'
--   AND (
--     (qual IS NOT NULL AND qual ILIKE '%get_user_company_id()%' AND qual NOT ILIKE '%SELECT%get_user_company_id()%')
--     OR
--     (with_check IS NOT NULL AND with_check ILIKE '%get_user_company_id()%' AND with_check NOT ILIKE '%SELECT%get_user_company_id()%')
--   );
-- ============================================================
