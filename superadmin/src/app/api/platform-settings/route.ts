import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { verifySuperAdmin } from '@/lib/supabase-server';

export async function GET() {
  try {
    const { data, error } = await supabaseAdmin
      .from('platform_settings')
      .select('*')
      .eq('id', 'global')
      .single();

    if (error && error.code !== 'PGRST116') {
      throw error;
    }

    // Default fallback if table is empty
    return NextResponse.json({
      data: data || {
        platform_name: 'SiteTrack',
        support_email: 'support@sitetrack.io',
        website_url: 'https://sitetrack.io'
      }
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  try {
    const isSuper = await verifySuperAdmin(req);
    if (!isSuper) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json();
    const { platform_name, support_email, website_url } = body;

    const { data, error } = await supabaseAdmin
      .from('platform_settings')
      .upsert({
        id: 'global',
        platform_name,
        support_email,
        website_url,
        updated_at: new Date().toISOString()
      })
      .select()
      .single();

    if (error) throw error;
    return NextResponse.json({ data });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
