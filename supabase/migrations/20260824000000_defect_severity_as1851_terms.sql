-- ============================================================
-- Migration: align defects.severity with AS1851-2012 terminology
-- ============================================================
-- AS1851-2012 Clause 1.5.6 defines exactly three defect classifications:
-- critical defect / non-critical defect / non-conformance. SiteTrack was
-- using "critical / major / minor", which isn't the standard's language and
-- doesn't line up cleanly with what a Yearly Condition Report is required to
-- show. Existing data is remapped by severity order (closest reasonable
-- match, since non-critical-defect vs non-conformance is a difference in
-- *kind* — impairment vs missing/incorrect record-keeping info — not degree):
--   critical -> stays critical
--   major    -> non_critical
--   minor    -> non_conformance
--
-- Run this once in the Supabase SQL Editor.
-- ============================================================

BEGIN;

ALTER TABLE public.defects DROP CONSTRAINT IF EXISTS defects_severity_check;

UPDATE public.defects SET severity = 'non_critical'    WHERE severity = 'major';
UPDATE public.defects SET severity = 'non_conformance' WHERE severity = 'minor';

ALTER TABLE public.defects ADD CONSTRAINT defects_severity_check
  CHECK (severity = ANY (ARRAY['non_conformance'::text, 'non_critical'::text, 'critical'::text]));

COMMIT;
