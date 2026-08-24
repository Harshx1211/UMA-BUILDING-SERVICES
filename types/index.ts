/**
 * types/index.ts
 *
 * Full TypeScript interfaces for all SiteTrack domain models, API responses,
 * and form types. These MUST stay in sync with the SQLite schema in
 * lib/database.ts (schema v29) and the Supabase remote schema.
 *
 * Audit rule: every field that exists in the SQLite schema must exist here.
 * Missing fields cause silent data loss — the field is fetched from DB but
 * TypeScript won't tell you it exists.
 */

import {
  JobStatus,
  JobType,
  AssetStatus,
  InspectionResult,
  DefectSeverity,
  DefectStatus,
  ComplianceStatus,
  UserRole,
  SyncOperation,
  Priority,
  QuoteStatus,
} from '@/constants/Enums';

// ─────────────────────────────────────────────
// Domain Models — mirror the Supabase + SQLite schema (v29)
// ─────────────────────────────────────────────

/** A technician or admin user registered in the system */
export interface User {
  id: string;                         // uuid — references auth.users
  company_id: string | null;          // required for RLS — never undefined
  email: string;
  full_name: string;
  role: UserRole;
  phone: string | null;
  avatar_url: string | null;
  push_token: string | null;          // Expo push notification token
  is_active: boolean;
  // FPAS licence fields (v22 migration)
  fpas_number: string | null;
  fpas_class: string | null;
  fpas_expiry: string | null;
  // State licence fields (v23 migration)
  state_license: string | null;
  state_license_expiry: string | null;
  // ToS / AUP acceptance timestamps (v26 migration)
  accepted_tos_at: string | null;
  accepted_aup_at: string | null;
  created_at: string;                 // ISO 8601 timestamptz
  updated_at: string;
}

/** A physical site/building managed for fire compliance */
export interface Property {
  id: string;
  company_id: string | null;
  name: string;
  address: string | null;
  suburb: string | null;
  state: string | null;
  postcode: string | null;
  site_contact_name: string | null;
  site_contact_phone: string | null;
  access_notes: string | null;
  hazard_notes: string | null;
  site_note: string | null;
  compliance_status: ComplianceStatus;
  next_inspection_date: string | null;
  created_at: string;
  updated_at: string;
}

/** A fire safety asset installed at a property */
export interface Asset {
  id: string;
  company_id: string | null;
  property_id: string;
  asset_type: string;
  /** Sub-variant of the asset type (e.g. 'DCP AB(E) 4.5KG') */
  variant: string | null;
  /** Short technician reference number (e.g. '001', '040') */
  asset_ref: string | null;
  description: string | null;
  location_on_site: string | null;
  serial_number: string | null;
  barcode_id: string | null;
  install_date: string | null;        // ISO 8601 date
  last_service_date: string | null;
  next_service_date: string | null;
  status: AssetStatus;
  created_at: string;
  updated_at: string;
}

/** A field service job assigned to a technician */
export interface Job {
  id: string;
  company_id: string | null;
  property_id: string;
  assigned_to: string;                // user id
  job_type: JobType;
  status: JobStatus;
  scheduled_date: string;             // ISO 8601 date
  scheduled_time: string | null;      // HH:MM
  priority: Priority;
  notes: string | null;
  report_url: string | null;          // generated PDF URL stored after report creation
  created_at: string;
  updated_at: string;

  // Joined relations (populated from JOIN queries, not columns)
  property?: Property;
  assigned_user?: User;
}

/** The inspection record linking a specific asset to a job */
export interface JobAsset {
  id: string;
  company_id: string | null;
  job_id: string;
  asset_id: string;
  result: InspectionResult | null;
  checklist_data: string | null;      // JSON string of checklist answers
  is_compliant: boolean;
  defect_reason: string | null;
  technician_notes: string | null;
  actioned_at: string | null;

  // Joined relation (populated from JOIN queries)
  asset?: Asset;
}

/** A defect identified during an inspection */
export interface Defect {
  id: string;
  company_id: string | null;
  job_id: string;
  /** Null for "unlinked" defects not tied to a tracked asset. */
  asset_id: string | null;
  property_id: string;
  description: string;
  severity: DefectSeverity;
  status: DefectStatus;
  photos: string[];                   // array of photo_urls or local file URIs
  created_at: string;
  updated_at: string | null;
  /** Uptick defect code (e.g. 'bg', 'hg') — null for free-text defects */
  defect_code: string | null;
  /** Reference quote price in AUD from the Uptick code library */
  quote_price: number | null;
}

/** A photo taken during a job inspection */
export interface InspectionPhoto {
  id: string;
  company_id: string | null;
  job_id: string;
  asset_id: string | null;
  defect_id: string | null;
  /**
   * Supabase Storage CDN URL after upload, or a local file:// URI before upload.
   * Never use this as the display URL without checking — use local_uri as a fallback
   * for offline PDF generation.
   */
  photo_url: string;
  /**
   * Original device file:// path. Preserved after upload so offline PDF generation
   * can fall back to the local copy instead of failing with a placeholder image.
   * Set to null by cleanupLocalPhotos() after the 15-day retention window.
   */
  local_uri: string | null;
  caption: string | null;
  uploaded_at: string;
  /** user id — null when captured offline before session is confirmed */
  uploaded_by: string | null;
}

/** Client + technician signatures captured at job completion */
export interface Signature {
  id: string;
  company_id: string | null;
  job_id: string;                     // UNIQUE — one signature set per job
  /** Client signature — base64 PNG data URI or Supabase Storage URL */
  signature_url: string;
  /** Technician sign-off — AS1851 compliance requires tech signature (v19 migration) */
  tech_signature_url: string | null;
  signed_by_name: string;
  signed_at: string;
  /** Device info at time of signing (OS, app version) — for audit trail (v28 migration) */
  device_info: string | null;
}

/** Clock-in / clock-out record for a technician on a job */
export interface TimeLog {
  id: string;
  company_id: string | null;
  job_id: string;
  user_id: string;
  clock_in: string;
  clock_out: string | null;
  gps_lat: number | null;
  gps_lng: number | null;
  travel_time_minutes: number | null;
}

/** Inventory parts / labour items available for quoting */
export interface InventoryItem {
  id: string;
  name: string;
  description: string | null;
  price: number;
  created_at: string;
}

/** A quote generated by a technician for client approval */
export interface Quote {
  id: string;
  company_id: string | null;
  job_id: string;
  status: QuoteStatus;
  total_amount: number;
  created_at: string;
}

/** Single line item on a Quote */
export interface QuoteItem {
  id: string;
  company_id: string | null;
  quote_id: string;
  /**
   * References inventory_items — null for custom line items where the
   * technician typed a free-text item_name instead of selecting from catalogue.
   */
  inventory_item_id: string | null;
  defect_id: string | null;
  quantity: number;
  unit_price: number;
  /** Custom item name for non-catalogue line items (v27 migration) */
  item_name: string | null;
}

/** Offline write operation waiting to be pushed to Supabase */
export interface SyncQueueItem {
  id: number;                         // SQLite autoincrement
  table_name: string;
  record_id: string;
  /**
   * The sync operation type. Includes the special 'photo_upload' pseudo-operation
   * used by photoUpload.ts to queue binary uploads separately from DB row inserts.
   */
  operation: SyncOperation | 'photo_upload';
  payload: string;                    // JSON.stringify'd record data
  synced: number;                     // 0=pending, 1=done, -1=permanently failed
  retry_count: number;                // incremented on each failed push attempt
  last_error: string | null;          // last error message from a failed push
  next_retry_at: string | null;       // exponential-backoff gate — not retried before this time
  is_terminal: number;                // 1 = failed with a non-retryable error (bad data/permission), not just exhausted retries
  created_at: string;
}

// ─────────────────────────────────────────────
// API Response Types
// ─────────────────────────────────────────────

/** Standard wrapper for all Supabase/API responses */
export interface ApiResponse<T> {
  data: T | null;
  error: string | null;
  success: boolean;
}

/** Paginated list response */
export interface PaginatedResponse<T> {
  data: T[];
  count: number;
  page: number;
  pageSize: number;
  hasMore: boolean;
  error: string | null;
}

// ─────────────────────────────────────────────
// Form Types
// ─────────────────────────────────────────────

/** Fields for the technician login form */
export interface LoginForm {
  email: string;
  password: string;
  rememberMe: boolean;
}

/** Fields submitted when completing an asset inspection */
export interface InspectionForm {
  job_asset_id: string;
  result: InspectionResult;
  defect_reason?: string;
  technician_notes?: string;
}

/** Fields submitted when logging a new defect */
export interface DefectForm {
  job_id: string;
  asset_id: string;
  property_id: string;
  description: string;
  severity: DefectSeverity;
  photos: string[];                   // local file URIs before upload
}

// ─────────────────────────────────────────────
// Utility Types
// ─────────────────────────────────────────────

/** Sync status snapshot returned by getSyncStatus() */
export interface SyncStatus {
  lastSynced: string | null;          // ISO 8601 or null if never synced
  pendingCount: number;
  /** Items that permanently failed after MAX_SYNC_RETRIES — never auto-retried */
  failedCount: number;
  isOnline: boolean;
}

/** GPS coordinate pair */
export interface Coordinates {
  latitude: number;
  longitude: number;
}
