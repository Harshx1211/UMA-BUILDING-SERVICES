// Local SQLite database service — opens sitetrack.db and provides full CRUD + sync queue helpers
import { DB_NAME } from "@/constants/Config";
import { SyncOperation } from "@/constants/Enums";
import type { SyncQueueItem } from "@/types";
import * as SQLite from "expo-sqlite";

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
// Security: column name sanitisation
// Prevents SQL injection via attacker-controlled object keys passed
// into the generic CRUD helpers. Column names must be alphanumeric + underscores only.
// ─────────────────────────────────────────────

function _safeColumnName(col: string): string {
  if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(col)) {
    throw new Error(`[SiteTrack DB] Unsafe column name rejected: "${col}"`);
  }
  return col;
}

// ─────────────────────────────────────────────
// Schema version constants
// Increment CURRENT_SCHEMA_VERSION whenever you add a migration below.
// ─────────────────────────────────────────────

const CURRENT_SCHEMA_VERSION = 5;

// ─────────────────────────────────────────────
// Schema initialisation
// ─────────────────────────────────────────────

/**
 * Creates all local tables and runs any pending schema migrations.
 * Uses a versioned migration system so each migration runs exactly once.
 * Safe to call on every app start — will never drop existing data.
 */
export function initializeSchema(): void {
  const db = openDatabase();

  // ── Core tables (always idempotent) ──────────────────────────
  db.execSync(`
    PRAGMA journal_mode = WAL;
    PRAGMA foreign_keys = ON;

    CREATE TABLE IF NOT EXISTS meta (
      key   TEXT PRIMARY KEY NOT NULL,
      value TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS users (
      id         TEXT PRIMARY KEY NOT NULL,
      email      TEXT UNIQUE NOT NULL,
      full_name  TEXT NOT NULL,
      role       TEXT NOT NULL DEFAULT 'technician',
      phone      TEXT,
      avatar_url TEXT,
      push_token TEXT,
      is_active  INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS properties (
      id                 TEXT PRIMARY KEY NOT NULL,
      name               TEXT NOT NULL,
      address            TEXT,
      suburb             TEXT,
      state              TEXT,
      postcode           TEXT,
      site_contact_name  TEXT,
      site_contact_phone TEXT,
      access_notes       TEXT,
      hazard_notes       TEXT,
      compliance_status  TEXT NOT NULL DEFAULT 'pending',
      created_at         TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at         TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS assets (
      id                TEXT PRIMARY KEY NOT NULL,
      property_id       TEXT NOT NULL,
      asset_type        TEXT NOT NULL,
      variant           TEXT,
      asset_ref         TEXT,
      description       TEXT,
      location_on_site  TEXT,
      serial_number     TEXT,
      barcode_id        TEXT,
      install_date      TEXT,
      last_service_date TEXT,
      next_service_date TEXT,
      status            TEXT NOT NULL DEFAULT 'active',
      created_at        TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (property_id) REFERENCES properties(id)
    );

    CREATE TABLE IF NOT EXISTS jobs (
      id             TEXT PRIMARY KEY NOT NULL,
      property_id    TEXT NOT NULL,
      assigned_to    TEXT NOT NULL,
      job_type       TEXT NOT NULL,
      status         TEXT NOT NULL DEFAULT 'scheduled',
      scheduled_date TEXT NOT NULL,
      scheduled_time TEXT,
      priority       TEXT NOT NULL DEFAULT 'normal',
      notes          TEXT,
      created_at     TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at     TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (property_id) REFERENCES properties(id),
      FOREIGN KEY (assigned_to) REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS job_assets (
      id               TEXT PRIMARY KEY NOT NULL,
      job_id           TEXT NOT NULL,
      asset_id         TEXT NOT NULL,
      result           TEXT,
      checklist_data   TEXT,
      is_compliant     INTEGER NOT NULL DEFAULT 0,
      defect_reason    TEXT,
      technician_notes TEXT,
      actioned_at      TEXT,
      FOREIGN KEY (job_id)   REFERENCES jobs(id),
      FOREIGN KEY (asset_id) REFERENCES assets(id)
    );

    CREATE TABLE IF NOT EXISTS defects (
      id          TEXT PRIMARY KEY NOT NULL,
      job_id      TEXT NOT NULL,
      asset_id    TEXT NOT NULL,
      property_id TEXT NOT NULL,
      description TEXT NOT NULL,
      severity    TEXT NOT NULL,
      status      TEXT NOT NULL DEFAULT 'open',
      photos      TEXT NOT NULL DEFAULT '[]',
      created_at  TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (job_id)      REFERENCES jobs(id),
      FOREIGN KEY (asset_id)    REFERENCES assets(id),
      FOREIGN KEY (property_id) REFERENCES properties(id)
    );

    CREATE TABLE IF NOT EXISTS inspection_photos (
      id          TEXT PRIMARY KEY NOT NULL,
      job_id      TEXT NOT NULL,
      asset_id    TEXT,
      photo_url   TEXT NOT NULL,
      caption     TEXT,
      uploaded_at TEXT NOT NULL DEFAULT (datetime('now')),
      uploaded_by TEXT NOT NULL,
      FOREIGN KEY (job_id)      REFERENCES jobs(id),
      FOREIGN KEY (uploaded_by) REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS signatures (
      id             TEXT PRIMARY KEY NOT NULL,
      job_id         TEXT NOT NULL UNIQUE,
      signature_url  TEXT NOT NULL,
      signed_by_name TEXT NOT NULL,
      signed_at      TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (job_id) REFERENCES jobs(id)
    );

    CREATE TABLE IF NOT EXISTS time_logs (
      id                  TEXT PRIMARY KEY NOT NULL,
      job_id              TEXT NOT NULL,
      user_id             TEXT NOT NULL,
      clock_in            TEXT NOT NULL,
      clock_out           TEXT,
      gps_lat             REAL,
      gps_lng             REAL,
      travel_time_minutes INTEGER,
      FOREIGN KEY (job_id)  REFERENCES jobs(id),
      FOREIGN KEY (user_id) REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS sync_queue (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      table_name  TEXT NOT NULL,
      record_id   TEXT NOT NULL,
      operation   TEXT NOT NULL,
      payload     TEXT NOT NULL,
      synced      INTEGER NOT NULL DEFAULT 0,
      retry_count INTEGER NOT NULL DEFAULT 0,
      last_error  TEXT,
      created_at  TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS inventory_items (
      id          TEXT PRIMARY KEY NOT NULL,
      name        TEXT NOT NULL,
      description TEXT,
      price       REAL NOT NULL DEFAULT 0.0,
      created_at  TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS quotes (
      id           TEXT PRIMARY KEY NOT NULL,
      job_id       TEXT NOT NULL,
      status       TEXT NOT NULL DEFAULT 'draft',
      total_amount REAL NOT NULL DEFAULT 0.0,
      created_at   TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (job_id) REFERENCES jobs(id)
    );

    CREATE TABLE IF NOT EXISTS quote_items (
      id                TEXT PRIMARY KEY NOT NULL,
      quote_id          TEXT NOT NULL,
      inventory_item_id TEXT NOT NULL,
      defect_id         TEXT,
      quantity          INTEGER NOT NULL DEFAULT 1,
      unit_price        REAL NOT NULL DEFAULT 0.0,
      FOREIGN KEY (quote_id)          REFERENCES quotes(id),
      FOREIGN KEY (inventory_item_id) REFERENCES inventory_items(id)
    );

    CREATE TABLE IF NOT EXISTS notifications (
      id         TEXT PRIMARY KEY NOT NULL,
      type       TEXT NOT NULL DEFAULT 'general',
      title      TEXT NOT NULL,
      message    TEXT NOT NULL,
      job_id     TEXT,
      is_read    INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE INDEX IF NOT EXISTS idx_notifications_is_read ON notifications(is_read);
    CREATE INDEX IF NOT EXISTS idx_notifications_created  ON notifications(created_at DESC);
    CREATE INDEX IF NOT EXISTS idx_jobs_assigned_to       ON jobs(assigned_to);
    CREATE INDEX IF NOT EXISTS idx_jobs_status            ON jobs(status);
    CREATE INDEX IF NOT EXISTS idx_jobs_scheduled_date    ON jobs(scheduled_date);
    CREATE INDEX IF NOT EXISTS idx_assets_property_id     ON assets(property_id);
    CREATE INDEX IF NOT EXISTS idx_defects_job_id         ON defects(job_id);
    CREATE INDEX IF NOT EXISTS idx_sync_queue_synced       ON sync_queue(synced);
    CREATE INDEX IF NOT EXISTS idx_job_assets_asset_id    ON job_assets(asset_id);
  `);

  // ── Versioned migrations ───────────────────────────────────
  // Read current stored version (0 if meta table was just created)
  const versionRow = db.getFirstSync<{ value: string }>(
    `SELECT value FROM meta WHERE key = 'schema_version'`,
  );
  let currentVersion = versionRow ? parseInt(versionRow.value, 10) : 0;

  if (__DEV__)
    console.log(
      `[SiteTrack DB] Schema at version ${currentVersion}, target ${CURRENT_SCHEMA_VERSION}`,
    );

  // Migration 1: push_token column on users (was originally a try/catch hack)
  if (currentVersion < 1) {
    try {
      db.runSync("ALTER TABLE users ADD COLUMN push_token TEXT;");
      if (__DEV__)
        console.log("[SiteTrack DB] Migration 1: added users.push_token");
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      // Only ignore "already exists" errors — surface everything else
      if (!msg.includes("duplicate column")) {
        console.error("[SiteTrack DB] Migration 1 failed:", msg);
      }
    }
    currentVersion = 1;
    db.runSync(
      `INSERT OR REPLACE INTO meta (key, value) VALUES ('schema_version', '1')`,
    );
  }

  // Migration 2: checklist_data + is_compliant on job_assets
  if (currentVersion < 2) {
    try {
      db.runSync("ALTER TABLE job_assets ADD COLUMN checklist_data TEXT;");
      if (__DEV__)
        console.log(
          "[SiteTrack DB] Migration 2a: added job_assets.checklist_data",
        );
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      if (!msg.includes("duplicate column")) {
        console.error("[SiteTrack DB] Migration 2a failed:", msg);
      }
    }
    try {
      db.runSync(
        "ALTER TABLE job_assets ADD COLUMN is_compliant INTEGER NOT NULL DEFAULT 0;",
      );
      if (__DEV__)
        console.log(
          "[SiteTrack DB] Migration 2b: added job_assets.is_compliant",
        );
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      if (!msg.includes("duplicate column")) {
        console.error("[SiteTrack DB] Migration 2b failed:", msg);
      }
    }
    currentVersion = 2;
    db.runSync(
      `INSERT OR REPLACE INTO meta (key, value) VALUES ('schema_version', '2')`,
    );
  }

  // Migration 3: idx_job_assets_asset_id index for faster previous-result lookups
  if (currentVersion < 3) {
    try {
      db.runSync(
        "CREATE INDEX IF NOT EXISTS idx_job_assets_asset_id ON job_assets(asset_id);",
      );
      if (__DEV__)
        console.log(
          "[SiteTrack DB] Migration 3: added idx_job_assets_asset_id",
        );
    } catch (err: unknown) {
      console.error(
        "[SiteTrack DB] Migration 3 failed:",
        err instanceof Error ? err.message : String(err),
      );
    }
    currentVersion = 3;
    db.runSync(
      `INSERT OR REPLACE INTO meta (key, value) VALUES ('schema_version', '3')`,
    );
  }

  // Migration 4: retry_count + last_error on sync_queue for safe retry limiting
  if (currentVersion < 4) {
    try {
      db.runSync(
        "ALTER TABLE sync_queue ADD COLUMN retry_count INTEGER NOT NULL DEFAULT 0;",
      );
      if (__DEV__)
        console.log(
          "[SiteTrack DB] Migration 4a: added sync_queue.retry_count",
        );
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      if (!msg.includes("duplicate column")) {
        console.error("[SiteTrack DB] Migration 4a failed:", msg);
      }
    }
    try {
      db.runSync("ALTER TABLE sync_queue ADD COLUMN last_error TEXT;");
      if (__DEV__)
        console.log("[SiteTrack DB] Migration 4b: added sync_queue.last_error");
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      if (!msg.includes("duplicate column")) {
        console.error("[SiteTrack DB] Migration 4b failed:", msg);
      }
    }
    currentVersion = 4;
    db.runSync(
      `INSERT OR REPLACE INTO meta (key, value) VALUES ('schema_version', '4')`,
    );
  }

  // Migration 5: variant + asset_ref columns on assets table
  if (currentVersion < 5) {
    try {
      db.runSync("ALTER TABLE assets ADD COLUMN variant TEXT;");
      if (__DEV__)
        console.log("[SiteTrack DB] Migration 5a: added assets.variant");
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      if (!msg.includes("duplicate column")) {
        console.error("[SiteTrack DB] Migration 5a failed:", msg);
      }
    }
    try {
      db.runSync("ALTER TABLE assets ADD COLUMN asset_ref TEXT;");
      if (__DEV__)
        console.log("[SiteTrack DB] Migration 5b: added assets.asset_ref");
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      if (!msg.includes("duplicate column")) {
        console.error("[SiteTrack DB] Migration 5b failed:", msg);
      }
    }
    currentVersion = 5;
    db.runSync(
      `INSERT OR REPLACE INTO meta (key, value) VALUES ('schema_version', '5')`,
    );
  }

  if (__DEV__)
    console.log(
      `[SiteTrack DB] Schema initialised at version ${currentVersion}`,
    );
}

// ─────────────────────────────────────────────
// Generic CRUD helpers
// ─────────────────────────────────────────────

type RecordData = Record<string, string | number | boolean | null>;

/**
 * Inserts a new row into the given table.
 * Column names are validated to prevent SQL injection.
 * @returns The inserted row id or null on failure
 */
export function insertRecord(table: string, data: RecordData): number | null {
  try {
    const db = openDatabase();
    const keys = Object.keys(data).map(_safeColumnName);
    const placeholders = keys.map(() => "?").join(", ");
    const values = Object.values(data);
    const result = db.runSync(
      `INSERT INTO ${_safeColumnName(table)} (${keys.join(", ")}) VALUES (${placeholders})`,
      values as SQLite.SQLiteBindValue[],
    );
    return result.lastInsertRowId;
  } catch (err) {
    console.error(`[SiteTrack DB] insertRecord(${table}) error:`, err);
    return null;
  }
}

/**
 * Updates a row by id in the given table.
 * Column names are validated to prevent SQL injection.
 * @returns Number of rows changed
 */
export function updateRecord(
  table: string,
  id: string,
  data: RecordData,
): number {
  try {
    const db = openDatabase();
    const keys = Object.keys(data).map(_safeColumnName);
    const setClause = keys.map((k) => `${k} = ?`).join(", ");
    const values = [...Object.values(data), id];
    const result = db.runSync(
      `UPDATE ${_safeColumnName(table)} SET ${setClause} WHERE id = ?`,
      values as SQLite.SQLiteBindValue[],
    );
    return result.changes;
  } catch (err) {
    console.error(`[SiteTrack DB] updateRecord(${table}, ${id}) error:`, err);
    return 0;
  }
}

/**
 * Deletes a row by id — sync queue handles remote deletion separately.
 * @returns Number of rows changed
 */
export function deleteRecord(table: string, id: string): number {
  try {
    const db = openDatabase();
    const result = db.runSync(
      `DELETE FROM ${_safeColumnName(table)} WHERE id = ?`,
      [id],
    );
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
    const row = db.getFirstSync<T>(
      `SELECT * FROM ${_safeColumnName(table)} WHERE id = ?`,
      [id],
    );
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
  filters: RecordData = {},
): T[] {
  try {
    const db = openDatabase();
    const keys = Object.keys(filters).map(_safeColumnName);
    if (keys.length === 0) {
      return db.getAllSync<T>(`SELECT * FROM ${_safeColumnName(table)}`);
    }
    const whereClause = keys.map((k) => `${k} = ?`).join(" AND ");
    const values = Object.values(filters);
    return db.getAllSync<T>(
      `SELECT * FROM ${_safeColumnName(table)} WHERE ${whereClause}`,
      values as SQLite.SQLiteBindValue[],
    );
  } catch (err) {
    console.error(`[SiteTrack DB] queryRecords(${table}) error:`, err);
    return [];
  }
}

/**
 * Queries rows where a column's value is IN the provided array.
 * Used for efficient batch lookups (e.g. previous inspection results for a set of assets).
 */
export function queryRecordsIn<T = RecordData>(
  table: string,
  column: string,
  ids: string[],
): T[] {
  if (ids.length === 0) return [];
  try {
    const db = openDatabase();
    const safeTable = _safeColumnName(table);
    const safeCol = _safeColumnName(column);
    const placeholders = ids.map(() => "?").join(", ");
    return db.getAllSync<T>(
      `SELECT * FROM ${safeTable} WHERE ${safeCol} IN (${placeholders})`,
      ids as SQLite.SQLiteBindValue[],
    );
  } catch (err) {
    console.error(`[SiteTrack DB] queryRecordsIn(${table}) error:`, err);
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
              p.suburb AS property_suburb, p.state AS property_state,
              p.postcode AS property_postcode,
              p.compliance_status AS property_compliance_status,
              p.site_contact_name, p.site_contact_phone,
              p.access_notes, p.hazard_notes
       FROM jobs j
       LEFT JOIN properties p ON j.property_id = p.id
       WHERE j.assigned_to = ?
         AND j.status != 'cancelled'
       ORDER BY j.scheduled_date ASC, j.priority DESC`,
      [userId],
    );
  } catch (err) {
    console.error(`[SiteTrack DB] getJobsForTechnician(${userId}) error:`, err);
    return [];
  }
}

/** Removes sync queue items older than 7 days that have already been synced */
export function cleanOldSyncQueueItems(): void {
  try {
    const db = openDatabase();
    db.runSync(
      `DELETE FROM sync_queue WHERE synced = 1 AND created_at < datetime('now', '-7 days')`,
    );
  } catch (err) {
    console.error("[SiteTrack DB] cleanOldSyncQueueItems error:", err);
  }
}

/** Clears failed/stuck items from the sync queue for a specific table */
export function clearFailedSyncItems(tableName: string): void {
  try {
    const db = openDatabase();
    db.runSync(`DELETE FROM sync_queue WHERE table_name = ? AND synced = 0`, [
      tableName,
    ]);
    if (__DEV__)
      console.log(
        `[SiteTrack DB] Cleared failed sync queue items for table: ${tableName}`,
      );
  } catch (err) {
    console.error(`[SiteTrack DB] clearFailedSyncItems error:`, err);
  }
}

/** Returns all active assets for a given property */
export function getAssetsForProperty<T = RecordData>(propertyId: string): T[] {
  try {
    const db = openDatabase();
    return db.getAllSync<T>(
      `SELECT * FROM assets WHERE property_id = ? AND status = 'active' ORDER BY asset_type ASC`,
      [propertyId],
    );
  } catch (err) {
    console.error(
      `[SiteTrack DB] getAssetsForProperty(${propertyId}) error:`,
      err,
    );
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
      [jobId],
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
  payload: RecordData,
): void {
  try {
    const db = openDatabase();
    db.runSync(
      `INSERT INTO sync_queue (table_name, record_id, operation, payload, synced, retry_count)
       VALUES (?, ?, ?, ?, 0, 0)`,
      [tableName, recordId, operation, JSON.stringify(payload)],
    );
  } catch (err) {
    console.error("[SiteTrack DB] addToSyncQueue error:", err);
  }
}

/** Returns all sync queue items not yet pushed to Supabase and below the retry limit */
export function getPendingSyncItems(): SyncQueueItem[] {
  try {
    const db = openDatabase();
    return db.getAllSync<SyncQueueItem>(
      `SELECT * FROM sync_queue WHERE synced = 0 ORDER BY created_at ASC`,
    );
  } catch (err) {
    console.error("[SiteTrack DB] getPendingSyncItems error:", err);
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
 * Increments the retry_count for a failed sync item and records the error message.
 * After MAX_SYNC_RETRIES failures, the item is marked synced = -1 (permanently failed).
 */
export function incrementSyncRetry(
  id: number,
  errorMessage: string,
  maxRetries = 5,
): void {
  try {
    const db = openDatabase();
    const item = db.getFirstSync<{ retry_count: number }>(
      `SELECT retry_count FROM sync_queue WHERE id = ?`,
      [id],
    );
    if (!item) return;

    const newCount = (item.retry_count ?? 0) + 1;
    if (newCount >= maxRetries) {
      // Permanently mark as failed — will not be retried
      db.runSync(
        `UPDATE sync_queue SET retry_count = ?, last_error = ?, synced = -1 WHERE id = ?`,
        [newCount, errorMessage, id],
      );
      console.warn(
        `[SiteTrack DB] Sync item ${id} permanently failed after ${newCount} retries: ${errorMessage}`,
      );
    } else {
      db.runSync(
        `UPDATE sync_queue SET retry_count = ?, last_error = ? WHERE id = ?`,
        [newCount, errorMessage, id],
      );
    }
  } catch (err) {
    console.error(`[SiteTrack DB] incrementSyncRetry(${id}) error:`, err);
  }
}

/**
 * Upserts a record — inserts if not exists, updates in-place if id already present.
 * Uses SQLite ON CONFLICT DO UPDATE to avoid destroying FK child rows (unlike INSERT OR REPLACE).
 * Used by the sync service when pulling data from Supabase.
 */
export function upsertRecord(table: string, data: RecordData): void {
  try {
    const db = openDatabase();
    const safeTable = _safeColumnName(table);
    const keys = Object.keys(data).map(_safeColumnName);
    const placeholders = keys.map(() => "?").join(", ");
    const values = Object.values(data);

    // Build SET clause — exclude 'id' since you cannot update a primary key
    const setClauses = keys
      .filter((k) => k !== "id")
      .map((k) => `${k} = excluded.${k}`)
      .join(", ");

    if (setClauses.length === 0) {
      // Only column is 'id' — just try to insert, ignore if duplicate
      db.runSync(
        `INSERT OR IGNORE INTO ${safeTable} (${keys.join(", ")}) VALUES (${placeholders})`,
        values as SQLite.SQLiteBindValue[],
      );
    } else {
      db.runSync(
        `INSERT INTO ${safeTable} (${keys.join(", ")}) VALUES (${placeholders})
         ON CONFLICT(id) DO UPDATE SET ${setClauses}`,
        values as SQLite.SQLiteBindValue[],
      );
    }
  } catch (err) {
    console.error(`[SiteTrack DB] upsertRecord(${table}) error:`, err);
  }
}

// ─────────────────────────────────────────────
// Extended query helpers
// ─────────────────────────────────────────────

/**
 * Returns a single job by id with a full property JOIN.
 * Includes access_notes, hazard_notes, contact details needed for job detail screen.
 */
export function getJobById<T = RecordData>(jobId: string): T | null {
  try {
    const db = openDatabase();
    return (
      db.getFirstSync<T>(
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
        [jobId],
      ) ?? null
    );
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
  propertyId: string,
): T[] {
  try {
    const db = openDatabase();
    return db.getAllSync<T>(
      `SELECT a.*,
              ja.result,
              ja.defect_reason,
              ja.technician_notes,
              ja.technician_notes  AS inspection_notes,
              ja.checklist_data,
              ja.is_compliant,
              ja.actioned_at
       FROM assets a
       LEFT JOIN job_assets ja ON a.id = ja.asset_id AND ja.job_id = ?
       WHERE a.property_id = ?
         AND a.status = 'active'
       ORDER BY a.asset_type ASC`,
      [jobId, propertyId],
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
  limit = 5,
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
      [propertyId, limit],
    );
  } catch (err) {
    console.error(
      `[SiteTrack DB] getJobsForProperty(${propertyId}) error:`,
      err,
    );
    return [];
  }
}

/** Returns all clock-in / clock-out records for a specific job */
export function getTimeLogsForJob<T = RecordData>(jobId: string): T[] {
  try {
    const db = openDatabase();
    return db.getAllSync<T>(
      `SELECT * FROM time_logs WHERE job_id = ? ORDER BY clock_in ASC`,
      [jobId],
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
    return (
      db.getFirstSync<T>(`SELECT * FROM signatures WHERE job_id = ?`, [
        jobId,
      ]) ?? null
    );
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
      [jobId],
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
  limit = 5,
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
      [assetId, limit],
    );
  } catch (err) {
    console.error(
      `[SiteTrack DB] getServiceHistoryForAsset(${assetId}) error:`,
      err,
    );
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
      [assetId],
    );
  } catch (err) {
    console.error(`[SiteTrack DB] getDefectsForAsset(${assetId}) error:`, err);
    return [];
  }
}
