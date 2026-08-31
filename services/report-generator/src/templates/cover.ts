import { BASE_STYLE, COLORS } from './theme';
import { esc, fmtDate, infoCell } from './helpers';
import { groupByCategory } from '../data/categoryGrouping';
import { ReportData, Property } from '../types';
import { AssetTypeDefinition } from '../types';

/**
 * Hazard/access/site notes were previously fetched (property:properties(*)
 * in fetchReportData.ts) but never rendered anywhere — a technician could see
 * a hazard warning in the app before starting the job, but the printed
 * report handed to the client never mentioned it. Hazard gets the most
 * prominent (red) treatment since it's safety-relevant; access and the
 * general site note are informational.
 */
function renderSiteNotes(property: Property | null | undefined): string {
  if (!property) return '';
  const rows: string[] = [];
  if (property.hazard_notes) {
    rows.push(`
      <div style="display:flex;gap:8px;padding:10px 12px;background:${COLORS.RED_BG};border:1px solid ${COLORS.RED_BORDER};border-radius:8px;margin-top:10px">
        <div style="font-weight:800;color:${COLORS.RED_TEXT_DARK};font-size:10px;text-transform:uppercase;flex-shrink:0">&#9888; Site Hazard</div>
        <div style="color:${COLORS.RED_TEXT_DARK};font-size:10.5px">${esc(property.hazard_notes)}</div>
      </div>`);
  }
  if (property.access_notes) {
    rows.push(`
      <div style="display:flex;gap:8px;padding:10px 12px;background:${COLORS.AMBER_BG};border:1px solid ${COLORS.AMBER_BORDER};border-radius:8px;margin-top:10px">
        <div style="font-weight:800;color:${COLORS.AMBER_TEXT};font-size:10px;text-transform:uppercase;flex-shrink:0">Access</div>
        <div style="color:${COLORS.AMBER_TEXT};font-size:10.5px">${esc(property.access_notes)}</div>
      </div>`);
  }
  if (property.site_note) {
    rows.push(`
      <div style="display:flex;gap:8px;padding:10px 12px;background:${COLORS.GREEN_BG};border:1px solid ${COLORS.GREEN_BORDER};border-radius:8px;margin-top:10px">
        <div style="font-weight:800;color:${COLORS.GREEN_TEXT_DARK};font-size:10px;text-transform:uppercase;flex-shrink:0">Site Note</div>
        <div style="color:${COLORS.GREEN_TEXT_DARK};font-size:10.5px">${esc(property.site_note)}</div>
      </div>`);
  }
  return rows.join('');
}

/**
 * Cover page. Adapted from the reference report's grid to fields SiteTrack
 * actually has — there's no "Client"/"Task"/"Authorisation ref" concept in this
 * schema, so we use Property / Site Contact / Job Reference / Date of Service
 * instead of inventing data that doesn't exist.
 *
 * The severity summary shows AS1851-2012 Clause 1.5.6's three real
 * classifications — critical defect / non-critical defect / non-conformance —
 * rather than the reference's 5 tiles; "recommendation"/"informational" aren't
 * concepts this app tracks, and fabricating zero-filled tiles for them would
 * misrepresent the data.
 */
export function renderCover(
  data: ReportData,
  assetTypesByValue: Map<string, AssetTypeDefinition>,
): string {
  const { job, company, assets, defects, reportId, dateOfService } = data;
  const property = job.property;

  const severityCounts = { critical: 0, non_critical: 0, non_conformance: 0 };
  for (const d of defects) severityCounts[d.severity]++;

  const categoryGroups = groupByCategory(
    assets,
    (a) => a.asset_type,
    assetTypesByValue,
  );

  const scopeRows = categoryGroups
    .map((g) => `<li>${esc(g.label)} (${g.items.length})</li>`)
    .join('');

  // Servicing summary: category -> asset type -> quantity
  const servicingRows = categoryGroups
    .flatMap((g) => {
      const byType = new Map<string, number>();
      for (const a of g.items) byType.set(a.asset_type, (byType.get(a.asset_type) ?? 0) + 1);
      return [...byType.entries()].map(
        ([type, qty]) => `
          <tr>
            <td>${esc(g.label)}</td>
            <td>${esc(assetTypesByValue.get(type)?.full_label ?? type)}</td>
            <td style="text-align:right">${qty}</td>
          </tr>`,
      );
    })
    .join('');

  const tiles = [
    { label: 'Critical Defects', count: severityCounts.critical, color: COLORS.SEVERITY.critical.text, bg: COLORS.SEVERITY.critical.bg },
    { label: 'Non-critical Defects', count: severityCounts.non_critical, color: COLORS.SEVERITY.non_critical.text, bg: COLORS.SEVERITY.non_critical.bg },
    { label: 'Non-conformances', count: severityCounts.non_conformance, color: COLORS.SEVERITY.non_conformance.text, bg: COLORS.SEVERITY.non_conformance.bg },
  ];

  return `<!DOCTYPE html>
<html><head><meta charset="utf-8" /><style>${BASE_STYLE}</style></head>
<body>
  <div class="page">
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:20px">
      <div style="display:flex;align-items:center;gap:10px">
        ${company.logo_url
          ? `<img src="${esc(company.logo_url)}" alt="" style="height:36px;width:auto;object-fit:contain" />`
          : ''}
        <div>
          <div style="font-size:18px;font-weight:900;color:${COLORS.NAVY}">${esc(company.name ?? 'Company Name')}</div>
          ${company.abn ? `<div style="font-size:9px;color:${COLORS.MUTED}">ABN: ${esc(company.abn)}</div>` : ''}
        </div>
      </div>
      <div style="text-align:right">
        <div style="font-size:16px;font-weight:800;color:${COLORS.ORANGE}">Service Report ${esc(reportId)}</div>
      </div>
    </div>

    <div class="section-bar">Job Details</div>
    <div class="card" style="display:flex">
      ${infoCell('Property', property?.name)}
      ${infoCell('Site Contact', property?.site_contact_name)}
      ${infoCell('Job Reference', reportId)}
      ${infoCell('Date of Service', fmtDate(dateOfService))}
    </div>

    ${renderSiteNotes(property)}

    <div class="section-bar" style="margin-top:18px">Scope of Works</div>
    <div class="card" style="padding:12px 16px">
      <ul style="margin:0;padding-left:18px">${scopeRows || '<li>No assets in scope</li>'}</ul>
    </div>

    <div style="display:flex;gap:10px;margin-top:16px">
      ${tiles.map((t) => `
        <div style="flex:1;background:${t.bg};border-radius:8px;padding:12px;text-align:center">
          <div style="font-size:22px;font-weight:900;color:${t.color}">${t.count}</div>
          <div style="font-size:9.5px;font-weight:700;color:${t.color}">${t.label}</div>
        </div>`).join('')}
    </div>

    <div class="section-bar" style="margin-top:18px">Servicing Summary</div>
    <table class="card">
      <thead><tr><th>Service</th><th>Asset</th><th style="text-align:right">Quantity</th></tr></thead>
      <tbody>${servicingRows || '<tr><td colspan="3">No assets recorded</td></tr>'}</tbody>
    </table>
  </div>
</body></html>`;
}
