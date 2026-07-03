import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { verifySuperAdmin } from '@/lib/supabase-server';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const isSuper = await verifySuperAdmin(req);
    if (!isSuper) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { data, error } = await supabaseAdmin
      .from('audit_logs')
      .select(`
        id,
        table_name,
        record_id,
        action,
        old_data,
        new_data,
        created_at,
        changed_by,
        users!changed_by(full_name, email)
      `)
      .order('created_at', { ascending: false })
      .limit(100);

    if (error) throw error;

    return NextResponse.json({ data });
  } catch (err: any) {
    console.error('[audit_logs] Error:', err.message);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
