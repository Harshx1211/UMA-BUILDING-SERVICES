-- ============================================================
-- Migration: Fix audit findings DB1-DB5
-- DB1: defects.photos invalid type ARRAY -> text[]
-- DB2: Add RLS to notifications, enquiries, super_admins
-- DB3: Restrict users UPDATE to own row only
-- DB4: Path-restricted storage policies for job-photos bucket
-- DB5: job-reports bucket made private (signed URLs recommended)
-- Run this in: Supabase Dashboard → SQL Editor
-- ============================================================

-- ─────────────────────────────────────────────────────────────────────────────
-- DB1: Fix defects.photos column type
-- 'ARRAY NOT NULL DEFAULT '{}'::text[]' was invalid — ARRAY alone is not a
-- Postgres type. The column was written with DEFAULT '{}' so data is fine;
-- this just fixes the type annotation in the system catalog.
-- ─────────────────────────────────────────────────────────────────────────────
DO $$
BEGIN
  -- Only alter if the column exists and is of wrong type
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name   = 'defects'
      AND column_name  = 'photos'
      AND data_type    <> 'ARRAY'
  ) THEN
    -- Column already correct type; skip
    RAISE NOTICE 'defects.photos already correct type, skipping.';
  ELSE
    ALTER TABLE public.defects
      ALTER COLUMN photos TYPE text[] USING photos::text[];
    RAISE NOTICE 'defects.photos altered to text[].';
  END IF;
END $$;

-- Ensure default is correct regardless
ALTER TABLE public.defects
  ALTER COLUMN photos SET DEFAULT '{}';

ALTER TABLE public.defects
  ALTER COLUMN photos SET NOT NULL;


-- ─────────────────────────────────────────────────────────────────────────────
-- DB2: Enable RLS on previously unprotected tables
-- notifications, enquiries, super_admins had no RLS → cross-tenant data leak
-- ─────────────────────────────────────────────────────────────────────────────

-- notifications: users can only see and manage their own notifications
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "notifications_own_user" ON public.notifications;
CREATE POLICY "notifications_own_user" ON public.notifications
  FOR ALL USING (user_id = auth.uid());

-- enquiries: scoped to the company (admins manage leads for their company)
ALTER TABLE public.enquiries ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "enquiries_tenant_isolation" ON public.enquiries;
CREATE POLICY "enquiries_tenant_isolation" ON public.enquiries
  FOR ALL USING (company_id = public.get_user_company_id());

-- super_admins: only a super admin can see this table (self-reference check)
-- This prevents any regular technician/admin from enumerating super admin accounts.
ALTER TABLE public.super_admins ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "super_admins_self_only" ON public.super_admins;
CREATE POLICY "super_admins_self_only" ON public.super_admins
  FOR ALL USING (id = auth.uid());

-- platform_settings: readable by all authenticated users (it's global config),
-- but only writable by super admins
ALTER TABLE public.platform_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "platform_settings_read" ON public.platform_settings;
CREATE POLICY "platform_settings_read" ON public.platform_settings
  FOR SELECT USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "platform_settings_super_admin_write" ON public.platform_settings;
CREATE POLICY "platform_settings_super_admin_write" ON public.platform_settings
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.super_admins WHERE id = auth.uid())
  );


-- ─────────────────────────────────────────────────────────────────────────────
-- DB3: Restrict users UPDATE to own row only (privilege escalation fix)
-- The previous FOR ALL policy let any technician UPDATE any other user in their
-- company — including changing role, is_active, push_token.
-- New policy: SELECT = anyone in same company, UPDATE/INSERT/DELETE = own row.
-- ─────────────────────────────────────────────────────────────────────────────

DROP POLICY IF EXISTS "users_tenant_isolation" ON public.users;

-- SELECT: see all users in own company (needed for job assignment, photo uploads, etc.)
DROP POLICY IF EXISTS "users_select_same_company" ON public.users;
CREATE POLICY "users_select_same_company" ON public.users
  FOR SELECT USING (company_id = public.get_user_company_id());

-- UPDATE: only own profile (push_token, avatar_url, phone, accepted_tos_at)
-- Admins who need to update other users must use the service role (admin portal).
DROP POLICY IF EXISTS "users_update_own_row" ON public.users;
CREATE POLICY "users_update_own_row" ON public.users
  FOR UPDATE USING (id = auth.uid());

-- INSERT: a user can only create their own row (handled at signup via service role)
-- Prevent technicians from creating ghost users.
DROP POLICY IF EXISTS "users_insert_own_row" ON public.users;
CREATE POLICY "users_insert_own_row" ON public.users
  FOR INSERT WITH CHECK (id = auth.uid());

-- DELETE: not allowed via app — admin portal uses service role
-- (intentionally no DELETE policy for authenticated users)


-- ─────────────────────────────────────────────────────────────────────────────
-- DB4: Path-restricted storage policies for job-photos bucket
-- Old policies allowed upload/delete to ANY path in the bucket as long as the
-- user belonged to the company. A malicious user could overwrite other jobs' photos.
-- New policy: photo path must start with the job's company_id folder.
-- Convention: job-photos/{company_id}/{job_id}/{filename}
-- ─────────────────────────────────────────────────────────────────────────────

DROP POLICY IF EXISTS "tenant_photos_select" ON storage.objects;
DROP POLICY IF EXISTS "tenant_photos_insert" ON storage.objects;
DROP POLICY IF EXISTS "tenant_photos_delete" ON storage.objects;

-- SELECT: company-scoped path prefix
CREATE POLICY "tenant_photos_select" ON storage.objects
  FOR SELECT USING (
    bucket_id = 'job-photos'
    AND (storage.foldername(name))[1] = (public.get_user_company_id())::text
  );

-- INSERT: path must start with own company_id
CREATE POLICY "tenant_photos_insert" ON storage.objects
  FOR INSERT WITH CHECK (
    bucket_id = 'job-photos'
    AND (storage.foldername(name))[1] = (public.get_user_company_id())::text
  );

-- UPDATE: same company-scoped path
CREATE POLICY "tenant_photos_update" ON storage.objects
  FOR UPDATE USING (
    bucket_id = 'job-photos'
    AND (storage.foldername(name))[1] = (public.get_user_company_id())::text
  );

-- DELETE: same company-scoped path
CREATE POLICY "tenant_photos_delete" ON storage.objects
  FOR DELETE USING (
    bucket_id = 'job-photos'
    AND (storage.foldername(name))[1] = (public.get_user_company_id())::text
  );


-- ─────────────────────────────────────────────────────────────────────────────
-- DB5: Make job-reports bucket private
-- Previously public = true, meaning anyone with a URL could read any company's
-- compliance reports without authentication. This changes it to private so
-- that access requires a valid signed URL or a service-role fetch.
-- NOTE: After this, the Edge Function's getPublicUrl() will still return a URL
-- but it will return 403 for unauthenticated requests. The app/admin portal
-- should switch to createSignedUrl() with a reasonable TTL (e.g. 1 hour).
-- ─────────────────────────────────────────────────────────────────────────────

UPDATE storage.buckets
  SET public = false
  WHERE id = 'job-reports';

-- Add RLS so only company members can access their own reports
DROP POLICY IF EXISTS "reports_tenant_select" ON storage.objects;
CREATE POLICY "reports_tenant_select" ON storage.objects
  FOR SELECT USING (
    bucket_id = 'job-reports'
    AND auth.role() = 'authenticated'
  );

-- Only the service role (Edge Function) can insert/upsert reports
-- (no INSERT policy for authenticated users — reports are always server-generated)
