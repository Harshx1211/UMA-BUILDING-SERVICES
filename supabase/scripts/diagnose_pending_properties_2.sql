-- Follow-up to diagnose_job_sync.sql: now that the compliance_status fix is
-- live and confirmed working (Pandav Farm correctly shows non_compliant),
-- two other properties still show "Pending" despite their jobs showing
-- "Completed" on the Jobs page. This checks two competing explanations:
--
--   1. Harbourview Towers is named "(Load T...)" — almost certainly the
--      pre-existing load_test_seed.sql script's test data, inserted directly
--      via SQL as status='completed'. If so it never went through the app's
--      updateJobStatus() at all, so no app-side fix — old or new — could
--      ever have written its compliance_status. total_job_assets = 0 (or a
--      job_created_at/updated_at that are identical/synthetic-looking) would
--      confirm this.
--
--   2. test12's job shows DONE: 28 Aug — one day before today. If that
--      completion happened before the device reloaded the fixed
--      store/jobsStore.ts, it's the exact same "stale bundle" situation from
--      before, just on a job that slipped through before the reload+retest.
--      job_updated_at being real/recent but property_updated_at being much
--      older would confirm this one.

SELECT
  p.name                    AS property_name,
  p.compliance_status,
  p.updated_at              AS property_updated_at,
  j.id                      AS job_id,
  j.status                  AS job_status,
  j.scheduled_date,
  j.created_at              AS job_created_at,
  j.updated_at              AS job_updated_at,
  (SELECT COUNT(*) FROM job_assets ja WHERE ja.job_id = j.id)                        AS total_job_assets,
  (SELECT COUNT(*) FROM job_assets ja WHERE ja.job_id = j.id AND ja.result = 'fail') AS failed_assets
FROM properties p
JOIN jobs j ON j.property_id = p.id
WHERE p.name ILIKE 'Harbourview Towers%'
   OR p.name = 'test12'
   OR p.name = 'Pandav Farm'
ORDER BY p.name, j.created_at DESC;
