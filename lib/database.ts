// Local SQLite database service — opens uma-building-services.db and provides full CRUD + sync queue helpers
import { DB_NAME } from "@/constants/Config";
import { SyncOperation } from "@/constants/Enums";
import type { SyncQueueItem } from "@/types";
import * as SQLite from "expo-sqlite";
import { DEFECT_CODES } from "@/constants/DefectCodes";
import { generateUUID } from "@/utils/uuid";
// ─────────────────────────────────────────────
// Database connection
// ─────────────────────────────────────────────

let _db: SQLite.SQLiteDatabase | null = null;

/** Opens (or creates) uma-building-services.db — call once at app startup */
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
    throw new Error(`[UMA BUILDING SERVICES DB] Unsafe column name rejected: "${col}"`);
  }
  return col;
}

// ─────────────────────────────────────────────
// Schema version constants
// Increment CURRENT_SCHEMA_VERSION whenever you add a migration below.
// ─────────────────────────────────────────────

const CURRENT_SCHEMA_VERSION = 34;

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
      company_id TEXT,
      email      TEXT UNIQUE NOT NULL,
      full_name  TEXT NOT NULL,
      role                 TEXT NOT NULL DEFAULT 'technician',
      phone                TEXT,
      avatar_url           TEXT,
      push_token           TEXT,
      is_active            INTEGER NOT NULL DEFAULT 1,
      fpas_number          TEXT,
      fpas_class           TEXT,
      fpas_expiry          TEXT,
      state_license        TEXT,
      state_license_expiry TEXT,
      accepted_tos_at      TEXT,
      accepted_aup_at      TEXT,
      created_at           TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS companies (
      id                  TEXT PRIMARY KEY NOT NULL,
      name                TEXT NOT NULL,
      abn                 TEXT,
      contact_email       TEXT,
      phone               TEXT,
      website              TEXT,
      address              TEXT,
      logo_url             TEXT,
      subscription_status  TEXT NOT NULL DEFAULT 'active',
      notification_settings TEXT,
      compliance_standards TEXT,
      appearance_settings  TEXT,
      created_at           TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at           TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS properties (
      id                 TEXT PRIMARY KEY NOT NULL,
      company_id         TEXT,
      name               TEXT NOT NULL,
      address            TEXT,
      suburb             TEXT,
      state              TEXT,
      postcode           TEXT,
      site_contact_name  TEXT,
      site_contact_phone TEXT,
      access_notes       TEXT,
      hazard_notes       TEXT,
      site_note          TEXT,
      compliance_status  TEXT NOT NULL DEFAULT 'pending',
      next_inspection_date TEXT,
      created_at         TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at         TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS assets (
      id                TEXT PRIMARY KEY NOT NULL,
      company_id        TEXT,
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
      company_id     TEXT,
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
      report_url     TEXT,
      FOREIGN KEY (property_id) REFERENCES properties(id),
      FOREIGN KEY (assigned_to) REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS job_technicians (
      id         TEXT PRIMARY KEY NOT NULL,
      company_id TEXT,
      job_id     TEXT NOT NULL,
      user_id    TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (job_id)  REFERENCES jobs(id),
      FOREIGN KEY (user_id) REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS job_assets (
      id               TEXT PRIMARY KEY NOT NULL,
      company_id       TEXT,
      job_id           TEXT NOT NULL,
      asset_id         TEXT NOT NULL,
      result           TEXT,
      checklist_data   TEXT,
      is_compliant     INTEGER NOT NULL DEFAULT 0,
      defect_reason    TEXT,
      technician_notes TEXT,
      actioned_at      TEXT,
      actioned_by      TEXT,
      FOREIGN KEY (job_id)   REFERENCES jobs(id),
      FOREIGN KEY (asset_id) REFERENCES assets(id),
      FOREIGN KEY (actioned_by) REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS defects (
      id          TEXT PRIMARY KEY NOT NULL,
      company_id  TEXT,
      job_id      TEXT NOT NULL,
      asset_id    TEXT NOT NULL,
      property_id TEXT NOT NULL,
      description TEXT NOT NULL,
      severity    TEXT NOT NULL,
      status      TEXT NOT NULL DEFAULT 'open',
      photos      TEXT NOT NULL DEFAULT '[]',
      created_at  TEXT NOT NULL DEFAULT (datetime('now')),
      defect_code TEXT,
      quote_price REAL,
      FOREIGN KEY (job_id)      REFERENCES jobs(id),
      FOREIGN KEY (asset_id)    REFERENCES assets(id),
      FOREIGN KEY (property_id) REFERENCES properties(id)
    );

    CREATE TABLE IF NOT EXISTS inspection_photos (
      id          TEXT PRIMARY KEY NOT NULL,
      company_id  TEXT,
      job_id      TEXT NOT NULL,
      asset_id    TEXT,
      photo_url   TEXT NOT NULL,
      caption     TEXT,
      uploaded_at TEXT NOT NULL DEFAULT (datetime('now')),
      uploaded_by TEXT NOT NULL,
      defect_id   TEXT,
      FOREIGN KEY (job_id)      REFERENCES jobs(id),
      FOREIGN KEY (uploaded_by) REFERENCES users(id),
      FOREIGN KEY (defect_id)   REFERENCES defects(id)
    );

    CREATE TABLE IF NOT EXISTS signatures (
      id                  TEXT PRIMARY KEY NOT NULL,
      company_id          TEXT,
      job_id              TEXT NOT NULL UNIQUE,
      signature_url       TEXT NOT NULL,
      tech_signature_url  TEXT,
      signed_by_name      TEXT NOT NULL,
      signed_at           TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (job_id) REFERENCES jobs(id)
    );

    CREATE TABLE IF NOT EXISTS time_logs (
      id                  TEXT PRIMARY KEY NOT NULL,
      company_id          TEXT,
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
      id            INTEGER PRIMARY KEY AUTOINCREMENT,
      table_name    TEXT NOT NULL,
      record_id     TEXT NOT NULL,
      operation     TEXT NOT NULL,
      payload       TEXT NOT NULL,
      synced        INTEGER NOT NULL DEFAULT 0,
      retry_count   INTEGER NOT NULL DEFAULT 0,
      last_error    TEXT,
      next_retry_at TEXT,
      is_terminal   INTEGER NOT NULL DEFAULT 0,
      created_at    TEXT NOT NULL DEFAULT (datetime('now'))
    );

    -- Tombstone table: permanently records photo IDs that the technician has deleted.
    -- Used by the sync pull to prevent Supabase from re-inserting deleted photos
    -- even when the remote delete is still pending, failed, or retrying.
    CREATE TABLE IF NOT EXISTS deleted_photo_ids (
      id         TEXT PRIMARY KEY NOT NULL,
      deleted_at TEXT NOT NULL DEFAULT (datetime('now'))
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
      inventory_item_id TEXT,           -- nullable: supports custom line items with item_name
      defect_id         TEXT,
      quantity          INTEGER NOT NULL DEFAULT 1,
      unit_price        REAL NOT NULL DEFAULT 0.0,
      item_name         TEXT,
      FOREIGN KEY (quote_id)          REFERENCES quotes(id),
      FOREIGN KEY (inventory_item_id) REFERENCES inventory_items(id)
    );

    CREATE TABLE IF NOT EXISTS notifications (
      id         TEXT PRIMARY KEY NOT NULL,
      type       TEXT NOT NULL DEFAULT 'general',
      title      TEXT NOT NULL,
      message    TEXT NOT NULL,
      job_id     TEXT,
      user_id    TEXT,           -- which technician this notification is for
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

    CREATE TABLE IF NOT EXISTS asset_type_definitions (
      id                 TEXT    PRIMARY KEY NOT NULL,
      value              TEXT    NOT NULL,
      label              TEXT    NOT NULL,
      full_label         TEXT    NOT NULL,
      icon               TEXT    NOT NULL DEFAULT 'shield-check-outline',
      color              TEXT    NOT NULL DEFAULT '#6B7280',
      inspection_routine TEXT    NOT NULL DEFAULT '',
      variants           TEXT    NOT NULL DEFAULT '[]',
      is_active          INTEGER NOT NULL DEFAULT 1,
      sort_order         INTEGER NOT NULL DEFAULT 0,
      created_at         TEXT    NOT NULL DEFAULT (datetime('now')),
      updated_at         TEXT    NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS defect_codes (
      id          TEXT    PRIMARY KEY NOT NULL,
      code        TEXT    NOT NULL,
      description TEXT    NOT NULL,
      quote_price REAL,
      category    TEXT    NOT NULL DEFAULT 'General',
      is_active   INTEGER NOT NULL DEFAULT 1,
      sort_order  INTEGER NOT NULL DEFAULT 0,
      created_at  TEXT    NOT NULL DEFAULT (datetime('now'))
    );
  `);

  // ── Versioned migrations ───────────────────────────────────
  // Read current stored version (0 if meta table was just created)
  const versionRow = db.getFirstSync<{ value: string }>(
    `SELECT value FROM meta WHERE key = 'schema_version'`,
  );
  let currentVersion = versionRow ? parseInt(versionRow.value, 10) : 0;

  if (__DEV__)
    console.log(
      `[UMA BUILDING SERVICES DB] Schema at version ${currentVersion}, target ${CURRENT_SCHEMA_VERSION}`,
    );

  // Migration 1: push_token column on users (was originally a try/catch hack)
  if (currentVersion < 1) {
    try {
      db.runSync("ALTER TABLE users ADD COLUMN push_token TEXT;");
      if (__DEV__)
        console.log("[UMA BUILDING SERVICES DB] Migration 1: added users.push_token");
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      // Only ignore "already exists" errors — surface everything else
      if (!msg.includes("duplicate column")) {
        console.error("[UMA BUILDING SERVICES DB] Migration 1 failed:", msg);
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
          "[UMA BUILDING SERVICES DB] Migration 2a: added job_assets.checklist_data",
        );
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      if (!msg.includes("duplicate column")) {
        console.error("[UMA BUILDING SERVICES DB] Migration 2a failed:", msg);
      }
    }
    try {
      db.runSync(
        "ALTER TABLE job_assets ADD COLUMN is_compliant INTEGER NOT NULL DEFAULT 0;",
      );
      if (__DEV__)
        console.log(
          "[UMA BUILDING SERVICES DB] Migration 2b: added job_assets.is_compliant",
        );
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      if (!msg.includes("duplicate column")) {
        console.error("[UMA BUILDING SERVICES DB] Migration 2b failed:", msg);
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
          "[UMA BUILDING SERVICES DB] Migration 3: added idx_job_assets_asset_id",
        );
    } catch (err: unknown) {
      console.error(
        "[UMA BUILDING SERVICES DB] Migration 3 failed:",
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
          "[UMA BUILDING SERVICES DB] Migration 4a: added sync_queue.retry_count",
        );
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      if (!msg.includes("duplicate column")) {
        console.error("[UMA BUILDING SERVICES DB] Migration 4a failed:", msg);
      }
    }
    try {
      db.runSync("ALTER TABLE sync_queue ADD COLUMN last_error TEXT;");
      if (__DEV__)
        console.log("[UMA BUILDING SERVICES DB] Migration 4b: added sync_queue.last_error");
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      if (!msg.includes("duplicate column")) {
        console.error("[UMA BUILDING SERVICES DB] Migration 4b failed:", msg);
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
        console.log("[UMA BUILDING SERVICES DB] Migration 5a: added assets.variant");
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      if (!msg.includes("duplicate column")) {
        console.error("[UMA BUILDING SERVICES DB] Migration 5a failed:", msg);
      }
    }
    try {
      db.runSync("ALTER TABLE assets ADD COLUMN asset_ref TEXT;");
      if (__DEV__)
        console.log("[UMA BUILDING SERVICES DB] Migration 5b: added assets.asset_ref");
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      if (!msg.includes("duplicate column")) {
        console.error("[UMA BUILDING SERVICES DB] Migration 5b failed:", msg);
      }
    }
    currentVersion = 5;
    db.runSync(
      `INSERT OR REPLACE INTO meta (key, value) VALUES ('schema_version', '5')`,
    );
  }

  // Migration 6: defect_code + quote_price on defects table (Uptick code library integration)
  if (currentVersion < 6) {
    try {
      db.runSync("ALTER TABLE defects ADD COLUMN defect_code TEXT;");
      if (__DEV__)
        console.log("[UMA BUILDING SERVICES DB] Migration 6a: added defects.defect_code");
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      if (!msg.includes("duplicate column")) {
        console.error("[UMA BUILDING SERVICES DB] Migration 6a failed:", msg);
      }
    }
    try {
      db.runSync("ALTER TABLE defects ADD COLUMN quote_price REAL;");
      if (__DEV__)
        console.log("[UMA BUILDING SERVICES DB] Migration 6b: added defects.quote_price");
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      if (!msg.includes("duplicate column")) {
        console.error("[UMA BUILDING SERVICES DB] Migration 6b failed:", msg);
      }
    }
    // Also add item_name to quote_items to support custom (non-inventory) line items
    try {
      db.runSync("ALTER TABLE quote_items ADD COLUMN item_name TEXT;");
      if (__DEV__)
        console.log("[UMA BUILDING SERVICES DB] Migration 6c: added quote_items.item_name");
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      if (!msg.includes("duplicate column")) {
        console.error("[UMA BUILDING SERVICES DB] Migration 6c failed:", msg);
      }
    }
    currentVersion = 6;
    db.runSync(
      `INSERT OR REPLACE INTO meta (key, value) VALUES ('schema_version', '6')`,
    );
  }

  // Migration 7: Normalise defect photos into inspection_photos
  if (currentVersion < 7) {
    try {
      db.runSync("ALTER TABLE inspection_photos ADD COLUMN defect_id TEXT;");
      if (__DEV__)
        console.log("[UMA BUILDING SERVICES DB] Migration 7: added inspection_photos.defect_id");
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      if (!msg.includes("duplicate column")) {
        console.error("[UMA BUILDING SERVICES DB] Migration 7 failed:", msg);
      }
    }
    currentVersion = 7;
    db.runSync(
      `INSERT OR REPLACE INTO meta (key, value) VALUES ('schema_version', '7')`,
    );
  }

  // Migration 8: asset_type_definitions + defect_codes local cache tables
  if (currentVersion < 8) {
    // Tables created idempotently above in the core block — just bump the version.
    currentVersion = 8;
    db.runSync(
      `INSERT OR REPLACE INTO meta (key, value) VALUES ('schema_version', '8')`,
    );
    if (__DEV__) console.log('[UMA BUILDING SERVICES DB] Migration 8: catalogue cache tables ready');
  }

  // Migration 9: report_url column on jobs table
  if (currentVersion < 9) {
    try {
      db.runSync("ALTER TABLE jobs ADD COLUMN report_url TEXT;");
      if (__DEV__)
        console.log("[UMA BUILDING SERVICES DB] Migration 9: added jobs.report_url");
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      if (!msg.includes("duplicate column")) {
        console.error("[UMA BUILDING SERVICES DB] Migration 9 failed:", msg);
      }
    }
    currentVersion = 9;
    db.runSync(
      `INSERT OR REPLACE INTO meta (key, value) VALUES ('schema_version', '9')`,
    );
  }

  // Migration 10: deleted_photo_ids tombstone table + retry reset for previously-blocked deletes
  if (currentVersion < 10) {
    // 10a — Create the permanent tombstone table
    try {
      db.runSync(`
        CREATE TABLE IF NOT EXISTS deleted_photo_ids (
          id         TEXT PRIMARY KEY NOT NULL,
          deleted_at TEXT NOT NULL DEFAULT (datetime('now'))
        );
      `);
      if (__DEV__)
        console.log('[UMA BUILDING SERVICES DB] Migration 10a: created deleted_photo_ids tombstone table');
    } catch (err: unknown) {
      console.error('[UMA BUILDING SERVICES DB] Migration 10a failed:', err instanceof Error ? err.message : String(err));
    }

    // 10b — Reset permanently-failed photo delete operations so they are retried.
    // These items previously exhausted their retry limit because Supabase was blocking
    // them with a missing RLS DELETE policy.  Now that the policy exists, resetting
    // synced=0 and retry_count=0 lets the next sync push the deletes successfully.
    try {
      const result = db.runSync(
        `UPDATE sync_queue
         SET synced = 0, retry_count = 0, last_error = NULL
         WHERE table_name = 'inspection_photos'
           AND operation  = 'delete'
           AND synced     = -1`,
      );
      if (__DEV__ && result.changes > 0)
        console.log(`[UMA BUILDING SERVICES DB] Migration 10b: reset ${result.changes} permanently-failed photo delete(s) for retry`);
    } catch (err: unknown) {
      console.error('[UMA BUILDING SERVICES DB] Migration 10b failed:', err instanceof Error ? err.message : String(err));
    }

    currentVersion = 10;
    db.runSync(`INSERT OR REPLACE INTO meta (key, value) VALUES ('schema_version', '10')`);
  }

  // Migration 11: next_inspection_date on properties table
  if (currentVersion < 11) {
    try {
      db.runSync("ALTER TABLE properties ADD COLUMN next_inspection_date TEXT;");
      if (__DEV__)
        console.log("[UMA BUILDING SERVICES DB] Migration 11: added properties.next_inspection_date");
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      if (!msg.includes("duplicate column")) {
        console.error("[UMA BUILDING SERVICES DB] Migration 11 failed:", msg);
      }
    }
    currentVersion = 11;
    db.runSync(
      `INSERT OR REPLACE INTO meta (key, value) VALUES ('schema_version', '11')`,
    );
  }

  // Migration 12: site_note on properties table
  if (currentVersion < 12) {
    try {
      db.runSync("ALTER TABLE properties ADD COLUMN site_note TEXT;");
      if (__DEV__)
        console.log("[UMA BUILDING SERVICES DB] Migration 12: added properties.site_note");
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      if (!msg.includes("duplicate column")) {
        console.error("[UMA BUILDING SERVICES DB] Migration 12 failed:", msg);
      }
    }
    currentVersion = 12;
    db.runSync(
      `INSERT OR REPLACE INTO meta (key, value) VALUES ('schema_version', '12')`,
    );
  }

  // Migration 13: make inspection_photos.uploaded_by nullable.
  // SQLite cannot ALTER COLUMN, so we use the table-rename pattern inside a transaction.
  // This is needed because PhotoCaptureSheet now correctly sends null instead of 'unknown'
  // when no user session is available (edge case — the UI also guards against this).
  if (currentVersion < 13) {
    try {
      db.execSync(`
        PRAGMA foreign_keys = OFF;
        BEGIN TRANSACTION;

        CREATE TABLE IF NOT EXISTS inspection_photos_v13 (
          id          TEXT PRIMARY KEY NOT NULL,
          job_id      TEXT NOT NULL,
          asset_id    TEXT,
          photo_url   TEXT NOT NULL,
          caption     TEXT,
          uploaded_at TEXT NOT NULL DEFAULT (datetime('now')),
          uploaded_by TEXT,
          defect_id   TEXT,
          FOREIGN KEY (job_id)    REFERENCES jobs(id),
          FOREIGN KEY (defect_id) REFERENCES defects(id)
        );

        INSERT INTO inspection_photos_v13
          SELECT id, job_id, asset_id, photo_url, caption, uploaded_at, uploaded_by, defect_id
          FROM inspection_photos;

        DROP TABLE inspection_photos;

        ALTER TABLE inspection_photos_v13 RENAME TO inspection_photos;

        COMMIT;
        PRAGMA foreign_keys = ON;
      `);
      if (__DEV__)
        console.log('[UMA BUILDING SERVICES DB] Migration 13: inspection_photos.uploaded_by is now nullable');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error('[UMA BUILDING SERVICES DB] Migration 13 failed:', msg);
    }
    currentVersion = 13;
    db.runSync(`INSERT OR REPLACE INTO meta (key, value) VALUES ('schema_version', '13')`);
  }

  // Migration 14: batch of schema alignment fixes
  //   14a — quote_items.inventory_item_id: make nullable (supports custom line items)
  //   14b — notifications: add user_id column (aligns with Supabase schema)
  //   14c — asset_type_definitions: add updated_at column
  if (currentVersion < 14) {
    // 14a: SQLite cannot change NOT NULL without table rebuild — inventory_item_id was
    // already nullable in practice (INSERT OR REPLACE always worked), so this is a
    // documentation-only fix in the CREATE TABLE above. No ALTER needed.

    // 14b: notifications.user_id
    try {
      db.runSync('ALTER TABLE notifications ADD COLUMN user_id TEXT;');
      if (__DEV__)
        console.log('[UMA BUILDING SERVICES DB] Migration 14b: added notifications.user_id');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      if (!msg.includes('duplicate column'))
        console.error('[UMA BUILDING SERVICES DB] Migration 14b failed:', msg);
    }

    // 14c: asset_type_definitions.updated_at
    try {
      db.runSync("ALTER TABLE asset_type_definitions ADD COLUMN updated_at TEXT NOT NULL DEFAULT (datetime('now'));");
      if (__DEV__)
        console.log('[UMA BUILDING SERVICES DB] Migration 14c: added asset_type_definitions.updated_at');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      if (!msg.includes('duplicate column'))
        console.error('[UMA BUILDING SERVICES DB] Migration 14c failed:', msg);
    }

    currentVersion = 14;
    db.runSync(`INSERT OR REPLACE INTO meta (key, value) VALUES ('schema_version', '14')`);
    if (__DEV__) console.log('[UMA BUILDING SERVICES DB] Migration 14: schema alignment complete');
  }

  // Migration 15: SaaS Pivot - add company_id to all tenant-scoped tables
  // We do a soft wipe of local data here because the remote DB was wiped
  // and we don't want orphaned records trying to push without a company_id.
  if (currentVersion < 15) {
    try {
      const tables = [
        'users', 'properties', 'assets', 'jobs', 'job_assets', 
        'defects', 'inspection_photos', 'signatures', 'time_logs'
      ];
      
      for (const table of tables) {
        db.runSync(`DELETE FROM ${table};`); // Wipe old single-tenant data
        db.runSync(`ALTER TABLE ${table} ADD COLUMN company_id TEXT;`);
      }
      
      // Also clear sync queue to prevent errors
      db.runSync(`DELETE FROM sync_queue;`);
      
      if (__DEV__) console.log('[UMA BUILDING SERVICES DB] Migration 15: added company_id & cleared old data');
    } catch (err: unknown) {
      console.warn('[UMA BUILDING SERVICES DB] Migration 15 failed (expected if already applied):', err instanceof Error ? err.message : String(err));
    }
    currentVersion = 15;
    db.runSync(`INSERT OR REPLACE INTO meta (key, value) VALUES ('schema_version', '15')`);
  }

  // Migration 16: Robust SaaS wipe. Migration 15 might have failed midway if columns existed.
  if (currentVersion < 16) {
    const tables = [
      'users', 'properties', 'assets', 'jobs', 'job_assets', 
      'defects', 'inspection_photos', 'signatures', 'time_logs'
    ];
    
    // First, robustly wipe all tables
    for (const table of tables) {
      try {
        db.runSync(`DELETE FROM ${table};`);
      } catch {}
    }
    try { db.runSync(`DELETE FROM sync_queue;`); } catch {}
    
    // Second, robustly ensure company_id exists
    for (const table of tables) {
      try {
        db.runSync(`ALTER TABLE ${table} ADD COLUMN company_id TEXT;`);
      } catch {} // Will fail if column already exists, which is fine
    }
    
    if (__DEV__) console.log('[UMA BUILDING SERVICES DB] Migration 16: Robust wipe and company_id check complete');
    
    currentVersion = 16;
    db.runSync(`INSERT OR REPLACE INTO meta (key, value) VALUES ('schema_version', '16')`);
  }

  // Migration 17: Add company_id to quotes and quote_items tables.
  // These were missed in migration 15/16 which only targeted tenant-scoped operational tables.
  // Without this, upsertRecord crashes when the sync pulls quotes/quote_items from Supabase
  // because the Supabase rows include a company_id column that doesn't exist in local SQLite.
  if (currentVersion < 17) {
    const quoteTables = ['quotes', 'quote_items'];
    for (const table of quoteTables) {
      try {
        db.runSync(`ALTER TABLE ${table} ADD COLUMN company_id TEXT;`);
        if (__DEV__) console.log(`[UMA BUILDING SERVICES DB] Migration 17: added ${table}.company_id`);
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        if (!msg.includes('duplicate column')) {
          console.error(`[UMA BUILDING SERVICES DB] Migration 17 (${table}) failed:`, msg);
        }
      }
    }
    currentVersion = 17;
    db.runSync(`INSERT OR REPLACE INTO meta (key, value) VALUES ('schema_version', '17')`);
    if (__DEV__) console.log('[UMA BUILDING SERVICES DB] Migration 17: quotes/quote_items company_id complete');
  }

  // Migration 18: Add all FPAS/licence columns to users table.
  // The Supabase users table has 5 compliance columns that were never added to
  // the local SQLite schema. Without all of them, upsertRecord(users) crashes on
  // the first unknown column, which cascades into a FOREIGN KEY failure on jobs.
  // Columns: fpas_number, fpas_class, fpas_expiry, state_license, state_license_expiry
  if (currentVersion < 18) {
    const userCols = [
      'fpas_number TEXT',
      'fpas_class TEXT',
      'fpas_expiry TEXT',
      'state_license TEXT',
      'state_license_expiry TEXT',
    ];
    for (const colDef of userCols) {
      try {
        db.runSync(`ALTER TABLE users ADD COLUMN ${colDef};`);
        if (__DEV__) console.log(`[UMA BUILDING SERVICES DB] Migration 18: added users.${colDef.split(' ')[0]}`);
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        if (!msg.includes('duplicate column')) {
          console.error(`[UMA BUILDING SERVICES DB] Migration 18 (${colDef}) failed:`, msg);
        }
      }
    }
    currentVersion = 18;
    db.runSync(`INSERT OR REPLACE INTO meta (key, value) VALUES ('schema_version', '18')`);
    if (__DEV__) console.log('[UMA BUILDING SERVICES DB] Migration 18: all FPAS/licence columns added to users');
  }

  // Migration 19: Add device_info to signatures table.
  // The signature capture screen stores the device OS info alongside each signature
  // for the electronic transaction audit trail. Without this column, the field is
  // skipped by the upsertRecord fallback but never actually persisted.
  if (currentVersion < 19) {
    try {
      db.runSync("ALTER TABLE signatures ADD COLUMN device_info TEXT;");
      if (__DEV__) console.log('[UMA BUILDING SERVICES DB] Migration 19: added signatures.device_info');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      if (!msg.includes('duplicate column')) console.error('[UMA BUILDING SERVICES DB] Migration 19 failed:', msg);
    }
    currentVersion = 19;
    db.runSync(`INSERT OR REPLACE INTO meta (key, value) VALUES ('schema_version', '19')`);
    if (__DEV__) console.log('[UMA BUILDING SERVICES DB] Migration 19 complete');
  }

  // Migration 20: Wipe catalogue cache to receive new multi-tenant cloned rows
  // The multi-tenant catalogue upgrade script generated new IDs for all catalogue items
  // (cloned per company). To prevent UNIQUE constraint conflicts with the old global rows
  // currently in the local cache, we wipe the local tables. The next sync will simply
  // pull down the correct cloned rows for the current company.
  if (currentVersion < 20) {
    try {
      db.runSync(`DELETE FROM asset_type_definitions;`);
      db.runSync(`DELETE FROM defect_codes;`);
      db.runSync(`DELETE FROM inventory_items;`);
      if (__DEV__) console.log('[UMA BUILDING SERVICES DB] Migration 20: catalogue caches wiped for multi-tenant upgrade');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error('[UMA BUILDING SERVICES DB] Migration 20 failed:', msg);
    }
    currentVersion = 20;
    db.runSync(`INSERT OR REPLACE INTO meta (key, value) VALUES ('schema_version', '20')`);
  }

  // Migration 21: Remove UNIQUE constraints from catalogue tables
  // In a multi-tenant environment, the remote DB might have duplicates due to 
  // admin cloning, or we might receive rows that conflict. We trust the remote
  // ID and don't want local UNIQUE constraints crashing the sync process.
  if (currentVersion < 21) {
    try {
      db.execSync(`
        PRAGMA foreign_keys = OFF;
        BEGIN TRANSACTION;

        CREATE TABLE IF NOT EXISTS asset_type_definitions_v21 (
          id                 TEXT    PRIMARY KEY NOT NULL,
          value              TEXT    NOT NULL,
          label              TEXT    NOT NULL,
          full_label         TEXT    NOT NULL,
          icon               TEXT    NOT NULL DEFAULT 'shield-check-outline',
          color              TEXT    NOT NULL DEFAULT '#6B7280',
          inspection_routine TEXT    NOT NULL DEFAULT '',
          variants           TEXT    NOT NULL DEFAULT '[]',
          is_active          INTEGER NOT NULL DEFAULT 1,
          sort_order         INTEGER NOT NULL DEFAULT 0,
          created_at         TEXT    NOT NULL DEFAULT (datetime('now')),
          updated_at         TEXT    NOT NULL DEFAULT (datetime('now'))
        );
        INSERT INTO asset_type_definitions_v21 SELECT * FROM asset_type_definitions;
        DROP TABLE asset_type_definitions;
        ALTER TABLE asset_type_definitions_v21 RENAME TO asset_type_definitions;

        CREATE TABLE IF NOT EXISTS defect_codes_v21 (
          id          TEXT    PRIMARY KEY NOT NULL,
          code        TEXT    NOT NULL,
          description TEXT    NOT NULL,
          quote_price REAL,
          category    TEXT    NOT NULL DEFAULT 'General',
          is_active   INTEGER NOT NULL DEFAULT 1,
          sort_order  INTEGER NOT NULL DEFAULT 0,
          created_at  TEXT    NOT NULL DEFAULT (datetime('now'))
        );
        INSERT INTO defect_codes_v21 SELECT * FROM defect_codes;
        DROP TABLE defect_codes;
        ALTER TABLE defect_codes_v21 RENAME TO defect_codes;

        COMMIT;
        PRAGMA foreign_keys = ON;
      `);
      if (__DEV__) console.log('[UMA BUILDING SERVICES DB] Migration 21: dropped UNIQUE constraints on catalogue tables');
    } catch (err: unknown) {
      console.error('[UMA BUILDING SERVICES DB] Migration 21 failed:', err instanceof Error ? err.message : String(err));
    }
    currentVersion = 21;
    db.runSync(`INSERT OR REPLACE INTO meta (key, value) VALUES ('schema_version', '21')`);
  }

  // Migration 22: Force wipe and recreate tables to ensure UNIQUE constraints are gone.
  // If Migration 21 failed silently but bumped the version, users will still get the UNIQUE constraint crash.
  // We can safely wipe these two tables because they are entirely derived from the remote DB and will resync immediately.
  if (currentVersion < 22) {
    try {
      db.execSync(`
        DROP TABLE IF EXISTS asset_type_definitions;
        DROP TABLE IF EXISTS defect_codes;
        
        CREATE TABLE IF NOT EXISTS asset_type_definitions (
          id                 TEXT    PRIMARY KEY NOT NULL,
          value              TEXT    NOT NULL,
          label              TEXT    NOT NULL,
          full_label         TEXT    NOT NULL,
          icon               TEXT    NOT NULL DEFAULT 'shield-check-outline',
          color              TEXT    NOT NULL DEFAULT '#6B7280',
          inspection_routine TEXT    NOT NULL DEFAULT '',
          variants           TEXT    NOT NULL DEFAULT '[]',
          is_active          INTEGER NOT NULL DEFAULT 1,
          sort_order         INTEGER NOT NULL DEFAULT 0,
          created_at         TEXT    NOT NULL DEFAULT (datetime('now')),
          updated_at         TEXT    NOT NULL DEFAULT (datetime('now'))
        );

        CREATE TABLE IF NOT EXISTS defect_codes (
          id          TEXT    PRIMARY KEY NOT NULL,
          code        TEXT    NOT NULL,
          description TEXT    NOT NULL,
          quote_price REAL,
          category    TEXT    NOT NULL DEFAULT 'General',
          is_active   INTEGER NOT NULL DEFAULT 1,
          sort_order  INTEGER NOT NULL DEFAULT 0,
          created_at  TEXT    NOT NULL DEFAULT (datetime('now'))
        );
      `);
      if (__DEV__) console.log('[UMA BUILDING SERVICES DB] Migration 22: force-recreated catalogue tables to strip UNIQUE constraints');
    } catch (err: unknown) {
      console.error('[UMA BUILDING SERVICES DB] Migration 22 failed:', err instanceof Error ? err.message : String(err));
    }
    currentVersion = 22;
    db.runSync(`INSERT OR REPLACE INTO meta (key, value) VALUES ('schema_version', '22')`);
  }

  // Migration 23: tech_signature_url on signatures table (AS1851 technician sign-off)
  // The CREATE TABLE above already includes this column for fresh installs.
  // This migration adds it safely to existing devices that already have the table.
  if (currentVersion < 23) {
    try {
      db.runSync('ALTER TABLE signatures ADD COLUMN tech_signature_url TEXT;');
      if (__DEV__) console.log('[UMA BUILDING SERVICES DB] Migration 23: added signatures.tech_signature_url');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      if (!msg.includes('duplicate column'))
        console.error('[UMA BUILDING SERVICES DB] Migration 23 failed:', msg);
    }
    currentVersion = 23;
    db.runSync(`INSERT OR REPLACE INTO meta (key, value) VALUES ('schema_version', '23')`);
    if (__DEV__) console.log('[UMA BUILDING SERVICES DB] Migration 23 complete');
  }

  // Migration 24: Add remaining missing Supabase columns to users and companies.
  // FIX: previously re-added fpas_number/fpas_class/fpas_expiry/state_license/
  // state_license_expiry here too — those were already added in Migration 18, so this
  // was pure dead weight (harmless since wrapped in try/catch, but redundant).
  // Trimmed to only the genuinely-new columns: accepted_tos_at, accepted_aup_at
  // (Legal Gate timestamps) and the companies columns.
  if (currentVersion < 24) {
    const userCols = ['accepted_tos_at TEXT', 'accepted_aup_at TEXT'];
    for (const col of userCols) {
      try { db.runSync(`ALTER TABLE users ADD COLUMN ${col};`); } catch {}
    }

    const companyCols = [
      'updated_at TEXT', 'notification_settings TEXT',
      'compliance_standards TEXT', 'appearance_settings TEXT'
    ];
    for (const col of companyCols) {
      try { db.runSync(`ALTER TABLE companies ADD COLUMN ${col};`); } catch {}
    }

    currentVersion = 24;
    db.runSync(`INSERT OR REPLACE INTO meta (key, value) VALUES ('schema_version', '24')`);
    if (__DEV__) console.log('[UMA BUILDING SERVICES DB] Migration 24 complete (users/companies columns)');
  }
  // Migration 25: Ensure AS1851-required date columns exist on assets table.
  // These are shown per asset in the PDF (install date, next service date).
  // Fresh installs from the base CREATE TABLE already have them, but upgrades need this.
  if (currentVersion < 25) {
    const assetCols = [
      'install_date TEXT',
      'next_service_date TEXT',
      'last_service_date TEXT',
    ];
    for (const col of assetCols) {
      try { db.runSync(`ALTER TABLE assets ADD COLUMN ${col};`); } catch {}
    }
    currentVersion = 25;
    db.runSync(`INSERT OR REPLACE INTO meta (key, value) VALUES ('schema_version', '25')`);
    if (__DEV__) console.log('[UMA BUILDING SERVICES DB] Migration 25 complete (assets date columns)');
  }

  // Migration 26: Ensure company_id column exists on assets table.
  // Required for Supabase RLS when cloned assets are pushed via the sync queue.
  if (currentVersion < 26) {
    try { db.runSync(`ALTER TABLE assets ADD COLUMN company_id TEXT;`); } catch {}
    currentVersion = 26;
    db.runSync(`INSERT OR REPLACE INTO meta (key, value) VALUES ('schema_version', '26')`);
    if (__DEV__) console.log('[UMA BUILDING SERVICES DB] Migration 26 complete (assets.company_id)');
  }

  // Migration 27: Add company_id to inspection_photos, job_assets, and defects.
  // These three tables are written by the tech in the field and pushed via sync queue.
  // Without company_id the Supabase RLS policy (company_id = auth.jwt() company)
  // silently rejects every INSERT — photos, job results and defects never reach the server.
  if (currentVersion < 27) {
    const cols: [string, string][] = [
      ['inspection_photos', 'company_id TEXT'],
      ['job_assets',        'company_id TEXT'],
      ['defects',           'company_id TEXT'],
    ];
    for (const [tbl, col] of cols) {
      try { db.runSync(`ALTER TABLE ${tbl} ADD COLUMN ${col};`); } catch {}
    }
    currentVersion = 27;
    db.runSync(`INSERT OR REPLACE INTO meta (key, value) VALUES ('schema_version', '27')`);
    if (__DEV__) console.log('[UMA BUILDING SERVICES DB] Migration 27 complete (company_id on photos/job_assets/defects)');
  }

  // Migration 28: Add company_id to signatures table.
  // Signatures are captured by the tech and synced to Supabase via the sync queue.
  // Supabase RLS requires company_id on all tenant-scoped tables — without it
  // every signature INSERT is silently rejected, meaning sign-off data is never
  // delivered to the server even when the tech is back online.
  if (currentVersion < 28) {
    try { db.runSync(`ALTER TABLE signatures ADD COLUMN company_id TEXT;`); } catch {}
    currentVersion = 28;
    db.runSync(`INSERT OR REPLACE INTO meta (key, value) VALUES ('schema_version', '28')`);
    if (__DEV__) console.log('[UMA BUILDING SERVICES DB] Migration 28 complete (signatures.company_id)');
  }

  // Migration 29: Add local_uri column to inspection_photos.
  //
  // THE PROBLEM THIS SOLVES:
  //   1. Tech captures a photo → stored as file:// URI in inspection_photos.photo_url
  //   2. Background sync uploads the binary → updateRecord() REPLACES photo_url with https:// URL
  //   3. Tech generates PDF offline → toDataUri() tries FileSystem.downloadAsync(https://) → FAILS
  //   4. PDF shows a grey "Photo unavailable" placeholder even though the file is on the device
  //
  // THE FIX:
  //   Store the original file:// path in a separate local_uri column that is NEVER overwritten.
  //   pdfGenerator.ts now checks local_uri first — if the file still exists it encodes it directly.
  //   Only if local_uri is missing or the file has been deleted does it fall back to photo_url (https://).
  if (currentVersion < 29) {
    try { db.runSync(`ALTER TABLE inspection_photos ADD COLUMN local_uri TEXT;`); } catch {}
    currentVersion = 29;
    db.runSync(`INSERT OR REPLACE INTO meta (key, value) VALUES ('schema_version', '29')`);
    if (__DEV__) console.log('[UMA BUILDING SERVICES DB] Migration 29 complete (inspection_photos.local_uri)');
  }

  // Migration 30: Add missing updated_at columns to users, assets, and defects.
  //
  // WHY: These columns exist in Supabase and are included in every pull response,
  // but were absent from the local SQLite CREATE TABLE definitions.
  // Effect was threefold:
  //   1. Every sync pull called upsertRecord() which threw "no column named updated_at",
  //      forcing a second PRAGMA table_info() lookup + filtered re-insert on EVERY row.
  //   2. defects.updated_at was always null in SQLite, so the PDF's "Last Verified" date
  //      always fell back to created_at even when the defect had been updated.
  //   3. The sync conflict-resolution staleness guard on assets couldn't read updated_at.
  if (currentVersion < 30) {
    const addUpdatedAt = (table: string) => {
      try {
        db.runSync(`ALTER TABLE ${table} ADD COLUMN updated_at TEXT;`);
        if (__DEV__) console.log(`[UMA BUILDING SERVICES DB] Migration 30: added ${table}.updated_at`);
      } catch (err: unknown) {
        const msg = String(err);
        if (!msg.includes('duplicate column')) {
          console.error(`[UMA BUILDING SERVICES DB] Migration 30 (${table}.updated_at) failed:`, msg);
        }
      }
    };
    addUpdatedAt('users');
    addUpdatedAt('assets');
    addUpdatedAt('defects');
    currentVersion = 30;
    db.runSync(`INSERT OR REPLACE INTO meta (key, value) VALUES ('schema_version', '30')`);
  }

  // Migration 31: Add custom_sidebar_label and custom_sidebar_url to companies.
  //
  // WHY: These columns exist in Supabase (added via the admin portal migration)
  // but were never added to the local SQLite companies table.
  // Every sync pull was emitting:
  //   "upsertRecord(companies): skipping unknown columns [custom_sidebar_label, custom_sidebar_url]"
  // and silently dropping those values, so any custom sidebar config set by
  // an admin would never reach the technician's app.
  if (currentVersion < 31) {
    const addSidebarCols = (col: string) => {
      try {
        db.runSync(`ALTER TABLE companies ADD COLUMN ${col} TEXT;`);
        if (__DEV__) console.log(`[UMA BUILDING SERVICES DB] Migration 31: added companies.${col}`);
      } catch (err: unknown) {
        const msg = String(err);
        if (!msg.includes('duplicate column')) {
          console.error(`[UMA BUILDING SERVICES DB] Migration 31 (companies.${col}) failed:`, msg);
        }
      }
    };
    addSidebarCols('custom_sidebar_label');
    addSidebarCols('custom_sidebar_url');
    currentVersion = 31;
    db.runSync(`INSERT OR REPLACE INTO meta (key, value) VALUES ('schema_version', '31')`);
  }

  // Migration 32: Sync reliability — exponential backoff + terminal-error classification.
  //
  // WHY: Previously every failed sync item retried on the very next 60s cycle no
  // matter why it failed, and a non-retryable error (bad data, permission denial)
  // was treated identically to a transient network blip — both just incremented
  // the same counter until the 5-retry budget ran out. next_retry_at lets the
  // engine back off (so a real outage doesn't get hammered every cycle) and
  // is_terminal lets it recognise "this will never succeed" immediately instead
  // of wasting all 5 attempts finding that out.
  if (currentVersion < 32) {
    const addSyncQueueCol = (ddl: string, label: string) => {
      try {
        db.runSync(`ALTER TABLE sync_queue ADD COLUMN ${ddl};`);
        if (__DEV__) console.log(`[UMA BUILDING SERVICES DB] Migration 32: added sync_queue.${label}`);
      } catch (err: unknown) {
        const msg = String(err);
        if (!msg.includes('duplicate column')) {
          console.error(`[UMA BUILDING SERVICES DB] Migration 32 (sync_queue.${label}) failed:`, msg);
        }
      }
    };
    addSyncQueueCol('next_retry_at TEXT', 'next_retry_at');
    addSyncQueueCol('is_terminal INTEGER NOT NULL DEFAULT 0', 'is_terminal');
    currentVersion = 32;
    db.runSync(`INSERT OR REPLACE INTO meta (key, value) VALUES ('schema_version', '32')`);
  }

  // Migration 33: job_technicians — flat multi-technician job assignment,
  // mirroring the same table added server-side (see
  // supabase/migrations/20260824020000_job_technicians.sql). The bootstrap
  // CREATE TABLE IF NOT EXISTS above already creates this for a device on
  // this version already, so this block is here purely for the same
  // version-tracking/logging consistency every other migration follows —
  // both statements are idempotent regardless of ordering.
  if (currentVersion < 33) {
    try {
      db.execSync(`
        CREATE TABLE IF NOT EXISTS job_technicians (
          id         TEXT PRIMARY KEY NOT NULL,
          company_id TEXT,
          job_id     TEXT NOT NULL,
          user_id    TEXT NOT NULL,
          created_at TEXT NOT NULL DEFAULT (datetime('now')),
          FOREIGN KEY (job_id)  REFERENCES jobs(id),
          FOREIGN KEY (user_id) REFERENCES users(id)
        );
        CREATE INDEX IF NOT EXISTS idx_job_technicians_job_id  ON job_technicians(job_id);
        CREATE INDEX IF NOT EXISTS idx_job_technicians_user_id ON job_technicians(user_id);
      `);
      if (__DEV__) console.log('[UMA BUILDING SERVICES DB] Migration 33: added job_technicians table');
    } catch (err: unknown) {
      console.error('[UMA BUILDING SERVICES DB] Migration 33 failed:', err instanceof Error ? err.message : String(err));
    }
    currentVersion = 33;
    db.runSync(`INSERT OR REPLACE INTO meta (key, value) VALUES ('schema_version', '33')`);
  }

  // Migration 34: job_assets.actioned_by — who inspected this asset, not
  // just when. Mirrors supabase/migrations/20260824030000_job_assets_actioned_by.sql.
  if (currentVersion < 34) {
    try {
      db.runSync(`ALTER TABLE job_assets ADD COLUMN actioned_by TEXT;`);
      if (__DEV__) console.log('[UMA BUILDING SERVICES DB] Migration 34: added job_assets.actioned_by');
    } catch (err: unknown) {
      const msg = String(err);
      if (!msg.includes('duplicate column')) {
        console.error('[UMA BUILDING SERVICES DB] Migration 34 failed:', msg);
      }
    }
    currentVersion = 34;
    db.runSync(`INSERT OR REPLACE INTO meta (key, value) VALUES ('schema_version', '34')`);
  }

  // Seed inventory from Uptick defect codes on first run
  seedInventoryFromDefectCodes();
}

// ─────────────────────────────────────────────
// Generic CRUD helpers
// ─────────────────────────────────────────────

export type RecordData = Record<string, string | number | boolean | null>;

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
    console.error(`[UMA BUILDING SERVICES DB] insertRecord(${table}) error:`, err);
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
    console.error(`[UMA BUILDING SERVICES DB] updateRecord(${table}, ${id}) error:`, err);
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
    console.error(`[UMA BUILDING SERVICES DB] deleteRecord(${table}, ${id}) error:`, err);
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
    console.error(`[UMA BUILDING SERVICES DB] getRecord(${table}, ${id}) error:`, err);
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
    console.error(`[UMA BUILDING SERVICES DB] queryRecords(${table}) error:`, err);
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
    console.error(`[UMA BUILDING SERVICES DB] queryRecordsIn(${table}) error:`, err);
    return [];
  }
}

// ─────────────────────────────────────────────
// Domain-specific helpers
// ─────────────────────────────────────────────

/**
 * Returns all non-cancelled jobs assigned to the given technician, ordered
 * by scheduled date. "Assigned" means present in job_technicians — a flat
 * list, no primary tech — OR (fallback) jobs.assigned_to, which still
 * covers any job synced down before this device ever pulled job_technicians
 * rows for it. DISTINCT guards against a job matching both.
 */
export function getJobsForTechnician<T = RecordData>(userId: string): T[] {
  try {
    const db = openDatabase();
    return db.getAllSync<T>(
      `SELECT DISTINCT j.*, p.name AS property_name, p.address AS property_address,
              p.suburb AS property_suburb, p.state AS property_state,
              p.postcode AS property_postcode,
              p.compliance_status AS property_compliance_status,
              p.site_contact_name, p.site_contact_phone,
              p.access_notes, p.hazard_notes, p.site_note
       FROM jobs j
       LEFT JOIN properties p ON j.property_id = p.id
       WHERE j.status != 'cancelled'
         AND (
           j.assigned_to = ?
           OR EXISTS (SELECT 1 FROM job_technicians jt WHERE jt.job_id = j.id AND jt.user_id = ?)
         )
       ORDER BY j.scheduled_date ASC, j.priority DESC`,
      [userId, userId],
    );
  } catch (err) {
    console.error(`[UMA BUILDING SERVICES DB] getJobsForTechnician(${userId}) error:`, err);
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
    console.error("[UMA BUILDING SERVICES DB] cleanOldSyncQueueItems error:", err);
  }
}

/**
 * FIX: this previously deleted `synced = 0` (PENDING, not-yet-attempted) items —
 * the exact opposite of what the name promises. A pending item hasn't failed at
 * all; deleting it silently drops a legitimate queued write with zero warning.
 * Now correctly targets `synced = -1` (permanently failed, retries exhausted) —
 * the rows this function's name says it clears. Use this only when you want to
 * ABANDON that data; to give failed items a fresh shot instead, use
 * resetStaleFailedSyncItems() or retryAllFailedSyncItems() below.
 */
export function clearFailedSyncItems(tableName: string): void {
  try {
    const db = openDatabase();
    db.runSync(`DELETE FROM sync_queue WHERE table_name = ? AND synced = -1`, [
      tableName,
    ]);
    if (__DEV__)
      console.log(
        `[UMA BUILDING SERVICES DB] Cleared permanently-failed sync queue items for table: ${tableName}`,
      );
  } catch (err) {
    console.error(`[UMA BUILDING SERVICES DB] clearFailedSyncItems error:`, err);
  }
}

/**
 * NEW: Recovery mechanism for permanently-failed sync items.
 *
 * Without this, an item that exhausts MAX_SYNC_RETRIES (5) in sync.ts is
 * abandoned forever — synced = -1, never looked at again — even if the root
 * cause (a network blip, a missing RLS policy that got fixed server-side,
 * momentarily missing company_id) is long gone. For a compliance app, that
 * means a defect or photo a technician logged in the field can silently never
 * reach the Admin, with no error surfaced to anyone.
 *
 * This gives every permanently-failed item a fresh retry budget, but only
 * once it's been sitting failed for at least `cooldownMs` — so a persistent,
 * still-broken row doesn't get hammered every sync cycle. Call this
 * periodically (e.g. once per successful sync run) from sync.ts.
 *
 * Note: uses `created_at` (when the item was first queued) as the cooldown
 * clock, since sync_queue doesn't currently track "time marked failed"
 * separately. Good enough as a coarse cooldown; add a `failed_at` column if
 * you want this to be precise.
 */
export function resetStaleFailedSyncItems(cooldownMs: number = 24 * 60 * 60 * 1000): number {
  try {
    const db = openDatabase();
    const cutoff = new Date(Date.now() - cooldownMs).toISOString();
    // is_terminal = 0 only: a terminal failure (bad data, permission denial) will
    // fail the exact same way on a blind retry — it needs a real fix, not another
    // attempt. Only genuinely-transient exhausted items get an automatic reset.
    const result = db.runSync(
      `UPDATE sync_queue
       SET synced = 0, retry_count = 0, last_error = NULL, next_retry_at = NULL
       WHERE synced = -1 AND is_terminal = 0 AND created_at < ?`,
      [cutoff],
    );
    if (__DEV__ && result.changes > 0) {
      console.log(`[UMA BUILDING SERVICES DB] Gave ${result.changes} stale failed sync item(s) a fresh retry`);
    }
    return result.changes;
  } catch (err) {
    console.error('[UMA BUILDING SERVICES DB] resetStaleFailedSyncItems error:', err);
    return 0;
  }
}

/**
 * NEW: Manually retry ALL permanently-failed items right now, regardless of
 * cooldown. Intended for a "Retry failed syncs" button in a settings/support
 * screen so a technician isn't stuck waiting on the cooldown window.
 */
export function retryAllFailedSyncItems(): number {
  try {
    const db = openDatabase();
    // Explicit user action — reset terminal items too (the user may have just
    // fixed whatever caused the permission/validation error).
    const result = db.runSync(
      `UPDATE sync_queue SET synced = 0, retry_count = 0, last_error = NULL, next_retry_at = NULL, is_terminal = 0 WHERE synced = -1`,
    );
    if (__DEV__) console.log(`[UMA BUILDING SERVICES DB] Manually retried ${result.changes} failed sync item(s)`);
    return result.changes;
  } catch (err) {
    console.error('[UMA BUILDING SERVICES DB] retryAllFailedSyncItems error:', err);
    return 0;
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
      `[UMA BUILDING SERVICES DB] getAssetsForProperty(${propertyId}) error:`,
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
         WHEN 'non_critical' THEN 2
         WHEN 'non_conformance' THEN 3
         ELSE 4
       END ASC`,
      [jobId],
    );
  } catch (err) {
    console.error(`[UMA BUILDING SERVICES DB] getDefectsForJob(${jobId}) error:`, err);
    return [];
  }
}

/** Returns the active (not clocked-out) time log for this job+user, or null. */
export function getActiveTimeLog(jobId: string, userId: string): { id: string; clock_in: string } | null {
  try {
    const db = openDatabase();
    const row = db.getFirstSync<{ id: string; clock_in: string }>(
      'SELECT id, clock_in FROM time_logs WHERE job_id = ? AND user_id = ? AND clock_out IS NULL LIMIT 1',
      [jobId, userId]
    );
    return row ?? null;
  } catch {
    return null;
  }
}

/** Returns the existing job_asset inspection record for a specific asset+job, or null. */
export function getJobAssetRecord(jobId: string, assetId: string): { id: string; result: string | null; technician_notes: string | null } | null {
  try {
    const db = openDatabase();
    const row = db.getFirstSync<{ id: string; result: string | null; technician_notes: string | null }>(
      'SELECT id, result, technician_notes FROM job_assets WHERE job_id = ? AND asset_id = ? LIMIT 1',
      [jobId, assetId]
    );
    return row ?? null;
  } catch {
    return null;
  }
}

// ─────────────────────────────────────────────
// Sync queue helpers
// ─────────────────────────────────────────────

/** Adds a pending write operation to the local sync queue */
export function addToSyncQueue(
  tableName: string,
  recordId: string,
  operation: SyncOperation | 'photo_upload',
  payload: RecordData,
): void {
  try {
    const db = openDatabase();

    // M6 fix: For Update operations, merge into an existing pending row for the same
    // record rather than appending a duplicate. This prevents N network calls when a
    // field is changed N times before the next sync cycle runs.
    // Insert / Delete / photo_upload are always appended as separate entries.
    if (operation === SyncOperation.Update) {
      const existing = db.getFirstSync<{ id: number; payload: string }>(
        `SELECT id, payload FROM sync_queue
         WHERE table_name = ? AND record_id = ? AND operation = ? AND synced = 0
         LIMIT 1`,
        [tableName, recordId, operation],
      );

      if (existing) {
        // Merge: extend the existing payload with the new fields (new fields take precedence)
        let merged: RecordData = {};
        try { merged = JSON.parse(existing.payload) as RecordData; } catch { /* start fresh */ }
        Object.assign(merged, payload);
        db.runSync(
          `UPDATE sync_queue SET payload = ? WHERE id = ?`,
          [JSON.stringify(merged), existing.id],
        );
        return;
      }
    }

    db.runSync(
      `INSERT INTO sync_queue (table_name, record_id, operation, payload, synced, retry_count)
       VALUES (?, ?, ?, ?, 0, 0)`,
      [tableName, recordId, operation, JSON.stringify(payload)],
    );
  } catch (err) {
    console.error("[UMA BUILDING SERVICES DB] addToSyncQueue error:", err);
  }
}

/**
 * Cancels any pending photo_upload tasks for the given photo record ID.
 * Called immediately when a photo is deleted so the binary is never uploaded
 * to Supabase Storage — preventing a ghost row from being inserted afterwards.
 */
export function cancelPendingPhotoUpload(recordId: string): void {
  try {
    const db = openDatabase();
    db.runSync(
      `UPDATE sync_queue SET synced = 1
       WHERE table_name = 'inspection_photos'
         AND record_id = ?
         AND operation = 'photo_upload'
         AND synced = 0`,
      [recordId],
    );
    if (__DEV__)
      console.log(`[UMA BUILDING SERVICES DB] Cancelled pending photo_upload for record ${recordId}`);
  } catch (err) {
    console.error(`[UMA BUILDING SERVICES DB] cancelPendingPhotoUpload(${recordId}) error:`, err);
  }
}

/**
 * Records a photo ID in the permanent tombstone so it is never re-pulled
 * from Supabase — even if the remote delete is slow, retrying, or fails.
 * Call this every time a photo is deleted locally, regardless of URL scheme.
 */
export function recordDeletedPhoto(photoId: string): void {
  try {
    const db = openDatabase();
    db.runSync(
      `INSERT OR IGNORE INTO deleted_photo_ids (id) VALUES (?)`,
      [photoId],
    );
    if (__DEV__)
      console.log(`[UMA BUILDING SERVICES DB] Tombstoned deleted photo ${photoId}`);
  } catch (err) {
    console.error(`[UMA BUILDING SERVICES DB] recordDeletedPhoto(${photoId}) error:`, err);
  }
}

/**
 * Returns the set of photo IDs that have been locally deleted.
 * Used by the sync pull to skip tombstoned rows, preventing
 * deleted photos from reappearing after reinstall.
 */
export function getDeletedPhotoIds(): Set<string> {
  try {
    const db = openDatabase();
    const rows = db.getAllSync<{ id: string }>(
      `SELECT id FROM deleted_photo_ids`,
    );
    return new Set(rows.map(r => r.id));
  } catch (err) {
    console.error(`[UMA BUILDING SERVICES DB] getDeletedPhotoIds error:`, err);
    return new Set();
  }
}

/**
 * Returns all sync queue items not yet pushed to Supabase (synced=0).
 * Ordered oldest-first so earlier writes are pushed before later ones.
 * NOTE: items with retry_count >= maxRetries are still returned here;
 * the sync engine is responsible for calling incrementSyncRetry() to
 * mark them synced=-1 after the final failure.
 */
export function getPendingSyncItems(maxRetries = 5): SyncQueueItem[] {
  try {
    const db = openDatabase();
    const now = new Date().toISOString();
    return db.getAllSync<SyncQueueItem>(
      `SELECT * FROM sync_queue
       WHERE synced = 0 AND retry_count < ?
         AND (next_retry_at IS NULL OR next_retry_at <= ?)
       ORDER BY CASE WHEN operation = 'report_generate' THEN 1 ELSE 0 END ASC, created_at ASC`,
      [maxRetries, now],
    );
  } catch (err) {
    console.error('[UMA BUILDING SERVICES DB] getPendingSyncItems error:', err);
    return [];
  }
}

/**
 * Returns sync queue items that have permanently failed (synced = -1).
 * These will never be retried automatically until resetStaleFailedSyncItems()
 * or retryAllFailedSyncItems() runs. Callers can expose them to the user
 * so they know data may not have reached the server.
 */
export function getFailedSyncItems(): SyncQueueItem[] {
  try {
    const db = openDatabase();
    return db.getAllSync<SyncQueueItem>(
      `SELECT * FROM sync_queue WHERE synced = -1 ORDER BY created_at DESC`,
    );
  } catch (err) {
    console.error("[UMA BUILDING SERVICES DB] getFailedSyncItems error:", err);
    return [];
  }
}

/** Marks a sync queue item as successfully pushed to Supabase */
export function markSyncItemComplete(id: number): void {
  try {
    const db = openDatabase();
    db.runSync(`UPDATE sync_queue SET synced = 1 WHERE id = ?`, [id]);
  } catch (err) {
    console.error(`[UMA BUILDING SERVICES DB] markSyncItemComplete(${id}) error:`, err);
  }
}

/**
 * Increments the retry_count for a failed sync item and records the error message.
 *
 * - Terminal errors (isTerminal=true — bad data, permission denial, a broken
 *   reference) are marked permanently failed immediately. No amount of
 *   retrying fixes a non-retryable error, so there's no point burning the
 *   retry budget rediscovering that 5 times.
 * - Retryable errors get an exponential backoff with jitter (1m, 2m, 4m, 8m,
 *   capped at 30m) via next_retry_at, so a real outage doesn't get hammered
 *   on every single 60s sync cycle. After maxRetries, it's marked permanently
 *   failed the same as before (but NOT flagged terminal — resetStaleFailedSyncItems
 *   will still give it a fresh chance later, since it might just need the
 *   outage to end).
 */
export function incrementSyncRetry(
  id: number,
  errorMessage: string,
  maxRetries = 5,
  isTerminal = false,
): void {
  try {
    const db = openDatabase();
    const item = db.getFirstSync<{ retry_count: number }>(
      `SELECT retry_count FROM sync_queue WHERE id = ?`,
      [id],
    );
    if (!item) return;

    const newCount = (item.retry_count ?? 0) + 1;

    if (isTerminal) {
      db.runSync(
        `UPDATE sync_queue SET retry_count = ?, last_error = ?, synced = -1, is_terminal = 1 WHERE id = ?`,
        [newCount, errorMessage, id],
      );
      console.warn(
        `[UMA BUILDING SERVICES DB] Sync item ${id} failed permanently (non-retryable): ${errorMessage}`,
      );
      return;
    }

    if (newCount >= maxRetries) {
      // Permanently mark as failed — will not be retried automatically
      // (resetStaleFailedSyncItems can still give it a fresh chance later).
      db.runSync(
        `UPDATE sync_queue SET retry_count = ?, last_error = ?, synced = -1 WHERE id = ?`,
        [newCount, errorMessage, id],
      );
      console.warn(
        `[UMA BUILDING SERVICES DB] Sync item ${id} permanently failed after ${newCount} retries: ${errorMessage}`,
      );
    } else {
      const baseMs = 60_000;       // 1 minute
      const capMs  = 30 * 60_000;  // 30 minutes
      const backoffMs = Math.min(capMs, baseMs * Math.pow(2, newCount - 1));
      const jitterMs  = Math.floor(Math.random() * backoffMs * 0.2); // ±20% jitter
      const nextRetryAt = new Date(Date.now() + backoffMs + jitterMs).toISOString();

      db.runSync(
        `UPDATE sync_queue SET retry_count = ?, last_error = ?, next_retry_at = ? WHERE id = ?`,
        [newCount, errorMessage, nextRetryAt, id],
      );
    }
  } catch (err) {
    console.error(`[UMA BUILDING SERVICES DB] incrementSyncRetry(${id}) error:`, err);
  }
}

/**
 * Upserts a record — inserts if not exists, updates in-place if id already present.
 * Uses SQLite ON CONFLICT DO UPDATE to avoid destroying FK child rows (unlike INSERT OR REPLACE).
 * Used by the sync service when pulling data from Supabase.
 */
export function upsertRecord(table: string, data: RecordData): void {
  const _tryUpsert = (db: SQLite.SQLiteDatabase, safeTable: string, d: RecordData): void => {
    const keys = Object.keys(d).map(_safeColumnName);
    const placeholders = keys.map(() => "?").join(", ");
    const values = Object.values(d);
    const setClauses = keys
      .filter((k) => k !== "id")
      .map((k) => `${k} = excluded.${k}`)
      .join(", ");

    if (setClauses.length === 0) {
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
  };

  try {
    const db = openDatabase();
    const safeTable = _safeColumnName(table);
    _tryUpsert(db, safeTable, data);
  } catch (err) {
    // Use String(err) not err.message — expo-sqlite wraps native errors, so the
    // root cause (e.g. 'table X has no column named Y') is in the full string,
    // not in the top-level .message (which is just 'NativeDatabase.prepareSync rejected').
    const fullErr = String(err);
    const msg = err instanceof Error ? err.message : fullErr;
    const isColumnError = fullErr.includes('no column named') ||
                          fullErr.includes('has no column') ||
                          msg.includes('no column named');
    // Guard: if Supabase has a new column that doesn't exist in local SQLite yet,
    // retry with only the columns that the local table actually knows about.
    // This prevents any future remote schema addition from crashing the entire sync.
    if (isColumnError) {
      try {
        const db = openDatabase();
        const safeTable = _safeColumnName(table);
        // Get the list of columns that actually exist in this local table
        const colRows = db.getAllSync<{ name: string }>(`PRAGMA table_info(${safeTable})`);
        const localCols = new Set(colRows.map(r => r.name));
        // Filter data down to only known columns
        const safeData: RecordData = {};
        for (const [k, v] of Object.entries(data)) {
          if (localCols.has(k)) safeData[k] = v;
        }
        if (__DEV__) {
          const skipped = Object.keys(data).filter(k => !localCols.has(k));
          if (skipped.length > 0) console.warn(`[UMA BUILDING SERVICES DB] upsertRecord(${table}): skipping unknown columns [${skipped.join(', ')}] — add a migration to include them`);
        }
        _tryUpsert(db, safeTable, safeData);
      } catch (retryErr) {
        console.error(`[UMA BUILDING SERVICES DB] upsertRecord(${table}) retry error:`, retryErr);
      }
    } else {
      console.error(`[UMA BUILDING SERVICES DB] upsertRecord(${table}) error:`, err);
    }
  }
}

/**
 * Upserts a batch of server-pulled records with FK enforcement temporarily disabled.
 *
 * WHY: expo-sqlite enables PRAGMA foreign_keys=ON by default on Android. When the
 * sync engine pulls related tables (e.g. job_assets before its asset row is locally
 * present), the FK check fires and crashes the upsert with:
 *   "FOREIGN KEY constraint failed"
 * The server is already the source of referential truth — if Supabase accepted the
 * row, the FK is valid server-side. We don't need the local device to re-validate it
 * during a bulk pull. This wrapper disables FK checks for the duration of the batch
 * and re-enables them immediately after, so user-initiated writes (inserts from screens)
 * are still FK-guarded.
 *
 * @param table  - SQLite table name
 * @param rows   - Array of rows from Supabase to upsert
 */
export function upsertRecordBulk(
  table: string,
  rows: RecordData[],
): void {
  if (rows.length === 0) return;
  const db = openDatabase();
  try {
    db.runSync('PRAGMA foreign_keys = OFF');
    for (const row of rows) {
      upsertRecord(table, row);
    }
  } finally {
    // Always re-enable FK enforcement, even if an individual upsert threw.
    db.runSync('PRAGMA foreign_keys = ON');
  }
}


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
              p.site_note,
              p.compliance_status AS property_compliance_status
       FROM jobs j
       LEFT JOIN properties p ON j.property_id = p.id
       WHERE j.id = ?`,
        [jobId],
      ) ?? null
    );
  } catch (err) {
    console.error(`[UMA BUILDING SERVICES DB] getJobById(${jobId}) error:`, err);
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
      // Uses MAX(actioned_at) to select the single most-recent job_assets row per asset.
      // ORDER BY inside IN() is not guaranteed in older SQLite versions — this GROUP BY
      // approach is portable and reliable. Prevents duplicate rows when rapid taps
      // create multiple job_assets entries for the same asset+job combination.
      `SELECT a.*,
              ja.id              AS job_asset_id,
              ja.result,
              ja.defect_reason,
              ja.technician_notes,
              ja.technician_notes AS inspection_notes,
              ja.checklist_data,
              ja.is_compliant,
              ja.actioned_at,
              ja.actioned_by,
              u.full_name AS actioned_by_name
       FROM assets a
       LEFT JOIN (
         SELECT jb.*
         FROM job_assets jb
         INNER JOIN (
           SELECT asset_id, MAX(actioned_at) AS latest_at
           FROM job_assets
           WHERE job_id = ?
           GROUP BY asset_id
         ) latest ON jb.asset_id = latest.asset_id AND jb.actioned_at = latest.latest_at
         WHERE jb.job_id = ?
       ) ja ON a.id = ja.asset_id
       LEFT JOIN users u ON ja.actioned_by = u.id
       WHERE a.property_id = ?
         AND a.status = 'active'
       ORDER BY a.asset_type ASC, COALESCE(a.asset_ref, '') ASC`,
      [jobId, jobId, propertyId],
    );
  } catch (err) {
    console.error('[UMA BUILDING SERVICES DB] getAssetsWithJobResults error:', err);
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
      `[UMA BUILDING SERVICES DB] getJobsForProperty(${propertyId}) error:`,
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
    console.error(`[UMA BUILDING SERVICES DB] getTimeLogsForJob(${jobId}) error:`, err);
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
    console.error(`[UMA BUILDING SERVICES DB] getSignatureForJob(${jobId}) error:`, err);
    return null;
  }
}

/** Returns all inspection photos for a job, ordered oldest-first.
 * Oldest-first is critical for PDF deduplication:
 * when an asset has photos from multiple inspection visits,
 * the newest photos (re-inspection) appear last and are given
 * priority in dedup logic (seen Set fills with old URLs first,
 * new ones are always appended and rendered). */
export function getPhotosForJob<T = RecordData>(jobId: string): T[] {
  try {
    const db = openDatabase();
    return db.getAllSync<T>(
      `SELECT * FROM inspection_photos WHERE job_id = ? ORDER BY uploaded_at ASC`,
      [jobId],
    );
  } catch (err) {
    console.error(`[UMA BUILDING SERVICES DB] getPhotosForJob(${jobId}) error:`, err);
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
      `[UMA BUILDING SERVICES DB] getServiceHistoryForAsset(${assetId}) error:`,
      err,
    );
    return [];
  }
}

/**
 * Returns the local status and updated_at timestamp for a job.
 * Used by the sync engine for conflict resolution — prevents a PULL from
 * reverting a local in_progress/completed status back to scheduled.
 */
export function getJobStatus(jobId: string): { status: string; updated_at: string } | null {
  try {
    const db = openDatabase();
    return (
      db.getFirstSync<{ status: string; updated_at: string }>(
        `SELECT status, updated_at FROM jobs WHERE id = ?`,
        [jobId],
      ) ?? null
    );
  } catch (err) {
    console.error(`[UMA BUILDING SERVICES DB] getJobStatus(${jobId}) error:`, err);
    return null;
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
    console.error(`[UMA BUILDING SERVICES DB] getDefectsForAsset(${assetId}) error:`, err);
    return [];
  }
}

/**
 * Retrieves ALL defects across all jobs, with joined asset and property info.
 * Used by the global defects screen. Optionally filter by status.
 */
export function getAllDefects<T = RecordData>(status?: string): T[] {
  try {
    const db = openDatabase();
    // Security: use parameterised query — never interpolate status string directly into SQL
    if (status) {
      return db.getAllSync<T>(
        `SELECT d.*,
                a.asset_type, a.location_on_site,
                p.name AS property_name,
                j.scheduled_date, j.job_type
         FROM defects d
         LEFT JOIN assets a ON d.asset_id = a.id
         LEFT JOIN properties p ON d.property_id = p.id
         LEFT JOIN jobs j ON d.job_id = j.id
         WHERE d.status = ?
         ORDER BY d.created_at DESC`,
        [status],
      );
    }
    return db.getAllSync<T>(
      `SELECT d.*,
              a.asset_type, a.location_on_site,
              p.name AS property_name,
              j.scheduled_date, j.job_type
       FROM defects d
       LEFT JOIN assets a ON d.asset_id = a.id
       LEFT JOIN properties p ON d.property_id = p.id
       LEFT JOIN jobs j ON d.job_id = j.id
       ORDER BY d.created_at DESC`,
    );
  } catch (err) {
    console.error('[UMA BUILDING SERVICES DB] getAllDefects error:', err);
    return [];
  }
}

/**
 * Retrieves a single defect by ID with all joined fields.
 */
export function getDefectById<T = RecordData>(defectId: string): T | null {
  try {
    const db = openDatabase();
    return db.getFirstSync<T>(
      `SELECT d.*,
              a.asset_type, a.location_on_site, a.serial_number,
              p.name AS property_name,
              j.scheduled_date, j.job_type, j.id AS job_id_resolved
       FROM defects d
       LEFT JOIN assets a ON d.asset_id = a.id
       LEFT JOIN properties p ON d.property_id = p.id
       LEFT JOIN jobs j ON d.job_id = j.id
       WHERE d.id = ?`,
      [defectId],
    ) ?? null;
  } catch (err) {
    console.error(`[UMA BUILDING SERVICES DB] getDefectById(${defectId}) error:`, err);
    return null;
  }
}

/**
 * Seeds the local inventory_items table with Uptick defect codes that have a price.
 * Only runs if inventory is completely empty — never overwrites existing data.
 * Prices are reference rates from the Uptick codebook and can be edited on the quote screen.
 */
export function seedInventoryFromDefectCodes(): void {
  try {
    const db = openDatabase();
    const count = db.getFirstSync<{ n: number }>('SELECT COUNT(*) as n FROM inventory_items');
    if (count && count.n > 0) return; // Already seeded — never overwrites existing data

    const pricedCodes = DEFECT_CODES.filter(d => d.quote_price !== undefined);
    const now = new Date().toISOString();

    db.withTransactionSync(() => {
      for (const code of pricedCodes) {
        const id = generateUUID();
        db.runSync(
          `INSERT OR IGNORE INTO inventory_items (id, name, description, price, created_at)
           VALUES (?, ?, ?, ?, ?)`,
          [id, `[${code.code.toUpperCase()}] ${code.category}`, code.description.substring(0, 120), code.quote_price!, now],
        );
      }
    });

    if (__DEV__) console.log(`[UMA BUILDING SERVICES DB] Seeded ${pricedCodes.length} inventory items from Uptick codes`);
  } catch (err) {
    // Non-fatal — inventory seeding is best-effort
    console.warn('[UMA BUILDING SERVICES DB] seedInventoryFromDefectCodes failed:', err);
  }
}

/** Returns the number of unread notifications for a given user ID. */
export function getUnreadNotificationCount(userId: string): number {
  try {
    const db = openDatabase();
    const res = db.getFirstSync<{ count: number }>(
      `SELECT COUNT(*) as count FROM notifications WHERE user_id = ? AND is_read = 0`,
      [userId],
    );
    return res?.count ?? 0;
  } catch {
    return 0;
  }
}

/**
 * Robustly wipes all tenant-specific local data from the SQLite database.
 * Called securely upon signOut to ensure data does not leak between sessions.
 */
export function clearDatabase(): void {
  try {
    const db = openDatabase();
    const tables = [
      'users', 'properties', 'assets', 'jobs', 'job_assets', 
      'defects', 'inspection_photos', 'signatures', 'time_logs',
      'quotes', 'quote_items', 'notifications', 'sync_queue'
    ];
    
    // Use WAL checkpointing first to ensure all pending operations commit
    db.execSync('PRAGMA wal_checkpoint(TRUNCATE);');
    
    for (const table of tables) {
      try {
        db.runSync(`DELETE FROM ${_safeColumnName(table)};`);
      } catch (err) {
        console.warn(`[UMA BUILDING SERVICES DB] Failed to wipe ${table}:`, err);
      }
    }
    
    // We explicitly leave `asset_type_definitions`, `defect_codes`, `inventory_items`, 
    // and `deleted_photo_ids` intact because they are global dictionary/tombstone tables 
    // and redownloading them on every login is inefficient.
    
    if (__DEV__) console.log('[UMA BUILDING SERVICES DB] Database wiped successfully for sign-out');
  } catch (err) {
    console.error('[UMA BUILDING SERVICES DB] clearDatabase fatal error:', err);
  }
}
