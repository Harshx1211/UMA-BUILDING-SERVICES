-- =============================================================
-- SiteTrack — Supabase Database Schema
-- Run this entire file in the Supabase SQL Editor (single pass)
-- =============================================================

-- ─────────────────────────────────────────────
-- 1. users
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.users (
  id           UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email        TEXT UNIQUE NOT NULL,
  full_name    TEXT NOT NULL,
  role         TEXT NOT NULL DEFAULT 'technician'
                 CHECK (role IN ('technician', 'subcontractor')),
  phone        TEXT,
  avatar_url   TEXT,
  is_active    BOOLEAN NOT NULL DEFAULT TRUE,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

-- Users can only read/update their own row
CREATE POLICY "users_select_own"
  ON public.users FOR SELECT
  USING (auth.uid() = id);

CREATE POLICY "users_update_own"
  ON public.users FOR UPDATE
  USING (auth.uid() = id);

-- ─────────────────────────────────────────────
-- 2. properties
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.properties (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name                 TEXT NOT NULL,
  address              TEXT,
  suburb               TEXT,
  state                TEXT,
  postcode             TEXT,
  site_contact_name    TEXT,
  site_contact_phone   TEXT,
  access_notes         TEXT,
  hazard_notes         TEXT,
  compliance_status    TEXT NOT NULL DEFAULT 'pending'
                         CHECK (compliance_status IN ('compliant','non_compliant','overdue','pending')),
  created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at           TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.properties ENABLE ROW LEVEL SECURITY;

-- All authenticated users can read properties
CREATE POLICY "properties_select_authenticated"
  ON public.properties FOR SELECT
  USING (auth.role() = 'authenticated');

-- ─────────────────────────────────────────────
-- 3. assets
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.assets (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id        UUID NOT NULL REFERENCES public.properties(id) ON DELETE CASCADE,
  asset_type         TEXT NOT NULL,
  description        TEXT,
  location_on_site   TEXT,
  serial_number      TEXT,
  barcode_id         TEXT,
  install_date       DATE,
  last_service_date  DATE,
  next_service_date  DATE,
  status             TEXT NOT NULL DEFAULT 'active'
                       CHECK (status IN ('active', 'decommissioned')),
  created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.assets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "assets_select_authenticated"
  ON public.assets FOR SELECT
  USING (auth.role() = 'authenticated');

CREATE INDEX IF NOT EXISTS idx_assets_property_id ON public.assets(property_id);

-- ─────────────────────────────────────────────
-- 4. jobs
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.jobs (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id      UUID NOT NULL REFERENCES public.properties(id) ON DELETE CASCADE,
  assigned_to      UUID NOT NULL REFERENCES public.users(id),
  job_type         TEXT NOT NULL
                     CHECK (job_type IN ('routine_service','defect_repair','installation','emergency','quote')),
  status           TEXT NOT NULL DEFAULT 'scheduled'
                     CHECK (status IN ('scheduled','in_progress','completed','cancelled')),
  scheduled_date   DATE NOT NULL,
  scheduled_time   TIME,
  priority         TEXT NOT NULL DEFAULT 'normal'
                     CHECK (priority IN ('low','normal','high','urgent')),
  notes            TEXT,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.jobs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "jobs_select_assigned"
  ON public.jobs FOR SELECT
  USING (auth.uid() = assigned_to);

CREATE POLICY "jobs_update_assigned"
  ON public.jobs FOR UPDATE
  USING (auth.uid() = assigned_to);

CREATE INDEX IF NOT EXISTS idx_jobs_assigned_to    ON public.jobs(assigned_to);
CREATE INDEX IF NOT EXISTS idx_jobs_status         ON public.jobs(status);
CREATE INDEX IF NOT EXISTS idx_jobs_scheduled_date ON public.jobs(scheduled_date);

-- ─────────────────────────────────────────────
-- Helper function: check job ownership
-- ─────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.is_job_assigned_to_me(p_job_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.jobs
    WHERE id = p_job_id AND assigned_to = auth.uid()
  );
$$;

-- ─────────────────────────────────────────────
-- 5. job_assets
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.job_assets (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id            UUID NOT NULL REFERENCES public.jobs(id) ON DELETE CASCADE,
  asset_id          UUID NOT NULL REFERENCES public.assets(id) ON DELETE CASCADE,
  result            TEXT CHECK (result IN ('pass','fail','not_tested')),
  defect_reason     TEXT,
  technician_notes  TEXT,
  actioned_at       TIMESTAMPTZ
);

ALTER TABLE public.job_assets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "job_assets_select"
  ON public.job_assets FOR SELECT
  USING (public.is_job_assigned_to_me(job_id));

CREATE POLICY "job_assets_insert"
  ON public.job_assets FOR INSERT
  WITH CHECK (public.is_job_assigned_to_me(job_id));

CREATE POLICY "job_assets_update"
  ON public.job_assets FOR UPDATE
  USING (public.is_job_assigned_to_me(job_id));

-- ─────────────────────────────────────────────
-- 6. defects
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.defects (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id       UUID NOT NULL REFERENCES public.jobs(id) ON DELETE CASCADE,
  asset_id     UUID NOT NULL REFERENCES public.assets(id),
  property_id  UUID NOT NULL REFERENCES public.properties(id),
  description  TEXT NOT NULL,
  severity     TEXT NOT NULL
                 CHECK (severity IN ('minor','major','critical')),
  status       TEXT NOT NULL DEFAULT 'open'
                 CHECK (status IN ('open','quoted','repaired','monitoring')),
  photos       TEXT[] NOT NULL DEFAULT '{}',
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.defects ENABLE ROW LEVEL SECURITY;

CREATE POLICY "defects_select"
  ON public.defects FOR SELECT
  USING (public.is_job_assigned_to_me(job_id));

CREATE POLICY "defects_insert"
  ON public.defects FOR INSERT
  WITH CHECK (public.is_job_assigned_to_me(job_id));

CREATE POLICY "defects_update"
  ON public.defects FOR UPDATE
  USING (public.is_job_assigned_to_me(job_id));

CREATE INDEX IF NOT EXISTS idx_defects_job_id ON public.defects(job_id);

-- ─────────────────────────────────────────────
-- 7. inspection_photos
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.inspection_photos (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id       UUID NOT NULL REFERENCES public.jobs(id) ON DELETE CASCADE,
  asset_id     UUID REFERENCES public.assets(id),
  photo_url    TEXT NOT NULL,
  caption      TEXT,
  uploaded_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  uploaded_by  UUID NOT NULL REFERENCES public.users(id)
);

ALTER TABLE public.inspection_photos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "inspection_photos_select"
  ON public.inspection_photos FOR SELECT
  USING (public.is_job_assigned_to_me(job_id));

CREATE POLICY "inspection_photos_insert"
  ON public.inspection_photos FOR INSERT
  WITH CHECK (public.is_job_assigned_to_me(job_id));

CREATE POLICY "inspection_photos_update"
  ON public.inspection_photos FOR UPDATE
  USING (public.is_job_assigned_to_me(job_id));

-- ─────────────────────────────────────────────
-- 8. signatures
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.signatures (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id           UUID NOT NULL UNIQUE REFERENCES public.jobs(id) ON DELETE CASCADE,
  signature_url    TEXT NOT NULL,
  signed_by_name   TEXT NOT NULL,
  signed_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.signatures ENABLE ROW LEVEL SECURITY;

CREATE POLICY "signatures_select"
  ON public.signatures FOR SELECT
  USING (public.is_job_assigned_to_me(job_id));

CREATE POLICY "signatures_insert"
  ON public.signatures FOR INSERT
  WITH CHECK (public.is_job_assigned_to_me(job_id));

CREATE POLICY "signatures_update"
  ON public.signatures FOR UPDATE
  USING (public.is_job_assigned_to_me(job_id));

-- ─────────────────────────────────────────────
-- 9. time_logs
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.time_logs (
  id                     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id                 UUID NOT NULL REFERENCES public.jobs(id) ON DELETE CASCADE,
  user_id                UUID NOT NULL REFERENCES public.users(id),
  clock_in               TIMESTAMPTZ NOT NULL,
  clock_out              TIMESTAMPTZ,
  gps_lat                DECIMAL(10, 7),
  gps_lng                DECIMAL(10, 7),
  travel_time_minutes    INTEGER
);

ALTER TABLE public.time_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "time_logs_select"
  ON public.time_logs FOR SELECT
  USING (public.is_job_assigned_to_me(job_id));

CREATE POLICY "time_logs_insert"
  ON public.time_logs FOR INSERT
  WITH CHECK (public.is_job_assigned_to_me(job_id));

CREATE POLICY "time_logs_update"
  ON public.time_logs FOR UPDATE
  USING (public.is_job_assigned_to_me(job_id));

-- ─────────────────────────────────────────────
-- Performance index on properties.compliance_status
-- ─────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_properties_compliance_status
  ON public.properties(compliance_status);

-- ─────────────────────────────────────────────
-- Auto-update updated_at on jobs and properties
-- ─────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

CREATE OR REPLACE TRIGGER trg_jobs_updated_at
  BEFORE UPDATE ON public.jobs
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE OR REPLACE TRIGGER trg_properties_updated_at
  BEFORE UPDATE ON public.properties
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- NOTE: sync_queue is SQLite-only and is NOT created here.
-- It lives exclusively in the local expo-sqlite database on device.
