import { BASE_STYLE, COLORS } from './theme';
import { esc, fmtDate, fmtDateTime } from './helpers';
import { ReportData } from '../types';

/**
 * Lists the job's assigned technician (always present — see
 * data/fetchReportData.ts) plus any other technician who separately logged
 * time on the job, each with their worked date range and accreditation
 * fields. The `signatures` table has a hard UNIQUE(job_id) constraint — it
 * can only ever store one technician signature per job — so only the job's
 * assigned technician (the one who actually captured `tech_signature_url` in
 * the app) shows a signature image; every other technician is listed by
 * name/date/accreditation only. This was an explicit, confirmed trade-off,
 * not an oversight — see the plan doc's "Multi-tech signoff" decision.
 */
export function renderSignoff(data: ReportData): string {
  const { job, signature, timeLogUsers } = data;

  const rows = timeLogUsers
    .map((t) => {
      const isSigner = t.user.id === job.assigned_to;
      const sigCell = isSigner && signature?.tech_signature_url && signature.tech_signature_url !== 'UNAVAILABLE'
        ? `<img src="${esc(signature.tech_signature_url)}" style="max-height:36px" alt="signature" />`
        : `<span style="color:${COLORS.MUTED}">—</span>`;
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
          <td>${fmtDateTime(t.firstClockIn)}${t.lastClockOut ? ` &ndash; ${fmtDateTime(t.lastClockOut)}` : ' (session open)'}</td>
          <td>${accreditations}</td>
          <td>${sigCell}</td>
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
  <table class="card" style="margin-top:10px">
    <thead><tr><th>Technician</th><th>Date/Time</th><th>Accreditations</th><th>Signature</th></tr></thead>
    <tbody>${rows || `<tr><td colspan="4">No time logged against this job</td></tr>`}</tbody>
  </table>
  ${clientSignoff}
</div></body></html>`;
}
