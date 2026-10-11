import { esc } from './helpers';
import { TocSectionEntry } from '../data/tableOfContents';

/**
 * "Report Index" page. Category page ranges come from rangesFromMarkers()
 * in data/tableOfContents.ts, derived from real measured marker positions in
 * the rendered PDF (see generation/pipeline.ts / pdf/pageMarkers.ts) — never
 * estimated, so a range shown here always matches where that section
 * actually starts/ends in the final file.
 */
export function renderTableOfContents(
  categoryEntries: TocSectionEntry[],
  tailEntries: TocSectionEntry[],
): string {
  const pageLabel = (e: TocSectionEntry) =>
    e.startPage === e.endPage ? `Page ${e.startPage}` : `Pages ${e.startPage}–${e.endPage}`;

  const row = (e: TocSectionEntry) => `
      <tr>
        <td>${esc(e.label)}</td>
        <td class="num">${pageLabel(e)}</td>
      </tr>`;

  const categoryRows = categoryEntries.map(row).join('');
  const tailRows = tailEntries.map(row).join('');

  return `
  <div class="page">
    <div class="title" style="margin-bottom:16px">Report Index</div>
    <div class="section-bar">Asset Inspection Log</div>
    <table>
      <thead><tr><th>Category</th><th style="width:20%;text-align:right">Pages</th></tr></thead>
      <tbody>${categoryRows || '<tr><td colspan="2">No assets recorded</td></tr>'}</tbody>
    </table>

    ${tailRows ? `
    <div class="section-bar" style="margin-top:20px">Other Sections</div>
    <table>
      <thead><tr><th>Section</th><th style="width:20%;text-align:right">Pages</th></tr></thead>
      <tbody>${tailRows}</tbody>
    </table>` : ''}
  </div>`;
}
