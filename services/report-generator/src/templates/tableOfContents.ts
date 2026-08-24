import { BASE_STYLE } from './theme';
import { esc } from './helpers';
import { TocSectionEntry } from '../data/tableOfContents';

/**
 * "Report Index" page. Category page ranges come from computeSequentialRanges()
 * in data/tableOfContents.ts, already measured against real rendered PDF page
 * counts (see generation/pipeline.ts) — never estimated, so a range shown here
 * always matches where that section actually starts/ends in the final file.
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
        <td style="text-align:right;font-variant-numeric:tabular-nums">${pageLabel(e)}</td>
      </tr>`;

  const categoryRows = categoryEntries.map(row).join('');
  const tailRows = tailEntries.map(row).join('');

  return `<!DOCTYPE html>
<html><head><meta charset="utf-8" /><style>${BASE_STYLE}</style></head>
<body>
  <div class="page">
    <div class="section-bar">Report Index</div>
    <table class="card">
      <thead><tr><th>Asset Inspection Log</th><th style="text-align:right">Pages</th></tr></thead>
      <tbody>${categoryRows || '<tr><td colspan="2">No assets recorded</td></tr>'}</tbody>
    </table>

    ${tailRows ? `
    <div class="section-bar" style="margin-top:18px">Other Sections</div>
    <table class="card">
      <tbody>${tailRows}</tbody>
    </table>` : ''}
  </div>
</body></html>`;
}
