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

/** "3 days ago" / "today" — mirrors the reference report's "identified N days
 * ago" convention, which matters most on a long multi-routine report: it lets
 * a reader tell an outstanding defect carried over from a prior visit apart
 * from one just raised in this inspection, without cross-referencing dates. */
export function fmtRelativeDays(iso: string | null | undefined): string {
  if (!iso) return '';
  const then = new Date(iso);
  if (Number.isNaN(then.getTime())) return '';
  const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const days = Math.round((startOfDay(new Date()).getTime() - startOfDay(then).getTime()) / 86400000);
  if (days <= 0) return 'today';
  if (days === 1) return 'yesterday';
  return `${days} days ago`;
}

// FIX: was `$${Number(v).toFixed(2)}` — no thousands separator, so a
// $1,234 quote rendered as "$1234.00" here while the admin dashboard's
// Quotes page (which uses Intl.NumberFormat) showed "$1,234.00" for the
// exact same value.
export function fmtCurrency(v: number | null | undefined): string {
  if (v == null) return '$0.00';
  return new Intl.NumberFormat('en-AU', { style: 'currency', currency: 'AUD' }).format(Number(v));
}

// ── Prices never print ───────────────────────────────────────────────────
// Owner's rule (2026-10-11): the report must not show prices — a client
// reading "Critical defect" next to a dollar figure reads it as a sales
// pitch. Quotes stay in the app and admin portal. The defect-code library's
// descriptions carry prices inline ("…replace Seal $135.00", "…investigation
// $85.00+GST p/hr"), and picking a code copies that text onto the defect, so
// descriptions are cleaned here, at print time; the stored text (which
// technicians quote from) is never changed.

// "$135", "$1,350.00", "AU$90", "AUD 150", "@$150", "135$", "90 dollars" —
// plus any GST / rate wording around it.
const GST = String.raw`(?:\s*(?:\+\s*|plus\s+|inc\.?\s*|incl\.?\s*|ex\.?\s*|excl\.?\s*)GST)`;
const RATE = String.raw`(?:\s*(?:\/\s*h(?:r|our)?|p\/\s*h(?:r)?|per\s+hour|per\s+hr|an?\s+hour|ea|each)\b)`;
const NUM = String.raw`\d[\d,]*(?:\.\d{1,2})?`;
const MONEY = String.raw`(?:@?\s*(?:AUD\s?\$?|AU\$|A\$|\$)\s?${NUM}|${NUM}\s?(?:\$|AUD\b|dollars?\b))`;
const AMOUNT = String.raw`${MONEY}${GST}?${RATE}?${GST}?`;
// Wording that only exists to introduce the price goes with it.
const LEAD_IN = String.raw`(?:\b(?:at\s+(?:an?\s+)?(?:additional|extra)(?:\s+cost)?(?:\s+of)?|at\s+a\s+cost\s+of|costing|for)\s*)?`;
// After a comparison the sentence still needs an object: "exceeds $400" ->
// "exceeds the agreed limit".
const COMPARED = new RegExp(String.raw`\b(exceeds?|over|above|under|below|up\s+to|more\s+than|less\s+than)\s+${AMOUNT}`, 'gi');
const PRICE = new RegExp(String.raw`\s*${LEAD_IN}${AMOUNT}`, 'gi');
const HAS_PRICE = /\$\s?\d|\d\s?\$|\bAUD\b|\d\s+dollars?\b/i;

export function stripPrices(text: string): string;
export function stripPrices(text: string | null | undefined): string | null | undefined;
export function stripPrices(text: string | null | undefined): string | null | undefined {
  if (!text || !HAS_PRICE.test(text)) return text;
  return text
    .replace(COMPARED, '$1 the agreed limit')
    .replace(PRICE, '')
    // Tidy what the removal left behind.
    .replace(/[ \t]*[—–-][ \t]*(?=[.,;)]|$)/gm, '') // "repair — ." -> "repair."
    .replace(/[ \t]*&[ \t]*(?=[.,;)]|$)/gm, '')       // "… & )" -> "…)"
    .replace(/[ \t]*&[ \t]*\(/g, ' (')                // "Speaker & (…" -> "Speaker (…"
    .replace(/\([ \t]*(?:add|plus)?[ \t]*\)/gi, '')   // empty "( )"
    .replace(/\([ \t]*(?:add|plus)[ \t]+for[ \t]+/gi, '(') // "(add for electrician…" -> "(electrician…"
    .replace(/\([ \t]+/g, '(')
    .replace(/[ \t]+([.,;:)])/g, '$1')
    .replace(/([.,;:])(?=[.,;:])/g, '')                // ",." -> "."
    .replace(/[ \t]{2,}/g, ' ')
    .replace(/[ \t]*[,;:][ \t]*$/gm, '')               // "Replaced seal," -> "Replaced seal"
    .replace(/[ \t]+$/gm, '')
    .trim();
}

type PillColors = { bg: string; text: string; border: string };

/** A small rounded status tag. `label` must already be safe HTML. */
export function pill(label: string, c: PillColors): string {
  return `<span class="pill" style="background:${c.bg};color:${c.text};border-color:${c.border}">${label}</span>`;
}

export function resultPill(result: 'pass' | 'fail' | 'not_tested' | null): string {
  const key = result ?? 'not_tested';
  const label = key === 'pass' ? 'PASS' : key === 'fail' ? 'FAIL' : 'N/T';
  return pill(label, COLORS.PILL[key]);
}

/** A labelled value (Job Details, Report Details, Service Provider Details):
 * small grey label above, value below, optional grey second line. */
export function field(
  label: string,
  value: string | null | undefined,
  opts: { strong?: boolean; sub?: string | null } = {},
): string {
  return `<div><span class="label">${esc(label)}</span>`
    + `<div class="value${opts.strong ? ' strong' : ''}">${esc(value) || '&mdash;'}</div>`
    + `${opts.sub ? `<div class="sub">${esc(opts.sub)}</div>` : ''}</div>`;
}

/**
 * Renders an inline photo. If this photo's id has no entry in `signedUrls`
 * (the download/resize failed, or the underlying object was deleted), we
 * render an explicit "photo unavailable" placeholder box instead of silently
 * omitting the image — the old Edge Function template dropped failed photos
 * with no trace at all, which meant a technician had no way to know their
 * evidence photo never made it into a compliance report they're legally
 * relying on.
 *
 * When a full-resolution URL is also available (fullResUrls — see
 * photos/prepareFullResUrls.ts), the thumbnail is wrapped in a real <a
 * href> — Chromium's print-to-PDF preserves anchor tags as clickable link
 * annotations, so tapping the small embedded thumbnail in the PDF opens the
 * original at full size. Falls back to a plain, unlinked <img> if signing
 * the original failed for some reason — a missing link is a much smaller
 * problem than a missing photo, and shouldn't trigger the same "unavailable"
 * placeholder as the thumbnail itself failing.
 */
export function photoTag(photo: InspectionPhoto, signedUrls: Map<string, string>, fullResUrls?: Map<string, string>): string {
  const url = signedUrls.get(photo.id);
  if (!url) {
    return `<div class="thumb-missing">photo<br/>unavailable</div>`;
  }
  const img = `<img class="thumb" src="${esc(url)}" alt="" />`;
  const linkUrl = fullResUrls?.get(photo.id);
  return linkUrl ? `<a href="${esc(linkUrl)}" target="_blank" rel="noopener noreferrer">${img}</a>` : img;
}

/** Every photo, as thumbnails that wrap onto as many rows as needed (six
 * 110px thumbnails fit across an asset card). FIX: only the first 4 (6 for
 * before/after) used to print, with a bare "+N more" — evidence photos
 * silently missing from the report, with nothing to tap to see them.
 * `small` prints them at 80px (defect evidence) instead of 110px. */
export function photoRow(
  photos: InspectionPhoto[],
  signedUrls: Map<string, string>,
  fullResUrls?: Map<string, string>,
  small = false,
): string {
  if (photos.length === 0) return '';
  const tags = photos.map((p) => photoTag(p, signedUrls, fullResUrls)).join('');
  return `<div class="photos${small ? ' sm' : ''}">${tags}</div>`;
}

/** One labelled Before/After column — "this is what it looked like before /
 * after", not an undifferentiated photo dump. Used only by
 * stagedPhotoSection below. */
function labeledPhotoRow(label: string, photos: InspectionPhoto[], signedUrls: Map<string, string>, fullResUrls?: Map<string, string>): string {
  return `<div><span class="label">${label} Photos</span>${photoRow(photos, signedUrls, fullResUrls, true)}</div>`;
}

/**
 * Renders a defect's photos split by stage: Before and After side by side
 * (they wrap onto two lines when there are too many to fit), plus a plain
 * row for every photo with no stage — i.e. every photo captured before
 * this feature existed, or via the standalone "Log New Defect" flow, which
 * still doesn't ask for before/after.
 *
 * `includeUntagged` defaults to true (renderRepairs/renderUnlinkedDefects'
 * defects have no sibling asset-level row anywhere, so this is the only
 * place their untagged photos can ever render) — assetLogChunk.ts passes
 * false explicitly for its own per-asset defect cards, since a defect
 * rendered there ALWAYS has an asset row directly above it that already
 * shows every untagged photo (a defect's photo carries both asset_id and
 * defect_id, so photosByAsset/photosByDefect are not mutually exclusive).
 * Without this, every legacy/untagged defect photo rendered twice — caught
 * by test/templates.smoketest.ts's photo-appears-once assertion.
 */
export function stagedPhotoSection(photos: InspectionPhoto[], signedUrls: Map<string, string>, fullResUrls?: Map<string, string>, includeUntagged = true): string {
  if (photos.length === 0) return '';
  const before = photos.filter((p) => p.stage === 'before');
  const after = photos.filter((p) => p.stage === 'after');
  const untagged = includeUntagged ? photos.filter((p) => p.stage == null) : [];
  const columns = [
    before.length ? labeledPhotoRow('Before', before, signedUrls, fullResUrls) : '',
    after.length ? labeledPhotoRow('After', after, signedUrls, fullResUrls) : '',
  ].join('');
  return (columns ? `<div class="staged">${columns}</div>` : '')
    + (untagged.length ? photoRow(untagged, signedUrls, fullResUrls, true) : '');
}
