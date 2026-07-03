import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { supabaseAdmin } from './supabase-admin';
import { NextRequest } from 'next/server';

export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) => {
              cookieStore.set(name, value, options);
            });
          } catch (error) {
            // The `set` method was called from a Server Component.
            // This can be ignored if you have middleware refreshing
            // user sessions.
          }
        },
      },
    }
  );
}

/**
 * Verifies a superadmin request using a Bearer token from the Authorization header.
 * This is reliable regardless of cookie state.
 */
export async function verifySuperAdmin(req: NextRequest): Promise<boolean> {
  try {
    // 1. Extract Bearer token from Authorization header
    const authHeader = req.headers.get('authorization');
    const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null;
    if (!token) return false;

    // 2. Verify token and get user via service role (most reliable method)
    const { data: { user }, error } = await supabaseAdmin.auth.getUser(token);
    if (error || !user) return false;

    // 3. Check super_admins table
    const { data: superRow } = await supabaseAdmin
      .from('super_admins')
      .select('id')
      .eq('id', user.id)
      .maybeSingle();

    return !!superRow;
  } catch (err) {
    console.error('[supabase-server] verifySuperAdmin error:', err);
    return false;
  }
}
