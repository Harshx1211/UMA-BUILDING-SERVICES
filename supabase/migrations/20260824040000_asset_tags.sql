-- ============================================================
-- Migration: asset_tags — a real tagging system for assets
-- ============================================================
-- Two tables: asset_tags is the company's tag vocabulary (managed in
-- admin's Catalogue page, matching the asset_type_definitions/defect_codes
-- pattern already there); asset_tag_assignments is the many-to-many link —
-- one asset can carry several tags, one tag can apply to many assets.
--
-- Run this once in the Supabase SQL Editor.
-- ============================================================

CREATE TABLE IF NOT EXISTS public.asset_tags (
  id         uuid NOT NULL DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL,
  name       text NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT asset_tags_pkey PRIMARY KEY (id),
  CONSTRAINT asset_tags_company_id_fkey FOREIGN KEY (company_id) REFERENCES public.companies(id),
  -- Case-insensitive uniqueness per company — "Roof" and "roof" shouldn't
  -- both be creatable, that's just the same tag typed twice.
  CONSTRAINT asset_tags_company_name_unique UNIQUE (company_id, name)
);

CREATE TABLE IF NOT EXISTS public.asset_tag_assignments (
  id         uuid NOT NULL DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL,
  asset_id   uuid NOT NULL,
  tag_id     uuid NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT asset_tag_assignments_pkey PRIMARY KEY (id),
  CONSTRAINT asset_tag_assignments_company_id_fkey FOREIGN KEY (company_id) REFERENCES public.companies(id),
  CONSTRAINT asset_tag_assignments_asset_id_fkey FOREIGN KEY (asset_id) REFERENCES public.assets(id) ON DELETE CASCADE,
  CONSTRAINT asset_tag_assignments_tag_id_fkey FOREIGN KEY (tag_id) REFERENCES public.asset_tags(id) ON DELETE CASCADE,
  CONSTRAINT asset_tag_assignments_asset_tag_unique UNIQUE (asset_id, tag_id)
);

CREATE INDEX IF NOT EXISTS idx_asset_tag_assignments_asset_id ON public.asset_tag_assignments(asset_id);
CREATE INDEX IF NOT EXISTS idx_asset_tag_assignments_tag_id  ON public.asset_tag_assignments(tag_id);

ALTER TABLE public.asset_tags ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.asset_tag_assignments ENABLE ROW LEVEL SECURITY;

-- Matches the tenant-isolation pattern used by every other table.
DROP POLICY IF EXISTS "asset_tags_tenant_isolation" ON public.asset_tags;
CREATE POLICY "asset_tags_tenant_isolation" ON public.asset_tags
  FOR ALL
  USING (company_id = public.get_user_company_id());

DROP POLICY IF EXISTS "asset_tag_assignments_tenant_isolation" ON public.asset_tag_assignments;
CREATE POLICY "asset_tag_assignments_tenant_isolation" ON public.asset_tag_assignments
  FOR ALL
  USING (company_id = public.get_user_company_id());
