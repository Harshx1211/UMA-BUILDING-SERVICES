// All app-wide enumerations — single source of truth for status/type values

/** Lifecycle state of a field service job */
export enum JobStatus {
  Scheduled = 'scheduled',
  InProgress = 'in_progress',
  Completed = 'completed',
  Cancelled = 'cancelled',
}

/** Status of generated deficiency quotes — must mirror the admin app's
 * `quotes.status` CHECK constraint exactly (draft/sent/approved/rejected). */
export enum QuoteStatus {
  Draft = 'draft',
  Sent = 'sent',
  Approved = 'approved',
  Rejected = 'rejected',
}

/**
 * Category of work being performed — must mirror Supabase's own
 * `jobs.job_type` CHECK constraint exactly (supabase/schema.sql), which
 * allows these 10 values and no others.
 *
 * This previously had only 5 members, including a `RoutineService =
 * 'routine_service'` that doesn't match ANY real DB value — writing it
 * failed the CHECK constraint silently on sync (fixed one live instance of
 * this in site-inspect/[id].tsx). The 5 routine_service_* frequency
 * variants below had no enum member at all.
 *
 * DefectRepair ('defect_repair') and Quote ('quote') are legacy values —
 * still valid and still readable (existing rows use them), but new jobs
 * should use DefectRepairQuote instead (see the admin dashboard's
 * src/constants/jobTypes.ts, which already treats them this way).
 */
export enum JobType {
  RoutineServiceMonthly = 'routine_service_monthly',
  RoutineService3Monthly = 'routine_service_3_monthly',
  RoutineService6Monthly = 'routine_service_6_monthly',
  RoutineServiceAnnual = 'routine_service_annual',
  RoutineService5Yearly = 'routine_service_5_yearly',
  DefectRepairQuote = 'defect_repair_quote',
  DefectRepair = 'defect_repair',
  Quote = 'quote',
  Installation = 'installation',
  Emergency = 'emergency',
}

/** Operational state of a fire safety asset */
export enum AssetStatus {
  Active = 'active',
  Decommissioned = 'decommissioned',
}

/** Outcome recorded when a technician inspects an asset */
export enum InspectionResult {
  Pass = 'pass',
  Fail = 'fail',
  NotTested = 'not_tested',
}

/** AS1851-2012 Clause 1.5.6 classification of a recorded defect — these three terms
 * (not "minor"/"major") are the standard's actual language. */
export enum DefectSeverity {
  NonConformance = 'non_conformance',
  NonCritical = 'non_critical',
  Critical = 'critical',
}

/** Current remediation state of a defect */
export enum DefectStatus {
  Open = 'open',
  Quoted = 'quoted',
  Repaired = 'repaired',
  Monitoring = 'monitoring',
}

/** Overall fire-safety compliance standing of a property */
export enum ComplianceStatus {
  Compliant = 'compliant',
  NonCompliant = 'non_compliant',
  Overdue = 'overdue',
  Pending = 'pending',
}

/** Role a user holds within the UMA BUILDING SERVICES platform */
export enum UserRole {
  Technician = 'technician',
  Subcontractor = 'subcontractor',
  Admin = 'admin',
}

/** Type of write operation stored in the offline sync queue */
export enum SyncOperation {
  Insert         = 'insert',
  Update         = 'update',
  Delete         = 'delete',
  /** Queued server-side PDF generation — processed by Edge Function, not a DB write */
  ReportGenerate = 'report_generate',
}

/** Job/task urgency level */
export enum Priority {
  Low = 'low',
  Normal = 'normal',
  High = 'high',
  Urgent = 'urgent',
}
