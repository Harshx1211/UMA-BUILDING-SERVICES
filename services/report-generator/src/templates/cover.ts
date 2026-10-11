import { COLORS } from './theme';
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
 *
 * FIX: jobs.notes — the "Field Notes" a technician types on the job's own
 * detail screen ("Document site conditions, access details, or follow-up
 * actions…") — had the exact same bug. fetchReportData.ts's `select('*', ...)`
 * on jobs always included it in ReportData.job.notes (it's right there in
 * types.ts's own Job interface), but nothing in any template ever read it —
 * a technician could type real field notes, regenerate the report, and never
 * see them anywhere in the PDF, with no error to explain why. Labelled "Field
 * Notes" here to match the mobile app's own label for this exact field, and
 * given a distinct (neutral/slate) treatment from the three property-level
 * notes above it — this one is this specific visit's own note, not a
 * standing fact about the site.
 */
// Access notes and the general site note are deliberately NOT printed (owner's
// decision, 2026-10-11) — they're working information for technicians and
// stay in the app; only the safety-relevant hazard note goes on the report.
function renderSiteNotes(property: Property | null | undefined, jobNotes: string | null): string {
  const rows: string[] = [];
  if (property?.hazard_notes) {
    rows.push(`
      <div style="display:flex;gap:8px;padding:10px 12px;background:${COLORS.RED_BG};border:1px solid ${COLORS.RED_BORDER};border-radius:8px;margin-top:10px">
        <div style="font-weight:800;color:${COLORS.RED_TEXT_DARK};font-size:10px;text-transform:uppercase;flex-shrink:0">&#9888; Site Hazard</div>
        <div style="color:${COLORS.RED_TEXT_DARK};font-size:10.5px;white-space:pre-line">${esc(property.hazard_notes)}</div>
      </div>`);
  }
  if (jobNotes) {
    rows.push(`
      <div style="display:flex;gap:8px;padding:10px 12px;background:${COLORS.SURFACE};border:1px solid ${COLORS.BORDER};border-radius:8px;margin-top:10px">
        <div style="font-weight:800;color:${COLORS.SLATE};font-size:10px;text-transform:uppercase;flex-shrink:0">Field Notes</div>
        <div style="color:${COLORS.BLACK};font-size:10.5px;white-space:pre-line">${esc(jobNotes)}</div>
      </div>`);
  }
  return rows.join('');
}

/**
 * The one-line answer a building manager looks for first. Worded around what
 * was RECORDED on this visit, never as a compliance certification — that's
 * the Yearly Condition Report's formal statement, not a cover-page banner.
 */
function overallStatus(
  counts: { fail: number; notTested: number },
  severity: { critical: number; non_critical: number; non_conformance: number },
): { text: string; color: string; bg: string; border: string } {
  const red = { color: COLORS.RED_TEXT_DARK, bg: COLORS.SEVERITY.critical.bg, border: COLORS.RED_BORDER };
  const amber = { color: COLORS.AMBER_TEXT, bg: COLORS.AMBER_BG, border: COLORS.AMBER_BORDER };
  const green = { color: COLORS.GREEN_TEXT_DARK, bg: '#F0FDF4', border: COLORS.GREEN_BORDER };
  const slate = { color: COLORS.SLATE, bg: COLORS.SURFACE, border: COLORS.BORDER };
  const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;
  if (severity.critical > 0) {
    return { ...red, text: `Action required — ${plural(severity.critical, 'critical defect', 'critical defects')} recorded` };
  }
  if (counts.fail > 0 || severity.non_critical > 0) {
    const n = severity.non_critical || counts.fail;
    return { ...amber, text: `Repairs recommended — ${plural(n, 'defect', 'defects')} recorded` };
  }
  if (severity.non_conformance > 0) {
    return { ...amber, text: `${plural(severity.non_conformance, 'non-conformance', 'non-conformances')} noted — no defects recorded` };
  }
  if (counts.notTested > 0) {
    return { ...slate, text: `No defects recorded — ${plural(counts.notTested, 'asset', 'assets')} not tested` };
  }
  return { ...green, text: 'All assets passed — no defects recorded' };
}

function statTile(value: number, label: string, color: string, bg: string): string {
  return `
    <div style="flex:1;background:${bg};border-radius:8px;padding:10px 12px;text-align:center">
      <div style="font-size:20px;font-weight:900;color:${color};line-height:1.1">${value}</div>
      <div style="font-size:9px;font-weight:700;color:${color};text-transform:uppercase;letter-spacing:0.4px;margin-top:2px">${label}</div>
    </div>`;
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

  const resultCounts = { pass: 0, fail: 0, notTested: 0 };
  for (const a of assets) {
    if (a.result === 'pass') resultCounts.pass++;
    else if (a.result === 'fail') resultCounts.fail++;
    else resultCounts.notTested++;
  }
  const status = overallStatus(resultCounts, severityCounts);

  const addressLine = [property?.address, property?.suburb, property?.state, property?.postcode]
    .filter(Boolean)
    .join(', ');

  return `
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
      <div style="flex:1.6;padding:12px 14px;border-right:1px solid ${COLORS.BORDER}">
        <div style="font-size:8.5px;font-weight:700;color:${COLORS.MUTED};text-transform:uppercase;letter-spacing:0.5px;margin-bottom:4px">Property</div>
        <div style="font-size:11px;font-weight:600">${esc(property?.name) || '—'}</div>
        ${addressLine ? `<div style="font-size:9.5px;color:${COLORS.SLATE};margin-top:2px">${esc(addressLine)}</div>` : ''}
      </div>
      ${infoCell('Site Contact', property?.site_contact_name)}
      ${infoCell('Job Reference', reportId)}
      ${infoCell('Date of Service', fmtDate(dateOfService))}
    </div>

    ${renderSiteNotes(property, job.notes)}

    <div class="section-bar" style="margin-top:18px">Inspection Summary</div>
    <div class="card" style="padding:14px 16px">
      <div style="padding:9px 12px;border-radius:8px;background:${status.bg};border:1px solid ${status.border};color:${status.color};font-weight:800;font-size:11px">
        ${esc(status.text)}
      </div>
      <div style="display:flex;gap:8px;margin-top:12px">
        ${statTile(assets.length, 'Assets inspected', COLORS.NAVY, COLORS.BORDER_LIGHT)}
        ${statTile(resultCounts.pass, 'Passed', COLORS.GREEN_TEXT, '#F0FDF4')}
        ${statTile(resultCounts.fail, 'Failed', COLORS.RED_TEXT, COLORS.SEVERITY.critical.bg)}
        ${statTile(resultCounts.notTested, 'Not tested', COLORS.SLATE, COLORS.SURFACE)}
      </div>
      <div style="display:flex;gap:8px;margin-top:8px">
        ${statTile(severityCounts.critical, 'Critical defects', COLORS.SEVERITY.critical.text, COLORS.SEVERITY.critical.bg)}
        ${statTile(severityCounts.non_critical, 'Non-critical defects', COLORS.SEVERITY.non_critical.text, COLORS.SEVERITY.non_critical.bg)}
        ${statTile(severityCounts.non_conformance, 'Non-conformances', COLORS.SEVERITY.non_conformance.text, COLORS.SEVERITY.non_conformance.bg)}
      </div>
    </div>

    <!-- FIX: a bulleted "Scope of Works" list used to sit above a "Servicing
         Summary" table listing the same services again — one table now. -->
    <div class="section-bar" style="margin-top:18px">Scope of Works</div>
    <table class="card">
      <thead><tr><th>Service</th><th>Asset</th><th style="text-align:right">Quantity</th></tr></thead>
      <tbody>${servicingRows || '<tr><td colspan="3">No assets recorded</td></tr>'}</tbody>
    </table>
  </div>`;
}
