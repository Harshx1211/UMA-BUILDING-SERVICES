-- Diagnostic: why does mobile show 3 sites completed but the compliance
-- backfill preview only found 2?
--
-- This lists every property for your company, alongside EVERY job against
-- it (any status, not just 'completed') and that job's actual result
-- counts — so we can see, per property, what Supabase actually has on
-- record right now, regardless of what the phone's local screen shows.
-- A job that's "Completed" on the device but hasn't synced yet will show
-- a status other than 'completed' here (or won't show at all if it was
-- never even inserted server-side).

WITH me AS (
  SELECT id AS user_id, company_id FROM users WHERE email = 'harsh123@gmail.com'
)
SELECT
  p.name                    AS property_name,
  p.compliance_status       AS property_compliance_status,
  j.id                      AS job_id,
  j.status                  AS job_status,
  j.scheduled_date,
  j.updated_at              AS job_updated_at,
  (SELECT count(*) FROM job_assets ja WHERE ja.job_id = j.id)                              AS job_assets_rows,
  (SELECT count(*) FROM job_assets ja WHERE ja.job_id = j.id AND ja.result = 'pass')        AS passed,
  (SELECT count(*) FROM job_assets ja WHERE ja.job_id = j.id AND ja.result = 'fail')        AS failed,
  (SELECT count(*) FROM job_assets ja WHERE ja.job_id = j.id AND ja.result = 'not_tested')  AS not_tested,
  (SELECT count(*) FROM job_assets ja WHERE ja.job_id = j.id AND ja.result IS NULL)         AS unactioned
FROM properties p
JOIN me ON p.company_id = me.company_id
LEFT JOIN jobs j ON j.property_id = p.id
ORDER BY p.name, j.updated_at DESC NULLS LAST;

-- Also worth checking directly: any sync_queue items still stuck? This
-- can't be queried from Supabase (sync_queue is a LOCAL SQLite table on
-- the phone, not synced to the server) — if the query above shows a job
-- missing or with a stale status, the next step is checking the app's own
-- Sync Status screen on the device for failed/pending items on that job.
