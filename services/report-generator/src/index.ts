import express from 'express';
import { config } from './config';
import { db } from './supabaseClient';
import { AuthError, assertOwnsJob, verifyAccessToken } from './auth';
import { tryAcquireLock, markGenerationResult, getGenerationStatus } from './generation/lock';
import { generateReport } from './generation/pipeline';
import { signExistingReport } from './storage';

const app = express();
app.use(express.json());

app.get('/health', (_req, res) => res.json({ ok: true }));

/** Shared by both endpoints: verify the token, then that the caller's company owns the job. */
async function authorize(req: express.Request, res: express.Response, jobId: string): Promise<boolean> {
  let userId: string;
  try {
    userId = await verifyAccessToken(db, req.headers.authorization);
  } catch (err) {
    const status = err instanceof AuthError ? err.status : 401;
    res.status(status).json({ error: err instanceof Error ? err.message : 'Unauthorized' });
    return false;
  }

  try {
    const { data: job, error: jobErr } = await db.from('jobs').select('company_id').eq('id', jobId).single();
    if (jobErr || !job) {
      res.status(404).json({ error: 'Job not found' });
      return false;
    }
    await assertOwnsJob(db, userId, job.company_id);
    return true;
  } catch (err) {
    const status = err instanceof AuthError ? err.status : 500;
    res.status(status).json({ error: err instanceof Error ? err.message : 'Authorization check failed' });
    return false;
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
app.post('/generate-report', async (req, res) => {
  const { jobId } = req.body ?? {};
  if (!jobId || typeof jobId !== 'string') {
    return res.status(400).json({ error: 'jobId is required' });
  }

  if (!(await authorize(req, res, jobId))) return; // authorize() already sent the response

  const lock = await tryAcquireLock(db, jobId);
  if (!lock.acquired) {
    return res.status(409).json({ error: lock.reason });
  }

  res.status(202).json({ status: 'generating' });

  // Deliberately not awaited — this continues running after the response
  // above has already been sent. Errors are caught and recorded in
  // report_generation_status for the client to discover via polling, never
  // left to become an unhandled rejection.
  generateReport(db, jobId)
    .then(async (result) => {
      await markGenerationResult(db, jobId, 'completed');
      console.log(
        `[generate-report] job=${jobId} assets=${result.assetCount} chunks=${result.chunkCount} took=${result.durationMs}ms`,
      );
    })
    .catch(async (err) => {
      const message = err instanceof Error ? err.message : 'Report generation failed';
      await markGenerationResult(db, jobId, 'failed', message);
      console.error(`[generate-report] job=${jobId} failed:`, err);
    });
});

app.get('/report-status', async (req, res) => {
  const jobId = req.query.jobId;
  if (!jobId || typeof jobId !== 'string') {
    return res.status(400).json({ error: 'jobId is required' });
  }

  if (!(await authorize(req, res, jobId))) return;

  const status = await getGenerationStatus(db, jobId);

  if (status.status === 'completed') {
    const pdfUrl = await signExistingReport(db, jobId);
    if (!pdfUrl) {
      // The status row says completed but the file/URL isn't there —
      // surface this as a failure rather than telling the client to keep
      // waiting on something that will never arrive.
      return res.json({ status: 'failed', error: 'Report marked complete but no file was found.' });
    }
    return res.json({ status: 'completed', pdfUrl });
  }

  if (status.status === 'failed') {
    return res.json({ status: 'failed', error: status.lastError ?? 'Report generation failed.' });
  }

  return res.json({ status: status.status }); // 'generating' | 'not_started'
});

app.listen(config.port, () => {
  console.log(`report-generator listening on :${config.port}`);
});
