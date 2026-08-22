import { SupabaseClient } from '@supabase/supabase-js';

export class AuthError extends Error {
  constructor(message: string, public status: number) {
    super(message);
  }
}

/**
 * Verifies the caller's Supabase access token AND confirms they belong to the
 * same company as the job they're asking us to generate a report for.
 *
 * This fixes a real gap in the previous Supabase Edge Function implementation:
 * that function only checked "is this a syntactically valid, already-authenticated
 * JWT" (safe there because Supabase's own gateway pre-validates the signature
 * before the function ever runs) — it never checked job ownership, so any
 * logged-in user could trigger report generation for any jobId.
 *
 * This service sits outside that gateway, so it must verify the token itself.
 * That's delegated to Supabase's own SDK (`auth.getUser(token)`) rather than
 * hand-rolling JWT signature verification against a fixed secret: this
 * project's JWT signing was rotated from a legacy shared HS256 secret to
 * asymmetric ECC (P-256) signing keys, and letting Supabase's own client
 * validate the token means this keeps working transparently across whichever
 * key type actually signed a given token (old tokens still verify against the
 * legacy key until they expire; new ones verify against the current key) —
 * a hand-rolled `jwt.verify(token, staticSecret)` would silently reject every
 * token issued after a future rotation like this one already happened once.
 */
export async function verifyAccessToken(db: SupabaseClient, authHeader: string | undefined): Promise<string> {
  if (!authHeader?.startsWith('Bearer ')) {
    throw new AuthError('Missing or malformed Authorization header', 401);
  }
  const token = authHeader.slice('Bearer '.length);

  const { data, error } = await db.auth.getUser(token);
  if (error || !data.user) {
    throw new AuthError('Invalid or expired token', 401);
  }
  return data.user.id;
}

/** Throws AuthError(403) if the caller's company doesn't own the job. */
export async function assertOwnsJob(
  db: SupabaseClient,
  userId: string,
  jobCompanyId: string,
): Promise<void> {
  const { data: caller, error } = await db
    .from('users')
    .select('company_id')
    .eq('id', userId)
    .single();

  if (error || !caller) {
    throw new AuthError('Caller account not found', 403);
  }
  if (caller.company_id !== jobCompanyId) {
    throw new AuthError('You do not have access to this job', 403);
  }
}
