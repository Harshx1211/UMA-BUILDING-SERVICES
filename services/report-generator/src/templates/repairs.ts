import { COLORS } from './theme';
import { esc, pill, stagedPhotoSection } from './helpers';
import { Defect, InspectionPhoto, Quote } from '../types';

/**
 * "Repairs" section — resolved defects with any linked parts/labour line items.
 * Photos render with the same Before/After split as the defect's own card in
 * the Asset Log (see stagedPhotoSection) — a repaired defect is exactly the
 * case this split matters most for, showing the original issue next to its
 * resolution.
 *
 * "Parts/Labour" comes from quote_items linked to the defect via defect_id on
 * the job's approved quote — there's no separate parts/labour table, and only an
 * approved quote represents authorized work, so unapproved/draft quote items are
 * intentionally not shown here.
 */
export function renderRepairs(
  defects: Defect[],
  approvedQuote: Quote | null,
  photosByDefect: Map<string, InspectionPhoto[]>,
  signedPhotoUrls: Map<string, string>,
  fullResPhotoUrls: Map<string, string>,
): string | null {
  const repaired = defects.filter((d) => d.status === 'repaired');
  if (repaired.length === 0) return null;

  const itemsByDefect = new Map<string, Quote['items']>();
  for (const item of approvedQuote?.items ?? []) {
    if (!item.defect_id) continue;
    const list = itemsByDefect.get(item.defect_id) ?? [];
    list.push(item);
    itemsByDefect.set(item.defect_id, list);
  }

  const cards = repaired.map((defect) => {
    const photos = photosByDefect.get(defect.id) ?? [];
    const items = itemsByDefect.get(defect.id) ?? [];
    const itemRows = items
      .map(
        (i) => `
        <tr>
          <td>${esc(i.item_name ?? i.inventory_item?.name ?? 'Item')}</td>
          <td class="num">${i.quantity}</td>
        </tr>`,
      )
      .join('');
    const body = stagedPhotoSection(photos, signedPhotoUrls, fullResPhotoUrls)
      + (itemRows ? `
        <table style="margin-top:8px">
          <thead><tr><th>Parts / Labour</th><th style="width:20%;text-align:right">Quantity</th></tr></thead>
          <tbody>${itemRows}</tbody>
        </table>` : '');

    return `
      <div class="asset-card keep" style="margin-top:8px">
        <div class="asset-head" style="border-left-color:${COLORS.GREEN_TEXT}">
          <span class="asset-title pre">${esc(defect.description)}</span>
          ${pill('Resolved', COLORS.PILL.pass)}
        </div>
        ${body ? `<div class="asset-body">${body}</div>` : ''}
      </div>`;
  });

  return `<div class="page">
  <div class="section-bar">Repairs</div>
  ${cards.join('')}
</div>`;
}
