import { COLORS } from './theme';
import { InspectionPhoto } from '../types';

/** Every piece of user-entered text (descriptions, notes, names) MUST go through
 * this before being interpolated into HTML — this content originates from
 * technician-entered free text and must never be trusted as markup. */
export function esc(value: unknown): string {
  if (value == null) return '';
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function fmtDate(iso: string | null | undefined): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' });
}

export function fmtDateTime(iso: string | null | undefined): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return `${d.toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' })} ${d.toLocaleTimeString('en-AU', { hour: 'numeric', minute: '2-digit' })}`;
}

export function fmtCurrency(v: number | null | undefined): string {
  if (v == null) return '$0.00';
  return `$${Number(v).toFixed(2)}`;
}

export function resultPill(result: 'pass' | 'fail' | 'not_tested' | null): string {
  const key = result ?? 'not_tested';
  const label = key === 'pass' ? 'PASS' : key === 'fail' ? 'FAIL' : 'N/T';
  const c = COLORS.PILL[key];
  return `<span class="pill" style="background:${c.bg};color:${c.text};border:1px solid ${c.border}">${label}</span>`;
}

/**
 * Renders an inline photo. If this photo's id has no entry in `signedUrls`
 * (the download/resize failed, or the underlying object was deleted), we
 * render an explicit "photo unavailable" placeholder box instead of silently
 * omitting the image — the old Edge Function template dropped failed photos
 * with no trace at all, which meant a technician had no way to know their
 * evidence photo never made it into a compliance report they're legally
 * relying on.
 */
export function photoTag(photo: InspectionPhoto, signedUrls: Map<string, string>): string {
  const url = signedUrls.get(photo.id);
  if (!url) {
    return `<div class="thumb-missing">photo<br/>unavailable</div>`;
  }
  return `<img class="thumb" src="${esc(url)}" alt="" />`;
}

export function photoRow(photos: InspectionPhoto[], signedUrls: Map<string, string>, max = 6): string {
  if (photos.length === 0) return '';
  const shown = photos.slice(0, max);
  const tags = shown.map((p) => photoTag(p, signedUrls)).join('');
  const more = photos.length > max
    ? `<span style="font-size:9px;color:${COLORS.MUTED};align-self:center;margin-left:4px">+${photos.length - max}</span>`
    : '';
  return `<div style="display:flex;gap:6px;margin-top:6px;flex-wrap:wrap;align-items:center">${tags}${more}</div>`;
}

/**
 * Pulls the <body>...</body> inner content out of a template's full HTML
 * document. Used to stitch several sections into one combined page (see
 * generation/pipeline.ts) — each render*() function returns a complete,
 * independently-valid HTML document so it can also be rendered standalone
 * when a report is large enough to need per-section chunking.
 */
export function extractBody(html: string): string {
  const match = /<body>([\s\S]*)<\/body>/.exec(html);
  return match ? match[1] : html;
}
