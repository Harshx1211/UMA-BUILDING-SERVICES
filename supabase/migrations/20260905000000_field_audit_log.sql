-- ============================================================
-- Migration: field_audit_log — per-save field-change history
-- for job_assets (inspection results) and defects.
-- One row per SAVE ACTION (not per changed field) — see
-- store/inspectionStore.ts / store/defectsStore.ts write sites.
-- ============================================================

CREATE TABLE IF NOT EXISTS public.field_audit_log (
  id          uuid NOT NULL DEFAULT gen_random_uuid(),
  company_id  uuid NOT NULL,
  table_name  text NOT NULL CHECK (table_name = ANY (ARRAY['job_assets'::text, 'defects'::text])),
  record_id   uuid NOT NULL,
  -- Denormalized on purpose: lets this table ride the exact same
  -- _pullRelated('field_audit_log', 'job_id', jobIds) mechanism already
  -- used for job_assets/defects/inspection_photos/signatures/time_logs
  -- (lib/sync.ts _pullJobs), instead of inventing a new pull path that
  -- would need to join through job_assets/defects by record_id first.
  job_id      uuid NOT NULL,
  changes     jsonb NOT NULL,  -- [{field, old, new}, ...] for this one save
  changed_by  uuid,
  changed_at  timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT field_audit_log_pkey PRIMARY KEY (id),
  CONSTRAINT field_audit_log_company_id_fkey FOREIGN KEY (company_id) REFERENCES public.companies(id),
  CONSTRAINT field_audit_log_job_id_fkey FOREIGN KEY (job_id) REFERENCES public.jobs(id),
  CONSTRAINT field_audit_log_changed_by_fkey FOREIGN KEY (changed_by) REFERENCES public.users(id)
);

CREATE INDEX IF NOT EXISTS idx_field_audit_log_record ON public.field_audit_log(table_name, record_id);
CREATE INDEX IF NOT EXISTS idx_field_audit_log_job_id ON public.field_audit_log(job_id);

CREATE OR REPLACE FUNCTION public.get_user_company_id()
RETURNS uuid
LANGUAGE sql SECURITY DEFINER SET search_path = public
STABLE
AS $$
  SELECT company_id FROM public.users WHERE id = auth.uid();
$$;

ALTER TABLE public.field_audit_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "field_audit_log_tenant_isolation" ON public.field_audit_log;
CREATE POLICY "field_audit_log_tenant_isolation" ON public.field_audit_log
  FOR ALL
  USING (company_id = public.get_user_company_id());

-- NOT added to supabase_realtime: this is an audit trail, not a live-sync
-- feed. Nothing in the app needs to react to a new audit-log row arriving
-- from another device mid-session the way inspect.tsx's live job_assets/
-- defects polling does (20260901010000_job_assets_defects_realtime.sql).
-- The Timeline UI reads it on screen-focus, same as the existing
-- getAssetHistory() "History" card.

-- Run this once in the Supabase SQL Editor.
