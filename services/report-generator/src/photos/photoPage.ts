import { SupabaseClient } from '@supabase/supabase-js';
import { config } from '../config';
import { esc } from '../templates/helpers';
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
      ? db.from('assets').select('asset_ref, asset_type, location_on_site').eq('id', photo.asset_id).maybeSingle()
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

  const asset = assetRes.data as { asset_ref: string | null; asset_type: string | null; location_on_site: string | null } | null;
  return {
    kind: 'ok',
    title: asset ? `${asset.asset_ref ? `${asset.asset_ref} - ` : ''}${asset.asset_type ?? 'Asset'}` : 'Inspection photo',
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

// ── Icons (inline SVG, stroke = currentColor) ───────────────────────────
const svg = (body: string, size = 18) =>
  `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${body}</svg>`;
const ICON = {
  camera: svg('<path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2.5-3z"/><circle cx="12" cy="13" r="3.5"/>', 18),
  close: svg('<path d="M18 6 6 18M6 6l12 12"/>', 16),
  download: svg('<path d="M12 3v12M7 10l5 5 5-5M5 21h14"/>', 16),
  minus: svg('<path d="M5 12h14"/>'),
  plus: svg('<path d="M12 5v14M5 12h14"/>'),
  pin: svg('<path d="M12 21s-7-6.2-7-11.5A7 7 0 0 1 19 9.5C19 14.8 12 21 12 21z"/><circle cx="12" cy="9.5" r="2.5"/>', 12),
  alert: svg('<circle cx="12" cy="12" r="9"/><path d="M12 8v5M12 16.5v.01"/>', 28),
};

const STYLE = `
  :root { color-scheme: dark; }
  * { box-sizing: border-box; }
  html, body { height: 100%; }
  body {
    margin: 0; height: 100vh; height: 100dvh; overflow: hidden;
    display: grid; grid-template-rows: auto 1fr auto;
    background: radial-gradient(ellipse at top, #111a2e 0%, #0b1120 60%) #0b1120;
    color: #f1f5f9; -webkit-tap-highlight-color: transparent;
    font-family: system-ui, -apple-system, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
  }

  header {
    display: flex; align-items: center; gap: 12px; z-index: 2;
    padding: max(12px, env(safe-area-inset-top)) max(16px, env(safe-area-inset-right)) 12px max(16px, env(safe-area-inset-left));
    background: rgba(15, 23, 42, 0.92); border-bottom: 1px solid rgba(148, 163, 184, 0.14);
  }
  .mark {
    flex-shrink: 0; width: 38px; height: 38px; border-radius: 11px; display: grid; place-items: center;
    background: rgba(234, 88, 12, 0.14); color: #fb923c;
  }
  .t { flex: 1; min-width: 0; }
  h1 {
    margin: 0; font-size: 15px; font-weight: 650; letter-spacing: -0.01em;
    white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
  }
  .meta { display: flex; align-items: center; gap: 8px; margin-top: 4px; min-width: 0; font-size: 12px; color: #94a3b8; }
  .chip {
    flex-shrink: 0; padding: 2px 8px; border-radius: 999px;
    font-size: 10.5px; font-weight: 700; letter-spacing: 0.05em; text-transform: uppercase;
  }
  .chip.before { background: rgba(245, 158, 11, 0.16); color: #fbbf24; }
  .chip.after { background: rgba(34, 197, 94, 0.16); color: #4ade80; }
  .loc { display: flex; align-items: center; gap: 4px; min-width: 0; }
  .loc span { white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .actions { display: flex; gap: 8px; flex-shrink: 0; }
  .btn {
    display: inline-flex; align-items: center; gap: 7px; height: 38px; padding: 0 14px;
    border-radius: 10px; border: 1px solid rgba(148, 163, 184, 0.22); background: rgba(30, 41, 59, 0.9);
    color: #f1f5f9; font: inherit; font-size: 14px; font-weight: 600; text-decoration: none; cursor: pointer;
    transition: background-color 150ms ease, border-color 150ms ease, transform 100ms ease;
  }
  .btn:hover { background: #334155; }
  .btn:active { transform: scale(0.97); }
  .btn.primary { background: #f8fafc; color: #0f172a; border-color: transparent; }
  .btn.primary:hover { background: #e2e8f0; }
  .btn:focus-visible, .icon:focus-visible, #zoom:focus-visible { outline: 2px solid #fb923c; outline-offset: 2px; }

  #stage {
    position: relative; overflow: hidden; display: flex; align-items: center; justify-content: center;
    padding: 16px; touch-action: none; user-select: none; -webkit-user-select: none; cursor: zoom-in;
  }
  #stage.zoomed { cursor: grab; }
  #stage.dragging { cursor: grabbing; }
  #img {
    display: block; max-width: 100%; max-height: 100%; object-fit: contain; border-radius: 8px;
    box-shadow: 0 24px 64px -16px rgba(0, 0, 0, 0.7), 0 0 0 1px rgba(148, 163, 184, 0.08);
    opacity: 0; transform-origin: center center; will-change: transform;
    transition: opacity 280ms ease; -webkit-user-drag: none;
  }
  .ready #img { opacity: 1; }
  .spinner {
    position: absolute; inset: 0; margin: auto; width: 36px; height: 36px; border-radius: 50%;
    border: 3px solid rgba(148, 163, 184, 0.22); border-top-color: #f8fafc; animation: spin 800ms linear infinite;
  }
  .ready .spinner, .failed .spinner { display: none; }
  @keyframes spin { to { transform: rotate(360deg); } }
  .hint {
    position: absolute; left: 50%; bottom: 16px; transform: translateX(-50%); pointer-events: none;
    padding: 7px 14px; border-radius: 999px; white-space: nowrap;
    background: rgba(15, 23, 42, 0.85); border: 1px solid rgba(148, 163, 184, 0.16);
    color: #cbd5e1; font-size: 12.5px; opacity: 0; transition: opacity 400ms ease;
  }
  .ready .hint { opacity: 1; }
  .ready .hint.gone { opacity: 0; }
  .panel {
    display: none; flex-direction: column; align-items: center; gap: 12px; max-width: 360px;
    text-align: center; color: #cbd5e1; font-size: 15px; line-height: 1.5;
  }
  .panel svg { color: #64748b; }
  .failed #img { display: none; }
  .failed .panel, .message .panel { display: flex; }

  footer { display: flex; justify-content: center; padding: 10px 16px max(14px, env(safe-area-inset-bottom)); }
  .bar {
    display: flex; align-items: center; gap: 2px; padding: 5px; border-radius: 14px;
    background: rgba(30, 41, 59, 0.92); border: 1px solid rgba(148, 163, 184, 0.16);
    box-shadow: 0 12px 32px -12px rgba(0, 0, 0, 0.6);
  }
  .icon {
    width: 40px; height: 40px; display: grid; place-items: center; border: 0; border-radius: 10px;
    background: transparent; color: #e2e8f0; cursor: pointer; transition: background-color 150ms ease;
  }
  .icon:hover { background: rgba(148, 163, 184, 0.14); }
  .icon:disabled { color: #475569; cursor: default; background: transparent; }
  #zoom {
    min-width: 60px; height: 40px; border: 0; border-radius: 10px; background: transparent; cursor: pointer;
    color: #f1f5f9; font: inherit; font-size: 13px; font-weight: 600; font-variant-numeric: tabular-nums;
  }
  #zoom:hover { background: rgba(148, 163, 184, 0.14); }
  .failed footer, .message footer { visibility: hidden; }

  @media (max-width: 560px) {
    .btn .lbl { display: none; }
    .btn { padding: 0 11px; }
    .mark { display: none; }
    h1 { font-size: 14px; }
  }
  @media (prefers-reduced-motion: reduce) {
    *, *::before, *::after { animation-duration: 0s !important; transition-duration: 0s !important; }
  }
`;

// Viewer behaviour. Zoom keeps the point under the finger/cursor still:
// for a point p (relative to the stage centre) over image offset t at
// scale s, the new offset at scale s' is p - (p - t) * s'/s.
const SCRIPT = `
(function () {
  var body = document.body;
  var stage = document.getElementById('stage');
  var img = document.getElementById('img');
  var label = document.getElementById('zoom');
  var hint = document.getElementById('hint');
  var zoomIn = document.getElementById('zoom-in');
  var zoomOut = document.getElementById('zoom-out');
  var reduce = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
  var coarse = window.matchMedia && matchMedia('(pointer: coarse)').matches;
  var MIN = 1, MAX = 6, STEP = 1.6, TAP_ZOOM = 2.5;
  var scale = 1, x = 0, y = 0;

  function close() {
    if (history.length > 1) { history.back(); return; }
    window.close();
    setTimeout(function () {
      if (hint) { hint.textContent = 'You can close this tab now to return to the report.'; hint.classList.remove('gone'); }
    }, 300);
  }
  document.getElementById('close').addEventListener('click', close);
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') close();
    if (!img || !body.classList.contains('ready')) return;
    if (e.key === '+' || e.key === '=') zoomTo(scale * STEP, 0, 0, true);
    if (e.key === '-' || e.key === '_') zoomTo(scale / STEP, 0, 0, true);
    if (e.key === '0') zoomTo(1, 0, 0, true);
  });
  if (!img) return;

  function apply(animate) {
    var r = stage.getBoundingClientRect();
    var mx = Math.max(0, (img.offsetWidth * scale - r.width) / 2 + 24);
    var my = Math.max(0, (img.offsetHeight * scale - r.height) / 2 + 24);
    if (scale <= 1) { x = 0; y = 0; } else { x = Math.max(-mx, Math.min(mx, x)); y = Math.max(-my, Math.min(my, y)); }
    img.style.transition = animate && !reduce ? 'opacity 280ms ease, transform 220ms cubic-bezier(.2,.8,.2,1)' : 'opacity 280ms ease';
    img.style.transform = 'translate3d(' + x + 'px,' + y + 'px,0) scale(' + scale + ')';
    label.textContent = scale <= 1.001 ? 'Fit' : Math.round(scale * 100) + '%';
    zoomIn.disabled = scale >= MAX - 0.001;
    zoomOut.disabled = scale <= MIN + 0.001;
    stage.classList.toggle('zoomed', scale > 1.001);
  }
  function zoomTo(s, px, py, animate) {
    s = Math.max(MIN, Math.min(MAX, s));
    var k = s / scale;
    x = px - (px - x) * k; y = py - (py - y) * k; scale = s;
    apply(animate);
    if (hint) hint.classList.add('gone');
  }
  function local(cx, cy) {
    var r = stage.getBoundingClientRect();
    return [cx - (r.left + r.width / 2), cy - (r.top + r.height / 2)];
  }

  zoomIn.addEventListener('click', function () { zoomTo(scale * STEP, 0, 0, true); });
  zoomOut.addEventListener('click', function () { zoomTo(scale / STEP, 0, 0, true); });
  label.addEventListener('click', function () { zoomTo(1, 0, 0, true); });

  stage.addEventListener('wheel', function (e) {
    if (!body.classList.contains('ready')) return;
    e.preventDefault();
    var p = local(e.clientX, e.clientY);
    zoomTo(scale * Math.exp(-e.deltaY * 0.0022), p[0], p[1], false);
  }, { passive: false });

  var pts = new Map(), pinch = null, pan = null, lastTap = { t: 0, x: 0, y: 0 }, moved = false;
  stage.addEventListener('pointerdown', function (e) {
    if (!body.classList.contains('ready')) return;
    stage.setPointerCapture(e.pointerId);
    pts.set(e.pointerId, { x: e.clientX, y: e.clientY });
    moved = false;
    if (pts.size === 2) {
      var a = Array.from(pts.values());
      pinch = { d: Math.hypot(a[0].x - a[1].x, a[0].y - a[1].y), s: scale };
      pan = null;
    } else if (pts.size === 1) {
      pan = { x: e.clientX - x, y: e.clientY - y, sx: e.clientX, sy: e.clientY };
    }
  });
  stage.addEventListener('pointermove', function (e) {
    if (!pts.has(e.pointerId)) return;
    pts.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pinch && pts.size === 2) {
      var a = Array.from(pts.values());
      var d = Math.hypot(a[0].x - a[1].x, a[0].y - a[1].y);
      var m = local((a[0].x + a[1].x) / 2, (a[0].y + a[1].y) / 2);
      zoomTo(pinch.s * d / pinch.d, m[0], m[1], false);
      moved = true;
    } else if (pan && scale > 1.001) {
      if (Math.abs(e.clientX - pan.sx) + Math.abs(e.clientY - pan.sy) > 4) { moved = true; stage.classList.add('dragging'); }
      x = e.clientX - pan.x; y = e.clientY - pan.y; apply(false);
    } else if (pan && Math.abs(e.clientX - pan.sx) + Math.abs(e.clientY - pan.sy) > 6) {
      moved = true;
    }
  });
  function end(e) {
    if (!pts.has(e.pointerId)) return;
    pts.delete(e.pointerId);
    stage.classList.remove('dragging');
    if (pts.size < 2) pinch = null;
    if (pts.size === 1) {
      var p = Array.from(pts.values())[0];
      pan = { x: p.x - x, y: p.y - y, sx: p.x, sy: p.y };
    }
    if (pts.size === 0 && !moved && e.type === 'pointerup') {
      var now = Date.now();
      if (now - lastTap.t < 320 && Math.abs(e.clientX - lastTap.x) < 30 && Math.abs(e.clientY - lastTap.y) < 30) {
        var q = local(e.clientX, e.clientY);
        zoomTo(scale > 1.001 ? 1 : TAP_ZOOM, q[0], q[1], true);
        lastTap.t = 0;
      } else {
        lastTap = { t: now, x: e.clientX, y: e.clientY };
      }
    }
    if (pts.size === 0) pan = null;
  }
  stage.addEventListener('pointerup', end);
  stage.addEventListener('pointercancel', end);
  window.addEventListener('resize', function () { apply(false); });

  function loaded() {
    body.classList.add('ready');
    apply(false);
    if (hint) {
      hint.textContent = coarse ? 'Double-tap or pinch to zoom' : 'Double-click or scroll to zoom';
      setTimeout(function () { hint.classList.add('gone'); }, 2800);
    }
  }
  function failed() { body.classList.add('failed'); }
  if (img.complete && img.naturalWidth) loaded();
  else { img.addEventListener('load', loaded); img.addEventListener('error', failed); }
  document.getElementById('retry').addEventListener('click', function () { location.reload(); });
})();
`;

function header(title: string, stage: Stage, location: string | null, downloadUrl: string | null): string {
  const chip = stage ? `<span class="chip ${stage}">${stage === 'before' ? 'Before' : 'After'}</span>` : '';
  const loc = location ? `<span class="loc">${ICON.pin}<span>${esc(location)}</span></span>` : '';
  const meta = chip || loc ? `<div class="meta">${chip}${loc}</div>` : '';
  const download = downloadUrl
    ? `<a class="btn" href="${esc(downloadUrl)}" rel="noopener noreferrer">${ICON.download}<span class="lbl">Download</span></a>`
    : '';
  return `
<header>
  <div class="mark">${ICON.camera}</div>
  <div class="t"><h1>${esc(title)}</h1>${meta}</div>
  <div class="actions">
    ${download}
    <button class="btn primary" id="close" type="button">${ICON.close}<span class="lbl">Close</span></button>
  </div>
</header>`;
}

function document_(nonce: string, title: string, bodyClass: string, inner: string): string {
  return `<!doctype html>
<html lang="en"><head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
<meta name="robots" content="noindex, nofollow" />
<meta name="referrer" content="no-referrer" />
<title>${esc(title)}</title>
<style nonce="${nonce}">${STYLE}</style>
</head><body class="${bodyClass}">${inner}
<script nonce="${nonce}">${SCRIPT}</script>
</body></html>`;
}

export function renderPhotoPage(view: Extract<PhotoView, { kind: 'ok' }>, nonce: string): string {
  return document_(nonce, view.title, '', `
${header(view.title, view.stage, view.location, view.downloadUrl)}
<main id="stage">
  <div class="spinner" role="status" aria-label="Loading photo"></div>
  <img id="img" src="${esc(view.imageUrl)}" alt="${esc(view.title)}" decoding="async" fetchpriority="high" draggable="false" />
  <div class="panel">${ICON.alert}<div>The photo couldn't be loaded.</div><button class="btn" id="retry" type="button">Try again</button></div>
  <div class="hint" id="hint"></div>
</main>
<footer>
  <div class="bar" role="toolbar" aria-label="Zoom">
    <button class="icon" id="zoom-out" type="button" aria-label="Zoom out">${ICON.minus}</button>
    <button id="zoom" type="button" aria-label="Fit to screen">Fit</button>
    <button class="icon" id="zoom-in" type="button" aria-label="Zoom in">${ICON.plus}</button>
  </div>
</footer>`);
}

export function renderPhotoMessagePage(message: string, nonce: string): string {
  return document_(nonce, 'Photo', 'message', `
${header('Photo', null, null, null)}
<main id="stage"><div class="panel">${ICON.alert}<div>${esc(message)}</div></div></main>
<footer></footer>`);
}
