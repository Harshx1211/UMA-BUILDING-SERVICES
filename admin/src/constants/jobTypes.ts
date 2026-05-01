// ─── Job Type System ──────────────────────────────────────────────────────────
// Hierarchical job type: top-level category → sub-frequency (for Routine Service)
// Values are stored as compound strings in the job_type DB column.
// e.g. "routine_service_monthly", "routine_service_annual"

export interface ServiceCategory {
  value: string;         // top-level key (also the DB value for non-routine types)
  label: string;
  icon: string;          // professional string or empty
  color: string;         // brand colour
  bg: string;
  description: string;
  frequencies?: ServiceFrequency[];  // only for routine_service
}

export interface ServiceFrequency {
  value: string;   // full compound DB value e.g. "routine_service_monthly"
  label: string;
  shortLabel: string;
  months: number;  // interval in months (for scheduling)
}

// ── Routine Service Frequencies ────────────────────────────────────────────────
export const ROUTINE_FREQUENCIES: ServiceFrequency[] = [
  { value: 'routine_service_monthly',   label: 'Monthly',    shortLabel: '1 Month',   months: 1  },
  { value: 'routine_service_3_monthly', label: '3 Monthly',  shortLabel: '3 Months',  months: 3  },
  { value: 'routine_service_6_monthly', label: '6 Monthly',  shortLabel: '6 Months',  months: 6  },
  { value: 'routine_service_annual',    label: 'Annual',     shortLabel: '12 Months', months: 12 },
  { value: 'routine_service_5_yearly',  label: '5 Yearly',   shortLabel: '5 Years',   months: 60 },
];

// ── All Top-Level Categories ───────────────────────────────────────────────────
export const SERVICE_CATEGORIES: ServiceCategory[] = [
  {
    value: 'routine_service',
    label: 'Routine Service',
    icon: '',
    color: '#1B2D4F',
    bg: '#f8fafc',
    description: 'Scheduled maintenance & compliance inspection',
    frequencies: ROUTINE_FREQUENCIES,
  },
  {
    value: 'defect_repair_quote',
    label: 'Quote / Defect Repair',
    icon: '',
    color: '#1B2D4F',
    bg: '#f8fafc',
    description: 'Site visit for quoting or repairing defects',
  },
];

// ── All valid DB values (for filters, validation) ─────────────────────────────
export const ALL_JOB_TYPE_VALUES: string[] = [
  ...ROUTINE_FREQUENCIES.map(f => f.value),
  'defect_repair_quote',
  'defect_repair', // Legacy
  'quote',         // Legacy
  'installation',  // Legacy
  'emergency',     // Legacy
];

// ── Helper: get a human-readable label for any stored job_type value ───────────
export function getJobTypeLabel(value: string): string {
  if (!value) return '';
  // Check frequencies first
  const freq = ROUTINE_FREQUENCIES.find(f => f.value === value);
  if (freq) return `Routine Service — ${freq.label}`;

  // Check categories
  const cat = SERVICE_CATEGORIES.find(c => c.value === value);
  if (cat) return cat.label;

  // Legacy mappings
  if (value === 'defect_repair') return 'Defect Repair (Legacy)';
  if (value === 'quote') return 'Quote (Legacy)';
  if (value === 'installation') return 'Installation (Legacy)';
  if (value === 'emergency') return 'Emergency (Legacy)';

  // Fallback: prettify the raw value
  return value.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
}

// ── Helper: get the category for a stored job_type value ──────────────────────
export function getJobTypeCategory(value: string): ServiceCategory | undefined {
  if (!value) return undefined;
  if (value.startsWith('routine_service')) {
    return SERVICE_CATEGORIES.find(c => c.value === 'routine_service');
  }
  // If it's a legacy value, map it to the new combined category so the UI looks consistent
  if (value === 'defect_repair' || value === 'quote') {
    return SERVICE_CATEGORIES.find(c => c.value === 'defect_repair_quote');
  }
  return SERVICE_CATEGORIES.find(c => c.value === value);
}

// ── Legacy flat list for filters (all possible values) ────────────────────────
export const JOB_TYPE_FILTER_OPTIONS = [
  { value: '', label: 'Type: All' },
  { value: 'routine_service_monthly',   label: 'Routine — Monthly' },
  { value: 'routine_service_3_monthly', label: 'Routine — 3 Monthly' },
  { value: 'routine_service_6_monthly', label: 'Routine — 6 Monthly' },
  { value: 'routine_service_annual',    label: 'Routine — Annual' },
  { value: 'routine_service_5_yearly',  label: 'Routine — 5 Yearly' },
  { value: 'defect_repair_quote',       label: 'Quote / Defect Repair' },
  { value: 'defect_repair',             label: 'Defect Repair (Legacy)' },
  { value: 'quote',                     label: 'Quote (Legacy)' },
];
