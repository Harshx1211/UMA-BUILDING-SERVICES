import { SupabaseClient } from '@supabase/supabase-js';
import sharp from 'sharp';
import { mapWithConcurrency } from '../concurrency';
import { InspectionPhoto } from '../types';

// Small enough to embed inline without meaningfully bloating the HTML, large
// enough to actually make out a defect — the printed thumbnail is 110px.
const TARGET_DIMENSION = 320;
const JPEG_QUALITY = 72;
const DOWNLOAD_CONCURRENCY = 6;

/**
 * Resizes every photo down to a small inline JPEG data URI, instead of
 * signing a URL and letting Chromium fetch the original over the network.
 *
 * This replaces an earlier design (sign the original's URL, hand Chromium a
 * plain `<img src>`) that turned out to be the actual bottleneck in real
 * testing: a phone-camera original is often several MB, and Chromium was
 * fetching that full-size original for *every single photo* over a heavily
 * CPU/bandwidth-throttled free-tier container, on every single generation —
 * confirmed by measurement (~15s of extra wall-clock time per asset once
 * photos were involved, for what should be trivial HTML/CSS layout work).
 *
 * Resizing here instead is deliberately bounded so it doesn't reintroduce
 * the old Edge Function's memory problem (which held every full-resolution
 * original for an entire up-to-1000-asset job in memory at once): only
 * `DOWNLOAD_CONCURRENCY` photos are ever being downloaded/resized at a time,
 * each original buffer is discarded the moment it's been resized down to a
 * few tens of KB, and `sharp` (a fast native image library, not a full
 * browser engine) does the actual resize far more cheaply than Chromium
 * decoding a multi-MB original just to display it at 110 CSS pixels.
 */
export async function prepareInlinePhotos(
  db: SupabaseClient,
  photos: InspectionPhoto[],
  bucket: string,
): Promise<Map<string, string>> {
  const inline = new Map<string, string>();
  const withPaths = photos
    .map((p) => ({ id: p.id, path: extractObjectPath(p.photo_url, bucket) }))
    .filter((p): p is { id: string; path: string } => p.path != null);

  await mapWithConcurrency(withPaths, DOWNLOAD_CONCURRENCY, async ({ id, path }) => {
    try {
      const { data, error } = await db.storage.from(bucket).download(path);
      if (error || !data) return;

      const original = Buffer.from(await data.arrayBuffer());
      const resized = await sharp(original)
        .rotate() // respect EXIF orientation before resizing — phone photos are often stored sideways
        .resize({ width: TARGET_DIMENSION, height: TARGET_DIMENSION, fit: 'inside', withoutEnlargement: true })
        .jpeg({ quality: JPEG_QUALITY })
        .toBuffer();

      inline.set(id, `data:image/jpeg;base64,${resized.toString('base64')}`);
    } catch {
      // One bad/corrupt photo shouldn't abort the whole report — the template
      // layer renders an explicit "photo unavailable" placeholder for any
      // photo id missing from this map, same as a failed signed URL would.
    }
  });

  return inline;
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
