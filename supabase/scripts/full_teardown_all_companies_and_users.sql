-- FULL TEARDOWN — deletes every company, every row under every company, and
-- every user login belonging to those companies. Run full_teardown_preview.sql
-- FIRST and read its output before running this.
--
-- Kept untouched on purpose:
--   * the global catalogue — asset_type_definitions/defect_codes WHERE
--     company_id IS NULL. These are the shared defaults the auto-seed
--     trigger (seed_default_catalogue_for_new_company) copies into any new
--     company, so a future company still comes up with the full asset
--     type/defect code list.
--   * super_admins / platform_settings — the separate superadmin console
--     login and its settings, unrelated to any company.
--   * Storage objects (job-photos / job-reports buckets) — already cleared
--     manually, not touched by this script.
--
-- Wrapped in a single transaction: if any statement errors, nothing commits
-- and the database is left exactly as it was. Run the whole file in one go
-- in the Supabase SQL Editor.

BEGIN;

-- Snapshot the company + user ids up front, before anything is deleted, so
-- every later step (including the auth.users delete at the very end) works
-- off the same fixed list regardless of what's already been removed.
CREATE TEMP TABLE _teardown_company_ids ON COMMIT DROP AS
  SELECT id FROM public.companies;

CREATE TEMP TABLE _teardown_user_ids ON COMMIT DROP AS
  SELECT id FROM public.users WHERE company_id IN (SELECT id FROM _teardown_company_ids);

-- ── 1. Company-scoped transactional data, children before parents ─────────
-- job_technicians, report_generation_status, and asset_tag_assignments all
-- cascade automatically (ON DELETE CASCADE from job_id/asset_id/tag_id) once
-- jobs/assets/asset_tags below are deleted, so they don't need their own line.
DELETE FROM public.quote_items       WHERE company_id IN (SELECT id FROM _teardown_company_ids);
DELETE FROM public.quotes            WHERE company_id IN (SELECT id FROM _teardown_company_ids);
DELETE FROM public.inspection_photos WHERE company_id IN (SELECT id FROM _teardown_company_ids);
DELETE FROM public.time_logs         WHERE company_id IN (SELECT id FROM _teardown_company_ids);
DELETE FROM public.signatures        WHERE company_id IN (SELECT id FROM _teardown_company_ids);
DELETE FROM public.defects           WHERE company_id IN (SELECT id FROM _teardown_company_ids);
DELETE FROM public.job_assets        WHERE company_id IN (SELECT id FROM _teardown_company_ids);
DELETE FROM public.jobs              WHERE company_id IN (SELECT id FROM _teardown_company_ids);
DELETE FROM public.asset_tags        WHERE company_id IN (SELECT id FROM _teardown_company_ids);
DELETE FROM public.assets            WHERE company_id IN (SELECT id FROM _teardown_company_ids);
DELETE FROM public.properties        WHERE company_id IN (SELECT id FROM _teardown_company_ids);

-- ── 2. Company-owned catalogue copies only — company_id IS NULL (the ─────
--       shared global defaults) is never matched by this filter ──────────
DELETE FROM public.asset_type_definitions WHERE company_id IN (SELECT id FROM _teardown_company_ids);
DELETE FROM public.defect_codes           WHERE company_id IN (SELECT id FROM _teardown_company_ids);
DELETE FROM public.inventory_items        WHERE company_id IN (SELECT id FROM _teardown_company_ids);
DELETE FROM public.enquiries              WHERE company_id IN (SELECT id FROM _teardown_company_ids);

-- ── 3. Rows that reference the users we're about to delete ────────────────
DELETE FROM public.audit_logs   WHERE changed_by IN (SELECT id FROM _teardown_user_ids);
DELETE FROM public.notifications WHERE user_id IN (SELECT id FROM _teardown_user_ids);

-- ── 4. The users themselves — public.users first (FK'd to auth.users), ────
--       then auth.users (cascades to that user's auth.identities/sessions/
--       refresh_tokens automatically within the auth schema) ──────────────
DELETE FROM public.users WHERE id IN (SELECT id FROM _teardown_user_ids);
DELETE FROM auth.users   WHERE id IN (SELECT id FROM _teardown_user_ids);

-- ── 5. Finally, the companies themselves ───────────────────────────────────
DELETE FROM public.companies WHERE id IN (SELECT id FROM _teardown_company_ids);

COMMIT;
