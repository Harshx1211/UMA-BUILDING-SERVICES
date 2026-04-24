/**
 * Checklists.ts — Compliance checklist definitions for all 9 official fire safety asset types.
 * Keys MUST exactly match the `value` field in AssetData.ts ASSET_TYPES.
 *
 * Each checklist is used by ChecklistModal during an inspection.
 * When a checklist is completed and all items pass → asset result = Pass.
 * If any item fails → technician is prompted to log a defect.
 */

export interface ChecklistItem {
  id: string;
  question: string;
  type: 'boolean' | 'text' | 'dropdown';
  options?: string[];   // only for 'dropdown' type
  required: boolean;
  hint?: string;        // optional guidance shown below the question
}

export interface ChecklistTemplate {
  asset_type: string;
  items: ChecklistItem[];
}

// ─── Full compliance checklists for all 9 official asset types ────────────────

export const COMPLIANCE_CHECKLISTS: Record<string, ChecklistItem[]> = {

  // ── 1. BGA / MCP / Manual Call Point ─────────────────────────────────────
  'BGA, MCP or Manual Call Point': [
    { id: 'mcp1', question: 'Is the unit free from physical damage or tampering?', type: 'boolean', required: true },
    { id: 'mcp2', question: 'Is the glass element intact (not previously activated)?', type: 'boolean', required: true, hint: 'For break-glass units only — if already broken, note as previously activated.' },
    { id: 'mcp3', question: 'Does the device trigger an alarm when tested?', type: 'boolean', required: true },
    { id: 'mcp4', question: 'Is the associated bell or sounder audible from the device location?', type: 'boolean', required: true },
    { id: 'mcp5', question: 'Is the zone label on the device legible and accurate?', type: 'boolean', required: true },
    { id: 'mcp6', question: 'Is the mounting secure and at the correct height (1.0–1.2 m from floor)?', type: 'boolean', required: true },
    { id: 'mcp7', question: 'Technician notes (optional)', type: 'text', required: false },
  ],

  // ── 2. Emergency - Exit Signs ──────────────────────────────────────────────
  'Emergency - Exit Signs': [
    { id: 'ex1', question: 'Is the exit sign illuminated on mains power?', type: 'boolean', required: true },
    { id: 'ex2', question: 'Does the sign switch to battery backup when mains is isolated?', type: 'boolean', required: true },
    { id: 'ex3', question: 'Is the battery backup duration at least 90 minutes?', type: 'boolean', required: true, hint: 'Test by switching off mains and timing. 90 min min per AS 2293.' },
    { id: 'ex4', question: 'Is the legend/pictogram clearly visible and undamaged?', type: 'boolean', required: true },
    { id: 'ex5', question: 'Is the sign unobstructed and visible from all required directions?', type: 'boolean', required: true },
    { id: 'ex6', question: 'Is the unit free of cracking, yellowing or physical damage?', type: 'boolean', required: true },
    { id: 'ex7', question: 'Is the charge indicator (if present) showing correctly?', type: 'boolean', required: true },
    { id: 'ex8', question: 'Technician notes (optional)', type: 'text', required: false },
  ],

  // ── 3. Emergency - Lighting ────────────────────────────────────────────────
  'Emergency - Lighting': [
    { id: 'el1', question: 'Does the emergency light activate when mains power is isolated?', type: 'boolean', required: true },
    { id: 'el2', question: 'Does the fitting provide adequate illumination during the test?', type: 'boolean', required: true, hint: 'Minimum 10 lux at floor level per AS 2293.' },
    { id: 'el3', question: 'Is the battery backup duration at least 90 minutes?', type: 'boolean', required: true },
    { id: 'el4', question: 'Is the charge indicator (if fitted) showing correctly?', type: 'boolean', required: true },
    { id: 'el5', question: 'Is the unit free of physical damage (cracking, broken lens, etc.)?', type: 'boolean', required: true },
    { id: 'el6', question: 'Is the beam direction correctly covering the escape path?', type: 'boolean', required: true },
    { id: 'el7', question: 'Is the unit securely fixed to the mounting surface?', type: 'boolean', required: true },
    { id: 'el8', question: 'Technician notes (optional)', type: 'text', required: false },
  ],

  // ── 4. Fire Detection Devices ──────────────────────────────────────────────
  'Fire Detection Devices (MCP, Detector, strobe, Flow Switch)': [
    { id: 'fd1', question: 'Does the detector trigger an alarm when tested?', type: 'boolean', required: true, hint: 'Use an aerosol tester for smoke detectors. Use a heat gun for heat detectors.' },
    { id: 'fd2', question: 'Is the device mapped to the correct zone on the panel?', type: 'boolean', required: true },
    { id: 'fd3', question: 'Is the device securely fixed and free from damage?', type: 'boolean', required: true },
    { id: 'fd4', question: 'Is the device free from dirt, dust or insects that may cause false alarms?', type: 'boolean', required: true },
    { id: 'fd5', question: 'Are any indicator LEDs functioning correctly?', type: 'boolean', required: true },
    { id: 'fd6', question: 'Has the device been cleaned and sensitivity checked?', type: 'boolean', required: true },
    { id: 'fd7', question: 'Is the sensitivity within the manufacturer\'s specified range?', type: 'boolean', required: true },
    { id: 'fd8', question: 'Technician notes (optional)', type: 'text', required: false },
  ],

  // ── 5. Fire Door (CA) ──────────────────────────────────────────────────────
  'Fire Door (CA)': [
    { id: 'door1', question: 'Does the door close and fully latch from its open position under its own weight?', type: 'boolean', required: true },
    { id: 'door2', question: 'Are the hinges firmly attached and free of damage?', type: 'boolean', required: true },
    { id: 'door3', question: 'Are the intumescent seals (smoke/fire) intact with no gaps?', type: 'boolean', required: true },
    { id: 'door4', question: 'Is the fire-rating tag/certification label legible?', type: 'boolean', required: true },
    { id: 'door5', question: 'Is the door leaf free from holes, damage or unauthorised modifications?', type: 'boolean', required: true },
    { id: 'door6', question: 'Do door closers operate smoothly without jamming?', type: 'boolean', required: true },
    { id: 'door7', question: 'Are hold-open devices (if fitted) compliant and releasing correctly?', type: 'boolean', required: true },
    { id: 'door8', question: 'Is the door frame in good condition with no separation from the wall?', type: 'boolean', required: true },
    { id: 'door9', question: 'Technician notes (optional)', type: 'text', required: false },
  ],

  // ── 6. Fire Extinguishers - Portable ──────────────────────────────────────
  'Fire Extinguishers - Portable': [
    { id: 'fe1', question: 'Is the extinguisher securely mounted in its bracket or hanger?', type: 'boolean', required: true },
    { id: 'fe2', question: 'Is the safety pin and tamper seal intact and unbroken?', type: 'boolean', required: true },
    { id: 'fe3', question: 'Is the pressure gauge needle in the green (operable) zone?', type: 'boolean', required: true },
    { id: 'fe4', question: 'Is the unit free from physical damage, dents or corrosion?', type: 'boolean', required: true },
    { id: 'fe5', question: 'Is the hose/nozzle clear of blockages and in good condition?', type: 'boolean', required: true },
    { id: 'fe6', question: 'Is the compliance label current (within 6-year hydrostatic test window)?', type: 'boolean', required: true, hint: 'Check the last hydrostatic test date on the label.' },
    { id: 'fe7', question: 'Is the extinguisher weight within the acceptable range (weigh if CO2)?', type: 'boolean', required: true },
    { id: 'fe8', question: 'Has the service tag been updated with today\'s date and technician initials?', type: 'boolean', required: true },
    { id: 'fe9', question: 'Technician notes (optional)', type: 'text', required: false },
  ],

  // ── 7. Fire Hose Reels ─────────────────────────────────────────────────────
  'Fire Hose Reels': [
    { id: 'hr1', question: 'Is the hose reel cabinet/signage clearly visible and unobstructed?', type: 'boolean', required: true },
    { id: 'hr2', question: 'Is the hose free from kinks, cracks, abrasions or coupling damage?', type: 'boolean', required: true },
    { id: 'hr3', question: 'Does the shut-off nozzle operate correctly (open/closed)?', type: 'boolean', required: true },
    { id: 'hr4', question: 'Does water flow freely when the valve is opened and hose extended?', type: 'boolean', required: true, hint: 'Minimum flow: 0.33 L/s at 220 kPa per AS 2441.' },
    { id: 'hr5', question: 'Does the hose reel swing/pivot freely to cover required area?', type: 'boolean', required: true },
    { id: 'hr6', question: 'Is the hose re-wound correctly after the test with no kinks?', type: 'boolean', required: true },
    { id: 'hr7', question: 'Are all couplings and fittings leak-free under pressure?', type: 'boolean', required: true },
    { id: 'hr8', question: 'Is the isolation valve operational and accessible?', type: 'boolean', required: true },
    { id: 'hr9', question: 'Technician notes (optional)', type: 'text', required: false },
  ],

  // ── 8. Fire Hydrant System ─────────────────────────────────────────────────
  'Fire Hydrant System': [
    { id: 'hy1', question: 'Is the booster assembly clearly labelled and free of damage?', type: 'boolean', required: true },
    { id: 'hy2', question: 'Are all landing valves operating smoothly (open/close)?', type: 'boolean', required: true },
    { id: 'hy3', question: 'Are landing valve caps in place and in good condition?', type: 'boolean', required: true },
    { id: 'hy4', question: 'Is the static pressure at the hydrant within acceptable range?', type: 'boolean', required: true, hint: 'Record static pressure reading in notes.' },
    { id: 'hy5', question: 'Is a flow test carried out and result within spec?', type: 'boolean', required: true, hint: 'Per AS 2419 — record flow rate in notes.' },
    { id: 'hy6', question: 'Is the hydrant pit/box free from damage, debris and flooding?', type: 'boolean', required: true },
    { id: 'hy7', question: 'Is the signage compliant and clearly visible to the fire brigade?', type: 'boolean', required: true },
    { id: 'hy8', question: 'Technician notes — record pressure & flow readings', type: 'text', required: true },
  ],

  // ── 9. Fire Sprinkler System - Wet Pipe ───────────────────────────────────
  'Fire Sprinkler System - Wet Pipe': [
    { id: 'sp1', question: 'Is the sprinkler alarm valve in the correct open position?', type: 'boolean', required: true },
    { id: 'sp2', question: 'Is the system pressure gauge reading within specified range?', type: 'boolean', required: true, hint: 'Record system pressure in notes.' },
    { id: 'sp3', question: 'Are all accessible sprinkler heads free from damage, paint or corrosion?', type: 'boolean', required: true },
    { id: 'sp4', question: 'Is a flow test activated via the test valve and alarm received at the panel?', type: 'boolean', required: true },
    { id: 'sp5', question: 'Does the flow switch operate correctly during the test?', type: 'boolean', required: true },
    { id: 'sp6', question: 'Are all control valves sealed/supervised in the open position?', type: 'boolean', required: true },
    { id: 'sp7', question: 'Is the inspector\'s test valve operating correctly?', type: 'boolean', required: true },
    { id: 'sp8', question: 'Is there adequate clearance (450 mm min) below all sprinkler heads?', type: 'boolean', required: true },
    { id: 'sp9', question: 'Technician notes — record system pressure reading', type: 'text', required: true },
  ],
};

// ─── Generic fallback ─────────────────────────────────────────────────────────
// Used for any asset type not in the map above (legacy data, custom types, etc.)

export const GENERIC_CHECKLIST: ChecklistItem[] = [
  { id: 'g1', question: 'Is the asset visually free of physical damage?', type: 'boolean', required: true },
  { id: 'g2', question: 'Is the asset operating correctly as per manufacturer specifications?', type: 'boolean', required: true },
  { id: 'g3', question: 'Is the asset correctly labelled/tagged?', type: 'boolean', required: true },
  { id: 'g4', question: 'Technician notes (optional)', type: 'text', required: false },
];
