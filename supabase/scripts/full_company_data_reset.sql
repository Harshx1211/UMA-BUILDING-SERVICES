-- PREVIEW ONLY. Every statement in this file is a SELECT — nothing here can
-- modify or delete anything, no matter how you run it. There is no delete
-- step in this file on purpose: once you've run this and told me the
-- company id + the counts you see, I'll give you the actual delete
-- statements directly, as plain individual steps you run one at a time —
-- not bundled into a file you might run all at once.

-- ── Step 1 — find your company id ────────────────────────────────────────
SELECT id, name, created_at FROM companies ORDER BY created_at;

-- ── Step 2 — replace YOUR_COMPANY_ID below with the id from Step 1, ────────
-- ── then run this to see exactly what a full reset would remove ───────────
SELECT
  'properties' AS table_name, COUNT(*) FROM properties WHERE company_id = 'YOUR_COMPANY_ID'::uuid
UNION ALL SELECT 'assets',             COUNT(*) FROM assets             WHERE company_id = 'YOUR_COMPANY_ID'::uuid
UNION ALL SELECT 'jobs',               COUNT(*) FROM jobs               WHERE company_id = 'YOUR_COMPANY_ID'::uuid
UNION ALL SELECT 'job_assets',         COUNT(*) FROM job_assets         WHERE company_id = 'YOUR_COMPANY_ID'::uuid
UNION ALL SELECT 'defects',            COUNT(*) FROM defects            WHERE company_id = 'YOUR_COMPANY_ID'::uuid
UNION ALL SELECT 'inspection_photos',  COUNT(*) FROM inspection_photos  WHERE company_id = 'YOUR_COMPANY_ID'::uuid
UNION ALL SELECT 'signatures',         COUNT(*) FROM signatures         WHERE company_id = 'YOUR_COMPANY_ID'::uuid
UNION ALL SELECT 'time_logs',          COUNT(*) FROM time_logs          WHERE company_id = 'YOUR_COMPANY_ID'::uuid
UNION ALL SELECT 'quotes',             COUNT(*) FROM quotes             WHERE company_id = 'YOUR_COMPANY_ID'::uuid
UNION ALL SELECT 'quote_items',        COUNT(*) FROM quote_items        WHERE company_id = 'YOUR_COMPANY_ID'::uuid;

-- ── Step 3 — same replacement, lists Storage paths you'll clean up after ──
SELECT
  j.id AS job_id,
  'jobs/' || j.id || '/' AS job_photos_folder,
  j.id || '.pdf' AS job_reports_file,
  (j.report_url IS NOT NULL) AS has_generated_report
FROM jobs j
WHERE j.company_id = 'YOUR_COMPANY_ID'::uuid
ORDER BY j.created_at;
