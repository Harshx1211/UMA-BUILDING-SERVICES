import { groupByCategory } from './categoryGrouping';
import { AssetTypeDefinition, AssetWithResult } from '../types';

export interface AssetLogRow {
  asset: AssetWithResult;
  categoryLabel: string;
  /** The category's number, but only when it's a real AS1851 Section 2-14 — see
   * categoryGrouping.ts's officialSectionFor(). Null for unverified/out-of-range
   * category numbers (e.g. the "15" emergency-lighting convention). */
  officialSection: number | null;
  /** True only for the very first row of this category across the WHOLE ordered
   * list (not just within one chunk) — lets a chunk tell whether it's opening a
   * category for the first time or continuing one that started in a previous
   * chunk, so the header can say "(continued)" correctly. */
  isFirstInCategory: boolean;
}

export interface AssetLogChunk {
  index: number;
  rows: AssetLogRow[];
}

export interface CategoryAssetLog {
  label: string;
  number: number | null;
  officialSection: number | null;
  /** Almost always exactly one chunk — only splits further when a single
   * category alone exceeds maxPerChunk (the 1000+-assets-of-one-type case). */
  chunks: AssetLogChunk[];
}

/**
 * Orders every asset by category (numbered categories first, ascending; unnumbered
 * types under "Other"), then by asset type and reference, and groups them one
 * category at a time. Each category is rendered as its own PDF document in the
 * pipeline (see generation/pipeline.ts) so its exact page count can be measured
 * afterward — the only reliable way to build a page-accurate report index, since
 * a category is never split across an artificial fixed-size chunk boundary here.
 *
 * A category only produces more than one chunk in the rare case that it alone
 * exceeds maxPerChunk assets — the original scale fix for 1000+ asset sites
 * (a single Chromium render never has to lay out more than maxPerChunk rows,
 * plus their photos, at once) still applies within a category.
 */
export function buildAssetLogChunksByCategory(
  assets: AssetWithResult[],
  assetTypesByValue: Map<string, AssetTypeDefinition>,
  maxPerChunk: number,
): CategoryAssetLog[] {
  const categoryGroups = groupByCategory(assets, (a) => a.asset_type, assetTypesByValue);

  return categoryGroups.map((group) => {
    const sorted = [...group.items].sort((a, b) => {
      if (a.asset_type !== b.asset_type) return a.asset_type.localeCompare(b.asset_type);
      return (a.asset_ref ?? '').localeCompare(b.asset_ref ?? '');
    });

    const chunks: AssetLogChunk[] = [];
    for (let i = 0; i < sorted.length; i += maxPerChunk) {
      const slice = sorted.slice(i, i + maxPerChunk);
      const rows: AssetLogRow[] = slice.map((asset, j) => ({
        asset,
        categoryLabel: group.label,
        officialSection: group.officialSection,
        isFirstInCategory: i === 0 && j === 0,
      }));
      chunks.push({ index: chunks.length, rows });
    }

    return { label: group.label, number: group.number, officialSection: group.officialSection, chunks };
  });
}
