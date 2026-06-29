import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { verifySuperAdmin } from '@/lib/supabase-server';

export async function GET(req: NextRequest) {
  try {
    const isSuper = await verifySuperAdmin();
    if (!isSuper) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const [companiesRes, usersRes, jobsRes] = await Promise.all([
      supabaseAdmin.from('companies').select('*', { count: 'exact', head: true }),
      supabaseAdmin.from('users').select('*', { count: 'exact', head: true }).eq('is_active', true),
      supabaseAdmin.from('jobs').select('*', { count: 'exact', head: true })
    ]);

    return NextResponse.json({
      data: {
        totalCompanies: companiesRes.count ?? 0,
        totalActiveUsers: usersRes.count ?? 0,
        totalJobs: jobsRes.count ?? 0
      }
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
