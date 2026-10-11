import sharp from 'sharp';

/**
 * SIZE: signatures are stored as PNG data URIs of the whole signing canvas
 * (~950x590px, 50-65KB each) and printed at most 44px tall (signoff.ts) —
 * embedded as-is they were the biggest images in the report. Scaled to 3x
 * the printed height (sharp lines in print, ~290dpi), flattened onto white
 * (the sign-off cards are white, so it looks the same) and stored as a
 * greyscale JPEG. Why JPEG for line art: Chromium copies a JPEG into the PDF
 * byte for byte, but re-encodes any PNG as full RGB (plus a separate alpha
 * mask if transparent) — a 5KB grey PNG came out as 10KB in the PDF. At
 * quality 85 and 3x print size the pen lines stay clean. ~3KB each.
 *
 * Anything that isn't a base64 image data URI (the 'UNAVAILABLE' marker, a
 * URL) is returned untouched, as is anything sharp can't read — a report is
 * never held up or changed because a signature couldn't be shrunk.
 */
const SIGNATURE_HEIGHT = 132;

export async function shrinkSignature<T extends string | null | undefined>(url: T): Promise<T> {
  if (!url || !url.startsWith('data:image/')) return url;
  const comma = url.indexOf(',');
  if (comma < 0 || !url.slice(0, comma).endsWith(';base64')) return url;
  try {
    const input = Buffer.from(url.slice(comma + 1), 'base64');
    const out = await sharp(input)
      .flatten({ background: '#ffffff' })
      .resize({ height: SIGNATURE_HEIGHT, withoutEnlargement: true })
      .toColourspace('b-w')
      .jpeg({ quality: 85, mozjpeg: true })
      .toBuffer();
    return (out.length < input.length ? `data:image/jpeg;base64,${out.toString('base64')}` : url) as T;
  } catch {
    return url;
  }
}
