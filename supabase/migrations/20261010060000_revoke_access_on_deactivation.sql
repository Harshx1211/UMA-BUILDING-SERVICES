-- ============================================================
-- Migration: deactivated users and suspended companies lose data access
-- ============================================================
-- HIGH. Deactivating a technician (users.is_active = false) or suspending a
-- company (companies.subscription_status <> 'active') was enforced ONLY by
-- app logic — the mobile app's heartbeat signs the user out, and the admin
-- portal's getAdminCompanyId() refuses them. Supabase itself keeps the
-- login valid (refresh tokens keep working), and get_user_company_id() —
-- which every tenant_isolation policy calls — returned the company
-- regardless. So a fired technician, or anyone holding their stolen
-- session, kept full read/write access to the company's data straight
-- through the REST API, and a suspended company's users kept working.
--
-- get_user_company_id() now returns NULL unless the user is active AND
-- their company is active. NULL matches no company_id, so every tenant
-- policy denies everything at once. That also covers Storage: the
-- job_photos_* / site_documents_* / job_reports_company_read policies look
-- the job/property up in public.jobs / public.properties, and those
-- lookups are themselves filtered by those tables' tenant_isolation
-- policies — so they find nothing either. And Realtime, which applies the
-- same RLS.
--
-- Not affected: the admin/superadmin portals and the report service use the
-- service role. A deactivated user can still read their OWN notifications
-- and their own users row — harmless, and the app needs the latter to learn
-- it's been deactivated.
--
-- Trade-off, deliberately accepted (security first): a deactivated
-- technician's device can no longer push offline work it hadn't synced yet.
-- The app's own deactivation flow (forceFinalSyncAndSignOut) already keeps
-- that data on the device and warns rather than wiping it.
-- ============================================================

CREATE OR REPLACE FUNCTION public.get_user_company_id()
RETURNS uuid
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT u.company_id
  FROM public.users u
  JOIN public.companies c ON c.id = u.company_id
  WHERE u.id = auth.uid()
    AND u.is_active IS NOT FALSE
    AND c.subscription_status = 'active';
$$;

-- Re-assert the grants (CREATE OR REPLACE keeps them, but be explicit):
-- every tenant policy calls this, so signed-in users must be able to run it.
GRANT EXECUTE ON FUNCTION public.get_user_company_id() TO authenticated, anon;

-- The app learns it has been deactivated/suspended by reading its OWN users
-- row (is_active) and its OWN company row (subscription_status) — app/(app)/
-- _layout.tsx's heartbeat and lib/sync.ts. users_select_company and
-- companies_select_own both go through get_user_company_id(), which now
-- returns NULL for exactly those users, so without these two narrow
-- policies the app would see "no row" instead of "deactivated" and sit
-- signed in on empty screens instead of signing out. Read-only, own row
-- only — nothing else becomes visible.
DROP POLICY IF EXISTS "users_select_own_row" ON public.users;
CREATE POLICY "users_select_own_row" ON public.users
  FOR SELECT TO authenticated
  USING (id = (select auth.uid()));

DROP POLICY IF EXISTS "companies_select_own_any_status" ON public.companies;
CREATE POLICY "companies_select_own_any_status" ON public.companies
  FOR SELECT TO authenticated
  USING (id IN (SELECT u.company_id FROM public.users u WHERE u.id = (select auth.uid())));

-- Sanity check: how many users/companies are currently cut off by this.
SELECT
  (SELECT count(*) FROM public.users WHERE is_active = false) AS deactivated_users,
  (SELECT count(*) FROM public.companies WHERE subscription_status <> 'active') AS inactive_companies,
  (SELECT count(*) FROM public.users u JOIN public.companies c ON c.id = u.company_id
    WHERE u.is_active IS NOT FALSE AND c.subscription_status = 'active') AS users_with_access;
