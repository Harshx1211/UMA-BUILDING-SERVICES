import { timingSafeEqual } from 'node:crypto';
import express from 'express';
import { config } from './config';
import { db } from './supabaseClient';
import { AuthError, assertOwnsJob, verifyAccessToken, fetchCaller } from './auth';
import { tryAcquireLock, markGenerationResult, getGenerationStatus } from './generation/lock';
import { generateReport, renderReportPdf } from './generation/pipeline';
import { warmUpPdfjs } from './pdf/pageMarkers';
import { closeSpareBrowser, prepareSpareBrowser } from './render/chromium';
import { warmJobThumbnails } from './photos/prepareInlinePhotos';
import { signExistingReport } from './storage';
import { buildSyntheticReport } from './diagnostics/synthetic';

const app = express();
// Every response here is a live, per-user answer (mostly /report-status,
// polled every 5s). With Express's default ETags the app's HTTP stack sent
// conditional requests and got 304 Not Modified with an empty body, which
// the client couldn't use. Never let these be cached or revalidated.
app.set('etag', false);
app.use((_req, res, next) => { res.set('Cache-Control', 'no-store'); next(); });
// Don't advertise the framework (X-Powered-By: Express) to scanners.
app.disable('x-powered-by');
// Bodies here are tiny ({ jobId }) — cap them well below Express's 100kb default.
app.use(express.json({ limit: '10kb' }));
app.use((_req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  next();
});

/**
 * Per-user throttle on starting generations. The atomic lock already stops
 * duplicate runs for the SAME job, but nothing stopped one signed-in user
 * from starting generations for every job in their company in a loop —
 * each one a full Chromium render on paid compute. Generous for real use
 * (a technician generates a handful of reports a day). In-memory and
 * per-instance, which is fine here: --max-instances caps the multiplier,
 * and this is about runaway loops and abuse, not exact accounting.
 */
const GENERATE_LIMIT = 10;
const GENERATE_WINDOW_MS = 10 * 60_000;
const generateLog = new Map<string, number[]>();
function allowGenerate(userId: string): boolean {
  const now = Date.now();
  const recent = (generateLog.get(userId) ?? []).filter((t) => now - t < GENERATE_WINDOW_MS);
  if (recent.length >= GENERATE_LIMIT) {
    generateLog.set(userId, recent);
    return false;
  }
  recent.push(now);
  generateLog.set(userId, recent);
  return true;
}

// POST /prepare is cheap per call but triggered from screens the
// technician opens, so it gets its own (more generous) budget, separate
// from report generation's.
const PREPARE_LIMIT = 30;
const prepareLog = new Map<string, number[]>();
function allowPrepare(userId: string): boolean {
  const now = Date.now();
  const recent = (prepareLog.get(userId) ?? []).filter((t) => now - t < GENERATE_WINDOW_MS);
  if (recent.length >= PREPARE_LIMIT) {
    prepareLog.set(userId, recent);
    return false;
  }
  recent.push(now);
  prepareLog.set(userId, recent);
  return true;
}
// Jobs whose thumbnails are being prepared right now — one at a time each.
const preparing = new Set<string>();

// Jobs whose generation is running in THIS process right now. Generation is
// fire-and-forget after the 202 (see POST /generate-report), so without this
// a redeploy/restart silently killed whatever was mid-render,
// leaving its report_generation_status row stuck at 'generating' until the
// stale-lock window in generation/lock.ts finally expired. See the SIGTERM
// handler at the bottom of this file.
const inFlight = new Set<string>();
let shuttingDown = false;

// How long a SIGTERM waits for in-flight generations to finish on their own
// before giving up on them. Cloud Run only allows 10s between SIGTERM and a
// force-kill, so the default stays under that.
const SHUTDOWN_GRACE_MS = Number.parseInt(process.env.SHUTDOWN_GRACE_MS ?? '', 10) || 8_000;

app.get('/health', (_req, res) => res.json({ ok: true }));

/**
 * Express 4 doesn't catch errors thrown inside async handlers: one escaped
 * rejection (e.g. a Supabase read that fails) would become an unhandled
 * rejection, which crashes the whole Node process, and every other report
 * rendering in it. This routes them to the error handler at the bottom
 * (a 500, which the app retries) instead.
 */
type AsyncHandler = (req: express.Request, res: express.Response) => Promise<unknown>;
const route = (fn: AsyncHandler): express.RequestHandler => (req, res, next) => {
  fn(req, res).catch(next);
};

/** Shared by both endpoints: verify the token, then that the caller's company owns the job. */
/** Returns the caller's user id when allowed; null when it has already sent the error response. */
async function authorize(req: express.Request, res: express.Response, jobId: string): Promise<string | null> {
  let userId: string;
  try {
    userId = await verifyAccessToken(db, req.headers.authorization);
  } catch (err) {
    const status = err instanceof AuthError ? err.status : 401;
    res.status(status).json({ error: err instanceof Error ? err.message : 'Unauthorized' });
    return null;
  }

  try {
    // Independent lookups — run together rather than one after the other.
    const [{ data: job, error: jobErr }, caller] = await Promise.all([
      db.from('jobs').select('company_id').eq('id', jobId).single(),
      fetchCaller(db, userId),
    ]);
    if (jobErr || !job) {
      res.status(404).json({ error: 'Job not found' });
      return null;
    }
    await assertOwnsJob(db, userId, job.company_id, caller);
    return userId;
  } catch (err) {
    const status = err instanceof AuthError ? err.status : 500;
    res.status(status).json({ error: err instanceof Error ? err.message : 'Authorization check failed' });
    return null;
  }
}

/**
 * Kicks off generation and responds immediately once it's safely queued,
 * rather than holding the HTTP connection open for the entire generation.
 *
 * The original design awaited the full pipeline before responding — fine for
 * a quick job, but fragile for anything large: mobile networks (and even
 * some carrier NATs) can drop a long-idle-but-open connection well before a
 * multi-minute generation finishes, at which point the client has no way to
 * know whether the work is still running, failed, or actually finished. The
 * client now polls GET /report-status instead (see below), which the
 * existing mobile-app screen (app/(app)/jobs/[id]/preview.tsx) already had
 * the UI for — it just needed the server side to stop blocking.
 */
app.post('/generate-report', route(async (req, res) => {
  const { jobId } = req.body ?? {};
  if (!jobId || typeof jobId !== 'string') {
    return res.status(400).json({ error: 'jobId is required' });
  }

  const userId = await authorize(req, res, jobId);
  if (!userId) return; // authorize() already sent the response

  if (!allowGenerate(userId)) {
    return res.status(429).json({ error: 'Too many reports started recently. Please wait a few minutes and try again.' });
  }

  // A request that slips in on a kept-alive connection after SIGTERM must
  // not start a generation this process is about to abandon. 503 is
  // retryable on the mobile side (lib/sync.ts only treats 2xx/409 as done),
  // so the next sync cycle lands it on the replacement instance instead.
  if (shuttingDown) {
    return res.status(503).json({ error: 'Report service is restarting — please retry shortly.' });
  }

  const lock = await tryAcquireLock(db, jobId);
  if (!lock.acquired) {
    // 409 = genuinely already generating (the app treats that as accepted);
    // 503 = the lock check itself failed (the app retries).
    return res.status(lock.retryable ? 503 : 409).json({ error: lock.reason });
  }

  if (config.internalRunSecret) {
    // Cloud Run: hand the work to a separate request (see /internal/run) and
    // only answer 202 once that request has actually been accepted.
    try {
      await startInternalRun(req, jobId);
    } catch (err) {
      const message = `Could not start report generation: ${err instanceof Error ? err.message : err}`;
      await markGenerationResult(db, jobId, 'failed', message).catch(() => {});
      return res.status(503).json({ error: message });
    }
    return res.status(202).json({ status: 'generating' });
  }

  res.status(202).json({ status: 'generating' });

  // Deliberately not awaited — this continues running after the response
  // above has already been sent. Errors are caught and recorded in
  // report_generation_status for the client to discover via polling, never
  // left to become an unhandled rejection.
  void runGeneration(jobId);
}));

/**
 * Prepares a job's photo thumbnails ahead of generation (see
 * warmJobThumbnails). The app calls this when the technician reaches the
 * sign-off / report summary screens; by the time they tap Generate the slow
 * part of photo handling is already done on this instance. Same auth and
 * ownership checks as generation. Returns nothing but a count — it only
 * warms a cache. Held open until finished so Cloud Run keeps the CPU
 * allocated (the app doesn't wait on it).
 */
app.post('/prepare', route(async (req, res) => {
  const { jobId } = req.body ?? {};
  if (!jobId || typeof jobId !== 'string') {
    return res.status(400).json({ error: 'jobId is required' });
  }
  const userId = await authorize(req, res, jobId);
  if (!userId) return;
  if (!allowPrepare(userId)) {
    return res.status(429).json({ error: 'Too many requests' });
  }
  if (shuttingDown) return res.status(503).end();
  if (preparing.has(jobId)) return res.status(202).json({ status: 'already preparing' });

  preparing.add(jobId);
  const started = Date.now();
  try {
    // The next report's browser too (render/chromium.ts) — started here,
    // while this request holds the CPU, rather than when they tap Generate.
    const [photos] = await Promise.all([
      warmJobThumbnails(db, jobId, config.photoBucket),
      prepareSpareBrowser(),
    ]);
    console.log(`[prepare] job=${jobId} photos=${photos} took=${Date.now() - started}ms`);
    return res.json({ status: 'ready', photos });
  } finally {
    preparing.delete(jobId);
  }
}));

/**
 * Caps how many reports render at once in THIS instance. Each render
 * launches its own Chromium (~900MB for a 1200-asset site, plus Node's own
 * ~500MB), but Cloud Run's --concurrency 8 lets up to 8 requests — and so up
 * to 8 /internal/run renders — land on one 4Gi instance together. Without a
 * cap, a few technicians generating at the same moment could push it past
 * its memory limit, and an out-of-memory kill gets no SIGTERM: every report
 * on that instance would sit at 'generating' until the stale-lock window in
 * generation/lock.ts expired. Extra renders wait here for a slot instead;
 * their /internal/run request stays open, so Cloud Run keeps the CPU
 * allocated and the instance alive while they wait.
 */
const MAX_CONCURRENT_RENDERS = Number.parseInt(process.env.MAX_CONCURRENT_RENDERS ?? '', 10) || 2;
let activeRenders = 0;
const renderWaiters: Array<() => void> = [];

async function acquireRenderSlot(): Promise<void> {
  if (activeRenders < MAX_CONCURRENT_RENDERS) {
    activeRenders++;
    return;
  }
  // The slot is handed over directly by releaseRenderSlot (activeRenders
  // isn't decremented then re-incremented), so no newcomer can jump the queue.
  await new Promise<void>((resolve) => renderWaiters.push(resolve));
}

function releaseRenderSlot(): void {
  const next = renderWaiters.shift();
  if (next) next();
  else activeRenders--;
}

/**
 * Runs the whole pipeline for one job and records the outcome in
 * report_generation_status. Never throws.
 */
async function runGeneration(jobId: string): Promise<void> {
  inFlight.add(jobId);
  await acquireRenderSlot();
  try {
    const result = await generateReport(db, jobId);
    await markGenerationResult(db, jobId, 'completed');
    console.log(
      `[generate-report] job=${jobId} assets=${result.assetCount} chunks=${result.chunkCount} took=${result.durationMs}ms (${result.timings})`,
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Report generation failed';
    await markGenerationResult(db, jobId, 'failed', message).catch(() => {});
    console.error(`[generate-report] job=${jobId} failed:`, err);
  } finally {
    releaseRenderSlot();
    inFlight.delete(jobId);
  }
}

/**
 * Why this exists: Cloud Run (request-based billing) only guarantees CPU
 * while a request is in flight. Work that keeps running after the 202 —
 * how this service has always worked — would be throttled to almost nothing
 * and could be shut down mid-render. So POST /generate-report calls this
 * same service at /internal/run, and that request is held open for the
 * entire render: Cloud Run sees an active request, keeps the CPU at full
 * speed, and won't scale the instance in until it finishes.
 *
 * Resolves once /internal/run has sent its response headers (i.e. the work
 * has really started). The body is then drained in the background so the
 * connection — and with it the in-flight request — stays open until the
 * render completes.
 */
async function startInternalRun(req: express.Request, jobId: string): Promise<void> {
  const base = (config.selfUrl || `https://${req.get('host')}`).replace(/\/+$/, '');
  // Time limit on getting the run STARTED only (covers a cold start of the
  // instance that picks it up). Cleared as soon as the first bytes arrive —
  // a fetch signal also governs reading the body, so leaving it armed would
  // cut the held-open connection, and with it the render's CPU, mid-render.
  const controller = new AbortController();
  const startTimer = setTimeout(() => controller.abort(), 60_000);
  let res: Response;
  try {
    res = await fetch(`${base}/internal/run`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Internal-Secret': config.internalRunSecret },
      body: JSON.stringify({ jobId }),
      signal: controller.signal,
    });
  } finally {
    clearTimeout(startTimer);
  }
  if (res.status !== 200) {
    const text = await res.text().catch(() => '');
    throw new Error(`internal run returned HTTP ${res.status}: ${text.slice(0, 300)}`);
  }
  void res.text().catch(() => {});
}

function secretMatches(given: string | undefined): boolean {
  const a = Buffer.from(given ?? '');
  const b = Buffer.from(config.internalRunSecret);
  return a.length === b.length && timingSafeEqual(a, b);
}

app.post('/internal/run', route(async (req, res) => {
  if (!config.internalRunSecret || !secretMatches(req.get('X-Internal-Secret'))) {
    return res.status(404).end();
  }
  const { jobId } = req.body ?? {};
  if (!jobId || typeof jobId !== 'string') {
    return res.status(400).json({ error: 'jobId is required' });
  }
  // Landed on an instance that's stopping: refuse, so the caller marks it
  // failed and answers 503, which the app's sync queue retries.
  if (shuttingDown) {
    return res.status(503).end();
  }

  // First bytes now, the rest when finished — the open response is what
  // keeps this request (and the instance's CPU) alive for the whole render.
  // Headers alone aren't enough: Cloud Run's front end holds them back until
  // body bytes flow, which made the caller's 202 wait for the whole render.
  res.status(200).setHeader('Content-Type', 'text/plain');
  res.write('started\n');
  await runGeneration(jobId);
  // Ready a browser for the next report (a technician often regenerates —
  // draft, fix a defect, final) while this request still holds the CPU. The
  // report's status is already written, so nobody waits on this.
  if (!shuttingDown) await prepareSpareBrowser();
  res.end('done\n');
}));

app.get('/report-status', route(async (req, res) => {
  const jobId = req.query.jobId;
  if (!jobId || typeof jobId !== 'string') {
    return res.status(400).json({ error: 'jobId is required' });
  }

  if (!(await authorize(req, res, jobId))) return; // authorize() already sent the response

  const status = await getGenerationStatus(db, jobId);

  // updatedAt on completed/failed lets the app tell the PREVIOUS run's result
  // (still sitting in this row the moment a technician taps Generate again,
  // before their new request has made it through the sync queue) apart from
  // the result of the run they just asked for.
  if (status.status === 'completed') {
    const report = await signExistingReport(db, jobId);
    if (report.kind === 'none') {
      // The job was edited after that report was made, which clears
      // jobs.report_url — the old 'completed' no longer describes a current
      // report. Answering 'failed' here made the app show "no file was
      // found" in the seconds between tapping Generate and the new request
      // arriving; 'not_started' keeps it waiting for the new run instead.
      return res.json({ status: 'not_started' });
    }
    if (report.kind === 'error') {
      return res.json({ status: 'failed', error: 'Report marked complete but no file was found.', updatedAt: status.updatedAt });
    }
    return res.json({ status: 'completed', pdfUrl: report.url, updatedAt: status.updatedAt });
  }

  if (status.status === 'failed') {
    return res.json({ status: 'failed', error: status.lastError ?? 'Report generation failed.', updatedAt: status.updatedAt });
  }

  if (status.status === 'generating') {
    return res.json({ status: 'generating', startedAt: status.updatedAt });
  }

  return res.json({ status: status.status }); // 'not_started'
}));

/**
 * Opt-in scale test (ENABLE_DIAGNOSTICS=1 plus the internal secret): renders
 * a SYNTHETIC N-asset report through the exact same path a real one takes on
 * Cloud Run — 202 from /start, render inside a held-open self-call — and
 * logs the result. Touches no Supabase data and uploads nothing. Off in
 * production; enabled only on a no-traffic tagged test revision.
 */
if (process.env.ENABLE_DIAGNOSTICS === '1') {
  app.post('/internal/diag/start', async (req, res) => {
    if (!config.internalRunSecret || !secretMatches(req.get('X-Internal-Secret'))) return res.status(404).end();
    const assets = Number(req.body?.assets ?? 1200);
    const base = (config.selfUrl || `https://${req.get('host')}`).replace(/\/+$/, '');
    const r = await fetch(`${base}/internal/diag/run`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Internal-Secret': config.internalRunSecret },
      body: JSON.stringify({ assets }),
    });
    void r.text().catch(() => {});
    return res.status(202).json({ status: 'started', assets });
  });

  app.post('/internal/diag/run', async (req, res) => {
    if (!config.internalRunSecret || !secretMatches(req.get('X-Internal-Secret'))) return res.status(404).end();
    res.status(200).setHeader('Content-Type', 'text/plain');
    res.write('started\n');
    const assets = Number(req.body?.assets ?? 1200);
    const t0 = Date.now();
    try {
      const { data, byValue, photoCount } = await buildSyntheticReport(assets);
      const { pdf } = await renderReportPdf(data, byValue);
      const { PDFDocument } = await import('pdf-lib');
      const pages = (await PDFDocument.load(pdf)).getPageCount();
      console.log(`[diag] assets=${assets} photos=${photoCount} pages=${pages} sizeKB=${Math.round(pdf.length / 1024)} took=${Date.now() - t0}ms nodeRssMB=${Math.round(process.memoryUsage().rss / 1048576)} tzSample="${new Date('2026-10-08T23:30:00Z').toLocaleString('en-AU')}"`);
    } catch (err) {
      console.error(`[diag] assets=${assets} FAILED after ${Date.now() - t0}ms:`, err);
    }
    res.end('done\n');
  });
}

// Last stop for anything a route threw (see route() above).
app.use((err: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error('[http] request failed:', err);
  if (res.headersSent) return res.end();
  res.status(500).json({ error: 'Report service error, please try again.' });
});

// Belt and braces: never let a stray rejection take the process (and every
// report rendering in it) down.
process.on('unhandledRejection', (reason) => {
  console.error('[process] unhandled rejection:', reason);
});

const server = app.listen(config.port, () => {
  console.log(`report-generator listening on :${config.port}`);
  // Start-up warm-up — see warmUpPdfjs. Cheap, and runs while Cloud Run's
  // start-up CPU boost is still in effect.
  warmUpPdfjs();
  // No spare browser launched here: outside a request Cloud Run throttles
  // the CPU and the launch timed out (30s). /prepare and the end of each
  // report launch it inside a held-open request instead.
});

/**
 * Graceful shutdown. The host sends SIGTERM when it replaces or stops this
 * instance, then force-kills it shortly after (10s on Cloud Run). Stop taking
 * new work, give in-flight generations the grace window to finish normally,
 * and mark anything still unfinished as failed with an actionable message —
 * instead of leaving it showing "generating" until the stale-lock window
 * expires, which is what an abrupt kill used to do.
 */
async function shutdown(signal: string): Promise<void> {
  if (shuttingDown) return;
  shuttingDown = true;
  console.log(`[shutdown] ${signal} received — ${inFlight.size} generation(s) in flight`);
  server.close();
  void closeSpareBrowser();

  const deadline = Date.now() + SHUTDOWN_GRACE_MS;
  while (inFlight.size > 0 && Date.now() < deadline) {
    await new Promise((r) => setTimeout(r, 1_000));
  }

  const abandoned = [...inFlight];
  await Promise.all(
    abandoned.map((jobId) =>
      markGenerationResult(
        db,
        jobId,
        'failed',
        'The report service restarted before this report finished. Please generate it again.',
      ).catch((err) => console.error(`[shutdown] could not mark job=${jobId} as failed:`, err)),
    ),
  );
  if (abandoned.length > 0) console.warn(`[shutdown] abandoned ${abandoned.length} generation(s): ${abandoned.join(', ')}`);
  process.exit(0);
}

process.on('SIGTERM', () => void shutdown('SIGTERM'));
process.on('SIGINT', () => void shutdown('SIGINT'));
