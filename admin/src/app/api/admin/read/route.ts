// Server-side admin READ API — uses service_role key so RLS is bypassed.
// Allows admin dashboard to read ALL jobs, defects, properties etc. across
// all technicians, not just the ones visible to the currently logged-in user.
import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';

const ALLOWED_TABLES = [
  'jobs', 'properties', 'assets', 'defects', 'users',
  'quotes', 'quote_items', 'notifications', 'time_logs',
  'job_assets', 'inspection_photos', 'signatures', 'inventory_items',
  'asset_type_definitions', 'defect_codes',
];

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      table,
      select = '*',
      filters = {},
      ilike,
      order,
      limit,
      range,
      count = false,
      in: inFilter,
    } = body as {
      table: string;
      select?: string;
      filters?: Record<string, string | number | boolean | null>;
      ilike?: { column: string; pattern: string };
      order?: { column: string; ascending?: boolean } | Array<{ column: string; ascending?: boolean }>;
      limit?: number;
      range?: [number, number];
      count?: boolean;
      in?: { column: string; values: (string | number)[] };
    };

    if (!ALLOWED_TABLES.includes(table)) {
      return NextResponse.json({ error: `Table '${table}' is not allowed` }, { status: 400 });
    }

    // supabaseAdmin bypasses RLS — all rows visible
    let q = supabaseAdmin
      .from(table)
      .select(select, count ? { count: 'exact' } : undefined) as any;

    // Equality filters
    for (const [col, val] of Object.entries(filters)) {
      if (val === null) {
        q = q.is(col, null);
      } else {
        q = q.eq(col, val);
      }
    }

    // IN filter
    if (inFilter) {
      q = q.in(inFilter.column, inFilter.values);
    }

    // ILIKE search
    if (ilike) {
      q = q.ilike(ilike.column, ilike.pattern);
    }

    // Order — supports single or array
    if (order) {
      const orders = Array.isArray(order) ? order : [order];
      for (const o of orders) {
        q = q.order(o.column, { ascending: o.ascending ?? true });
      }
    }

    if (limit != null) q = q.limit(limit);
    if (range)         q = q.range(range[0], range[1]);

    const result = await q;

    if (result.error) {
      console.error(`[admin/read] ${table}:`, result.error);
      return NextResponse.json({ error: result.error.message }, { status: 500 });
    }

    return NextResponse.json({ data: result.data, count: result.count ?? null });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Unknown error';
    console.error('[admin/read] Unexpected error:', msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
