import React, { useMemo } from 'react';
import { View, StyleSheet, useWindowDimensions, TouchableOpacity, SectionList } from 'react-native';
import { Text } from 'react-native-paper';
import { InspectionPhoto } from '@/types';
import { useColors } from '@/hooks/useColors';
import { T } from '@/constants/Colors';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { queryRecordsIn } from '@/lib/database';
import ResilientPhoto from '@/components/camera/ResilientPhoto';

interface Props {
  photos: InspectionPhoto[];
  onPhotoLongPress: (photo: InspectionPhoto) => void;
}

const GRID_GAPS = 8;

// FIX: was a module-level Dimensions.get('window') read once at import time
// — the grid never adapted to a tablet's larger width (fixed 3 columns of
// tiny cells) or to rotation (stale size after turning the device). Now
// derived per-render from useWindowDimensions(), which re-renders on both.
function getNumColumns(width: number) {
  if (width >= 900) return 5;
  if (width >= 600) return 4;
  return 3;
}

export default function PhotoGrid({ photos, onPhotoLongPress }: Props) {
  const C = useColors();
  const { width } = useWindowDimensions();
  const numColumns = getNumColumns(width);
  const cellSize = (width - 32 - (GRID_GAPS * (numColumns - 1))) / numColumns;

  // FIX: this used to call getRecord('assets', ...) — a synchronous SQLite
  // hit — once PER PHOTO, on every render (the grouping ran directly in the
  // render body, not memoized), so a job with 100+ photos fired 100+
  // queries on every single re-render, not just mount. Batched into one
  // queryRecordsIn call and memoized so it only re-runs when the photo list
  // itself actually changes.
  const sections = useMemo(() => {
    const assetIds = [...new Set(photos.map((p) => p.asset_id).filter((id): id is string => !!id))];
    const assets = queryRecordsIn<{ id: string; asset_type: string; location_on_site: string }>(
      'assets', 'id', assetIds,
    );
    const assetById = new Map(assets.map((a) => [a.id, a]));

    const sectionsObj: Record<string, InspectionPhoto[]> = {};
    for (const photo of photos) {
      let key = 'Site Photos (General)';
      if (photo.asset_id) {
        const asset = assetById.get(photo.asset_id);
        key = asset ? `${asset.asset_type} - ${asset.location_on_site}` : `Asset Photos (${photo.asset_id.substring(0, 6)})`;
      }
      if (!sectionsObj[key]) sectionsObj[key] = [];
      sectionsObj[key].push(photo);
    }

    // FIX: every section used to be ONE SectionList data item holding its
    // entire photo array, `.map()`'d out in a single renderItem call — that
    // defeated virtualization at the photo level entirely, since every
    // photo in a section decoded and mounted immediately regardless of
    // scroll position. Chunking into rows of `numColumns` gives each row
    // its own list item, so SectionList can actually window them.
    return Object.keys(sectionsObj).map((key) => {
      const list = sectionsObj[key];
      const rows: InspectionPhoto[][] = [];
      for (let i = 0; i < list.length; i += numColumns) rows.push(list.slice(i, i + numColumns));
      return { title: key, count: list.length, data: rows };
    });
  }, [photos, numColumns]);

  const renderPhotoContent = (item: InspectionPhoto) => {
    const isPending = item.photo_url.startsWith('file://');
    return (
      <TouchableOpacity
        key={item.id}
        style={[s.cell, { width: cellSize, height: cellSize, backgroundColor: C.backgroundTertiary }]}
        onLongPress={() => onPhotoLongPress(item)}
        activeOpacity={0.8}
      >
        <ResilientPhoto photoId={item.id} uri={item.photo_url} style={s.image} contentFit="cover" />
        {item.caption && (
          <View style={s.captionOverlay}>
            <Text style={s.captionText} numberOfLines={1}>{item.caption}</Text>
          </View>
        )}
        {isPending && (
          <View style={[s.pendingBadge, { backgroundColor: C.accent, shadowColor: T.black }]}>
            <MaterialCommunityIcons name="timer-sand" size={10} color={T.textOnPrimary} />
          </View>
        )}
      </TouchableOpacity>
    );
  };

  if (photos.length === 0) {
    return (
      <View style={s.emptyState}>
        <MaterialCommunityIcons name="camera-outline" size={64} color={C.borderStrong} />
        <Text style={[s.emptyTitle, { color: C.text }]}>No photos yet</Text>
        <Text style={[s.emptySub, { color: C.textSecondary }]}>Document the site with photos for your compliance report</Text>
      </View>
    );
  }

  return (
    <SectionList
      sections={sections}
      keyExtractor={(row, index) => (row[0]?.id ?? index.toString())}
      contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 100 }}
      renderSectionHeader={({ section: { title, count } }) => (
        <View style={s.sectionHeader}>
          <Text style={[s.sectionTitle, { color: C.text }]}>{title}</Text>
          <View style={[s.countBadge, { backgroundColor: C.backgroundTertiary }]}>
            <Text style={[s.countText, { color: C.textSecondary }]}>{count}</Text>
          </View>
        </View>
      )}
      renderItem={({ item: row }) => (
        <View style={s.gridContainer}>
          {row.map(photo => renderPhotoContent(photo))}
        </View>
      )}
    />
  );
}

const s = StyleSheet.create({
  sectionHeader: { flexDirection: 'row', alignItems: 'center', marginTop: 24, marginBottom: 12, gap: 8 },
  sectionTitle: { fontSize: 16, fontWeight: '700' },
  countBadge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 12 },
  countText: { fontSize: 12, fontWeight: '800' },
  gridContainer: { flexDirection: 'row', flexWrap: 'wrap', gap: GRID_GAPS },
  cell: { borderRadius: 12, overflow: 'hidden' },
  image: { width: '100%', height: '100%' },
  captionOverlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: T.controlButtonBg,
    paddingHorizontal: 4,
    paddingVertical: 4,
  },
  captionText: { color: T.textOnPrimary, fontSize: 10 },
  pendingBadge: {
    position: 'absolute',
    top: 4,
    right: 4,
    width: 16,
    height: 16,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 1.41,
    elevation: 2,
  },
  emptyState: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 32 },
  emptyTitle: { fontSize: 20, fontWeight: '800', marginTop: 16, marginBottom: 8 },
  emptySub: { fontSize: 14, textAlign: 'center', lineHeight: 21 },
});
