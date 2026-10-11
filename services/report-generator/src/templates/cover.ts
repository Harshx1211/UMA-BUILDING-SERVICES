import { COLORS } from './theme';
import { esc, field, fmtDate } from './helpers';
import { groupByCategory } from '../data/categoryGrouping';
import { AssetTypeDefinition, Company, Property, ReportData } from '../types';

// SIZE: icons are drawn, not typed — the report font has no warning-sign or
// tick glyph, and either character pulled in a whole extra fallback font.
const warningIcon = (color: string) =>
  `<svg width="11" height="10" viewBox="0 0 11 10"><path d="M5.5 0.8 10.3 9.2H0.7Z" fill="none" stroke="${color}" stroke-width="1.2" stroke-linejoin="round"/><path d="M5.5 3.6V6" stroke="${color}" stroke-width="1.2" stroke-linecap="round"/><circle cx="5.5" cy="7.6" r="0.65" fill="${color}"/></svg>`;
const tickIcon = (color: string) =>
  `<svg width="10" height="10" viewBox="0 0 10 10"><path d="M1.5 5.3 4 7.8 8.7 2.3" fill="none" stroke="${color}" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg>`;

/**
 * Site notes on the cover. The hazard note gets the prominent red treatment
 * since it's safety-relevant. jobs.notes is this visit's "Field Notes" (the
 * mobile app's own label for the field) — neutral, since it's a note about
 * this visit rather than a standing fact about the site.
 *
 * Access notes and the general site note are deliberately NOT printed (owner's
 * decision, 2026-10-11) — they're working information for technicians and
 * stay in the app; only the safety-relevant hazard note goes on the report.
 */
function renderSiteNotes(property: Property | null | undefined, jobNotes: string | null): string {
  const rows: string[] = [];
  if (property?.hazard_notes) {
    rows.push(`
      <div class="banner" style="background:${COLORS.RED_BG};border-color:${COLORS.RED_BORDER};border-left-color:${COLORS.RED_TEXT};color:${COLORS.RED_TEXT_DARK}">
        ${warningIcon(COLORS.RED_TEXT_DARK)}
        <div><span class="banner-label">SITE HAZARD:</span><span class="pre">${esc(property.hazard_notes)}</span></div>
      </div>`);
  }
  if (jobNotes) {
    rows.push(`
      <div class="banner" style="background:${COLORS.SURFACE};border-color:${COLORS.BORDER};border-left-color:${COLORS.MUTED};color:${COLORS.SLATE}">
        <div><span class="banner-label" style="color:${COLORS.NAVY}">FIELD NOTES:</span><span class="pre">${esc(jobNotes)}</span></div>
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
): { text: string; color: string; bg: string; icon: string } {
  const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;
  const red = { color: COLORS.RED_TEXT_DARK, bg: COLORS.RED_BG, icon: warningIcon(COLORS.RED_TEXT_DARK) };
  const amber = { color: COLORS.AMBER_TEXT_DARK, bg: COLORS.AMBER_BG, icon: warningIcon(COLORS.AMBER_TEXT_DARK) };
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
    return { color: COLORS.SLATE, bg: COLORS.SURFACE, icon: '', text: `No defects recorded — ${plural(counts.notTested, 'asset', 'assets')} not tested` };
  }
  return { color: COLORS.GREEN_TEXT_DARK, bg: COLORS.GREEN_BG, icon: tickIcon(COLORS.GREEN_TEXT_DARK), text: 'All assets passed — no defects recorded' };
}

function tally(value: number, label: string, color: string): string {
  return `<div><div class="tally-n" style="color:${color}">${value}</div><div class="tally-l">${label}</div></div>`;
}

/** The company's logo, or — without one — a small mark of its initials. */
function brandMark(company: Company): string {
  if (company.logo_url) {
    return `<img src="${esc(company.logo_url)}" alt="" style="height:28px;width:auto;object-fit:contain" />`;
  }
  const initials = (company.name ?? '')
    .split(/\s+/)
    .map((word) => word.match(/[A-Za-z0-9]/)?.[0] ?? '')
    .filter(Boolean)
    .slice(0, 2)
    .join('')
    .toUpperCase();
  return initials ? `<div class="logo-initials">${esc(initials)}</div>` : '';
}

/**
 * Cover page. Uses the fields SiteTrack actually has — there's no
 * "Client"/"Task"/"Authorisation ref" concept in this schema, so it's
 * Property / Site Contact / Job Reference / Date of Service rather than
 * invented data.
 *
 * The defect figures are AS1851-2012 Clause 1.5.6's three real
 * classifications — critical defect / non-critical defect / non-conformance.
 * "Recommendation"/"informational" aren't concepts this app tracks, and
 * zero-filled figures for them would misrepresent the data.
 */
export function renderCover(
  data: ReportData,
  assetTypesByValue: Map<string, AssetTypeDefinition>,
): string {
  const { job, company, assets, defects, reportId, dateOfService } = data;
  const property = job.property;

  const severityCounts = { critical: 0, non_critical: 0, non_conformance: 0 };
  for (const d of defects) severityCounts[d.severity]++;

  const categoryGroups = groupByCategory(assets, (a) => a.asset_type, assetTypesByValue);

  // Scope of works: one row per category + asset type, with its quantity.
  const servicingRows = categoryGroups
    .flatMap((g) => {
      const byType = new Map<string, number>();
      for (const a of g.items) byType.set(a.asset_type, (byType.get(a.asset_type) ?? 0) + 1);
      return [...byType.entries()].map(
        ([type, qty]) => `
          <tr>
            <td>${esc(g.label)}</td>
            <td>${esc(assetTypesByValue.get(type)?.full_label ?? type)}</td>
            <td class="num">${qty}</td>
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
    <div class="title-row">
      <div style="display:flex;align-items:center;gap:8px">
        ${brandMark(company)}
        <div class="title">${esc(company.name ?? 'Company Name')}</div>
      </div>
      <div style="font-size:14px;font-weight:700;color:${COLORS.ORANGE}">Service Report ${esc(reportId)}</div>
    </div>

    <div class="panel fields keep" style="grid-template-columns:2fr 1fr 1fr 1fr">
      ${field('Property', property?.name, { strong: true, sub: addressLine })}
      ${field('Site Contact', property?.site_contact_name)}
      ${field('Job Reference', reportId, { strong: true })}
      ${field('Date of Service', fmtDate(dateOfService))}
    </div>

    ${renderSiteNotes(property, job.notes)}

    <div class="section-bar" style="margin-top:16px">Inspection Summary</div>
    <div class="summary keep">
      <div class="status-line" style="background:${status.bg};color:${status.color}">${status.icon}${esc(status.text)}</div>
      <div class="tally">
        ${tally(assets.length, 'Total assets', COLORS.NAVY)}
        ${tally(resultCounts.pass, 'Passed', COLORS.GREEN_TEXT)}
        ${tally(resultCounts.fail, 'Failed', COLORS.RED_TEXT)}
        ${tally(resultCounts.notTested, 'Not tested', COLORS.MUTED)}
        ${tally(severityCounts.critical, 'Critical defects', COLORS.SEVERITY.critical.accent)}
        ${tally(severityCounts.non_critical, 'Non-critical', COLORS.SEVERITY.non_critical.accent)}
        ${tally(severityCounts.non_conformance, 'Non-conformances', COLORS.SEVERITY.non_conformance.accent)}
      </div>
    </div>

    <div class="section-bar" style="margin-top:16px">Scope of Works</div>
    <table>
      <thead><tr><th style="width:45%">Service</th><th>Asset</th><th style="width:10%;text-align:right">Quantity</th></tr></thead>
      <tbody>${servicingRows || '<tr><td colspan="3">No assets recorded</td></tr>'}</tbody>
    </table>
  </div>`;
}
