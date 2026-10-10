-- 100% READ-ONLY security audit — every statement is a SELECT against
-- pg_catalog / pg_policies. Safe to run whole. Paste the full JSON result
-- back for review.
--
-- One result set (one row per finding), three sections:
--   rls_off   — a public table with Row Level Security DISABLED: every
--               policy on it is ignored and the anon/authenticated grants
--               decide access alone.
--   policy    — every RLS policy on a public table, with `suspicious` =
--               true when it's permissive, reachable by signed-in or
--               anonymous users, and its expression has no tenant/user
--               tie at all (no company_id, get_user_company_id, auth.uid,
--               user_id, or a super_admins check). Permissive policies are
--               OR'd, so one of these silently overrides every careful
--               company-scoped policy on the same table — exactly the class
--               of hand-made policy found on storage.objects on 2026-10-10.
--   function  — SECURITY DEFINER functions in public that anon or
--               authenticated can EXECUTE (they run with the owner's
--               rights, bypassing RLS, so each needs its own checks).

SELECT 'rls_off' AS section, c.relname AS table_name, NULL AS policyname,
       NULL AS roles, NULL AS cmd, NULL AS expr, true AS suspicious
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public' AND c.relkind = 'r' AND NOT c.relrowsecurity

UNION ALL

SELECT 'policy', p.tablename, p.policyname, p.roles::text, p.cmd,
       left(coalesce(p.qual, '') || ' | ' || coalesce(p.with_check, ''), 400),
       (p.permissive = 'PERMISSIVE'
        AND p.roles && ARRAY['public', 'anon', 'authenticated']::name[]
        AND (coalesce(p.qual, '') || ' ' || coalesce(p.with_check, ''))
            !~* '(company_id|get_user_company_id|auth\.uid|user_id|super_admins|assigned_to|created_by)')
FROM pg_policies p
WHERE p.schemaname = 'public'

UNION ALL

SELECT 'function', p.proname, NULL,
       array_to_string(ARRAY(
         SELECT r FROM unnest(ARRAY['anon', 'authenticated']) r
         WHERE has_function_privilege(r, p.oid, 'EXECUTE')), ','),
       NULL, pg_get_function_identity_arguments(p.oid),
       has_function_privilege('anon', p.oid, 'EXECUTE')
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public' AND p.prosecdef
  AND (has_function_privilege('anon', p.oid, 'EXECUTE')
       OR has_function_privilege('authenticated', p.oid, 'EXECUTE'))

ORDER BY section, suspicious DESC, table_name, policyname;
