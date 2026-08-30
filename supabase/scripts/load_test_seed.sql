-- ============================================================================
-- SiteTrack Load-Test Data Generator
--
-- Creates ONE test property, one job assigned to your account, and a spread
-- of assets across a realistic Tower/Floor/Unit layout (+ a common-area slot
-- per floor), using the exact "T-F-U" / "T-F-CR" location string format the
-- app's grouping/sorting/bulk-mark-by-location features already expect.
--
-- HOW TO RUN:
--   Supabase Dashboard → SQL Editor → New query → paste this whole file → Run.
--   Runs as a single transaction (DO block) — either everything is created
--   or nothing is (safe to re-run after fixing an error).
--
-- BEFORE RUNNING:
--   - Change v_email below if the account you're testing under isn't
--     harsh12112021@gmail.com.
--   - Adjust v_total / v_towers / v_floors / v_units if you want a
--     different scale than 250 assets across 3 towers x 8 floors x 6 units.
--
-- AFTER TESTING: see the cleanup block at the very bottom of this file.
-- ============================================================================

DO $$
DECLARE
  v_email        text := 'harsh12112021@gmail.com';
  v_company_id   uuid;
  v_user_id      uuid;
  v_property_id  uuid;
  v_job_id       uuid;

  -- ── Tune the scale of the test site here ──────────────────────────────
  v_total        int := 250;   -- total assets to create
  v_towers       int := 3;
  v_floors       int := 8;
  v_units        int := 6;     -- units per floor (+1 auto-added common-area slot)

  v_asset_types  text[] := ARRAY[
    'BGA, MCP or Manual Call Point',
    'Emergency - Exit Signs',
    'Emergency - Lighting',
    'Fire Detection Devices (MCP, Detector, strobe, Flow Switch)',
    'Fire Door (CA)',
    'Fire Extinguishers - Portable',
    'Fire Hose Reels',
    'Fire Hydrant System',
    'Fire Sprinkler System - Wet Pipe'
  ];
  v_variants     jsonb := '{
    "BGA, MCP or Manual Call Point": ["Break Glass"],
    "Emergency - Exit Signs": ["Blade (Ceiling Mount) - Exit", "Box (Wall Mount) - Exit", "Jumbo (Wall Mount) - Exit", "Quick Fit (Ceiling Mount) - Exit"],
    "Emergency - Lighting": ["2FT - Single Diffused Batten", "4FT - Twin Diffused Batten", "Oyster", "Spitfire (Flush Mount)"],
    "Fire Detection Devices (MCP, Detector, strobe, Flow Switch)": ["Detector - Smoke", "Detector - Heat", "MCP (Indoor)", "Sounder", "Strobe"],
    "Fire Door (CA)": ["Fire Door - Single", "Fire Door - Double Even pair", "Smoke Door - Single"],
    "Fire Extinguishers - Portable": ["DCP AB(E) 2.3KG", "DCP AB(E) 4.5KG", "CO2 3.5KG", "Wet Chemical 7.0Lt"],
    "Fire Hose Reels": ["36m - 19mm - Fire", "50m - 25mm - Fire"],
    "Fire Hydrant System": ["Hydrant landing valves", "Pillar Landing Valve"],
    "Fire Sprinkler System - Wet Pipe": ["Sprinkler head", "Sprinkler Valve"]
  }'::jsonb;

  v_slots_per_tower int;
  v_idx0         int;
  v_tower        int;
  v_floor        int;
  v_unit_slot0   int;
  v_location     text;
  v_type         text;
  v_variant_list jsonb;
  v_variant      text;
  v_i            int;
BEGIN
  -- ── Resolve your account → company_id (multi-tenant scoping) ──────────
  SELECT u.id, u.company_id INTO v_user_id, v_company_id
  FROM public.users u
  JOIN auth.users au ON au.id = u.id
  WHERE au.email = v_email;

  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'No user found for email %. Update v_email at the top of this script.', v_email;
  END IF;

  -- ── 1) Property ─────────────────────────────────────────────────────
  INSERT INTO public.properties (
    company_id, name, address, suburb, state, postcode,
    site_contact_name, site_contact_phone, compliance_status, next_inspection_date
  ) VALUES (
    v_company_id, 'Harbourview Towers (Load Test)', '88 Test Avenue', 'Testville', 'NSW', '2000',
    'Site Manager', '0400 111 222', 'pending', CURRENT_DATE + INTERVAL '60 days'
  )
  RETURNING id INTO v_property_id;

  -- ── 2) Assets — spread across Tower/Floor/Unit + one common-area slot per floor ──
  v_slots_per_tower := v_floors * (v_units + 1);

  FOR v_i IN 1..v_total LOOP
    v_idx0       := v_i - 1;
    v_tower      := 1 + (v_idx0 / v_slots_per_tower) % v_towers;
    v_floor      := 1 + ((v_idx0 % v_slots_per_tower) / (v_units + 1));
    v_unit_slot0 := v_idx0 % (v_units + 1);

    IF v_unit_slot0 = v_units THEN
      v_location := v_tower || '-' || v_floor || '-CR';
    ELSE
      v_location := v_tower || '-' || v_floor || '-' || (v_unit_slot0 + 1);
    END IF;

    v_type         := v_asset_types[1 + floor(random() * array_length(v_asset_types, 1))::int];
    v_variant_list := v_variants -> v_type;
    v_variant      := v_variant_list ->> floor(random() * jsonb_array_length(v_variant_list))::int;

    INSERT INTO public.assets (
      company_id, property_id, asset_type, variant, asset_ref, location_on_site,
      serial_number, barcode_id, install_date, last_service_date, next_service_date, status
    ) VALUES (
      v_company_id, v_property_id, v_type, v_variant,
      lpad(v_i::text, 3, '0'),
      v_location,
      'SN-' || lpad(v_i::text, 5, '0'),
      'BC' || lpad((100000 + v_i)::text, 6, '0'),
      CURRENT_DATE - (floor(random() * 1000)::int),
      CURRENT_DATE - (floor(random() * 180)::int),
      CURRENT_DATE + (floor(random() * 180)::int),
      'active'
    );
  END LOOP;

  -- ── 3) A job assigned to you, ready to open in the app right now ───────
  INSERT INTO public.jobs (
    company_id, property_id, assigned_to, job_type, status, scheduled_date, priority, notes
  ) VALUES (
    v_company_id, v_property_id, v_user_id, 'routine_service_annual', 'scheduled', CURRENT_DATE, 'normal',
    'Load-test job — ' || v_total || ' assets'
  )
  RETURNING id INTO v_job_id;

  RAISE NOTICE 'Done. property_id=%, job_id=%, assets_created=%', v_property_id, v_job_id, v_total;
END $$;

-- ============================================================================
-- CLEANUP — run this after you're done testing to remove everything created
-- above. Uncomment and run as its own query.
-- ============================================================================
-- DO $$
-- DECLARE v_pid uuid;
-- BEGIN
--   SELECT id INTO v_pid FROM public.properties WHERE name = 'Harbourview Towers (Load Test)';
--   DELETE FROM public.job_assets WHERE job_id IN (SELECT id FROM public.jobs WHERE property_id = v_pid);
--   DELETE FROM public.jobs WHERE property_id = v_pid;
--   DELETE FROM public.assets WHERE property_id = v_pid;
--   DELETE FROM public.properties WHERE id = v_pid;
-- END $$;
