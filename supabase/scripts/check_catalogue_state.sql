-- 100% read-only. Compact counts version (the row-by-row version was too
-- large to paste back) — just how many rows each company has, and whether
-- global (company_id IS NULL) defaults exist for each table.

SELECT
  COALESCE(c.name, '(global — company_id IS NULL)') AS company,
  COUNT(*) AS asset_type_definitions_count
FROM asset_type_definitions atd
LEFT JOIN companies c ON c.id = atd.company_id
GROUP BY c.name
ORDER BY company;

SELECT
  COALESCE(c.name, '(global — company_id IS NULL)') AS company,
  COUNT(*) AS defect_codes_count
FROM defect_codes dc
LEFT JOIN companies c ON c.id = dc.company_id
GROUP BY c.name
ORDER BY company;

-- Confirms whether DK12's defect_codes really are an exact duplicate of the
-- global set (same code+description+quote_price for every row) or just
-- similar — matters for deciding whether DK12's copy is safe to drop once
-- the admin API can see the global set directly.
SELECT
  dk.code,
  dk.description = g.description AS description_matches,
  dk.quote_price IS NOT DISTINCT FROM g.quote_price AS price_matches
FROM defect_codes dk
JOIN companies c ON c.id = dk.company_id AND c.name = 'DK12'
JOIN defect_codes g ON g.code = dk.code AND g.company_id IS NULL
WHERE dk.description != g.description OR dk.quote_price IS DISTINCT FROM g.quote_price;
