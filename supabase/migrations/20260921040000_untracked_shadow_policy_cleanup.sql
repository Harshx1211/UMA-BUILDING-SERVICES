-- ============================================================
-- Migration: remove untracked "shadow" policies found live in production
-- that this repo's migration history never actually recorded
-- ============================================================
-- While verifying 20260921030000's RLS wrap wasn't fully in effect, a live
-- `pg_policies` dump turned up an entire second set of policies with
-- different names than anything in this repo's tracked migrations —
-- confirming exactly what the original audit warned about: "everything
-- before 2026-08-22 was deleted after being applied and had to be
-- reconstructed from the live schema... nobody can currently answer which
-- migrations are actually live from the repo alone." These are that gap,
-- found live.
--
-- Most were harmless duplicates (old + new policy saying the same thing —
-- just wasted double evaluation). Three were not:
--   - time_logs_tenant_isolation (FOR ALL, unrestricted) coexisted with
--     today's own time_logs_select_own_or_assigned_job fix, silently
--     defeating it — the GPS-visibility fix was never actually in effect.
--   - users_tenant_isolation (FOR ALL, company-wide) coexisted with the
--     correctly-scoped users_update_own_row (id = auth.uid()) — any
--     technician could update any COLLEAGUE's profile row, not just their
--     own. (The self-promotion Critical fix itself is unaffected — that's
--     enforced by a column-level REVOKE, a completely different mechanism
--     that doesn't care which policy exists.)
--   - asset_type_definitions and defect_codes each had a
--     "*_select_auth" policy (`auth.role() = 'authenticated'`) with NO
--     company scoping at all — any authenticated user, any company, could
--     read every company's catalogue rows.
--
-- Every DROP below was verified safe first, not assumed:
--   - quotes / quote_items / time_logs: exhaustively grepped the mobile
--     app for every write-wrapper call site (addToSyncQueue/insertRecord/
--     updateRecord/upsertRecord with literal table names, confirmed no
--     dynamic table names exist anywhere) — zero mobile writes to any of
--     the three. time_logs's clock-in/out feature isn't wired to any
--     screen yet (dead plumbing only). Corroborated by this same
--     conclusion already written into 20260913000000's own comments.
--   - users: the only mobile write is profile.tsx's own-row phone update
--     (`updateRecord('users', user.id, {phone})`, user.id always the
--     current session's own id, never a route param or list selection).
--   - enquiries: doesn't appear anywhere in the mobile app's source at
--     all (only in a local teardown script) — not a mobile-app table.
--   - asset_type_definitions / defect_codes: the client's own
--     catalogueStore.ts explicitly expects `company_id = mine OR
--     company_id IS NULL` (a real "global seed template" concept —
--     20260829000000_auto_seed_company_catalogue.sql clones these NULL
--     rows into every new company at creation time) — so this migration
--     ADDS a narrow, SELECT-only, NULL-only policy to keep that fallback
--     working, rather than just deleting the leak and silently breaking
--     it for any company that ends up with zero catalogue rows of its
--     own. Writes to both tables are already blocked separately by
--     20260921000000's REVOKE INSERT, UPDATE, DELETE ... FROM authenticated.
--
-- Run this once in the Supabase SQL Editor, after 20260921030000.
-- ============================================================

-- ── Simple duplicates: old + new say the same thing, drop the old ──────
DROP POLICY IF EXISTS "companies_select" ON public.companies;
DROP POLICY IF EXISTS "photos_tenant_isolation" ON public.inspection_photos;
DROP POLICY IF EXISTS "inventory_tenant_isolation" ON public.inventory_items;
DROP POLICY IF EXISTS "enquiries_tenant_isolation" ON public.enquiries;
DROP POLICY IF EXISTS "asset_types_tenant_isolation" ON public.asset_type_definitions;

-- ── FOR ALL -> narrower, confirmed-safe (no mobile write exists) ───────
DROP POLICY IF EXISTS "quotes_tenant_isolation" ON public.quotes;
DROP POLICY IF EXISTS "quote_items_tenant_isolation" ON public.quote_items;
DROP POLICY IF EXISTS "time_logs_tenant_isolation" ON public.time_logs;
DROP POLICY IF EXISTS "users_tenant_isolation" ON public.users;

-- ── Cross-tenant read leaks: drop, then replace with a correctly-scoped
--    equivalent that preserves the legitimate NULL-template fallback ────
DROP POLICY IF EXISTS "asset_types_select_auth" ON public.asset_type_definitions;
DROP POLICY IF EXISTS "defect_codes_select_auth" ON public.defect_codes;

DROP POLICY IF EXISTS "asset_type_definitions_select_global_template" ON public.asset_type_definitions;
CREATE POLICY "asset_type_definitions_select_global_template" ON public.asset_type_definitions
  FOR SELECT USING (company_id IS NULL);

DROP POLICY IF EXISTS "defect_codes_select_global_template" ON public.defect_codes;
CREATE POLICY "defect_codes_select_global_template" ON public.defect_codes
  FOR SELECT USING (company_id IS NULL);

-- ============================================================
-- Verification — run after applying. Expect exactly these counts per
-- table (policyname list alongside so you can also eyeball which ones):
--   companies=1, inventory_items=1, quotes=1, quote_items=1, time_logs=1
--   inspection_photos=2 (tenant_isolation + photos_delete_via_job_technicians)
--   enquiries=2 (tenant-admin select + public_insert)
--   users=2 (select_company + update_own_row)
--   asset_type_definitions=2 (tenant_isolation + select_global_template)
--   defect_codes=2 (tenant_isolation + select_global_template)
--
-- SELECT tablename, count(*) AS policy_count, array_agg(policyname) AS names
-- FROM pg_policies
-- WHERE schemaname = 'public'
--   AND tablename IN ('companies','inspection_photos','inventory_items',
--     'enquiries','quotes','quote_items','time_logs','users',
--     'asset_type_definitions','defect_codes')
-- GROUP BY tablename
-- ORDER BY tablename;
-- ============================================================
