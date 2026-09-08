// App-wide configuration constants — no secrets here, all non-sensitive values

/**
 * How often the background full push+pull runs (milliseconds) — this is a
 * safety net, not the app's primary data path. The actual "stay live while
 * online" job is done by two other mechanisms: useNetworkStatus's
 * offline->online reconnect trigger, and subscribeToJobLive's per-job
 * Realtime channel (lib/sync.ts) for whatever job a technician currently
 * has open. This interval only needs to catch what those two can't: a
 * missed/dropped Realtime event, or a change to something with no Realtime
 * channel at all (catalogue tables, properties, assets, a job not
 * currently open on this device). Was 60s — every device was re-running
 * the ~20-25-call full pull once a minute forever regardless of whether
 * anything had changed, which was never the intent (see the "was this
 * offline sync ever meant to run root this way" discussion). 10 minutes
 * keeps that reconciliation pass without it being the thing everything
 * else quietly depended on.
 */
export const SYNC_INTERVAL_MS = 10 * 60_000;

/** Human-readable application name — SiteTrack is the platform brand */
export const APP_NAME = 'SiteTrack';

/** Bundle / package identifier matching app.json */
export const BUNDLE_ID = 'com.sitetrack.app';

/** SQLite database filename stored on-device */
export const DB_NAME = 'sitetrack.db';

/** AsyncStorage key used to persist the last successful sync timestamp */
export const LAST_SYNCED_KEY = '@sitetrack/last_synced';

/** AsyncStorage key for the highest public.deletion_log.id this device has
 * already applied — see _pullDeletions in lib/sync.ts. */
export const LAST_DELETION_LOG_ID_KEY = '@sitetrack/last_deletion_log_id';

/** AsyncStorage key for the authenticated user session */
export const SESSION_KEY = '@sitetrack/session';

/** Supabase Storage bucket names — must match services/report-generator/src/config.ts */
export const PHOTO_BUCKET = 'job-photos';
export const REPORT_BUCKET = 'job-reports';
export const DOCUMENT_BUCKET = 'site-documents';
