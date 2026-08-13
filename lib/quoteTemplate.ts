import type { JoinedJob, Defect } from '@/types';

export interface QuoteReportData {
  job: JoinedJob;
  defects: Defect[];
  total_amount: number;
  reportId: string;
  company?: Record<string, string | null | undefined>;
}

function fmtDateShort(iso: string | null | undefined): string {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleDateString('en-AU', {
      day: 'numeric', month: 'short', year: 'numeric',
    });
  } catch { return iso; }
}

function fmtCurrency(v: number | string): string {
  const n = parseFloat(String(v));
  return isNaN(n) ? '$0.00' : `$${n.toFixed(2)}`;
}

function shortId(id: string, len = 5): string {
  return id.replace(/-/g, '').substring(0, len).toUpperCase();
}

const CSS = `
@page { margin: 0; size: A4 }
*, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
body {
  font-family: 'Inter', Helvetica Neue, Helvetica, Arial, sans-serif;
  color: #1E293B;
  line-height: 1.5;
  font-size: 11px;
  background: #fff;
}
.nb { page-break-inside: avoid; break-inside: avoid; }

.section {
  padding: 28px 32px 70px 32px;
  page-break-before: always;
  break-before: page;
  box-sizing: border-box;
}
.section.first { page-break-before: auto; break-before: auto; }

.brand-bar {
  display: flex; align-items: center; justify-content: space-between;
  margin-bottom: 20px;
}
.brand-logo { display: flex; align-items: center; gap: 10px; }
.brand-diamond {
  width: 36px; height: 36px; background: #E97316; transform: rotate(45deg);
  border-radius: 4px; display: flex; align-items: center; justify-content: center; flex-shrink: 0;
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

.sec-bar {
  background: #1C3048; color: #fff; font-size: 10px; font-weight: 800;
  letter-spacing: 1.2px; text-transform: uppercase; padding: 7px 14px;
  border-radius: 4px 4px 0 0; border-left: 4px solid #E97316; margin-top: 18px;
  page-break-after: avoid; break-after: avoid;
}
.sec-bar.first { margin-top: 0; }

.info-grid {
  display: flex; border: 1px solid #E2E8F0; border-top: none;
  border-radius: 0 0 6px 6px; overflow: hidden; margin-bottom: 20px;
}
.info-cell { flex: 1; padding: 12px 14px; border-right: 1px solid #E2E8F0; background: #FAFBFD; }
.info-cell:last-child { border-right: none; }
.info-cell.accent { border-top: 3px solid #E97316; background: #FFFBF7; }
.info-label { font-size: 8.5px; font-weight: 700; color: #94A3B8; text-transform: uppercase; letter-spacing: 0.6px; margin-bottom: 5px; }
.info-val   { font-size: 11px; color: #1E293B; font-weight: 600; line-height: 1.5; }
.info-val.muted { color: #64748B; font-weight: 400; }

.tbl-wrap {
  border: 1px solid #E2E8F0; border-top: none;
  border-radius: 0 0 6px 6px; overflow: hidden;
}
.group-hdr {
  display: flex; align-items: center; background: #F8FAFC;
  border-bottom: 1px solid #E2E8F0; padding: 8px 14px;
  font-weight: 800; font-size: 11px; color: #1C3048;
}
.group-hdr.crit { border-left: 4px solid #DC2626; }
.group-hdr.maj { border-left: 4px solid #D97706; }
.group-hdr.min { border-left: 4px solid #CA8A04; }

.t-row {
  display: flex; padding: 9px 14px; border-bottom: 1px solid #F1F5F9;
  align-items: center; font-size: 11px;
}
.t-row:nth-child(even) { background: #FAFBFD; }
.t-row:last-child { border-bottom: none; }
.c-desc { flex: 1; padding-right: 8px; color: #334155; }
.c-id { width: 60px; color: #94A3B8; font-family: monospace; font-size: 9px; }
.c-price { width: 80px; text-align: right; color: #1E293B; font-weight: 600; }

.totals-row {
  display: flex; justify-content: flex-end; align-items: center; gap: 16px;
  padding: 8px 14px; background: #F7F9FC; border-top: 1px solid #E2E8F0;
  font-size: 11px; color: #475569;
}
.totals-row.grand {
  border-top: 2px solid #E2E8F0; background: #F0FDF4; padding: 12px 14px;
}
.grand-lbl { font-weight: 700; font-size: 12px; color: #1E293B; text-transform: uppercase; }
.grand-val { font-weight: 900; font-size: 15px; color: #059669; min-width: 80px; text-align: right; }
`;

function logoHtml(reportNum: string, company: Record<string, string | null | undefined> | undefined): string {
  const name = company?.name || 'Company Name';
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
        <span style="color: #94A3B8; font-weight: 600;">Quotation</span> ${reportNum}
      </div>
      <div class="brand-reportlbl">Service Quote</div>
    </div>
  </div>`;
}

// footer is now stamped by pdf-lib post-processing — no HTML footer needed here.

export function generateQuoteHtml(data: QuoteReportData): string {
  const { job, defects, total_amount, reportId } = data;
  
  const propName    = job.property_name    ?? '—';
  const address     = [job.property_address, job.property_suburb, job.property_state, job.property_postcode].filter(Boolean).join(', ');
  const siteContact = job.site_contact_name ?? 'Not provided';
  const refNum      = shortId(job.id, 6);
  const dateStr     = fmtDateShort(new Date().toISOString());

  const crit = defects.filter(d => d.severity === 'critical');
  const maj  = defects.filter(d => d.severity === 'major');
  const min  = defects.filter(d => d.severity === 'minor');

  const renderGroup = (title: string, items: Defect[], cls: string) => {
    if (items.length === 0) return '';
    const rows = items.map(d => `
      <div class="t-row">
        <div class="c-id">${shortId(d.id, 5)}</div>
        <div class="c-desc">${d.description || 'Defect remediation'}</div>
        <div class="c-price">${fmtCurrency(d.quote_price || 0)}</div>
      </div>
    `).join('');
    
    return `
      <div class="group-hdr ${cls}">${title}</div>
      ${rows}
    `;
  };

  const gst = total_amount * 0.1;
  const grandTotal = total_amount + gst;

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>${CSS}</style>
</head>
<body>
  <div class="section first">
    ${logoHtml(shortId(reportId, 6), data.company)}

    <div class="nb">
      <div class="sec-bar first">Quotation Details</div>
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
          <div class="info-label">Job Reference</div>
          <div class="info-val">${refNum}</div>
        </div>
        <div class="info-cell accent">
          <div class="info-label">Quote Date</div>
          <div class="info-val">${dateStr}</div>
        </div>
      </div>
    </div>

    <div class="nb">
      <div class="sec-bar">Proposed Works</div>
      <div class="tbl-wrap">
        ${renderGroup('Immediate / Critical Repairs', crit, 'crit')}
        ${renderGroup('Major Defect Remediation', maj, 'maj')}
        ${renderGroup('Minor Defect Remediation', min, 'min')}
        
        ${defects.length === 0 ? '<div style="padding:20px;text-align:center;color:#64748B;font-size:12px;">No items in quote</div>' : ''}

        <div class="totals-row">
          <div>Subtotal (excl. GST)</div>
          <div style="min-width:80px;text-align:right;font-weight:600">${fmtCurrency(total_amount)}</div>
        </div>
        <div class="totals-row">
          <div>GST (10%)</div>
          <div style="min-width:80px;text-align:right">${fmtCurrency(gst)}</div>
        </div>
        <div class="totals-row grand">
          <div class="grand-lbl">Total Quote</div>
          <div class="grand-val">${fmtCurrency(grandTotal)}</div>
        </div>
      </div>
    </div>
  </div>
</body>
</html>`;
}
