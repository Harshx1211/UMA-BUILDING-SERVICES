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

-- Everything below was added after this script was first written — it used
-- to stop at 20260827, so it could never tell whether the later security
-- and report-pipeline migrations had actually been applied.

UNION ALL
SELECT '20260829000000_auto_seed_company_catalogue',
       'function seed_default_catalogue_for_new_company exists',
       CASE WHEN EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'seed_default_catalogue_for_new_company') THEN 'OK' ELSE 'MISSING' END

UNION ALL
SELECT '20260901000000_site_documents',
       'table site_documents exists',
       CASE WHEN to_regclass('public.site_documents') IS NOT NULL THEN 'OK' ELSE 'MISSING' END

UNION ALL
SELECT '20260905000000_field_audit_log',
       'table field_audit_log exists',
       CASE WHEN to_regclass('public.field_audit_log') IS NOT NULL THEN 'OK' ELSE 'MISSING' END

UNION ALL
SELECT '20260908030000_site_documents_updated_at',
       'site_documents.updated_at column exists',
       CASE WHEN EXISTS (SELECT 1 FROM information_schema.columns
                         WHERE table_schema='public' AND table_name='site_documents' AND column_name='updated_at')
            THEN 'OK' ELSE 'MISSING' END

UNION ALL
SELECT '20260910000000_deletion_log',
       'table deletion_log exists',
       CASE WHEN to_regclass('public.deletion_log') IS NOT NULL THEN 'OK' ELSE 'MISSING' END

UNION ALL
SELECT '20260914000000_admin_notification_toggles',
       'function notify_critical_defect exists',
       CASE WHEN EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'notify_critical_defect') THEN 'OK' ELSE 'MISSING' END

UNION ALL
SELECT '20260914010000_overdue_service_notifications',
       'function check_overdue_properties exists',
       CASE WHEN EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'check_overdue_properties') THEN 'OK' ELSE 'MISSING' END

UNION ALL
SELECT '20260915000000_server_side_business_rules',
       'function enforce_job_completion_requirements exists',
       CASE WHEN EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'enforce_job_completion_requirements') THEN 'OK' ELSE 'MISSING' END

UNION ALL
SELECT '20260916000000_site_documents_bucket_private',
       'storage bucket site-documents is private',
       CASE WHEN EXISTS (SELECT 1 FROM storage.buckets WHERE id = 'site-documents' AND public = false) THEN 'OK' ELSE 'MISSING' END

UNION ALL
SELECT '20260917000000_enquiry_email_exists_rpc',
       'function enquiry_email_exists exists',
       CASE WHEN EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'enquiry_email_exists') THEN 'OK' ELSE 'MISSING' END

UNION ALL
SELECT '20260918000000_job_photos_bucket_private',
       'storage bucket job-photos is private',
       CASE WHEN EXISTS (SELECT 1 FROM storage.buckets WHERE id = 'job-photos' AND public = false) THEN 'OK' ELSE 'MISSING' END

UNION ALL
SELECT '20260919000000_property_notebook_items',
       'table property_notebook_items exists',
       CASE WHEN to_regclass('public.property_notebook_items') IS NOT NULL THEN 'OK' ELSE 'MISSING' END

UNION ALL
SELECT '20260919010000_job_assets_internal_notes',
       'job_assets.internal_notes column exists',
       CASE WHEN EXISTS (SELECT 1 FROM information_schema.columns
                         WHERE table_schema='public' AND table_name='job_assets' AND column_name='internal_notes')
            THEN 'OK' ELSE 'MISSING' END

UNION ALL
SELECT '20260920000000_inspection_photos_stage',
       'inspection_photos.stage column exists',
       CASE WHEN EXISTS (SELECT 1 FROM information_schema.columns
                         WHERE table_schema='public' AND table_name='inspection_photos' AND column_name='stage')
            THEN 'OK' ELSE 'MISSING' END

UNION ALL
SELECT '20260920010000_defects_resolved_on_site',
       'defects.resolved_on_site column exists',
       CASE WHEN EXISTS (SELECT 1 FROM information_schema.columns
                         WHERE table_schema='public' AND table_name='defects' AND column_name='resolved_on_site')
            THEN 'OK' ELSE 'MISSING' END

UNION ALL
SELECT '20260921010000_atomic_report_lock',
       'function try_acquire_report_lock exists (report-generator needs this)',
       CASE WHEN EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'try_acquire_report_lock') THEN 'OK' ELSE 'MISSING' END

UNION ALL
SELECT '20260922000000_jobs_scoped_asset_ids',
       'jobs.scoped_asset_ids column exists',
       CASE WHEN EXISTS (SELECT 1 FROM information_schema.columns
                         WHERE table_schema='public' AND table_name='jobs' AND column_name='scoped_asset_ids')
            THEN 'OK' ELSE 'MISSING' END

UNION ALL
SELECT '20260922010000_fix_job_technicians_cross_tenant_leak',
       'job_technicians_self_assign_insert checks the job belongs to the caller''s company',
       CASE WHEN EXISTS (SELECT 1 FROM pg_policies
                         WHERE schemaname='public' AND tablename='job_technicians'
                           AND policyname='job_technicians_self_assign_insert'
                           AND with_check ILIKE '%jobs%')
            THEN 'OK' ELSE 'MISSING' END

UNION ALL
SELECT '20260922010000_fix_job_technicians_cross_tenant_leak',
       'photos_delete_via_job_technicians checks company_id',
       CASE WHEN EXISTS (SELECT 1 FROM pg_policies
                         WHERE schemaname='public' AND tablename='inspection_photos'
                           AND policyname='photos_delete_via_job_technicians'
                           AND qual ILIKE '%company_id%')
            THEN 'OK' ELSE 'MISSING' END

ORDER BY migration;
