import { SupabaseClient } from '@supabase/supabase-js';
import { config } from '../config';
import { InspectionPhoto } from '../types';

/**
 * The scale fix for photos: rather than fetching bytes and base64-embedding them
 * (the old approach, which is exactly what blew the Edge Function's 150MB memory
 * ceiling and forced silently dropping any photo over 600KB), we sign every photo's
 * storage path up front in one batched call and hand Gotenberg's Chromium plain
 * `<img src="...">` URLs. Chromium fetches each image itself during rendering — the
 * same way a browser loads a page — so this service never holds decoded image bytes
 * in memory, regardless of whether a job has 10 photos or 10,000.
 *
 * `inspection_photos.photo_url` is stored as a full `https://...` Storage CDN URL
 * (see supabase/schema.sql), not a bare object path, so we extract the path
 * relative to the bucket before calling createSignedUrls().
 */
export async function signPhotoUrls(
  db: SupabaseClient,
  photos: InspectionPhoto[],
  bucket: string,
): Promise<Map<string, string>> {
  const signed = new Map<string, string>();
  const withPaths = photos
    .map((p) => ({ id: p.id, path: extractObjectPath(p.photo_url, bucket) }))
    .filter((p): p is { id: string; path: string } => p.path != null);

  if (withPaths.length === 0) return signed;

  // createSignedUrls supports many paths per call — batch in reasonably sized
  // groups so a single request body doesn't grow unbounded for a 1000+ photo job.
  const BATCH = 200;
  for (let i = 0; i < withPaths.length; i += BATCH) {
    const batch = withPaths.slice(i, i + BATCH);
    const { data, error } = await db.storage
      .from(bucket)
      .createSignedUrls(batch.map((b) => b.path), config.photoSignedUrlTtlSeconds);

    if (error) {
      // Don't abort the whole report over one batch of unsignable photos — the
      // template layer renders an explicit "photo unavailable" placeholder for
      // any photo id missing from this map, so a partial failure here degrades
      // gracefully instead of silently vanishing content.
      continue;
    }

    data?.forEach((result, idx) => {
      if (result.signedUrl) signed.set(batch[idx].id, result.signedUrl);
    });
  }

  return signed;
}

function extractObjectPath(photoUrl: string, bucket: string): string | null {
  const marker = `/object/public/${bucket}/`;
  const signMarker = `/object/sign/${bucket}/`;
  for (const m of [marker, signMarker]) {
    const idx = photoUrl.indexOf(m);
    if (idx !== -1) {
      const rest = photoUrl.slice(idx + m.length);
      return rest.split('?')[0];
    }
  }
  return null;
}
