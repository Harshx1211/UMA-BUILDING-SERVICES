// Universal admin CRUD API route.
// All write operations (insert / update / delete / upsert) from the browser
// go through here — server-side only, uses the service_role key so RLS is bypassed.
import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';

const ALLOWED_TABLES = [
  'jobs', 'properties', 'assets', 'defects', 'users',
  'quotes', 'quote_items', 'notifications', 'time_logs',
  'job_assets', 'inspection_photos', 'signatures', 'inventory_items',
  'asset_type_definitions', 'defect_codes',
];

type Action = 'insert' | 'update' | 'delete' | 'upsert';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { table, action, data, id, match } = body as {
      table: string;
      action: Action;
      data?: Record<string, unknown>;
      id?: string;
      match?: Record<string, unknown>;
    };

    // Validate table name (prevent arbitrary table access)
    if (!ALLOWED_TABLES.includes(table)) {
      return NextResponse.json({ error: `Table '${table}' is not allowed` }, { status: 400 });
    }

    let result: { data: unknown; error: unknown };

    switch (action) {
      case 'insert': {
        if (!data) return NextResponse.json({ error: 'insert requires data' }, { status: 400 });
        result = await supabaseAdmin.from(table).insert(data).select().single();
        break;
      }
      case 'update': {
        if (!data) return NextResponse.json({ error: 'update requires data' }, { status: 400 });
        if (!id && !match) return NextResponse.json({ error: 'update requires id or match' }, { status: 400 });
        let q = supabaseAdmin.from(table).update(data);
        if (id)    q = (q as any).eq('id', id);
        if (match) Object.entries(match).forEach(([k, v]) => { q = (q as any).eq(k, v); });
        result = await (q as any).select().single();
        break;
      }
      case 'delete': {
        if (!id && !match) return NextResponse.json({ error: 'delete requires id or match' }, { status: 400 });
        let q = supabaseAdmin.from(table).delete();
        if (id)    q = (q as any).eq('id', id);
        if (match) Object.entries(match).forEach(([k, v]) => { q = (q as any).eq(k, v); });
        result = await q;
        break;
      }
      case 'upsert': {
        if (!data) return NextResponse.json({ error: 'upsert requires data' }, { status: 400 });
        result = await supabaseAdmin.from(table).upsert(data).select().single();
        break;
      }
      case 'create-user' as Action: {
        // Creates a Supabase auth user + public.users profile in one go.
        // Uses service role so no email confirmation is required.
        const { email, password, full_name, role: userRole, phone } = data ?? {};
        if (!email || !password || !full_name) {
          return NextResponse.json({ error: 'email, password and full_name are required' }, { status: 400 });
        }
        const { data: authUser, error: authErr } = await supabaseAdmin.auth.admin.createUser({
          email: email as string,
          password: password as string,
          email_confirm: true,  // auto-confirm — no email needed
          user_metadata: { full_name },
        });
        if (authErr) {
          return NextResponse.json({ error: authErr.message }, { status: 500 });
        }
        const { error: profileErr } = await supabaseAdmin.from('users').insert({
          id: authUser.user.id,
          email,
          full_name,
          role: userRole ?? 'technician',
          phone: phone ?? null,
          is_active: true,
        });
        if (profileErr) {
          // Roll back the auth user to avoid orphans
          await supabaseAdmin.auth.admin.deleteUser(authUser.user.id);
          return NextResponse.json({ error: profileErr.message }, { status: 500 });
        }
        return NextResponse.json({ data: { id: authUser.user.id, email, full_name, role: userRole } });
      }

      default:
        return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
    }


    if (result.error) {
      console.error(`[admin/api] ${action} ${table}:`, result.error);
      return NextResponse.json({ error: (result.error as any).message ?? 'Database error' }, { status: 500 });
    }

    return NextResponse.json({ data: result.data });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Unknown error';
    console.error('[admin/api] Unexpected error:', msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
