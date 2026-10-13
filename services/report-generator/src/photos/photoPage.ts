import { SupabaseClient } from '@supabase/supabase-js';
import { config } from '../config';
import { assetDisplayName } from '../templates/helpers';
import { extractObjectPath } from './prepareInlinePhotos';

/**
 * The page a report's photo thumbnail opens (GET /p/:token, index.ts): the
 * full-resolution photo in a proper viewer — loading state, fade-in, zoom
 * (double-tap/double-click, pinch, scroll wheel, +/- buttons), drag to pan,
 * download, and a Close button back to the report. Public by design —
 * anyone holding the report holds the links, as with the signed URLs these
 * replace — so it shows the photo and the asset's name and location and
 * nothing else: no company, address, notes or prices.
 *
 * No external assets at all (the CSP in photoPageCsp allows only this
 * page's own nonce'd style/script and images from the storage host), so
 * icons are inline SVG and fonts are the device's own.
 */

// How long the image (and download) URLs inside the page stay valid — long
// enough to look at it; opening the link again gets fresh ones.
const IMAGE_URL_SECONDS = 60 * 60;

type Stage = 'before' | 'after' | null;

export type PhotoView =
  | { kind: 'ok'; title: string; stage: Stage; location: string | null; imageUrl: string; downloadUrl: string | null }
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
      ? db.from('assets').select('asset_ref, asset_type, variant, location_on_site').eq('id', photo.asset_id).maybeSingle()
      : Promise.resolve({ data: null, error: null }),
  ]);
  if (companyRes.error) return { kind: 'error' };
  // Same rule as report generation (auth.ts): a company that's no longer
  // active doesn't get its records served.
  if (companyRes.data?.subscription_status !== 'active') return { kind: 'gone' };

  const path = extractObjectPath(photo.photo_url, config.photoBucket);
  if (!path) return { kind: 'gone' };
  const bucket = db.storage.from(config.photoBucket);
  const [view, download] = await Promise.all([
    bucket.createSignedUrl(path, IMAGE_URL_SECONDS),
    // Same file, served with a "save as" header so Download saves it
    // instead of opening another tab.
    bucket.createSignedUrl(path, IMAGE_URL_SECONDS, { download: `photo-${photoId.slice(0, 8)}.jpg` }),
  ]);
  if (view.error || !view.data?.signedUrl) return { kind: 'error' };

  const asset = assetRes.data as { asset_ref: string | null; asset_type: string | null; variant: string | null; location_on_site: string | null } | null;
  return {
    kind: 'ok',
    title: asset ? assetDisplayName(asset) : 'Inspection photo',
    stage: photo.stage === 'before' || photo.stage === 'after' ? photo.stage : null,
    location: asset?.location_on_site ?? null,
    imageUrl: view.data.signedUrl,
    downloadUrl: download.data?.signedUrl ?? null,
  };
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

// The page itself (markup, style, zoom behaviour) lives in photoViewer.ts.
export { renderPhotoPage, renderPhotoMessagePage } from './photoViewer';
