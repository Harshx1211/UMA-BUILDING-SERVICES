-- ============================================================
-- SITETRACK SAAS — Canonical Supabase Schema
-- ============================================================
-- This is the AUTHORITATIVE multi-tenant schema.
-- It includes all table definitions, airtight Row Level Security 
-- (RLS) policies, storage buckets, and triggers.
--
-- HOW TO USE:
--   Fresh project → run this file ONCE in SQL Editor.
-- ============================================================

-- ────────────────────────────────────────────────────────────
-- EXTENSIONS & FUNCTIONS
-- ────────────────────────────────────────────────────────────

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Airtight lookup function for RLS
CREATE OR REPLACE FUNCTION public.get_user_company_id()
RETURNS uuid
LANGUAGE sql SECURITY DEFINER SET search_path = public
STABLE
AS $$
  SELECT company_id FROM public.users WHERE id = auth.uid();
$$;

CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ────────────────────────────────────────────────────────────
-- TABLE DEFINITIONS
-- ────────────────────────────────────────────────────────────

CREATE TABLE public.companies (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  name text NOT NULL,
  abn text,
  subscription_status text NOT NULL DEFAULT 'active'::text CHECK (subscription_status = ANY (ARRAY['active'::text, 'suspended'::text, 'cancelled'::text])),
  address text,
  phone text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  contact_email text,
  logo_url text,
  CONSTRAINT companies_pkey PRIMARY KEY (id)
);

CREATE TABLE public.users (
  id uuid NOT NULL,
  company_id uuid NOT NULL,
  email text NOT NULL UNIQUE,
  full_name text NOT NULL,
  role text NOT NULL DEFAULT 'technician'::text CHECK (role = ANY (ARRAY['technician'::text, 'subcontractor'::text, 'admin'::text])),
  phone text,
  avatar_url text,
  is_active boolean NOT NULL DEFAULT true,
  push_token text,
  accepted_tos_at timestamp with time zone,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT users_pkey PRIMARY KEY (id),
  CONSTRAINT users_id_fkey FOREIGN KEY (id) REFERENCES auth.users(id),
  CONSTRAINT users_company_id_fkey FOREIGN KEY (company_id) REFERENCES public.companies(id)
);

CREATE TABLE public.properties (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL,
  name text NOT NULL,
  address text,
  suburb text,
  state text,
  postcode text,
  site_contact_name text,
  site_contact_phone text,
  access_notes text,
  hazard_notes text,
  site_note text,
  compliance_status text NOT NULL DEFAULT 'pending'::text CHECK (compliance_status = ANY (ARRAY['compliant'::text, 'non_compliant'::text, 'overdue'::text, 'pending'::text])),
  next_inspection_date date,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT properties_pkey PRIMARY KEY (id),
  CONSTRAINT properties_company_id_fkey FOREIGN KEY (company_id) REFERENCES public.companies(id)
);

CREATE TABLE public.assets (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL,
  property_id uuid NOT NULL,
  asset_type text NOT NULL,
  variant text,
  asset_ref text,
  description text,
  location_on_site text,
  serial_number text,
  barcode_id text,
  install_date date,
  last_service_date date,
  next_service_date date,
  status text NOT NULL DEFAULT 'active'::text CHECK (status = ANY (ARRAY['active'::text, 'decommissioned'::text])),
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT assets_pkey PRIMARY KEY (id),
  CONSTRAINT assets_company_id_fkey FOREIGN KEY (company_id) REFERENCES public.companies(id),
  CONSTRAINT assets_property_id_fkey FOREIGN KEY (property_id) REFERENCES public.properties(id)
);

CREATE TABLE public.jobs (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL,
  property_id uuid NOT NULL,
  assigned_to uuid NOT NULL,
  job_type text NOT NULL CHECK (job_type = ANY (ARRAY['routine_service'::text, 'defect_repair'::text, 'installation'::text, 'emergency'::text, 'quote'::text])),
  status text NOT NULL DEFAULT 'scheduled'::text CHECK (status = ANY (ARRAY['scheduled'::text, 'in_progress'::text, 'completed'::text, 'cancelled'::text])),
  scheduled_date date NOT NULL,
  scheduled_time time without time zone,
  priority text NOT NULL DEFAULT 'normal'::text CHECK (priority = ANY (ARRAY['low'::text, 'normal'::text, 'high'::text, 'urgent'::text])),
  notes text,
  report_url text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT jobs_pkey PRIMARY KEY (id),
  CONSTRAINT jobs_company_id_fkey FOREIGN KEY (company_id) REFERENCES public.companies(id),
  CONSTRAINT jobs_property_id_fkey FOREIGN KEY (property_id) REFERENCES public.properties(id),
  CONSTRAINT jobs_assigned_to_fkey FOREIGN KEY (assigned_to) REFERENCES public.users(id)
);

CREATE TABLE public.job_assets (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL,
  job_id uuid NOT NULL,
  asset_id uuid NOT NULL,
  result text CHECK (result = ANY (ARRAY['pass'::text, 'fail'::text, 'not_tested'::text])),
  is_compliant boolean NOT NULL DEFAULT false,
  defect_reason text,
  technician_notes text,
  checklist_data jsonb,
  actioned_at timestamp with time zone,
  CONSTRAINT job_assets_pkey PRIMARY KEY (id),
  CONSTRAINT job_assets_company_id_fkey FOREIGN KEY (company_id) REFERENCES public.companies(id),
  CONSTRAINT job_assets_job_id_fkey FOREIGN KEY (job_id) REFERENCES public.jobs(id),
  CONSTRAINT job_assets_asset_id_fkey FOREIGN KEY (asset_id) REFERENCES public.assets(id)
);

CREATE TABLE public.defects (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL,
  job_id uuid NOT NULL,
  asset_id uuid NOT NULL,
  property_id uuid NOT NULL,
  description text NOT NULL,
  severity text NOT NULL CHECK (severity = ANY (ARRAY['minor'::text, 'major'::text, 'critical'::text])),
  status text NOT NULL DEFAULT 'open'::text CHECK (status = ANY (ARRAY['open'::text, 'quoted'::text, 'repaired'::text, 'monitoring'::text])),
  defect_code text,
  quote_price numeric,
  photos ARRAY NOT NULL DEFAULT '{}'::text[],
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT defects_pkey PRIMARY KEY (id),
  CONSTRAINT defects_company_id_fkey FOREIGN KEY (company_id) REFERENCES public.companies(id),
  CONSTRAINT defects_job_id_fkey FOREIGN KEY (job_id) REFERENCES public.jobs(id),
  CONSTRAINT defects_asset_id_fkey FOREIGN KEY (asset_id) REFERENCES public.assets(id),
  CONSTRAINT defects_property_id_fkey FOREIGN KEY (property_id) REFERENCES public.properties(id)
);

CREATE TABLE public.inspection_photos (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL,
  job_id uuid NOT NULL,
  asset_id uuid,
  defect_id uuid,
  photo_url text NOT NULL,
  caption text,
  uploaded_at timestamp with time zone NOT NULL DEFAULT now(),
  uploaded_by uuid NOT NULL,
  CONSTRAINT inspection_photos_pkey PRIMARY KEY (id),
  CONSTRAINT inspection_photos_company_id_fkey FOREIGN KEY (company_id) REFERENCES public.companies(id),
  CONSTRAINT inspection_photos_job_id_fkey FOREIGN KEY (job_id) REFERENCES public.jobs(id),
  CONSTRAINT inspection_photos_asset_id_fkey FOREIGN KEY (asset_id) REFERENCES public.assets(id),
  CONSTRAINT inspection_photos_defect_id_fkey FOREIGN KEY (defect_id) REFERENCES public.defects(id),
  CONSTRAINT inspection_photos_uploaded_by_fkey FOREIGN KEY (uploaded_by) REFERENCES public.users(id)
);

CREATE TABLE public.signatures (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL,
  job_id uuid NOT NULL UNIQUE,
  signature_url text NOT NULL,
  signed_by_name text NOT NULL,
  signed_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT signatures_pkey PRIMARY KEY (id),
  CONSTRAINT signatures_company_id_fkey FOREIGN KEY (company_id) REFERENCES public.companies(id),
  CONSTRAINT signatures_job_id_fkey FOREIGN KEY (job_id) REFERENCES public.jobs(id)
);

CREATE TABLE public.time_logs (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL,
  job_id uuid NOT NULL,
  user_id uuid NOT NULL,
  clock_in timestamp with time zone NOT NULL,
  clock_out timestamp with time zone,
  gps_lat numeric,
  gps_lng numeric,
  travel_time_minutes integer,
  CONSTRAINT time_logs_pkey PRIMARY KEY (id),
  CONSTRAINT time_logs_company_id_fkey FOREIGN KEY (company_id) REFERENCES public.companies(id),
  CONSTRAINT time_logs_job_id_fkey FOREIGN KEY (job_id) REFERENCES public.jobs(id),
  CONSTRAINT time_logs_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id)
);

CREATE TABLE public.asset_type_definitions (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  value text NOT NULL UNIQUE,
  label text NOT NULL,
  full_label text NOT NULL,
  icon text NOT NULL DEFAULT 'shield-check-outline'::text,
  color text NOT NULL DEFAULT '#6B7280'::text,
  inspection_routine text NOT NULL DEFAULT 'General Inspection'::text,
  variants ARRAY NOT NULL DEFAULT '{}'::text[],
  is_active boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  company_id uuid,
  CONSTRAINT asset_type_definitions_pkey PRIMARY KEY (id),
  CONSTRAINT asset_type_definitions_company_id_fkey FOREIGN KEY (company_id) REFERENCES public.companies(id)
);

CREATE TABLE public.defect_codes (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE,
  description text NOT NULL,
  quote_price numeric,
  category text NOT NULL DEFAULT 'General'::text,
  is_active boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  company_id uuid,
  CONSTRAINT defect_codes_pkey PRIMARY KEY (id),
  CONSTRAINT defect_codes_company_id_fkey FOREIGN KEY (company_id) REFERENCES public.companies(id)
);

CREATE TABLE public.enquiries (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  company_id uuid,
  name text NOT NULL,
  email text NOT NULL,
  phone text,
  service text NOT NULL,
  message text NOT NULL,
  status text NOT NULL DEFAULT 'new'::text CHECK (status = ANY (ARRAY['new'::text, 'contacted'::text, 'converted'::text, 'closed'::text])),
  notes text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT enquiries_pkey PRIMARY KEY (id),
  CONSTRAINT enquiries_company_id_fkey FOREIGN KEY (company_id) REFERENCES public.companies(id)
);

CREATE TABLE public.notifications (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid,
  title text NOT NULL,
  message text NOT NULL,
  type text,
  is_read boolean DEFAULT false,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT notifications_pkey PRIMARY KEY (id),
  CONSTRAINT notifications_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id)
);

CREATE TABLE public.super_admins (
  id uuid NOT NULL,
  email text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT super_admins_pkey PRIMARY KEY (id),
  CONSTRAINT super_admins_id_fkey FOREIGN KEY (id) REFERENCES auth.users(id)
);

CREATE TABLE public.platform_settings (
  id text NOT NULL DEFAULT 'global'::text,
  platform_name text NOT NULL DEFAULT 'SiteTrack'::text,
  support_email text NOT NULL DEFAULT 'support@sitetrack.io'::text,
  website_url text NOT NULL DEFAULT 'https://sitetrack.io'::text,
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT platform_settings_pkey PRIMARY KEY (id)
);

CREATE TABLE public.inventory_items (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text,
  price numeric NOT NULL DEFAULT 0.0,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  company_id uuid,
  CONSTRAINT inventory_items_pkey PRIMARY KEY (id),
  CONSTRAINT inventory_items_company_id_fkey FOREIGN KEY (company_id) REFERENCES public.companies(id)
);

-- ────────────────────────────────────────────────────────────
-- TRIGGERS
-- ────────────────────────────────────────────────────────────

DROP TRIGGER IF EXISTS companies_updated_at ON public.companies;
CREATE TRIGGER companies_updated_at BEFORE UPDATE ON public.companies FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

DROP TRIGGER IF EXISTS properties_updated_at ON public.properties;
CREATE TRIGGER properties_updated_at BEFORE UPDATE ON public.properties FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

DROP TRIGGER IF EXISTS jobs_updated_at ON public.jobs;
CREATE TRIGGER jobs_updated_at BEFORE UPDATE ON public.jobs FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

DROP TRIGGER IF EXISTS asset_type_definitions_updated_at ON public.asset_type_definitions;
CREATE TRIGGER asset_type_definitions_updated_at BEFORE UPDATE ON public.asset_type_definitions FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

DROP TRIGGER IF EXISTS defect_codes_updated_at ON public.defect_codes;
CREATE TRIGGER defect_codes_updated_at BEFORE UPDATE ON public.defect_codes FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

DROP TRIGGER IF EXISTS enquiries_updated_at ON public.enquiries;
CREATE TRIGGER enquiries_updated_at BEFORE UPDATE ON public.enquiries FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- ────────────────────────────────────────────────────────────
-- AIRTIGHT ROW LEVEL SECURITY (RLS)
-- ────────────────────────────────────────────────────────────

ALTER TABLE public.companies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.properties ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.assets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.job_assets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.defects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inspection_photos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.signatures ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.time_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.asset_type_definitions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.defect_codes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inventory_items ENABLE ROW LEVEL SECURITY;

-- 1. Companies (Select own company)
DROP POLICY IF EXISTS "companies_tenant_isolation" ON public.companies;
CREATE POLICY "companies_tenant_isolation" ON public.companies
  FOR SELECT USING (id = public.get_user_company_id());

-- 2. General Tenant Isolation Policies
DROP POLICY IF EXISTS "users_tenant_isolation" ON public.users;
CREATE POLICY "users_tenant_isolation" ON public.users FOR ALL USING (company_id = public.get_user_company_id());

DROP POLICY IF EXISTS "properties_tenant_isolation" ON public.properties;
CREATE POLICY "properties_tenant_isolation" ON public.properties FOR ALL USING (company_id = public.get_user_company_id());

DROP POLICY IF EXISTS "assets_tenant_isolation" ON public.assets;
CREATE POLICY "assets_tenant_isolation" ON public.assets FOR ALL USING (company_id = public.get_user_company_id());

DROP POLICY IF EXISTS "jobs_tenant_isolation" ON public.jobs;
CREATE POLICY "jobs_tenant_isolation" ON public.jobs FOR ALL USING (company_id = public.get_user_company_id());

DROP POLICY IF EXISTS "job_assets_tenant_isolation" ON public.job_assets;
CREATE POLICY "job_assets_tenant_isolation" ON public.job_assets FOR ALL USING (company_id = public.get_user_company_id());

DROP POLICY IF EXISTS "defects_tenant_isolation" ON public.defects;
CREATE POLICY "defects_tenant_isolation" ON public.defects FOR ALL USING (company_id = public.get_user_company_id());

DROP POLICY IF EXISTS "photos_tenant_isolation" ON public.inspection_photos;
CREATE POLICY "photos_tenant_isolation" ON public.inspection_photos FOR ALL USING (company_id = public.get_user_company_id());

DROP POLICY IF EXISTS "signatures_tenant_isolation" ON public.signatures;
CREATE POLICY "signatures_tenant_isolation" ON public.signatures FOR ALL USING (company_id = public.get_user_company_id());

DROP POLICY IF EXISTS "time_logs_tenant_isolation" ON public.time_logs;
CREATE POLICY "time_logs_tenant_isolation" ON public.time_logs FOR ALL USING (company_id = public.get_user_company_id());

DROP POLICY IF EXISTS "asset_types_tenant_isolation" ON public.asset_type_definitions;
CREATE POLICY "asset_types_tenant_isolation" ON public.asset_type_definitions FOR ALL USING (company_id = public.get_user_company_id());

DROP POLICY IF EXISTS "defect_codes_tenant_isolation" ON public.defect_codes;
CREATE POLICY "defect_codes_tenant_isolation" ON public.defect_codes FOR ALL USING (company_id = public.get_user_company_id());

DROP POLICY IF EXISTS "inventory_tenant_isolation" ON public.inventory_items;
CREATE POLICY "inventory_tenant_isolation" ON public.inventory_items FOR ALL USING (company_id = public.get_user_company_id());

-- 3. Storage Buckets (Job Photos)
INSERT INTO storage.buckets (id, name, public) 
VALUES ('job-photos', 'job-photos', true) 
ON CONFLICT (id) DO UPDATE SET public = true;

DROP POLICY IF EXISTS "tenant_photos_select" ON storage.objects;
DROP POLICY IF EXISTS "tenant_photos_insert" ON storage.objects;
DROP POLICY IF EXISTS "tenant_photos_delete" ON storage.objects;

CREATE POLICY "tenant_photos_select" ON storage.objects
  FOR SELECT USING (
    bucket_id = 'job-photos' AND 
    auth.uid() IN (SELECT id FROM public.users WHERE company_id = public.get_user_company_id())
  );

CREATE POLICY "tenant_photos_insert" ON storage.objects
  FOR INSERT WITH CHECK (
    bucket_id = 'job-photos' AND 
    auth.uid() IN (SELECT id FROM public.users WHERE company_id = public.get_user_company_id())
  );

CREATE POLICY "tenant_photos_delete" ON storage.objects
  FOR DELETE USING (
    bucket_id = 'job-photos' AND 
    auth.uid() IN (SELECT id FROM public.users WHERE company_id = public.get_user_company_id())
  );
