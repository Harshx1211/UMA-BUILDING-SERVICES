-- ============================================================
-- UMA BUILDING SERVICES — Catalogue Migration
-- Run this ONCE in the Supabase SQL editor.
-- Creates asset_type_definitions + defect_codes tables and
-- seeds them with all data currently in the TypeScript constants.
-- ============================================================

-- ────────────────────────────────────────────────────────────
-- TABLE: asset_type_definitions
-- Admin-managed catalogue of fire-safety asset types.
-- Mirrors constants/AssetData.ts ASSET_TYPES (source of truth
-- after this migration is applied).
-- ────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.asset_type_definitions (
  id                  UUID        NOT NULL DEFAULT gen_random_uuid(),
  value               TEXT        NOT NULL UNIQUE,
  label               TEXT        NOT NULL,
  full_label          TEXT        NOT NULL,
  icon                TEXT        NOT NULL DEFAULT 'shield-check-outline',
  color               TEXT        NOT NULL DEFAULT '#6B7280',
  inspection_routine  TEXT        NOT NULL DEFAULT 'General Inspection (Annual)',
  variants            TEXT[]      NOT NULL DEFAULT '{}',
  is_active           BOOLEAN     NOT NULL DEFAULT TRUE,
  sort_order          INTEGER     NOT NULL DEFAULT 0,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT asset_type_definitions_pkey PRIMARY KEY (id)
);

ALTER TABLE public.asset_type_definitions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "asset_types_select_auth" ON public.asset_type_definitions;
CREATE POLICY "asset_types_select_auth" ON public.asset_type_definitions
  FOR SELECT USING (auth.role() = 'authenticated');

-- ────────────────────────────────────────────────────────────
-- TABLE: defect_codes
-- Admin-managed library of defect codes and reference prices.
-- Mirrors constants/DefectCodes.ts DEFECT_CODES.
-- ────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.defect_codes (
  id          UUID        NOT NULL DEFAULT gen_random_uuid(),
  code        TEXT        NOT NULL UNIQUE,
  description TEXT        NOT NULL,
  quote_price NUMERIC,
  category    TEXT        NOT NULL DEFAULT 'General',
  is_active   BOOLEAN     NOT NULL DEFAULT TRUE,
  sort_order  INTEGER     NOT NULL DEFAULT 0,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT defect_codes_pkey PRIMARY KEY (id)
);

ALTER TABLE public.defect_codes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "defect_codes_select_auth" ON public.defect_codes;
CREATE POLICY "defect_codes_select_auth" ON public.defect_codes
  FOR SELECT USING (auth.role() = 'authenticated');

-- ────────────────────────────────────────────────────────────
-- UPDATED_AT FUNCTION (create if not exists)
-- ────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ────────────────────────────────────────────────────────────
-- UPDATED_AT TRIGGERS
-- ────────────────────────────────────────────────────────────

DROP TRIGGER IF EXISTS asset_type_definitions_updated_at ON public.asset_type_definitions;
CREATE TRIGGER asset_type_definitions_updated_at
  BEFORE UPDATE ON public.asset_type_definitions
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

DROP TRIGGER IF EXISTS defect_codes_updated_at ON public.defect_codes;
CREATE TRIGGER defect_codes_updated_at
  BEFORE UPDATE ON public.defect_codes
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- ────────────────────────────────────────────────────────────
-- SEED: asset_type_definitions
-- One-time seed from constants/AssetData.ts
-- ────────────────────────────────────────────────────────────

INSERT INTO public.asset_type_definitions (value, label, full_label, icon, color, inspection_routine, variants, sort_order)
VALUES
  (
    'BGA, MCP or Manual Call Point',
    'MCP / Call Point',
    'BGA, MCP or Manual Call Point',
    'alarm-light',
    '#7C3AED',
    'Access Control System (Annual)',
    ARRAY['Break Glass'],
    1
  ),
  (
    'Emergency - Exit Signs',
    'Exit Signs',
    'Emergency - Exit Signs',
    'exit-run',
    '#059669',
    '15 - Emergency escape lighting and exit signs (Annual)',
    ARRAY[
      'Blade (Ceiling Mount) - Exit','Blade (Recessed) - Exit','Box (Wall Mount) - Exit',
      'Exit Sign (Non-Illuminated)','Exit Sign (Thin Blade)','Exit Sign Gear Tray',
      'Exit Sign Weather Proof','Exit Sign Wide Body','Jumbo (Ceiling Mount) - Exit',
      'Jumbo (Wall Mount) - Exit','Pyramid (Ceiling Mount) - Exit',
      'Quick Fit (Ceiling Mount geartray) - Exit','Quick Fit (Ceiling Mount) - Exit',
      'Quick Fit (Wall Mount) - Exit','Weatherproof (Ceiling Mount) - Exit',
      'Weatherproof (Wall Mount) - Exit'
    ],
    2
  ),
  (
    'Emergency - Lighting',
    'Emergency Lighting',
    'Emergency - Lighting',
    'lightning-bolt',
    '#F59E0B',
    '15 - Emergency escape lighting and exit signs (Annual)',
    ARRAY[
      '1FT - Geartray Diffused','2FT - Single Bare Batten','2FT - Single Diffused Batten',
      '2FT - Single Weatherproof Batten','2FT - Single Wireguard Batten','2FT - Twin Bare Batten',
      '2FT - Twin Diffused Batten','2FT - Twin Weatherproof Batten','2FT - Twin Wireguard Batten',
      '4FT - Single Bare Batten','4FT - Single Diffused Batten','4FT - Single Weatherproof Batten',
      '4FT - Single Wireguard Batten','4FT - Twin Bare Batten','4FT - Twin Diffused Batten',
      '4FT - Twin Weatherproof Batten','4FT - Twin Wireguard Batten','Box Ceiling/Wall',
      'Circuit Breaker','Flood Twin','Flood Twin Weatherproof','Main Switch Board',
      'Oyster','Oyster (Weatherproof)','Panel LED T-Bar','Spitfire (Flush Mount)',
      'Spitfire - (Surface Mount)','Square Ceiling/Wall - Light','Test Switch'
    ],
    3
  ),
  (
    'Fire Detection Devices (MCP, Detector, strobe, Flow Switch)',
    'Fire Detection',
    'Fire Detection Devices (MCP, Detector, strobe, Flow Switch)',
    'smoke-detector',
    '#DC2626',
    '06 - Fire Detection (Devices) (Annual)',
    ARRAY[
      'ASE (Alarm Monitoring)','Beam Detector','Bell','Detector - Co2',
      'Detector - Concealed Heat','Detector - Concealed Smoke','Detector - Flame',
      'Detector - Heat','Detector - Smoke','Duct probe','Emergency Door Release',
      'Fail Safe Device','Flow Switch','Horn (Single)','Horn (Twin)',
      'MCP (Indoor)','MCP (Weatherproof)','Pressure Switch','Sounder','Strobe','Vesda'
    ],
    4
  ),
  (
    'Fire Door (CA)',
    'Fire Door',
    'Fire Door (CA)',
    'door',
    '#8B5CF6',
    '12 - Passive Fire (Hinged and Pivoted Doorsets - Common) (Annual)',
    ARRAY[
      'Automatic Door','Exit Door - Double Even pair','Exit Door - Double Uneven pair',
      'Exit Door - Single','Fire Door - Double Even pair','Fire Door - Double Uneven pair',
      'Fire Door - Single','Fire Door - Single Double Action','Fire Safety Door',
      'Smoke & Fire Door - Single','Smoke Door - Double Even Pair','Smoke Door - Double Uneven pair',
      'Smoke Door - Single','Smoke Door - Single Double Action','Smoke Door - Uneven Pair',
      'Solid Core Doorset - Double','Solid Core Doorset - Single'
    ],
    5
  ),
  (
    'Fire Extinguishers - Portable',
    'Fire Extinguisher',
    'Fire Extinguishers - Portable',
    'fire-extinguisher',
    '#EF4444',
    '10 - Portable and Wheeled Fire Extinguishers (Annual)',
    ARRAY[
      'Air/Water 9.0LT','CO2 2.0KG','CO2 3.5KG','CO2 5.0KG',
      'DCP AB(E) 1.0KG','DCP AB(E) 1.5KG','DCP AB(E) 2.0KG','DCP AB(E) 2.3KG',
      'DCP AB(E) 2.5KG','DCP AB(E) 4.5KG','DCP AB(E) 6.0KG','DCP AB(E) 9.0KG',
      'DCP B(E) 2.3KG','DCP B(E) 4.5KG','DCP B(E) 9.0KG','Foam AFFF 9.0LT',
      'Foam F3 (Fluorine Free) 9.0LT','Wet Chemical 2.0Lt','Wet Chemical 7.0Lt'
    ],
    6
  ),
  (
    'Fire Hose Reels',
    'Hose Reels',
    'Fire Hose Reels',
    'pipe',
    '#0891B2',
    '09 - Fire Hose Reels (Annual)',
    ARRAY[
      '100m - 19mm - Fire','100m - 25mm - Fire','36m - 19mm - Green Wash Down',
      '36m - 19mm - Fire','36m - 25mm - Fire','50m - 19mm - Fire',
      '50m - 25mm - Fire','Fire Hose Reel Flow Test'
    ],
    7
  ),
  (
    'Fire Hydrant System',
    'Fire Hydrant',
    'Fire Hydrant System',
    'pipe-valve',
    '#B91C1C',
    '04 - Fire Hydrant Systems (Annual - Valves)',
    ARRAY[
      '20Lt Foam pail','Booster - Hydrant','Booster - Sprinkler',
      'Hydrant System Flow test','Hydrant landing valves',
      'In-ground Spring Hydrant','Pillar Landing Valve','Sprinkler head'
    ],
    8
  ),
  (
    'Fire Sprinkler System - Wet Pipe',
    'Sprinkler System',
    'Fire Sprinkler System - Wet Pipe',
    'water',
    '#2563EB',
    '02 - Automatic Fire Sprinkler Systems (Annual Flow)',
    ARRAY[
      'Foam Water Systems','General System','Sprinkler Alarm Valve',
      'Sprinkler System Flow Test','Sprinkler Valve','Sprinkler head',
      'Wall Wetting System','Window Wetter System','sprinkler (heads) cabinet'
    ],
    9
  )
ON CONFLICT (value) DO NOTHING;

-- ────────────────────────────────────────────────────────────
-- SEED: defect_codes
-- One-time seed from constants/DefectCodes.ts
-- ────────────────────────────────────────────────────────────

INSERT INTO public.defect_codes (code, description, quote_price, category, sort_order)
VALUES
  ('anf','Alarm not indicated on FIP — require investigation $85/hr',NULL,'Alarm',1),
  ('bb','Broken Button exposing Circuit Board',NULL,'Hardware',2),
  ('bed','Bottom Edge Delamination',250,'Delamination',3),
  ('bg','Bottom Gap (10–15mm) — Confirm the gap size; if >10mm then install fire rated seal at additional $135.00+GST',NULL,'Gap',4),
  ('bgx','Bottom Gap (15–25mm)',250,'Gap',5),
  ('bosa','Battery Only Smoke Alarm (Require to be 240V Smoke Alarm)',NULL,'Alarm',6),
  ('brk','BRK 10yrs+ Expired',NULL,'Alarm',7),
  ('bsc','Bottom Side Contact',75,'Hardware',8),
  ('bss','Bottom Smoke Seal requires adjusting; if adjustment fails then replace Seal $135.00',25,'Seal',9),
  ('bsx','Bottom Smoke Seal External requires adjusting; if adjustment fails then replace Seal $125.00',25,'Seal',10),
  ('cdla','Cut out in Fire Door for dead latch installation & non-compliant wrong type of deadlatch door strike installed',295,'Lock',11),
  ('Covid','No access due to sickness or self-isolating or covid restrictions. Require Re-inspection with no extra cost.',NULL,'Access',12),
  ('cs','Constant Sounding Fault',NULL,'Alarm',13),
  ('da','Closer detached arm — service hardware',25,'Hardware',14),
  ('db','Non-Compliant Dead-Bolt (Remove & replace with SS Plating & Fire Sealant)',95,'Lock',15),
  ('dc','Damaged Closer',165,'Hardware',16),
  ('dde','Damage on the door edge (SS Plating & Fire Sealant)',250,'Delamination',17),
  ('ddex','Large Damage on the door edge (SS Custom Plating & Fire Sealant)',350,'Delamination',18),
  ('df','Damaged/tampered physically, failed',NULL,'General',19),
  ('dh','Damaged Hinge — attempt a minor repair (if welding required $400.00+GST & fire detection Isolations $250.00+GST)',75,'Hinge',20),
  ('dl','Non-Compliant Dead-Lock (Remove & replace with SS Plating & Fire Sealant)',90,'Lock',21),
  ('dla','Non-Compliant Dead-Latch (Remove & replace with SS Plating & Fire Sealant)',90,'Lock',22),
  ('ds','Door Strike in Frame damaged/modified (Welding Required & may require Fire Detection Isolations $250.00+GST)',400,'Hardware',23),
  ('el','Non-Compliant Electronic Lock (Remove & replace with Compliant Dead-Latch with a scar plate, fire sealant and or SS filler plate)',325,'Lock',24),
  ('ep','Escutcheon ring(s) & base(s) — missing/corroded — require replacing',195,'Hardware',25),
  ('ewls','EWIS speaker(s) low sound — require investigation $85.00+GST/hr & may require replacing $150.00+GST ea',NULL,'Alarm',26),
  ('ewns','EWIS speaker(s) no sound — require investigation $85.00+GST/hr & may require replacing $150.00+GST ea',NULL,'Alarm',27),
  ('exp','Exceed 10yr service Life',NULL,'Compliance',28),
  ('f','Fail',NULL,'General',29),
  ('fc','Faulty Closer Leaking Hydraulic Oil',165,'Hardware',30),
  ('fnf','Fault not indicated on FIP — require investigation $85/hr',NULL,'Alarm',31),
  ('fs','Non fire rated foam seal — require to remove',50,'Seal',32),
  ('h','Hole(s) in Door or Frame, Require Fire Rated Putty/Sealant.',25,'General',33),
  ('hd','The closer is warped out and too weak to close the door. It requires to be replaced with the heavy duty closer.',175,'Hardware',34),
  ('hed','Hinge Edge Delamination',250,'Delamination',35),
  ('hg','Hinge Gap',75,'Gap',36),
  ('hg5','Hinge Gap half Length',35,'Gap',37),
  ('hgt','Hinge Gap exceeding 3mm due to the door edge planed with a taper',NULL,'Gap',38),
  ('hgx','Hinge Gap 8mm+ (Recheck gap size)',75,'Gap',39),
  ('hss','Hinge Inside Smoke Seal damaged/Missing (Required to be Replaced)',45,'Seal',40),
  ('hsx','Hinge External Smoke Seal damaged/Missing (Required to be Replaced)',55,'Seal',41),
  ('ip','Suspected non-approved partition(s) or subdivision(s) found',NULL,'Compliance',42),
  ('led','Lock Edge Delamination',215,'Delamination',43),
  ('lg','Lock side Gap',75,'Gap',44),
  ('lg5','Lock side Gap half Length',35,'Gap',45),
  ('lgt','Lock Side Gap exceeding 3mm due to the door edge planed with a taper',NULL,'Gap',46),
  ('lgx','Lock side Gap 8mm+',75,'Gap',47),
  ('lp','Latch Plate (Damaged/Missing)',20,'Hardware',48),
  ('ls','Low Sound Fault',NULL,'Alarm',49),
  ('lsc','Lock Side Contact, require to rehang door',75,'Hardware',50),
  ('lss','Lock side Inside Smoke Seal damaged/Missing (Required to be Replaced)',45,'Seal',51),
  ('lsx','Lock side External Smoke Seal damaged/Missing (Required to be Replaced)',55,'Seal',52),
  ('mc','Missing Closer',165,'Hardware',53),
  ('mdh','Magnetic Door Holder reinspect / require removal',25,'Hardware',54),
  ('mep','Missing Escutcheon Plate',35,'Hardware',55),
  ('mewis','Missing EWIS Speaker $150.00+GST & ($85.00+GST per hour for Installation and testing EWIS Speaker)',150,'Alarm',56),
  ('mh','Missing Hinge (Weld New Hinge)',400,'Hinge',57),
  ('mhr','Hinge requires minor repair',75,'Hinge',58),
  ('msa','Missing Smoke Alarm $90.00+GST (add $85.00+GST/hr for electrician to hardwire)',NULL,'Alarm',59),
  ('n24','Faulty (No 240V Fault indicated)',NULL,'Alarm',60),
  ('na','No Access',NULL,'Access',61),
  ('ncbss','Non compliant perimeter seal, require removal / reinspection',25,'Seal',62),
  ('ncr','Non-Compliant Repair around lock (Require SS Plating & Fire Sealant)',250,'Lock',63),
  ('ncrx','Non-Compliant Repair around lock (Require Large Custom SS Plating & Fire Sealant)',60,'Lock',64),
  ('ndks','Non-compliant / Damaged Fire Door Knob Set',150,'Hardware',65),
  ('ndla','Non-Compliant Dead-Latch (Remove & replace with fire rated plate/plug & fire sealant)',90,'Lock',66),
  ('ndls','Non-compliant / Damaged Fire Door Lever Set',165,'Hardware',67),
  ('ndv','Non complaint door viewer or incorrectly installed, need to be replaced',50,'Hardware',68),
  ('nfbs','Non fire rated bottom seal has been installed — require to remove',35,'Seal',69),
  ('nfd','Fire Door Inconsistencies — Recheck Required',25,'Compliance',70),
  ('nfss','A non-fire rated smoke seal has been installed — require to remove',35,'Seal',71),
  ('nha','Need to Replace Heat Alarm',155,'Alarm',72),
  ('ni','No interconnection between the smoke alarms, require electrician to investigate',NULL,'Alarm',73),
  ('none','Not applicable — no need to inspect.',NULL,'Compliance',74),
  ('ns','No Sound Fault',NULL,'Alarm',75),
  ('nsa','Need to replace Smoke Alarm 240v',90,'Alarm',76),
  ('nsa9','Need to replace 9V Smoke Alarm',60,'Alarm',77),
  ('ntd','No compliance tag on the door',75,'Compliance',78),
  ('ntf','No compliance tag on the frame',75,'Compliance',79),
  ('obs','Obstructions in Common Area adj to entrance door',NULL,'Access',80),
  ('p','Passed',NULL,'General',81),
  ('pel','Non-Compliant Electronic Lock installed as primary lock',350,'Lock',82),
  ('ptd','The compliance tag is painted on door; requires to be paint stripped / reinspected',35,'Compliance',83),
  ('ptf','The compliance tag is painted on frame; requires to be paint stripped / reinspected',35,'Compliance',84),
  ('rb','Replaced Battery',10,'Alarm',85),
  ('rba','Replaced Battery (for annual compliance)',10,'Alarm',86),
  ('rc','Repair cables and/or terminals',35,'Alarm',87),
  ('rd','Rehang Door',75,'Hardware',88),
  ('rh','Remove Door, Rebate Hinge, Rehang',75,'Hinge',89),
  ('rha','Replaced Heat Alarm',155,'Alarm',90),
  ('ri','Require electrical investigation $85.00+GST p/hr',NULL,'Alarm',91),
  ('ros','Sprinkler head — removed minor obstruction',NULL,'General',92),
  ('rr','Re-inspection Required',NULL,'Compliance',93),
  ('rsa','Replaced Smoke Alarm',90,'Alarm',94),
  ('rsa9','Replaced 9V Smoke Alarm',60,'Alarm',95),
  ('rsb','Hanging off Ceiling (Reattached Smoke Alarm Base to Ceiling)',25,'Alarm',96),
  ('rtc','Require to Retension & Adjust Faulty Closer',25,'Hardware',97),
  ('rw','Re-wound hose during the inspection',25,'General',98),
  ('s12','Hardwired to Fire Panel',NULL,'Alarm',99),
  ('s24','240v Hardwired with 9V Battery back up',NULL,'Alarm',100),
  ('s24n','240v Hardwired with nonreplaceable battery backup',NULL,'Alarm',101),
  ('s9','Nonhardwired 9V Battery only',NULL,'Alarm',102),
  ('s9n','Nonhardwired nonreplaceable battery backup',NULL,'Alarm',103),
  ('sd','Security Device (remove & fill holes with Fire Sealant)',25,'Hardware',104),
  ('seq','Sequencer requires adjusting; if adjusting fails replace sequencer $195.00+GST',25,'Hardware',105),
  ('sh','Hardware requires servicing',25,'Hardware',106),
  ('sor','Sprinkler Obstruction Removed',NULL,'General',107),
  ('ted','Top Edge Delamination',215,'Delamination',108),
  ('tg','Top Gap',35,'Gap',109),
  ('tgt','Top Gap exceeding 3mm due to the door edge planed with a taper',NULL,'Gap',110),
  ('tgx','Top Gap 8mm+',75,'Gap',111),
  ('tl','Top Lock not latching correctly',NULL,'Lock',112),
  ('tsc','Top Side Contact',25,'Hardware',113),
  ('tss','Top Inside Smoke Seal damaged/Missing (Required to be Replaced)',25,'Seal',114),
  ('tsx','Top External Smoke Seal damaged/Missing (Required to be Replaced)',40,'Seal',115),
  ('wa','Didn''t go into emergency mode during the test; require electrician to investigate $85.00+GSTp/h',NULL,'Alarm',116),
  ('warp','The Fire Door is warped out of shape and is not latching correctly',150,'Hardware',117),
  ('wl1','1 window lock — missing/damaged',35,'Window',118),
  ('wl2','2 window locks — missing/damaged',65,'Window',119),
  ('wl3','3 window locks — missing/damaged',90,'Window',120),
  ('wl4','4 window locks — missing/damaged',115,'Window',121),
  ('wl5','5 window locks — missing/damaged',140,'Window',122),
  ('wr','Welding Required & may require Fire Detection Isolations $250.00+GST',400,'Hardware',123)
ON CONFLICT (code) DO NOTHING;

-- ────────────────────────────────────────────────────────────
-- VERIFY
-- ────────────────────────────────────────────────────────────
SELECT 'asset_type_definitions' AS tbl, COUNT(*) FROM public.asset_type_definitions
UNION ALL
SELECT 'defect_codes', COUNT(*) FROM public.defect_codes
UNION ALL
SELECT 'inventory_items', COUNT(*) FROM public.inventory_items;

-- ────────────────────────────────────────────────────────────
-- SEED: inventory_items
-- Common fire-safety service/repair catalogue items.
-- Run this block if the above shows 0 inventory_items.
-- ────────────────────────────────────────────────────────────

INSERT INTO public.inventory_items (id, name, description, price)
VALUES
  (gen_random_uuid(),'Smoke Alarm Replacement (240V)','Supply & install hardwired 240V smoke alarm',90.00),
  (gen_random_uuid(),'Smoke Alarm Replacement (9V)','Supply & install 9V battery smoke alarm',60.00),
  (gen_random_uuid(),'Heat Alarm Replacement','Supply & install heat alarm unit',155.00),
  (gen_random_uuid(),'Battery Replacement','Replace alarm battery (compliance)',10.00),
  (gen_random_uuid(),'Fire Door Closer Replacement','Supply & install hydraulic door closer',165.00),
  (gen_random_uuid(),'Door Closer Service','Retension & adjust faulty door closer',25.00),
  (gen_random_uuid(),'Smoke Seal Replacement','Supply & install smoke seal (per side)',45.00),
  (gen_random_uuid(),'Hinge Repair (Minor)','Minor hinge repair / re-tighten',75.00),
  (gen_random_uuid(),'Door Rehang','Remove and rehang misaligned fire door',75.00),
  (gen_random_uuid(),'Window Lock Replacement','Supply & install window lock (per lock)',35.00),
  (gen_random_uuid(),'Compliance Tag (Door)','Supply & install new fire door compliance tag',75.00),
  (gen_random_uuid(),'Fire Sealant / Putty Repair','Fire rated sealant for holes in door or frame',25.00),
  (gen_random_uuid(),'SS Plating (Lock Area)','Stainless steel plating around non-compliant lock',250.00),
  (gen_random_uuid(),'DCP Extinguisher Service (4.5KG)','6-yr service — DCP AB(E) 4.5KG',145.00),
  (gen_random_uuid(),'CO2 Extinguisher Service (2.0KG)','6-yr service — CO2 2.0KG',185.00),
  (gen_random_uuid(),'Fire Hose Reel Service','Annual service of fire hose reel',95.00),
  (gen_random_uuid(),'Emergency Light Test & Replace','Test and replace emergency luminaire',85.00),
  (gen_random_uuid(),'Exit Sign Replacement','Supply & install replacement exit sign',120.00),
  (gen_random_uuid(),'Electrical Investigation (per hr)','Electrician investigation — $85/hr',85.00),
  (gen_random_uuid(),'Re-inspection Fee','Return visit for reinspection after defect rectification',75.00)
ON CONFLICT DO NOTHING;
