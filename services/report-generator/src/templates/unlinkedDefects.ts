import { BASE_STYLE } from './theme';
import { renderDefectCard } from './assetLogChunk';
import { Defect, InspectionPhoto } from '../types';

/** Defects with no asset_id ("unlinked" — see the defects_asset_id_nullable
 * migration) have nowhere to attach in the per-asset log, so they get their own
 * small section rather than silently disappearing from the report. */
export function renderUnlinkedDefects(
  defects: Defect[],
  photosByDefect: Map<string, InspectionPhoto[]>,
  signedPhotoUrls: Map<string, string>,
): string | null {
  const unlinked = defects.filter((d) => !d.asset_id);
  if (unlinked.length === 0) return null;

  return `<!DOCTYPE html>
<html><head><meta charset="utf-8" /><style>${BASE_STYLE}</style></head>
<body><div class="page">
  <div class="section-bar">General Defects (Not Linked to a Specific Asset)</div>
  <div class="card" style="padding:10px 12px">
    ${unlinked.map((d) => renderDefectCard(d, photosByDefect, signedPhotoUrls)).join('')}
  </div>
</div></body></html>`;
}
