-- 100% read-only. Every line here is a SELECT against information_schema /
-- pg_catalog / storage.buckets / pg_policies — there is nothing in this file
-- that can modify data, no matter how you run it (whole file, one line at a
-- time, doesn't matter). Safe to paste-and-run entirely.
--
-- Checks every migration in supabase/migrations/ against what's actually
-- live in your database and reports OK or MISSING for each. Run this once
-- and read the "status" column.

SELECT '20260822000000_defects_asset_id_nullable' AS migration,
       'defects.asset_id is nullable' AS check_description,
       CASE WHEN (SELECT is_nullable FROM information_schema.columns
                  WHERE table_schema='public' AND table_name='defects' AND column_name='asset_id') = 'YES'
            THEN 'OK' ELSE 'MISSING' END AS status

UNION ALL
SELECT '20260822030000_report_generation_status',
       'table report_generation_status exists',
       CASE WHEN to_regclass('public.report_generation_status') IS NOT NULL THEN 'OK' ELSE 'MISSING' END

UNION ALL
SELECT '20260822040000_job_reports_bucket_policy',
       'storage bucket job-reports exists',
       CASE WHEN EXISTS (SELECT 1 FROM storage.buckets WHERE id = 'job-reports') THEN 'OK' ELSE 'MISSING' END

UNION ALL
SELECT '20260822040000_job_reports_bucket_policy',
       'policy job_reports_company_read exists',
       CASE WHEN EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='storage' AND tablename='objects' AND policyname='job_reports_company_read')
            THEN 'OK' ELSE 'MISSING' END

UNION ALL
SELECT '20260823000000_report_status_error_column',
       'report_generation_status.last_error column exists',
       CASE WHEN EXISTS (SELECT 1 FROM information_schema.columns
                         WHERE table_schema='public' AND table_name='report_generation_status' AND column_name='last_error')
            THEN 'OK' ELSE 'MISSING' END

UNION ALL
SELECT '20260824000000_defect_severity_as1851_terms',
       'defects_severity_check constraint uses new AS1851 terms',
       CASE WHEN (SELECT pg_get_constraintdef(oid) FROM pg_constraint WHERE conname = 'defects_severity_check') LIKE '%non_conformance%'
            THEN 'OK' ELSE 'MISSING' END

UNION ALL
SELECT '20260824000000_defect_severity_as1851_terms',
       'no defects rows still using old major/minor severity values',
       CASE WHEN NOT EXISTS (SELECT 1 FROM defects WHERE severity IN ('major','minor')) THEN 'OK' ELSE 'MISSING (old rows remain)' END

UNION ALL
SELECT '20260824010000_company_accreditations',
       'companies.accreditations column exists',
       CASE WHEN EXISTS (SELECT 1 FROM information_schema.columns
                         WHERE table_schema='public' AND table_name='companies' AND column_name='accreditations')
            THEN 'OK' ELSE 'MISSING' END

UNION ALL
SELECT '20260824020000_job_technicians',
       'table job_technicians exists',
       CASE WHEN to_regclass('public.job_technicians') IS NOT NULL THEN 'OK' ELSE 'MISSING' END

UNION ALL
SELECT '20260824030000_job_assets_actioned_by',
       'job_assets.actioned_by column exists',
       CASE WHEN EXISTS (SELECT 1 FROM information_schema.columns
                         WHERE table_schema='public' AND table_name='job_assets' AND column_name='actioned_by')
            THEN 'OK' ELSE 'MISSING' END

UNION ALL
SELECT '20260824040000_asset_tags',
       'table asset_tags exists',
       CASE WHEN to_regclass('public.asset_tags') IS NOT NULL THEN 'OK' ELSE 'MISSING' END

UNION ALL
SELECT '20260824040000_asset_tags',
       'table asset_tag_assignments exists',
       CASE WHEN to_regclass('public.asset_tag_assignments') IS NOT NULL THEN 'OK' ELSE 'MISSING' END

UNION ALL
SELECT '20260827010000_job_assets_unique_constraint',
       'unique constraint job_assets_job_asset_unique exists',
       CASE WHEN EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'job_assets_job_asset_unique') THEN 'OK' ELSE 'MISSING' END

ORDER BY migration;
