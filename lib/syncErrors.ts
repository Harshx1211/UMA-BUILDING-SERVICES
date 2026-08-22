// syncErrors.ts — classifies a failed Supabase push so the sync engine knows
// whether retrying could ever help, following the standard retryable-vs-terminal
// split used by most offline-sync engines (network/5xx/timeout = retry;
// 4xx-shaped data/permission problems = stop immediately, they won't fix themselves).

/** Postgres SQLSTATE codes that mean "this will never succeed by retrying" */
const TERMINAL_PG_CODES = new Set([
  '23503', // foreign_key_violation — referenced row doesn't exist
  '23502', // not_null_violation — required field missing
  '23514', // check_violation — value fails a CHECK constraint
  '42501', // insufficient_privilege — RLS/permission denial
  '22P02', // invalid_text_representation — malformed input (e.g. bad UUID)
  '42703', // undefined_column
  '42P01', // undefined_table
]);

/** Postgres SQLSTATE for unique_violation — see classifySyncError() doc below */
const DUPLICATE_PG_CODE = '23505';

export interface ClassifiedSyncError {
  /** True if this failure might succeed on a later attempt (network blip, timeout, server hiccup) */
  retryable: boolean;
  /**
   * True when the "failure" is actually a sign the operation already succeeded —
   * e.g. an INSERT retried after the client lost the response to a dropped
   * connection, but the row made it to the server the first time. Callers
   * should treat this as success, not failure.
   */
  isDuplicate: boolean;
}

/**
 * Classifies an error from a Supabase push so the caller knows whether to
 * retry, give up immediately, or treat it as a hidden success.
 *
 * Unknown shapes (no `code` — plain network errors, thrown JS exceptions,
 * fetch failures) default to retryable: a transient issue is far more likely
 * than a permanent one when the error doesn't carry a specific Postgres code.
 */
export function classifySyncError(
  error: { code?: string; message?: string } | null | undefined,
): ClassifiedSyncError {
  const code = error?.code;

  if (code === DUPLICATE_PG_CODE) {
    return { retryable: false, isDuplicate: true };
  }
  if (code && TERMINAL_PG_CODES.has(code)) {
    return { retryable: false, isDuplicate: false };
  }
  return { retryable: true, isDuplicate: false };
}
