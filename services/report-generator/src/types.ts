// Mirrors the relevant subset of `types/index.ts` in the main app repo.
// Kept as a plain, dependency-free copy since this service is deployed
// independently and shouldn't reach across into the Expo app's source tree.

// AS1851-2012 Clause 1.5.6's three actual defect classifications.
export type DefectSeverity = 'non_conformance' | 'non_critical' | 'critical';
export type DefectStatus = 'open' | 'quoted' | 'repaired' | 'monitoring';
export type JobAssetResult = 'pass' | 'fail' | 'not_tested' | null;

export interface Company {
  id: string;
  name: string;
  abn: string | null;
  address: string | null;
  phone: string | null;
  contact_email: string | null;
  logo_url: string | null;
  accreditations: string | null;
}

export interface Property {
  id: string;
  name: string;
  address: string | null;
  suburb: string | null;
  state: string | null;
  postcode: string | null;
  site_contact_name: string | null;
  site_contact_phone: string | null;
}

export interface JobUser {
  id: string;
  full_name: string;
  fpas_number: string | null;
  fpas_class: string | null;
  fpas_expiry: string | null;
  state_license: string | null;
  state_license_expiry: string | null;
}

export interface Job {
  id: string;
  company_id: string;
  property_id: string;
  assigned_to: string;
  job_type: string;
  status: string;
  scheduled_date: string;
  completed_at?: string | null;
  created_at: string;
  updated_at: string;
  notes: string | null;
  property?: Property;
  assigned_user?: JobUser;
}

export interface JobAsset {
  id: string;
  job_id: string;
  asset_id: string;
  result: JobAssetResult;
  is_compliant: boolean;
  defect_reason: string | null;
  technician_notes: string | null;
  actioned_at: string | null;
  actioned_by: string | null;
}

export interface Asset {
  id: string;
  property_id: string;
  asset_type: string;
  variant: string | null;
  asset_ref: string | null;
  location_on_site: string | null;
  serial_number: string | null;
}

/** Asset merged with its job_assets result for this specific job. */
export interface AssetWithResult extends Asset {
  result: JobAssetResult;
  defect_reason: string | null;
  technician_notes: string | null;
  actioned_at: string | null;
  /** Resolved from actioned_by via a users lookup in fetchReportData.ts —
   * null if the row predates job_assets.actioned_by or was never actioned. */
  actionedByName: string | null;
  /** Resolved category label, e.g. "04 - Fire Hydrant Systems". See categoryGrouping.ts. */
  categoryLabel: string;
  categoryNumber: number | null;
  /** `categoryNumber`, but only when it's a real AS1851 Section 2-14 — null otherwise. */
  categoryOfficialSection: number | null;
}

export interface Defect {
  id: string;
  job_id: string;
  asset_id: string | null;
  description: string;
  severity: DefectSeverity;
  status: DefectStatus;
  defect_code: string | null;
  quote_price: number | null;
  created_at: string;
  updated_at: string | null;
}

export interface InspectionPhoto {
  id: string;
  job_id: string;
  asset_id: string | null;
  defect_id: string | null;
  photo_url: string;
  caption: string | null;
}

export interface Signature {
  id: string;
  job_id: string;
  signature_url: string;
  tech_signature_url: string | null;
  signed_by_name: string;
  signed_at: string;
}

export interface TimeLog {
  id: string;
  job_id: string;
  user_id: string;
  clock_in: string;
  clock_out: string | null;
}

export interface QuoteItem {
  id: string;
  defect_id: string | null;
  quantity: number;
  unit_price: number;
  item_name: string | null;
  inventory_item?: { name: string } | null;
}

export interface Quote {
  id: string;
  job_id: string;
  status: string;
  total_amount: number;
  items?: QuoteItem[];
}

export interface AssetTypeDefinition {
  value: string;
  label: string;
  full_label: string;
  inspection_routine: string;
}

/** Everything the templates need, fully assembled and ready to render. */
export interface ReportData {
  job: Job;
  company: Company;
  assets: AssetWithResult[];
  defects: Defect[];
  photosByAsset: Map<string, InspectionPhoto[]>;
  photosByDefect: Map<string, InspectionPhoto[]>;
  // inspection_photos.id -> small inline "data:image/jpeg;base64,..." URI
  // (resized server-side — see photos/prepareInlinePhotos.ts). Named
  // signedPhotoUrls for historical reasons (an earlier design signed the
  // original's Storage URL and let Chromium fetch it directly; that turned
  // out to be the actual generation-time bottleneck in real testing).
  signedPhotoUrls: Map<string, string>;
  signature: Signature | null;
  // The assigned crew — a flat list, no primary (see job_technicians
  // migration). Falls back to [job.assigned_user] for a job that predates
  // job_technicians rows. Distinct from timeLogUsers, which also includes
  // anyone who clocked time but isn't formally assigned.
  assignedUsers: JobUser[];
  timeLogUsers: Array<{
    user: JobUser;
    firstClockIn: string;
    lastClockOut: string | null;
    // True only when firstClockIn/lastClockOut came from real time_logs
    // rows. When a technician never used clock-in/out, these fall back to
    // the job's own date (see fetchReportData.ts) — that's a single
    // reference date, not an open clock session, and the two must render
    // differently (see templates/signoff.ts).
    hasRealSession: boolean;
  }>;
  approvedQuote: Quote | null;
  reportId: string;
  dateOfService: string | null;
}
