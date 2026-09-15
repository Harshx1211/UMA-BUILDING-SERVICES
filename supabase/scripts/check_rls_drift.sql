-- ============================================================
-- RLS Policy Drift Check
-- ============================================================
-- Compares the LIVE state of every RLS policy on the `public` schema
-- against a known-good baseline captured right after the full
-- access-control audit + shadow-policy cleanup (2026-09-22). Run this
-- periodically — before/after any migration that touches RLS is a good
-- habit — to catch exactly the class of bug that caused real damage
-- earlier this project: a live policy silently differing from what the
-- tracked migration files claim, either because a migration's
-- `DROP POLICY` targeted a name that was never actually live (leaving an
-- old, untracked policy still active alongside the new one — this
-- silently defeated at least one real security fix before it was
-- caught), or because something was changed by hand in the Supabase
-- dashboard outside the migration history entirely.
--
-- HOW TO RUN: paste this whole file into the Supabase SQL Editor and run
-- it. Empty result = no drift, live state matches the baseline exactly.
-- Any row returned means something doesn't match and needs a look before
-- you trust that the tracked migrations reflect what's actually live —
-- paste the output to whoever's reviewing it (or to an AI session) the
-- same way this project's own drift was found and fixed.
--
-- HOW TO REFRESH THE BASELINE after a DELIBERATE, reviewed RLS change:
-- run the capture query at the very bottom of this file, and replace the
-- JSON blob below with its exact output (verbatim — don't hand-retype
-- it, the whole point of this file is not trusting a manually
-- reconstructed copy of live state).
-- ============================================================

WITH baseline AS (
  SELECT *
  FROM jsonb_to_recordset($baseline$
[
  {"tablename":"asset_tag_assignments","policyname":"asset_tag_assignments_tenant_isolation","cmd":"ALL","qual":"(company_id = ( SELECT get_user_company_id() AS get_user_company_id))","with_check":null},
  {"tablename":"asset_tags","policyname":"asset_tags_tenant_isolation","cmd":"ALL","qual":"(company_id = ( SELECT get_user_company_id() AS get_user_company_id))","with_check":null},
  {"tablename":"asset_type_definitions","policyname":"asset_type_definitions_select_global_template","cmd":"SELECT","qual":"(company_id IS NULL)","with_check":null},
  {"tablename":"asset_type_definitions","policyname":"asset_type_definitions_tenant_isolation","cmd":"ALL","qual":"(company_id = ( SELECT get_user_company_id() AS get_user_company_id))","with_check":null},
  {"tablename":"assets","policyname":"assets_tenant_isolation","cmd":"ALL","qual":"(company_id = ( SELECT get_user_company_id() AS get_user_company_id))","with_check":null},
  {"tablename":"companies","policyname":"companies_select_own","cmd":"SELECT","qual":"(id = ( SELECT get_user_company_id() AS get_user_company_id))","with_check":null},
  {"tablename":"defect_codes","policyname":"defect_codes_select_global_template","cmd":"SELECT","qual":"(company_id IS NULL)","with_check":null},
  {"tablename":"defect_codes","policyname":"defect_codes_tenant_isolation","cmd":"ALL","qual":"(company_id = ( SELECT get_user_company_id() AS get_user_company_id))","with_check":null},
  {"tablename":"defects","policyname":"defects_tenant_isolation","cmd":"ALL","qual":"(company_id = ( SELECT get_user_company_id() AS get_user_company_id))","with_check":null},
  {"tablename":"deletion_log","policyname":"deletion_log_tenant_isolation","cmd":"SELECT","qual":"(company_id = ( SELECT get_user_company_id() AS get_user_company_id))","with_check":null},
  {"tablename":"enquiries","policyname":"Tenant Admins can view their own company enquiries","cmd":"SELECT","qual":"(company_id IN ( SELECT users.company_id\n   FROM users\n  WHERE (users.id = auth.uid())))","with_check":null},
  {"tablename":"enquiries","policyname":"enquiries_public_insert","cmd":"INSERT","qual":null,"with_check":"true"},
  {"tablename":"field_audit_log","policyname":"field_audit_log_tenant_isolation","cmd":"ALL","qual":"(company_id = ( SELECT get_user_company_id() AS get_user_company_id))","with_check":null},
  {"tablename":"inspection_photos","policyname":"inspection_photos_tenant_isolation","cmd":"ALL","qual":"(company_id = ( SELECT get_user_company_id() AS get_user_company_id))","with_check":null},
  {"tablename":"inspection_photos","policyname":"photos_delete_via_job_technicians","cmd":"DELETE","qual":"(EXISTS ( SELECT 1\n   FROM job_technicians jt\n  WHERE ((jt.job_id = inspection_photos.job_id) AND (jt.user_id = auth.uid()))))","with_check":null},
  {"tablename":"inventory_items","policyname":"inventory_items_tenant_isolation","cmd":"ALL","qual":"(company_id = ( SELECT get_user_company_id() AS get_user_company_id))","with_check":null},
  {"tablename":"job_assets","policyname":"job_assets_tenant_isolation","cmd":"ALL","qual":"(company_id = ( SELECT get_user_company_id() AS get_user_company_id))","with_check":null},
  {"tablename":"job_technicians","policyname":"job_technicians_select_company","cmd":"SELECT","qual":"(company_id = ( SELECT get_user_company_id() AS get_user_company_id))","with_check":null},
  {"tablename":"job_technicians","policyname":"job_technicians_self_assign_insert","cmd":"INSERT","qual":null,"with_check":"((company_id = ( SELECT get_user_company_id() AS get_user_company_id)) AND (user_id = auth.uid()))"},
  {"tablename":"jobs","policyname":"jobs_tenant_isolation","cmd":"ALL","qual":"(company_id = ( SELECT get_user_company_id() AS get_user_company_id))","with_check":null},
  {"tablename":"notifications","policyname":"notifications_select_own_or_broadcast","cmd":"SELECT","qual":"((user_id = auth.uid()) OR (user_id IS NULL))","with_check":null},
  {"tablename":"platform_settings","policyname":"platform_settings_select","cmd":"SELECT","qual":"true","with_check":null},
  {"tablename":"platform_settings","policyname":"platform_settings_update","cmd":"UPDATE","qual":"(auth.uid() IN ( SELECT users.id\n   FROM users\n  WHERE (users.role = 'superadmin'::text)))","with_check":null},
  {"tablename":"properties","policyname":"properties_tenant_isolation","cmd":"ALL","qual":"(company_id = ( SELECT get_user_company_id() AS get_user_company_id))","with_check":null},
  {"tablename":"property_notebook_items","policyname":"property_notebook_items_tenant_isolation","cmd":"ALL","qual":"(company_id = ( SELECT get_user_company_id() AS get_user_company_id))","with_check":null},
  {"tablename":"quote_items","policyname":"quote_items_select_company","cmd":"SELECT","qual":"(COALESCE(company_id, ( SELECT COALESCE(q.company_id, j.company_id) AS \"coalesce\"\n   FROM (quotes q\n     JOIN jobs j ON ((j.id = q.job_id)))\n  WHERE (q.id = quote_items.quote_id))) = ( SELECT get_user_company_id() AS get_user_company_id))","with_check":null},
  {"tablename":"quotes","policyname":"quotes_select_company","cmd":"SELECT","qual":"(COALESCE(company_id, ( SELECT j.company_id\n   FROM jobs j\n  WHERE (j.id = quotes.job_id))) = ( SELECT get_user_company_id() AS get_user_company_id))","with_check":null},
  {"tablename":"signatures","policyname":"signatures_tenant_isolation","cmd":"ALL","qual":"(company_id = ( SELECT get_user_company_id() AS get_user_company_id))","with_check":null},
  {"tablename":"site_documents","policyname":"site_documents_tenant_isolation","cmd":"ALL","qual":"(company_id = ( SELECT get_user_company_id() AS get_user_company_id))","with_check":null},
  {"tablename":"super_admins","policyname":"Superadmins can read their own status","cmd":"SELECT","qual":"(auth.uid() = id)","with_check":null},
  {"tablename":"time_logs","policyname":"time_logs_select_own_or_assigned_job","cmd":"SELECT","qual":"((company_id = ( SELECT get_user_company_id() AS get_user_company_id)) AND ((user_id = auth.uid()) OR (EXISTS ( SELECT 1\n   FROM job_technicians jt\n  WHERE ((jt.job_id = time_logs.job_id) AND (jt.user_id = auth.uid()))))))","with_check":null},
  {"tablename":"users","policyname":"users_select_company","cmd":"SELECT","qual":"(company_id = ( SELECT get_user_company_id() AS get_user_company_id))","with_check":null},
  {"tablename":"users","policyname":"users_update_own_row","cmd":"UPDATE","qual":"(id = auth.uid())","with_check":null}
]
  $baseline$::jsonb) AS b(tablename text, policyname text, cmd text, qual text, with_check text)
),
live AS (
  SELECT tablename, policyname, cmd, qual, with_check
  FROM pg_policies
  WHERE schemaname = 'public'
)
SELECT 'MISSING — in baseline, not live (something was dropped)' AS drift_type,
       b.tablename, b.policyname, b.cmd, b.qual, b.with_check
FROM baseline b
LEFT JOIN live l ON l.tablename = b.tablename AND l.policyname = b.policyname
WHERE l.policyname IS NULL

UNION ALL

SELECT 'EXTRA — live, not in baseline (a new or shadow policy appeared)' AS drift_type,
       l.tablename, l.policyname, l.cmd, l.qual, l.with_check
FROM live l
LEFT JOIN baseline b ON b.tablename = l.tablename AND b.policyname = l.policyname
WHERE b.policyname IS NULL

UNION ALL

SELECT 'CHANGED — same name, definition differs from the baseline' AS drift_type,
       l.tablename, l.policyname, l.cmd, l.qual, l.with_check
FROM live l
JOIN baseline b ON b.tablename = l.tablename AND b.policyname = l.policyname
WHERE l.cmd IS DISTINCT FROM b.cmd
   OR l.qual IS DISTINCT FROM b.qual
   OR l.with_check IS DISTINCT FROM b.with_check

ORDER BY 1, 2, 3;

-- ============================================================
-- Baseline-capture query — run this to get a fresh JSON blob for the
-- $baseline$ literal above, after a deliberate RLS change you've
-- reviewed and want to accept as the new known-good state.
-- ============================================================
--
-- SELECT jsonb_agg(
--   jsonb_build_object(
--     'tablename', tablename, 'policyname', policyname, 'cmd', cmd,
--     'qual', qual, 'with_check', with_check
--   ) ORDER BY tablename, policyname
-- )
-- FROM pg_policies
-- WHERE schemaname = 'public';
