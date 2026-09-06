-- ============================================================
-- Migration: site_documents — scanned on-site paperwork (PDFs)
-- ============================================================
-- Backs the mobile app's "Scan Document" feature: a technician scans a
-- paper document (compliance certificate, manufacturer data plate,
-- handwritten sign-off sheet) on-site and it's attached to the property
-- permanently (property_id NOT NULL), with an optional job_id recording
-- which visit captured it. Anchored to property_id rather than job_id
-- (like assets, not like inspection_photos) so a document scanned during
-- one job is still visible from every future job at the same site.
--
-- Run this once in the Supabase SQL Editor.
-- ============================================================

CREATE TABLE IF NOT EXISTS public.site_documents (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL,
  property_id uuid NOT NULL,
  job_id uuid,
  title text,
  document_url text NOT NULL,
  page_count integer,
  uploaded_at timestamp with time zone NOT NULL DEFAULT now(),
  uploaded_by uuid NOT NULL,
  CONSTRAINT site_documents_pkey PRIMARY KEY (id),
  CONSTRAINT site_documents_company_id_fkey FOREIGN KEY (company_id) REFERENCES public.companies(id),
  CONSTRAINT site_documents_property_id_fkey FOREIGN KEY (property_id) REFERENCES public.properties(id),
  CONSTRAINT site_documents_job_id_fkey FOREIGN KEY (job_id) REFERENCES public.jobs(id),
  CONSTRAINT site_documents_uploaded_by_fkey FOREIGN KEY (uploaded_by) REFERENCES public.users(id)
);

CREATE INDEX IF NOT EXISTS idx_site_documents_property_id ON public.site_documents(property_id);
CREATE INDEX IF NOT EXISTS idx_site_documents_job_id ON public.site_documents(job_id);

ALTER TABLE public.site_documents ENABLE ROW LEVEL SECURITY;

-- Matches the tenant-isolation pattern used by every other table
-- (company_id = public.get_user_company_id()) — see job_technicians_tenant_isolation,
-- job_assets_tenant_isolation, etc.
DROP POLICY IF EXISTS "site_documents_tenant_isolation" ON public.site_documents;
CREATE POLICY "site_documents_tenant_isolation" ON public.site_documents
  FOR ALL
  USING (company_id = public.get_user_company_id());

-- Storage bucket for scanned document PDFs — public, same trust level as
-- job-photos (mobile-captured content at an obscure, non-guessable path,
-- not a private signed-URL deliverable like job-reports).
INSERT INTO storage.buckets (id, name, public)
VALUES ('site-documents', 'site-documents', true)
ON CONFLICT (id) DO NOTHING;
