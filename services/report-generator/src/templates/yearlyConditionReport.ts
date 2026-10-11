import { COLORS } from './theme';
import { esc, field, fmtDate } from './helpers';
import { groupByCategory, AS1851_SECTIONS } from '../data/categoryGrouping';
import { AssetTypeDefinition, ReportData } from '../types';

// SIZE: the tick is drawn, not typed — the report font has no check-mark
// glyph, so "&#10003;" pulled in a whole extra fallback font just for it.
const CHECK_SVG = `<svg width="8" height="8" viewBox="0 0 10 10"><path d="M1.5 5.3 4 7.8 8.7 2.3" fill="none" stroke="${COLORS.WHITE}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>`;

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

  const checklist = Object.entries(AS1851_SECTIONS)
    .map(([num, name]) => {
      const n = Number(num);
      const checked = coveredSections.has(n);
      return `
        <div class="esm-item">
          <span class="tick-box${checked ? ' on' : ''}">${checked ? CHECK_SVG : ''}</span>
          <span>Section ${n} &mdash; ${esc(name)}</span>
        </div>`;
    })
    .join('');

  const assetsById = new Map(assets.map((a) => [a.id, a]));
  const typeOf = (d: (typeof defects)[number]) => TYPE_LABEL[d.severity] ?? { type: 3, label: d.severity };
  const sectionOf = (d: (typeof defects)[number]) =>
    (d.asset_id ? assetsById.get(d.asset_id)?.categoryOfficialSection : undefined) ?? null;
  // FIX: rows came out in whatever order the database returned them, so
  // critical defects were scattered through the table. Most severe first,
  // then by AS 1851 section (none last), then in the order they were logged.
  const sortedDefects = [...defects].sort((a, b) =>
    typeOf(a).type - typeOf(b).type
    || (sectionOf(a) ?? Infinity) - (sectionOf(b) ?? Infinity)
    || String(a.created_at ?? '').localeCompare(String(b.created_at ?? '')),
  );
  const defectRows = sortedDefects
    .map((d) => {
      const t = typeOf(d);
      const section = sectionOf(d);
      const color = (COLORS.SEVERITY[d.severity] ?? COLORS.SEVERITY.non_conformance).accent;
      return `
        <tr>
          <td style="text-align:center"><span class="type-badge" style="background:${color}">${t.type}</span></td>
          <td style="font-weight:700;color:${color}">${esc(t.label)}</td>
          <td>${section != null ? `Section ${section}` : '&mdash;'}</td>
          <td class="pre">${esc(d.description)}</td>
        </tr>`;
    })
    .join('');

  const address = [property?.address, property?.suburb, property?.state, property?.postcode].filter(Boolean).join(', ');
  const technicians = assignedUsers.map((u) => u.full_name).join(', ') || null;

  return `<div class="page">
  <div class="title-row">
    <div class="title" style="font-size:16px">Yearly Condition Report</div>
    <span class="label" style="margin:0">AS 1851-2012 Appendix E</span>
  </div>

  <div class="panel fields keep" style="grid-template-columns:1fr 1fr 1fr 2fr">
    ${field('Report No.', reportId, { strong: true })}
    ${field('Period', fmtDate(dateOfService))}
    ${field('Site', property?.name)}
    ${field('Address', address)}
  </div>

  <div class="section-bar" style="margin-top:16px">Essential Safety Measures Covered</div>
  <div class="panel esm keep">${checklist}</div>

  <div class="section-bar" style="margin-top:16px">System Defects and Non-conformances</div>
  <table>
    <thead><tr><th style="width:7%;text-align:center">Type</th><th style="width:19%">Classification</th><th style="width:16%">AS 1851 Section</th><th>Description</th></tr></thead>
    <tbody>${defectRows || `<tr><td colspan="4">No defects or non-conformances recorded</td></tr>`}</tbody>
  </table>

  <!-- Kept together: two short closing blocks, never split from their
       headings or from each other. -->
  <div class="keep">
    <div class="section-bar" style="margin-top:16px">Compliance Statement</div>
    <div class="panel statement">
      The essential safety measures listed above have been serviced for the period stated in
      accordance with AS 1851-2012 and are considered fit for service, except where a defect
      or non-conformance is recorded in the table above.
    </div>

    <div class="section-bar" style="margin-top:16px">Service Provider Details</div>
    <div class="panel fields" style="grid-template-columns:1fr 2fr 1fr 1fr">
      ${field('Company', company.name, { strong: true })}
      ${field('Address', company.address)}
      ${field('Phone', company.phone)}
      ${field('Technician' + (assignedUsers.length !== 1 ? 's' : ''), technicians, { strong: true })}
    </div>
  </div>
</div>`;
}
