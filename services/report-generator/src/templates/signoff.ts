import { COLORS } from './theme';
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
    ? `<div style="margin-top:4px"><strong>Company accreditations:</strong> ${esc(company.accreditations)}</div>`
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
            // A range only when it's actually a range — the no-time-log
            // fallback uses the same moment for both ends.
            t.lastClockOut && fmtDateTime(t.lastClockOut) !== fmtDateTime(t.firstClockIn)
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
  // FIX: this used to force-unwrap `signature!` unconditionally — harmless
  // when a signature exists (the only case this value is actually rendered,
  // inside clientSignoff's `signature ? ... : ''` below), but a genuinely
  // null signature (a report generated before the job was signed off — see
  // JobDetailClient.tsx's own "Draft Inspection Report" case) crashed the
  // ENTIRE report generation here before ever reaching that correct
  // omit-the-card logic.
  const clientSigCell = !signature
    ? ''
    : clientUnavailable
      ? `<span style="font-style:italic;color:${COLORS.MUTED}">Client unavailable to sign</span>`
      : `<img src="${esc(signature.signature_url)}" alt="signature" />`;

  const hasRealTechSignature = signature?.tech_signature_url && signature.tech_signature_url !== 'UNAVAILABLE';
  const techBox = hasRealTechSignature
    ? `
    <div class="sign-box">
      <span class="label">Technician Signature</span>
      <div class="sig-area"><img src="${esc(signature!.tech_signature_url)}" alt="signature" /></div>
    </div>`
    : '';

  const clientBox = signature
    ? `
    <div class="sign-box">
      <span class="label">Client Sign-off</span>
      <div class="sig-area">${clientSigCell}</div>
      <div class="value strong">${esc(signature.signed_by_name)}</div>
      <div class="sub">${fmtDate(signature.signed_at)}</div>
    </div>`
    : '';

  return `<div class="page">
  <div class="section-bar">Sign-off</div>
  <div class="panel statement">
    Maintenance has been carried out in accordance with applicable fire safety compliance
    requirements for the relevant jurisdiction.
    ${accreditationsRow}
  </div>
  <table style="margin-top:10px">
    <thead><tr><th>Technician</th><th>Date/Time</th><th>Accreditations</th></tr></thead>
    <tbody>${rows || `<tr><td colspan="3">No time logged against this job</td></tr>`}</tbody>
  </table>
  ${techBox || clientBox ? `<div class="sign-grid">${techBox}${clientBox}</div>` : ''}
</div>`;
}
