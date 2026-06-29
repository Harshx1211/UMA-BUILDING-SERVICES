import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';

export async function POST(req: NextRequest) {
  try {
    const { userId } = await req.json();
    if (!userId) return NextResponse.json({ isSuper: false }, { status: 400 });

    const { data } = await supabaseAdmin
      .from('super_admins')
      .select('id')
      .eq('id', userId)
      .maybeSingle();

    return NextResponse.json({ isSuper: !!data });
  } catch {
    return NextResponse.json({ isSuper: false }, { status: 500 });
  }
}
