// Local SQLite database service — opens sitetrack.db and provides full CRUD + sync queue helpers
import * as SQLite from 'expo-sqlite';
import { DB_NAME } from '@/constants/Config';
import { SyncOperation } from '@/constants/Enums';
import type { SyncQueueItem } from '@/types';

// ─────────────────────────────────────────────
// Database connection
// ─────────────────────────────────────────────

let _db: SQLite.SQLiteDatabase | null = null;

/** Opens (or creates) sitetrack.db — call once at app startup */
export function openDatabase(): SQLite.SQLiteDatabase {
  if (!_db) {
    _db = SQLite.openDatabaseSync(DB_NAME);
  }
  return _db;
}

// ─────────────────────────────────────────────
// Schema initialisation
// ─────────────────────────────────────────────

/**
 * Creates all local tables using CREATE TABLE IF NOT EXISTS.
 * Safe to call on every app start — will never drop existing data.
 */
export function initializeSchema(): void {
  const db = openDatabase();

  db.execSync(`
    PRAGMA journal_mode = WAL;
    PRAGMA foreign_keys = ON;

    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY NOT NULL,
      email TEXT UNIQUE NOT NULL,
      full_name TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'technician',
      phone TEXT,
      avatar_url TEXT,
      is_active INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS properties (
      id TEXT PRIMARY KEY NOT NULL,
      name TEXT NOT NULL,
      address TEXT,
      suburb TEXT,
      state TEXT,
      postcode TEXT,
      site_contact_name TEXT,
      site_contact_phone TEXT,
      access_notes TEXT,
      hazard_notes TEXT,
      compliance_status TEXT NOT NULL DEFAULT 'pending',
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS assets (
      id TEXT PRIMARY KEY NOT NULL,
      property_id TEXT NOT NULL,
      asset_type TEXT NOT NULL,
      description TEXT,
      location_on_site TEXT,
      serial_number TEXT,
      barcode_id TEXT,
      install_date TEXT,
      last_service_date TEXT,
      next_service_date TEXT,
      status TEXT NOT NULL DEFAULT 'active',
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (property_id) REFERENCES properties(id)
    );

    CREATE TABLE IF NOT EXISTS jobs (
      id TEXT PRIMARY KEY NOT NULL,
      property_id TEXT NOT NULL,
      assigned_to TEXT NOT NULL,
      job_type TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'scheduled',
      scheduled_date TEXT NOT NULL,
      scheduled_time TEXT,
      priority TEXT NOT NULL DEFAULT 'normal',
      notes TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (property_id) REFERENCES properties(id),
      FOREIGN KEY (assigned_to) REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS job_assets (
      id TEXT PRIMARY KEY NOT NULL,
      job_id TEXT NOT NULL,
      asset_id TEXT NOT NULL,
      result TEXT,
      defect_reason TEXT,
      technician_notes TEXT,
      actioned_at TEXT,
      FOREIGN KEY (job_id) REFERENCES jobs(id),
      FOREIGN KEY (asset_id) REFERENCES assets(id)
    );

    CREATE TABLE IF NOT EXISTS defects (
      id TEXT PRIMARY KEY NOT NULL,
      job_id TEXT NOT NULL,
      asset_id TEXT NOT NULL,
      property_id TEXT NOT NULL,
      description TEXT NOT NULL,
      severity TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'open',
      photos TEXT NOT NULL DEFAULT '[]',
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (job_id) REFERENCES jobs(id),
      FOREIGN KEY (asset_id) REFERENCES assets(id),
      FOREIGN KEY (property_id) REFERENCES properties(id)
    );

    CREATE TABLE IF NOT EXISTS inspection_photos (
      id TEXT PRIMARY KEY NOT NULL,
      job_id TEXT NOT NULL,
      asset_id TEXT,
      photo_url TEXT NOT NULL,
      caption TEXT,
      uploaded_at TEXT NOT NULL DEFAULT (datetime('now')),
      uploaded_by TEXT NOT NULL,
      FOREIGN KEY (job_id) REFERENCES jobs(id),
      FOREIGN KEY (uploaded_by) REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS signatures (
      id TEXT PRIMARY KEY NOT NULL,
      job_id TEXT NOT NULL UNIQUE,
      signature_url TEXT NOT NULL,
      signed_by_name TEXT NOT NULL,
      signed_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (job_id) REFERENCES jobs(id)
    );

    CREATE TABLE IF NOT EXISTS time_logs (
      id TEXT PRIMARY KEY NOT NULL,
      job_id TEXT NOT NULL,
      user_id TEXT NOT NULL,
      clock_in TEXT NOT NULL,
      clock_out TEXT,
      gps_lat REAL,
      gps_lng REAL,
      travel_time_minutes INTEGER,
      FOREIGN KEY (job_id) REFERENCES jobs(id),
      FOREIGN KEY (user_id) REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS sync_queue (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      table_name TEXT NOT NULL,
      record_id TEXT NOT NULL,
      operation TEXT NOT NULL,
      payload TEXT NOT NULL,
      synced INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE INDEX IF NOT EXISTS idx_jobs_assigned_to ON jobs(assigned_to);
    CREATE INDEX IF NOT EXISTS idx_jobs_status ON jobs(status);
    CREATE INDEX IF NOT EXISTS idx_jobs_scheduled_date ON jobs(scheduled_date);
    CREATE INDEX IF NOT EXISTS idx_assets_property_id ON assets(property_id);
    CREATE INDEX IF NOT EXISTS idx_defects_job_id ON defects(job_id);
    CREATE INDEX IF NOT EXISTS idx_sync_queue_synced ON sync_queue(synced);
  `);

  console.log('[SiteTrack DB] Schema initialised successfully');
}

// ─────────────────────────────────────────────
// Generic CRUD helpers
// ─────────────────────────────────────────────

type RecordData = Record<string, string | number | boolean | null>;

/**
 * Inserts a new row into the given table.
 * @returns The inserted row id or null on failure
 */
export function insertRecord(table: string, data: RecordData): number | null {
  try {
    const db = openDatabase();
    const keys = Object.keys(data);
    const placeholders = keys.map(() => '?').join(', ');
    const values = Object.values(data);
    const result = db.runSync(
      `INSERT INTO ${table} (${keys.join(', ')}) VALUES (${placeholders})`,
      values as SQLite.SQLiteBindValue[]
    );
    return result.lastInsertRowId;
  } catch (err) {
    console.error(`[SiteTrack DB] insertRecord(${table}) error:`, err);
    return null;
  }
}

/**
 * Updates a row by id in the given table.
 * @returns Number of rows changed
 */
export function updateRecord(table: string, id: string, data: RecordData): number {
  try {
    const db = openDatabase();
    const keys = Object.keys(data);
    const setClause = keys.map((k) => `${k} = ?`).join(', ');
    const values = [...Object.values(data), id];
    const result = db.runSync(
      `UPDATE ${table} SET ${setClause} WHERE id = ?`,
      values as SQLite.SQLiteBindValue[]
    );
    return result.changes;
  } catch (err) {
    console.error(`[SiteTrack DB] updateRecord(${table}, ${id}) error:`, err);
    return 0;
  }
}

/**
 * Soft-deletes by removing the row — sync queue handles remote deletion separately.
 * @returns Number of rows changed
 */
export function deleteRecord(table: string, id: string): number {
  try {
    const db = openDatabase();
    const result = db.runSync(`DELETE FROM ${table} WHERE id = ?`, [id]);
    return result.changes;
  } catch (err) {
    console.error(`[SiteTrack DB] deleteRecord(${table}, ${id}) error:`, err);
    return 0;
  }
}

/** Retrieves a single row by id, or null if not found */
export function getRecord<T = RecordData>(table: string, id: string): T | null {
  try {
    const db = openDatabase();
    const row = db.getFirstSync<T>(`SELECT * FROM ${table} WHERE id = ?`, [id]);
    return row ?? null;
  } catch (err) {
    console.error(`[SiteTrack DB] getRecord(${table}, ${id}) error:`, err);
    return null;
  }
}

/**
 * Queries multiple rows with optional equality filters.
 * filters: { column: value } — all joined with AND
 */
export function queryRecords<T = RecordData>(
  table: string,
  filters: RecordData = {}
): T[] {
  try {
    const db = openDatabase();
    const keys = Object.keys(filters);
    if (keys.length === 0) {
      return db.getAllSync<T>(`SELECT * FROM ${table}`);
    }
    const whereClause = keys.map((k) => `${k} = ?`).join(' AND ');
    const values = Object.values(filters);
    return db.getAllSync<T>(
      `SELECT * FROM ${table} WHERE ${whereClause}`,
      values as SQLite.SQLiteBindValue[]
    );
  } catch (err) {
    console.error(`[SiteTrack DB] queryRecords(${table}) error:`, err);
    return [];
  }
}

// ─────────────────────────────────────────────
// Domain-specific helpers
// ─────────────────────────────────────────────

/** Returns all non-cancelled jobs assigned to the given technician, ordered by scheduled date */
export function getJobsForTechnician<T = RecordData>(userId: string): T[] {
  try {
    const db = openDatabase();
    return db.getAllSync<T>(
      `SELECT j.*, p.name AS property_name, p.address AS property_address,
              p.suburb AS property_suburb, p.state AS property_state
       FROM jobs j
       LEFT JOIN properties p ON j.property_id = p.id
       WHERE j.assigned_to = ?
         AND j.status != 'cancelled'
       ORDER BY j.scheduled_date ASC, j.priority DESC`,
      [userId]
    );
  } catch (err) {
    console.error(`[SiteTrack DB] getJobsForTechnician(${userId}) error:`, err);
    return [];
  }
}

/** Returns all active assets for a given property */
export function getAssetsForProperty<T = RecordData>(propertyId: string): T[] {
  try {
    const db = openDatabase();
    return db.getAllSync<T>(
      `SELECT * FROM assets WHERE property_id = ? AND status = 'active' ORDER BY asset_type ASC`,
      [propertyId]
    );
  } catch (err) {
    console.error(`[SiteTrack DB] getAssetsForProperty(${propertyId}) error:`, err);
    return [];
  }
}

/** Returns all defects for a given job, ordered by severity (critical first) */
export function getDefectsForJob<T = RecordData>(jobId: string): T[] {
  try {
    const db = openDatabase();
    return db.getAllSync<T>(
      `SELECT d.*, a.asset_type, a.location_on_site
       FROM defects d
       LEFT JOIN assets a ON d.asset_id = a.id
       WHERE d.job_id = ?
       ORDER BY CASE d.severity
         WHEN 'critical' THEN 1
         WHEN 'major' THEN 2
         WHEN 'minor' THEN 3
         ELSE 4
       END ASC`,
      [jobId]
    );
  } catch (err) {
    console.error(`[SiteTrack DB] getDefectsForJob(${jobId}) error:`, err);
    return [];
  }
}

// ─────────────────────────────────────────────
// Sync queue helpers
// ─────────────────────────────────────────────

/** Adds a pending write operation to the local sync queue */
export function addToSyncQueue(
  tableName: string,
  recordId: string,
  operation: SyncOperation,
  payload: RecordData
): void {
  try {
    const db = openDatabase();
    db.runSync(
      `INSERT INTO sync_queue (table_name, record_id, operation, payload, synced)
       VALUES (?, ?, ?, ?, 0)`,
      [tableName, recordId, operation, JSON.stringify(payload)]
    );
  } catch (err) {
    console.error('[SiteTrack DB] addToSyncQueue error:', err);
  }
}

/** Returns all sync queue items that have not yet been pushed to Supabase */
export function getPendingSyncItems(): SyncQueueItem[] {
  try {
    const db = openDatabase();
    return db.getAllSync<SyncQueueItem>(
      `SELECT * FROM sync_queue WHERE synced = 0 ORDER BY created_at ASC`
    );
  } catch (err) {
    console.error('[SiteTrack DB] getPendingSyncItems error:', err);
    return [];
  }
}

/** Marks a sync queue item as successfully pushed to Supabase */
export function markSyncItemComplete(id: number): void {
  try {
    const db = openDatabase();
    db.runSync(`UPDATE sync_queue SET synced = 1 WHERE id = ?`, [id]);
  } catch (err) {
    console.error(`[SiteTrack DB] markSyncItemComplete(${id}) error:`, err);
  }
}

/**
 * Upserts a record — inserts if not exists, replaces if id already present.
 * Used by the sync service when pulling data from Supabase.
 */
export function upsertRecord(table: string, data: RecordData): void {
  try {
    const db = openDatabase();
    const keys = Object.keys(data);
    const placeholders = keys.map(() => '?').join(', ');
    const values = Object.values(data);
    db.runSync(
      `INSERT OR REPLACE INTO ${table} (${keys.join(', ')}) VALUES (${placeholders})`,
      values as SQLite.SQLiteBindValue[]
    );
  } catch (err) {
    console.error(`[SiteTrack DB] upsertRecord(${table}) error:`, err);
  }
}

// ─────────────────────────────────────────────
// Phase 3 — Extended query helpers
// ─────────────────────────────────────────────

/**
 * Returns a single job by id with a full property JOIN.
 * Includes access_notes, hazard_notes, contact details needed for job detail screen.
 */
export function getJobById<T = RecordData>(jobId: string): T | null {
  try {
    const db = openDatabase();
    return db.getFirstSync<T>(
      `SELECT j.*,
              p.name            AS property_name,
              p.address         AS property_address,
              p.suburb          AS property_suburb,
              p.state           AS property_state,
              p.postcode        AS property_postcode,
              p.site_contact_name,
              p.site_contact_phone,
              p.access_notes,
              p.hazard_notes,
              p.compliance_status AS property_compliance_status
       FROM jobs j
       LEFT JOIN properties p ON j.property_id = p.id
       WHERE j.id = ?`,
      [jobId]
    ) ?? null;
  } catch (err) {
    console.error(`[SiteTrack DB] getJobById(${jobId}) error:`, err);
    return null;
  }
}

/**
 * Returns all active assets for a property with their inspection result for
 * the given job (if the technician has already actioned them).
 */
export function getAssetsWithJobResults<T = RecordData>(
  jobId: string,
  propertyId: string
): T[] {
  try {
    const db = openDatabase();
    return db.getAllSync<T>(
      `SELECT a.*,
              ja.result,
              ja.technician_notes AS inspection_notes,
              ja.actioned_at
       FROM assets a
       LEFT JOIN job_assets ja ON a.id = ja.asset_id AND ja.job_id = ?
       WHERE a.property_id = ?
         AND a.status = 'active'
       ORDER BY a.asset_type ASC`,
      [jobId, propertyId]
    );
  } catch (err) {
    console.error(`[SiteTrack DB] getAssetsWithJobResults error:`, err);
    return [];
  }
}

/**
 * Returns recent jobs for a property (for property detail history section).
 * @param limit defaults to 5
 */
export function getJobsForProperty<T = RecordData>(
  propertyId: string,
  limit = 5
): T[] {
  try {
    const db = openDatabase();
    return db.getAllSync<T>(
      `SELECT j.*, u.full_name AS technician_name
       FROM jobs j
       LEFT JOIN users u ON j.assigned_to = u.id
       WHERE j.property_id = ?
       ORDER BY j.scheduled_date DESC, j.created_at DESC
       LIMIT ?`,
      [propertyId, limit]
    );
  } catch (err) {
    console.error(`[SiteTrack DB] getJobsForProperty(${propertyId}) error:`, err);
    return [];
  }
}

/** Returns all clock-in / clock-out records for a specific job */
export function getTimeLogsForJob<T = RecordData>(jobId: string): T[] {
  try {
    const db = openDatabase();
    return db.getAllSync<T>(
      `SELECT * FROM time_logs WHERE job_id = ? ORDER BY clock_in ASC`,
      [jobId]
    );
  } catch (err) {
    console.error(`[SiteTrack DB] getTimeLogsForJob(${jobId}) error:`, err);
    return [];
  }
}

/** Returns the client signature for a job, or null if not yet collected */
export function getSignatureForJob<T = RecordData>(jobId: string): T | null {
  try {
    const db = openDatabase();
    return db.getFirstSync<T>(
      `SELECT * FROM signatures WHERE job_id = ?`,
      [jobId]
    ) ?? null;
  } catch (err) {
    console.error(`[SiteTrack DB] getSignatureForJob(${jobId}) error:`, err);
    return null;
  }
}

/** Returns all inspection photos for a job, newest first */
export function getPhotosForJob<T = RecordData>(jobId: string): T[] {
  try {
    const db = openDatabase();
    return db.getAllSync<T>(
      `SELECT * FROM inspection_photos WHERE job_id = ? ORDER BY uploaded_at DESC`,
      [jobId]
    );
  } catch (err) {
    console.error(`[SiteTrack DB] getPhotosForJob(${jobId}) error:`, err);
    return [];
  }
}

/**
 * Returns service history for a single asset across all jobs.
 * @param limit defaults to 5
 */
export function getServiceHistoryForAsset<T = RecordData>(
  assetId: string,
  limit = 5
): T[] {
  try {
    const db = openDatabase();
    return db.getAllSync<T>(
      `SELECT ja.*, j.scheduled_date, j.job_type, j.status AS job_status,
              u.full_name AS technician_name
       FROM job_assets ja
       LEFT JOIN jobs j ON ja.job_id = j.id
       LEFT JOIN users u ON j.assigned_to = u.id
       WHERE ja.asset_id = ?
       ORDER BY j.scheduled_date DESC
       LIMIT ?`,
      [assetId, limit]
    );
  } catch (err) {
    console.error(`[SiteTrack DB] getServiceHistoryForAsset(${assetId}) error:`, err);
    return [];
  }
}

/** Returns all defects linked to a specific asset */
export function getDefectsForAsset<T = RecordData>(assetId: string): T[] {
  try {
    const db = openDatabase();
    return db.getAllSync<T>(
      `SELECT d.*, j.scheduled_date
       FROM defects d
       LEFT JOIN jobs j ON d.job_id = j.id
       WHERE d.asset_id = ?
       ORDER BY d.created_at DESC`,
      [assetId]
    );
  } catch (err) {
    console.error(`[SiteTrack DB] getDefectsForAsset(${assetId}) error:`, err);
    return [];
  }
}

