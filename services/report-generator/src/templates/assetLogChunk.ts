import { COLORS } from './theme';
import { esc, fmtDateTime, pill, photoRow, resultPill, stagedPhotoSection, stripPrices } from './helpers';
import { AssetLogChunk } from '../data/chunking';
import { Defect, InspectionPhoto } from '../types';

/**
 * Renders one bounded chunk of the Asset Inspection Log. Each asset is one
 * card — a header strip (reference + type, result pill, an edge coloured by
 * result) over its details, photos, remarks and the defect cards linked to
 * it — so it's unmistakable where one asset ends and the next begins, even
 * with several near-identical assets back to back.
 */
export function renderAssetLogChunk(
  chunk: AssetLogChunk,
  defectsByAsset: Map<string, Defect[]>,
  photosByAsset: Map<string, InspectionPhoto[]>,
  photosByDefect: Map<string, InspectionPhoto[]>,
  signedPhotoUrls: Map<string, string>,
  fullResPhotoUrls: Map<string, string>,
): string {
  let lastCategory: string | null = null;
  const parts: string[] = [];

  for (const row of chunk.rows) {
    if (row.categoryLabel !== lastCategory) {
      // Close the previous category's table before opening a new one — leaving
      // it open produces invalid nested <table> markup that browsers "recover"
      // from by silently reordering rows.
      if (lastCategory !== null) parts.push(`</tbody></table>`);
      const suffix = row.isFirstInCategory ? '' : ' (continued)';
      // Category heading inside <thead> — see theme.ts (.cat-head): repeats
      // on every page the category spans, never stranded on its own.
      parts.push(`<table class="cat-table"><thead>`
        + `<tr class="cat-head"><th class="cat-th">${esc(row.categoryLabel)}${suffix}</th></tr>`
        + `</thead><tbody>`);
      lastCategory = row.categoryLabel;
    }

    const { asset } = row;
    const assetDefects = defectsByAsset.get(asset.id) ?? [];

    // A defect's photo carries BOTH asset_id and defect_id, so
    // photosByAsset/photosByDefect are NOT mutually exclusive — the same
    // row can appear in both maps. Untagged (stage === null) photos render
    // once here at the asset level. A STAGED (before/after) photo belongs to
    // its own defect's card instead (see renderDefectCard below) — excluded
    // here so it doesn't also render a second time on the asset itself.
    const photos = (photosByAsset.get(asset.id) ?? []).filter((p) => !(p.defect_id && p.stage));

    const details = [
      asset.variant,
      asset.serial_number ? `S/N: ${asset.serial_number}` : null,
      asset.location_on_site ? `Location ${asset.location_on_site}` : null,
    ]
      .filter(Boolean)
      .map(esc)
      .join(' &middot; ');

    // assets.description ("Asset Notes") is intentionally not printed
    // (owner's decision, 2026-10-11): it's the technician's standing note
    // about the asset and stays in the app only. Remarks (this visit's
    // technician_notes) still print.
    const body = [
      details ? `<div class="asset-detail">${details}</div>` : '',
      photoRow(photos, signedPhotoUrls, 4, fullResPhotoUrls),
      asset.technician_notes ? renderRemarks(asset.technician_notes) : '',
      assetDefects
        .map((defect) => renderDefectCard(defect, photosByDefect, signedPhotoUrls, row.officialSection, fullResPhotoUrls, false))
        .join(''),
    ].join('');

    const edge = COLORS.RESULT_EDGE[asset.result ?? 'not_tested'] ?? COLORS.MUTED;
    // The whole asset is one table row, so theme.ts's `tr { break-inside:
    // avoid }` keeps its details, photos and defect cards on one page.
    parts.push(`
      <tr><td class="asset-cell"><div class="asset-card">
        <div class="asset-head" style="border-left-color:${edge}">
          <span class="asset-title">${esc(asset.asset_ref ? `${asset.asset_ref} - ` : '')}${esc(asset.asset_type)}</span>
          ${resultPill(asset.result)}
        </div>
        ${body ? `<div class="asset-body">${body}</div>` : ''}
      </div></td></tr>`);
  }
  if (lastCategory !== null) parts.push(`</tbody></table>`);

  return `<div class="log">${parts.join('')}</div>`;
}

/**
 * This visit's remarks (job_assets.technician_notes — "Remarks" in the
 * mobile app too): a bold label run into the italic note, one compact line
 * for the usual short remark.
 */
function renderRemarks(note: string): string {
  return `<div class="remark"><span class="remark-label">Remarks:</span> <span class="pre">${esc(stripPrices(note))}</span></div>`;
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
  // True (default) for renderUnlinkedDefects, whose defects have no asset
  // and so no sibling asset-level photo row anywhere — their untagged
  // photos must render here or nowhere. assetLogChunk's OWN call above
  // passes false: every defect it renders always has an asset directly
  // above it that already shows untagged photos.
  includeUntaggedPhotos = true,
): string {
  const sev = COLORS.SEVERITY[defect.severity] ?? COLORS.SEVERITY.non_conformance;
  const badgeLabel = SEVERITY_BADGE[defect.severity] ?? defect.severity;
  const photos = photosByDefect.get(defect.id) ?? [];
  // No quote price on the report (owner's rule, 2026-10-11 — see
  // stripPrices in helpers.ts): quotes live in the app and admin portal.
  // "Resolved on site" is purely informational — a technician's on-the-spot
  // fix.
  const tags = defect.resolved_on_site ? pill('Resolved on site', COLORS.PILL.pass) : '';

  return `
    <div class="defect" style="background:${sev.bg};border-color:${sev.border};border-left-color:${sev.accent}">
      <div class="defect-top">
        <span class="defect-title" style="color:${sev.title}">${esc(badgeLabel)}${defect.defect_code ? ` &middot; ${esc(defect.defect_code.toUpperCase())}` : ''}${officialSection != null ? ` &middot; AS 1851-2012 Section ${officialSection}` : ''}</span>
        <span class="defect-time">Logged ${fmtDateTime(defect.created_at)}</span>
      </div>
      <div class="defect-desc">${esc(stripPrices(defect.description))}</div>
      ${tags ? `<div class="tags">${tags}</div>` : ''}
      ${stagedPhotoSection(photos, signedPhotoUrls, fullResPhotoUrls, includeUntaggedPhotos)}
    </div>`;
}
