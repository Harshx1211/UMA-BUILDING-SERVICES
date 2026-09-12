import { COLORS } from './theme';
import { esc, fmtDateTime, fmtRelativeDays, photoRow, resultPill } from './helpers';
import { AssetLogChunk } from '../data/chunking';
import { Defect, InspectionPhoto } from '../types';

/**
 * Renders one bounded chunk of the Asset Inspection Log. Each asset row shows
 * its reference/location/status + thumbnails; a FAIL or NOT_TESTED-with-a-reason
 * row expands inline into a colored defect card for any defects linked to that
 * asset, matching the reference report's per-asset defect layout.
 */
// Passed to renderDefectCard for defects rendered inside this chunk — see
// the comment at its call site below for why photos never render per-defect
// here (only renderUnlinkedDefects/renderRepairs still use a real map).
const EMPTY_PHOTOS = new Map<string, InspectionPhoto[]>();

export function renderAssetLogChunk(
  chunk: AssetLogChunk,
  defectsByAsset: Map<string, Defect[]>,
  photosByAsset: Map<string, InspectionPhoto[]>,
  signedPhotoUrls: Map<string, string>,
  fullResPhotoUrls: Map<string, string>,
): string {
  let lastCategory: string | null = null;
  // FIX: tracks whether the row about to render is the first one under a
  // freshly-opened <table> (right below the Asset/Location/Status header) —
  // every OTHER asset row in that same table got literally zero separation
  // from the one before it (padding:0, border-top:none, unconditionally),
  // so with more than one asset in a category (e.g. three near-identical
  // "BGA, MCP or Manual Call Point" entries back-to-back) it was genuinely
  // hard to tell where one asset's photos/notes/defect cards ended and the
  // next asset's row began.
  let isFirstRowOfTable = true;
  const parts: string[] = [];

  for (const row of chunk.rows) {
    if (row.categoryLabel !== lastCategory) {
      // Close the previous category's table before opening a new one — leaving
      // it open (the actual bug here) produces invalid nested <table> markup
      // that browsers "recover" from by silently reordering rows, which is what
      // caused headers/rows to visually scramble in the first preview.
      if (lastCategory !== null) parts.push(`</tbody></table>`);
      const suffix = row.isFirstInCategory ? '' : ' (continued)';
      parts.push(`<div class="section-bar" style="margin-top:14px">${esc(row.categoryLabel)}${suffix}</div>`);
      parts.push(`<table class="card"><thead><tr><th style="width:55%">Asset</th><th style="width:30%">Location</th><th style="width:15%;text-align:right">Status</th></tr></thead><tbody>`);
      lastCategory = row.categoryLabel;
      isFirstRowOfTable = true;
    }

    const { asset } = row;
    const assetDefects = defectsByAsset.get(asset.id) ?? [];

    // FIX: photos are no longer associated with a specific defect at all —
    // every photo for this asset (regardless of any defect_id a photo might
    // still carry from before this change) renders once, here, at the
    // asset level. Defect cards below get an empty photo map (see the
    // `new Map()` passed to renderDefectCard) so a defect never shows its
    // own separate photo row within this Asset Log section — that's still
    // the right behavior for a genuinely unlinked defect (no asset row to
    // attach to at all), which is why renderDefectCard itself still
    // supports it and unlinkedDefects.ts/repairs.ts still pass the real map.
    const photos = photosByAsset.get(asset.id) ?? [];

    // An asset's info, photos, and defect cards used to be 3 sibling <tr>
    // elements — theme.ts's `tr { break-inside: avoid }` protects each ONE
    // individually, but nothing stops a page break landing BETWEEN them,
    // which is exactly what split an asset's info from its own defect card
    // across a page boundary in the first real test. Nesting all three in a
    // sub-table inside a single outer <tr> makes break-inside:avoid protect
    // the whole record as one atomic unit — explicit widths on both the
    // outer <thead> and this inner table keep the columns aligned since
    // they're otherwise two independently auto-sized tables.
    // First asset under a header needs no extra separation (the header
    // itself already does that job); every asset after it gets real
    // breathing room plus a clearly visible divider, not just whatever
    // hairline its own first inner row happened to inherit.
    //
    // FIX: the divider was 2px in COLORS.BORDER (#E2E8F0) — a very light
    // gray that all but disappears against the page's white background,
    // especially with 3+ near-identical assets back to back (e.g. several
    // "BGA, MCP or Manual Call Point" entries in a row). Darkened to SLATE
    // and thickened so consecutive assets are unmistakably separated at a
    // glance, not just technically separated in the markup.
    const wrapperStyle = isFirstRowOfTable
      ? 'padding:0;border-top:none'
      : `padding-top:18px;border-top:3px solid ${COLORS.SLATE}`;
    isFirstRowOfTable = false;

    parts.push(`
      <tr>
        <td colspan="3" style="${wrapperStyle}">
          <table style="width:100%"><tbody>
            <tr>
              <td style="width:55%;border-top:none">
                <div style="font-weight:700">${esc(asset.asset_ref ? `${asset.asset_ref} - ` : '')}${esc(asset.asset_type)}</div>
                ${asset.variant ? `<div style="font-size:9.5px;color:${COLORS.MUTED}">${esc(asset.variant)}</div>` : ''}
                ${asset.serial_number ? `<div style="font-size:9.5px;color:${COLORS.MUTED}">S/N: ${esc(asset.serial_number)}</div>` : ''}
              </td>
              <td style="width:30%;border-top:none">${esc(asset.location_on_site) || '—'}</td>
              <td style="width:15%;text-align:right;border-top:none">${resultPill(asset.result)}</td>
            </tr>
            ${photos.length > 0 ? `<tr><td colspan="3" style="padding-top:0;border-top:none">${photoRow(photos, signedPhotoUrls, 4, fullResPhotoUrls)}</td></tr>` : ''}
            ${asset.description ? `<tr><td colspan="3" style="padding-top:6px;border-top:none">${renderTechnicianNote(asset.description, 'Asset Notes')}</td></tr>` : ''}
            ${asset.technician_notes ? `<tr><td colspan="3" style="padding-top:6px;border-top:none">${renderTechnicianNote(asset.technician_notes, 'Remarks')}</td></tr>` : ''}
            ${assetDefects.length > 0 ? `<tr><td colspan="3" style="padding:0;border-top:none">${assetDefects.map((defect) => renderDefectCard(defect, EMPTY_PHOTOS, signedPhotoUrls, row.officialSection, fullResPhotoUrls)).join('')}</td></tr>` : ''}
          </tbody></table>
        </td>
      </tr>`);
  }
  if (lastCategory !== null) parts.push(`</tbody></table>`);

  return `<div class="page">${parts.join('')}</div>`;
}

/**
 * FIX: was a plain gray flex row labeled just "Note" — inconsistent with
 * the mobile app, which calls this same field (job_assets.technician_notes)
 * "Remarks" everywhere (the asset screen's card title, the audit
 * Timeline's field label). Restyled to match the report's own defect-card
 * visual language (left accent bar + padded body) instead of a bare box, so
 * it reads as a considered part of the report rather than a debug dump —
 * label above the text (not squeezed alongside it) and a lightly italicised
 * note body to visually mark it as commentary, distinct from the factual
 * rows around it.
 *
 * FIX: now also used for assets.description ("Condition, age, notes..." on
 * EditAssetModal) — a real, technician-entered field about the physical
 * asset itself that had never been wired into the report at all (same class
 * of bug as jobs.notes/"Field Notes" — captured, never rendered). Takes an
 * explicit label so the two stay visually distinct: this asset's standing
 * condition/age notes vs. this one visit's inspection note.
 */
function renderTechnicianNote(note: string, label: string): string {
  return `
    <div class="defect-card" style="background:${COLORS.SURFACE};border:1px solid ${COLORS.BORDER}">
      <div class="defect-bar" style="background:${COLORS.MUTED_LIGHT}"></div>
      <div class="defect-body">
        <div style="font-weight:800;color:${COLORS.SLATE};font-size:8.5px;text-transform:uppercase;letter-spacing:0.5px">${esc(label)}</div>
        <div style="margin-top:4px;color:${COLORS.BLACK};font-size:10px;line-height:1.45;font-style:italic;white-space:pre-line">${esc(note)}</div>
      </div>
    </div>`;
}

// AS1851-2012 Clause 1.5.6's own wording — a non-conformance is explicitly
// NOT a defect ("missing information or incorrect feature... does not affect
// system operation"), so it must not be labelled "... defect" like the other two.
const SEVERITY_BADGE: Record<string, string> = {
  critical: 'Critical Defect',
  non_critical: 'Non-critical Defect',
  non_conformance: 'Non-conformance',
};

export function renderDefectCard(
  defect: Defect,
  photosByDefect: Map<string, InspectionPhoto[]>,
  signedPhotoUrls: Map<string, string>,
  // AS1851 Clause 1.16 requires routine service records to "clearly reference
  // the relevant section of AS 1851-2012" — verified via categoryGrouping.ts's
  // officialSectionFor(), so a defect on an out-of-range category (e.g. "15")
  // never gets a fabricated Section number. Unlinked defects have no asset and
  // so no Section to reference — defaults to null.
  officialSection: number | null = null,
  fullResPhotoUrls?: Map<string, string>,
): string {
  const sev = COLORS.SEVERITY[defect.severity] ?? COLORS.SEVERITY.non_conformance;
  const badgeLabel = SEVERITY_BADGE[defect.severity] ?? defect.severity;
  const photos = photosByDefect.get(defect.id) ?? [];
  const quoteBadge = defect.quote_price != null
    ? `<span class="pill" style="background:${COLORS.GREEN_BG};color:${COLORS.GREEN_TEXT};margin-left:6px">Quote: $${Number(defect.quote_price).toFixed(2)}</span>`
    : '';

  return `
    <div class="defect-card" style="background:${sev.bg};border:1px solid ${sev.border}">
      <div class="defect-bar" style="background:${sev.text}"></div>
      <div class="defect-body">
        <div style="display:flex;justify-content:space-between;align-items:baseline">
          <span style="font-weight:800;color:${sev.text};text-transform:uppercase;font-size:9.5px">${esc(badgeLabel)}${defect.defect_code ? ` &middot; ${esc(defect.defect_code.toUpperCase())}` : ''}${officialSection != null ? ` &middot; AS 1851-2012 Section ${officialSection}` : ''}</span>
          <span style="font-size:9px;color:${COLORS.MUTED}">Logged ${fmtDateTime(defect.created_at)} &middot; ${esc(fmtRelativeDays(defect.created_at))}</span>
        </div>
        <div style="margin-top:4px;white-space:pre-line">${esc(defect.description)}</div>
        ${quoteBadge}
        ${photoRow(photos, signedPhotoUrls, 4, fullResPhotoUrls)}
      </div>
    </div>`;
}
