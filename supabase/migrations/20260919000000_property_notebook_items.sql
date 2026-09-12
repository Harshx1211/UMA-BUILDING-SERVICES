-- ============================================================
-- Migration: property_notebook_items — a shared, per-property running
-- list of things to remember about a site (equipment to bring, access
-- quirks, anything worth flagging to whoever visits next). Deliberately
-- NOT the same thing as properties.hazard_notes/access_notes/site_note
-- (those are single admin-configured fields) — this is a technician-
-- authored, add/delete-only bullet list, shared across the whole company
-- so the next visit benefits from what a previous one left behind.
-- ============================================================

CREATE TABLE IF NOT EXISTS public.property_notebook_items (
  id           uuid NOT NULL DEFAULT gen_random_uuid(),
  company_id   uuid NOT NULL,
  property_id  uuid NOT NULL,
  text         text NOT NULL,
  created_by   uuid,
  created_at   timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT property_notebook_items_pkey PRIMARY KEY (id),
  CONSTRAINT property_notebook_items_company_id_fkey FOREIGN KEY (company_id) REFERENCES public.companies(id),
  CONSTRAINT property_notebook_items_property_id_fkey FOREIGN KEY (property_id) REFERENCES public.properties(id),
  CONSTRAINT property_notebook_items_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id)
);

CREATE INDEX IF NOT EXISTS idx_property_notebook_items_property_id ON public.property_notebook_items(property_id);

ALTER TABLE public.property_notebook_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "property_notebook_items_tenant_isolation" ON public.property_notebook_items;
CREATE POLICY "property_notebook_items_tenant_isolation" ON public.property_notebook_items
  FOR ALL
  USING (company_id = public.get_user_company_id());

-- Deletes propagate to every other device via the deletion_log mechanism
-- (see 20260910000000_deletion_log.sql) — without this, a technician who
-- deletes a stale reminder on their own phone would never make it
-- disappear from a colleague's, since the periodic pull only ever upserts
-- rows a SELECT still returns and never notices one that's now missing.
DROP TRIGGER IF EXISTS trg_log_deletion ON public.property_notebook_items;
CREATE TRIGGER trg_log_deletion AFTER DELETE ON public.property_notebook_items
  FOR EACH ROW EXECUTE FUNCTION public.log_deletion();

-- No supabase_realtime subscription — a notebook update doesn't need
-- millisecond propagation the way job_assets/defects do; the periodic
-- sync pull (and deletion_log catch-up, which IS realtime-subscribed)
-- is a fine cadence for "remember to bring X next time."

-- Run this once in the Supabase SQL Editor.
