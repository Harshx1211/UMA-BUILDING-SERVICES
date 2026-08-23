-- ============================================================
-- SITETRACK — Live Supabase Schema (reference copy)
-- ============================================================
-- This file is NOT run against anything. It exists so there is
-- ONE place in the repo that reflects what the live database
-- actually looks like right now — paste a fresh export here
-- whenever the schema changes, and delete the old contents first.
--
-- All the old one-off "run this once" patch files that used to
-- live in supabase/migrations/ have been deleted (2026-08-22) —
-- they were already applied to the live project and kept around
-- only added confusion. This file replaces them as the reference.
--
-- HOW TO REFRESH THIS FILE
-- ------------------------
-- Option A — Supabase CLI (preferred, exact DDL):
--   1. npx supabase login          (must be the account that owns
--                                    THIS project, not another one)
--   2. npx supabase link --project-ref vnrmgcxmcspdgqcnmmdx
--   3. npx supabase db dump --schema public -f supabase/schema.sql
--
-- Option B — Dashboard (manual, no CLI login needed):
--   1. Open the Supabase dashboard for this project
--   2. Go to Database → Tables → (each table) → "..." → "View as SQL"
--      OR use the SQL Editor to run:
--        select table_name, column_name, data_type, is_nullable
--        from information_schema.columns
--        where table_schema = 'public'
--        order by table_name, ordinal_position;
--      and paste the result below for a quick reference
--      (this gives columns, not full DDL/RLS — Option A is better
--      when you actually need the exact CREATE TABLE / policy text)
--
-- ============================================================

-- Paste the schema export below this line.



-- WARNING: This schema is for context only and is not meant to be run.
-- Table order and constraints may not be valid for execution.

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
  notification_settings jsonb DEFAULT '{"new_job": true, "job_completed": false, "critical_defect": true, "overdue_service": true, "quote_submitted": true}'::jsonb,
  compliance_standards jsonb DEFAULT '{"bca": true, "as1670": false, "as1851": true, "as2293": true}'::jsonb,
  appearance_settings jsonb DEFAULT '{"theme": "Light", "primary_color": "#1B2D4F"}'::jsonb,
  custom_sidebar_label text,
  custom_sidebar_url text,
  accreditations text,
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
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  fpas_number text,
  fpas_class text,
  fpas_expiry date,
  state_license text,
  state_license_expiry date,
  accepted_tos_at timestamp with time zone,
  accepted_aup_at timestamp with time zone,
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
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
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT assets_pkey PRIMARY KEY (id),
  CONSTRAINT assets_company_id_fkey FOREIGN KEY (company_id) REFERENCES public.companies(id),
  CONSTRAINT assets_property_id_fkey FOREIGN KEY (property_id) REFERENCES public.properties(id)
);
CREATE TABLE public.jobs (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL,
  property_id uuid NOT NULL,
  assigned_to uuid NOT NULL,
  job_type text NOT NULL CHECK (job_type = ANY (ARRAY['routine_service_monthly'::text, 'routine_service_3_monthly'::text, 'routine_service_6_monthly'::text, 'routine_service_annual'::text, 'routine_service_5_yearly'::text, 'defect_repair_quote'::text, 'defect_repair'::text, 'quote'::text, 'installation'::text, 'emergency'::text])),
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
  severity text NOT NULL CHECK (severity = ANY (ARRAY['non_conformance'::text, 'non_critical'::text, 'critical'::text])),
  status text NOT NULL DEFAULT 'open'::text CHECK (status = ANY (ARRAY['open'::text, 'quoted'::text, 'repaired'::text, 'monitoring'::text])),
  defect_code text,
  quote_price numeric,
  photos ARRAY NOT NULL DEFAULT '{}'::text[],
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
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
  tech_signature_url text,
  device_info text,
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
  value text NOT NULL,
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
  code text NOT NULL,
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
CREATE TABLE public.audit_logs (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  table_name text NOT NULL,
  record_id uuid NOT NULL,
  action text NOT NULL CHECK (action = ANY (ARRAY['INSERT'::text, 'UPDATE'::text, 'DELETE'::text])),
  old_data jsonb,
  new_data jsonb,
  changed_by uuid,
  created_at timestamp with time zone NOT NULL DEFAULT timezone('utc'::text, now()),
  CONSTRAINT audit_logs_pkey PRIMARY KEY (id),
  CONSTRAINT audit_logs_changed_by_fkey FOREIGN KEY (changed_by) REFERENCES public.users(id)
);
CREATE TABLE public.quotes (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  company_id uuid,
  job_id uuid NOT NULL,
  status text NOT NULL DEFAULT 'draft'::text CHECK (status = ANY (ARRAY['draft'::text, 'sent'::text, 'approved'::text, 'rejected'::text])),
  total_amount numeric NOT NULL DEFAULT 0,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT quotes_pkey PRIMARY KEY (id),
  CONSTRAINT quotes_company_id_fkey FOREIGN KEY (company_id) REFERENCES public.companies(id),
  CONSTRAINT quotes_job_id_fkey FOREIGN KEY (job_id) REFERENCES public.jobs(id)
);
CREATE TABLE public.quote_items (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  company_id uuid,
  quote_id uuid NOT NULL,
  inventory_item_id uuid,
  defect_id uuid,
  quantity integer NOT NULL DEFAULT 1,
  unit_price numeric NOT NULL DEFAULT 0,
  item_name text,
  CONSTRAINT quote_items_pkey PRIMARY KEY (id),
  CONSTRAINT quote_items_company_id_fkey FOREIGN KEY (company_id) REFERENCES public.companies(id),
  CONSTRAINT quote_items_quote_id_fkey FOREIGN KEY (quote_id) REFERENCES public.quotes(id),
  CONSTRAINT quote_items_inventory_item_id_fkey FOREIGN KEY (inventory_item_id) REFERENCES public.inventory_items(id),
  CONSTRAINT quote_items_defect_id_fkey FOREIGN KEY (defect_id) REFERENCES public.defects(id)
);