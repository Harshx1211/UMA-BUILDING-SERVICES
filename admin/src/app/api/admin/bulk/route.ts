// Bulk insert API route — accepts { table, rows[] } and batch-inserts via service_role.
// Used exclusively for CSV imports. Batches rows in groups of 100 to avoid payload limits.
import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { getAdminCompanyId } from '@/lib/supabase-server';

const ALLOWED_TABLES = [
  'properties', 'assets', 'jobs', 'defects',
  'asset_type_definitions', 'defect_codes', 'inventory_items',
];

const BATCH_SIZE = 100;

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { table, rows } = body as { table: string; rows: Record<string, unknown>[] };

    if (!ALLOWED_TABLES.includes(table)) {
      return NextResponse.json({ error: `Table '${table}' is not allowed` }, { status: 400 });
    }
    if (!Array.isArray(rows) || rows.length === 0) {
      return NextResponse.json({ error: 'rows must be a non-empty array' }, { status: 400 });
    }

    // MULTI-TENANT ISOLATION: Fetch authenticated admin's company_id
    const companyId = await getAdminCompanyId();
    if (!companyId) {
      return NextResponse.json({ error: 'Unauthorized: Invalid admin session or missing company_id' }, { status: 401 });
    }

    let inserted = 0;
    const errors: string[] = [];

    for (let i = 0; i < rows.length; i += BATCH_SIZE) {
      const batch = rows.slice(i, i + BATCH_SIZE).map(row => ({
        ...row,
        company_id: companyId // Force-inject company_id into every row
      }));
      const { error, count } = await supabaseAdmin
        .from(table)
        .insert(batch)
        .select('id');

      if (error) {
        errors.push(`Batch ${Math.floor(i / BATCH_SIZE) + 1}: ${error.message}`);
      } else {
        inserted += batch.length;
      }
    }

    return NextResponse.json({ inserted, errors });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Unknown error';
    console.error('[admin/bulk] Error:', msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
