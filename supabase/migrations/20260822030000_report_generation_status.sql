-- ============================================================
-- Migration: Report generation idempotency lock
-- ============================================================
-- Backs the new report-generator service's duplicate-generation guard (see
-- services/report-generator/src/generation/lock.ts). A retried request
-- (network hiccup, user double-tapping "Generate Report") must not spin up a
-- second full Gotenberg render pipeline for the same job.
--
-- Accessed only by the report-generator service via the service_role key —
-- RLS is enabled with zero policies so no anon/authenticated client can read
-- or write it directly.
--
-- Run this once in the Supabase SQL Editor.
-- ============================================================

CREATE TABLE IF NOT EXISTS public.report_generation_status (
  job_id uuid NOT NULL PRIMARY KEY REFERENCES public.jobs(id) ON DELETE CASCADE,
  status text NOT NULL CHECK (status = ANY (ARRAY['generating'::text, 'completed'::text, 'failed'::text])),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.report_generation_status ENABLE ROW LEVEL SECURITY;
