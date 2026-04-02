// All app-wide enumerations — single source of truth for status/type values

/** Lifecycle state of a field service job */
export enum JobStatus {
  Scheduled = 'scheduled',
  InProgress = 'in_progress',
  Completed = 'completed',
  Cancelled = 'cancelled',
}

/** Category of work being performed */
export enum JobType {
  RoutineService = 'routine_service',
  DefectRepair = 'defect_repair',
  Installation = 'installation',
  Emergency = 'emergency',
  Quote = 'quote',
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

/** How critical a recorded defect is */
export enum DefectSeverity {
  Minor = 'minor',
  Major = 'major',
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

/** Role a user holds within the SiteTrack platform */
export enum UserRole {
  Technician = 'technician',
  Subcontractor = 'subcontractor',
}

/** Type of write operation stored in the offline sync queue */
export enum SyncOperation {
  Insert = 'insert',
  Update = 'update',
  Delete = 'delete',
}

/** Job/task urgency level */
export enum Priority {
  Low = 'low',
  Normal = 'normal',
  High = 'high',
  Urgent = 'urgent',
}
