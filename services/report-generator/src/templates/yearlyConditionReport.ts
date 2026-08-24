import { BASE_STYLE, COLORS } from './theme';
import { esc, fmtDate, infoCell } from './helpers';
import { groupByCategory, AS1851_SECTIONS } from '../data/categoryGrouping';
import { AssetTypeDefinition, ReportData } from '../types';

// AS1851 Appendix E's sample template uses a numeric "Type" column for the three
// Clause 1.5.6 classifications. The standard doesn't fix these numbers to a name
// beyond "1/2/3" — this orders them by severity (most severe first), matching how
// the classifications themselves are always listed. If you have the literal
// Appendix E sample to check this numbering against, flag it and this can be
// corrected in one place.
const TYPE_LABEL: Record<string, { type: number; label: string }> = {
  critical: { type: 1, label: 'Critical Defect' },
  non_critical: { type: 2, label: 'Non-critical Defect' },
  non_conformance: { type: 3, label: 'Non-conformance' },
};

/**
 * AS1851 Appendix E's Yearly Condition Report — a distinct compliance artifact
 * from the routine-service log (the asset-log/repairs/signoff pages are the
 * on-site visit record; this is the file-copy compliance summary Appendix E
 * requires, listing which essential safety measures were covered and every
 * defect/non-conformance found against them).
 *
 * "Period" here is a single service date, not a date range — SiteTrack visits
 * are per-job, so there's no multi-visit period to report. A deliberate
 * simplification versus the standard's own "Period" concept, not an oversight.
 */
export function renderYearlyConditionReport(
  data: ReportData,
  assetTypesByValue: Map<string, AssetTypeDefinition>,
): string {
  const { job, company, assets, defects, reportId, dateOfService, assignedUsers } = data;
  const property = job.property;

  const categoryGroups = groupByCategory(assets, (a) => a.asset_type, assetTypesByValue);
  const coveredSections = new Set(
    categoryGroups.map((g) => g.officialSection).filter((n): n is number => n != null),
  );

  const checklistRows = Object.entries(AS1851_SECTIONS)
    .map(([num, name]) => {
      const n = Number(num);
      const checked = coveredSections.has(n);
      return `
        <tr>
          <td style="width:30px">
            <span style="display:inline-block;width:14px;height:14px;border:1.5px solid ${COLORS.SLATE};border-radius:3px;text-align:center;line-height:13px;font-weight:900;color:${COLORS.GREEN_TEXT}">${checked ? '&#10003;' : ''}</span>
          </td>
          <td>Section ${n} &mdash; ${esc(name)}</td>
        </tr>`;
    })
    .join('');

  const assetsById = new Map(assets.map((a) => [a.id, a]));
  const defectRows = defects
    .map((d) => {
      const t = TYPE_LABEL[d.severity] ?? { type: 3, label: d.severity };
      const asset = d.asset_id ? assetsById.get(d.asset_id) : undefined;
      const section = asset?.categoryOfficialSection;
      return `
        <tr>
          <td style="text-align:center;font-weight:800">${t.type}</td>
          <td>${esc(t.label)}</td>
          <td>${section != null ? `Section ${section}` : '&mdash;'}</td>
          <td>${esc(d.description)}</td>
        </tr>`;
    })
    .join('');

  return `<!DOCTYPE html>
<html><head><meta charset="utf-8" /><style>${BASE_STYLE}</style></head>
<body><div class="page">
  <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px">
    <div style="font-size:16px;font-weight:900;color:${COLORS.NAVY}">Yearly Condition Report</div>
    <div style="font-size:9.5px;color:${COLORS.MUTED}">AS 1851-2012 Appendix E</div>
  </div>

  <div class="section-bar">Report Details</div>
  <div class="card" style="display:flex">
    ${infoCell('Report No.', reportId)}
    ${infoCell('Period', fmtDate(dateOfService))}
    ${infoCell('Site', property?.name)}
    ${infoCell('Address', [property?.address, property?.suburb, property?.state, property?.postcode].filter(Boolean).join(', '))}
  </div>

  <div class="section-bar" style="margin-top:16px">Essential Safety Measures Covered</div>
  <table class="card">
    <tbody>${checklistRows}</tbody>
  </table>

  <div class="section-bar" style="margin-top:16px">System Defects and Non-conformances</div>
  <table class="card">
    <thead><tr><th style="width:40px">Type</th><th>Classification</th><th>AS 1851 Section</th><th>Description</th></tr></thead>
    <tbody>${defectRows || `<tr><td colspan="4">No defects or non-conformances recorded</td></tr>`}</tbody>
  </table>

  <div class="section-bar" style="margin-top:16px">Compliance Statement</div>
  <div class="card" style="padding:10px 12px;font-size:9.5px;color:${COLORS.SLATE}">
    The essential safety measures listed above have been serviced for the period stated in
    accordance with AS 1851-2012 and are considered fit for service, except where a defect
    or non-conformance is recorded in the table above.
  </div>

  <div class="section-bar" style="margin-top:16px">Service Provider Details</div>
  <div class="card" style="display:flex">
    ${infoCell('Company', company.name)}
    ${infoCell('Address', company.address)}
    ${infoCell('Phone', company.phone)}
    ${infoCell('Technician' + (assignedUsers.length !== 1 ? 's' : ''), assignedUsers.map((u) => u.full_name).join(', ') || null)}
  </div>
</div></body></html>`;
}
