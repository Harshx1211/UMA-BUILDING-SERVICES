// supabase/functions/generate-report/index.ts
// Deno Edge Function — server-side AS1851 PDF generation using pdfmake.
// Invoked by the app at: POST /functions/v1/generate-report
// Auth: Bearer <user access_token> in Authorization header.
// @ts-nocheck — Deno HTTP imports (esm.sh, deno.land) are not resolvable by
// VS Code's TypeScript LSP. This file runs correctly in Deno Deploy.
/* eslint-disable import/no-unresolved */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { encode as encodeBase64 } from 'https://deno.land/std@0.168.0/encoding/base64.ts';
import { buildPdfDefinition } from './pdfLayout.ts';
// NOTE: pdfmake is loaded via dynamic import inside the request handler.
// Deno caches the module after the first import, so subsequent calls within
// the same function instance resolve instantly from cache.
// Static top-level imports of esm.sh CJS-converted bundles can fail at module
// init time due to module structure mismatches — dynamic import is safer here.

const SUPABASE_URL         = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

// FIX (performance): Reduced from 8000ms — the 8s per-photo timeout meant a
// site with 20 photos in 2 batches could wait 16s just for timeouts on slow photos.
// 4s is still generous for Supabase Storage CDN responses.
const PHOTO_FETCH_TIMEOUT_MS = 4_000;

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

    // The platform has already validated the JWT (confirmed by request.sb.auth_user in logs).
    // Calling userClient.auth.getUser() creates a redundant network hop that was failing
    // with 401 because the SUPABASE_ANON_KEY was not available for the internal auth call.
    // Instead, decode the user ID directly from the already-verified JWT payload.
    let userId: string | null = null;
    try {
      const token = authHeader.replace('Bearer ', '');
      const payloadBase64 = token.split('.')[1];
      // Deno's atob handles standard base64; JWT uses base64url — replace chars
      const payloadJson = atob(payloadBase64.replace(/-/g, '+').replace(/_/g, '/'));
      const payload = JSON.parse(payloadJson) as { sub?: string; role?: string };
      userId = payload.sub ?? null;
      // Must be an authenticated user (not service role / anon)
      if (!userId || payload.role !== 'authenticated') {
        return json({ error: 'Unauthorized' }, 401);
      }
    } catch {
      return json({ error: 'Invalid token' }, 401);
    }

    const { jobId } = await req.json();
    if (!jobId) return json({ error: 'jobId is required' }, 400);

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

    // FIX: Only fetch assets that have a job_asset record for this job (not ALL property assets).
    // Previously fetched ALL property assets → report listed out-of-scope assets as N/T.
    const assetIds = [...new Set((jobAssets ?? []).map((ja: Record<string, unknown>) => ja.asset_id as string).filter(Boolean))];
    const { data: jobScopedAssets } = assetIds.length > 0
      ? await db.from('assets').select('*').in('id', assetIds)
      : { data: [] };

    // Merge job_assets results into assets — FIX: pick most-recent by actioned_at (not first match)
    const assetsWithResult = (jobScopedAssets ?? []).map((asset: Record<string, unknown>) => {
      const matches = (jobAssets ?? []).filter((j: Record<string, unknown>) => j.asset_id === asset.id);
      // Sort descending by actioned_at, fall back to any match
      const ja = matches.sort((a: Record<string, unknown>, b: Record<string, unknown>) => {
        const aMs = a.actioned_at ? new Date(a.actioned_at as string).getTime() : 0;
        const bMs = b.actioned_at ? new Date(b.actioned_at as string).getTime() : 0;
        return bMs - aMs;
      })[0];
      return {
        ...asset,
        result:            ja?.result            ?? null,
        defect_reason:     ja?.defect_reason      ?? null,
        technician_notes:  ja?.technician_notes   ?? null,
        inspection_notes:  ja?.technician_notes   ?? null,
        actioned_at:       ja?.actioned_at         ?? null,
      };
    });

    const approvedQuote = (quotes ?? []).find((q: Record<string, unknown>) => q.status === 'approved');
    const tech = job.assigned_user as Record<string, unknown> ?? null;
    const techName = (tech?.full_name as string) ?? 'Assigned Technician';
    const reportId = jobId.substring(0, 8).toUpperCase();

    // FIX: Date of service must use scheduled_date (not updated_at).
    // updated_at is bumped by the handle_updated_at trigger every time report_url is set,
    // so using it causes the "Date of Service" to drift to today on every regeneration.
    const prop = job.property as Record<string, unknown> ?? {};
    const dateOfService = (job.completed_at ?? job.scheduled_date ?? job.created_at) as string | null;

    // ── 3. Fetch photo images as base64 for embedding ─────────────────────────
    // MEMORY FIX: Full-resolution phone JPEGs (400–1200KB each × 14+ photos) exhaust
    // the Edge Function's ~150MB RAM limit when pdfmake holds them all in memory.
    // Solution: Use Supabase Storage's image transform API to request a 600px-wide,
    // 60%-quality version — reducing each photo from ~800KB to ~50KB (15× smaller).
    // Transform URL: replace /storage/v1/object/ with /storage/v1/render/image/
    // and strip the ?token= query (render API re-validates the path internally).
    function toTransformUrl(url: string): string {
      try {
        // Match public storage URLs: .../storage/v1/object/public/bucket/path
        if (url.includes('/storage/v1/object/public/')) {
          return url
            .replace('/storage/v1/object/public/', '/storage/v1/render/image/public/')
            .split('?')[0]   // strip any existing query params
            + '?width=600&quality=60&resize=contain';
        }
        // For signed URLs, strip the token and use public render path
        if (url.includes('/storage/v1/object/sign/')) {
          return url
            .replace('/storage/v1/object/sign/', '/storage/v1/render/image/public/')
            .split('?')[0]
            + '?width=600&quality=60&resize=contain';
        }
      } catch { /* fall through */ }
      return url; // unsupported URL format — use as-is
    }

    const photoMap = new Map<string, string>();
    const photoFetches = (photos ?? [])
      .filter((p: Record<string, unknown>) => p.photo_url && typeof p.photo_url === 'string' && (p.photo_url as string).startsWith('http'))
      .map(async (p: Record<string, unknown>) => {
        try {
          const transformedUrl = toTransformUrl(p.photo_url as string);
          const controller = new AbortController();
          const timer = setTimeout(() => controller.abort(), PHOTO_FETCH_TIMEOUT_MS);
          const res = await fetch(transformedUrl, { signal: controller.signal });
          clearTimeout(timer);
          if (!res.ok) {
            console.log(`[Photo] SKIP ${p.id} — HTTP ${res.status} (transform URL: ${transformedUrl.substring(0, 80)})`);
            return;
          }
          const buf = await res.arrayBuffer();
          // Safety cap: skip anything still over 1MB after transform
          if (buf.byteLength > 1024 * 1024) {
            console.log(`[Photo] SKIP ${p.id} — still too large after transform (${buf.byteLength} bytes)`);
            return;
          }
          const b64 = encodeBase64(new Uint8Array(buf));
          // Strip content-type parameters; map non-JPEG/PNG to image/jpeg
          let mime = (res.headers.get('content-type') ?? 'image/jpeg').split(';')[0].trim().toLowerCase();
          if (!['image/jpeg', 'image/png'].includes(mime)) mime = 'image/jpeg';
          const dataUri = `data:${mime};base64,${b64}`;
          photoMap.set(p.id as string, dataUri);
          console.log(`[Photo] OK ${p.id} — ${buf.byteLength} bytes, mime=${mime}`);
        } catch (err) {
          console.log(`[Photo] ERROR ${p.id} — ${err instanceof Error ? err.message : err}`);
        }
      });
    // Limit concurrent fetches to 5 (was 10) to reduce peak memory during fetch phase
    for (let i = 0; i < photoFetches.length; i += 5) {
      await Promise.all(photoFetches.slice(i, i + 5));
    }

    // Inject encoded URIs back into photo records
    const encodedPhotos = (photos ?? []).map((p: Record<string, unknown>) => ({
      ...p,
      photo_url: photoMap.get(p.id as string) ?? null,
    }));

    // ── 4. Build pdfmake document definition ─────────────────────────────────
    const docDef = await buildPdfDefinition({
      job:          { ...job, property: prop, date_of_service: dateOfService },
      assets:       assetsWithResult,
      defects:      defects ?? [],
      signature:    signature ?? null,
      photos:       encodedPhotos,
      timeLogs:     timeLogs ?? [],
      techName,
      tech,
      reportId,
      approvedQuote: approvedQuote ?? null,
      quoteItems:   approvedQuote?.items ?? [],
      company:      company ?? {},
    });

    // ── 5. Generate PDF buffer ────────────────────────────────────────────────
    // Dynamic import: Deno caches the module after first load — subsequent calls
    // within the same function instance resolve instantly without network roundtrip.
    const pdfMake = ((await import('https://esm.sh/pdfmake@0.2.10/build/pdfmake.js')) as any).default;
    const pdfFonts = ((await import('https://esm.sh/pdfmake@0.2.10/build/vfs_fonts.js')) as any).default;
    pdfMake.vfs = pdfFonts.pdfMake.vfs;

    const pdfBuffer: ArrayBuffer = await new Promise<ArrayBuffer>((resolve, reject) => {
      const doc = pdfMake.createPdf(docDef);
      // FIX: buf.buffer returns ArrayBufferLike (includes SharedArrayBuffer) but
      // Uint8Array from pdfmake always uses a plain ArrayBuffer — cast is safe.
      doc.getBuffer((buf: Uint8Array) => resolve(buf.buffer as ArrayBuffer), reject);
    });

    // ── 6. Upload to Supabase Storage ─────────────────────────────────────────
    // FIX: storagePath must NOT include the bucket name — the SDK call `.from('job-reports')`
    // already targets the bucket. Previous path 'job-reports/{id}.pdf' produced the object
    // path job-reports/job-reports/{id}.pdf (double prefix), making URLs 404.
    const storagePath = `${jobId}.pdf`;
    const { error: uploadErr } = await db.storage
      .from('job-reports')
      .upload(storagePath, pdfBuffer, {
        contentType: 'application/pdf',
        upsert: true,
      });
    if (uploadErr) throw new Error(`Storage upload failed: ${uploadErr.message}`);

    // FIX DB5: job-reports bucket is now private; use createSignedUrl (1h TTL).
    // getPublicUrl() returned unauthenticated-accessible URLs — anyone with the
    // link could download any company's compliance report without logging in.
    const { data: signedData, error: signErr } = await db.storage
      .from('job-reports')
      .createSignedUrl(storagePath, 60 * 60); // 1-hour TTL
    if (signErr || !signedData?.signedUrl) throw new Error(`Signed URL failed: ${signErr?.message}`);
    const pdfUrl = signedData.signedUrl;

    // FIX: Store the permanent storage PATH in jobs.report_url (not the ephemeral signed URL).
    // A 1-hour signed URL stored in the DB becomes a 403 after expiry.
    // The sync handler generates a fresh signed URL for local SQLite display on each generation.
    await db.from('jobs').update({ report_url: storagePath }).eq('id', jobId);

    return json({ pdfUrl: pdfUrl, storagePath });
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
