// supabase/functions/generate-report/index.ts
// Deno Edge Function — server-side AS1851 PDF generation using pdfmake.
// Invoked by the app at: POST /functions/v1/generate-report
// Auth: Bearer <user access_token> in Authorization header.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { buildPdfDefinition } from './pdfLayout.ts';

const SUPABASE_URL            = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_KEY    = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const SUPABASE_ANON_KEY       = Deno.env.get('SUPABASE_ANON_KEY')!;

const CORS = {
  'Access-Control-Allow-Origin':  '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });

  try {
    // ── 1. Auth — verify the caller owns the job ──────────────────────────────
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) return json({ error: 'Missing Authorization header' }, 401);

    // User client — enforces RLS so we know the caller can read this job
    const userClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: authErr } = await userClient.auth.getUser();
    if (authErr || !user) return json({ error: 'Unauthorized' }, 401);

    const { jobId } = await req.json();
    if (!jobId) return json({ error: 'jobId is required' }, 400);

    // Confirm the user can see this job (RLS check)
    const { data: jobCheck } = await userClient.from('jobs').select('id').eq('id', jobId).single();
    if (!jobCheck) return json({ error: 'Job not found or access denied' }, 403);

    // ── 2. Fetch all report data using service role ───────────────────────────
    const db = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

    const [
      { data: job },
      { data: jobAssets },
      { data: defects },
      { data: photos },
      { data: signature },
      { data: timeLogs },
      { data: quotes },
    ] = await Promise.all([
      db.from('jobs').select('*, property:properties(*), assigned_user:users(*)').eq('id', jobId).single(),
      db.from('job_assets').select('*').eq('job_id', jobId),
      db.from('defects').select('*').eq('job_id', jobId),
      db.from('inspection_photos').select('*').eq('job_id', jobId),
      db.from('signatures').select('*').eq('job_id', jobId).maybeSingle(),
      db.from('time_logs').select('*').eq('job_id', jobId),
      db.from('quotes').select('*, items:quote_items(*, inventory_item:inventory_items(*))').eq('job_id', jobId),
    ]);

    if (!job) return json({ error: 'Job not found' }, 404);

    // Fetch company
    const { data: company } = await db.from('companies').select('*').eq('id', job.company_id).single();

    // Fetch assets for this property
    const { data: propertyAssets } = await db.from('assets').select('*').eq('property_id', job.property_id);

    // Merge job_assets results into assets
    const assetsWithResult = (propertyAssets ?? []).map((asset: Record<string, unknown>) => {
      const ja = (jobAssets ?? []).find((j: Record<string, unknown>) => j.asset_id === asset.id);
      return {
        ...asset,
        result: ja?.result ?? null,
        defect_reason: ja?.defect_reason ?? null,
        technician_notes: ja?.technician_notes ?? null,
        inspection_notes: ja?.technician_notes ?? null,
        actioned_at: ja?.actioned_at ?? null,
      };
    });

    const approvedQuote = (quotes ?? []).find((q: Record<string, unknown>) => q.status === 'approved');
    const tech = job.assigned_user as Record<string, unknown> ?? null;
    const techName = (tech?.full_name as string) ?? 'Assigned Technician';
    const reportId = jobId.substring(0, 8).toUpperCase();

    // ── 3. Fetch photo images as base64 for embedding ─────────────────────────
    // Server fetches from Supabase Storage directly — no device bridge overhead.
    const photoMap = new Map<string, string>();
    const photoFetches = (photos ?? [])
      .filter((p: Record<string, unknown>) => p.photo_url && typeof p.photo_url === 'string' && (p.photo_url as string).startsWith('http'))
      .map(async (p: Record<string, unknown>) => {
        try {
          const res = await fetch(p.photo_url as string);
          if (!res.ok) return;
          const buf = await res.arrayBuffer();
          const bytes = new Uint8Array(buf);
          // Chunked encode — spread on large buffers overflows Deno's call stack
          const CHUNK = 8192;
          let b64 = '';
          for (let i = 0; i < bytes.length; i += CHUNK) {
            b64 += btoa(String.fromCharCode(...bytes.subarray(i, i + CHUNK)));
          }
          const mime = res.headers.get('content-type') ?? 'image/jpeg';
          photoMap.set(p.id as string, `data:${mime};base64,${b64}`);
        } catch {
          // photo unavailable — will render placeholder
        }
      });
    // Limit concurrent fetches to 10
    for (let i = 0; i < photoFetches.length; i += 10) {
      await Promise.all(photoFetches.slice(i, i + 10));
    }

    // Inject encoded URIs back into photo records
    const encodedPhotos = (photos ?? []).map((p: Record<string, unknown>) => ({
      ...p,
      photo_url: photoMap.get(p.id as string) ?? null,
    }));

    // ── 4. Build pdfmake document definition ─────────────────────────────────
    const docDef = await buildPdfDefinition({
      job: { ...job, property: job.property as Record<string, unknown> },
      assets: assetsWithResult,
      defects: defects ?? [],
      signature: signature ?? null,
      photos: encodedPhotos,
      timeLogs: timeLogs ?? [],
      techName,
      tech,
      reportId,
      approvedQuote: approvedQuote ?? null,
      quoteItems: approvedQuote?.items ?? [],
      company: company ?? {},
    });

    // ── 5. Generate PDF buffer ────────────────────────────────────────────────
    // Import pdfmake browser build via esm.sh (works in Deno)
    const pdfMake = (await import('https://esm.sh/pdfmake@0.2.10/build/pdfmake.js')).default;
    const pdfFonts = (await import('https://esm.sh/pdfmake@0.2.10/build/vfs_fonts.js')).default;
    pdfMake.vfs = pdfFonts.pdfMake.vfs;

    const pdfBuffer: ArrayBuffer = await new Promise((resolve, reject) => {
      const doc = pdfMake.createPdf(docDef);
      doc.getBuffer((buf: Uint8Array) => resolve(buf.buffer), reject);
    });

    // ── 6. Upload to Supabase Storage ─────────────────────────────────────────
    const storagePath = `job-reports/${jobId}.pdf`;
    const { error: uploadErr } = await db.storage
      .from('job-reports')
      .upload(storagePath, pdfBuffer, {
        contentType: 'application/pdf',
        upsert: true,
      });
    if (uploadErr) throw new Error(`Storage upload failed: ${uploadErr.message}`);

    const { data: { publicUrl } } = db.storage.from('job-reports').getPublicUrl(storagePath);

    // ── 7. Update jobs.report_url ─────────────────────────────────────────────
    await db.from('jobs').update({ report_url: publicUrl }).eq('id', jobId);

    return json({ pdfUrl: publicUrl, pages: docDef.pageCount ?? 0 });
  } catch (err) {
    console.error('[generate-report]', err);
    return json({ error: err instanceof Error ? err.message : 'Internal server error' }, 500);
  }
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, 'Content-Type': 'application/json' },
  });
}
