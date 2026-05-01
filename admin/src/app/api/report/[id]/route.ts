import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const [{ data: p }, { data: assets }, { data: jobs }, { data: defects }] = await Promise.all([
    supabaseAdmin.from('properties').select('*').eq('id', id).single(),
    supabaseAdmin.from('assets').select('*').eq('property_id', id).order('asset_type'),
    supabaseAdmin.from('jobs').select('*, assigned_user:users(full_name)').eq('property_id', id).order('scheduled_date', { ascending: false }).limit(30),
    supabaseAdmin.from('defects').select('*, asset:assets(asset_type,location_on_site)').eq('property_id', id).order('created_at', { ascending: false }),
  ]);

  if (!p) return NextResponse.json({ error: 'Property not found' }, { status: 404 });

  const today = new Date().toISOString().split('T')[0];
  const isOverdue = p.next_inspection_date && p.next_inspection_date < today;
  const openDefects   = (defects ?? []).filter((d: any) => d.status === 'open' || d.status === 'quoted');

  const fmt = (d: string | null) => d ? new Date(d).toLocaleDateString('en-AU', { day: '2-digit', month: 'short', year: 'numeric' }) : '—';
  const cap = (s: string) => s ? s.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()) : '—';

  const sevColor: Record<string, string> = { critical: '#dc2626', major: '#ea580c', minor: '#d97706' };
  const statusColor: Record<string, string> = {
    active: '#16a34a', decommissioned: '#94a3b8',
    compliant: '#16a34a', non_compliant: '#dc2626', overdue: '#ea580c', pending: '#94a3b8',
    open: '#dc2626', quoted: '#d97706', repaired: '#16a34a', monitoring: '#3b82f6',
    scheduled: '#3b82f6', in_progress: '#f97316', completed: '#16a34a', cancelled: '#94a3b8',
    urgent: '#dc2626', high: '#ea580c', normal: '#3b82f6', low: '#94a3b8',
    draft: '#94a3b8', approved: '#16a34a', rejected: '#dc2626',
  };
  const badge = (v: string) =>
    `<span style="display:inline-block;padding:2px 10px;border-radius:999px;font-size:11px;font-weight:600;background:${statusColor[v] ?? '#94a3b8'}18;color:${statusColor[v] ?? '#94a3b8'};border:1px solid ${statusColor[v] ?? '#94a3b8'}33">${cap(v)}</span>`;

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<title>Site Report — ${p.name}</title>
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; font-size: 13px; color: #1e293b; background: #fff; }
  @page { size: A4; margin: 18mm 15mm; }
  @media print {
    .no-print { display: none !important; }
    body { print-color-adjust: exact; -webkit-print-color-adjust: exact; }
    .page-break { page-break-before: always; }
  }

  /* Print button */
  .print-bar { position: fixed; top: 0; left: 0; right: 0; background: #1B2D4F; padding: 12px 20px; display: flex; align-items: center; justify-between; gap: 12px; z-index: 100; }
  .print-bar p { color: #fff; font-size: 13px; font-weight: 600; flex: 1; }
  .print-btn { background: #F97316; color: #fff; border: none; border-radius: 8px; padding: 8px 20px; font-size: 13px; font-weight: 700; cursor: pointer; }
  .print-btn:hover { background: #ea580c; }
  .content { padding-top: 52px; }
  @media print { .print-bar { display: none; } .content { padding-top: 0; } }

  /* Layout */
  .page { max-width: 900px; margin: 0 auto; padding: 28px 24px; }

  /* Header */
  .header { display: flex; align-items: flex-start; justify-content: space-between; padding: 24px; background: linear-gradient(135deg, #1B2D4F 0%, #243a65 100%); border-radius: 12px; margin-bottom: 20px; color: #fff; }
  .header-logo { display: flex; align-items: center; gap: 10px; margin-bottom: 16px; }
  .header-logo-icon { width: 36px; height: 36px; background: #F97316; border-radius: 8px; display: flex; align-items: center; justify-content: center; font-size: 18px; }
  .header-logo-text { font-size: 15px; font-weight: 700; color: #fff; }
  .header-title { font-size: 22px; font-weight: 800; letter-spacing: -0.03em; }
  .header-sub { font-size: 13px; color: rgba(255,255,255,0.7); margin-top: 4px; }
  .header-meta { text-align: right; font-size: 12px; color: rgba(255,255,255,0.6); }
  .header-meta p { margin-bottom: 2px; }

  /* Stats row */
  .stats-row { display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px; margin-bottom: 20px; }
  .stat-card { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 10px; padding: 14px 16px; }
  .stat-value { font-size: 24px; font-weight: 800; color: #1e293b; letter-spacing: -0.04em; }
  .stat-label { font-size: 11px; color: #64748b; font-weight: 600; margin-top: 2px; text-transform: uppercase; letter-spacing: 0.05em; }
  .stat-card.danger .stat-value { color: #dc2626; }
  .stat-card.warning .stat-value { color: #ea580c; }
  .stat-card.success .stat-value { color: #16a34a; }

  /* Sections */
  .section { margin-bottom: 24px; }
  .section-title { font-size: 13px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.08em; color: #64748b; border-bottom: 2px solid #F97316; padding-bottom: 6px; margin-bottom: 14px; }
  .info-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 0; border: 1px solid #e2e8f0; border-radius: 10px; overflow: hidden; }
  .info-row { display: contents; }
  .info-label { background: #f8fafc; padding: 9px 14px; font-size: 11px; font-weight: 600; color: #64748b; text-transform: uppercase; letter-spacing: 0.05em; border-bottom: 1px solid #e2e8f0; }
  .info-value { padding: 9px 14px; font-size: 13px; color: #1e293b; border-bottom: 1px solid #e2e8f0; }
  .info-label:last-of-type, .info-value:last-of-type { border-bottom: none; }

  /* Table */
  table { width: 100%; border-collapse: collapse; border: 1px solid #e2e8f0; border-radius: 10px; overflow: hidden; }
  thead tr { background: #f8fafc; }
  th { padding: 9px 12px; text-align: left; font-size: 11px; font-weight: 700; color: #64748b; text-transform: uppercase; letter-spacing: 0.05em; border-bottom: 1px solid #e2e8f0; }
  td { padding: 9px 12px; font-size: 12px; color: #334155; border-bottom: 1px solid #f1f5f9; vertical-align: top; }
  tr:last-child td { border-bottom: none; }
  tr.overdue td { background: #fff7ed; }
  .mono { font-family: monospace; font-size: 11px; }
  .text-danger { color: #dc2626; font-weight: 600; }
  .text-warn { color: #ea580c; font-weight: 600; }

  /* Notes box */
  .notes-box { background: #fffbeb; border: 1px solid #fde68a; border-radius: 8px; padding: 10px 14px; font-size: 12px; color: #78350f; line-height: 1.5; }

  /* Footer */
  .footer { margin-top: 32px; padding-top: 14px; border-top: 1px solid #e2e8f0; display: flex; justify-content: space-between; font-size: 11px; color: #94a3b8; }
</style>
</head>
<body>
<div class="print-bar no-print">
  <p>📄 ${p.name} — Site Compliance Report</p>
  <button class="print-btn" onclick="window.print()">⬇ Download / Print PDF</button>
</div>
<div class="content">
<div class="page">

  <!-- Header -->
  <div class="header">
    <div>
      <div class="header-logo">
        <div class="header-logo-icon">⚡</div>
        <span class="header-logo-text">SiteTrack</span>
      </div>
      <div class="header-title">${p.name}</div>
      <div class="header-sub">${[p.address, p.suburb, p.state, p.postcode].filter(Boolean).join(' · ') || 'Address not specified'}</div>
      <div style="margin-top:10px">${badge(p.compliance_status)}</div>
    </div>
    <div class="header-meta">
      <p><strong style="color:#fff">Report Generated</strong></p>
      <p>${new Date().toLocaleDateString('en-AU', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}</p>
      <p style="margin-top:8px"><strong style="color:#fff">Report Time</strong></p>
      <p>${new Date().toLocaleTimeString('en-AU', { hour: '2-digit', minute: '2-digit' })}</p>
    </div>
  </div>

  <!-- Stats -->
  <div class="stats-row">
    <div class="stat-card">
      <div class="stat-value">${(assets ?? []).length}</div>
      <div class="stat-label">Total Assets</div>
    </div>
    <div class="stat-card ${isOverdue ? 'danger' : ''}">
      <div class="stat-value" style="font-size:16px; margin-top: 6px;">${p.next_inspection_date ? fmt(p.next_inspection_date) : 'Not Set'}</div>
      <div class="stat-label">Next Inspection</div>
    </div>
    <div class="stat-card ${openDefects.length > 0 ? 'warning' : ''}">
      <div class="stat-value">${openDefects.length}</div>
      <div class="stat-label">Open Defects</div>
    </div>
    <div class="stat-card success">
      <div class="stat-value">${(jobs ?? []).filter((j: any) => j.status === 'completed').length}</div>
      <div class="stat-label">Completed Jobs</div>
    </div>
  </div>

  <!-- Site Information -->
  <div class="section">
    <div class="section-title">Site Information</div>
    <div class="info-grid">
      <div class="info-label">Property Name</div><div class="info-value">${p.name}</div>
      <div class="info-label">Street Address</div><div class="info-value">${p.address || '—'}</div>
      <div class="info-label">Suburb</div><div class="info-value">${p.suburb || '—'}</div>
      <div class="info-label">State / Postcode</div><div class="info-value">${[p.state, p.postcode].filter(Boolean).join(' ') || '—'}</div>
      <div class="info-label">Site Contact</div><div class="info-value">${p.site_contact_name || '—'}</div>
      <div class="info-label">Contact Phone</div><div class="info-value">${p.site_contact_phone || '—'}</div>
      <div class="info-label">Compliance Status</div><div class="info-value">${badge(p.compliance_status)}</div>
      <div class="info-label">Created</div><div class="info-value">${fmt(p.created_at)}</div>
    </div>
  </div>

  ${p.access_notes || p.hazard_notes ? `
  <div class="section">
    <div class="section-title">Site Notes</div>
    ${p.access_notes ? `<div style="margin-bottom:8px"><p style="font-size:11px;font-weight:600;color:#64748b;margin-bottom:4px;text-transform:uppercase;letter-spacing:.05em">Access Notes</p><div class="notes-box">${p.access_notes}</div></div>` : ''}
    ${p.hazard_notes ? `<p style="font-size:11px;font-weight:600;color:#64748b;margin-bottom:4px;text-transform:uppercase;letter-spacing:.05em">Hazard Notes</p><div class="notes-box" style="background:#fef2f2;border-color:#fecaca;color:#7f1d1d">⚠ ${p.hazard_notes}</div>` : ''}
  </div>` : ''}

  <!-- Asset Register -->
  <div class="section page-break">
    <div class="section-title">Asset Register (${(assets ?? []).length} assets)</div>
    ${(assets ?? []).length === 0 ? '<p style="color:#94a3b8;font-size:13px">No assets registered at this property.</p>' : `
    <table>
      <thead>
        <tr>
          <th>Ref</th>
          <th>Asset Type</th>
          <th>Variant</th>
          <th>Location</th>
          <th>Serial #</th>
          <th>Install</th>
          <th>Last Service</th>
          <th>Status</th>
        </tr>
      </thead>
      <tbody>
        ${(assets ?? []).map((a: any) => {
          return `<tr>
            <td class="mono">${a.asset_ref ?? '—'}</td>
            <td><strong>${a.asset_type}</strong></td>
            <td style="color:#64748b">${a.variant ?? '—'}</td>
            <td>${a.location_on_site ?? '—'}</td>
            <td class="mono">${a.serial_number ?? '—'}</td>
            <td>${fmt(a.install_date)}</td>
            <td>${fmt(a.last_service_date)}</td>
            <td>${badge(a.status)}</td>
          </tr>`;
        }).join('')}
      </tbody>
    </table>`}
  </div>

  <!-- Defects -->
  <div class="section">
    <div class="section-title">Defects &amp; Remediation (${(defects ?? []).length} total)</div>
    ${(defects ?? []).length === 0 ? '<p style="color:#94a3b8;font-size:13px">No defects recorded.</p>' : `
    <table>
      <thead>
        <tr>
          <th>Description</th>
          <th>Asset</th>
          <th>Severity</th>
          <th>Status</th>
          <th>Reported</th>
        </tr>
      </thead>
      <tbody>
        ${(defects ?? []).map((d: any) => `<tr>
          <td>${d.description}</td>
          <td>${d.asset?.asset_type ?? '—'}${d.asset?.location_on_site ? `<br><span style="color:#94a3b8;font-size:11px">${d.asset.location_on_site}</span>` : ''}</td>
          <td>${badge(d.severity)}</td>
          <td>${badge(d.status)}</td>
          <td>${fmt(d.created_at)}</td>
        </tr>`).join('')}
      </tbody>
    </table>`}
  </div>

  <!-- Job History -->
  <div class="section">
    <div class="section-title">Job History (${(jobs ?? []).length} jobs)</div>
    ${(jobs ?? []).length === 0 ? '<p style="color:#94a3b8;font-size:13px">No jobs recorded.</p>' : `
    <table>
      <thead>
        <tr>
          <th>Date</th>
          <th>Type</th>
          <th>Technician</th>
          <th>Priority</th>
          <th>Status</th>
        </tr>
      </thead>
      <tbody>
        ${(jobs ?? []).map((j: any) => `<tr>
          <td>${fmt(j.scheduled_date)}</td>
          <td>${cap(j.job_type)}</td>
          <td>${j.assigned_user?.full_name ?? '—'}</td>
          <td>${badge(j.priority)}</td>
          <td>${badge(j.status)}</td>
        </tr>`).join('')}
      </tbody>
    </table>`}
  </div>

  <!-- Footer -->
  <div class="footer">
    <span>Generated by SiteTrack Admin Portal · ${new Date().toLocaleDateString('en-AU')}</span>
    <span>CONFIDENTIAL — For internal use only</span>
  </div>
</div>
</div>
</body>
</html>`;

  return new NextResponse(html, {
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'no-store',
    },
  });
}
