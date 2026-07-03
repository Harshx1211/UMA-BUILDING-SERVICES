/**
 * A drop-in replacement for `fetch` that automatically attaches the current
 * Supabase session's Bearer token to all superadmin API requests.
 * 
 * This bypasses the unreliable cookie-based auth approach and ensures every
 * server API call can reliably verify the caller's identity.
 */
import { supabase } from './supabase';

export async function adminFetch(
  url: string,
  options: RequestInit = {}
): Promise<Response> {
  const { data: { session } } = await supabase.auth.getSession();
  const token = session?.access_token;

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string> ?? {}),
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  return fetch(url, { ...options, headers });
}
