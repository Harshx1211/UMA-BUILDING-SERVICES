// App-wide configuration constants — no secrets here, all non-sensitive values

/** How often the background sync service polls for changes (milliseconds) */
export const SYNC_INTERVAL_MS = 60_000;

/** Human-readable application name — SiteTrack is the platform brand */
export const APP_NAME = 'SiteTrack';

/** Bundle / package identifier matching app.json */
export const BUNDLE_ID = 'com.sitetrack.app';

/** SQLite database filename stored on-device */
export const DB_NAME = 'sitetrack.db';

/** AsyncStorage key used to persist the last successful sync timestamp */
export const LAST_SYNCED_KEY = '@sitetrack/last_synced';

/** AsyncStorage key for the authenticated user session */
export const SESSION_KEY = '@sitetrack/session';

/** Supabase Storage bucket names — must match services/report-generator/src/config.ts */
export const PHOTO_BUCKET = 'job-photos';
export const REPORT_BUCKET = 'job-reports';
