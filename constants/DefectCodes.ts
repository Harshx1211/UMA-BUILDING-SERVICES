/**
 * DefectCodes.ts — Uptick Australia Defect Code Library
 *
 * Complete codebook extracted from the Uptick Australia reference spreadsheet.
 * Codes cover fire doors, smoke seals, hardware, alarms, smoke detectors, windows, and general issues.
 *
 * quote_price: Reference rate in AUD (ex-GST). These are Uptick industry reference rates.
 *   — Can be overridden per-job on the quote screen.
 *   — Can be updated here or via Supabase config as pricing changes.
 * category: Used to group codes in the picker UI.
 */

export interface DefectCode {
  /** Short code used as identifier (e.g. "bg", "hg", "lsc") */
  code: string;
  /** Full description of the defect as shown in report */
  description: string;
  /** Reference quote price in AUD ex-GST (undefined = investigation required / no fixed price) */
  quote_price?: number;
  /** Display category for grouping in the picker */
  category: DefectCategory;
}

export type DefectCategory =
  | 'Gap'
  | 'Seal'
  | 'Hardware'
  | 'Delamination'
  | 'Alarm'
  | 'Lock'
  | 'Hinge'
  | 'Access'
  | 'Window'
  | 'Compliance'
  | 'General';

// ─── Full Defect Code Library ─────────────────────────────────────────────────

export const DEFECT_CODES: DefectCode[] = [

  // ── A ──────────────────────────────────────────────────────────────────────
  {
    code: 'anf',
    description: 'Alarm not indicated on FIP — require investigation $85/hr',
    category: 'Alarm',
  },

  // ── B ──────────────────────────────────────────────────────────────────────
  {
    code: 'bb',
    description: 'Broken Button exposing Circuit Board',
    category: 'Hardware',
  },
  {
    code: 'bed',
    description: 'Bottom Edge Delamination',
    quote_price: 250,
    category: 'Delamination',
  },
  {
    code: 'bg',
    description: 'Bottom Gap (10–15mm) — Confirm the gap size; if >10mm then install fire rated seal at additional $135.00+GST',
    category: 'Gap',
  },
  {
    code: 'bgx',
    description: 'Bottom Gap (15–25mm)',
    quote_price: 250,
    category: 'Gap',
  },
  {
    code: 'bosa',
    description: 'Battery Only Smoke Alarm (Require to be 240V Smoke Alarm)',
    category: 'Alarm',
  },
  {
    code: 'brk',
    description: 'BRK 10yrs+ Expired',
    category: 'Alarm',
  },
  {
    code: 'bsc',
    description: 'Bottom Side Contact',
    quote_price: 75,
    category: 'Hardware',
  },
  {
    code: 'bss',
    description: 'Bottom Smoke Seal requires adjusting; if adjustment fails then replace Seal $135.00',
    quote_price: 25,
    category: 'Seal',
  },
  {
    code: 'bsx',
    description: 'Bottom Smoke Seal External requires adjusting; if adjustment fails then replace Seal $125.00',
    quote_price: 25,
    category: 'Seal',
  },

  // ── C ──────────────────────────────────────────────────────────────────────
  {
    code: 'cdla',
    description: 'Cut out in Fire Door for dead latch installation & non-compliant wrong type of deadlatch door strike installed; requires fire rated repair SS Plating and fire Sealant, new door strike & reinstall deadlatch reinstall. Recommend this to be charged back to the owner.',
    quote_price: 295,
    category: 'Lock',
  },
  {
    code: 'Covid',
    description: 'No access due to sickness or self-isolating or covid restrictions. Require Re-inspection with no extra cost.',
    category: 'Access',
  },
  {
    code: 'cs',
    description: 'Constant Sounding Fault',
    category: 'Alarm',
  },

  // ── D ──────────────────────────────────────────────────────────────────────
  {
    code: 'da',
    description: 'Closer detached arm — service hardware',
    quote_price: 25,
    category: 'Hardware',
  },
  {
    code: 'db',
    description: 'Non-Compliant Dead-Bolt (Remove & replace with SS Plating & Fire Sealant)',
    quote_price: 95,
    category: 'Lock',
  },
  {
    code: 'dc',
    description: 'Damaged Closer',
    quote_price: 165,
    category: 'Hardware',
  },
  {
    code: 'dde',
    description: 'Damage on the door edge (SS Plating & Fire Sealant)',
    quote_price: 250,
    category: 'Delamination',
  },
  {
    code: 'ddex',
    description: 'Large Damage on the door edge (SS Custom Plating & Fire Sealant)',
    quote_price: 350,
    category: 'Delamination',
  },
  {
    code: 'df',
    description: 'Damaged/tampered physically, failed',
    category: 'General',
  },
  {
    code: 'dh',
    description: 'Damaged Hinge — attempt a minor repair (if welding required $400.00+GST & fire detection Isolations $250.00+GST)',
    quote_price: 75,
    category: 'Hinge',
  },
  {
    code: 'dl',
    description: 'Non-Compliant Dead-Lock (Remove & replace with SS Plating & Fire Sealant)',
    quote_price: 90,
    category: 'Lock',
  },
  {
    code: 'dla',
    description: 'Non-Compliant Dead-Latch (Remove & replace with SS Plating & Fire Sealant)',
    quote_price: 90,
    category: 'Lock',
  },
  {
    code: 'ds',
    description: 'Door Strike in Frame damaged/modified (Welding Required & may require Fire Detection Isolations $250.00+GST)',
    quote_price: 400,
    category: 'Hardware',
  },

  // ── E ──────────────────────────────────────────────────────────────────────
  {
    code: 'el',
    description: 'Non-Compliant Electronic Lock (Remove & replace with Compliant Dead-Latch with a scar plate, fire sealant and or SS filler plate)',
    quote_price: 325,
    category: 'Lock',
  },
  {
    code: 'ep',
    description: 'Escutcheon ring(s) & base(s) — missing/corroded — require replacing',
    quote_price: 195,
    category: 'Hardware',
  },
  {
    code: 'ewls',
    description: 'EWIS speaker(s) low sound — require investigation $85.00+GST/hr & may require replacing $150.00+GST ea',
    category: 'Alarm',
  },
  {
    code: 'ewns',
    description: 'EWIS speaker(s) no sound — require investigation $85.00+GST/hr & may require replacing $150.00+GST ea',
    category: 'Alarm',
  },
  {
    code: 'exp',
    description: 'Exceed 10yr service Life',
    category: 'Compliance',
  },

  // ── F ──────────────────────────────────────────────────────────────────────
  {
    code: 'f',
    description: 'Fail',
    category: 'General',
  },
  {
    code: 'fc',
    description: 'Faulty Closer Leaking Hydraulic Oil',
    quote_price: 165,
    category: 'Hardware',
  },
  {
    code: 'fnf',
    description: 'Fault not indicated on FIP — require investigation $85/hr',
    category: 'Alarm',
  },
  {
    code: 'fs',
    description: 'Non fire rated foam seal — require to remove',
    quote_price: 50,
    category: 'Seal',
  },

  // ── H ──────────────────────────────────────────────────────────────────────
  {
    code: 'h',
    description: 'Hole(s) in Door or Frame, Require Fire Rated Putty/Sealant. Recommend this to be charged back to the owner.',
    quote_price: 25,
    category: 'General',
  },
  {
    code: 'hd',
    description: 'The closer is warped out and too weak to close the door. It requires to be replaced with the heavy duty closer.',
    quote_price: 175,
    category: 'Hardware',
  },
  {
    code: 'hed',
    description: 'Hinge Edge Delamination',
    quote_price: 250,
    category: 'Delamination',
  },
  {
    code: 'hg',
    description: 'Hinge Gap',
    quote_price: 75,
    category: 'Gap',
  },
  {
    code: 'hg5',
    description: 'Hinge Gap half Length',
    quote_price: 35,
    category: 'Gap',
  },
  {
    code: 'hgt',
    description: 'Hinge Gap exceeding 3mm due to the door edge planed with a taper, Need to refer this back to the developer to fix',
    category: 'Gap',
  },
  {
    code: 'hgx',
    description: 'Hinge Gap 8mm+ (Recheck gap size, look for alternative cost effective solution, if not able to repair will replace Door $900.00+GST)',
    quote_price: 75,
    category: 'Gap',
  },
  {
    code: 'hss',
    description: 'Hinge Inside Smoke Seal damaged/Missing (Required to be Replaced)',
    quote_price: 45,
    category: 'Seal',
  },
  {
    code: 'hsx',
    description: 'Hinge External Smoke Seal damaged/Missing (Required to be Replaced)',
    quote_price: 55,
    category: 'Seal',
  },

  // ── I ──────────────────────────────────────────────────────────────────────
  {
    code: 'ip',
    description: 'Suspected non-approved partition(s) or subdivision(s) found; request owner to remove, once removed need to reinspect @$150+GST',
    category: 'Compliance',
  },

  // ── L ──────────────────────────────────────────────────────────────────────
  {
    code: 'led',
    description: 'Lock Edge Delamination',
    quote_price: 215,
    category: 'Delamination',
  },
  {
    code: 'lg',
    description: 'Lock side Gap',
    quote_price: 75,
    category: 'Gap',
  },
  {
    code: 'lg5',
    description: 'Lock side Gap half Length',
    quote_price: 35,
    category: 'Gap',
  },
  {
    code: 'lgt',
    description: 'Lock Side Gap exceeding 3mm due to the door edge planed with a taper, Need to refer this back to the developer to fix',
    category: 'Gap',
  },
  {
    code: 'lgx',
    description: 'Lock side Gap 8mm+ (Recheck gap size, look for alternative cost effective solution, if not able to repair will replace Door $900.00+GST)',
    quote_price: 75,
    category: 'Gap',
  },
  {
    code: 'lp',
    description: 'Latch Plate (Damaged/Missing)',
    quote_price: 20,
    category: 'Hardware',
  },
  {
    code: 'ls',
    description: 'Low Sound Fault',
    category: 'Alarm',
  },
  {
    code: 'lsc',
    description: 'Lock Side Contact, require to rehang door',
    quote_price: 75,
    category: 'Hardware',
  },
  {
    code: 'lss',
    description: 'Lock side Inside Smoke Seal damaged/Missing (Required to be Replaced)',
    quote_price: 45,
    category: 'Seal',
  },
  {
    code: 'lsx',
    description: 'Lock side External Smoke Seal damaged/Missing (Required to be Replaced)',
    quote_price: 55,
    category: 'Seal',
  },

  // ── M ──────────────────────────────────────────────────────────────────────
  {
    code: 'mc',
    description: 'Missing Closer',
    quote_price: 165,
    category: 'Hardware',
  },
  {
    code: 'mdh',
    description: 'Magnetic Door Holder reinspect / require removal',
    quote_price: 25,
    category: 'Hardware',
  },
  {
    code: 'mep',
    description: 'Missing Escutcheon Plate',
    quote_price: 35,
    category: 'Hardware',
  },
  {
    code: 'mewis',
    description: 'Missing EWIS Speaker $150.00+GST & ($85.00+GST per hour for Installation and testing EWIS Speaker); recheck # bedrooms, check if this is a building construction defect',
    quote_price: 150,
    category: 'Alarm',
  },
  {
    code: 'mh',
    description: 'Missing Hinge (Weld New Hinge)',
    quote_price: 400,
    category: 'Hinge',
  },
  {
    code: 'mhr',
    description: 'Hinge requires minor repair (if not possible, welding maybe required $400.00+GST & may require Fire Detection Isolations $250.00+GST)',
    quote_price: 75,
    category: 'Hinge',
  },
  {
    code: 'msa',
    description: 'Missing Smoke Alarm $90.00+GST (add $85.00+GST/hr for electrician to hardwire)',
    category: 'Alarm',
  },

  // ── N ──────────────────────────────────────────────────────────────────────
  {
    code: 'n24',
    description: 'Faulty (No 240V Fault indicated)',
    category: 'Alarm',
  },
  {
    code: 'na',
    description: 'No Access',
    category: 'Access',
  },
  {
    code: 'ncbss',
    description: 'Non compliant perimeter seal, require removal / reinspection, recommend this be charged back to the owner.',
    quote_price: 25,
    category: 'Seal',
  },
  {
    code: 'ncr',
    description: 'Non-Compliant Repair around lock (Require SS Plating & Fire Sealant)',
    quote_price: 250,
    category: 'Lock',
  },
  {
    code: 'ncrx',
    description: 'Non-Compliant Repair around lock (Require Large Custom SS Plating & Fire Sealant)',
    quote_price: 60,
    category: 'Lock',
  },
  {
    code: 'ndks',
    description: 'Non-compliant / Damaged Fire Door Knob Set',
    quote_price: 150,
    category: 'Hardware',
  },
  {
    code: 'ndla',
    description: 'Non-Compliant Dead-Latch (Remove & replace with fire rated plate/plug & fire sealant)',
    quote_price: 90,
    category: 'Lock',
  },
  {
    code: 'ndls',
    description: 'Non-compliant / Damaged Fire Door Lever Set',
    quote_price: 165,
    category: 'Hardware',
  },
  {
    code: 'ndv',
    description: 'Non complaint door viewer or incorrectly installed, need to be replaced',
    quote_price: 50,
    category: 'Hardware',
  },
  {
    code: 'nfbs',
    description: 'Non fire rated bottom seal has been installed — require to remove and fill any holes with fire sealant or reinspect to confirm removal. Recommend cost to be charge back to Unit Owner.',
    quote_price: 35,
    category: 'Seal',
  },
  {
    code: 'nfd',
    description: 'Fire Door Inconsistencies — Recheck Required; if Not a Fire Door, will require to replace $900.00+GST',
    quote_price: 25,
    category: 'Compliance',
  },
  {
    code: 'nfss',
    description: 'A non-fire rated smoke seal has been installed — require to remove and fill any holes with fire sealant or reinspect to confirm removal. Recommend cost to be charge back to Unit Owner.',
    quote_price: 35,
    category: 'Seal',
  },
  {
    code: 'nha',
    description: 'Need to Replace Heat Alarm',
    quote_price: 155,
    category: 'Alarm',
  },
  {
    code: 'ni',
    description: 'No interconnection between the smoke alarms, require electrician to investigate & or repair — $85.00+GST p/hr. After the 1st hr of investigation, if a new interconnection cable is determined to be required and the cost of the wiring work exceeds $400.00+GST, then we will install 2 wireless interconnected Smoke Alarms $380.00+GST.',
    category: 'Alarm',
  },
  {
    code: 'none',
    description: 'Not applicable — no need to inspect.',
    category: 'Compliance',
  },
  {
    code: 'ns',
    description: 'No Sound Fault',
    category: 'Alarm',
  },
  {
    code: 'nsa',
    description: 'Need to replace Smoke Alarm 240v',
    quote_price: 90,
    category: 'Alarm',
  },
  {
    code: 'nsa9',
    description: 'Need to replace 9V Smoke Alarm',
    quote_price: 60,
    category: 'Alarm',
  },
  {
    code: 'ntd',
    description: 'No compliance tag on the door; recheck and confirm fire door, if ok attach a new tag. Recommend this to be charged back to the owner.',
    quote_price: 75,
    category: 'Compliance',
  },
  {
    code: 'ntf',
    description: 'No compliance tag on the frame; recheck and confirm fire door, if ok attach a new tag. Recommend this to be charged back to the owner.',
    quote_price: 75,
    category: 'Compliance',
  },

  // ── O ──────────────────────────────────────────────────────────────────────
  {
    code: 'obs',
    description: 'Obstructions in Common Area adj to entrance door (lots of bikes in lobby) — Must remove, require re-inspection.',
    category: 'Access',
  },

  // ── P ──────────────────────────────────────────────────────────────────────
  {
    code: 'p',
    description: 'Passed',
    category: 'General',
  },
  {
    code: 'pel',
    description: 'Non-Compliant Electronic Lock installed as primary lock (Remove & replace with Fire Rated Leverset with a scar plate, fire sealant and or SS plating)',
    quote_price: 350,
    category: 'Lock',
  },
  {
    code: 'ptd',
    description: 'The compliance tag is painted on door; requires to be paint stripped / reinspected',
    quote_price: 35,
    category: 'Compliance',
  },
  {
    code: 'ptf',
    description: 'The compliance tag is painted on frame; requires to be paint stripped / reinspected',
    quote_price: 35,
    category: 'Compliance',
  },

  // ── R ──────────────────────────────────────────────────────────────────────
  {
    code: 'rb',
    description: 'Replaced Battery',
    quote_price: 10,
    category: 'Alarm',
  },
  {
    code: 'rba',
    description: 'Replaced Battery (for annual compliance)',
    quote_price: 10,
    category: 'Alarm',
  },
  {
    code: 'rc',
    description: 'Repair cables and/or terminals',
    quote_price: 35,
    category: 'Alarm',
  },
  {
    code: 'rd',
    description: 'Rehang Door',
    quote_price: 75,
    category: 'Hardware',
  },
  {
    code: 'rh',
    description: 'Remove Door, Rebate Hinge, Rehang',
    quote_price: 75,
    category: 'Hinge',
  },
  {
    code: 'rha',
    description: 'Replaced Heat Alarm',
    quote_price: 155,
    category: 'Alarm',
  },
  {
    code: 'ri',
    description: 'Require electrical investigation $85.00+GST p/hr',
    category: 'Alarm',
  },
  {
    code: 'ros',
    description: 'Sprinkler head — removed minor obstruction',
    category: 'General',
  },
  {
    code: 'rr',
    description: 'Re-inspection Required',
    category: 'Compliance',
  },
  {
    code: 'rsa',
    description: 'Replaced Smoke Alarm',
    quote_price: 90,
    category: 'Alarm',
  },
  {
    code: 'rsa9',
    description: 'Replaced 9V Smoke Alarm',
    quote_price: 60,
    category: 'Alarm',
  },
  {
    code: 'rsb',
    description: 'Hanging off Ceiling (Reattached Smoke Alarm Base to Ceiling)',
    quote_price: 25,
    category: 'Alarm',
  },
  {
    code: 'rtc',
    description: 'Require to Retension & Adjust Faulty Closer (if not adjustable, then replace closer $165.00+GST)',
    quote_price: 25,
    category: 'Hardware',
  },
  {
    code: 'rw',
    description: 'Re-wound hose during the inspection',
    quote_price: 25,
    category: 'General',
  },

  // ── S ──────────────────────────────────────────────────────────────────────
  {
    code: 's12',
    description: 'Hardwired to Fire Panel',
    category: 'Alarm',
  },
  {
    code: 's24',
    description: '240v Hardwired with 9V Battery back up',
    category: 'Alarm',
  },
  {
    code: 's24n',
    description: '240v Hardwired with nonreplaceable battery backup',
    category: 'Alarm',
  },
  {
    code: 's9',
    description: 'Nonhardwired 9V Battery only',
    category: 'Alarm',
  },
  {
    code: 's9n',
    description: 'Nonhardwired nonreplaceable battery backup',
    category: 'Alarm',
  },
  {
    code: 'sd',
    description: 'Security Device (remove & fill holes with Fire Sealant)',
    quote_price: 25,
    category: 'Hardware',
  },
  {
    code: 'seq',
    description: 'Sequencer requires adjusting; if adjusting fails replace sequencer $195.00+GST',
    quote_price: 25,
    category: 'Hardware',
  },
  {
    code: 'sh',
    description: 'Hardware requires servicing',
    quote_price: 25,
    category: 'Hardware',
  },
  {
    code: 'sor',
    description: 'Sprinkler Obstruction Removed',
    category: 'General',
  },

  // ── T ──────────────────────────────────────────────────────────────────────
  {
    code: 'ted',
    description: 'Top Edge Delamination',
    quote_price: 215,
    category: 'Delamination',
  },
  {
    code: 'tg',
    description: 'Top Gap',
    quote_price: 35,
    category: 'Gap',
  },
  {
    code: 'tgt',
    description: 'Top Gap exceeding 3mm due to the door edge planed with a taper, Need to refer this back to the developer to fix',
    category: 'Gap',
  },
  {
    code: 'tgx',
    description: 'Top Gap 8mm+ (Recheck gap size, look for alternative cost effective solution, if not able to repair will replace Door $900.00+GST)',
    quote_price: 75,
    category: 'Gap',
  },
  {
    code: 'tl',
    description: "Top Lock not latching correctly; requires servicing $25.00+GST if it can't be serviced then replace top lock $175.00+GST",
    category: 'Lock',
  },
  {
    code: 'tsc',
    description: 'Top Side Contact',
    quote_price: 25,
    category: 'Hardware',
  },
  {
    code: 'tss',
    description: 'Top Inside Smoke Seal damaged/Missing (Required to be Replaced)',
    quote_price: 25,
    category: 'Seal',
  },
  {
    code: 'tsx',
    description: 'Top External Smoke Seal damaged/Missing (Required to be Replaced)',
    quote_price: 40,
    category: 'Seal',
  },

  // ── W ──────────────────────────────────────────────────────────────────────
  {
    code: 'wa',
    description: "Didn't go into emergency mode during the test; require electrician to investigate $85.00+GSTp/h",
    category: 'Alarm',
  },
  {
    code: 'warp',
    description: 'The Fire Door is warped out of shape and is not latching correctly; attempt a minor repair; if that fails then the door will be replaced $900.00+GST',
    quote_price: 150,
    category: 'Hardware',
  },
  {
    code: 'wl1',
    description: '1 window lock — missing/damaged',
    quote_price: 35,
    category: 'Window',
  },
  {
    code: 'wl2',
    description: '2 window locks — missing/damaged',
    quote_price: 65,
    category: 'Window',
  },
  {
    code: 'wl3',
    description: '3 window locks — missing/damaged',
    quote_price: 90,
    category: 'Window',
  },
  {
    code: 'wl4',
    description: '4 window locks — missing/damaged',
    quote_price: 115,
    category: 'Window',
  },
  {
    code: 'wl5',
    description: '5 window locks — missing/damaged',
    quote_price: 140,
    category: 'Window',
  },
  {
    code: 'wr',
    description: 'Welding Required & may require Fire Detection Isolations $250.00+GST',
    quote_price: 400,
    category: 'Hardware',
  },
];

// ─── Helper Functions ─────────────────────────────────────────────────────────

/** Find a defect code by its code string (case-insensitive) */
export function findDefectCode(code: string): DefectCode | undefined {
  return DEFECT_CODES.find(d => d.code.toLowerCase() === code.toLowerCase());
}

/** Get all codes in a specific category */
export function getDefectsByCategory(category: DefectCategory): DefectCode[] {
  return DEFECT_CODES.filter(d => d.category === category);
}

/** Search codes by code string or description */
export function searchDefectCodes(query: string): DefectCode[] {
  const q = query.toLowerCase().trim();
  if (!q) return DEFECT_CODES;
  return DEFECT_CODES.filter(
    d =>
      d.code.toLowerCase().includes(q) ||
      d.description.toLowerCase().includes(q) ||
      d.category.toLowerCase().includes(q)
  );
}

/** All distinct categories in display order */
export const DEFECT_CATEGORIES: DefectCategory[] = [
  'Gap',
  'Seal',
  'Hardware',
  'Lock',
  'Hinge',
  'Delamination',
  'Alarm',
  'Window',
  'Compliance',
  'Access',
  'General',
];

/** Category icon map for the picker UI */
export const CATEGORY_ICONS: Record<DefectCategory, string> = {
  Gap:          'arrow-expand-horizontal',
  Seal:         'shield-outline',
  Hardware:     'wrench-outline',
  Lock:         'lock-outline',
  Hinge:        'rotate-3d-variant',
  Delamination: 'layers-remove',
  Alarm:        'alarm-light-outline',
  Window:       'window-open-variant',
  Compliance:   'certificate-outline',
  Access:       'door-closed-lock',
  General:      'clipboard-text-outline',
};
