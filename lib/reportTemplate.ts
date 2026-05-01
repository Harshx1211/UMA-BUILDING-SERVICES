/**
 * lib/reportTemplate.ts
 *
 * Generates the HTML that expo-print converts to a professional A4 PDF.
 *
 * Design: Clean corporate inspection report
 *   - Navy/slate header with orange accent brand bar
 *   - Structured info grid with clear hierarchy
 *   - Colour-coded defect severity legend
 *   - Asset rows: PASS (green) / FAIL (red) / N/T (grey) pills
 *   - Defect boxes with full photo grids
 *   - Signature block with typed name fallback
 *   - Fixed footer on every page
 *
 * Photo handling:
 *   - Only data: URIs are embedded (safe for expo-print sandbox)
 *   - All images use explicit px dimensions (WKWebView collapses % sizes)
 *   - Broken images hidden via onerror handler
 */

import { CompanyConfig } from '@/constants/Company';
import {
  Defect,
  InspectionPhoto,
  InventoryItem,
  Job,
  Quote,
  QuoteItem,
  Signature,
  TimeLog,
} from '@/types';
import { formatAssetType } from '@/utils/assetHelpers';

// ─── Types ─────────────────────────────────────────────────────────────────────

export interface AssetWithResult {
  id: string;
  property_id: string;
  asset_type: string;
  description: string | null;
  location_on_site: string | null;
  serial_number: string | null;
  barcode_id: string | null;
  install_date: string | null;
  last_service_date: string | null;
  next_service_date: string | null;
  status: string;
  created_at: string;
  result: 'pass' | 'fail' | 'not_tested' | null;
  defect_reason: string | null;
  technician_notes: string | null;
  inspection_notes: string | null;
  actioned_at: string | null;
}

export interface ReportData {
  job: Job;
  assets: AssetWithResult[];
  defects: Defect[];
  signature: Signature | null;
  photos: InspectionPhoto[];
  timeLogs: TimeLog[];
  techName: string;
  reportId: string;
  approvedQuote?: Quote;
  quoteItems?: QuoteItem[];
  inventory?: InventoryItem[];
}

// ─── Helpers ───────────────────────────────────────────────────────────────────

function fmtDateShort(iso: string | null | undefined): string {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleDateString('en-AU', {
      day: 'numeric', month: 'short', year: 'numeric',
    });
  } catch { return iso; }
}

function fmtDateTimeFull(iso: string | null | undefined): string {
  if (!iso) return '—';
  try {
    const d = new Date(iso);
    const day = d.getDate();
    const sfx = [11, 12, 13].includes(day % 100) ? 'th'
      : day % 10 === 1 ? 'st' : day % 10 === 2 ? 'nd'
      : day % 10 === 3 ? 'rd' : 'th';
    const month = d.toLocaleDateString('en-AU', { month: 'long' });
    const year  = d.getFullYear();
    let h = d.getHours();
    const m  = String(d.getMinutes()).padStart(2, '0');
    const ap = h >= 12 ? 'PM' : 'AM';
    h = h % 12 || 12;
    return `${day}${sfx} ${month} ${year} ${h}:${m}${ap}`;
  } catch { return iso; }
}

function shortId(id: string, len = 5): string {
  return id.replace(/-/g, '').substring(0, len).toUpperCase();
}

function fmtCurrency(v: number | string): string {
  const n = parseFloat(String(v));
  return isNaN(n) ? '$0.00' : `$${n.toFixed(2)}`;
}

function fmtJobType(raw: string | null | undefined): string {
  if (!raw) return 'Service';
  return raw.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
}

/**
 * Only data: URIs are guaranteed to render inside expo-print's sandboxed WKWebView.
 * http/https URIs fail silently in offline/sandboxed contexts.
 * We accept data: only — pdfGenerator.ts encodes all images before calling us.
 */
function isSafe(src: string | null | undefined): src is string {
  if (!src) return false;
  return src.startsWith('data:');
}

function assetRefCode(asset: AssetWithResult, index: number): string {
  if (asset.serial_number) {
    const clean = asset.serial_number.replace(/\D/g, '');
    if (clean.length >= 3) return clean.slice(0, 3);
  }
  return String(index + 1).padStart(3, '0');
}

// ─── CSS ───────────────────────────────────────────────────────────────────────

const CSS = `
@page { margin: 0; size: A4 }
*, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
body {
  font-family: Helvetica Neue, Helvetica, Arial, sans-serif;
  color: #1E293B;
  line-height: 1.5;
  font-size: 11px;
  background: #fff;
}
.nb { page-break-inside: avoid; break-inside: avoid; }

/* ── Per-page footer (embedded inside each .page div) ── */
/* Using an embedded footer per page is the only reliable way to get correct
   page numbers in expo-print / WKWebView. CSS counter(page) and JS scrollHeight
   hacks both fail because they run in a screen rendering context, not print. */
.page-footer {
  position: absolute;
  bottom: 0; left: 0; right: 0;
  height: 44px;
  background: #1C3048;
  padding: 0 28px;
  display: flex; align-items: center; justify-content: space-between;
  font-size: 8.5px; color: rgba(255,255,255,0.65);
}
.pf-left  { line-height: 1.6; }
.pf-mid   { font-size: 9px; font-weight: 700; color: #E97316; text-align: center; white-space: nowrap; }
.pf-right { text-align: right; line-height: 1.6; }

/* ── Page wrapper ── */
/* min-height = A4 height; footer sits at absolute bottom inside the page */
.page {
  padding: 28px 32px 60px 32px;
  position: relative;
  min-height: 1122px; /* A4 at 96dpi = 1122.5px — ensures footer reaches the bottom */
  page-break-after: always;
  box-sizing: border-box;
}
.page:last-of-type { page-break-after: auto; }

/* ── Brand header ── */
.brand-bar {
  display: flex; align-items: center; justify-content: space-between;
  margin-bottom: 20px;
}
.brand-logo {
  display: flex; align-items: center; gap: 10px;
}
.brand-diamond {
  width: 36px; height: 36px;
  background: #E97316;
  transform: rotate(45deg);
  border-radius: 4px;
  display: flex; align-items: center; justify-content: center;
  flex-shrink: 0;
}
.brand-diamond-inner { transform: rotate(-45deg); }
.brand-init { font-size: 12px; font-weight: 900; color: #fff; letter-spacing: -1px; }
.brand-text { display: flex; flex-direction: column; line-height: 1.2; }
.brand-name { font-size: 13px; font-weight: 900; color: #1C3048; letter-spacing: 0.6px; text-transform: uppercase; }
.brand-name span { color: #E97316; }
.brand-sub  { font-size: 8px; font-weight: 700; color: #94A3B8; letter-spacing: 1.8px; text-transform: uppercase; }
.brand-meta { text-align: right; }
.brand-reportnum { font-size: 17px; font-weight: 800; color: #E97316; letter-spacing: 1px; }
.brand-reportlbl { font-size: 8.5px; color: #94A3B8; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px; margin-top: 2px; }

/* ── Section title bar ── */
.sec-bar {
  background: #1C3048;
  color: #fff;
  font-size: 10px;
  font-weight: 800;
  letter-spacing: 1.2px;
  text-transform: uppercase;
  padding: 7px 14px;
  border-radius: 4px 4px 0 0;
  border-left: 4px solid #E97316;
  margin-top: 18px;
}
.sec-bar.first { margin-top: 0; }
.sec-bar-light {
  background: #F1F5F9;
  color: #1C3048;
  font-size: 10px;
  font-weight: 800;
  letter-spacing: 1px;
  text-transform: uppercase;
  padding: 7px 14px;
  border-radius: 4px 4px 0 0;
  border-left: 4px solid #E97316;
  margin-top: 18px;
}

/* ── Property info grid ── */
.info-grid {
  display: flex;
  border: 1px solid #E2E8F0;
  border-top: none;
  border-radius: 0 0 6px 6px;
  overflow: hidden;
  margin-bottom: 0;
}
.info-cell {
  flex: 1;
  padding: 12px 14px;
  border-right: 1px solid #E2E8F0;
  background: #FAFBFD;
}
.info-cell:last-child { border-right: none; }
.info-cell.accent { border-top: 3px solid #E97316; background: #FFFBF7; }
.info-label { font-size: 8.5px; font-weight: 700; color: #94A3B8; text-transform: uppercase; letter-spacing: 0.6px; margin-bottom: 5px; }
.info-val   { font-size: 11px; color: #1E293B; font-weight: 600; line-height: 1.5; }
.info-val.muted { color: #64748B; font-weight: 400; }

/* ── Horizontal divider ── */
.hdiv {
  height: 1px; background: #E2E8F0; margin: 16px 0;
}

/* ── Scope of works ── */
.scope-wrap {
  border: 1px solid #E2E8F0; border-top: none;
  border-radius: 0 0 6px 6px;
  padding: 10px 14px 14px;
  background: #FAFBFD;
}
.scope-list { list-style: none; }
.scope-list li {
  font-size: 11px; color: #334155;
  padding: 5px 0;
  border-bottom: 1px solid #F1F5F9;
  display: flex; align-items: center; gap: 8px;
}
.scope-list li:last-child { border-bottom: none; }
.scope-num {
  display: inline-flex; align-items: center; justify-content: center;
  width: 20px; height: 20px; border-radius: 50%;
  background: #E97316; color: #fff;
  font-size: 9px; font-weight: 800;
  flex-shrink: 0;
}

/* ── Defect legend ── */
.legend {
  border: 1px solid #E2E8F0; border-top: none;
  border-radius: 0 0 6px 6px;
  overflow: hidden;
}
.legend-row { display: flex; align-items: stretch; }
.legend-row + .legend-row { border-top: 1px solid #E2E8F0; }
.lg-cnt {
  width: 40px; padding: 9px 4px;
  text-align: center; font-weight: 900; font-size: 14px; color: #fff; flex-shrink: 0;
  display: flex; align-items: center; justify-content: center;
}
.lg-ttl {
  width: 176px; padding: 9px 12px;
  font-weight: 700; font-size: 10.5px; color: #fff; flex-shrink: 0;
  display: flex; align-items: center;
}
.lg-desc {
  flex: 1; padding: 9px 14px;
  font-size: 10.5px; background: #FAFBFD; color: #475569;
  display: flex; align-items: center;
  border-left: 1px solid #E2E8F0;
}
.lc-crit { background: #DC2626; }
.lc-maj  { background: #D97706; }
.lc-min  { background: #CA8A04; }
.lc-rec  { background: #0EA5E9; }
.lc-inf  { background: #6366F1; }

/* ── Summary table ── */
.tbl-wrap {
  border: 1px solid #E2E8F0; border-top: none;
  border-radius: 0 0 6px 6px; overflow: hidden;
}
.t-hdr {
  display: flex; padding: 8px 14px;
  background: #F1F5F9;
  border-bottom: 2px solid #D1D9E6;
  font-size: 9.5px; font-weight: 800; color: #475569;
  text-transform: uppercase; letter-spacing: 0.5px;
}
.t-row {
  display: flex; padding: 9px 14px;
  border-bottom: 1px solid #F1F5F9;
  align-items: center; font-size: 11px;
}
.t-row:nth-child(even) { background: #FAFBFD; }
.t-row:last-child { border-bottom: none; }
.c-num  { width: 28px; color: #94A3B8; font-weight: 700; font-size: 10px; }
.c-svc  { flex: 2.2; padding-right: 8px; color: #334155; }
.c-ast  { flex: 1.6; padding-right: 8px; color: #64748B; }
.c-qty  { width: 52px; text-align: center; font-weight: 800; color: #E97316; font-size: 13px; }
.c-no   { width: 28px; color: #64748B; }
.c-desc { flex: 2; padding-right: 8px; color: #334155; }
.c-qsm  { width: 44px; text-align: center; color: #64748B; }
.c-unit { width: 80px; text-align: right; color: #64748B; }
.c-tot  { width: 80px; text-align: right; font-weight: 700; color: #1E293B; }

.grand-row {
  display: flex; justify-content: flex-end; align-items: center; gap: 16px;
  padding: 10px 14px;
  border-top: 2px solid #E2E8F0;
  background: #F7F9FC;
}
.grand-lbl { font-weight: 700; font-size: 11px; color: #1E293B; }
.grand-val { font-weight: 900; font-size: 14px; color: #059669; min-width: 80px; text-align: right; }

/* ── Prepared by strip ── */
.prepby {
  margin-top: 14px; padding: 9px 14px;
  background: #FFF7ED;
  border-left: 3px solid #E97316;
  border-radius: 0 4px 4px 0;
  font-size: 10.5px;
  display: flex; align-items: center; gap: 6px;
}
.prepby-lbl  { color: #94A3B8; font-weight: 600; }
.prepby-name { color: #1C3048; font-weight: 800; }

/* ─── Maintenance / asset log page ─── */
.maint-group-hdr {
  display: flex; align-items: center;
  background: #F8FAFC;
  border-left: 4px solid #E97316;
  border: 1px solid #E2E8F0;
  border-left-width: 4px;
  padding: 8px 14px;
  font-weight: 800; font-size: 11.5px; color: #1C3048;
  margin-top: 16px;
  border-radius: 4px 4px 0 0;
}
.maint-col-hdr {
  display: flex; padding: 6px 14px;
  background: #F1F5F9;
  border-bottom: 1px solid #D1D9E6;
  border-left: 1px solid #E2E8F0;
  border-right: 1px solid #E2E8F0;
  font-size: 9px; font-weight: 700; color: #94A3B8;
  text-transform: uppercase; letter-spacing: 0.5px;
}
.maint-col-l { flex: 1; }
.maint-col-r { width: 100px; text-align: right; }

/* ── Asset row ── */
.a-wrap {
  border-left: 1px solid #E2E8F0;
  border-right: 1px solid #E2E8F0;
  border-bottom: 1px solid #F1F5F9;
}
.a-wrap:last-of-type {
  border-bottom: 1px solid #E2E8F0;
  border-radius: 0 0 4px 4px;
}
.a-row {
  display: flex; padding: 10px 14px;
  align-items: flex-start;
}
.a-row.fail-row { background: #FFF8F8; }
.a-left { flex: 1; padding-right: 12px; }
.a-right { width: 110px; display: flex; flex-direction: column; align-items: flex-end; gap: 6px; }
.a-ref  { font-weight: 700; font-size: 11.5px; color: #1C3048; }
.a-loc  { display: inline; font-size: 10px; color: #94A3B8; margin-left: 8px; font-weight: 400; }
.a-notes { font-size: 10px; color: #64748B; margin-top: 3px; }

/* ── Status pills ── */
.pill {
  display: inline-block; padding: 3px 12px;
  border-radius: 20px; font-size: 9.5px; font-weight: 800;
  letter-spacing: 0.8px; text-transform: uppercase;
  text-align: center; min-width: 52px;
}
.pass { background: #D1FAE5; color: #065F46; border: 1px solid #6EE7B7; }
.fail { background: #FEE2E2; color: #991B1B; border: 1px solid #FCA5A5; }
.nt   { background: #F1F5F9; color: #64748B; border: 1px solid #CBD5E1; }

/* ── Thumb photos (pass rows) ── */
.thumb-grid { display: flex; gap: 5px; flex-wrap: wrap; margin-top: 5px; }
.photo-thumb {
  width: 72px; height: 72px;
  object-fit: cover;
  border: 1.5px solid #E2E8F0;
  border-radius: 5px;
  background: #F8FAFC;
  display: block;
}
.photo-thumb[src=""] { display: none; }

/* ── Defect box ── */
.db {
  margin: 0 14px 12px 14px;
  border: 1.5px solid #D97706;
  border-top: 3px solid #D97706;
  background: #FFFCF5;
  border-radius: 0 0 6px 6px;
  overflow: hidden;
}
.db.crit { border-color: #DC2626; background: #FFFAFA; }
.db.min  { border-color: #CA8A04; background: #FEFCE8; }

.db-hdr {
  display: flex; justify-content: space-between; align-items: flex-start;
  padding: 10px 12px 9px;
  border-bottom: 1px solid #F3EAD6;
  background: rgba(0,0,0,0.02);
}
.db.crit .db-hdr { border-bottom-color: #FEE2E2; }
.db.min  .db-hdr { border-bottom-color: #FEF9C3; }

.db-type {
  font-weight: 800; font-size: 10px; color: #D97706;
  text-transform: uppercase; letter-spacing: 0.5px;
}
.db.crit .db-type { color: #DC2626; }
.db.min  .db-type { color: #B45309; }

.db-id    { font-size: 9.5px; color: #94A3B8; margin-top: 3px; font-family: monospace; }
.db-dates { font-size: 9px; color: #94A3B8; text-align: right; line-height: 1.7; flex-shrink: 0; margin-left: 12px; }

.db-body  { padding: 10px 12px; }
.db-field { margin-bottom: 8px; font-size: 11px; line-height: 1.6; }
.db-field:last-child { margin-bottom: 0; }
.db-field-lbl { font-weight: 700; color: #1C3048; font-size: 10px; text-transform: uppercase; letter-spacing: 0.3px; margin-bottom: 2px; }
.db-field-val { color: #475569; }

.actioned {
  display: inline-flex; align-items: center; gap: 4px;
  background: #059669; color: #fff;
  font-weight: 800; font-size: 9px; padding: 2px 8px;
  border-radius: 20px; letter-spacing: 0.5px; text-transform: uppercase;
}

/* ── Defect photos grid ── */
.defect-photo-grid {
  display: flex; flex-wrap: wrap; gap: 8px;
  padding: 10px 12px;
  border-top: 1px solid #F3EAD6;
  background: rgba(0,0,0,0.015);
}
.db.crit .defect-photo-grid { border-top-color: #FEE2E2; }
.db.min  .defect-photo-grid { border-top-color: #FEF9C3; }
.photo-wrap { display: flex; flex-direction: column; align-items: center; }
.photo-defect {
  width: 220px; height: 165px;
  object-fit: cover;
  border: 1.5px solid #E2E8F0;
  border-radius: 6px;
  background: #F8FAFC;
  display: block;
}
.photo-defect[src=""] { display: none; }
.photo-cap { font-size: 8px; color: #94A3B8; margin-top: 3px; text-align: center; }

/* ── Signature block ── */
.sig-section {
  margin-top: 22px;
  border: 1px solid #E2E8F0;
  border-radius: 6px; overflow: hidden;
}
.sig-section-hdr {
  background: #F1F5F9; padding: 8px 14px;
  font-size: 9.5px; font-weight: 800; color: #475569;
  text-transform: uppercase; letter-spacing: 0.8px;
  border-bottom: 1px solid #E2E8F0;
}
.sig-grid { display: flex; }
.sig-block {
  flex: 1; padding: 14px 16px;
  border-right: 1px solid #E2E8F0;
}
.sig-block:last-child { border-right: none; }
.sig-pad {
  border-bottom: 2px solid #CBD5E1;
  min-height: 64px;
  display: flex; align-items: flex-end;
  padding-bottom: 6px; margin-bottom: 8px;
  background: #ffffff;
}
.sig-typed { font-family: Times New Roman, serif; font-size: 22px; font-style: italic; color: #1C3048; }
.sig-img   { max-width: 100%; max-height: 64px; object-fit: contain; background: #ffffff; }
.sig-empty { font-size: 10.5px; color: #CBD5E1; }
.sig-lbl   { font-size: 8.5px; color: #94A3B8; text-transform: uppercase; letter-spacing: 0.7px; font-weight: 700; }

/* ── Quote page ── */
.quote-subtotal {
  display: flex; justify-content: flex-end; padding: 8px 14px;
  border-top: 1px solid #E2E8F0; background: #F7F9FC;
  font-size: 10.5px; color: #475569; gap: 16px;
}
.quote-gst  { font-weight: 600; }
.quote-gst-val { width: 80px; text-align: right; }
`;

// ─── Logo wordmark ─────────────────────────────────────────────────────────────

function logoHtml(reportNum: string, reportLabel = 'Service Report'): string {
  return `
  <div class="brand-bar">
    <div class="brand-logo">
      <div class="brand-diamond"><div class="brand-diamond-inner"><span class="brand-init">ST</span></div></div>
      <div class="brand-text">
        <div class="brand-name"><span>S</span>ITE<span>T</span>RACK</div>
        <div class="brand-sub">Services</div>
      </div>
    </div>
    <div class="brand-meta">
      <div class="brand-reportnum">${reportLabel} ${reportNum}</div>
      <div class="brand-reportlbl">Official Service Document</div>
    </div>
  </div>`;
}

// ─── Per-page footer (embedded inside each .page div) ───────────────────────────
// We pass pageNum (1-based) and totalPages (known at build time) so the numbers
// are always correct — no JS hacks, no CSS counter() tricks needed.

function pageFooterHtml(pageNum: number, totalPages: number): string {
  return `
  <div class="page-footer">
    <div class="pf-left">
      <div>${CompanyConfig.name}</div>
      <div>${CompanyConfig.addressLine1}, ${CompanyConfig.addressLine2} | ABN: ${CompanyConfig.abn}</div>
    </div>
    <div class="pf-mid">Page ${pageNum} of ${totalPages}</div>
    <div class="pf-right">
      <div>www.${CompanyConfig.website}</div>
      <div>Ph: ${CompanyConfig.contactPhone} | ${CompanyConfig.contactEmail}</div>
    </div>
  </div>`;
}

// ─── Page 1 — Cover / Summary ──────────────────────────────────────────────────

function buildPage1(data: ReportData, pageNum: number, totalPages: number): string {
  const { job, assets, defects, techName, reportId } = data;
  const j = job as any;

  const propName    = j.property_name ?? '—';
  const address     = [j.property_address, j.property_suburb, j.property_state, j.property_postcode].filter(Boolean).join(', ');
  const siteContact = j.site_contact_name ?? 'Not provided';
  const perfDate    = fmtDateShort(j.updated_at ?? job.scheduled_date);
  const jobType     = fmtJobType(job.job_type);
  const refNum      = shortId(job.id, 6);

  const cntCrit = defects.filter(d => d.severity === 'critical').length;
  const cntMaj  = defects.filter(d => d.severity === 'major').length;
  const cntMin  = defects.filter(d => d.severity === 'minor').length;

  // Group assets by type
  type G = { svc: string; ast: string; cnt: number };
  const map = assets.reduce((acc: Record<string, G>, a) => {
    const k = a.asset_type ?? 'General Asset';
    if (!acc[k]) acc[k] = { svc: `Annual Inspection – ${formatAssetType(k)}`, ast: formatAssetType(k), cnt: 0 };
    acc[k].cnt++;
    return acc;
  }, {} as Record<string, G>);
  const groups = Object.values(map);

  const scopeItems = groups.length === 0
    ? '<li><span class="scope-num">—</span>No assets recorded for this job.</li>'
    : groups.map((g, i) => `<li><span class="scope-num">${String(i + 1).padStart(2, '0')}</span>${g.svc} (${g.cnt})</li>`).join('');

  const summaryRows = groups.length === 0
    ? '<div style="padding:14px;color:#94A3B8;font-size:11px">No assets recorded</div>'
    : groups.map((g, i) => `
        <div class="t-row">
          <div class="c-num">${String(i + 1).padStart(2, '0')}</div>
          <div class="c-svc">${g.svc}</div>
          <div class="c-ast">${g.ast}</div>
          <div class="c-qty">${g.cnt}</div>
        </div>`).join('');

  return `
  <div class="page">
    ${logoHtml(`R-${shortId(reportId, 5)}`)}

    <div class="sec-bar first">Site / Property Information</div>
    <div class="info-grid">
      <div class="info-cell">
        <div class="info-label">Site / Property</div>
        <div class="info-val">${propName}</div>
        <div class="info-val muted" style="margin-top:4px;white-space:pre-line">${address || '—'}</div>
      </div>
      <div class="info-cell">
        <div class="info-label">Site Contact</div>
        <div class="info-val">${siteContact}</div>
      </div>
      <div class="info-cell">
        <div class="info-label">Job Type</div>
        <div class="info-val">${jobType}</div>
        <div class="info-label" style="margin-top:9px">Reference No.</div>
        <div class="info-val">${refNum}</div>
      </div>
      <div class="info-cell accent">
        <div class="info-label">Date Completed</div>
        <div class="info-val">${perfDate}</div>
      </div>
    </div>

    <div class="sec-bar">Scope of Works</div>
    <div class="scope-wrap">
      <ul class="scope-list">${scopeItems}</ul>
    </div>

    <div class="sec-bar">Defect Summary</div>
    <div class="legend">
      <div class="legend-row">
        <div class="lg-cnt lc-crit">${cntCrit}</div>
        <div class="lg-ttl lc-crit">Critical Defects</div>
        <div class="lg-desc">A defect that renders a system inoperative.</div>
      </div>
      <div class="legend-row">
        <div class="lg-cnt lc-maj">${cntMaj}</div>
        <div class="lg-ttl lc-maj">Non-critical Defects</div>
        <div class="lg-desc">A system impairment not likely to critically affect the operation.</div>
      </div>
      <div class="legend-row">
        <div class="lg-cnt lc-min">${cntMin}</div>
        <div class="lg-ttl lc-min">Non-conformances</div>
        <div class="lg-desc">Missing information or incorrect feature — does not affect system operation.</div>
      </div>
      <div class="legend-row">
        <div class="lg-cnt lc-rec">0</div>
        <div class="lg-ttl lc-rec">Recommendations</div>
        <div class="lg-desc">A modification suggested to improve system performance.</div>
      </div>
      <div class="legend-row">
        <div class="lg-cnt lc-inf">0</div>
        <div class="lg-ttl lc-inf">Informational Notes</div>
        <div class="lg-desc">Detailed advice or general comment.</div>
      </div>
    </div>

    <div class="sec-bar">Servicing Summary</div>
    <div class="tbl-wrap">
      <div class="t-hdr">
        <div class="c-num">#</div>
        <div class="c-svc">Service</div>
        <div class="c-ast">Asset Type</div>
        <div class="c-qty">Qty</div>
      </div>
      ${summaryRows}
    </div>

    <div class="prepby">
      <span class="prepby-lbl">Report prepared by:</span>
      <span class="prepby-name">${techName}</span>
    </div>
    ${pageFooterHtml(pageNum, totalPages)}
  </div>`;
}

// ─── Photo helpers ─────────────────────────────────────────────────────────────

function thumbHtml(photo: InspectionPhoto): string {
  if (!isSafe(photo.photo_url)) return '';
  // onerror hides broken images rather than showing a broken icon
  return `<img src="${photo.photo_url}" class="photo-thumb" alt="" onerror="this.style.display='none'"/>`;
}

function defectPhotoHtml(url: string, cap = 'Photo'): string {
  if (!isSafe(url)) return '';
  return `
  <div class="photo-wrap nb">
    <img src="${url}" class="photo-defect" alt="${cap}" onerror="this.style.display='none'"/>
    <div class="photo-cap">${cap}</div>
  </div>`;
}

// ─── Defect box ────────────────────────────────────────────────────────────────

function buildDefectBox(
  asset: AssetWithResult,
  defect: Defect | undefined,
  defectPhotos: InspectionPhoto[],
  assetPhoto: InspectionPhoto | undefined,
): string {
  const inspHtml = assetPhoto && isSafe(assetPhoto.photo_url)
    ? defectPhotoHtml(assetPhoto.photo_url, assetPhoto.caption || 'Inspection photo')
    : '';

  if (defect) {
    const isCrit = defect.severity === 'critical';
    const isMin  = defect.severity === 'minor';
    const cls    = isCrit ? 'crit' : isMin ? 'min' : '';
    const label  = isCrit ? 'Critical Defect' : isMin ? 'Non-conformance' : 'Non-critical Defect';
    const date   = fmtDateTimeFull(defect.created_at);

    let rawUrls: string[] = [];
    if (Array.isArray(defect.photos)) rawUrls = defect.photos as string[];
    else if (typeof defect.photos === 'string' && (defect.photos as string).length > 0) {
      try { rawUrls = JSON.parse(defect.photos as unknown as string); } catch {}
    }

    // Collect all defect photos — deduplicate by url
    const seen = new Set<string>();
    const allPhotoHtmlParts: string[] = [];

    if (inspHtml && assetPhoto?.photo_url) {
      seen.add(assetPhoto.photo_url);
      allPhotoHtmlParts.push(inspHtml);
    }
    for (const p of defectPhotos) {
      if (isSafe(p.photo_url) && !seen.has(p.photo_url)) {
        seen.add(p.photo_url);
        allPhotoHtmlParts.push(defectPhotoHtml(p.photo_url, p.caption || 'Photo'));
      }
    }
    for (let i = 0; i < rawUrls.length; i++) {
      const u = rawUrls[i];
      if (isSafe(u) && !seen.has(u)) {
        seen.add(u);
        allPhotoHtmlParts.push(defectPhotoHtml(u, `Defect photo ${i + 1}`));
      }
    }

    const photosHtml = allPhotoHtmlParts.length
      ? `<div class="defect-photo-grid">${allPhotoHtmlParts.join('')}</div>`
      : '';

    const resolution = asset.defect_reason || asset.technician_notes || 'Requires further action.';

    return `
    <div class="db ${cls} nb">
      <div class="db-hdr nb">
        <div>
          <div class="db-type">${label}</div>
          <div class="db-id">ID: ${shortId(defect.id, 4)} &#x1F517;</div>
        </div>
        <div class="db-dates">Added: ${date}<br/>Last Verified: ${date}</div>
      </div>
      <div class="db-body">
        <div class="db-field">
          <div class="db-field-lbl">Description</div>
          <div class="db-field-val">${defect.description || 'Defect observed during inspection.'}</div>
        </div>
        <div class="db-field">
          <div class="db-field-lbl">Resolution</div>
          <div class="db-field-val">${resolution}</div>
        </div>
        <div class="db-field">
          <div class="db-field-lbl">Quote</div>
          <span class="actioned">&#10003; Actioned</span>
        </div>
      </div>
      ${photosHtml}
    </div>`;
  }

  // Fallback — no linked Defect record
  const fb = fmtDateTimeFull(asset.actioned_at ?? new Date().toISOString());
  const fallbackPhotos = inspHtml
    ? `<div class="defect-photo-grid">${inspHtml}</div>` : '';

  return `
  <div class="db nb">
    <div class="db-hdr nb">
      <div>
        <div class="db-type">Non-critical Defect</div>
        <div class="db-id">ID: ${shortId(asset.id, 4)}</div>
      </div>
      <div class="db-dates">Added: ${fb}</div>
    </div>
    <div class="db-body">
      <div class="db-field">
        <div class="db-field-lbl">Description</div>
        <div class="db-field-val">${asset.defect_reason || 'Failed testing parameters.'}</div>
      </div>
      <div class="db-field">
        <div class="db-field-lbl">Resolution</div>
        <div class="db-field-val">Pending formal quote.</div>
      </div>
    </div>
    ${fallbackPhotos}
  </div>`;
}

// ─── Asset row ─────────────────────────────────────────────────────────────────

function buildAssetRow(
  asset: AssetWithResult,
  index: number,
  defects: Defect[],
  photos: InspectionPhoto[],
): string {
  const isPass = asset.result === 'pass';
  const isFail = asset.result === 'fail';
  const pillCls = isPass ? 'pass' : isFail ? 'fail' : 'nt';
  const pillLbl = isPass ? 'PASS' : isFail ? 'FAIL' : 'N/T';

  const ref     = assetRefCode(asset, index);
  const typeLbl = formatAssetType(asset.asset_type);
  const loc     = asset.location_on_site ?? '';
  const notes   = asset.inspection_notes || asset.technician_notes;

  const linkedDefect = defects.find(d => d.asset_id === asset.id);
  const assetPhotos  = photos.filter(p => p.asset_id === asset.id && !p.defect_id);
  const defectPhotos = linkedDefect ? photos.filter(p => p.defect_id === linkedDefect.id) : [];

  // Pass rows: show up to 3 small thumbnails
  const thumbsHtml = isPass && assetPhotos.length > 0
    ? `<div class="thumb-grid">${assetPhotos.slice(0, 3).map(p => thumbHtml(p)).join('')}</div>`
    : '';

  const defectHtml = isFail
    ? buildDefectBox(asset, linkedDefect, defectPhotos, assetPhotos[0])
    : '';

  return `
  <div class="a-wrap">
    <div class="a-row ${isFail ? 'fail-row' : ''} nb">
      <div class="a-left">
        <span class="a-ref">${ref} - ${typeLbl}</span>${loc ? `<span class="a-loc">${loc}</span>` : ''}
        ${notes ? `<div class="a-notes">${notes}</div>` : ''}
      </div>
      <div class="a-right">
        <span class="pill ${pillCls}">${pillLbl}</span>
        ${thumbsHtml}
      </div>
    </div>
    ${defectHtml}
  </div>`;
}

// ─── Maintenance page ──────────────────────────────────────────────────────────

function buildMaintPage(data: ReportData, pageNum: number, totalPages: number): string {
  const { assets, defects, photos, signature, techName, reportId } = data;

  const sigHtml = buildSig(signature, techName);

  if (assets.length === 0) {
    return `
    <div class="page">
      ${logoHtml(`R-${shortId(reportId, 5)}`)}
      <div class="sec-bar first">Asset Maintenance Log</div>
      <div style="padding:18px 14px;color:#94A3B8;font-size:11px;border:1px solid #E2E8F0;border-top:none;border-radius:0 0 6px 6px">
        No maintenance records for this job.
      </div>
      ${sigHtml}
      ${pageFooterHtml(pageNum, totalPages)}
    </div>`;
  }

  // Group assets by type
  const groupMap = new Map<string, AssetWithResult[]>();
  for (const a of assets) {
    const lbl = formatAssetType(a.asset_type ?? 'General Asset');
    if (!groupMap.has(lbl)) groupMap.set(lbl, []);
    groupMap.get(lbl)!.push(a);
  }

  let gi = 0;
  let body = '';
  for (const [name, ga] of groupMap) {
    const rows = ga.map(a => buildAssetRow(a, gi++, defects, photos)).join('');
    body += `
    <div class="maint-group-hdr nb">${name}</div>
    <div class="maint-col-hdr">
      <div class="maint-col-l">Asset</div>
      <div class="maint-col-r">Status</div>
    </div>
    ${rows}`;
  }

  return `
  <div class="page">
    ${logoHtml(`R-${shortId(reportId, 5)}`)}
    <div class="sec-bar first">Asset Maintenance Log</div>
    ${body}
    ${sigHtml}
    ${pageFooterHtml(pageNum, totalPages)}
  </div>`;
}

function buildSig(signature: Signature | null, techName: string): string {
  const clientSigHtml = signature?.signature_url && isSafe(signature.signature_url)
    ? `<img src="${signature.signature_url}" class="sig-img" alt="Client Signature" onerror="this.style.display='none'"/>`
    : `<span class="sig-empty">${signature?.signed_by_name ? 'Signature not captured' : 'Not captured'}</span>`;

  const signerName = signature?.signed_by_name ?? '';

  return `
  <div class="sig-section nb">
    <div class="sig-section-hdr">Signatures</div>
    <div class="sig-grid">
      <div class="sig-block">
        <div class="sig-pad"><span class="sig-typed">${techName}</span></div>
        <div class="sig-lbl">Inspector Signature</div>
      </div>
      <div class="sig-block">
        <div class="sig-pad">${clientSigHtml}</div>
        <div class="sig-lbl">Authorised Signatory${signerName ? ` — ${signerName}` : ''}</div>
      </div>
    </div>
  </div>`;
}

// ─── Quote page ────────────────────────────────────────────────────────────────

function buildQuotePage(
  quote: Quote,
  items: QuoteItem[],
  inventory: InventoryItem[],
  reportId: string,
  pageNum: number,
  totalPages: number,
): string {
  if (!items.length) return '';

  const rows = items.map((qi, i) => {
    const name  = inventory.find(inv => inv.id === qi.inventory_item_id)?.name ?? 'Service Item';
    const unit  = parseFloat(String(qi.unit_price));
    const total = qi.quantity * unit;
    return `
    <div class="t-row">
      <div class="c-num">${i + 1}</div>
      <div class="c-desc">${name}</div>
      <div class="c-qsm">${qi.quantity}</div>
      <div class="c-unit">${fmtCurrency(unit)}</div>
      <div class="c-tot">${fmtCurrency(total)}</div>
    </div>`;
  }).join('');

  const total    = parseFloat(String(quote.total_amount)) || 0;
  const gst      = total / 11;
  const exGst    = total - gst;

  return `
  <div class="page">
    ${logoHtml(`Q-${shortId(quote.id, 5)}`, 'Estimate & Quote')}
    <div class="sec-bar first">Approved Estimate</div>
    <div class="tbl-wrap">
      <div class="t-hdr">
        <div class="c-num">#</div>
        <div class="c-desc">Service / Item Details</div>
        <div class="c-qsm">Qty</div>
        <div class="c-unit">Unit Price</div>
        <div class="c-tot">Total</div>
      </div>
      ${rows}
      <div class="quote-subtotal">
        <span class="quote-gst">Subtotal (ex. GST)</span>
        <span class="quote-gst-val">${fmtCurrency(exGst)}</span>
      </div>
      <div class="quote-subtotal">
        <span class="quote-gst">GST (10%)</span>
        <span class="quote-gst-val">${fmtCurrency(gst)}</span>
      </div>
      <div class="grand-row">
        <div class="grand-lbl">Total Approved Estimate (inc. GST):</div>
        <div class="grand-val">${fmtCurrency(total)}</div>
      </div>
    </div>
    ${pageFooterHtml(pageNum, totalPages)}
  </div>`;
}

// ─── Main export ───────────────────────────────────────────────────────────────

export function buildReportHtml(data: ReportData): string {
  const { approvedQuote, quoteItems, inventory, reportId, job } = data;
  const j            = job as any;
  const propertyName = j.property_name ?? reportId;

  const hasQuote = Boolean(approvedQuote && quoteItems?.length && inventory);
  const totalPages = hasQuote ? 3 : 2;

  const page1   = buildPage1(data, 1, totalPages);
  const maintPg = buildMaintPage(data, 2, totalPages);
  const quotePg = hasQuote
    ? buildQuotePage(approvedQuote!, quoteItems!, inventory!, reportId, 3, totalPages)
    : '';

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8"/>
  <meta name="viewport" content="width=device-width,initial-scale=1"/>
  <title>Service Report — ${propertyName}</title>
  <style>${CSS}</style>
</head>
<body>
  ${page1}
  ${maintPg}
  ${quotePg}
</body>
</html>`;
}
