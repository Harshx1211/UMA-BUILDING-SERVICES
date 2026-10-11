import { SupabaseClient } from '@supabase/supabase-js';
import sharp from 'sharp';
import { mapWithConcurrency } from '../concurrency';
import { InspectionPhoto } from '../types';

// Small enough to embed inline without meaningfully bloating the HTML, large
// enough to actually make out a defect — the printed thumbnail is 110px.
//
// Tightened from 320px/quality-72 to 200px/quality-58 once every thumbnail
// became a real clickable link to the full-resolution original
// (prepareFullResUrls.ts) — the embedded copy no longer has to carry the
// full visual burden on its own, since anyone who needs to actually inspect
// a photo closely can just tap it. 200px is still ~1.8x the printed size,
// comfortably sharp for scanning a photo grid at a glance. A 12-asset/
// 10-15-photo report measured at 700KB before this change; expect roughly
// a 60-70% cut to the image portion of that (pixel count alone drops to
// ~39% of its previous value, quality-58 vs 72 trims a further ~20-25% on
// top) — worth regenerating a real report after this change and comparing
// the actual new size rather than trusting this estimate blindly.
const TARGET_DIMENSION = 200;
const JPEG_QUALITY = 58;
// Photos are small by now (the app uploads them at 1600px / q0.7, ~200KB),
// so each download is latency-bound rather than bandwidth-bound — more in
// flight at once is what actually shortens this stage.
const DOWNLOAD_CONCURRENCY = 24;

/**
 * Finished thumbnails, by storage path, kept on this instance. A technician
 * typically regenerates a report several times (draft, fix a defect,
 * final), and every run used to download and resize the same originals
 * again. Photo paths are random UUIDs that are never overwritten with
 * different content, so a cached thumbnail can never go stale. Bounded:
 * ~3000 thumbnails of ~10-20KB is a few tens of MB at most, and the oldest
 * entries are evicted first.
 */
const THUMB_CACHE_MAX = 3000;
const thumbCache = new Map<string, string>();

function cacheThumb(path: string, dataUri: string): void {
  thumbCache.delete(path);
  thumbCache.set(path, dataUri);
  if (thumbCache.size > THUMB_CACHE_MAX) {
    const oldest = thumbCache.keys().next().value;
    if (oldest !== undefined) thumbCache.delete(oldest);
  }
}

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

  const resizeOne = async (path: string): Promise<string> => {
    const cached = thumbCache.get(path);
    if (cached) return cached;
    const { data, error } = await db.storage.from(bucket).download(path);
    if (error || !data) throw new Error(error?.message ?? 'empty download');
    const original = Buffer.from(await data.arrayBuffer());
    const resized = await sharp(original)
      .rotate() // respect EXIF orientation before resizing — phone photos are often stored sideways
      .resize({ width: TARGET_DIMENSION, height: TARGET_DIMENSION, fit: 'inside', withoutEnlargement: true })
      .jpeg({ quality: JPEG_QUALITY })
      .toBuffer();
    const dataUri = `data:image/jpeg;base64,${resized.toString('base64')}`;
    cacheThumb(path, dataUri);
    return dataUri;
  };

  await mapWithConcurrency(withPaths, DOWNLOAD_CONCURRENCY, async ({ id, path }) => {
    // One retry: with ~1500 downloads on a large site, a single transient
    // network/storage blip shouldn't turn a perfectly good photo into a
    // "photo unavailable" placeholder in a compliance report.
    for (let attempt = 1; attempt <= 2; attempt++) {
      try {
        inline.set(id, await resizeOne(path));
        return;
      } catch {
        if (attempt === 1) await new Promise((r) => setTimeout(r, 1_000));
      }
    }
    // Still failing (missing/corrupt file): the template layer renders an
    // explicit "photo unavailable" placeholder for any id missing from this
    // map, so one bad photo doesn't abort the whole report.
  });

  // Every single photo failing isn't "a few bad files" — it's storage being
  // unreachable. Fail so the technician retries, instead of delivering a
  // report where every photo is a placeholder.
  if (withPaths.length > 0 && inline.size === 0) {
    throw new Error(`Could not load any of the ${withPaths.length} photos from storage — please try again.`);
  }

  return inline;
}

export function extractObjectPath(photoUrl: string, bucket: string): string | null {
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
