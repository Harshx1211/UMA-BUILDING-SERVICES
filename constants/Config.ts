// App-wide configuration constants — no secrets here, all non-sensitive values

/** How often the background sync service polls for changes (milliseconds) */
export const SYNC_INTERVAL_MS = 60_000;

/** Maximum number of photos that can be attached to a single defect record */
export const MAX_PHOTOS_PER_DEFECT = 10;

/** Human-readable application name used in UI strings */
export const APP_NAME = 'SiteTrack';

/** Bundle / package identifier matching app.json */
export const BUNDLE_ID = 'com.sitetrack.app';

/** Number of days job/asset data is retained in the local SQLite cache */
export const OFFLINE_CACHE_DAYS = 30;

/** SQLite database filename stored on-device */
export const DB_NAME = 'sitetrack.db';

/** AsyncStorage key used to persist the last successful sync timestamp */
export const LAST_SYNCED_KEY = '@sitetrack/last_synced';

/** AsyncStorage key for the authenticated user session */
export const SESSION_KEY = '@sitetrack/session';

/** Default page size for paginated Supabase queries */
export const PAGE_SIZE = 50;

/** Timeout (ms) before a Supabase request is considered failed */
export const REQUEST_TIMEOUT_MS = 30_000;
