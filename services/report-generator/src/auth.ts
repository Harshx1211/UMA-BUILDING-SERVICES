import jwt from 'jsonwebtoken';
import { SupabaseClient } from '@supabase/supabase-js';
import { config } from './config';

export class AuthError extends Error {
  constructor(message: string, public status: number) {
    super(message);
  }
}

interface SupabaseJwtPayload {
  sub?: string;
  role?: string;
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
 * This service sits outside that gateway, so we must both verify the signature
 * ourselves (via SUPABASE_JWT_SECRET) and check ownership explicitly.
 */
export function verifyAccessToken(authHeader: string | undefined): string {
  if (!authHeader?.startsWith('Bearer ')) {
    throw new AuthError('Missing or malformed Authorization header', 401);
  }
  const token = authHeader.slice('Bearer '.length);

  let payload: SupabaseJwtPayload;
  try {
    payload = jwt.verify(token, config.supabaseJwtSecret) as SupabaseJwtPayload;
  } catch {
    throw new AuthError('Invalid or expired token', 401);
  }

  if (!payload.sub || payload.role !== 'authenticated') {
    throw new AuthError('Token is not an authenticated user session', 401);
  }
  return payload.sub;
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
