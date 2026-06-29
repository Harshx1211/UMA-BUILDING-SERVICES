import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { verifySuperAdmin } from '@/lib/supabase-server';

export async function GET(req: NextRequest) {
  try {
    const isSuper = await verifySuperAdmin();
    if (!isSuper) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { data, error } = await supabaseAdmin
      .from('enquiries')
      .select('*')
      .is('company_id', null) // Only fetch platform-level SaaS leads
      .order('created_at', { ascending: false });

    if (error) throw error;
    return NextResponse.json({ data });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
