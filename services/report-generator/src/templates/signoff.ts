import { BASE_STYLE, COLORS } from './theme';
import { esc, fmtDate, fmtDateTime } from './helpers';
import { ReportData } from '../types';

/**
 * Lists every assigned technician (always at least one — see
 * data/fetchReportData.ts) plus any other technician who separately logged
 * time on the job, each with their worked date range and accreditation
 * fields — "whole site inspected by" this crew. The `signatures` table has
 * a hard UNIQUE(job_id) constraint — one technician signature per job, with
 * no record of which specific crew member captured it — so it's shown once,
 * unconditionally, below the table rather than guessed onto any one row.
 */
export function renderSignoff(data: ReportData): string {
  const { company, signature, timeLogUsers } = data;

  // Matches the reference report's footer line — optional, so a company that
  // hasn't set one (companies.accreditations is nullable) just omits the row
  // rather than showing a blank "—" line every time.
  const accreditationsRow = company.accreditations
    ? `
    <div class="card" style="margin-top:6px;padding:8px 12px;font-size:9px;color:${COLORS.MUTED}">
      <strong style="color:${COLORS.SLATE}">Company Accreditations:</strong> ${esc(company.accreditations)}
    </div>`
    : '';

  const rows = timeLogUsers
    .map((t) => {
      // esc() each part individually and join with a raw entity — joining first
      // then escaping the combined string would double-escape the "&" in "&middot;".
      const accreditationParts = [
        t.user.fpas_number ? esc(`FPAS ${t.user.fpas_number}`) : null,
        t.user.state_license ? esc(t.user.state_license) : null,
      ].filter(Boolean);
      const accreditations = accreditationParts.length > 0 ? accreditationParts.join(' &middot; ') : '—';

      return `
        <tr>
          <td>${esc(t.user.full_name)}</td>
          <td>${fmtDateTime(t.firstClockIn)}${
            t.lastClockOut
              ? ` &ndash; ${fmtDateTime(t.lastClockOut)}`
              : t.hasRealSession
                ? ' (session open)'
                : ''
          }</td>
          <td>${accreditations}</td>
        </tr>`;
    })
    .join('');

  // 'UNAVAILABLE' is a real sentinel value the app writes (see
  // app/(app)/jobs/[id]/signature.tsx) when a technician records that the
  // client wasn't present to sign — not a broken/missing value. Rendering it
  // as <img src="UNAVAILABLE"> produces a broken-image icon; show the actual
  // reason instead, same as the legacy on-device template did.
  const clientUnavailable = signature?.signature_url === 'UNAVAILABLE';
  const clientSigCell = clientUnavailable
    ? `<span style="font-style:italic;color:${COLORS.MUTED}">Client unavailable to sign</span>`
    : `<img src="${esc(signature!.signature_url)}" style="max-height:44px" alt="signature" />`;

  const hasRealTechSignature = signature?.tech_signature_url && signature.tech_signature_url !== 'UNAVAILABLE';
  const techSignoff = hasRealTechSignature
    ? `
    <div class="card" style="margin-top:10px;padding:10px 12px;display:flex;justify-content:space-between;align-items:center">
      <span style="font-size:9px;color:${COLORS.MUTED};text-transform:uppercase;font-weight:700">Technician Signature</span>
      <img src="${esc(signature!.tech_signature_url)}" style="max-height:36px" alt="signature" />
    </div>`
    : '';

  const clientSignoff = signature
    ? `
    <div class="card" style="margin-top:14px;padding:12px 14px">
      <div style="font-size:9.5px;color:${COLORS.MUTED};text-transform:uppercase;font-weight:700;margin-bottom:6px">Client Sign-off</div>
      <div style="display:flex;justify-content:space-between;align-items:center">
        <div>
          <div style="font-weight:700">${esc(signature.signed_by_name)}</div>
          <div style="font-size:9.5px;color:${COLORS.MUTED}">${fmtDate(signature.signed_at)}</div>
        </div>
        ${clientSigCell}
      </div>
    </div>`
    : '';

  return `<!DOCTYPE html>
<html><head><meta charset="utf-8" /><style>${BASE_STYLE}</style></head>
<body><div class="page">
  <div class="section-bar">Signoff</div>
  <div class="card" style="padding:10px 12px;font-size:9.5px;color:${COLORS.SLATE}">
    Maintenance has been carried out in accordance with applicable fire safety compliance
    requirements for the relevant jurisdiction.
  </div>
  ${accreditationsRow}
  <table class="card" style="margin-top:10px">
    <thead><tr><th>Technician</th><th>Date/Time</th><th>Accreditations</th></tr></thead>
    <tbody>${rows || `<tr><td colspan="3">No time logged against this job</td></tr>`}</tbody>
  </table>
  ${techSignoff}
  ${clientSignoff}
</div></body></html>`;
}
