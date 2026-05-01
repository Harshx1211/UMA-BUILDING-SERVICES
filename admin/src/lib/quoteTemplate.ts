export interface QuoteReportData {
  job: any; // job with property, assigned_user, etc.
  defects: any[]; // list of defects with quote_price
  total_amount: number;
  reportId: string;
}

const CompanyConfig = {
  name: 'SiteTrack Services',
  addressLine1: '123 Safety Way',
  addressLine2: 'Sydney NSW 2000',
  abn: '12 345 678 901',
  website: 'www.sitetrack.com.au',
  contactPhone: '(02) 9876 5432',
  contactEmail: 'admin@sitetrack.com.au',
};

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
  font-family: Helvetica Neue, Helvetica, Arial, sans-serif;
  color: #1E293B;
  line-height: 1.5;
  font-size: 11px;
  background: #fff;
}
.nb { page-break-inside: avoid; break-inside: avoid; }

.footer {
  position: fixed; bottom: 0; left: 0; right: 0;
  height: 44px;
  background: #1C3048;
  padding: 0 28px;
  display: flex; align-items: center; justify-content: space-between;
  font-size: 8.5px; color: rgba(255,255,255,0.65);
  z-index: 1000;
}
.f-left { line-height: 1.6; }
.f-mid  { font-size: 9px; font-weight: 700; color: #E97316; text-align: center; white-space: nowrap; }
.f-right { text-align: right; line-height: 1.6; }
.page-num::after { content: counter(page); }

.page { padding: 28px 32px 60px 32px; position: relative; }

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

function logoHtml(reportNum: string): string {
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
      <div class="brand-reportnum">Quotation ${reportNum}</div>
      <div class="brand-reportlbl">Service Quote</div>
    </div>
  </div>`;
}

function footerHtml(): string {
  return `
  <div class="footer">
    <div class="f-left">
      <div>${CompanyConfig.name}</div>
      <div>${CompanyConfig.addressLine1}, ${CompanyConfig.addressLine2} &nbsp;|&nbsp; ABN: ${CompanyConfig.abn}</div>
    </div>
    <div class="f-mid">Page <span class="page-num"></span> of <span id="ftotal">…</span></div>
    <div class="f-right">
      <div>&#127758; ${CompanyConfig.website}</div>
      <div>&#9742; ${CompanyConfig.contactPhone} &nbsp;|&nbsp; &#64; ${CompanyConfig.contactEmail}</div>
    </div>
  </div>`;
}

function pageCountScript(): string {
  return `<script>
    window.addEventListener('load', function() {
      try {
        var pages = Math.max(1, Math.ceil(document.body.scrollHeight / 1123));
        var el = document.getElementById('ftotal');
        if (el) el.textContent = pages;
      } catch(e) {}
    });
  </script>`;
}

export function generateQuoteHtml(data: QuoteReportData): string {
  const { job, defects, total_amount, reportId } = data;
  
  const propName = job?.property?.name || '—';
  const address = [job?.property?.address, job?.property?.suburb, job?.property?.state, job?.property?.postcode].filter(Boolean).join(', ');
  const siteContact = job?.property?.site_contact_name || 'Not provided';
  const refNum = shortId(job?.id || 'Q', 6);
  const dateStr = fmtDateShort(new Date().toISOString());

  const crit = defects.filter(d => d.severity === 'critical');
  const maj  = defects.filter(d => d.severity === 'major');
  const min  = defects.filter(d => d.severity === 'minor');

  const renderGroup = (title: string, items: any[], cls: string) => {
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
  ${footerHtml()}
  <div class="page">
    ${logoHtml(shortId(reportId, 6))}

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
  ${pageCountScript()}
</body>
</html>`;
}
