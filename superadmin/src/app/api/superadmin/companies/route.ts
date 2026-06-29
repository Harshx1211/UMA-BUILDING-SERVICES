import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { verifySuperAdmin } from '@/lib/supabase-server';

export async function GET(req: NextRequest) {
  try {
    const isSuper = await verifySuperAdmin();
    if (!isSuper) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    // Fetch companies and some basic counts (using a lateral join or just select)
    // Supabase allows referencing related tables if FKs exist
    const { data, error } = await supabaseAdmin
      .from('companies')
      .select(`
        *,
        users (count),
        jobs (count)
      `)
      .order('created_at', { ascending: false });

    if (error) throw error;
    
    // Flatten counts
    const mapped = data.map((c: any) => ({
      ...c,
      users_count: c.users?.[0]?.count ?? 0,
      jobs_count: c.jobs?.[0]?.count ?? 0,
      users: undefined,
      jobs: undefined
    }));

    return NextResponse.json({ data: mapped });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const isSuper = await verifySuperAdmin();
    if (!isSuper) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json();
    const { name, abn, adminEmail, adminPassword, adminName } = body;

    if (!name || !adminEmail || !adminPassword) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    // 1. Create the Auth User (Supabase Auth API)
    const { data: authUser, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email: adminEmail,
      password: adminPassword,
      email_confirm: true,
      user_metadata: { full_name: adminName || 'Admin' }
    });

    if (authError) throw authError;

    // 2. Insert the Company
    const { data: company, error: companyError } = await supabaseAdmin
      .from('companies')
      .insert({ name, abn })
      .select()
      .single();

    if (companyError) {
      // Rollback auth user if company fails
      await supabaseAdmin.auth.admin.deleteUser(authUser.user.id);
      throw companyError;
    }

    // 3. Create the Admin Profile in users table
    const { error: profileError } = await supabaseAdmin
      .from('users')
      .insert({
        id: authUser.user.id,
        company_id: company.id,
        email: adminEmail,
        full_name: adminName || 'Admin',
        role: 'admin',
        is_active: true
      });

    if (profileError) {
      // Rollback
      await supabaseAdmin.auth.admin.deleteUser(authUser.user.id);
      await supabaseAdmin.from('companies').delete().eq('id', company.id);
      throw profileError;
    }

    return NextResponse.json({ data: company });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
