import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { getAdminCompanyId } from '@/lib/supabase-server';

export async function GET(req: NextRequest) {
  try {
    const companyId = await getAdminCompanyId();
    if (!companyId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { data, error } = await supabaseAdmin
      .from('companies')
      .select('*')
      .eq('id', companyId)
      .single();

    if (error) throw error;
    return NextResponse.json({ data });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  try {
    const companyId = await getAdminCompanyId();
    if (!companyId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json();
    const { name, abn, contact_email, phone, notification_settings, compliance_standards, appearance_settings } = body;

    const { data, error } = await supabaseAdmin
      .from('companies')
      .update({
        name,
        abn,
        contact_email,
        phone,
        notification_settings,
        compliance_standards,
        appearance_settings,
      })
      .eq('id', companyId)
      .select()
      .single();

    if (error) throw error;
    return NextResponse.json({ data });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
