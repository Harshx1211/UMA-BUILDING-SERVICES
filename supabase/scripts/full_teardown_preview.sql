-- PREVIEW ONLY — every statement below is a SELECT, nothing here deletes
-- anything. Run this first in the Supabase SQL Editor and read the output
-- before running full_teardown_all_companies_and_users.sql.
--
-- This is the "delete literally everything company-shaped" teardown:
-- every company, every property/asset/job/defect/photo/etc under them, and
-- every user login that belongs to one of those companies. The only things
-- that survive are the global catalogue (asset_type_definitions/defect_codes
-- WHERE company_id IS NULL — the shared defaults every new company auto-seeds
-- from), platform_settings, and super_admins (the separate superadmin
-- console login, untouched either way).

-- ── Companies that will be deleted (all of them) ───────────────────────────
SELECT id, name, created_at FROM public.companies ORDER BY created_at;

-- ── User logins that will be deleted (every public.users + auth.users row
--    tied to one of the companies above) — check this list carefully ───────
SELECT u.id, u.email, u.full_name, u.role, c.name AS company_name
FROM public.users u
JOIN public.companies c ON c.id = u.company_id
ORDER BY c.name, u.email;

-- ── Row counts per table that will be wiped ─────────────────────────────────
SELECT 'properties' AS table_name, COUNT(*) FROM public.properties
UNION ALL SELECT 'assets',              COUNT(*) FROM public.assets
UNION ALL SELECT 'jobs',                COUNT(*) FROM public.jobs
UNION ALL SELECT 'job_assets',          COUNT(*) FROM public.job_assets
UNION ALL SELECT 'defects',             COUNT(*) FROM public.defects
UNION ALL SELECT 'inspection_photos',   COUNT(*) FROM public.inspection_photos
UNION ALL SELECT 'signatures',          COUNT(*) FROM public.signatures
UNION ALL SELECT 'time_logs',           COUNT(*) FROM public.time_logs
UNION ALL SELECT 'quotes',              COUNT(*) FROM public.quotes
UNION ALL SELECT 'quote_items',         COUNT(*) FROM public.quote_items
UNION ALL SELECT 'asset_tags',          COUNT(*) FROM public.asset_tags
UNION ALL SELECT 'asset_tag_assignments', COUNT(*) FROM public.asset_tag_assignments
UNION ALL SELECT 'job_technicians',     COUNT(*) FROM public.job_technicians
UNION ALL SELECT 'inventory_items (company-owned)', COUNT(*) FROM public.inventory_items WHERE company_id IS NOT NULL
UNION ALL SELECT 'enquiries',           COUNT(*) FROM public.enquiries
UNION ALL SELECT 'asset_type_definitions (company-owned)', COUNT(*) FROM public.asset_type_definitions WHERE company_id IS NOT NULL
UNION ALL SELECT 'defect_codes (company-owned)',           COUNT(*) FROM public.defect_codes WHERE company_id IS NOT NULL
UNION ALL SELECT 'public.users',        COUNT(*) FROM public.users
UNION ALL SELECT 'companies',           COUNT(*) FROM public.companies;

-- ── What is explicitly NOT touched — confirm these numbers look right too ──
SELECT 'global asset_type_definitions (company_id IS NULL)' AS table_name, COUNT(*) FROM public.asset_type_definitions WHERE company_id IS NULL
UNION ALL SELECT 'global defect_codes (company_id IS NULL)', COUNT(*) FROM public.defect_codes WHERE company_id IS NULL
UNION ALL SELECT 'super_admins',    COUNT(*) FROM public.super_admins
UNION ALL SELECT 'platform_settings', COUNT(*) FROM public.platform_settings;
