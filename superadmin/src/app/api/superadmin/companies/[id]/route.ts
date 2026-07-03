import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { verifySuperAdmin } from '@/lib/supabase-server';

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const isSuper = await verifySuperAdmin(req);
    if (!isSuper) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { id } = await params;

    const [
      { data: company, error: companyError },
      { data: users, error: usersError },
      { count: jobsCount, error: jobsError }
    ] = await Promise.all([
      supabaseAdmin.from('companies').select('*').eq('id', id).single(),
      supabaseAdmin.from('users').select('id, full_name, email, role, is_active, created_at, phone').eq('company_id', id).order('created_at', { ascending: false }),
      supabaseAdmin.from('jobs').select('id', { count: 'exact', head: true }).eq('company_id', id)
    ]);

    if (companyError) throw companyError;
    if (usersError) throw usersError;
    if (jobsError) throw jobsError;

    return NextResponse.json({
      data: {
        ...company,
        users,
        jobs_count: jobsCount || 0
      }
    });

  } catch (err: any) {
    console.error('API Error in /companies/[id]:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const isSuper = await verifySuperAdmin(req);
    if (!isSuper) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { id } = await params;
    const { name, abn, subscription_status } = await req.json();

    const { data, error } = await supabaseAdmin
      .from('companies')
      .update({ name, abn, subscription_status })
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    return NextResponse.json({ data });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

