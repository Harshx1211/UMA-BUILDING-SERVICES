// All shared TypeScript types for the SiteTrack Admin Portal
// Mirrors the Supabase schema exactly

export type UserRole = 'technician' | 'subcontractor' | 'admin';
export type JobStatus = 'scheduled' | 'in_progress' | 'completed' | 'cancelled';
export type JobType = 'routine_service' | 'defect_repair' | 'installation' | 'emergency' | 'quote';
export type Priority = 'low' | 'normal' | 'high' | 'urgent';
export type AssetStatus = 'active' | 'decommissioned';
export type InspectionResult = 'pass' | 'fail' | 'not_tested';
export type DefectSeverity = 'minor' | 'major' | 'critical';
export type DefectStatus = 'open' | 'quoted' | 'repaired' | 'monitoring';
export type ComplianceStatus = 'compliant' | 'non_compliant' | 'overdue' | 'pending';
export type QuoteStatus = 'draft' | 'approved' | 'rejected';

export interface User {
  id: string;
  email: string;
  full_name: string;
  role: UserRole;
  phone: string | null;
  avatar_url: string | null;
  is_active: boolean;
  created_at: string;
  push_token: string | null;
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
  access_notes: string | null;
  hazard_notes: string | null;
  compliance_status: ComplianceStatus;
  next_inspection_date: string | null;
  created_at: string;
  updated_at: string;
}

export interface Asset {
  id: string;
  property_id: string;
  asset_type: string;
  variant: string | null;
  asset_ref: string | null;
  description: string | null;
  location_on_site: string | null;
  serial_number: string | null;
  barcode_id: string | null;
  install_date: string | null;
  last_service_date: string | null;
  next_service_date: string | null;
  status: AssetStatus;
  created_at: string;
  property?: Property;
}

export interface Job {
  id: string;
  property_id: string;
  assigned_to: string;
  job_type: JobType;
  status: JobStatus;
  scheduled_date: string;
  scheduled_time: string | null;
  priority: Priority;
  notes: string | null;
  report_url: string | null;
  created_at: string;
  updated_at: string;
  property?: Property;
  assigned_user?: User;
}

export interface JobAsset {
  id: string;
  job_id: string;
  asset_id: string;
  result: InspectionResult | null;
  checklist_data: string | null;
  is_compliant: boolean;
  defect_reason: string | null;
  technician_notes: string | null;
  actioned_at: string | null;
  asset?: Asset;
}

export interface Defect {
  id: string;
  job_id: string;
  asset_id: string;
  property_id: string;
  description: string;
  severity: DefectSeverity;
  status: DefectStatus;
  photos: string[];
  created_at: string;
  property?: Property;
  asset?: Asset;
  job?: Job;
}

export interface InspectionPhoto {
  id: string;
  job_id: string;
  asset_id: string | null;
  defect_id: string | null;
  photo_url: string;
  caption: string | null;
  uploaded_at: string;
  uploaded_by: string;
}

export interface Signature {
  id: string;
  job_id: string;
  signature_url: string;
  signed_by_name: string;
  signed_at: string;
}

export interface TimeLog {
  id: string;
  job_id: string;
  user_id: string;
  clock_in: string;
  clock_out: string | null;
  gps_lat: number | null;
  gps_lng: number | null;
  travel_time_minutes: number | null;
  user?: User;
  job?: Job;
}

export interface InventoryItem {
  id: string;
  name: string;
  description: string | null;
  price: number;
  created_at: string;
}

export interface Quote {
  id: string;
  job_id: string;
  status: QuoteStatus;
  total_amount: number;
  created_at: string;
  job?: Job;
  items?: QuoteItem[];
}

export interface QuoteItem {
  id: string;
  quote_id: string;
  inventory_item_id: string;
  defect_id: string | null;
  quantity: number;
  unit_price: number;
  inventory_item?: InventoryItem;
}

export interface Notification {
  id: string;
  type: 'new_job' | 'urgent_job' | 'sync_complete' | 'defect_flagged' | 'general';
  title: string;
  message: string;
  job_id: string | null;
  user_id: string | null;
  is_read: boolean;
  created_at: string;
}

// Dashboard stat types
export interface DashboardStats {
  totalJobs: number;
  completedToday: number;
  openDefects: number;
  criticalDefects: number;
  propertiesOverdue: number;
  pendingQuotes: number;
  totalRevenue: number;
  activeTechnicians: number;
}
