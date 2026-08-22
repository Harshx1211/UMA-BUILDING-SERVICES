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

  const { data: signedData, error: signErr } = await db.storage
    .from(config.reportBucket)
    .createSignedUrl(storagePath, 60 * 60);
  if (signErr || !signedData?.signedUrl) {
    throw new Error(`Signed URL failed: ${signErr?.message ?? 'unknown error'}`);
  }

  await db.from('jobs').update({ report_url: storagePath }).eq('id', jobId);

  return { storagePath, signedUrl: signedData.signedUrl };
}

/**
 * Signs an already-uploaded report's storage path — used by GET
 * /report-status so the app can get a fresh, usable URL directly from the
 * status poll once generation completes, without a separate round-trip.
 */
export async function signExistingReport(db: SupabaseClient, jobId: string): Promise<string | null> {
  const { data: job } = await db.from('jobs').select('report_url').eq('id', jobId).single();
  if (!job?.report_url) return null;

  const { data: signedData, error } = await db.storage
    .from(config.reportBucket)
    .createSignedUrl(job.report_url, 60 * 60);
  if (error || !signedData?.signedUrl) return null;
  return signedData.signedUrl;
}
