import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { supabaseAdmin } from './supabase-admin';

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

import { headers } from 'next/headers';

// Helper to reliably get the logged-in user's company ID
// Returns null if: not authenticated, not admin role, OR company is suspended/cancelled
export async function getAdminCompanyId(): Promise<string | null> {
  try {
    // 1. Extract Bearer token from Authorization header
    const headersList = await headers();
    const authHeader = headersList.get('authorization');
    const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null;
    
    let user = null;

    if (token) {
      // Fast, reliable path: verify Bearer token via service role
      const { data, error } = await supabaseAdmin.auth.getUser(token);
      if (!error && data.user) user = data.user;
    } 

    if (!user) {
      // Fallback: try cookies
      const supabase = await createClient();
      const { data } = await supabase.auth.getUser();
      user = data.user;
    }

    if (!user) return null;

    // Fetch the user's role, company_id, and the company's subscription status in one query
    const { data: profile } = await supabaseAdmin
      .from('users')
      .select('company_id, role, companies(subscription_status)')
      .eq('id', user.id)
      .single();

    if (!profile || profile.role !== 'admin') return null;

    // Check the company's subscription_status
    // @ts-ignore
    const companyStatus = Array.isArray(profile.companies) ? profile.companies[0]?.subscription_status : profile.companies?.subscription_status;

    if (companyStatus && companyStatus !== 'active') {
      console.warn(`[supabase-server] Blocked suspended company: ${profile.company_id}`);
      return null;
    }

    return profile.company_id;
  } catch (err) {
    console.error('[supabase-server] getAdminCompanyId error:', err);
    return null;
  }
}
