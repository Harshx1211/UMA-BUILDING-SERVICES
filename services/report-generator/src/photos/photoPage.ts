import { SupabaseClient } from '@supabase/supabase-js';
import { config } from '../config';
import { esc } from '../templates/helpers';
import { extractObjectPath } from './prepareInlinePhotos';

/**
 * The page a report's photo thumbnail opens (GET /p/:token, index.ts): the
 * full-resolution photo, what it's of, and a Close button back to the
 * report. Public by design — anyone holding the report holds the links, as
 * with the signed URLs these replace — so it shows the photo and the
 * asset's name and nothing else: no company, address, notes or prices.
 */

// How long the full-resolution image URL inside the page stays valid —
// long enough to look at it; opening the link again gets a fresh one.
const IMAGE_URL_SECONDS = 60 * 60;

export type PhotoView =
  | { kind: 'ok'; title: string; subtitle: string; imageUrl: string }
  | { kind: 'gone' } // deleted, or its company is no longer active
  | { kind: 'error' }; // couldn't check right now — worth trying again

export async function loadPhotoView(db: SupabaseClient, photoId: string): Promise<PhotoView> {
  const { data: photo, error } = await db
    .from('inspection_photos')
    .select('photo_url, company_id, asset_id, stage')
    .eq('id', photoId)
    .maybeSingle();
  if (error) return { kind: 'error' };
  if (!photo) return { kind: 'gone' };

  const [companyRes, assetRes] = await Promise.all([
    db.from('companies').select('subscription_status').eq('id', photo.company_id).maybeSingle(),
    photo.asset_id
      ? db.from('assets').select('asset_ref, asset_type, location_on_site').eq('id', photo.asset_id).maybeSingle()
      : Promise.resolve({ data: null, error: null }),
  ]);
  if (companyRes.error) return { kind: 'error' };
  // Same rule as report generation (auth.ts): a company that's no longer
  // active doesn't get its records served.
  if (companyRes.data?.subscription_status !== 'active') return { kind: 'gone' };

  const path = extractObjectPath(photo.photo_url, config.photoBucket);
  if (!path) return { kind: 'gone' };
  const { data: signed, error: signError } = await db.storage
    .from(config.photoBucket)
    .createSignedUrl(path, IMAGE_URL_SECONDS);
  if (signError || !signed?.signedUrl) return { kind: 'error' };

  const asset = assetRes.data as { asset_ref: string | null; asset_type: string | null; location_on_site: string | null } | null;
  const title = asset
    ? `${asset.asset_ref ? `${asset.asset_ref} - ` : ''}${asset.asset_type ?? 'Asset'}`
    : 'Inspection photo';
  const stage = photo.stage === 'before' ? 'Before photo' : photo.stage === 'after' ? 'After photo' : 'Photo';
  const subtitle = [stage, asset?.location_on_site ? `Location ${asset.location_on_site}` : null].filter(Boolean).join(' · ');
  return { kind: 'ok', title, subtitle, imageUrl: signed.signedUrl };
}

/** Content-Security-Policy for these pages: our own inline style/script (by
 * nonce) and images from the storage host only. */
export function photoPageCsp(nonce: string): string {
  const storageOrigin = new URL(config.supabaseUrl).origin;
  return [
    "default-src 'none'",
    `img-src ${storageOrigin}`,
    `style-src 'nonce-${nonce}'`,
    `script-src 'nonce-${nonce}'`,
    "base-uri 'none'",
    "form-action 'none'",
    "frame-ancestors 'none'",
  ].join('; ');
}

const STYLE = `
  :root { color-scheme: dark; }
  * { box-sizing: border-box; }
  body {
    margin: 0; min-height: 100vh; display: flex; flex-direction: column;
    background: #0F172A; color: #E2E8F0;
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
  }
  header {
    position: sticky; top: 0; display: flex; align-items: center; justify-content: space-between;
    gap: 12px; padding: 12px 16px; background: #1E293B; border-bottom: 1px solid #334155;
  }
  .t { min-width: 0; }
  h1 { margin: 0; font-size: 15px; font-weight: 700; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .s { margin-top: 2px; font-size: 12px; color: #94A3B8; }
  button {
    flex-shrink: 0; font: inherit; font-size: 14px; font-weight: 700; color: #0F172A;
    background: #F8FAFC; border: 0; border-radius: 8px; padding: 10px 16px; cursor: pointer;
  }
  main { flex: 1; display: flex; align-items: center; justify-content: center; padding: 12px; }
  img { display: block; max-width: 100%; max-height: calc(100vh - 130px); object-fit: contain; border-radius: 4px; }
  .msg { max-width: 360px; text-align: center; font-size: 15px; line-height: 1.5; color: #CBD5E1; }
  .note { margin: 0; padding: 0 16px 16px; text-align: center; font-size: 12px; color: #94A3B8; }
`;

// Close: back to the report when the photo opened in the report's own tab
// (most browser PDF viewers); otherwise this tab was opened for the photo,
// so close it — and if the browser won't allow that, say so.
const CLOSE_SCRIPT = `
  document.getElementById('close').addEventListener('click', function () {
    if (history.length > 1) { history.back(); return; }
    window.close();
    setTimeout(function () {
      document.getElementById('note').textContent = 'You can close this tab now to return to the report.';
    }, 300);
  });
`;

function shell(nonce: string, title: string, subtitle: string, body: string, note: string): string {
  return `<!doctype html>
<html lang="en"><head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<meta name="robots" content="noindex, nofollow" />
<title>${esc(title)}</title>
<style nonce="${nonce}">${STYLE}</style>
</head><body>
<header>
  <div class="t"><h1>${esc(title)}</h1>${subtitle ? `<div class="s">${esc(subtitle)}</div>` : ''}</div>
  <button id="close" type="button">Close</button>
</header>
<main>${body}</main>
<p class="note" id="note">${esc(note)}</p>
<script nonce="${nonce}">${CLOSE_SCRIPT}</script>
</body></html>`;
}

export function renderPhotoPage(view: Extract<PhotoView, { kind: 'ok' }>, nonce: string): string {
  return shell(
    nonce,
    view.title,
    view.subtitle,
    `<img src="${esc(view.imageUrl)}" alt="${esc(view.title)}" />`,
    'Pinch or zoom to see detail.',
  );
}

export function renderPhotoMessagePage(message: string, nonce: string): string {
  return shell(nonce, 'Photo', '', `<p class="msg">${esc(message)}</p>`, '');
}
