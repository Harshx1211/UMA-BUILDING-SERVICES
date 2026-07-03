// Server-side admin READ BATCH API — executes multiple read queries in parallel
// Reduces HTTP round-trips and redundant authentication overhead.
import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { getAdminCompanyId } from '@/lib/supabase-server';

const ALLOWED_TABLES = [
  'jobs', 'properties', 'assets', 'defects', 'users',
  'quotes', 'quote_items', 'notifications', 'time_logs',
  'job_assets', 'inspection_photos', 'signatures', 'inventory_items',
  'asset_type_definitions', 'defect_codes', 'enquiries',
];

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const queries = body.queries as Array<{
      table: string;
      options?: {
        select?: string;
        filters?: Record<string, string | number | boolean | null>;
        ilike?: { column: string; pattern: string };
        order?: { column: string; ascending?: boolean } | Array<{ column: string; ascending?: boolean }>;
        limit?: number;
        range?: [number, number];
        count?: boolean;
        in?: { column: string; values: (string | number)[] };
      };
    }>;

    if (!Array.isArray(queries) || queries.length === 0) {
      return NextResponse.json({ error: 'queries array is required' }, { status: 400 });
    }

    for (const q of queries) {
      if (!ALLOWED_TABLES.includes(q.table)) {
        return NextResponse.json({ error: `Table '${q.table}' is not allowed` }, { status: 400 });
      }
    }

    // MULTI-TENANT ISOLATION: Fetch authenticated admin's company_id ONCE
    const companyId = await getAdminCompanyId();
    if (!companyId) {
      return NextResponse.json({ error: 'Unauthorized: Invalid admin session or missing company_id' }, { status: 401 });
    }

    // Execute all queries in parallel
    const promises = queries.map(async (queryParam) => {
      const { table, options = {} } = queryParam;
      const { select = '*', filters = {}, ilike, order, limit, range, count = false, in: inFilter } = options;

      let q = supabaseAdmin
        .from(table)
        .select(select, count ? { count: 'exact' } : undefined)
        .eq('company_id', companyId) as any;

      // Equality filters
      for (const [col, val] of Object.entries(filters)) {
        if (val === null) q = q.is(col, null);
        else q = q.eq(col, val);
      }

      // IN filter
      if (inFilter) {
        q = q.in(inFilter.column, inFilter.values);
      }

      // ILIKE search
      if (ilike) {
        q = q.ilike(ilike.column, ilike.pattern);
      }

      // Order
      if (order) {
        const orders = Array.isArray(order) ? order : [order];
        for (const o of orders) {
          q = q.order(o.column, { ascending: o.ascending ?? true });
        }
      }

      if (limit != null) q = q.limit(limit);
      if (range) q = q.range(range[0], range[1]);

      const result = await q;
      
      if (result.error) {
        console.error(`[admin/read-batch] ${table}:`, result.error);
        return { data: [], count: null, error: result.error.message };
      }

      return { data: result.data, count: result.count ?? null, error: null };
    });

    const results = await Promise.all(promises);

    return NextResponse.json({ results });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Unknown error';
    console.error('[admin/read-batch] Unexpected error:', msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
