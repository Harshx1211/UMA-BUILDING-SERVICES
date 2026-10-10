import { SupabaseClient } from '@supabase/supabase-js';
import { InspectionPhoto } from '../types';
import { extractObjectPath } from './prepareInlinePhotos';

// A completed job's report is a compliance record technicians and clients
// keep on file indefinitely, not something re-opened within the hour — a
// short-lived signed URL (the 1-hour convention used for job-reports
// itself) would leave every "tap a thumbnail to view full-size" link dead
// the next time someone actually opens an old PDF. Long-lived on purpose;
// the tradeoff (anyone who ever gets a copy of the PDF can view that one
// photo without logging in, for up to a decade) is the same one already
// accepted for job-reports' own signed links, just extended further since
// this is a permanent document rather than a same-session download.
const LINK_EXPIRY_SECONDS = 60 * 60 * 24 * 365 * 10; // 10 years
const SIGN_BATCH_SIZE = 500;

/**
 * Signs the ORIGINAL full-resolution photo for each id — distinct from
 * prepareInlinePhotos' small embedded thumbnail, which is deliberately
 * downsized and can't usefully be "clicked to see full size". Used to make
 * report photos clickable in the generated PDF (Chromium's print-to-PDF
 * preserves <a href> as real clickable link annotations).
 *
 * Signs in batches of SIGN_BATCH_SIZE paths per createSignedUrls call rather
 * than one request per photo — a large site can have well over 1000 photos.
 */
export async function prepareFullResUrls(
  db: SupabaseClient,
  photos: InspectionPhoto[],
  bucket: string,
): Promise<Map<string, string>> {
  const urls = new Map<string, string>();
  const withPaths = photos
    .map((p) => ({ id: p.id, path: extractObjectPath(p.photo_url, bucket) }))
    .filter((p): p is { id: string; path: string } => p.path != null);

  if (withPaths.length === 0) return urls;

  // Supabase rejects more than 1000 paths per createSignedUrls call ("body/
  // paths must NOT have more than 1000 items" — measured), and this used to
  // swallow that error and return an empty map, so every photo on a large
  // site silently lost its link. Sign in batches, and fail the report on a
  // real error rather than shipping it with no working photo links.
  for (let i = 0; i < withPaths.length; i += SIGN_BATCH_SIZE) {
    const batch = withPaths.slice(i, i + SIGN_BATCH_SIZE);
    const { data, error } = await db.storage
      .from(bucket)
      .createSignedUrls(batch.map((p) => p.path), LINK_EXPIRY_SECONDS);
    if (error || !data) {
      throw new Error(`Failed to sign photo links: ${error?.message ?? 'no data returned'}`);
    }
    // createSignedUrls returns results in the same order as the input paths —
    // zip back up with the ids we sent in, rather than trusting a `path` field
    // on the result to round-trip unchanged.
    data.forEach((result, j) => {
      if (result.signedUrl) urls.set(batch[j].id, result.signedUrl);
    });
  }

  return urls;
}
