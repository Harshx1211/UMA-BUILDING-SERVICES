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

// Helper to reliably check if the logged-in user is a superadmin
export async function verifySuperAdmin(): Promise<boolean> {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return false;

    // Fetch the user from super_admins table
    const { data: profile, error } = await supabaseAdmin
      .from('super_admins')
      .select('id')
      .eq('id', user.id)
      .maybeSingle();
      
    if (error) {
      console.error('[supabase-server] Error checking super_admins:', error);
    }

    return !!profile;
  } catch (err) {
    console.error('[supabase-server] verifySuperAdmin error:', err);
    return false;
  }
}
