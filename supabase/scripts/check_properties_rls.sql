-- Checks whether technicians (non-admin, authenticated mobile users) are
-- actually allowed to UPDATE the properties table under Row Level Security.
--
-- Why this matters: the mobile app writes to Supabase using the logged-in
-- technician's own session (anon key + their JWT), NOT a service-role key —
-- unlike the admin portal, which always uses service_role and bypasses RLS
-- entirely. If `properties` has no UPDATE policy permissive enough for a
-- technician role, every attempt from the mobile app to write
-- compliance_status (both the just-added job-completion path AND the
-- pre-existing Site Inspect flow) would be silently rejected by Postgres —
-- the job's own status update could still succeed (if a separate, more
-- permissive policy covers `jobs`) while the property write never lands,
-- exactly matching "job shows completed, property still says pending".

-- ── 1. List every RLS policy currently on properties ────────────────────
SELECT
  polname               AS policy_name,
  polcmd                AS command,      -- 'r'=select 'a'=insert 'w'=update 'd'=delete '*'=all
  polroles::regrole[]   AS roles,
  pg_get_expr(polqual, polrelid)      AS using_expression,
  pg_get_expr(polwithcheck, polrelid) AS with_check_expression
FROM pg_policy
WHERE polrelid = 'public.properties'::regclass;

-- ── 2. Confirm RLS is even enabled on the table ─────────────────────────
SELECT relname, relrowsecurity AS rls_enabled, relforcerowsecurity AS rls_forced
FROM pg_class
WHERE oid = 'public.properties'::regclass;

-- ── 3. Same two checks for `jobs`, for comparison ───────────────────────
SELECT
  polname               AS policy_name,
  polcmd                AS command,
  polroles::regrole[]   AS roles,
  pg_get_expr(polqual, polrelid)      AS using_expression,
  pg_get_expr(polwithcheck, polrelid) AS with_check_expression
FROM pg_policy
WHERE polrelid = 'public.jobs'::regclass;
