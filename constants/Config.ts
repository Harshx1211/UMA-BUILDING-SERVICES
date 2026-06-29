// App-wide configuration constants — no secrets here, all non-sensitive values

/** How often the background sync service polls for changes (milliseconds) */
export const SYNC_INTERVAL_MS = 60_000;

/** Maximum number of photos that can be attached to a single defect record */
export const MAX_PHOTOS_PER_DEFECT = 10;

/** Human-readable application name used in UI strings */
export const APP_NAME = 'UMA BUILDING SERVICES';

/** Bundle / package identifier matching app.json */
export const BUNDLE_ID = 'com.uma-building-services.app';

/** Number of days job/asset data is retained in the local SQLite cache */
export const OFFLINE_CACHE_DAYS = 30;

/** SQLite database filename stored on-device */
export const DB_NAME = 'uma-building-services.db';

/** AsyncStorage key used to persist the last successful sync timestamp */
export const LAST_SYNCED_KEY = '@uma-building-services/last_synced';

/** AsyncStorage key for the authenticated user session */
export const SESSION_KEY = '@uma-building-services/session';

/** Default page size for paginated Supabase queries */
export const PAGE_SIZE = 50;

/** Timeout (ms) before a Supabase request is considered failed */
export const REQUEST_TIMEOUT_MS = 30_000;

// ─── Colour palette ─────────────────────────────────────────
// Used by Project Work ported screens that import { C } from '@/constants/Config'.
// Mirrors the dark navy-orange field-app design system.
export const C = {
  primary:      '#0F1E3C',   // deep navy
  primaryMid:   '#1A2E52',   // mid navy
  primaryLight: '#243759',   // light navy (card backgrounds)
  surface:      '#182745',   // card surface
  border:       '#2D4068',   // subtle border
  accent:       '#E8650A',   // orange
  accentSoft:   '#FF7A20',   // lighter orange
  success:      '#16A34A',
  danger:       '#DC2626',
  warning:      '#D97706',
  info:         '#2563EB',
  textLight:    '#FFFFFF',
  textBody:     '#CBD5E1',
  textMuted:    '#94A3B8',
  overlay:      'rgba(0,0,0,0.55)',
} as const;
