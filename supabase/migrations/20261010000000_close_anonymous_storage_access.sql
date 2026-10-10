-- ============================================================
-- Migration: close anonymous access to private Storage buckets
-- ============================================================
-- CRITICAL. A read-only probe on 2026-10-10 using ONLY the public anon key
-- (shipped inside every copy of the mobile app, so effectively public) and
-- no login at all could:
--   - list every object in `job-reports` and mint a working signed
--     download URL for any inspection report PDF;
--   - list every object in `job-photos` folder by folder and mint a working
--     signed download URL for any inspection photo.
-- i.e. any company's reports and photos were downloadable by anyone.
--
-- Every storage policy recorded in this repo is `TO authenticated` with a
-- company check, so the hole is an UNTRACKED policy that exists only in the
-- live database (created by hand in the dashboard at some point — same
-- class of problem as 20260921040000_untracked_shadow_policy_cleanup.sql).
-- Its name isn't known from here, so this finds and drops it by shape:
-- any storage.objects policy that
--   (1) applies to `anon` or `public` (public = every role, incl. anon), AND
--   (2) can reach a private bucket — its expression names one of them, or
--       never filters on bucket_id at all (so it covers every bucket), AND
--   (3) contains no auth check (auth.uid(), auth.jwt(), auth.role(),
--       get_user_company_id()) — a policy with one of those already fails
--       for an anonymous caller, so it isn't the leak and is left alone.
-- The repo's own `TO authenticated` company-scoped policies match none of
-- this and are untouched. Public-bucket URLs (/object/public/...) never go
-- through RLS at all, so nothing that relies on a genuinely public bucket
-- is affected either.
--
-- Run the whole file in the Supabase SQL Editor. The result grid lists
-- every policy it dropped, followed by every storage.objects policy that
-- remains, so you can see exactly what changed.
-- ============================================================

-- Plain session temp table (not ON COMMIT DROP): the SQL Editor may run
-- each statement in its own transaction, which would drop it immediately.
DROP TABLE IF EXISTS _dropped_storage_policies;
CREATE TEMP TABLE _dropped_storage_policies (policyname text, roles text, cmd text, expr text);

DO $$
DECLARE
  p record;
  expr text;
BEGIN
  FOR p IN
    SELECT policyname, roles, cmd, coalesce(qual, '') AS qual, coalesce(with_check, '') AS with_check
    FROM pg_policies
    WHERE schemaname = 'storage' AND tablename = 'objects'
      AND (roles && ARRAY['anon', 'public']::name[])
  LOOP
    expr := p.qual || ' ' || p.with_check;

    -- (3) has a real auth check -> not the anonymous leak, keep it
    IF expr ~* '(auth\.uid|auth\.jwt|auth\.role|get_user_company_id)' THEN
      CONTINUE;
    END IF;

    -- (2) can reach a private bucket
    IF expr ~* '(job-photos|job-reports|site-documents)'
       OR expr !~* 'bucket_id' THEN
      EXECUTE format('DROP POLICY IF EXISTS %I ON storage.objects', p.policyname);
      INSERT INTO _dropped_storage_policies VALUES (p.policyname, p.roles::text, p.cmd, left(expr, 300));
    END IF;
  END LOOP;
END $$;

-- Belt and braces: these three buckets must never be public-URL buckets.
UPDATE storage.buckets SET public = false WHERE id IN ('job-photos', 'job-reports', 'site-documents');

-- Same theme, lower severity: the global default catalogue (company_id IS
-- NULL rows — 9 asset types and 123 defect codes with prices) was readable
-- with no login, because 20260921040000 created these two policies with no
-- TO clause (= public, incl. anon). Nothing unauthenticated needs them —
-- the mobile app reads them signed in, the admin portal uses the service
-- role, the marketing sites never touch them — so signed-in only.
DROP POLICY IF EXISTS "asset_type_definitions_select_global_template" ON public.asset_type_definitions;
CREATE POLICY "asset_type_definitions_select_global_template" ON public.asset_type_definitions
  FOR SELECT TO authenticated USING (company_id IS NULL);

DROP POLICY IF EXISTS "defect_codes_select_global_template" ON public.defect_codes;
CREATE POLICY "defect_codes_select_global_template" ON public.defect_codes
  FOR SELECT TO authenticated USING (company_id IS NULL);

-- What happened (read this grid):
SELECT 'DROPPED' AS action, policyname, roles, cmd, expr FROM _dropped_storage_policies
UNION ALL
SELECT 'remaining', policyname, roles::text, cmd, left(coalesce(qual, '') || ' ' || coalesce(with_check, ''), 300)
FROM pg_policies
WHERE schemaname = 'storage' AND tablename = 'objects'
ORDER BY 1, 2;
