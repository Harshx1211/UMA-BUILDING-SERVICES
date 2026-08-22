import { groupByCategory } from './categoryGrouping';
import { AssetTypeDefinition, AssetWithResult } from '../types';

export interface AssetLogRow {
  asset: AssetWithResult;
  categoryLabel: string;
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

/**
 * Orders every asset by category (numbered categories first, ascending; unnumbered
 * types under "Other") then by asset type and reference, and splits the result into
 * fixed-size chunks — the actual scale fix for 1000+ asset sites: a single Chromium
 * render never has to lay out more than `maxPerChunk` rows (plus their photos) at
 * once, regardless of how large the site is. See config.maxAssetsPerChunk.
 */
export function buildAssetLogChunks(
  assets: AssetWithResult[],
  assetTypesByValue: Map<string, AssetTypeDefinition>,
  maxPerChunk: number,
): AssetLogChunk[] {
  const categoryGroups = groupByCategory(assets, (a) => a.asset_type, assetTypesByValue);

  const ordered: AssetLogRow[] = [];
  for (const group of categoryGroups) {
    const sorted = [...group.items].sort((a, b) => {
      if (a.asset_type !== b.asset_type) return a.asset_type.localeCompare(b.asset_type);
      return (a.asset_ref ?? '').localeCompare(b.asset_ref ?? '');
    });
    sorted.forEach((asset, i) => {
      ordered.push({ asset, categoryLabel: group.label, isFirstInCategory: i === 0 });
    });
  }

  const chunks: AssetLogChunk[] = [];
  for (let i = 0; i < ordered.length; i += maxPerChunk) {
    chunks.push({ index: chunks.length, rows: ordered.slice(i, i + maxPerChunk) });
  }
  return chunks;
}
