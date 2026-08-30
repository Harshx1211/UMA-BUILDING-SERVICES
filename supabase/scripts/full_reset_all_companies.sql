-- Full transactional-data reset across all three companies in this project —
-- confirmed by you as all dummy/test data. Real IDs are baked in directly
-- below, nothing to edit. Deletes in dependency order (children before
-- parents); job_technicians, report_generation_status, and
-- asset_tag_assignments all cascade automatically from jobs/assets so they
-- don't need their own DELETE line.
--
-- Left untouched on purpose: companies, users (logins), and every
-- catalogue/reference table (asset_type_definitions, defect_codes,
-- asset_tags, inventory_items) — those are configuration, not test data.

-- ── Optional quick sanity check before running the deletes below ──────────
SELECT 'properties' AS table_name, COUNT(*) FROM properties
  WHERE company_id = ANY(ARRAY['c1e763e2-fd37-4b01-a312-93330afd8e52','a3ffef75-0777-452c-9e0e-95574dfda345','8bcd9216-20ee-4d46-bb23-5fe78235222b']::uuid[])
UNION ALL SELECT 'assets', COUNT(*) FROM assets
  WHERE company_id = ANY(ARRAY['c1e763e2-fd37-4b01-a312-93330afd8e52','a3ffef75-0777-452c-9e0e-95574dfda345','8bcd9216-20ee-4d46-bb23-5fe78235222b']::uuid[])
UNION ALL SELECT 'jobs', COUNT(*) FROM jobs
  WHERE company_id = ANY(ARRAY['c1e763e2-fd37-4b01-a312-93330afd8e52','a3ffef75-0777-452c-9e0e-95574dfda345','8bcd9216-20ee-4d46-bb23-5fe78235222b']::uuid[])
UNION ALL SELECT 'defects', COUNT(*) FROM defects
  WHERE company_id = ANY(ARRAY['c1e763e2-fd37-4b01-a312-93330afd8e52','a3ffef75-0777-452c-9e0e-95574dfda345','8bcd9216-20ee-4d46-bb23-5fe78235222b']::uuid[])
UNION ALL SELECT 'inspection_photos', COUNT(*) FROM inspection_photos
  WHERE company_id = ANY(ARRAY['c1e763e2-fd37-4b01-a312-93330afd8e52','a3ffef75-0777-452c-9e0e-95574dfda345','8bcd9216-20ee-4d46-bb23-5fe78235222b']::uuid[]);

-- ── The actual reset — run everything below top to bottom ─────────────────
DELETE FROM quote_items WHERE company_id = ANY(ARRAY['c1e763e2-fd37-4b01-a312-93330afd8e52','a3ffef75-0777-452c-9e0e-95574dfda345','8bcd9216-20ee-4d46-bb23-5fe78235222b']::uuid[]);

DELETE FROM quotes WHERE company_id = ANY(ARRAY['c1e763e2-fd37-4b01-a312-93330afd8e52','a3ffef75-0777-452c-9e0e-95574dfda345','8bcd9216-20ee-4d46-bb23-5fe78235222b']::uuid[]);

DELETE FROM inspection_photos WHERE company_id = ANY(ARRAY['c1e763e2-fd37-4b01-a312-93330afd8e52','a3ffef75-0777-452c-9e0e-95574dfda345','8bcd9216-20ee-4d46-bb23-5fe78235222b']::uuid[]);

DELETE FROM time_logs WHERE company_id = ANY(ARRAY['c1e763e2-fd37-4b01-a312-93330afd8e52','a3ffef75-0777-452c-9e0e-95574dfda345','8bcd9216-20ee-4d46-bb23-5fe78235222b']::uuid[]);

DELETE FROM signatures WHERE company_id = ANY(ARRAY['c1e763e2-fd37-4b01-a312-93330afd8e52','a3ffef75-0777-452c-9e0e-95574dfda345','8bcd9216-20ee-4d46-bb23-5fe78235222b']::uuid[]);

DELETE FROM defects WHERE company_id = ANY(ARRAY['c1e763e2-fd37-4b01-a312-93330afd8e52','a3ffef75-0777-452c-9e0e-95574dfda345','8bcd9216-20ee-4d46-bb23-5fe78235222b']::uuid[]);

DELETE FROM job_assets WHERE company_id = ANY(ARRAY['c1e763e2-fd37-4b01-a312-93330afd8e52','a3ffef75-0777-452c-9e0e-95574dfda345','8bcd9216-20ee-4d46-bb23-5fe78235222b']::uuid[]);

DELETE FROM jobs WHERE company_id = ANY(ARRAY['c1e763e2-fd37-4b01-a312-93330afd8e52','a3ffef75-0777-452c-9e0e-95574dfda345','8bcd9216-20ee-4d46-bb23-5fe78235222b']::uuid[]);

DELETE FROM assets WHERE company_id = ANY(ARRAY['c1e763e2-fd37-4b01-a312-93330afd8e52','a3ffef75-0777-452c-9e0e-95574dfda345','8bcd9216-20ee-4d46-bb23-5fe78235222b']::uuid[]);

DELETE FROM properties WHERE company_id = ANY(ARRAY['c1e763e2-fd37-4b01-a312-93330afd8e52','a3ffef75-0777-452c-9e0e-95574dfda345','8bcd9216-20ee-4d46-bb23-5fe78235222b']::uuid[]);
