import { BASE_STYLE, COLORS } from './theme';
import { esc, fmtDateTime, fmtRelativeDays, photoRow, resultPill } from './helpers';
import { AssetLogChunk } from '../data/chunking';
import { Defect, InspectionPhoto } from '../types';

/**
 * Renders one bounded chunk of the Asset Inspection Log. Each asset row shows
 * its reference/location/status + thumbnails; a FAIL or NOT_TESTED-with-a-reason
 * row expands inline into a colored defect card for any defects linked to that
 * asset, matching the reference report's per-asset defect layout.
 */
export function renderAssetLogChunk(
  chunk: AssetLogChunk,
  defectsByAsset: Map<string, Defect[]>,
  photosByAsset: Map<string, InspectionPhoto[]>,
  photosByDefect: Map<string, InspectionPhoto[]>,
  signedPhotoUrls: Map<string, string>,
): string {
  let lastCategory: string | null = null;
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
    }

    const { asset } = row;
    const photos = photosByAsset.get(asset.id) ?? [];
    const assetDefects = defectsByAsset.get(asset.id) ?? [];

    // An asset's info, photos, and defect cards used to be 3 sibling <tr>
    // elements — theme.ts's `tr { break-inside: avoid }` protects each ONE
    // individually, but nothing stops a page break landing BETWEEN them,
    // which is exactly what split an asset's info from its own defect card
    // across a page boundary in the first real test. Nesting all three in a
    // sub-table inside a single outer <tr> makes break-inside:avoid protect
    // the whole record as one atomic unit — explicit widths on both the
    // outer <thead> and this inner table keep the columns aligned since
    // they're otherwise two independently auto-sized tables.
    parts.push(`
      <tr>
        <td colspan="3" style="padding:0;border-top:none">
          <table style="width:100%"><tbody>
            <tr>
              <td style="width:55%">
                <div style="font-weight:700">${esc(asset.asset_ref ? `${asset.asset_ref} - ` : '')}${esc(asset.asset_type)}</div>
                ${asset.variant ? `<div style="font-size:9.5px;color:${COLORS.MUTED}">${esc(asset.variant)}</div>` : ''}
              </td>
              <td style="width:30%">${esc(asset.location_on_site) || '—'}</td>
              <td style="width:15%;text-align:right">${resultPill(asset.result)}</td>
            </tr>
            ${photos.length > 0 ? `<tr><td colspan="3" style="padding-top:0;border-top:none">${photoRow(photos, signedPhotoUrls, 4)}</td></tr>` : ''}
            ${assetDefects.length > 0 ? `<tr><td colspan="3" style="padding:0;border-top:none">${assetDefects.map((defect) => renderDefectCard(defect, photosByDefect, signedPhotoUrls, row.officialSection)).join('')}</td></tr>` : ''}
          </tbody></table>
        </td>
      </tr>`);
  }
  if (lastCategory !== null) parts.push(`</tbody></table>`);

  return `<!DOCTYPE html>
<html><head><meta charset="utf-8" /><style>${BASE_STYLE}</style></head>
<body><div class="page">${parts.join('')}</div></body></html>`;
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
        <div style="margin-top:4px">${esc(defect.description)}</div>
        ${quoteBadge}
        ${photoRow(photos, signedPhotoUrls, 4)}
      </div>
    </div>`;
}
