-- ============================================================
-- Migration: lock down what a signed-in user can change or delete
-- ============================================================
-- From the 2026-10-10 RLS/privilege audit (supabase/scripts/audit_rls_policies.sql).
-- Every policy below the line is tenant-scoped, so these are not
-- cross-company leaks through RLS — they're about what ONE signed-in user
-- can do with their own session, straight against the REST API with the
-- public anon key, bypassing the app entirely.
--
-- 1. CRITICAL — self-promotion / company hijack. users_update_own_row is
--    USING (id = auth.uid()) with no WITH CHECK, so a user can rewrite
--    every column of their own row: role -> 'admin', is_active -> true
--    after being deactivated, or company_id -> another tenant (after which
--    get_user_company_id() returns the victim company and every
--    tenant_isolation policy hands over its data). 20260921000000 tried to
--    stop this with `REVOKE UPDATE (role, company_id) ON users`, but a
--    column-level REVOKE does nothing while the role still holds UPDATE on
--    the whole table (Supabase grants that by default) — see the
--    before/after grid at the end. Fixed with a trigger instead of a
--    column grant: the app's sync engine injects company_id into every
--    UPDATE payload (lib/sync.ts), so a column lock would reject even a
--    legitimate phone-number save; the trigger only rejects an actual
--    CHANGE. Deny-by-default: a signed-in user may change only phone,
--    push_token, avatar_url and updated_at on their own row (the app only
--    ever writes phone — app/(app)/profile.tsx).
--
-- 2. HIGH — defect status. Same ineffective column REVOKE on
--    defects.status, so a technician could mark a defect quoted/repaired
--    themselves. The app's only status write is resetting it to 'open'
--    when the description changes (store/inspectionStore.ts,
--    app/(app)/jobs/[id]/asset/[assetId].tsx), so that stays allowed and
--    any other status change from a user session is rejected. Admins are
--    unaffected (the admin portal uses the service role).
--
-- 3. HIGH — insider data loss. Every tenant_isolation policy is FOR ALL,
--    so any technician could hard-delete their company's jobs, properties,
--    assets, quotes, crew assignments or the field audit history with one
--    REST call — and deletion_log then propagates the deletion to every
--    other device. The app only ever hard-deletes 7 tables (grepped every
--    SyncOperation.Delete: asset_tag_assignments, defects,
--    inspection_photos, job_assets, property_notebook_items, signatures,
--    site_documents); DELETE is revoked on everything else. The audit
--    history (field_audit_log) also becomes insert-only so it can't be
--    rewritten.
--
-- 4. HIGH — SECURITY DEFINER functions callable by ANYONE. They run with
--    the owner's rights (bypassing RLS) and were executable by anon:
--    notify_company_admins(...) let anyone with the public key post
--    arbitrary notifications to any company's admins (phishing);
--    clone_catalogue_for_company(uuid) let anyone stuff duplicate catalogue
--    rows into any company; check_overdue_properties() let anyone trigger
--    the overdue scan. None of them is called by any client (grepped every
--    .rpc() in all five projects: only enquiry_email_exists from the
--    website and try_acquire_report_lock from the report service). Trigger
--    functions don't need EXECUTE to fire, and pg_cron runs as postgres,
--    so revoking EXECUTE from public/anon/authenticated breaks nothing.
--    Kept: get_user_company_id (every RLS policy calls it) and
--    enquiry_email_exists (the marketing site's duplicate check).
--
-- 5. platform_settings_update trusted users.role = 'superadmin' — a column
--    any user could set on themselves (item 1). The superadmin console
--    writes these settings with the service role after checking the real
--    super_admins table, so the policy isn't needed at all: dropped, and
--    writes revoked.
--
-- Run the whole file in the Supabase SQL Editor. The final grid shows the
-- effective privileges BEFORE and AFTER for every item above.
-- ============================================================

-- ── Snapshot BEFORE ─────────────────────────────────────────
DROP TABLE IF EXISTS _priv_check;
CREATE TEMP TABLE _priv_check (phase text, item text, allowed boolean);

CREATE OR REPLACE FUNCTION pg_temp._snapshot(p_phase text) RETURNS void LANGUAGE plpgsql AS $$
DECLARE t text; f record;
BEGIN
  INSERT INTO _priv_check VALUES
    (p_phase, 'authenticated UPDATE users.role (column grant)', has_column_privilege('authenticated', 'public.users', 'role', 'UPDATE')),
    (p_phase, 'authenticated UPDATE users.company_id (column grant)', has_column_privilege('authenticated', 'public.users', 'company_id', 'UPDATE')),
    (p_phase, 'authenticated UPDATE defects.status (column grant)', has_column_privilege('authenticated', 'public.defects', 'status', 'UPDATE')),
    (p_phase, 'users self-escalation trigger present', EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'users_block_privileged_self_edit' AND NOT tgisinternal)),
    (p_phase, 'defects status trigger present', EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'defects_block_status_change_by_users' AND NOT tgisinternal)),
    (p_phase, 'authenticated UPDATE field_audit_log', has_table_privilege('authenticated', 'public.field_audit_log', 'UPDATE')),
    (p_phase, 'authenticated UPDATE platform_settings', has_table_privilege('authenticated', 'public.platform_settings', 'UPDATE'));
  FOREACH t IN ARRAY ARRAY['jobs','properties','assets','companies','users','quotes','quote_items','time_logs',
                           'job_technicians','field_audit_log','deletion_log','asset_tags','notifications',
                           'enquiries','platform_settings','super_admins','report_generation_status',
                           'asset_type_definitions','defect_codes','inventory_items'] LOOP
    INSERT INTO _priv_check VALUES (p_phase, 'authenticated DELETE ' || t, has_table_privilege('authenticated', 'public.' || t, 'DELETE'));
  END LOOP;
  FOR f IN SELECT p.oid, p.oid::regprocedure::text AS sig FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
           WHERE n.nspname = 'public' AND p.prosecdef
             AND p.proname NOT IN ('get_user_company_id', 'enquiry_email_exists') LOOP
    INSERT INTO _priv_check VALUES (p_phase, 'anon EXECUTE ' || f.sig, has_function_privilege('anon', f.oid, 'EXECUTE'));
    INSERT INTO _priv_check VALUES (p_phase, 'authenticated EXECUTE ' || f.sig, has_function_privilege('authenticated', f.oid, 'EXECUTE'));
  END LOOP;
END $$;

SELECT pg_temp._snapshot('BEFORE');

-- ── 1. users: deny-by-default self edits ────────────────────
CREATE OR REPLACE FUNCTION public.users_block_privileged_self_edit()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  -- Only end-user sessions are restricted. The admin/superadmin portals and
  -- the report service use the service role; the SQL Editor runs as postgres.
  IF current_user IN ('authenticated', 'anon') THEN
    IF (to_jsonb(NEW) - ARRAY['phone', 'push_token', 'avatar_url', 'updated_at'])
       IS DISTINCT FROM
       (to_jsonb(OLD) - ARRAY['phone', 'push_token', 'avatar_url', 'updated_at']) THEN
      RAISE EXCEPTION 'Only phone, push_token and avatar_url can be changed on your own profile'
        USING ERRCODE = '42501';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS users_block_privileged_self_edit ON public.users;
CREATE TRIGGER users_block_privileged_self_edit
  BEFORE UPDATE ON public.users
  FOR EACH ROW EXECUTE FUNCTION public.users_block_privileged_self_edit();

-- ── 2. defects: users may only reset status to 'open' ───────
CREATE OR REPLACE FUNCTION public.defects_block_status_change_by_users()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF current_user IN ('authenticated', 'anon')
     AND NEW.status IS DISTINCT FROM OLD.status
     AND NEW.status IS DISTINCT FROM 'open' THEN
    RAISE EXCEPTION 'Defect status can only be changed from the admin dashboard'
      USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS defects_block_status_change_by_users ON public.defects;
CREATE TRIGGER defects_block_status_change_by_users
  BEFORE UPDATE ON public.defects
  FOR EACH ROW EXECUTE FUNCTION public.defects_block_status_change_by_users();

-- ── 3. no hard deletes outside the 7 tables the app deletes from ──
REVOKE DELETE ON public.jobs, public.properties, public.assets, public.companies, public.users,
                 public.quotes, public.quote_items, public.time_logs, public.job_technicians,
                 public.field_audit_log, public.deletion_log, public.asset_tags, public.notifications,
                 public.enquiries, public.platform_settings, public.super_admins,
                 public.report_generation_status, public.asset_type_definitions,
                 public.defect_codes, public.inventory_items
  FROM authenticated, anon;

-- Audit history is append-only for users.
REVOKE UPDATE ON public.field_audit_log FROM authenticated, anon;

-- Tables no end user ever writes (service role / triggers only).
REVOKE INSERT, UPDATE ON public.companies, public.super_admins, public.deletion_log,
                         public.report_generation_status, public.platform_settings
  FROM authenticated, anon;

-- ── 4. SECURITY DEFINER functions: no direct calls ──────────
DO $$
DECLARE f record;
BEGIN
  FOR f IN
    SELECT p.oid::regprocedure AS sig
    FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.prosecdef
      AND p.proname NOT IN ('get_user_company_id', 'enquiry_email_exists')
  LOOP
    EXECUTE format('REVOKE EXECUTE ON FUNCTION %s FROM PUBLIC, anon, authenticated', f.sig);
  END LOOP;
END $$;

-- ── 5. platform_settings: service role only ─────────────────
DROP POLICY IF EXISTS "platform_settings_update" ON public.platform_settings;

-- ── Snapshot AFTER, then show both ──────────────────────────
SELECT pg_temp._snapshot('AFTER');

SELECT b.item,
       b.allowed AS before,
       a.allowed AS after
FROM _priv_check b
LEFT JOIN _priv_check a ON a.item = b.item AND a.phase = 'AFTER'
WHERE b.phase = 'BEFORE'
UNION ALL
SELECT a.item, NULL, a.allowed
FROM _priv_check a
WHERE a.phase = 'AFTER'
  AND NOT EXISTS (SELECT 1 FROM _priv_check b WHERE b.phase = 'BEFORE' AND b.item = a.item)
ORDER BY 1;
