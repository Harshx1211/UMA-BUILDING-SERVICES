import { SupabaseClient } from '@supabase/supabase-js';
import { config } from './config';

/**
 * Keeps the existing, already-correct storage contract from the old Edge
 * Function unchanged: upload to the private bucket at `{jobId}.pdf`, store the
 * permanent storage PATH (not a signed URL, which would expire) in
 * jobs.report_url, and return a fresh signed URL for immediate use by the caller.
 */
export async function uploadReport(
  db: SupabaseClient,
  jobId: string,
  pdfBuffer: Buffer,
): Promise<{ storagePath: string; signedUrl: string }> {
  const storagePath = `${jobId}.pdf`;

  const { error: uploadErr } = await db.storage
    .from(config.reportBucket)
    .upload(storagePath, pdfBuffer, { contentType: 'application/pdf', upsert: true });
  if (uploadErr) throw new Error(`Storage upload failed: ${uploadErr.message}`);

  // Independent of each other once the file is up — one round trip, not two.
  const [{ data: signedData, error: signErr }, { error: jobErr }] = await Promise.all([
    db.storage.from(config.reportBucket).createSignedUrl(storagePath, 60 * 60),
    // Without this the PDF exists but nothing points to it — the app would
    // never find the report it just waited for.
    db.from('jobs').update({ report_url: storagePath }).eq('id', jobId),
  ]);
  if (jobErr) throw new Error(`Saving the report location failed: ${jobErr.message}`);
  if (signErr || !signedData?.signedUrl) {
    throw new Error(`Signed URL failed: ${signErr?.message ?? 'unknown error'}`);
  }

  return { storagePath, signedUrl: signedData.signedUrl };
}

/**
 * Signs an already-uploaded report's storage path — used by GET
 * /report-status so the app can get a fresh, usable URL directly from the
 * status poll once generation completes, without a separate round-trip.
 */
export type ExistingReport =
  | { kind: 'signed'; url: string }
  /** jobs.report_url is empty — the app clears it whenever the job is edited
   * after a report was made (the report is stale), so there's no current one. */
  | { kind: 'none' }
  | { kind: 'error' };

export async function signExistingReport(db: SupabaseClient, jobId: string): Promise<ExistingReport> {
  const { data: job } = await db.from('jobs').select('report_url').eq('id', jobId).single();
  if (!job?.report_url) return { kind: 'none' };

  const { data: signedData, error } = await db.storage
    .from(config.reportBucket)
    .createSignedUrl(job.report_url, 60 * 60);
  if (error || !signedData?.signedUrl) return { kind: 'error' };
  return { kind: 'signed', url: signedData.signedUrl };
}
