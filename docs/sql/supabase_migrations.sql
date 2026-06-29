-- ============================================================
-- UMA BUILDING SERVICES — Cumulative Supabase Migrations
-- ============================================================
-- This is the ONLY migration file you need to run for new changes.
-- All statements are IDEMPOTENT — safe to re-run at any time.
--
-- ✅ LIVE STATUS (confirmed April 2026 via schema dump):
--    §1  notifications table      — APPLIED
--    §2  users.push_token          — APPLIED
--    §3  Storage bucket policies   — APPLIED
--    §4  Audit fixes (indexes,     — APPLIED
--        job_assets columns)
--    §5  assets.variant +          — APPLIED
--        assets.asset_ref
--
-- For a FRESH Supabase project, run in this order:
--   1. supabase/schema.sql           (all tables, RLS, triggers)
--   2. docs/supabase_migrations.sql  (this file)
--   3. Create job-photos bucket manually in the dashboard
--
-- Run in: Supabase Dashboard → SQL Editor → New Query → Run
-- Project: https://supabase.com/dashboard/project/vnrmgcxmcspdgqcnmmdx/sql
-- ============================================================


-- ────────────────────────────────────────────────────────────
-- § 1 — NOTIFICATIONS TABLE  (Phase 9)
--       Stores push/in-app notifications per technician.
-- ────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.notifications (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  type        TEXT        NOT NULL DEFAULT 'general'
              CHECK (type IN ('new_job','urgent_job','sync_complete','defect_flagged','general')),
  title       TEXT        NOT NULL,
  message     TEXT        NOT NULL,
  job_id      UUID        REFERENCES public.jobs(id) ON DELETE SET NULL,
  user_id     UUID        REFERENCES public.users(id) ON DELETE CASCADE,
  is_read     BOOLEAN     NOT NULL DEFAULT FALSE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON public.notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_is_read  ON public.notifications(is_read);
CREATE INDEX IF NOT EXISTS idx_notifications_created  ON public.notifications(created_at DESC);

-- RLS policies (wrapped in DO block so re-runs don't error)
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'notifications_select_own' AND tablename = 'notifications') THEN
    EXECUTE 'CREATE POLICY "notifications_select_own" ON public.notifications FOR SELECT USING (auth.uid() = user_id)';
    EXECUTE 'CREATE POLICY "notifications_insert_own" ON public.notifications FOR INSERT WITH CHECK (auth.uid() = user_id)';
    EXECUTE 'CREATE POLICY "notifications_update_own" ON public.notifications FOR UPDATE USING (auth.uid() = user_id)';
    EXECUTE 'CREATE POLICY "notifications_delete_own" ON public.notifications FOR DELETE USING (auth.uid() = user_id)';
  END IF;
END $$;


-- ────────────────────────────────────────────────────────────
-- § 2 — users.push_token  (Phase 9)
--       Stores the Expo push notification token per user.
-- ────────────────────────────────────────────────────────────

ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS push_token TEXT;


-- ────────────────────────────────────────────────────────────
-- § 3 — STORAGE POLICIES for job-photos bucket
--       Allows authenticated users to upload and read photos.
--       Public read is required for PDF report image embedding.
--
--       PREREQUISITE: Create the bucket manually first:
--         Dashboard → Storage → New Bucket
--         Name: job-photos | Public: ✅ | MIME: image/jpeg, image/png
-- ────────────────────────────────────────────────────────────

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE policyname = 'auth_upload_job_photos' AND tablename = 'objects'
  ) THEN
    EXECUTE 'CREATE POLICY "auth_upload_job_photos" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = ''job-photos'')';
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE policyname = 'auth_read_job_photos' AND tablename = 'objects'
  ) THEN
    EXECUTE 'CREATE POLICY "auth_read_job_photos" ON storage.objects FOR SELECT TO authenticated USING (bucket_id = ''job-photos'')';
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE policyname = 'public_read_job_photos' AND tablename = 'objects'
  ) THEN
    EXECUTE 'CREATE POLICY "public_read_job_photos" ON storage.objects FOR SELECT TO public USING (bucket_id = ''job-photos'')';
  END IF;
END $$;


-- ────────────────────────────────────────────────────────────
-- § 4 — APRIL 2026 AUDIT FIXES
--       Performance indexes + missing columns found during audit.
--       Mirrors SQLite migrations 2, 3, 4.
-- ────────────────────────────────────────────────────────────

-- Performance indexes (fixes O(n) scan on previous inspection lookups)
CREATE INDEX IF NOT EXISTS idx_job_assets_asset_id ON public.job_assets(asset_id);
CREATE INDEX IF NOT EXISTS idx_job_assets_job_id   ON public.job_assets(job_id);

-- Checklist data columns on job_assets (SQLite migration 2)
ALTER TABLE public.job_assets
  ADD COLUMN IF NOT EXISTS checklist_data JSONB;

ALTER TABLE public.job_assets
  ADD COLUMN IF NOT EXISTS is_compliant BOOLEAN NOT NULL DEFAULT FALSE;

-- Document expected format of signature_url (was previously stored as base64 — now a Storage URL)
COMMENT ON COLUMN public.signatures.signature_url IS
  'Public Supabase Storage URL to the PNG signature image. '
  'Format: https://[project].supabase.co/storage/v1/object/public/job-photos/signatures/[job_id]/signature.png';

-- NOTE: sync_queue columns (retry_count, last_error) from SQLite migration 4
-- are SQLite-ONLY — they do NOT exist in Supabase.


-- ────────────────────────────────────────────────────────────
-- § 5 — ASSET VARIANT & REF  (April 2026 — SQLite migration 5)
--       Adds sub-variant (e.g. "DCP AB(E) 4.5KG") and a short
--       site reference number (e.g. "001") to every asset.
--       Mirrors lib/database.ts Migration 5.
-- ────────────────────────────────────────────────────────────

ALTER TABLE public.assets
  ADD COLUMN IF NOT EXISTS variant   TEXT DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS asset_ref TEXT DEFAULT NULL;

COMMENT ON COLUMN public.assets.variant IS
  'Sub-variant of the asset type selected from the official list in constants/AssetData.ts. '
  'Examples: "DCP AB(E) 4.5KG", "Quick Fit (Ceiling Mount) - Exit", "Fire Door - Single"';

COMMENT ON COLUMN public.assets.asset_ref IS
  'Short technician reference number for this asset at the site. '
  'Examples: "001", "040". Used for quick identification on-site.';


-- ────────────────────────────────────────────────────────────
-- § 6 — VERIFY
--       Run this section separately to confirm all tables and
--       indexes exist after applying the migrations above.
-- ────────────────────────────────────────────────────────────

-- Check all expected tables are present
SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_name IN (
    'users', 'properties', 'assets', 'jobs',
    'job_assets', 'defects', 'inspection_photos',
    'signatures', 'time_logs', 'notifications',
    'inventory_items', 'quotes', 'quote_items'
  )
ORDER BY table_name;

-- Check assets columns include variant and asset_ref
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'assets'
ORDER BY ordinal_position;

-- Check all performance indexes exist
SELECT indexname, tablename
FROM pg_indexes
WHERE schemaname = 'public'
  AND indexname IN (
    'idx_job_assets_asset_id',
    'idx_job_assets_job_id',
    'idx_notifications_user_id',
    'idx_notifications_is_read',
    'idx_notifications_created',
    'idx_jobs_assigned_to',
    'idx_jobs_status',
    'idx_jobs_scheduled_date',
    'idx_assets_property_id',
    'idx_defects_job_id'
  )
ORDER BY tablename, indexname;
