-- ============================================================
-- UMA BUILDING SERVICES — Canonical Supabase Schema
-- ============================================================
-- This is the AUTHORITATIVE schema derived from the live
-- Supabase project dump (confirmed April 2026).
--
-- HOW TO USE:
--   Fresh project → run this file ONCE in SQL Editor, then
--   run docs/supabase_migrations.sql for all incremental changes.
--
--   Existing project → do NOT re-run this file. Use
--   docs/supabase_migrations.sql for any new additions.
--
-- All CREATE TABLE statements use IF NOT EXISTS — safe to
-- re-run, but will NOT update existing columns.
-- ============================================================


-- ────────────────────────────────────────────────────────────
-- EXTENSIONS
-- ────────────────────────────────────────────────────────────

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";


-- ────────────────────────────────────────────────────────────
-- TABLE: users
-- Technician / subcontractor profiles linked to auth.users.
-- id is NOT auto-generated — it must match auth.users.id.
-- ────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.users (
  id           UUID        NOT NULL,
  email        TEXT        NOT NULL UNIQUE,
  full_name    TEXT        NOT NULL,
  role         TEXT        NOT NULL DEFAULT 'technician'
               CHECK (role IN ('technician', 'subcontractor')),
  phone        TEXT,
  avatar_url   TEXT,
  is_active    BOOLEAN     NOT NULL DEFAULT TRUE,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  push_token   TEXT,                                  -- Expo push notification token
  CONSTRAINT users_pkey        PRIMARY KEY (id),
  CONSTRAINT users_id_fkey     FOREIGN KEY (id) REFERENCES auth.users(id)
);

ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users_select_own" ON public.users
  FOR SELECT USING (auth.uid() = id);

CREATE POLICY "users_update_own" ON public.users
  FOR UPDATE USING (auth.uid() = id);


-- ────────────────────────────────────────────────────────────
-- TABLE: properties
-- Client sites / buildings managed for fire compliance.
-- ────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.properties (
  id                  UUID        NOT NULL DEFAULT gen_random_uuid(),
  name                TEXT        NOT NULL,
  address             TEXT,
  suburb              TEXT,
  state               TEXT,
  postcode            TEXT,
  site_contact_name   TEXT,
  site_contact_phone  TEXT,
  access_notes        TEXT,
  hazard_notes        TEXT,
  compliance_status   TEXT        NOT NULL DEFAULT 'pending'
                      CHECK (compliance_status IN ('compliant', 'non_compliant', 'overdue', 'pending')),
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT properties_pkey PRIMARY KEY (id)
);

ALTER TABLE public.properties ENABLE ROW LEVEL SECURITY;

CREATE POLICY "properties_select_auth" ON public.properties
  FOR SELECT USING (auth.role() = 'authenticated');


-- ────────────────────────────────────────────────────────────
-- TABLE: assets
-- Fire safety assets installed at a property.
-- variant and asset_ref added via Migration 5 (April 2026).
-- ────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.assets (
  id                UUID        NOT NULL DEFAULT gen_random_uuid(),
  property_id       UUID        NOT NULL,
  asset_type        TEXT        NOT NULL,
  variant           TEXT,                             -- Sub-variant e.g. "DCP AB(E) 4.5KG"
  asset_ref         TEXT,                             -- Site ref number e.g. "001"
  description       TEXT,
  location_on_site  TEXT,
  serial_number     TEXT,
  barcode_id        TEXT,
  install_date      DATE,
  last_service_date DATE,
  next_service_date DATE,
  status            TEXT        NOT NULL DEFAULT 'active'
                    CHECK (status IN ('active', 'decommissioned')),
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT assets_pkey              PRIMARY KEY (id),
  CONSTRAINT assets_property_id_fkey  FOREIGN KEY (property_id) REFERENCES public.properties(id)
);

ALTER TABLE public.assets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "assets_select_auth" ON public.assets
  FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "assets_insert_auth" ON public.assets
  FOR INSERT WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "assets_update_auth" ON public.assets
  FOR UPDATE USING (auth.role() = 'authenticated');

CREATE INDEX IF NOT EXISTS idx_assets_property_id ON public.assets(property_id);

COMMENT ON COLUMN public.assets.variant IS
  'Sub-variant from the official list in constants/AssetData.ts. '
  'Examples: "DCP AB(E) 4.5KG", "Quick Fit (Ceiling Mount) - Exit", "Fire Door - Single"';

COMMENT ON COLUMN public.assets.asset_ref IS
  'Short technician reference number for this asset at the site. '
  'Examples: "001", "040". Used for quick on-site identification.';


-- ────────────────────────────────────────────────────────────
-- TABLE: jobs
-- Work orders assigned to technicians.
-- ────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.jobs (
  id             UUID        NOT NULL DEFAULT gen_random_uuid(),
  property_id    UUID        NOT NULL,
  assigned_to    UUID        NOT NULL,
  job_type       TEXT        NOT NULL
                 CHECK (job_type IN ('routine_service', 'defect_repair', 'installation', 'emergency', 'quote')),
  status         TEXT        NOT NULL DEFAULT 'scheduled'
                 CHECK (status IN ('scheduled', 'in_progress', 'completed', 'cancelled')),
  scheduled_date DATE        NOT NULL,
  scheduled_time TIME,
  priority       TEXT        NOT NULL DEFAULT 'normal'
                 CHECK (priority IN ('low', 'normal', 'high', 'urgent')),
  notes          TEXT,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT jobs_pkey              PRIMARY KEY (id),
  CONSTRAINT jobs_property_id_fkey  FOREIGN KEY (property_id) REFERENCES public.properties(id),
  CONSTRAINT jobs_assigned_to_fkey  FOREIGN KEY (assigned_to)  REFERENCES public.users(id)
);

ALTER TABLE public.jobs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "jobs_select_assigned" ON public.jobs
  FOR SELECT USING (auth.uid() = assigned_to);

CREATE POLICY "jobs_update_assigned" ON public.jobs
  FOR UPDATE USING (auth.uid() = assigned_to);

CREATE INDEX IF NOT EXISTS idx_jobs_assigned_to    ON public.jobs(assigned_to);
CREATE INDEX IF NOT EXISTS idx_jobs_status         ON public.jobs(status);
CREATE INDEX IF NOT EXISTS idx_jobs_scheduled_date ON public.jobs(scheduled_date);


-- ────────────────────────────────────────────────────────────
-- TABLE: job_assets
-- Inspection result recorded per asset per job.
-- checklist_data and is_compliant added via Audit Migration (April 2026).
-- ────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.job_assets (
  id               UUID        NOT NULL DEFAULT gen_random_uuid(),
  job_id           UUID        NOT NULL,
  asset_id         UUID        NOT NULL,
  result           TEXT
                   CHECK (result IN ('pass', 'fail', 'not_tested')),
  defect_reason    TEXT,
  technician_notes TEXT,
  actioned_at      TIMESTAMPTZ,
  checklist_data   JSONB,                             -- Completed checklist answers
  is_compliant     BOOLEAN     NOT NULL DEFAULT FALSE,
  CONSTRAINT job_assets_pkey            PRIMARY KEY (id),
  CONSTRAINT job_assets_job_id_fkey     FOREIGN KEY (job_id)   REFERENCES public.jobs(id),
  CONSTRAINT job_assets_asset_id_fkey   FOREIGN KEY (asset_id) REFERENCES public.assets(id)
);

ALTER TABLE public.job_assets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "job_assets_select_via_job" ON public.job_assets
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.jobs j WHERE j.id = job_id AND j.assigned_to = auth.uid())
  );

CREATE POLICY "job_assets_insert_via_job" ON public.job_assets
  FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM public.jobs j WHERE j.id = job_id AND j.assigned_to = auth.uid())
  );

CREATE POLICY "job_assets_update_via_job" ON public.job_assets
  FOR UPDATE USING (
    EXISTS (SELECT 1 FROM public.jobs j WHERE j.id = job_id AND j.assigned_to = auth.uid())
  );

CREATE INDEX IF NOT EXISTS idx_job_assets_asset_id ON public.job_assets(asset_id);
CREATE INDEX IF NOT EXISTS idx_job_assets_job_id   ON public.job_assets(job_id);


-- ────────────────────────────────────────────────────────────
-- TABLE: defects
-- Deficiency raised during an inspection.
-- photos stores an array of Storage URLs.
-- ────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.defects (
  id          UUID        NOT NULL DEFAULT gen_random_uuid(),
  job_id      UUID        NOT NULL,
  asset_id    UUID        NOT NULL,
  property_id UUID        NOT NULL,
  description TEXT        NOT NULL,
  severity    TEXT        NOT NULL
              CHECK (severity IN ('minor', 'major', 'critical')),
  status      TEXT        NOT NULL DEFAULT 'open'
              CHECK (status IN ('open', 'quoted', 'repaired', 'monitoring')),
  photos      TEXT[]      NOT NULL DEFAULT '{}',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT defects_pkey              PRIMARY KEY (id),
  CONSTRAINT defects_job_id_fkey       FOREIGN KEY (job_id)      REFERENCES public.jobs(id),
  CONSTRAINT defects_asset_id_fkey     FOREIGN KEY (asset_id)    REFERENCES public.assets(id),
  CONSTRAINT defects_property_id_fkey  FOREIGN KEY (property_id) REFERENCES public.properties(id)
);

ALTER TABLE public.defects ENABLE ROW LEVEL SECURITY;

CREATE POLICY "defects_select_via_job" ON public.defects
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.jobs j WHERE j.id = job_id AND j.assigned_to = auth.uid())
  );

CREATE POLICY "defects_insert_via_job" ON public.defects
  FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM public.jobs j WHERE j.id = job_id AND j.assigned_to = auth.uid())
  );

CREATE POLICY "defects_update_via_job" ON public.defects
  FOR UPDATE USING (
    EXISTS (SELECT 1 FROM public.jobs j WHERE j.id = job_id AND j.assigned_to = auth.uid())
  );

CREATE INDEX IF NOT EXISTS idx_defects_job_id ON public.defects(job_id);


-- ────────────────────────────────────────────────────────────
-- TABLE: inspection_photos
-- Photo evidence captured during a job.
-- photo_url stores Supabase Storage public URLs.
-- ────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.inspection_photos (
  id          UUID        NOT NULL DEFAULT gen_random_uuid(),
  job_id      UUID        NOT NULL,
  asset_id    UUID,
  photo_url   TEXT        NOT NULL,
  caption     TEXT,
  uploaded_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  uploaded_by UUID        NOT NULL,
  CONSTRAINT inspection_photos_pkey              PRIMARY KEY (id),
  CONSTRAINT inspection_photos_job_id_fkey       FOREIGN KEY (job_id)      REFERENCES public.jobs(id),
  CONSTRAINT inspection_photos_asset_id_fkey     FOREIGN KEY (asset_id)    REFERENCES public.assets(id),
  CONSTRAINT inspection_photos_uploaded_by_fkey  FOREIGN KEY (uploaded_by) REFERENCES public.users(id)
);

ALTER TABLE public.inspection_photos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "photos_select_via_job" ON public.inspection_photos
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.jobs j WHERE j.id = job_id AND j.assigned_to = auth.uid())
  );

CREATE POLICY "photos_insert_via_job" ON public.inspection_photos
  FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM public.jobs j WHERE j.id = job_id AND j.assigned_to = auth.uid())
  );

-- DELETE: technician can delete photos they uploaded, for jobs assigned to them
CREATE POLICY "photos_delete_via_job" ON public.inspection_photos
  FOR DELETE USING (
    EXISTS (SELECT 1 FROM public.jobs j WHERE j.id = job_id AND j.assigned_to = auth.uid())
  );


-- ────────────────────────────────────────────────────────────
-- TABLE: signatures
-- Client sign-off captured at job completion.
-- signature_url is a Supabase Storage public URL (never base64).
-- ────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.signatures (
  id             UUID        NOT NULL DEFAULT gen_random_uuid(),
  job_id         UUID        NOT NULL UNIQUE,
  signature_url  TEXT        NOT NULL,
  signed_by_name TEXT        NOT NULL,
  signed_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT signatures_pkey        PRIMARY KEY (id),
  CONSTRAINT signatures_job_id_fkey FOREIGN KEY (job_id) REFERENCES public.jobs(id)
);

ALTER TABLE public.signatures ENABLE ROW LEVEL SECURITY;

CREATE POLICY "signatures_select_via_job" ON public.signatures
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.jobs j WHERE j.id = job_id AND j.assigned_to = auth.uid())
  );

CREATE POLICY "signatures_insert_via_job" ON public.signatures
  FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM public.jobs j WHERE j.id = job_id AND j.assigned_to = auth.uid())
  );

COMMENT ON COLUMN public.signatures.signature_url IS
  'Public Supabase Storage URL to the PNG signature image. '
  'Format: https://[project].supabase.co/storage/v1/object/public/job-photos/signatures/[job_id]/signature.png';


-- ────────────────────────────────────────────────────────────
-- TABLE: time_logs
-- Clock-in / clock-out records with optional GPS coordinates.
-- ────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.time_logs (
  id                   UUID        NOT NULL DEFAULT gen_random_uuid(),
  job_id               UUID        NOT NULL,
  user_id              UUID        NOT NULL,
  clock_in             TIMESTAMPTZ NOT NULL,
  clock_out            TIMESTAMPTZ,
  gps_lat              NUMERIC,
  gps_lng              NUMERIC,
  travel_time_minutes  INTEGER,
  CONSTRAINT time_logs_pkey         PRIMARY KEY (id),
  CONSTRAINT time_logs_job_id_fkey  FOREIGN KEY (job_id)  REFERENCES public.jobs(id),
  CONSTRAINT time_logs_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id)
);

ALTER TABLE public.time_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "time_logs_select_own" ON public.time_logs
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "time_logs_insert_own" ON public.time_logs
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "time_logs_update_own" ON public.time_logs
  FOR UPDATE USING (auth.uid() = user_id);


-- ────────────────────────────────────────────────────────────
-- TABLE: inventory_items
-- Parts / materials catalogue used in quoting.
-- ────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.inventory_items (
  id          UUID        NOT NULL DEFAULT gen_random_uuid(),
  name        TEXT        NOT NULL,
  description TEXT,
  price       NUMERIC     NOT NULL DEFAULT 0.0,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT inventory_items_pkey PRIMARY KEY (id)
);

ALTER TABLE public.inventory_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "inventory_select_auth" ON public.inventory_items
  FOR SELECT USING (auth.role() = 'authenticated');


-- ────────────────────────────────────────────────────────────
-- TABLE: quotes
-- Quotes generated by technicians for client approval.
-- ────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.quotes (
  id           UUID        NOT NULL DEFAULT gen_random_uuid(),
  job_id       UUID        NOT NULL,
  status       TEXT        NOT NULL DEFAULT 'draft'
               CHECK (status IN ('draft', 'approved', 'rejected')),
  total_amount NUMERIC     NOT NULL DEFAULT 0.0,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT quotes_pkey        PRIMARY KEY (id),
  CONSTRAINT quotes_job_id_fkey FOREIGN KEY (job_id) REFERENCES public.jobs(id)
);

ALTER TABLE public.quotes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "quotes_select_via_job" ON public.quotes
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.jobs j WHERE j.id = job_id AND j.assigned_to = auth.uid())
  );

CREATE POLICY "quotes_insert_via_job" ON public.quotes
  FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM public.jobs j WHERE j.id = job_id AND j.assigned_to = auth.uid())
  );

CREATE POLICY "quotes_update_via_job" ON public.quotes
  FOR UPDATE USING (
    EXISTS (SELECT 1 FROM public.jobs j WHERE j.id = job_id AND j.assigned_to = auth.uid())
  );


-- ────────────────────────────────────────────────────────────
-- TABLE: quote_items
-- Individual line items on a quote.
-- ────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.quote_items (
  id                  UUID    NOT NULL DEFAULT gen_random_uuid(),
  quote_id            UUID    NOT NULL,
  inventory_item_id   UUID    NOT NULL,
  defect_id           UUID,
  quantity            INTEGER NOT NULL DEFAULT 1,
  unit_price          NUMERIC NOT NULL DEFAULT 0.0,
  CONSTRAINT quote_items_pkey                  PRIMARY KEY (id),
  CONSTRAINT quote_items_quote_id_fkey         FOREIGN KEY (quote_id)          REFERENCES public.quotes(id),
  CONSTRAINT quote_items_inventory_item_id_fkey FOREIGN KEY (inventory_item_id) REFERENCES public.inventory_items(id),
  CONSTRAINT quote_items_defect_id_fkey        FOREIGN KEY (defect_id)         REFERENCES public.defects(id)
);

ALTER TABLE public.quote_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "quote_items_select_via_quote" ON public.quote_items
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.quotes q
      JOIN public.jobs j ON j.id = q.job_id
      WHERE q.id = quote_id AND j.assigned_to = auth.uid()
    )
  );


-- ────────────────────────────────────────────────────────────
-- TABLE: notifications
-- Push / in-app notifications per technician. (Phase 9)
-- ────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.notifications (
  id          UUID        NOT NULL DEFAULT gen_random_uuid(),
  type        TEXT        NOT NULL DEFAULT 'general'
              CHECK (type IN ('new_job', 'urgent_job', 'sync_complete', 'defect_flagged', 'general')),
  title       TEXT        NOT NULL,
  message     TEXT        NOT NULL,
  job_id      UUID        REFERENCES public.jobs(id) ON DELETE SET NULL,
  user_id     UUID        REFERENCES public.users(id) ON DELETE CASCADE,
  is_read     BOOLEAN     NOT NULL DEFAULT FALSE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT notifications_pkey PRIMARY KEY (id)
);

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "notifications_select_own" ON public.notifications
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "notifications_insert_own" ON public.notifications
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "notifications_update_own" ON public.notifications
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "notifications_delete_own" ON public.notifications
  FOR DELETE USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON public.notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_is_read  ON public.notifications(is_read);
CREATE INDEX IF NOT EXISTS idx_notifications_created  ON public.notifications(created_at DESC);


-- ────────────────────────────────────────────────────────────
-- UPDATED_AT TRIGGER
-- Automatically bumps updated_at on jobs and properties.
-- ────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS jobs_updated_at       ON public.jobs;
DROP TRIGGER IF EXISTS properties_updated_at ON public.properties;

CREATE TRIGGER jobs_updated_at
  BEFORE UPDATE ON public.jobs
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER properties_updated_at
  BEFORE UPDATE ON public.properties
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();


-- ────────────────────────────────────────────────────────────
-- VERIFY — Run after applying to confirm all tables exist
-- ────────────────────────────────────────────────────────────

SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'public'
ORDER BY table_name;
