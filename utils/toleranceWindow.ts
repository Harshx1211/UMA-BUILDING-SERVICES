/**
 * utils/toleranceWindow.ts
 *
 * Computes a due-date tolerance window (a date range, not a single point)
 * plus a day-count ("3d late" / "5d until due") for a job — purely derived
 * from jobs.scheduled_date + jobs.job_type, no new schema/columns needed.
 *
 * Keys off the raw Supabase job_type CHECK-constraint values directly
 * rather than importing constants/Enums.ts's JobType — this file has no
 * other reason to depend on that enum, and matching the DB's own string
 * literals here means it can't drift even if that enum's membership ever
 * changes again. Any unrecognized job_type string falls back to
 * DEFAULT_TOLERANCE rather than throwing, since this must never crash a
 * job list row.
 */
import { localDateString } from '@/utils/dateHelpers';

export interface ToleranceWindow {
  /** YYYY-MM-DD */
  windowStart: string;
  /** YYYY-MM-DD */
  windowEnd: string;
  /** >0 = days past windowEnd, <0 = days until windowStart opens, 0 = inside the window */
  daysLateOrLeft: number;
  /** true once today is past windowEnd */
  isLate: boolean;
}

const TOLERANCE_DAYS: Record<string, { before: number; after: number }> = {
  // Routine servicing — tolerance scales with the service's own cadence:
  // a monthly test is time-critical relative to its cycle, so only a few
  // days' slack; annual/5-yearly work has a naturally longer rebooking
  // cycle, so 30-60 days is still proportionally tight.
  routine_service_monthly:   { before: 3,  after: 5 },
  routine_service_3_monthly: { before: 7,  after: 14 },
  routine_service_6_monthly: { before: 14, after: 21 },
  routine_service_annual:    { before: 30, after: 30 },
  routine_service_5_yearly:  { before: 30, after: 60 },
  // Work orders — date-committed, only a few days' grace before "late".
  defect_repair_quote: { before: 0, after: 3 },
  defect_repair:       { before: 0, after: 3 },
  quote:               { before: 0, after: 3 },
  installation:        { before: 0, after: 3 },
  // Emergency — due the day it's scheduled, no slack either direction.
  emergency: { before: 0, after: 0 },
};

const DEFAULT_TOLERANCE = { before: 3, after: 5 };

/** Parses a YYYY-MM-DD string as a LOCAL date (never new Date(str), which parses as UTC midnight). */
function parseLocalDate(dateStr: string): Date {
  const [y, m, d] = dateStr.slice(0, 10).split('-').map(Number);
  return new Date(y, m - 1, d);
}

function addDays(dateStr: string, days: number): string {
  const d = parseLocalDate(dateStr);
  d.setDate(d.getDate() + days);
  return localDateString(d);
}

/** Whole-day difference, b - a, both YYYY-MM-DD, both parsed as local dates. */
function daysBetween(a: string, b: string): number {
  const msPerDay = 24 * 60 * 60 * 1000;
  return Math.round((parseLocalDate(b).getTime() - parseLocalDate(a).getTime()) / msPerDay);
}

export function getToleranceWindow(
  scheduledDate: string,
  jobType: string,
  today: string = localDateString(),
): ToleranceWindow {
  const { before, after } = TOLERANCE_DAYS[jobType] ?? DEFAULT_TOLERANCE;
  const windowStart = addDays(scheduledDate, -before);
  const windowEnd = addDays(scheduledDate, after);

  let daysLateOrLeft = 0;
  if (today > windowEnd) daysLateOrLeft = daysBetween(windowEnd, today);
  else if (today < windowStart) daysLateOrLeft = daysBetween(windowStart, today);

  return { windowStart, windowEnd, daysLateOrLeft, isLate: today > windowEnd };
}
