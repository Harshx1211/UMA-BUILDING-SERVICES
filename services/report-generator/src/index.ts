import express from 'express';
import { config } from './config';
import { db } from './supabaseClient';
import { AuthError, assertOwnsJob, verifyAccessToken } from './auth';
import { tryAcquireLock, markGenerationResult } from './generation/lock';
import { generateReport, ReportGenerationError } from './generation/pipeline';
import { JobNotFoundError } from './data/fetchReportData';

const app = express();
app.use(express.json());

app.get('/health', (_req, res) => res.json({ ok: true }));

app.post('/generate-report', async (req, res) => {
  const { jobId } = req.body ?? {};
  if (!jobId || typeof jobId !== 'string') {
    return res.status(400).json({ error: 'jobId is required' });
  }

  let userId: string;
  try {
    userId = verifyAccessToken(req.headers.authorization);
  } catch (err) {
    const status = err instanceof AuthError ? err.status : 401;
    return res.status(status).json({ error: err instanceof Error ? err.message : 'Unauthorized' });
  }

  try {
    const { data: job, error: jobErr } = await db
      .from('jobs')
      .select('company_id')
      .eq('id', jobId)
      .single();
    if (jobErr || !job) return res.status(404).json({ error: 'Job not found' });

    await assertOwnsJob(db, userId, job.company_id);
  } catch (err) {
    const status = err instanceof AuthError ? err.status : 500;
    return res.status(status).json({ error: err instanceof Error ? err.message : 'Authorization check failed' });
  }

  const lock = await tryAcquireLock(db, jobId);
  if (!lock.acquired) {
    return res.status(409).json({ error: lock.reason });
  }

  try {
    const result = await generateReport(db, jobId);
    await markGenerationResult(db, jobId, 'completed');
    console.log(
      `[generate-report] job=${jobId} assets=${result.assetCount} chunks=${result.chunkCount} took=${result.durationMs}ms`,
    );
    return res.json({ pdfUrl: result.signedUrl, storagePath: result.storagePath });
  } catch (err) {
    await markGenerationResult(db, jobId, 'failed');
    const status = err instanceof JobNotFoundError ? 404 : err instanceof ReportGenerationError ? 502 : 500;
    console.error(`[generate-report] job=${jobId} failed:`, err);
    return res.status(status).json({ error: err instanceof Error ? err.message : 'Report generation failed' });
  }
});

app.listen(config.port, () => {
  console.log(`report-generator listening on :${config.port}`);
});
