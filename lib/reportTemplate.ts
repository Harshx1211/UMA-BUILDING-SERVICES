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
 *   - Photos that failed to encode (FALLBACK_IMG) render as a labelled
 *     "Photo unavailable" placeholder rather than an invisible blank box —
 *     see isRealPhoto() below.
 */

import {
  Defect,
  InspectionPhoto,
  InventoryItem,
  JoinedJob,
  Quote,
  QuoteItem,
  Signature,
  TechUser,
  TimeLog,
} from "@/types";
import { formatAssetType } from "@/utils/assetHelpers";
// FIX: shared constant so we can tell an actually-failed photo apart from a
// real one. Previously FALLBACK_IMG was only defined in pdfGenerator.ts, so
// isSafe() here treated it as "safe" and rendered it as an invisible 1x1
// transparent image — leaving a blank bordered box with no explanation.
import { FALLBACK_IMG } from "./pdfConstants";
import { sanitizeForHtml, MAX_LENGTHS } from "@/utils/sanitize";

// ─── Types ─────────────────────────────────────────────────────────────────────

export interface AssetWithResult {
  id: string;
  property_id: string;
  asset_type: string;
  /** Short technician reference number for this asset at the site (e.g. '001', '040') */
  asset_ref: string | null;
  variant: string | null;
  description: string | null;
  location_on_site: string | null;
  serial_number: string | null;
  barcode_id: string | null;
  install_date: string | null;
  last_service_date: string | null;
  next_service_date: string | null;
  status: string;
  created_at: string;
  result: "pass" | "fail" | "not_tested" | null;
  defect_reason: string | null;
  technician_notes: string | null;
  inspection_notes: string | null;
  actioned_at: string | null;
}

export interface ReportData {
  job: JoinedJob;
  assets: AssetWithResult[];
  defects: Defect[];
  signature: Signature | null;
  photos: InspectionPhoto[];
  timeLogs: TimeLog[];
  techName: string;
  /** Full technician User record — used for FPAS/licence fields on the cover page (AS1851) */
  tech?: TechUser;
  reportId: string;
  approvedQuote?: Quote;
  quoteItems?: QuoteItem[];
  inventory?: InventoryItem[];
  company: Record<string, string | null | undefined>;
}

// ─── Helpers ───────────────────────────────────────────────────────────────────

function fmtDateShort(iso: string | null | undefined): string {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleDateString("en-AU", {
      day: "numeric",
      month: "short",
      year: "numeric",
    });
  } catch {
    return iso;
  }
}

function fmtDateTimeFull(iso: string | null | undefined): string {
  if (!iso) return "—";
  try {
    const d = new Date(iso);
    const day = d.getDate();
    const sfx = [11, 12, 13].includes(day % 100)
      ? "th"
      : day % 10 === 1
        ? "st"
        : day % 10 === 2
          ? "nd"
          : day % 10 === 3
            ? "rd"
            : "th";
    const month = d.toLocaleDateString("en-AU", { month: "long" });
    const year = d.getFullYear();
    let h = d.getHours();
    const m = String(d.getMinutes()).padStart(2, "0");
    const ap = h >= 12 ? "PM" : "AM";
    h = h % 12 || 12;
    return `${day}${sfx} ${month} ${year} ${h}:${m}${ap}`;
  } catch {
    return iso;
  }
}

function fmtTimeOnly(iso: string | null | undefined): string {
  if (!iso) return "—";
  try {
    const d = new Date(iso);
    let h = d.getHours();
    const m = String(d.getMinutes()).padStart(2, "0");
    const ap = h >= 12 ? "PM" : "AM";
    h = h % 12 || 12;
    return `${h}:${m} ${ap}`;
  } catch {
    return iso;
  }
}

function shortId(id: string, len = 5): string {
  return id.replace(/-/g, "").substring(0, len).toUpperCase();
}

function fmtCurrency(v: number | string): string {
  const n = parseFloat(String(v));
  return isNaN(n) ? "$0.00" : `$${n.toFixed(2)}`;
}

function fmtJobType(raw: string | null | undefined): string {
  if (!raw) return "Service";
  return raw.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

/**
 * Strict filter to prevent broken images in PDF.
 * Expo Print sandboxing is highly unreliable with network images, so we strictly
 * enforce that only base64 data: URIs are injected into the HTML.
 */
function isSafe(src: string | null | undefined): src is string {
  if (!src) return false;
  return src.startsWith("data:");
}

/**
 * FIX: True only for a genuine, successfully-encoded photo — i.e. a data: URI
 * that ISN'T the shared FALLBACK_IMG sentinel. Use this (instead of isSafe)
 * anywhere you're about to render an <img> the reader expects to actually see
 * a photo in. Failed photos are handled separately via placeholderHtml().
 *
 * Special case: a data: URI that is NOT FALLBACK_IMG is always real — even
 * if it wasn't re-encoded through ImageManipulator (e.g. canvas signatures that
 * are embedded directly to avoid the re-encode failure path).
 */
function isRealPhoto(src: string | null | undefined): src is string {
  return isSafe(src) && src !== FALLBACK_IMG;
}

function assetRefCode(asset: AssetWithResult, index: number): string {
  // 1. Use the dedicated asset_ref field first (e.g. '001', '040')
  if (asset.asset_ref) return asset.asset_ref.trim();
  // 2. Derive from serial number digits as a fallback
  if (asset.serial_number) {
    const clean = asset.serial_number.replace(/\D/g, "");
    if (clean.length >= 3) return clean.slice(0, 3);
  }
  // 3. Sequential index as last resort
  return String(index + 1).padStart(3, "0");
}

// ─── CSS ───────────────────────────────────────────────────────────────────────

const CSS = `
@page { margin: 0; size: A4 }
/* Explicit reset for html AND body prevents WKWebView injecting a blank page
   before the first .page div due to default user-agent margins. */
html { margin: 0; padding: 0; width: 794px; }
body {
  margin: 0; padding: 0; width: 794px;
  font-family: 'Inter', Helvetica Neue, Helvetica, Arial, sans-serif;
  color: #1E293B;
  line-height: 1.5;
  font-size: 11px;
  background: #fff;
}
*, *::before, *::after { box-sizing: border-box; }
p, h1, h2, h3, h4, h5, h6 { margin: 0; padding: 0; }
.nb { page-break-inside: avoid; break-inside: avoid; }

.section {
  padding: 28px 32px 70px 32px;
  page-break-before: always;
  break-before: page;
  box-sizing: border-box;
}
.section.first { page-break-before: auto; break-before: auto; }
/* FIX: sections after the cover page no longer force a brand-new page when
   there is still usable space left on the current page. Forcing a break
   here was leaving large (sometimes half-page) blank gaps whenever the
   previous section ended partway down a page — see .flow below. */
.section.flow { page-break-before: auto; break-before: auto; }


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
  page-break-after: avoid;
  break-after: avoid;
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
  /* Never orphan this strip alone at the top of a new page */
  page-break-before: avoid;
  break-before: avoid;
  page-break-inside: avoid;
  break-inside: avoid;
}
.prepby-lbl  { color: #94A3B8; font-weight: 600; }
.prepby-name { color: #1C3048; font-weight: 800; }

/* ─── Maintenance / asset log page ─── */
/* FIX: group header + column header are now wrapped together (see
   .maint-group-head below) so they can never end up as an orphaned pair
   sitting alone at the bottom of a page with their rows pushed to the
   next page — that was one of the causes of the big blank gaps. */
.maint-group-head {
  page-break-inside: avoid;
  break-inside: avoid;
}
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
  border-left: 3px solid #E2E8F0;
  border-right: 1px solid #E2E8F0;
  border-bottom: 1px solid #F1F5F9;
}
.a-wrap:last-of-type {
  border-bottom: 1px solid #E2E8F0;
  border-radius: 0 0 4px 4px;
}
.a-row {
  display: flex; padding: 11px 14px;
  align-items: flex-start;
  background: #FAFBFF;
}
/* PASS rows — clean white, left accent only (matches industry standard) */
.a-row.pass-row {
  background: #FFFFFF;
}
/* FAIL rows — very subtle red tint */
.a-row.fail-row {
  background: #FFF8F8;
  border-left-color: #FCA5A5;
}
.a-left { flex: 1; padding-right: 12px; }
.a-right { width: 110px; display: flex; flex-direction: column; align-items: flex-end; gap: 6px; }
.a-ref  { font-weight: 700; font-size: 11.5px; color: #1C3048; }
.a-loc  { display: inline; font-size: 10px; color: #64748B; margin-left: 8px; font-weight: 500;
          background:#F1F5F9; padding: 1px 6px; border-radius: 3px; }
.a-notes { font-size: 10px; color: #64748B; margin-top: 3px; font-style: italic; }

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
/* FIX: no page-break-inside:avoid on the outer .db box itself anymore.
   These boxes can be very tall once they carry 2-3 full-size photos, and
   forcing the ENTIRE box to move as one atomic unit meant that whenever it
   didn't quite fit in the remaining space on a page, the whole thing
   (header, description, all photos) jumped to the next page — leaving
   everything left on the current page blank. Instead we only keep the
   small, always-short pieces (header, each text field) glued together via
   .db-hdr / .db-field / .photo-wrap (all still avoid-break below), and let
   the box split cleanly between those pieces when it has to.
*/
/*
   Defect box — LEFT BORDER ONLY style (industry standard, matches AS1851 platforms).
   Full-box borders were too heavy; a left accent + subtle background is cleaner.
*/
.db {
  margin: 0 14px 14px 14px;
  border-left: 4px solid #D97706;
  background: #FFFCF5;
  border-radius: 0 4px 4px 0;
  overflow: hidden;
}
.db.crit { border-left-color: #DC2626; background: #FFFAFA; }
.db.min  { border-left-color: #CA8A04; background: #FEFCE8; }

.db-hdr {
  display: flex; justify-content: space-between; align-items: flex-start;
  padding: 9px 12px 8px;
  border-bottom: 1px solid rgba(0,0,0,0.06);
}
.db.crit .db-hdr { border-bottom-color: rgba(220,38,38,0.12); }
.db.min  .db-hdr { border-bottom-color: rgba(202,138,4,0.12); }

.db-type {
  font-weight: 800; font-size: 10px; color: #D97706;
  text-transform: uppercase; letter-spacing: 0.5px;
}
.db.crit .db-type { color: #DC2626; }
.db.min  .db-type { color: #B45309; }

.db-id    { font-size: 9px; color: #94A3B8; margin-top: 2px; }
/* Both date lines shown right-aligned, matching industry format */
.db-dates { font-size: 9px; color: #94A3B8; text-align: right; line-height: 1.8; flex-shrink: 0; margin-left: 12px; }

.db-body  { padding: 10px 12px; }
.db-field {
  margin-bottom: 7px; font-size: 11px; line-height: 1.6;
  page-break-inside: avoid;
  break-inside: avoid;
}
.db-field:last-child { margin-bottom: 0; }
/* Sentence-case inline labels: "Description:", "Resolution:", "Quote:" */
.db-field-lbl { font-weight: 700; color: #1C3048; font-size: 11px; }
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

/* ── Failed-to-load photo placeholder (FIX: was previously invisible) ── */
.photo-unavailable {
  display: flex; align-items: center; justify-content: center;
  background: repeating-linear-gradient(45deg, #F1F5F9, #F1F5F9 6px, #E7ECF2 6px, #E7ECF2 12px);
  border: 1.5px dashed #CBD5E1;
  color: #94A3B8;
  font-size: 9px;
  font-weight: 700;
  text-align: center;
  text-transform: uppercase;
  letter-spacing: 0.4px;
  padding: 6px;
}

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
  border: 1.5px solid #CBD5E1;
  border-radius: 4px;
  min-height: 70px;
  display: flex; align-items: center; justify-content: center;
  padding: 6px 8px; margin-bottom: 8px;
  background: #F0F4F8;
}
.sig-typed { font-family: 'Brush Script MT', 'Dancing Script', 'Cedarville Cursive', cursive; font-size: 26px; font-style: italic; color: #1C3048; padding-bottom: 4px; }
.sig-img   { max-width: 100%; max-height: 70px; object-fit: contain; display: block; }
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

function logoHtml(
  reportNum: string,
  company: Record<string, string | null | undefined>,
  reportLabel = "Service Report",
): string {
  const name = company?.name || "Company Name";
  return `
  <div class="brand-bar" style="border-bottom: 2px solid #E2E8F0; padding-bottom: 16px;">
    <div class="brand-logo">
      <div style="width: 4px; height: 32px; background: #E97316; margin-right: 12px; border-radius: 2px;"></div>
      <div class="brand-text">
        <div class="brand-name" style="font-size: 15px;">${name}</div>
        <div class="brand-sub" style="font-size: 8px;">Facility Management & Maintenance</div>
      </div>
    </div>
    <div class="brand-meta">
      <div class="brand-reportnum" style="font-size: 14px; color: #1C3048;">
        <span style="color: #94A3B8; font-weight: 600;">${reportLabel}</span> ${reportNum}
      </div>
      <div class="brand-reportlbl">Official Service Document</div>
    </div>
  </div>`;
}

/** Compact running header for pages 2+ (maintenance / quote sections).
 *  Shows company name + report ref top-right only — no full brand bar repeat.
 */
function compactHeaderHtml(reportNum: string, company: Record<string, string | null | undefined>): string {
  const name = company?.name || 'Company Name';
  return `
  <div style="display:flex;justify-content:flex-end;align-items:center;padding-bottom:10px;border-bottom:1px solid #E2E8F0;margin-bottom:16px">
    <div style="text-align:right">
      <div style="font-size:11px;font-weight:800;color:#1C3048">${name}</div>
      <div style="font-size:9px;color:#94A3B8;font-weight:600">Service Report ${reportNum} &middot; Official Service Document</div>
    </div>
  </div>`;
}

// ─── Page 1 — Cover / Summary ──────────────────────────────────────────────────

function buildPage1(data: ReportData): string {
  const { job, assets, defects, techName, reportId, tech } = data;

  const propName    = sanitizeForHtml(job.property_name ?? '—', MAX_LENGTHS.name);
  const address     = sanitizeForHtml(
    [job.property_address, job.property_suburb, job.property_state, job.property_postcode]
      .filter(Boolean).join(', '),
    MAX_LENGTHS.address,
  );
  const siteContact = sanitizeForHtml(job.site_contact_name ?? 'Not provided', MAX_LENGTHS.name);
  const siteNote = job.site_note ?? null;
  // Date of Service: updated_at is set when the job status changes to 'completed'.
  // This is the most accurate proxy for the actual service date since there's no
  // dedicated completed_at column. Falls back to scheduled_date for draft previews.
  const perfDate = fmtDateShort(job.updated_at ?? job.scheduled_date);
  const jobType = fmtJobType(job.job_type);
  const refNum = shortId(job.id, 6);

  // FPAS / licence fields for AS1851 cover page — sanitized for HTML injection
  const fpasNum   = sanitizeForHtml(tech?.fpas_number  ?? '—', MAX_LENGTHS.reference);
  const fpasClass = sanitizeForHtml(tech?.fpas_class   ?? '—', MAX_LENGTHS.shortText);
  const stateLic  = sanitizeForHtml(tech?.state_license ?? '—', MAX_LENGTHS.reference);
  // techName comes from users.full_name (trusted internal data, but sanitize for HTML)
  const safeTechName = sanitizeForHtml(techName, MAX_LENGTHS.name);

  let timeStr = "";
  if (data.timeLogs && data.timeLogs.length > 0) {
    const sortedLogs = [...data.timeLogs].sort(
      (a, b) => new Date(a.clock_in).getTime() - new Date(b.clock_in).getTime(),
    );
    const firstIn = sortedLogs[0].clock_in;

    let lastOut: string | null = null;
    for (const log of sortedLogs) {
      if (!log.clock_out) {
        lastOut = null;
        break;
      }
      if (!lastOut || new Date(log.clock_out) > new Date(lastOut))
        lastOut = log.clock_out;
    }

    const startStr = fmtTimeOnly(firstIn);
    const endStr = lastOut ? fmtTimeOnly(lastOut) : "Active";
    timeStr = `
        <div class="info-label" style="margin-top:9px">Time on Site</div>
        <div class="info-val" style="font-size:10px">${startStr} &rarr; ${endStr}</div>
    `;
  }

  const cntCrit = defects.filter((d) => d.severity === "critical").length;
  const cntMaj = defects.filter((d) => d.severity === "major").length;
  const cntMin = defects.filter((d) => d.severity === "minor").length;

  // Group assets by type
  type G = { svc: string; ast: string; cnt: number };
  const map = assets.reduce(
    (acc: Record<string, G>, a) => {
      const k = a.asset_type ?? "General Asset";
      if (!acc[k])
        acc[k] = {
          svc: `Annual Inspection – ${formatAssetType(k)}`,
          ast: formatAssetType(k),
          cnt: 0,
        };
      acc[k].cnt++;
      return acc;
    },
    {} as Record<string, G>,
  );
  const groups = Object.values(map);

  const scopeItems =
    groups.length === 0
      ? '<li><span class="scope-num">—</span>No assets recorded for this job.</li>'
      : groups
          .map(
            (g, i) =>
              `<li><span class="scope-num">${String(i + 1).padStart(2, "0")}</span>${g.svc} (${g.cnt})</li>`,
          )
          .join("");

  const summaryRows =
    groups.length === 0
      ? '<div style="padding:14px;color:#94A3B8;font-size:11px">No assets recorded</div>'
      : groups
          .map(
            (g, i) => `
        <div class="t-row">
          <div class="c-num">${String(i + 1).padStart(2, "0")}</div>
          <div class="c-svc">${g.svc}</div>
          <div class="c-ast">${g.ast}</div>
          <div class="c-qty">${g.cnt}</div>
        </div>`,
          )
          .join("");

  return `
  <div class="section first">
    ${logoHtml(`R-${shortId(reportId, 5)}`, data.company)}

    <div class="sec-bar first">Site / Property Information</div>
    <div class="info-grid">
      <div class="info-cell">
        <div class="info-label">Site / Property</div>
        <div class="info-val">${propName}</div>
        <div class="info-val muted" style="margin-top:4px;white-space:pre-line">${address || "—"}</div>
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
        <div class="info-label">Date of Service</div>
        <div class="info-val">${perfDate}</div>
        ${timeStr}
      </div>
    </div>

    <div class="sec-bar">Inspector Accreditation</div>
    <div class="info-grid">
      <div class="info-cell">
        <div class="info-label">Inspector Name</div>
        <div class="info-val">${safeTechName}</div>
      </div>
      <div class="info-cell">
        <div class="info-label">FPAS Accreditation No.</div>
        <div class="info-val">${fpasNum}</div>
      </div>
      <div class="info-cell">
        <div class="info-label">FPAS Class</div>
        <div class="info-val">${fpasClass}</div>
      </div>
      <div class="info-cell accent">
        <div class="info-label">State Licence No.</div>
        <div class="info-val">${stateLic}</div>
      </div>
    </div>

    ${
      siteNote
        ? `
    <div class="sec-bar" style="background:#F1F5F9; color:#1C3048; border-left-color:#E97316;">Site Note</div>
    <div class="scope-wrap" style="background:#F8FAFC; border:1px solid #E2E8F0; border-top:none; border-radius:0 0 6px 6px">
      <p style="font-size:11px; color:#475569; line-height:1.7">${siteNote.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')}</p>
    </div>`
        : ""
    }


    <div class="sec-bar">Scope of Works</div>
    <div class="scope-wrap">
      <ul class="scope-list">${scopeItems}</ul>
    </div>

    <div class="sec-bar">Defect Summary</div>
    <div class="legend">
      <div class="legend-row nb">
        <div class="lg-cnt lc-crit">${cntCrit}</div>
        <div class="lg-ttl lc-crit">Critical Defects</div>
        <div class="lg-desc">A defect that renders a system inoperative.</div>
      </div>
      <div class="legend-row nb">
        <div class="lg-cnt lc-maj">${cntMaj}</div>
        <div class="lg-ttl lc-maj">Non-critical Defects</div>
        <div class="lg-desc">A system impairment not likely to critically affect the operation.</div>
      </div>
      <div class="legend-row nb">
        <div class="lg-cnt lc-min">${cntMin}</div>
        <div class="lg-ttl lc-min">Non-conformances</div>
        <div class="lg-desc">Missing information or incorrect feature — does not affect system operation.</div>
      </div>
      <div class="legend-row nb">
        <div class="lg-cnt lc-rec">0</div>
        <div class="lg-ttl lc-rec">Recommendations</div>
        <div class="lg-desc">A modification suggested to improve system performance.</div>
      </div>
      <div class="legend-row nb">
        <div class="lg-cnt lc-inf">0</div>
        <div class="lg-ttl lc-inf">Informational Notes</div>
        <div class="lg-desc">Detailed advice or general comment.</div>
      </div>
    </div>

    <div class="sec-bar">Servicing Summary</div>
    <div class="tbl-wrap">
      <div class="t-hdr nb">
        <div class="c-num">#</div>
        <div class="c-svc">Service</div>
        <div class="c-ast">Asset Type</div>
        <div class="c-qty">Qty</div>
      </div>
      ${summaryRows}
    </div>

    <div class="prepby">
      <span class="prepby-lbl">Report prepared by:</span>
      <span class="prepby-name">${safeTechName}</span>
    </div>
  </div>`;
}

// ─── Photo helpers ─────────────────────────────────────────────────────────────

/**
 * FIX: previously used isSafe(), which treats FALLBACK_IMG (a real data: URI)
 * as renderable — resulting in an invisible 1x1 image stretched into a bordered
 * box with nothing to show. Now genuinely-failed photos get a visible,
 * labelled placeholder instead of silently rendering blank.
 */
function thumbHtml(photo: InspectionPhoto): string {
  if (!isSafe(photo.photo_url)) return "";
  if (!isRealPhoto(photo.photo_url)) {
    return `<div class="photo-thumb photo-unavailable" title="Photo unavailable"></div>`;
  }
  return `<img src="${photo.photo_url}" class="photo-thumb" alt="" onerror="this.style.display='none'"/>`;
}

function defectPhotoHtml(url: string, cap = "Photo"): string {
  if (!isSafe(url)) return "";
  // FIX: sanitize photo captions — user-supplied text that goes directly into HTML
  const safeCaption = sanitizeForHtml(cap);
  if (!isRealPhoto(url)) {
    return `
    <div class="photo-wrap nb">
      <div class="photo-defect photo-unavailable">Photo<br/>unavailable</div>
      <div class="photo-cap">${safeCaption}</div>
    </div>`;
  }
  return `
  <div class="photo-wrap nb">
    <img src="${url}" class="photo-defect" alt="${safeCaption}" onerror="this.style.display='none'"/>
    <div class="photo-cap">${safeCaption}</div>
  </div>`;
}

// ─── Defect box ────────────────────────────────────────────────────────────────

function buildDefectBox(
  asset: AssetWithResult,
  defect: Defect | undefined,
  defectPhotos: InspectionPhoto[],
  assetPhotos: InspectionPhoto[],
  approvedQuote: Quote | null,
): string {
  // Build the inspection-photo HTML for ALL asset-linked photos
  const inspHtmlParts: string[] = [];
  for (const ap of assetPhotos) {
    if (ap.photo_url && isSafe(ap.photo_url)) {
      inspHtmlParts.push(
        defectPhotoHtml(ap.photo_url, ap.caption || "Inspection photo"),
      );
    }
  }

  if (defect) {
    const isCrit = defect.severity === "critical";
    const isMin = defect.severity === "minor";
    const cls = isCrit ? "crit" : isMin ? "min" : "";
    // AS1851-2012 defect classification labels
    const classLabel = isCrit ? "Class A" : isMin ? "Class C" : "Class B";
    const typeLabel = isCrit
      ? "Critical Defect (System Inoperative)"
      : isMin
        ? "Non-conformance"
        : "Non-critical Defect (System Impaired)";
    // Note: dates are rendered via addedDate / verifiedDate below

    // Photos: collect from inspection_photos only (asset-linked + defect-linked).
    // NOTE: defect.photos stores local file:// device URIs which never pass
    // isSafe() — they are NOT embedded. All real photos come from the
    // assetPhotos[] / defectPhotos[] arrays which hold base64 data: URIs.
    const seen = new Set<string>();
    const allPhotoHtmlParts: string[] = [];
    for (const ap of assetPhotos) {
      if (ap.photo_url && isSafe(ap.photo_url)) {
        seen.add(ap.photo_url);
        allPhotoHtmlParts.push(
          defectPhotoHtml(ap.photo_url, ap.caption || "Inspection photo"),
        );
      }
    }
    for (const p of defectPhotos) {
      if (isSafe(p.photo_url) && !seen.has(p.photo_url)) {
        seen.add(p.photo_url);
        allPhotoHtmlParts.push(
          defectPhotoHtml(p.photo_url, p.caption || "Photo"),
        );
      }
    }
    const photosHtml = allPhotoHtmlParts.length
      ? `<div class="defect-photo-grid">${allPhotoHtmlParts.join("")}</div>`
      : "";

    // Deduplication fix: if defect_reason / technician_notes is identical
    // to defect.description the technician filled in the same text twice.
    // In that case fall back to a meaningful generic action sentence instead
    // of echoing the same sentence under a different heading.
    const descText = defect.description || '';
    const rawResolution = asset.defect_reason || asset.technician_notes || '';
    const resolution = rawResolution && rawResolution.trim() !== descText.trim()
      ? rawResolution
      : 'Asset requires inspection, testing and formal remediation. Refer to the approved quote for scope and cost.';

    // Use defect.updated_at if available (last time record changed) as Last Verified.
    // Falls back to created_at if updated_at doesn't exist on the schema.
    const addedDate    = fmtDateTimeFull(defect.created_at);
    const verifiedDate = fmtDateTimeFull(defect.updated_at ?? defect.created_at);
    const statusLabel =
      defect.status === "repaired"
        ? "Repaired"
        : defect.status === "quoted"
          ? "Quoted — Pending Remediation"
          : "Open — Action Required";
    const statusColor =
      defect.status === "repaired"
        ? "#059669"
        : defect.status === "quoted"
          ? "#D97706"
          : "#DC2626";

    // Quote field — only show if an approved quote exists for this job
    const quoteHtml = approvedQuote
      ? `<div class="db-field">
          <div class="db-field-lbl">Remediation Quote</div>
          <span class="actioned">&#10003; Quote Approved — ${fmtCurrency(approvedQuote.total_amount ?? 0)}</span>
        </div>`
      : `<div class="db-field">
          <div class="db-field-lbl">Remediation Quote</div>
          <div class="db-field-val" style="color:#D97706;font-weight:700">Pending — Quote not yet raised</div>
        </div>`;

    // FIX: removed the outer "nb" (page-break-inside: avoid) that used to sit
    // on this whole box. A tall box (header + description + 2-3 photos) that
    // didn't quite fit the remaining page space was being pushed as one solid
    // unit to the next page, leaving everything left on the current page
    // blank. The header, each field, and each photo are individually
    // avoid-break (see .db-hdr / .db-field / .photo-wrap), which keeps the
    // box looking clean while letting it split across a page boundary when
    // it genuinely needs to.
    return `
    <div class="db ${cls}">
      <div class="db-hdr nb">
        <div>
          <div class="db-type">${classLabel} &mdash; ${typeLabel}</div>
          <div class="db-id">ID: ${shortId(defect.id, 4)} &middot; AS1851-2012</div>
        </div>
        <div class="db-dates">
          Added: ${addedDate}<br/>Last Verified: ${verifiedDate}
        </div>
      </div>
      <div class="db-body">
        <div class="db-field">
          <span class="db-field-lbl">Description: </span>
          <span class="db-field-val">${sanitizeForHtml(defect.description || 'Defect observed during inspection.')}</span>
        </div>
        <div class="db-field">
          <span class="db-field-lbl">Resolution: </span>
          <span class="db-field-val">${sanitizeForHtml(resolution)}</span>
        </div>
        <div class="db-field">
          <span class="db-field-lbl">Status: </span>
          <span class="db-field-val" style="font-weight:700;color:${statusColor}">${statusLabel}</span>
        </div>
        ${quoteHtml}
      </div>
      ${photosHtml}
    </div>`;
  }

  // Fallback — no linked Defect record: asset failed but no Defect row exists
  const fb = fmtDateTimeFull(asset.actioned_at ?? new Date().toISOString());
  const fallbackPhotos = inspHtmlParts.length
    ? `<div class="defect-photo-grid">${inspHtmlParts.join("")}</div>`
    : "";

  // FIX: same as above — no outer "nb" on the fallback box either.
  return `
  <div class="db">
    <div class="db-hdr nb">
      <div>
        <div class="db-type">Class B &mdash; Non-critical Defect (System Impaired)</div>
        <div class="db-id">AS1851 Ref: ${shortId(asset.id, 4)} &middot; Recorded: ${fb}</div>
      </div>
      <div class="db-dates" style="font-size:9px;color:#DC2626;text-align:right;font-weight:700">Open &mdash;<br/>Action Required</div>
    </div>
    <div class="db-body">
      <div class="db-field">
        <div class="db-field-lbl">Defect Description</div>
        <div class="db-field-val">${sanitizeForHtml(asset.defect_reason || 'Asset failed testing parameters during inspection.')}</div>
      </div>
      <div class="db-field">
        <div class="db-field-lbl">Required Remediation Action</div>
        <div class="db-field-val">Formal defect report and remediation quote required.</div>
      </div>
      <div class="db-field">
        <div class="db-field-lbl">Remediation Quote</div>
        <div class="db-field-val" style="color:#D97706;font-weight:700">Pending — Quote not yet raised</div>
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
  approvedQuote: Quote | null,
): string {
  const isPass = asset.result === "pass";
  const isFail = asset.result === "fail";
  const pillCls = isPass ? "pass" : isFail ? "fail" : "nt";
  const pillLbl = isPass ? "PASS" : isFail ? "FAIL" : "N/T";

  const ref     = sanitizeForHtml(assetRefCode(asset, index), MAX_LENGTHS.reference);
  const typeLbl = sanitizeForHtml(formatAssetType(asset.asset_type), MAX_LENGTHS.shortText);
  const loc     = sanitizeForHtml(asset.location_on_site ?? '', MAX_LENGTHS.shortText);
  const notes   = sanitizeForHtml(asset.inspection_notes || asset.technician_notes || '', MAX_LENGTHS.notes);

  // AS1851: show install date and next service date on every asset row
  const installDate = fmtDateShort(asset.install_date);
  // FIX: Only use the stored next_service_date — never derive from actioned_at
  const nextSvcDate = asset.next_service_date
    ? fmtDateShort(asset.next_service_date)
    : '—';
  // Data quality: flag if install date is set in the future (data entry error)
  const reportDateMs = Date.now();
  const installFuture = !!(asset.install_date && new Date(asset.install_date).getTime() > reportDateMs);
  const installStr = installDate + (installFuture ? ' ⚠' : '');

  const linkedDefect = defects.find((d) => d.asset_id === asset.id);
  const assetPhotos = photos.filter(
    (p) => p.asset_id === asset.id && !p.defect_id,
  );
  const defectPhotos = linkedDefect
    ? photos.filter((p) => p.defect_id === linkedDefect.id)
    : [];

  const thumbsHtml =
    isPass && assetPhotos.length > 0
      ? `<div class="thumb-grid">${assetPhotos
          .slice(0, 3)
          .map((p) => thumbHtml(p))
          .join("")}</div>`
      : "";

  const defectHtml = isFail
    ? buildDefectBox(
        asset,
        linkedDefect,
        defectPhotos,
        assetPhotos,
        approvedQuote,
      )
    : "";

  const serialLine = asset.serial_number
    ? `<span style="font-size:9px;color:#94A3B8;font-family:monospace;margin-left:8px">S/N: ${sanitizeForHtml(asset.serial_number, MAX_LENGTHS.reference)}</span>`
    : '';

  return `
  <div class="a-wrap">
    <div class="a-row ${isFail ? "fail-row" : "pass-row"} nb">
      <div class="a-left">
        <span class="a-ref">${ref} - ${typeLbl}</span>${loc ? `<span class="a-loc">${loc}</span>` : ""}${serialLine}
        ${notes ? `<div class="a-notes">${notes}</div>` : ""}
        <div style="display:flex;gap:14px;margin-top:4px">
          <span style="font-size:9px;color:#94A3B8"><span style="font-weight:700;color:#64748B">Installed:</span> ${installStr}${installFuture ? `<span style="color:#DC2626;font-size:8px;margin-left:4px">Future date — verify</span>` : ''}</span>
          <span style="font-size:9px;color:#94A3B8"><span style="font-weight:700;color:#64748B">Next Service:</span> ${nextSvcDate}</span>
        </div>
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

function buildMaintPage(data: ReportData): string {
  const {
    assets,
    defects,
    photos,
    signature,
    techName,
    reportId,
    approvedQuote,
  } = data;

  const sigHtml = buildSig(signature, techName);

  // AS1851: compliance declaration block — only shown when assets exist
  const passCount = assets.filter((a) => a.result === "pass").length;
  const failCount = assets.filter((a) => a.result === "fail").length;
  const ntCount = assets.filter(
    (a) => a.result === "not_tested" || !a.result,
  ).length;
  const totalCount = assets.length;
  const overallCompliant = failCount === 0 && totalCount > 0;
  // State-specific compliance citation: use property state if available
  const propertyState = data.job.property_state ?? null;
  const stateRef = propertyState === 'NSW'
    ? 'Part 10 of the NSW EP&A (Development Certification and Fire Safety) Regulation 2021'
    : propertyState === 'VIC'
    ? 'the Victorian Building Regulations 2018 (Part 16)'
    : propertyState === 'QLD'
    ? 'the Queensland Development Code MP 6.1'
    : 'the relevant State fire safety regulations';

  const declarationHtml =
    totalCount === 0
      ? ""
      : `
  <div class="nb" style="margin-top:18px;border:1.5px solid ${overallCompliant ? "#6EE7B7" : "#FCA5A5"};border-radius:6px;overflow:hidden">
    <div style="background:${overallCompliant ? "#D1FAE5" : "#FEE2E2"};padding:10px 14px;border-bottom:1px solid ${overallCompliant ? "#6EE7B7" : "#FCA5A5"};display:flex;align-items:center;gap:10px">
      <div style="width:18px;height:18px;border-radius:50%;background:${overallCompliant ? "#059669" : "#DC2626"};display:flex;align-items:center;justify-content:center;flex-shrink:0">
        <span style="color:#fff;font-size:11px;font-weight:900">${overallCompliant ? "\u2713" : "!"}</span>
      </div>
      <div style="font-size:10px;font-weight:800;color:${overallCompliant ? "#065F46" : "#991B1B"};text-transform:uppercase;letter-spacing:0.8px">
        AS1851-2012 &mdash; ${overallCompliant ? "All Systems Compliant" : "Defects Identified — Remediation Required"}
      </div>
    </div>
    <div style="padding:10px 14px;background:#FAFBFD;font-size:10.5px;color:#475569;line-height:1.7">
      All inspection activities were conducted in accordance with <strong>AS1851-2012</strong>
      (Maintenance of fire protection systems and equipment) and ${stateRef}.
      <strong>${passCount}</strong> of <strong>${totalCount}</strong> asset(s) passed inspection.
      ${failCount > 0 ? `<strong style="color:#DC2626">${failCount}</strong> defect(s) (Class A/B/C) identified &mdash; require remediation action per AS1851-2012 Clause 4.` : 'No defects identified during this inspection.'}
      ${ntCount > 0 ? `<strong>${ntCount}</strong> asset(s) were not tested during this inspection.` : ''}
    </div>
  </div>`;

  if (assets.length === 0) {
    return `
  <div class="section">
    ${compactHeaderHtml(`R-${shortId(reportId, 5)}`, data.company)}
    <div class="sec-bar first">Asset Maintenance Log</div>
    <div style="padding:18px 14px;color:#94A3B8;font-size:11px;border:1px solid #E2E8F0;border-top:none;border-radius:0 0 6px 6px">
      No maintenance records for this job.
    </div>
    ${declarationHtml}
    ${sigHtml}
  </div>`;
  }

  // Group assets by type
  const groupMap = new Map<string, AssetWithResult[]>();
  for (const a of assets) {
    const lbl = formatAssetType(a.asset_type ?? "General Asset");
    if (!groupMap.has(lbl)) groupMap.set(lbl, []);
    groupMap.get(lbl)!.push(a);
  }

  let gi = 0;
  let body = "";
  for (const [name, ga] of groupMap) {
    const rows = ga
      .map((a) =>
        buildAssetRow(a, gi++, defects, photos, approvedQuote ?? null),
      )
      .join("");
    // FIX: group header + column header are now wrapped in a single
    // .maint-group-head (page-break-inside: avoid) block instead of putting
    // "nb" on the group header alone. Previously the group header could end
    // up glued to a page bottom with its column header and rows all pushed
    // to the next page, leaving an orphaned title and a blank rest-of-page
    // behind it (this is exactly what happened with "Fire Detection Devices"
    // on page 3 of the sample PDF).
    body += `
    <div class="maint-group-head">
      <div class="maint-group-hdr">${name}</div>
      <div class="maint-col-hdr">
        <div class="maint-col-l">Asset</div>
        <div class="maint-col-r">Status</div>
      </div>
    </div>
    ${rows}`;
  }

  return `
  <div class="section">
    ${compactHeaderHtml(`R-${shortId(reportId, 5)}`, data.company)}
    <div class="sec-bar first">Asset Maintenance Log</div>
    ${body}
    ${declarationHtml}
    ${sigHtml}
  </div>`;
}

function buildSig(signature: Signature | null, techName: string): string {
  // FIX: A data: URI that is NOT FALLBACK_IMG is always a real signature image —
  // even when it was embedded directly from the canvas without re-encoding.
  // The previous check relied on isRealPhoto() which is correct, but only if the
  // URI is not 'UNAVAILABLE' (which means the client was not present).
  const isClientUnavailable = signature?.signature_url === "UNAVAILABLE";

  // Client signature
  const clientSigHtml =
    !isClientUnavailable &&
    signature?.signature_url &&
    isRealPhoto(signature.signature_url)
      ? `<img src="${signature.signature_url}" class="sig-img" alt="Client Signature" onerror="this.style.display='none'"/>`
      : isClientUnavailable
        ? `<span class="sig-empty" style="font-size:10px;color:#D97706;font-weight:700">Client unavailable to sign</span>`
        : `<span class="sig-empty">${signature?.signed_by_name ? "Signature not captured" : "Not captured"}</span>`;

  // Technician signature — real captured PNG preferred (AS1851); falls back to typed name
  const techSigHtml =
    signature?.tech_signature_url && isRealPhoto(signature.tech_signature_url)
      ? `<img src="${signature.tech_signature_url}" class="sig-img" alt="Inspector Signature" onerror="this.style.display='none'"/>`
      : `<span class="sig-typed">${sanitizeForHtml(techName, MAX_LENGTHS.name)}</span>`;

  const signerName = sanitizeForHtml(signature?.signed_by_name ?? '', MAX_LENGTHS.name);

  return `
  <div class="sig-section nb">
    <div class="sig-section-hdr">Signatures</div>
    <div class="sig-grid">
      <div class="sig-block">
        <div class="sig-pad">${techSigHtml}</div>
        <div class="sig-lbl">Inspector Signature</div>
      </div>
      <div class="sig-block">
        <div class="sig-pad">${clientSigHtml}</div>
        <div class="sig-lbl">Authorised Signatory${signerName ? ` — ${signerName}` : ""}</div>
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
  company: Record<string, string | null | undefined>,
): string {
  if (!items.length) return "";

  const rows = items
    .map((qi, i) => {
      const name =
        inventory.find((inv) => inv.id === qi.inventory_item_id)?.name ??
        "Service Item";
      const unit = parseFloat(String(qi.unit_price));
      const total = qi.quantity * unit;
      return `
    <div class="t-row">
      <div class="c-num">${i + 1}</div>
      <div class="c-desc">${name}</div>
      <div class="c-qsm">${qi.quantity}</div>
      <div class="c-unit">${fmtCurrency(unit)}</div>
      <div class="c-tot">${fmtCurrency(total)}</div>
    </div>`;
    })
    .join("");

  // FIX: quote.total_amount is the subtotal (ex-GST) — gst = total * 0.10.
  // Previously used total / 11 which is the formula for EXTRACTING GST from
  // a GST-inclusive amount — wrong here. Compare with quoteTemplate.ts ln173.
  const total = parseFloat(String(quote.total_amount)) || 0;
  const gst    = total * 0.10;
  const exGst  = total;
  const grandTotal = total + gst;

  return `
  <div class="section">
    ${logoHtml(`Q-${shortId(quote.id, 5)}`, company, "Estimate & Quote")}
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
        <div class="grand-val">${fmtCurrency(grandTotal)}</div>
      </div>
    </div>
  </div>`;
}

// ─── Main export ───────────────────────────────────────────────────────────────

export function buildReportHtml(data: ReportData): string {
  const { approvedQuote, quoteItems, inventory, reportId, job } = data;
  const propertyName = job.property_name ?? reportId;

  const hasQuote = Boolean(approvedQuote && quoteItems?.length && inventory);
  const quotePg = hasQuote
    ? buildQuotePage(
        approvedQuote!,
        quoteItems!,
        inventory!,
        reportId,
        data.company,
      )
    : "";

  const page1 = buildPage1(data);
  const maintPg = buildMaintPage(data);
  // WKWebView (expo-print) renders any leading whitespace as blank page content.
  return `<!DOCTYPE html>
<html lang="en"><head>
  <meta charset="utf-8"/>
  <meta name="viewport" content="width=794"/>
  <title>Service Report — ${propertyName}</title>
  <style>${CSS}</style>
</head><body>${page1}${maintPg}${quotePg}</body></html>`;
}
