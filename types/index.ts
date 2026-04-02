// Full TypeScript interfaces for all SiteTrack domain models, API responses, and forms

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
} from '@/constants/Enums';

// ─────────────────────────────────────────────
// Domain Models — mirror the Supabase schema
// ─────────────────────────────────────────────

/** A technician or subcontractor user registered in the system */
export interface User {
  id: string;           // uuid — references auth.users
  email: string;
  full_name: string;
  role: UserRole;
  phone: string | null;
  avatar_url: string | null;
  is_active: boolean;
  created_at: string;   // ISO 8601 timestamptz
}

/** A physical site/building managed for fire compliance */
export interface Property {
  id: string;
  name: string;
  address: string | null;
  suburb: string | null;
  state: string | null;
  postcode: string | null;
  site_contact_name: string | null;
  site_contact_phone: string | null;
  access_notes: string | null;
  hazard_notes: string | null;
  compliance_status: ComplianceStatus;
  created_at: string;
  updated_at: string;
}

/** A fire safety asset installed at a property (extinguisher, sprinkler head, etc.) */
export interface Asset {
  id: string;
  property_id: string;
  asset_type: string;
  description: string | null;
  location_on_site: string | null;
  serial_number: string | null;
  barcode_id: string | null;
  install_date: string | null;    // ISO 8601 date
  last_service_date: string | null;
  next_service_date: string | null;
  status: AssetStatus;
  created_at: string;
}

/** A field service job assigned to a technician */
export interface Job {
  id: string;
  property_id: string;
  assigned_to: string;            // user id
  job_type: JobType;
  status: JobStatus;
  scheduled_date: string;         // ISO 8601 date
  scheduled_time: string | null;  // HH:MM
  priority: Priority;
  notes: string | null;
  created_at: string;
  updated_at: string;

  // Joined relations (populated from local DB queries)
  property?: Property;
  assigned_user?: User;
}

/** The inspection record linking a specific asset to a job */
export interface JobAsset {
  id: string;
  job_id: string;
  asset_id: string;
  result: InspectionResult | null;
  defect_reason: string | null;
  technician_notes: string | null;
  actioned_at: string | null;

  // Joined relations
  asset?: Asset;
}

/** A defect identified during an inspection */
export interface Defect {
  id: string;
  job_id: string;
  asset_id: string;
  property_id: string;
  description: string;
  severity: DefectSeverity;
  status: DefectStatus;
  photos: string[];               // array of storage URLs
  created_at: string;
}

/** A photo taken during a job inspection */
export interface InspectionPhoto {
  id: string;
  job_id: string;
  asset_id: string | null;
  photo_url: string;
  caption: string | null;
  uploaded_at: string;
  uploaded_by: string;            // user id
}

/** Client signature captured at job completion */
export interface Signature {
  id: string;
  job_id: string;                 // unique — one signature per job
  signature_url: string;
  signed_by_name: string;
  signed_at: string;
}

/** Clock-in / clock-out record for a technician on a job */
export interface TimeLog {
  id: string;
  job_id: string;
  user_id: string;
  clock_in: string;
  clock_out: string | null;
  gps_lat: number | null;
  gps_lng: number | null;
  travel_time_minutes: number | null;
}

/** Offline write operation waiting to be pushed to Supabase */
export interface SyncQueueItem {
  id: number;                     // SQLite autoincrement
  table_name: string;
  record_id: string;
  operation: SyncOperation;
  payload: string;                // JSON.stringify'd record data
  synced: boolean;
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
  photos: string[];               // local file URIs before upload
}

// ─────────────────────────────────────────────
// Utility Types
// ─────────────────────────────────────────────

/** Sync status snapshot returned by getSyncStatus() */
export interface SyncStatus {
  lastSynced: string | null;      // ISO 8601 or null if never synced
  pendingCount: number;
  isOnline: boolean;
}

/** GPS coordinate pair */
export interface Coordinates {
  latitude: number;
  longitude: number;
}
