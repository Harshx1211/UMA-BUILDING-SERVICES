-- ============================================================
-- Migration: deletion_log — propagate deletions to other devices
-- ============================================================
-- The one real gap in the sync engine: when a device deletes a row (a
-- defect, a photo, a document...), it removes it locally and pushes the
-- Delete to Supabase — but no OTHER device ever learns the row is gone.
-- Realtime never subscribed to DELETE events at all (filtering one by a
-- non-primary-key column like job_id needs REPLICA IDENTITY FULL, which
-- isn't set), and the periodic REST pull only ever upserts whatever a
-- SELECT returns — a deleted row simply isn't in that result set, which
-- looks identical to "never existed here" to the pull, so it never calls a
-- local delete either. A crew-mate's device just keeps showing the row
-- forever, live or not, until this is fixed.
--
-- This is an append-only audit log, not a live table being watched
-- directly: a Postgres trigger on each source table writes one row here on
-- every DELETE, which the client can (a) subscribe to via Realtime for
-- instant propagation, and (b) poll "since my last checkpoint" during the
-- periodic sync as a catch-up for whatever happened while the device was
-- offline or backgrounded — Realtime never replays events missed while
-- disconnected. Trigger-based, not per-call-site: catches a deletion made
-- from ANY client (mobile, admin dashboard, even a direct SQL delete), not
-- just ones this app's own code remembered to log.
--
-- Run this once in the Supabase SQL Editor.
-- ============================================================

CREATE TABLE IF NOT EXISTS public.deletion_log (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  company_id uuid,
  table_name text NOT NULL,
  record_id uuid NOT NULL,
  deleted_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_deletion_log_company_deleted_at
  ON public.deletion_log(company_id, deleted_at);
-- Client polling reads "everything since my last checkpoint" ordered by id
-- (an IDENTITY column, so it's a true insertion-order tiebreaker the same
-- way sync_queue's own id already is on the client — see getPendingSyncItems's
-- own comment in lib/database.ts).
CREATE INDEX IF NOT EXISTS idx_deletion_log_id ON public.deletion_log(id);

ALTER TABLE public.deletion_log ENABLE ROW LEVEL SECURITY;

-- Read-only for clients — only the trigger function (SECURITY DEFINER)
-- writes here, so there's no INSERT/UPDATE/DELETE policy for regular users
-- at all.
DROP POLICY IF EXISTS "deletion_log_tenant_isolation" ON public.deletion_log;
CREATE POLICY "deletion_log_tenant_isolation" ON public.deletion_log
  FOR SELECT
  USING (company_id = public.get_user_company_id());

-- OLD.company_id is read dynamically (to_jsonb) rather than assumed on
-- every table, since not all of this app's tables are guaranteed to carry
-- the same column set — this degrades to a NULL company_id (a row no
-- tenant's RLS filter will ever match — same "quietly untracked" outcome
-- as any other legacy NULL-company_id row already has elsewhere in this
-- schema) rather than failing the deletion itself if a column is ever
-- missing.
CREATE OR REPLACE FUNCTION public.log_deletion() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.deletion_log (company_id, table_name, record_id)
  VALUES ((to_jsonb(OLD) ->> 'company_id')::uuid, TG_TABLE_NAME, OLD.id);
  RETURN OLD;
END;
$$;

DROP TRIGGER IF EXISTS trg_log_deletion ON public.job_assets;
CREATE TRIGGER trg_log_deletion AFTER DELETE ON public.job_assets
  FOR EACH ROW EXECUTE FUNCTION public.log_deletion();

DROP TRIGGER IF EXISTS trg_log_deletion ON public.defects;
CREATE TRIGGER trg_log_deletion AFTER DELETE ON public.defects
  FOR EACH ROW EXECUTE FUNCTION public.log_deletion();

DROP TRIGGER IF EXISTS trg_log_deletion ON public.inspection_photos;
CREATE TRIGGER trg_log_deletion AFTER DELETE ON public.inspection_photos
  FOR EACH ROW EXECUTE FUNCTION public.log_deletion();

DROP TRIGGER IF EXISTS trg_log_deletion ON public.site_documents;
CREATE TRIGGER trg_log_deletion AFTER DELETE ON public.site_documents
  FOR EACH ROW EXECUTE FUNCTION public.log_deletion();

DROP TRIGGER IF EXISTS trg_log_deletion ON public.signatures;
CREATE TRIGGER trg_log_deletion AFTER DELETE ON public.signatures
  FOR EACH ROW EXECUTE FUNCTION public.log_deletion();

DROP TRIGGER IF EXISTS trg_log_deletion ON public.quotes;
CREATE TRIGGER trg_log_deletion AFTER DELETE ON public.quotes
  FOR EACH ROW EXECUTE FUNCTION public.log_deletion();

DROP TRIGGER IF EXISTS trg_log_deletion ON public.quote_items;
CREATE TRIGGER trg_log_deletion AFTER DELETE ON public.quote_items
  FOR EACH ROW EXECUTE FUNCTION public.log_deletion();

DROP TRIGGER IF EXISTS trg_log_deletion ON public.time_logs;
CREATE TRIGGER trg_log_deletion AFTER DELETE ON public.time_logs
  FOR EACH ROW EXECUTE FUNCTION public.log_deletion();

DROP TRIGGER IF EXISTS trg_log_deletion ON public.job_technicians;
CREATE TRIGGER trg_log_deletion AFTER DELETE ON public.job_technicians
  FOR EACH ROW EXECUTE FUNCTION public.log_deletion();

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'deletion_log'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.deletion_log;
  END IF;
END $$;
