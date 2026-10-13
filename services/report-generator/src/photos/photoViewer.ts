import { esc } from '../templates/helpers';
import type { PhotoView } from './photoPage';

/**
 * Markup, style and behaviour of the report photo viewer (GET /p/:token).
 * Design from the owner-approved Stitch mock-up (2026-10-12): light and
 * document-like — white header with the asset name and location, outlined
 * Download and solid navy Close, the photo on a pale grey canvas, and a
 * floating white zoom pill. Behaviour: loading spinner, fade-in, zoom by
 * double-tap/double-click (at the point), pinch, scroll wheel and the pill;
 * drag to pan; Esc / + / - / 0 shortcuts; clear error and "no longer
 * available" states.
 *
 * No external assets (the page's CSP allows only its own nonce'd style and
 * script plus images from the storage host): icons are inline SVG, fonts
 * are the device's own.
 */

type Stage = 'before' | 'after' | null;

// ── Icons (inline SVG, stroke = currentColor) ───────────────────────────
const svg = (body: string, size = 18, stroke = 2) =>
  `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="${stroke}" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${body}</svg>`;
const ICON = {
  close: svg('<path d="M18 6 6 18M6 6l12 12"/>', 16, 2.2),
  download: svg('<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><path d="M7 10l5 5 5-5"/><path d="M12 15V3"/>', 16),
  pin: svg('<path d="M12 21c-4-4.5-7-8.5-7-12a7 7 0 0 1 14 0c0 3.5-3 7.5-7 12z"/><circle cx="12" cy="9" r="2.5"/>', 13, 1.8),
  gone: svg('<rect x="3" y="3" width="18" height="18" rx="2"/><path d="M9 9l6 6M15 9l-6 6"/>', 24, 1.75),
  alert: svg('<circle cx="12" cy="12" r="10"/><path d="M12 8v4M12 16h.01"/>', 24, 1.75),
  retry: svg('<path d="M21 12a9 9 0 0 0-9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/><path d="M3 12a9 9 0 0 0 9 9 9.75 9.75 0 0 0 6.74-2.74L21 16"/><path d="M16 21h5v-5"/>', 16),
};

const STYLE = `
  * { box-sizing: border-box; }
  html, body { height: 100%; }
  body {
    margin: 0; height: 100vh; height: 100dvh; overflow: hidden;
    display: flex; flex-direction: column;
    background: #F1F5F9; color: #1E293B; -webkit-tap-highlight-color: transparent;
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
    -webkit-font-smoothing: antialiased;
  }
  button:focus-visible, a:focus-visible { outline: 2px solid #EA580C; outline-offset: 2px; }

  header {
    flex-shrink: 0; min-height: 64px; display: flex; align-items: center; justify-content: space-between; gap: 12px;
    padding: max(10px, env(safe-area-inset-top)) max(24px, env(safe-area-inset-right)) 10px max(24px, env(safe-area-inset-left));
    background: #FFFFFF; border-bottom: 1px solid #E2E8F0; z-index: 2;
  }
  .t { min-width: 0; flex: 1; }
  h1 {
    margin: 0; font-size: 16px; font-weight: 600; line-height: 1.25; letter-spacing: -0.01em;
    white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
  }
  .meta { display: flex; align-items: center; gap: 5px; margin-top: 3px; font-size: 13px; color: #64748B; min-width: 0; }
  .meta svg { flex-shrink: 0; }
  .meta span { white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .meta .stage { font-weight: 600; color: #475569; flex-shrink: 0; }
  .meta .dot { color: #CBD5E1; flex-shrink: 0; }
  .actions { display: flex; align-items: center; gap: 12px; flex-shrink: 0; }
  .btn {
    height: 40px; padding: 0 16px; border-radius: 8px; display: inline-flex; align-items: center; justify-content: center; gap: 8px;
    font: inherit; font-size: 14px; font-weight: 500; text-decoration: none; cursor: pointer;
    box-shadow: 0 1px 2px rgba(15, 23, 42, 0.05); transition: background-color 150ms ease, border-color 150ms ease;
  }
  .btn.outline { background: #FFFFFF; border: 1px solid #CBD5E1; color: #1E293B; }
  .btn.outline:hover { background: #F8FAFC; border-color: #94A3B8; }
  .btn.outline:active { background: #F1F5F9; }
  .btn.solid { background: #1E293B; border: 1px solid #1E293B; color: #FFFFFF; }
  .btn.solid:hover { background: #0F172A; }
  .btn.solid:active { background: #020617; }
  body:not(.ready) .dl { opacity: 0.4; pointer-events: none; }
  .failed .dl, .message .dl { display: none; }

  #stage {
    position: relative; flex: 1; min-height: 0; overflow: hidden; display: flex; align-items: center; justify-content: center;
    /* Bottom padding keeps the fitted photo clear of the zoom pill. */
    padding: 24px 24px 92px; touch-action: none; user-select: none; -webkit-user-select: none; cursor: zoom-in;
  }
  .message #stage { cursor: default; }
  #stage.zoomed { cursor: grab; }
  #stage.dragging { cursor: grabbing; }
  #img {
    display: block; max-width: 100%; max-height: 100%; object-fit: contain; border-radius: 8px; background: #FFFFFF;
    box-shadow: 0 4px 20px -4px rgba(15, 23, 42, 0.12), 0 2px 6px -2px rgba(15, 23, 42, 0.08);
    opacity: 0; transform-origin: center center; will-change: transform; transition: opacity 260ms ease; -webkit-user-drag: none;
  }
  .ready #img { opacity: 1; }
  .spinner {
    position: absolute; inset: 0; margin: auto; width: 32px; height: 32px; border-radius: 50%;
    border: 3px solid rgba(148, 163, 184, 0.3); border-top-color: #94A3B8; animation: spin 900ms linear infinite;
  }
  .ready .spinner, .failed .spinner { display: none; }
  @keyframes spin { to { transform: rotate(360deg); } }

  .panel { display: none; flex-direction: column; align-items: center; max-width: 260px; text-align: center; }
  .failed .panel, .message .panel { display: flex; }
  .failed #img { display: none; }
  .icon-box {
    width: 48px; height: 48px; border-radius: 8px; border: 1px solid #CBD5E1; background: #FFFFFF;
    display: grid; place-items: center; color: #64748B; margin-bottom: 12px;
  }
  .panel p { margin: 0; font-size: 14px; font-weight: 500; line-height: 1.5; color: #64748B; }
  .panel .btn { margin-top: 16px; height: 44px; padding: 0 20px; }

  .hint {
    position: absolute; left: 50%; bottom: 96px; transform: translateX(-50%); pointer-events: none; white-space: nowrap;
    padding: 6px 12px; border-radius: 999px; background: rgba(255, 255, 255, 0.95); border: 1px solid #E2E8F0;
    color: #475569; font-size: 12.5px; box-shadow: 0 4px 12px rgba(15, 23, 42, 0.08);
    opacity: 0; transition: opacity 400ms ease;
  }
  .ready .hint { opacity: 1; }
  .ready .hint.gone { opacity: 0; }

  .pill {
    position: absolute; left: 50%; bottom: max(28px, calc(env(safe-area-inset-bottom) + 16px)); transform: translateX(-50%);
    display: flex; align-items: center; gap: 4px; height: 44px; padding: 0 8px; border-radius: 999px;
    background: #FFFFFF; border: 1px solid #E2E8F0;
    box-shadow: 0 4px 14px rgba(15, 23, 42, 0.08), 0 1px 3px rgba(15, 23, 42, 0.04); z-index: 3;
  }
  body:not(.ready) .pill { opacity: 0.5; pointer-events: none; }
  .failed .pill { display: none; }
  .pill button {
    height: 32px; border: 0; border-radius: 999px; background: transparent; color: #1E293B; cursor: pointer;
    font: inherit; font-weight: 500; display: inline-flex; align-items: center; justify-content: center;
    transition: background-color 150ms ease;
  }
  .pill button:hover { background: #F1F5F9; }
  .pill button:active { background: #E2E8F0; }
  .pill button:disabled { color: #CBD5E1; background: transparent; cursor: default; }
  .zbtn { width: 32px; font-size: 18px; line-height: 1; }
  #zoom { min-width: 48px; text-align: center; font-size: 13px; font-weight: 500; font-variant-numeric: tabular-nums; }
  .sep { width: 1px; height: 16px; background: #E2E8F0; margin: 0 4px; }
  #fit { padding: 0 12px; font-size: 13px; }

  @media (max-width: 600px) {
    header { padding-left: max(16px, env(safe-area-inset-left)); padding-right: max(16px, env(safe-area-inset-right)); }
    h1 { font-size: 15px; }
    .meta { font-size: 12px; }
    .actions { gap: 8px; }
    header .btn { width: 44px; height: 44px; padding: 0; }
    header .btn .lbl { display: none; }
    #stage { padding: 12px 0 84px; }
    #img { border-radius: 0; }
  }
  @media (prefers-reduced-motion: reduce) {
    *, *::before, *::after { animation-duration: 0s !important; transition-duration: 0s !important; }
  }
`;

// Zoom keeps the point under the finger/cursor still: for a point p
// (relative to the stage centre) over image offset t at scale s, the new
// offset at scale s' is p - (p - t) * s'/s.
const SCRIPT = `
(function () {
  var body = document.body;
  var stage = document.getElementById('stage');
  var img = document.getElementById('img');
  var hint = document.getElementById('hint');
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

  var label = document.getElementById('zoom');
  var zoomIn = document.getElementById('zoom-in');
  var zoomOut = document.getElementById('zoom-out');
  var fit = document.getElementById('fit');

  function apply(animate) {
    var r = stage.getBoundingClientRect();
    var mx = Math.max(0, (img.offsetWidth * scale - r.width) / 2 + 24);
    var my = Math.max(0, (img.offsetHeight * scale - r.height) / 2 + 24);
    if (scale <= 1) { x = 0; y = 0; } else { x = Math.max(-mx, Math.min(mx, x)); y = Math.max(-my, Math.min(my, y)); }
    img.style.transition = animate && !reduce ? 'opacity 260ms ease, transform 220ms cubic-bezier(.2,.8,.2,1)' : 'opacity 260ms ease';
    img.style.transform = 'translate3d(' + x + 'px,' + y + 'px,0) scale(' + scale + ')';
    label.textContent = Math.round(scale * 100) + '%';
    zoomIn.disabled = scale >= MAX - 0.001;
    zoomOut.disabled = scale <= MIN + 0.001;
    fit.disabled = scale <= MIN + 0.001;
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
  fit.addEventListener('click', function () { zoomTo(1, 0, 0, true); });

  stage.addEventListener('wheel', function (e) {
    if (!body.classList.contains('ready')) return;
    e.preventDefault();
    var p = local(e.clientX, e.clientY);
    zoomTo(scale * Math.exp(-e.deltaY * 0.0022), p[0], p[1], false);
  }, { passive: false });

  var pts = new Map(), pinch = null, pan = null, lastTap = { t: 0, x: 0, y: 0 }, moved = false;
  stage.addEventListener('pointerdown', function (e) {
    if (!body.classList.contains('ready') || e.target.closest('.pill')) return;
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
  const parts: string[] = [];
  if (stage) parts.push(`<span class="stage">${stage === 'before' ? 'Before' : 'After'}</span>`);
  if (location) parts.push(`${ICON.pin}<span>${esc(location)}</span>`);
  const meta = parts.length ? `<div class="meta">${parts.join('<span class="dot">&middot;</span>')}</div>` : '';
  const download = downloadUrl
    ? `<a class="btn outline dl" href="${esc(downloadUrl)}" rel="noopener noreferrer" aria-label="Download photo">${ICON.download}<span class="lbl">Download</span></a>`
    : '';
  return `
<header>
  <div class="t"><h1>${esc(title)}</h1>${meta}</div>
  <div class="actions">
    ${download}
    <button class="btn solid" id="close" type="button" aria-label="Close photo viewer">${ICON.close}<span class="lbl">Close</span></button>
  </div>
</header>`;
}

function page(nonce: string, title: string, bodyClass: string, inner: string): string {
  return `<!doctype html>
<html lang="en"><head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
<meta name="robots" content="noindex, nofollow" />
<meta name="referrer" content="no-referrer" />
<meta name="theme-color" content="#FFFFFF" />
<title>${esc(title)}</title>
<style nonce="${nonce}">${STYLE}</style>
</head><body class="${bodyClass}">${inner}
<script nonce="${nonce}">${SCRIPT}</script>
</body></html>`;
}

export function renderPhotoPage(view: Extract<PhotoView, { kind: 'ok' }>, nonce: string): string {
  return page(nonce, view.title, '', `
${header(view.title, view.stage, view.location, view.downloadUrl)}
<main id="stage">
  <div class="spinner" role="status" aria-label="Loading photo"></div>
  <img id="img" src="${esc(view.imageUrl)}" alt="${esc(view.title)}" decoding="async" fetchpriority="high" draggable="false" />
  <div class="panel">
    <div class="icon-box">${ICON.alert}</div>
    <p>Couldn't load the photo</p>
    <button class="btn outline" id="retry" type="button">${ICON.retry}<span>Try again</span></button>
  </div>
  <div class="hint" id="hint"></div>
  <div class="pill" role="toolbar" aria-label="Zoom controls">
    <button class="zbtn" id="zoom-out" type="button" aria-label="Zoom out">&minus;</button>
    <span id="zoom" aria-live="polite">100%</span>
    <button class="zbtn" id="zoom-in" type="button" aria-label="Zoom in">+</button>
    <span class="sep" aria-hidden="true"></span>
    <button id="fit" type="button" aria-label="Fit photo to screen">Fit</button>
  </div>
</main>`);
}

export function renderPhotoMessagePage(message: string, nonce: string): string {
  return page(nonce, 'Photo', 'message', `
${header('Photo', null, null, null)}
<main id="stage">
  <div class="panel"><div class="icon-box">${ICON.gone}</div><p>${esc(message)}</p></div>
</main>`);
}
