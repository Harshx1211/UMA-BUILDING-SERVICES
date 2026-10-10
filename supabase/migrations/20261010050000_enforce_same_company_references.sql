-- ============================================================
-- Migration: a row may only reference parents in its own company
-- ============================================================
-- RLS checks a row's OWN company_id, never the company of the rows it
-- points at. So a signed-in user (via REST) or an admin (via the admin
-- portal, whose service role skips RLS entirely) could create e.g. a job
-- whose property_id is ANOTHER company's property, a defect on another
-- company's asset, or a crew row on another company's job — and the admin
-- portal's service-role reads then embed that foreign row's details
-- straight back (property:properties(...), etc.). It needs the victim's
-- row id (random UUIDs), but it's a real cross-tenant hole, and exactly
-- the shape of the job_technicians chain fixed in 20260922010000.
--
-- Fixed generically, at the database, so it covers the app, the admin
-- portal, the report service and every future feature at once: this finds
-- EVERY single-column foreign key from one company-owned table to another
-- (both sides have a company_id column) and attaches one trigger that
-- rejects a reference whose parent belongs to a different company. Rows
-- with no company yet, and parents with company_id NULL (the shared global
-- catalogue templates), are allowed. On UPDATE it only checks a reference
-- that actually changed, so existing rows are never blocked from edits.
--
-- Rejected writes raise SQLSTATE 42501 — the mobile app's sync engine
-- already treats that as terminal (lib/syncErrors.ts), so a bad write
-- fails loudly instead of retrying forever.
--
-- Run the whole file in the Supabase SQL Editor. The grid lists every
-- reference now enforced, and how many EXISTING rows already point at
-- another company's parent (should be 0 — anything else needs a look:
-- either earlier abuse, or data that was wired up wrongly).
-- ============================================================

CREATE OR REPLACE FUNCTION public.enforce_same_company_references()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  pair text;
  col text;
  parent text;
  val text;
  row_company uuid;
  parent_company uuid;
  parent_found boolean;
BEGIN
  row_company := (to_jsonb(NEW) ->> 'company_id')::uuid;
  IF row_company IS NULL THEN
    RETURN NEW;
  END IF;

  FOREACH pair IN ARRAY TG_ARGV LOOP
    col := split_part(pair, '=', 1);
    parent := split_part(pair, '=', 2);
    val := to_jsonb(NEW) ->> col;
    CONTINUE WHEN val IS NULL;

    IF TG_OP = 'UPDATE'
       AND val IS NOT DISTINCT FROM (to_jsonb(OLD) ->> col)
       AND row_company IS NOT DISTINCT FROM (to_jsonb(OLD) ->> 'company_id')::uuid THEN
      CONTINUE;
    END IF;

    EXECUTE format('SELECT true, company_id FROM public.%I WHERE id = $1', parent)
      INTO parent_found, parent_company
      USING val::uuid;

    -- A missing parent is the foreign key's job to reject, not ours.
    IF parent_found AND parent_company IS NOT NULL AND parent_company <> row_company THEN
      RAISE EXCEPTION '%.% references a % row that belongs to a different company', TG_TABLE_NAME, col, parent
        USING ERRCODE = '42501';
    END IF;
  END LOOP;

  RETURN NEW;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.enforce_same_company_references() FROM PUBLIC, anon, authenticated;

DROP TABLE IF EXISTS _same_company_report;
CREATE TEMP TABLE _same_company_report (child text, fk_column text, parent text, existing_cross_company_rows bigint);

DO $$
DECLARE
  t record;
  fk record;
  args text[];
  n bigint;
BEGIN
  -- Every public table that has a company_id column.
  FOR t IN
    SELECT c.oid AS relid, c.relname
    FROM pg_class c
    JOIN pg_namespace ns ON ns.oid = c.relnamespace
    WHERE ns.nspname = 'public' AND c.relkind = 'r'
      AND EXISTS (SELECT 1 FROM pg_attribute a WHERE a.attrelid = c.oid AND a.attname = 'company_id' AND NOT a.attisdropped)
  LOOP
    args := ARRAY[]::text[];

    -- Its single-column foreign keys to other company-owned public tables
    -- (not the company_id -> companies key itself).
    FOR fk IN
      SELECT a.attname AS col, pc.relname AS parent
      FROM pg_constraint con
      JOIN pg_class pc ON pc.oid = con.confrelid
      JOIN pg_namespace pns ON pns.oid = pc.relnamespace
      JOIN pg_attribute a ON a.attrelid = con.conrelid AND a.attnum = con.conkey[1]
      WHERE con.contype = 'f'
        AND con.conrelid = t.relid
        AND array_length(con.conkey, 1) = 1
        AND pns.nspname = 'public'
        -- the trigger looks the parent up by `id`, so only FKs onto `id`
        AND (SELECT pa.attname FROM pg_attribute pa WHERE pa.attrelid = pc.oid AND pa.attnum = con.confkey[1]) = 'id'
        AND a.attname <> 'company_id'
        AND EXISTS (SELECT 1 FROM pg_attribute pa WHERE pa.attrelid = pc.oid AND pa.attname = 'company_id' AND NOT pa.attisdropped)
    LOOP
      args := args || (fk.col || '=' || fk.parent);

      EXECUTE format(
        'SELECT count(*) FROM public.%I c JOIN public.%I p ON p.id = c.%I
         WHERE c.company_id IS NOT NULL AND p.company_id IS NOT NULL AND p.company_id <> c.company_id',
        t.relname, fk.parent, fk.col)
      INTO n;
      INSERT INTO _same_company_report VALUES (t.relname, fk.col, fk.parent, n);
    END LOOP;

    EXECUTE format('DROP TRIGGER IF EXISTS zz_enforce_same_company_references ON public.%I', t.relname);
    IF array_length(args, 1) > 0 THEN
      -- "zz_" so it runs after any other BEFORE trigger that fills in company_id.
      EXECUTE format(
        'CREATE TRIGGER zz_enforce_same_company_references BEFORE INSERT OR UPDATE ON public.%I
         FOR EACH ROW EXECUTE FUNCTION public.enforce_same_company_references(%s)',
        t.relname,
        (SELECT string_agg(quote_literal(x), ', ') FROM unnest(args) x));
    END IF;
  END LOOP;
END $$;

SELECT * FROM _same_company_report ORDER BY existing_cross_company_rows DESC, child, fk_column;
