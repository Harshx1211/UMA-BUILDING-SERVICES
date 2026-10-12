import { createHmac, timingSafeEqual } from 'node:crypto';
import { config } from '../config';

/**
 * Short, signed links from a report's photo thumbnails to this service's
 * photo page (GET /p/:token in index.ts) — replacing a 10-year signed
 * storage URL per photo.
 *
 * Why: tapping a thumbnail used to drop the reader straight onto a bare
 * image URL, usually in the same tab as the report, with no way back but
 * the browser's Back button. The page shows the full-resolution photo with
 * its asset name and a Close button. Side benefits: each link is ~110
 * characters instead of ~470 (34 photos = ~12KB less PDF), the server
 * decides per tap whether the photo may still be shown (a deleted photo or
 * a deactivated company's photos stop opening), and nothing in a sent PDF
 * is itself a long-lived storage credential.
 *
 * Token = version "1" + base64url(16-byte photo uuid + first 16 bytes of
 * HMAC-SHA256(PHOTO_LINK_SECRET, "photo-link:v1:<uuid>")). 128 bits of MAC
 * can't be guessed or forged, so a link opens exactly one photo — the same
 * capability the old signed URL gave, no more. A dedicated secret (not
 * INTERNAL_RUN_SECRET) so either can be rotated alone; rotating this one
 * invalidates every link in every PDF already sent.
 */

const VERSION = '1';
const MAC_BYTES = 16;
const TOKEN_RE = /^1[A-Za-z0-9_-]{43}$/;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function mac(photoId: string): Buffer {
  return createHmac('sha256', config.photoLinkSecret)
    .update(`photo-link:v1:${photoId.toLowerCase()}`)
    .digest()
    .subarray(0, MAC_BYTES);
}

/** Both a long enough secret and this service's public address are set. */
export function photoLinksEnabled(): boolean {
  return config.photoLinkSecret.length >= 32 && config.selfUrl.length > 0;
}

/** Only uuid ids fit the token; anything else keeps a signed storage URL. */
export function canLinkPhoto(photoId: string): boolean {
  return UUID_RE.test(photoId);
}

export function photoLinkUrl(photoId: string): string {
  const idBytes = Buffer.from(photoId.replace(/-/g, ''), 'hex');
  const token = VERSION + Buffer.concat([idBytes, mac(photoId)]).toString('base64url');
  return `${config.selfUrl.replace(/\/+$/, '')}/p/${token}`;
}

/** The photo id a token was issued for, or null for anything not issued by us. */
export function verifyPhotoLinkToken(token: string): string | null {
  if (!photoLinksEnabled() || !TOKEN_RE.test(token)) return null;
  const raw = Buffer.from(token.slice(1), 'base64url');
  if (raw.length !== 16 + MAC_BYTES) return null;
  const hex = raw.subarray(0, 16).toString('hex');
  const photoId = `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
  return timingSafeEqual(raw.subarray(16), mac(photoId)) ? photoId : null;
}
