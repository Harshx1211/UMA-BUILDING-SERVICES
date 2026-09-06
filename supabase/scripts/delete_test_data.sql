-- Deletes the "QA Test Co" test company created by create_test_data.js —
-- the test admin, the test technician, both test sites, and every asset
-- under them. Scoped to that one company by name, so it's safe to run
-- even if real companies exist alongside it.
--
-- Kept untouched, same as the full teardown script: the global catalogue
-- (asset_type_definitions/defect_codes WHERE company_id IS NULL) and
-- super_admins/platform_settings.
--
-- Wrapped in a transaction: if anything errors, nothing commits.
-- Run the whole file in one go in the Supabase SQL Editor (choose "Run
-- without RLS" if prompted — the temp table below is session-local
-- scratch space, never exposed via the API, so RLS doesn't apply to it).

BEGIN;

CREATE TEMP TABLE _qa_teardown_company_id ON COMMIT DROP AS
  SELECT id FROM public.companies WHERE name = 'QA Test Co';

CREATE TEMP TABLE _qa_teardown_user_ids ON COMMIT DROP AS
  SELECT id FROM public.users WHERE company_id IN (SELECT id FROM _qa_teardown_company_id);

-- ── Company-scoped data, children before parents ───────────────────────────
DELETE FROM public.quote_items       WHERE company_id IN (SELECT id FROM _qa_teardown_company_id);
DELETE FROM public.quotes            WHERE company_id IN (SELECT id FROM _qa_teardown_company_id);
DELETE FROM public.inspection_photos WHERE company_id IN (SELECT id FROM _qa_teardown_company_id);
DELETE FROM public.time_logs         WHERE company_id IN (SELECT id FROM _qa_teardown_company_id);
DELETE FROM public.signatures        WHERE company_id IN (SELECT id FROM _qa_teardown_company_id);
DELETE FROM public.defects           WHERE company_id IN (SELECT id FROM _qa_teardown_company_id);
DELETE FROM public.job_assets        WHERE company_id IN (SELECT id FROM _qa_teardown_company_id);
DELETE FROM public.jobs              WHERE company_id IN (SELECT id FROM _qa_teardown_company_id);
DELETE FROM public.asset_tags        WHERE company_id IN (SELECT id FROM _qa_teardown_company_id);
DELETE FROM public.assets            WHERE company_id IN (SELECT id FROM _qa_teardown_company_id);
DELETE FROM public.properties        WHERE company_id IN (SELECT id FROM _qa_teardown_company_id);

-- ── This company's own catalogue copy only — company_id IS NULL (the ──────
--    shared global defaults) is never matched by this filter ─────────────
DELETE FROM public.asset_type_definitions WHERE company_id IN (SELECT id FROM _qa_teardown_company_id);
DELETE FROM public.defect_codes           WHERE company_id IN (SELECT id FROM _qa_teardown_company_id);
DELETE FROM public.inventory_items        WHERE company_id IN (SELECT id FROM _qa_teardown_company_id);
DELETE FROM public.enquiries              WHERE company_id IN (SELECT id FROM _qa_teardown_company_id);

-- ── Rows that reference the users we're about to delete ────────────────────
DELETE FROM public.audit_logs   WHERE changed_by IN (SELECT id FROM _qa_teardown_user_ids);
DELETE FROM public.notifications WHERE user_id IN (SELECT id FROM _qa_teardown_user_ids);

-- ── The test users, then the company ────────────────────────────────────────
DELETE FROM public.users WHERE id IN (SELECT id FROM _qa_teardown_user_ids);
DELETE FROM auth.users   WHERE id IN (SELECT id FROM _qa_teardown_user_ids);
DELETE FROM public.companies WHERE id IN (SELECT id FROM _qa_teardown_company_id);

COMMIT;
