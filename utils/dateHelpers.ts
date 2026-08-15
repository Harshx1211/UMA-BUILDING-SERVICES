/**
 * utils/dateHelpers.ts
 *
 * Timezone-aware date utilities for SiteTrack.
 *
 * WHY THIS EXISTS:
 *   new Date().toISOString().slice(0,10) returns a UTC date string.
 *   In AEST (UTC+10), before 10:00 AM the UTC date is already "yesterday".
 *   This means jobs scheduled for "today" in AU appear on the wrong day for
 *   ~8-10 hours every day, and site-inspect job creation can write yesterday's
 *   date as the scheduled_date.
 *
 *   All date comparisons and new date writes MUST use localDateString() so
 *   the date reflects the technician's physical timezone, not UTC.
 */

/**
 * Returns today's date as an ISO-8601 date string (YYYY-MM-DD) in the
 * device's LOCAL timezone. Use this instead of new Date().toISOString().slice(0,10).
 *
 * Rationale: toLocaleDateString('en-CA') produces the ISO date format (YYYY-MM-DD)
 * which is the same format stored in the database's scheduled_date column.
 *
 * @example
 *   localDateString()          // "2026-08-15" (AEST correct, not UTC yesterday)
 *   toISOString().slice(0,10)  // "2026-08-14" before 10am AEST ← WRONG
 */
export function localDateString(date: Date = new Date()): string {
  return date.toLocaleDateString('en-CA'); // en-CA → YYYY-MM-DD format
}

/**
 * Returns a full ISO-8601 datetime string for the current local time,
 * suitable for writing to database timestamp columns (created_at, updated_at).
 *
 * Unlike toISOString() which is UTC, this keeps the local offset so that
 * any downstream date display logic sees the correct local time.
 *
 * @example
 *   localISOString() // "2026-08-15T09:30:00.000+10:00"
 */
export function localISOString(date: Date = new Date()): string {
  const pad = (n: number, len = 2) => String(n).padStart(len, '0');
  const tzOffset = -date.getTimezoneOffset(); // minutes, positive = ahead of UTC
  const sign = tzOffset >= 0 ? '+' : '-';
  const absOffset = Math.abs(tzOffset);
  const hh = pad(Math.floor(absOffset / 60));
  const mm = pad(absOffset % 60);

  return (
    `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}` +
    `T${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}` +
    `.${String(date.getMilliseconds()).padStart(3, '0')}${sign}${hh}:${mm}`
  );
}

/**
 * Checks whether a given ISO date string (YYYY-MM-DD) represents today
 * in the device's local timezone.
 *
 * @param dateStr  Date string from the database (e.g. job.scheduled_date)
 */
export function isToday(dateStr: string | null | undefined): boolean {
  if (!dateStr) return false;
  return dateStr.slice(0, 10) === localDateString();
}

/**
 * Checks whether a given ISO date string is strictly before today
 * (i.e. the job is overdue) in the device's local timezone.
 */
export function isOverdue(dateStr: string | null | undefined): boolean {
  if (!dateStr) return false;
  return dateStr.slice(0, 10) < localDateString();
}
