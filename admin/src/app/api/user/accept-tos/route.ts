import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { createClient } from '@/lib/supabase-server';

export async function POST(req: NextRequest) {
  try {
    let userId: string | null = null;

    // 1. Get the authenticated user
    const authHeader = req.headers.get('authorization');
    const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null;
    
    if (token) {
      const { data: { user } } = await supabaseAdmin.auth.getUser(token);
      if (user) userId = user.id;
    } else {
      const supabase = await createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (user) userId = user.id;
    }

    if (!userId) {
      return NextResponse.json({ error: 'unauthenticated' }, { status: 401 });
    }

    // 2. Update accepted_tos_at using Service Role to bypass RLS limitations
    const now = new Date().toISOString();
    const { error } = await supabaseAdmin
      .from('users')
      .update({ accepted_tos_at: now })
      .eq('id', userId);

    if (error) {
      console.error('[api/user/accept-tos] DB update failed:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, accepted_tos_at: now });
  } catch (err: any) {
    console.error('[api/user/accept-tos] Unexpected error:', err);
    return NextResponse.json({ error: err.message || 'Internal server error' }, { status: 500 });
  }
}
