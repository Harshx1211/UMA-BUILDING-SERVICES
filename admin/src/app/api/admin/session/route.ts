import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { createClient } from '@/lib/supabase-server';

export async function GET(req: NextRequest) {
  try {
    let userId: string | null = null;

    // 1a. Try Bearer token first (most reliable, doesn't depend on cookies)
    const authHeader = req.headers.get('authorization');
    const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null;
    if (token) {
      const { data: { user } } = await supabaseAdmin.auth.getUser(token);
      if (user) userId = user.id;
    }

    // 1b. Fall back to cookie-based session
    if (!userId) {
      const supabase = await createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (user) userId = user.id;
    }

    if (!userId) {
      return NextResponse.json({ valid: false, reason: 'unauthenticated' }, { status: 401 });
    }

    // 2. Fetch user profile (two separate queries to avoid join issues)
    const { data: profile, error: profileError } = await supabaseAdmin
      .from('users')
      .select('role, company_id, is_active')
      .eq('id', userId)
      .single();

    if (profileError || !profile || profile.role !== 'admin') {
      console.warn('[admin/session] Not admin or profile error:', profileError?.message);
      return NextResponse.json({ valid: false, reason: 'not_admin' }, { status: 403 });
    }

    if (profile.is_active === false) {
      console.warn(`[admin/session] User ${userId} is deactivated`);
      return NextResponse.json({ valid: false, reason: 'deactivated' }, { status: 403 });
    }

    // 3. Check company subscription status separately
    if (profile.company_id) {
      const { data: company } = await supabaseAdmin
        .from('companies')
        .select('subscription_status')
        .eq('id', profile.company_id)
        .single();

      if (company && company.subscription_status !== 'active') {
        console.warn(`[admin/session] Company ${profile.company_id} is suspended`);
        return NextResponse.json({ valid: false, reason: 'suspended' }, { status: 403 });
      }
    }

    return NextResponse.json({ valid: true });
  } catch (err) {
    console.error('[admin/session] Unexpected error:', err);
    return NextResponse.json({ valid: false, reason: 'error' }, { status: 500 });
  }
}
