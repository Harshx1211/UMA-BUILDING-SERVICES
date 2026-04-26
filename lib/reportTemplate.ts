/**
 * lib/reportTemplate.ts — v4
 *
 * SiteTrack branded PDF report template.
 *
 *   Page 1  — Gradient header + info cards + scope + severity legend + asset summary
 *   Page 2+ — Logo fixed top-right, asset maintenance log
 *   Footer  — Fixed footer with orange accent: company | Page X of Y | contact
 *   Assets  — "057 - Type   [location]   PASS/FAIL" on one line
 *   Defects — Full-border defect card with severity colours and timestamps
 */

import {
  Job,
  Defect,
  Signature,
  InspectionPhoto,
  TimeLog,
  Quote,
  QuoteItem,
  InventoryItem,
} from '@/types';
import { formatAssetType } from '@/utils/assetHelpers';
import { CompanyConfig } from '@/constants/Company';

// ─────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────

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
  // Joined from job_assets:
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

// ─────────────────────────────────────────────────────────────
// Formatting helpers
// ─────────────────────────────────────────────────────────────

function fmtDateShort(iso: string | null | undefined): string {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleDateString('en-AU', {
      day: 'numeric', month: 'short', year: 'numeric',
    });
  } catch { return iso; }
}

/** Formats as "29th May 2024 1:09PM" — matching reference exactly */
function fmtDateTimeFull(iso: string | null | undefined): string {
  if (!iso) return '—';
  try {
    const d = new Date(iso);
    const day = d.getDate();
    const suffix =
      [11, 12, 13].includes(day % 100) ? 'th'
      : day % 10 === 1 ? 'st'
      : day % 10 === 2 ? 'nd'
      : day % 10 === 3 ? 'rd'
      : 'th';
    const month = d.toLocaleDateString('en-AU', { month: 'long' });
    const year  = d.getFullYear();
    let   hours = d.getHours();
    const mins  = String(d.getMinutes()).padStart(2, '0');
    const ampm  = hours >= 12 ? 'PM' : 'AM';
    hours = hours % 12 || 12;
    return `${day}${suffix} ${month} ${year} ${hours}:${mins}${ampm}`;
  } catch { return iso; }
}

function shortId(id: string, len = 4): string {
  return id.replace(/-/g, '').substring(0, len).toUpperCase();
}

function fmtCurrency(value: number | string): string {
  const n = parseFloat(String(value));
  return isNaN(n) ? '$0.00' : `$${n.toFixed(2)}`;
}

/** Strips underscores and title-cases a job type string */
function fmtJobType(raw: string | null | undefined): string {
  if (!raw) return 'Service';
  return raw.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
}

/** Returns a padded 3-digit sequence or serial prefix as the asset reference code */
function assetRefCode(asset: AssetWithResult, index: number): string {
  if (asset.serial_number) {
    const clean = asset.serial_number.replace(/\D/g, '');
    if (clean.length >= 3) return clean.slice(0, 3);
  }
  return String(index + 1).padStart(3, '0');
}

// ─────────────────────────────────────────────────────────────
// Fixed elements (logo + footer — rendered on EVERY page)
// ─────────────────────────────────────────────────────────────

/** Top-right logo rendered as a fixed element — appears on all pages */
function fixedLogoHtml(): string {
  return `
  <div class="fixed-logo">
    <div class="logo-diamond">
      <div class="logo-inner"><span class="logo-initials">ST</span></div>
    </div>
    <div class="logo-text">
      <div class="logo-brand"><span class="logo-red">S</span>ITE<span class="logo-red">T</span>RACK</div>
      <div class="logo-sub">SERVICES</div>
    </div>
  </div>`;
}

/** Fixed footer — company | Page X of Y | contact */
function fixedFooterHtml(): string {
  return `
  <div class="fixed-footer">
    <div class="footer-left">
      <div>${CompanyConfig.name}</div>
      <div>${CompanyConfig.addressLine1}, ${CompanyConfig.addressLine2}</div>
      <div>ABN: ${CompanyConfig.abn}</div>
    </div>
    <div class="footer-center">
      Page <span class="page-num"></span> of <span class="page-total"></span>
    </div>
    <div class="footer-right">
      <div>&#127758; ${CompanyConfig.website}</div>
      <div>&#64; ${CompanyConfig.contactEmail}</div>
      <div>&#9742; ${CompanyConfig.contactPhone}</div>
    </div>
  </div>`;
}

// ─────────────────────────────────────────────────────────────
// Page 1 — Cover / Summary
// ─────────────────────────────────────────────────────────────

function buildPage1Html(data: ReportData): string {
  const { job, assets, defects, techName, reportId } = data;

  // BUG 1 FIX: getJobById returns flat columns — no nested job.property object exists
  const j = job as any;
  const address = [j.property_address, j.property_suburb, j.property_state, j.property_postcode]
    .filter(Boolean).join('\n');
  const siteContact  = j.site_contact_name ?? 'Not provided';
  const propertyName = j.property_name ?? '—';

  // BUG 24 FIX: use updated_at (closest proxy to actual completion) not scheduled_date
  const performedDate = fmtDateShort(j.updated_at ?? job.scheduled_date);
  const jobTypeLabel  = fmtJobType(job.job_type);

  // Defect severity counts
  const cntCritical = defects.filter(d => d.severity === 'critical').length;
  const cntMajor    = defects.filter(d => d.severity === 'major').length;
  const cntMinor    = defects.filter(d => d.severity === 'minor').length;

  // BUG 23 FIX: Asset type grouping — Service label describes the WORK, Asset label the EQUIPMENT
  type GroupEntry = { serviceLabel: string; assetLabel: string; count: number };
  const grouped = assets.reduce<Record<string, GroupEntry>>((acc, a) => {
    const key = a.asset_type ?? 'General Asset';
    if (!acc[key]) {
      const assetLabel   = formatAssetType(key);
      const serviceLabel = `Annual Inspection – ${assetLabel}`;
      acc[key] = { serviceLabel, assetLabel, count: 0 };
    }
    acc[key].count++;
    return acc;
  }, {});
  const groupEntries = Object.values(grouped);

  // Scope of Works — numbered codes based on index
  const scopeItems = groupEntries.length === 0
    ? '<li>No assets recorded for this job.</li>'
    : groupEntries
        .map((g, i) =>
          `<li>${String(i + 1).padStart(2, '0')} - ${g.serviceLabel} (${g.count})</li>`)
        .join('');

  // Servicing Summary rows
  const summaryRows = groupEntries.length === 0
    ? '<div class="empty-row">No assets recorded</div>'
    : groupEntries
        .map((g, i) => `
        <div class="table-row">
          <div class="col-service">${String(i + 1).padStart(2, '0')} - ${g.serviceLabel}</div>
          <div class="col-asset">${g.assetLabel}</div>
          <div class="col-qty">${g.count}</div>
        </div>`)
        .join('');

  return `
  <!-- ═══ PAGE 1: Cover Summary ═══ -->
  <div class="page page-1">

    <!-- Full-width navy header bar -->
    <div class="header-bar">
      <div class="header-title">Service Report</div>
      <div class="header-id">R-${shortId(reportId, 5)}</div>
    </div>

    <!-- Info grid: individual cards -->
    <div class="info-grid">
      <div class="info-card">
        <div class="info-label">Site / Property</div>
        <div class="info-val bold">${propertyName}</div>
        <div class="info-val muted" style="white-space:pre-line">${address || '—'}</div>
      </div>
      <div class="info-card">
        <div class="info-label">Site Contact</div>
        <div class="info-val">${siteContact}</div>
      </div>
      <div class="info-card">
        <div class="info-label">Job Type</div>
        <div class="info-val">${jobTypeLabel}</div>
        <div class="info-label" style="margin-top:10px">Reference No.</div>
        <div class="info-val">${shortId(job.id, 6)}</div>
      </div>
      <div class="info-card ic-accent">
        <div class="info-label">Date Completed</div>
        <div class="info-val bold">${performedDate}</div>
      </div>
    </div>

    <!-- Scope of Works -->
    <div class="section-bar">Scope of Works</div>
    <div class="scope-body">
      <ul class="scope-list">${scopeItems}</ul>
    </div>

    <!-- Defect legend -->
    <div class="legend">
      <div class="legend-row">
        <div class="legend-count lgd-crit">${cntCritical}</div>
        <div class="legend-title lgd-crit">Critical Defects</div>
        <div class="legend-desc">A defect that renders a system inoperative.</div>
      </div>
      <div class="legend-row">
        <div class="legend-count lgd-maj">${cntMajor}</div>
        <div class="legend-title lgd-maj">Non-critical Defects</div>
        <div class="legend-desc">A system impairment not likely to critically affect the operation of the system.</div>
      </div>
      <div class="legend-row">
        <div class="legend-count lgd-min">${cntMinor}</div>
        <div class="legend-title lgd-min">Non-conformances</div>
        <div class="legend-desc">Missing information or incorrect feature that does not affect the system operation.</div>
      </div>
      <div class="legend-row">
        <div class="legend-count lgd-rec">0</div>
        <div class="legend-title lgd-rec">Recommendations</div>
        <div class="legend-desc">A modification suggested to improve the system performance.</div>
      </div>
      <div class="legend-row">
        <div class="legend-count lgd-inf">0</div>
        <div class="legend-title lgd-inf">Informational Notes</div>
        <div class="legend-desc">Detailed advice or general comment.</div>
      </div>
    </div>

    <!-- Asset Summary -->
    <div class="section-bar">Asset Summary</div>
    <div class="table-header">
      <div class="col-service">Service Description</div>
      <div class="col-asset">Asset Type</div>
      <div class="col-qty">Qty</div>
    </div>
    ${summaryRows}

    <!-- Technician sign-off row -->
    <div class="tech-row">
      <span class="tech-label">Report prepared by:</span>
      <span class="tech-name">${techName}</span>
    </div>
  </div>`;
}

// ─────────────────────────────────────────────────────────────
// Page 2+ — Maintenance section
// ─────────────────────────────────────────────────────────────

function buildAssetPhoto(photo: InspectionPhoto, small = true): string {
  const cls = small ? 'photo-thumb' : 'photo-inline';
  return `
  <div class="photo-wrap">
    <img src="${photo.photo_url}" class="${cls}" alt="Inspection photo" />
    <div class="photo-caption">${photo.caption || 'Inspection photo'}</div>
  </div>`;
}

/** Builds a photo block from a raw URL string (used for defect.photos[] entries) */
function buildRawPhoto(url: string, caption = 'Defect photo', small = false): string {
  const cls = small ? 'photo-thumb' : 'photo-defect';
  return `
  <div class="photo-wrap avoid-break">
    <img src="${url}" class="${cls}" alt="${caption}" />
    <div class="photo-caption">${caption}</div>
  </div>`;
}

function buildDefectBoxHtml(
  asset: AssetWithResult,
  defect: Defect | undefined,
  photo: InspectionPhoto | undefined
): string {
  // Primary photo source: inspection_photos table record (already base64-encoded)
  const inspectionPhotoHtml = photo ? buildAssetPhoto(photo, false) : '';

  if (defect) {
    const isCritical = defect.severity === 'critical';
    const isMinor    = defect.severity === 'minor';
    const boxCls     = isCritical ? 'db-crit' : isMinor ? 'db-min' : 'db-maj';
    const typeLabel  = isCritical ? 'Critical defect' : isMinor ? 'Non-conformance' : 'Non-critical defect';
    const addedDate  = fmtDateTimeFull(defect.created_at);
    const verifDate  = addedDate; // Defect type has no updated_at — reuse created_at

    // Secondary photo source: defect.photos[] JSON array (base64-encoded by processPhotos)
    let defectPhotoUrls: string[] = [];
    try {
      defectPhotoUrls = typeof defect.photos === 'string'
        ? JSON.parse(defect.photos as unknown as string)
        : (Array.isArray(defect.photos) ? defect.photos : []);
    } catch { defectPhotoUrls = []; }

    // Build photo grid — prefer inspection_photos; supplement with defect.photos[]
    const defectPhotosHtml = defectPhotoUrls
      .filter(u => u) // include original URLs even if not base64, so it doesn't just silently drop them
      .map((url, i) => buildRawPhoto(url, `Defect photo ${i + 1}`, false))
      .join('');

    // Combine: inspection photo first, then defect-specific photos
    const combinedPhotos = [inspectionPhotoHtml, defectPhotosHtml].filter(Boolean).join('');
    const allPhotosHtml = combinedPhotos ? `<div class="photo-grid">${combinedPhotos}</div>` : '';

    return `
    <div class="defect-box ${boxCls}">
      <div class="defect-header avoid-break">
        <div>
          <div class="defect-type">${typeLabel}</div>
          <div class="defect-id">ID: ${shortId(defect.id, 4)} &#x1F517;</div>
        </div>
        <div class="defect-dates">
          Added: ${addedDate}<br/>
          Last Verified: ${verifDate}
        </div>
      </div>
      <div class="defect-field"><strong>Description:</strong><br/>${defect.description || 'Defect observed.'}</div>
      <div class="defect-field"><strong>Resolution:</strong><br/>${asset.defect_reason || asset.technician_notes || 'Requires further action.'}</div>
      <div class="defect-field"><strong>Quote:</strong> <span class="actioned-badge">ACTIONED</span></div>
      ${allPhotosHtml}
    </div>`;
  }

  // No Defect record — generic box for failed assets
  const fallbackDate = fmtDateTimeFull(asset.actioned_at ?? new Date().toISOString());
  return `
  <div class="defect-box db-maj">
    <div class="defect-header avoid-break">
      <div>
        <div class="defect-type">Non-critical defect</div>
        <div class="defect-id">ID: ${shortId(asset.id, 4)}</div>
      </div>
      <div class="defect-dates">Added: ${fallbackDate}</div>
    </div>
    <div class="defect-field"><strong>Description:</strong><br/>${asset.defect_reason || 'Failed testing parameters.'}</div>
    <div class="defect-field"><strong>Resolution:</strong><br/>Pending formal quote.</div>
    ${inspectionPhotoHtml ? `<div class="photo-grid">${inspectionPhotoHtml}</div>` : ''}
  </div>`;
}

function buildAssetRowHtml(
  asset: AssetWithResult,
  index: number,
  defects: Defect[],
  photos: InspectionPhoto[]
): string {
  const isPass = asset.result === 'pass';
  const isFail = asset.result === 'fail';

  const pillCls   = isPass ? 'pill-pass' : isFail ? 'pill-fail' : 'pill-nt';
  const pillLabel = isPass ? 'PASS' : isFail ? 'FAIL' : 'N/T';

  const refCode  = assetRefCode(asset, index);
  const typeLabel = formatAssetType(asset.asset_type);
  const location  = asset.location_on_site ?? '';

  const linkedDefect = defects.find(d => d.asset_id === asset.id);
  const assetPhoto   = photos.find(
    p => p.asset_id === asset.id || (linkedDefect && p.asset_id === linkedDefect.asset_id)
  );

  // PASS: thumbnail below pill; FAIL: photo inside defect box
  const passPhotoHtml = isPass && assetPhoto ? buildAssetPhoto(assetPhoto, true) : '';
  const defectHtml    = isFail ? buildDefectBoxHtml(asset, linkedDefect, assetPhoto) : '';

  return `
  <div class="asset-block">
    <div class="asset-row avoid-break">
      <div class="asset-left">
        <span class="asset-ref">${refCode} - ${typeLabel}</span>
        ${location ? `<span class="asset-loc">${location}</span>` : ''}
      </div>
      <div class="asset-right">
        <span class="pill ${pillCls}">${pillLabel}</span>
        ${passPhotoHtml}
      </div>
    </div>
    ${defectHtml}
  </div>`;
}

function buildMaintenancePage(data: ReportData): string {
  const { assets, defects, photos, signature, techName } = data;

  if (assets.length === 0) {
    return `
    <div class="page maint-page">
      <div class="maint-section-bar">Asset Maintenance Log</div>
      <div class="empty-row">No maintenance records for this job.</div>
      ${buildSignaturesHtml(signature, techName)}
    </div>`;
  }

  // Group by asset_type — preserving insertion order
  const groupMap = new Map<string, AssetWithResult[]>();
  for (const asset of assets) {
    const label = formatAssetType(asset.asset_type ?? 'General Asset');
    if (!groupMap.has(label)) groupMap.set(label, []);
    groupMap.get(label)!.push(asset);
  }

  let globalIndex = 0;
  let groupsHtml  = '';

  for (const [groupName, groupAssets] of groupMap) {
    const rows = groupAssets
      .map(asset => buildAssetRowHtml(asset, globalIndex++, defects, photos))
      .join('');

    groupsHtml += `
    <div class="group-header avoid-break">${groupName}</div>
    <div class="col-row">
      <div class="col-asset-hd">Asset</div>
      <div class="col-status-hd">Status</div>
    </div>
    ${rows}`;
  }

  return `
  <!-- ═══ PAGE 2+: Asset Maintenance Log ═══ -->
  <div class="page maint-page">
    <div class="maint-section-bar">Asset Maintenance Log</div>
    ${groupsHtml}
    ${buildSignaturesHtml(signature, techName)}
  </div>`;
}

function buildSignaturesHtml(signature: Signature | null, techName: string): string {
  const clientSig = signature?.signature_url
    ? `<img src="${signature.signature_url}" alt="Authorised Signatory" class="sig-img" />`
    : `<span class="sig-empty">Not captured</span>`;

  return `
  <div class="sig-area avoid-break">
    <div class="sig-block">
      <div class="sig-pad">
        <span class="sig-typed">${techName}</span>
      </div>
      <div class="sig-label">Inspector Signature</div>
    </div>
    <div class="sig-block">
      <div class="sig-pad">${clientSig}</div>
      <div class="sig-label">Authorised Signatory</div>
    </div>
  </div>`;
}

// ─────────────────────────────────────────────────────────────
// Quote page
// ─────────────────────────────────────────────────────────────

function buildQuotePageHtml(
  quote: Quote,
  items: QuoteItem[],
  inventory: InventoryItem[]
): string {
  if (items.length === 0) return '';

  const rows = items.map((qi, i) => {
    const name = inventory.find(inv => inv.id === qi.inventory_item_id)?.name ?? 'Item';
    const total = fmtCurrency(qi.quantity * parseFloat(String(qi.unit_price)));
    return `
    <div class="table-row">
      <div class="col-no">${i + 1}</div>
      <div class="col-desc">${name}</div>
      <div class="col-qty-sm">${qi.quantity}</div>
      <div class="col-unit">${fmtCurrency(qi.unit_price)}</div>
      <div class="col-total">${total}</div>
    </div>`;
  }).join('');

  return `
  <!-- ═══ Quote Page ═══ -->
  <div class="page quote-page">
    <div class="header-bar">
      <div class="header-title">Estimate &amp; Quote</div>
      <div class="header-id">Q-${shortId(quote.id, 5)}</div>
    </div>
    <div class="table-header">
      <div class="col-no">#</div>
      <div class="col-desc">Service / Item Details</div>
      <div class="col-qty-sm">Qty</div>
      <div class="col-unit">Unit Price</div>
      <div class="col-total">Total</div>
    </div>
    ${rows}
    <div class="grand-total-row">
      <div class="grand-total-label">Total Approved Estimate:</div>
      <div class="grand-total-val">${fmtCurrency(quote.total_amount)}</div>
    </div>
  </div>`;
}

// ─────────────────────────────────────────────────────────────
// CSS
// ─────────────────────────────────────────────────────────────

const REPORT_CSS = `
  @page {
    margin: 0;
    size: A4;
  }

  /* ── Reset ── */
  *, *::before, *::after {
    box-sizing: border-box; margin: 0; padding: 0;
    font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif;
  }
  body { color: #1a1a1a; line-height: 1.45; font-size: 12.5px; background: #fff; }

  /* ── Utilities ── */
  .avoid-break { page-break-inside: avoid; break-inside: avoid; }
  .bold   { font-weight: 700; }
  .muted  { color: #94A3B8; }
  .empty-row { padding: 20px 16px; color: #94A3B8; font-size: 12px; }

  /* ══════════════════════════════════════════════════════════
     FIXED ELEMENTS — appear on every printed page
  ══════════════════════════════════════════════════════════ */

  /* Company logo — fixed top-right */
  .fixed-logo {
    position: fixed;
    top: 24px; right: 36px;
    display: flex;
    align-items: center;
    gap: 10px;
    z-index: 100;
  }
  .logo-diamond {
    width: 44px; height: 44px;
    background: #F97316;
    transform: rotate(45deg);
    display: flex; align-items: center; justify-content: center;
    flex-shrink: 0;
    border-radius: 4px;
  }
  .logo-inner { transform: rotate(-45deg); }
  .logo-initials { font-size: 14px; font-weight: 900; color: #fff; letter-spacing: -1px; }
  .logo-text { display: flex; flex-direction: column; }
  .logo-brand { font-size: 13.5px; font-weight: 900; color: #1C3048; letter-spacing: 0.5px; text-transform: uppercase; }
  .logo-sub   { font-size: 9.5px; font-weight: 700; color: #94A3B8; letter-spacing: 1.5px; text-transform: uppercase; }
  .logo-red   { color: #F97316; }

  /* Footer — fixed bottom with orange accent */
  .fixed-footer {
    position: fixed;
    bottom: 0; left: 0; right: 0;
    height: 54px;
    border-top: 3px solid #F97316;
    padding: 0 36px;
    display: flex;
    align-items: center;
    justify-content: space-between;
    font-size: 10px;
    color: #94A3B8;
    background: #fff;
    z-index: 100;
  }
  .footer-left  { line-height: 1.6; }
  .footer-center { text-align: center; font-size: 10.5px; color: #475569; font-weight: 600; white-space: nowrap; }
  .footer-right { text-align: right; line-height: 1.6; }

  /* CSS counter-based page numbers */
  .page-num::after   { content: counter(page); }
  .page-total::after { content: counter(pages); }

  /* ══════════════════════════════════════════════════════════
     PAGE CONTAINERS
  ══════════════════════════════════════════════════════════ */

  .page {
    padding: 32px 36px 80px 36px;
    max-width: 100%;
    /* NO min-height — let content dictate page height to avoid blank pages */
    position: relative;
  }

  /* Page 2+ flows naturally to avoid blank pages if previous page spills over */
  .maint-page  { padding-top: 28px; }
  .quote-page  { padding-top: 28px; }

  /* ══════════════════════════════════════════════════════════
     PAGE 1 — HEADER BAR
  ══════════════════════════════════════════════════════════ */

  /* Gradient header bar — leaves space for fixed logo on right */
  .header-bar {
    display: flex;
    align-items: center;
    justify-content: space-between;
    background: linear-gradient(135deg, #1C3048 0%, #2B4870 100%);
    padding: 16px 24px;
    margin-right: 160px;
    border-radius: 6px 0 48px 6px;
    margin-bottom: 22px;
  }
  .header-title { color: #fff; font-size: 21px; font-weight: 800; letter-spacing: 0.3px; }
  .header-id    { color: #F97316; font-size: 16px; font-weight: 700; letter-spacing: 1.5px; }

  /* ══════════════════════════════════════════════════════════
     INFO GRID — 4 columns
  ══════════════════════════════════════════════════════════ */

  .info-grid {
    display: flex;
    flex-wrap: wrap;
    gap: 10px;
    margin-bottom: 24px;
  }
  .info-card {
    flex: 1;
    min-width: 130px;
    background: #F7F9FC;
    border: 1px solid #E2E8F0;
    border-top: 3px solid #E2E8F0;
    border-radius: 6px;
    padding: 12px 14px;
  }
  .info-card.ic-accent { border-top-color: #F97316; }
  .info-label { font-size: 10.5px; font-weight: 700; color: #94A3B8; text-transform: uppercase; letter-spacing: 0.4px; margin-bottom: 5px; }
  .info-val   { font-size: 12.5px; color: #1e293b; line-height: 1.55; }

  /* ══════════════════════════════════════════════════════════
     SECTION BARS
  ══════════════════════════════════════════════════════════ */

  .section-bar {
    border-left: 4px solid #F97316;
    background: #F7F9FC;
    padding: 9px 14px;
    font-size: 13px;
    font-weight: 700;
    color: #1C3048;
    margin-bottom: 0;
    border-radius: 0 4px 4px 0;
  }

  /* Gradient bar for maintenance page title */
  .maint-section-bar {
    background: linear-gradient(135deg, #1C3048 0%, #2B4870 100%);
    border-left: 4px solid #F97316;
    color: #fff;
    padding: 10px 16px;
    font-size: 14px;
    font-weight: 700;
    margin-bottom: 8px;
    border-radius: 0 4px 4px 0;
  }

  /* ══════════════════════════════════════════════════════════
     SCOPE OF WORKS
  ══════════════════════════════════════════════════════════ */

  .scope-body { background: #FAFBFC; border: 1px solid #E2E8F0; border-top: none; padding: 12px 16px 16px; margin-bottom: 20px; border-radius: 0 0 4px 4px; }
  .scope-list { list-style: none; padding: 0; margin: 0; }
  .scope-list li { font-size: 12.5px; color: #475569; padding: 4px 0; line-height: 1.6; border-bottom: 1px solid #F0F4F8; }
  .scope-list li:last-child { border-bottom: none; }

  /* ══════════════════════════════════════════════════════════
     DEFECT LEGEND
  ══════════════════════════════════════════════════════════ */

  .legend { margin-bottom: 22px; border-radius: 6px; overflow: hidden; border: 1px solid #E2E8F0; }
  .legend-row { display: flex; align-items: stretch; }
  .legend-row + .legend-row { border-top: 1px solid #E2E8F0; }
  .legend-count { width: 48px; padding: 10px 4px; text-align: center; font-weight: 900; font-size: 16px; color: #fff; flex-shrink: 0; }
  .legend-title { width: 200px; padding: 10px 14px; font-weight: 700; font-size: 11.5px; color: #fff; flex-shrink: 0; display: flex; align-items: center; }
  .legend-desc  { flex: 1; padding: 10px 14px; font-size: 11.5px; background: #FAFBFC; color: #475569; display: flex; align-items: center; }
  .lgd-crit { background: #DC2626; }
  .lgd-maj  { background: #D97706; }
  .lgd-min  { background: #CA8A04; }
  .lgd-rec  { background: #0EA5E9; }
  .lgd-inf  { background: #6366F1; }

  /* ══════════════════════════════════════════════════════════
     SERVICING SUMMARY TABLE
  ══════════════════════════════════════════════════════════ */

  .table-header {
    display: flex;
    padding: 8px 14px;
    background: #F0F4F8;
    border-bottom: 2px solid #D1D9E6;
    font-size: 11px;
    font-weight: 700;
    color: #1C3048;
    margin-top: 0;
    text-transform: uppercase;
    letter-spacing: 0.3px;
  }
  .table-row {
    display: flex;
    padding: 9px 14px;
    border-bottom: 1px solid #F0F4F8;
    align-items: flex-start;
    font-size: 12.5px;
  }
  .table-row:nth-child(even) { background: #FAFBFD; }
  .table-row:last-child { border-bottom: none; }

  /* Column widths for summary table */
  .col-service { flex: 2.2; padding-right: 8px; color: #334155; }
  .col-asset   { flex: 1.8; padding-right: 8px; color: #334155; }
  .col-qty     { width: 70px; text-align: right; font-weight: 700; color: #F97316; }

  /* Column widths for quote table */
  .col-no      { width: 34px; color: #64748B; }
  .col-desc    { flex: 2; padding-right: 8px; }
  .col-qty-sm  { width: 50px; text-align: center; }
  .col-unit    { width: 80px; text-align: right; }
  .col-total   { width: 80px; text-align: right; font-weight: 600; }

  /* Grand total row */
  .grand-total-row {
    display: flex;
    justify-content: flex-end;
    align-items: center;
    gap: 16px;
    padding: 10px 14px;
    border-top: 2px solid #E2E8F0;
    margin-top: 4px;
    background: #F7F9FC;
  }
  .grand-total-label { font-weight: 700; font-size: 12.5px; color: #1a1a1a; }
  .grand-total-val   { font-weight: 800; font-size: 14px; color: #059669; min-width: 80px; text-align: right; }

  /* Technician row */
  .tech-row   { margin-top: 16px; padding: 10px 14px; background: #FFF5EB; border-left: 3px solid #F97316; border-radius: 0 4px 4px 0; font-size: 12px; }
  .tech-label { color: #94A3B8; font-weight: 600; margin-right: 8px; }
  .tech-name  { color: #1C3048; font-weight: 700; }

  /* ══════════════════════════════════════════════════════════
     MAINTENANCE — Asset groups & rows
  ══════════════════════════════════════════════════════════ */

  .group-header {
    display: flex;
    align-items: center;
    background: #F0F4F8;
    border-left: 4px solid #F97316;
    padding: 8px 14px;
    font-weight: 700;
    font-size: 12.5px;
    color: #1C3048;
    margin-top: 16px;
    border-radius: 0 4px 4px 0;
  }

  /* Column header row for Asset | Status */
  .col-row {
    display: flex;
    justify-content: space-between;
    padding: 6px 14px;
    border-bottom: 1.5px solid #D1D9E6;
    font-size: 11px;
    font-weight: 700;
    color: #94A3B8;
    text-transform: uppercase;
    letter-spacing: 0.3px;
  }
  .col-asset-hd  { flex: 1; }
  .col-status-hd { width: 140px; text-align: right; }

  /* Individual asset block */
  .asset-block { border-bottom: 1px solid #F0F4F8; padding: 11px 14px; }
  .asset-block:last-of-type { border-bottom: none; }

  /* Asset row: ref + type on left | pill + photo on right */
  .asset-row  { display: flex; justify-content: space-between; align-items: flex-start; }
  .asset-left { flex: 1; padding-right: 16px; }
  .asset-ref  { font-weight: 700; font-size: 12.5px; color: #1C3048; }
  .asset-loc  {
    display: inline-block;
    font-size: 11.5px;
    color: #94A3B8;
    margin-left: 12px;
  }
  .asset-right {
    width: 140px;
    display: flex;
    flex-direction: column;
    align-items: flex-end;
    gap: 6px;
  }

  /* ── PASS / FAIL / N/T pills — soft badge style ── */
  .pill {
    display: inline-block;
    padding: 3px 12px;
    border-radius: 20px;
    font-size: 10.5px;
    font-weight: 700;
    letter-spacing: 1px;
    text-transform: uppercase;
    min-width: 54px;
    text-align: center;
  }
  .pill-pass { background: #D1FAE5; color: #065F46; border: 1px solid #6EE7B7; }
  .pill-fail { background: #FEE2E2; color: #991B1B; border: 1px solid #FCA5A5; }
  .pill-nt   { background: #F1F5F9; color: #64748B; border: 1px solid #CBD5E1; }

  /* ── Photos ── */
  .photo-grid    { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 10px; }
  .photo-wrap    { display: flex; flex-direction: column; align-items: center; }
  .photo-thumb   { width: 110px; height: 110px; object-fit: cover; border: 2px solid #E2E8F0; display: block; border-radius: 6px; background-color: #f8fafc; }
  .photo-inline  { width: 140px; height: 140px; object-fit: cover; border: 2px solid #E2E8F0; display: block; border-radius: 6px; background-color: #f8fafc; }
  .photo-defect  { width: 100%; max-width: 460px; aspect-ratio: 4/3; max-height: 320px; object-fit: cover; border: 2px solid #E2E8F0; display: block; border-radius: 6px; background-color: #f8fafc; }
  .photo-caption { font-size: 9px; color: #94A3B8; margin-top: 4px; text-align: center; }

  /* ── Defect box — full border card ── */
  .defect-box {
    margin-top: 10px;
    padding: 12px 14px;
    border: 1.5px solid #D97706;
    border-top-width: 3px;
    background: #FFFBF5;
    border-radius: 6px;
    font-size: 12.5px;
  }
  .db-crit { border-color: #DC2626; background: #FFF5F5; }
  .db-min  { border-color: #CA8A04; background: #FEFCE8; }
  .db-maj  { border-color: #D97706; background: #FFFBF5; }

  .defect-header {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    margin-bottom: 10px;
    padding-bottom: 8px;
    border-bottom: 1px solid #F0E8D8;
  }
  .db-crit .defect-header { border-bottom-color: #FEC2C2; }
  .db-min  .defect-header { border-bottom-color: #FDE68A; }

  .defect-type  { font-weight: 700; font-size: 12px; color: #D97706; text-transform: uppercase; letter-spacing: 0.3px; }
  .db-crit .defect-type { color: #DC2626; }
  .db-min  .defect-type { color: #CA8A04; }

  .defect-id    { font-size: 11px; color: #94A3B8; margin-top: 3px; font-family: monospace; }

  .defect-dates { font-size: 11px; color: #94A3B8; text-align: right; line-height: 1.7; flex-shrink: 0; margin-left: 14px; }

  .defect-field { margin-bottom: 7px; font-size: 12.5px; line-height: 1.55; }
  .defect-field strong { color: #1C3048; }

  .actioned-badge {
    display: inline-block;
    background: #059669;
    color: #fff;
    font-weight: 700;
    font-size: 10px;
    padding: 2px 8px;
    border-radius: 20px;
    letter-spacing: 0.5px;
    margin-left: 6px;
  }

  /* ══════════════════════════════════════════════════════════
     SIGNATURES
  ══════════════════════════════════════════════════════════ */

  .sig-area  { display: flex; gap: 20px; margin-top: 36px; }
  .sig-block {
    flex: 1;
    background: #F7F9FC;
    border: 1px solid #E2E8F0;
    border-radius: 6px;
    padding: 14px;
  }
  .sig-pad   {
    border-bottom: 2px solid #D1D9E6;
    height: 80px;
    display: flex;
    align-items: flex-end;
    padding-bottom: 6px;
    margin-bottom: 8px;
  }
  .sig-typed { font-family: 'Times New Roman', serif; font-size: 22px; font-style: italic; color: #1C3048; }
  .sig-img   { max-width: 100%; max-height: 80px; object-fit: contain; }
  .sig-empty { font-size: 12px; color: #D1D9E6; }
  .sig-label { font-size: 10px; color: #94A3B8; text-transform: uppercase; letter-spacing: 0.5px; font-weight: 700; }
`;

// ─────────────────────────────────────────────────────────────
// Main builder
// ─────────────────────────────────────────────────────────────

export function buildReportHtml(data: ReportData): string {
  const { approvedQuote, quoteItems, inventory, reportId, job } = data;

  const page1Html   = buildPage1Html(data);
  const maintHtml   = buildMaintenancePage(data);

  const quoteHtml   =
    approvedQuote && quoteItems?.length && inventory
      ? buildQuotePageHtml(approvedQuote, quoteItems, inventory)
      : '';

  // BUG FIX: job is a flat SQL JOIN row — job.property does NOT exist.
  // Use the same flat-column aliases that getJobById always returns.
  const j = job as any;
  const propertyName = j.property_name ?? reportId;

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Service Report — ${propertyName}</title>
  <style>${REPORT_CSS}</style>
</head>
<body>

  ${fixedLogoHtml()}
  ${fixedFooterHtml()}

  ${page1Html}
  ${maintHtml}
  ${quoteHtml}

</body>
</html>`;
}
