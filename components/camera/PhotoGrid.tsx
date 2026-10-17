import React, { useMemo, useState } from 'react';
import { View, StyleSheet, useWindowDimensions, TouchableOpacity, SectionList, Modal } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Text } from '@/components/ui/AppText';
import { InspectionPhoto } from '@/types';
import { useColors } from '@/hooks/useColors';
import { T } from '@/constants/Colors';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { queryRecordsIn, getFailedPhotoUploadIds } from '@/lib/database';
import ResilientPhoto from '@/components/camera/ResilientPhoto';
import { useResponsive } from '@/hooks/useResponsive';
import { formatAssetName, formatLocationCode } from '@/utils/assetHelpers';

interface Props {
  photos: InspectionPhoto[];
  onPhotoLongPress: (photo: InspectionPhoto) => void;
}

const GRID_GAPS = 8;

// FIX: was a module-level Dimensions.get('window') read once at import time
// — the grid never adapted to a tablet's larger width (fixed 3 columns of
// tiny cells) or to rotation (stale size after turning the device). Now
// derived per-render from useWindowDimensions(), which re-renders on both.
// FIX 2: this used its own independently-tuned breakpoints (600/900) instead
// of the app's canonical 700px tablet threshold (useResponsive) — a device
// just under 700px would count as "tablet" everywhere else in the app but
// still get phone-style 3 columns here. Anchored on isTablet so this grid
// can't drift out of sync with the rest of the app's tablet definition.
function getNumColumns(width: number, isTablet: boolean) {
  if (!isTablet) return 3;
  return width >= 1000 ? 5 : 4;
}

// FIX: this cell used to be an inline function recreated on every render of
// the parent, rendered via a plain .map() — so ANY single photo's state
// change (an upload completing, a caption edit) re-rendered every cell in
// the entire grid, not just the one that actually changed. During a sync
// burst after taking 10 photos (uploads completing one-by-one over several
// seconds), this meant a full-grid re-render per completion — wasted work
// that can visibly stutter on a job with 100+ photos. React.memo with a
// comparator on only the fields that actually affect this cell's rendering
// (not the whole `photo` object reference, which changes on every store
// update regardless) means an unrelated photo's change no longer re-renders
// this one.
const PhotoCell = React.memo(function PhotoCell({
  item, cellSize, isFailed, onLongPress, onPress,
}: {
  item: InspectionPhoto;
  cellSize: number;
  isFailed: boolean;
  onLongPress: () => void;
  onPress: () => void;
}) {
  const C = useColors();
  const isPending = item.photo_url.startsWith('file://');
  return (
    <TouchableOpacity
      style={[s.cell, { width: cellSize, height: cellSize, backgroundColor: C.backgroundTertiary }]}
      onLongPress={onLongPress}
      onPress={onPress}
      activeOpacity={0.8}
      accessibilityRole="imagebutton"
      accessibilityHint="Opens the photo. Long-press to delete."
    >
      <ResilientPhoto photoId={item.id} uri={item.photo_url} style={s.image} contentFit="cover" />
      {item.caption && (
        <View style={s.captionOverlay}>
          <Text style={s.captionText} numberOfLines={1}>{item.caption}</Text>
        </View>
      )}
      {isFailed ? (
        <View style={[s.pendingBadge, { backgroundColor: C.error, shadowColor: T.black }]}>
          <MaterialCommunityIcons name="alert" size={10} color={T.textOnPrimary} />
        </View>
      ) : isPending && (
        <View style={[s.pendingBadge, { backgroundColor: C.accent, shadowColor: T.black }]}>
          <MaterialCommunityIcons name="timer-sand" size={10} color={T.textOnPrimary} />
        </View>
      )}
    </TouchableOpacity>
  );
}, (prev, next) =>
  prev.item.id === next.item.id &&
  prev.item.photo_url === next.item.photo_url &&
  prev.item.caption === next.item.caption &&
  prev.cellSize === next.cellSize &&
  prev.isFailed === next.isFailed
);

export default function PhotoGrid({ photos, onPhotoLongPress }: Props) {
  const C = useColors();
  const insets = useSafeAreaInsets();
  // Tap opens the photo full screen (it did nothing before — only a
  // long-press, to delete, did anything).
  const [viewing, setViewing] = useState<InspectionPhoto | null>(null);
  const { width } = useWindowDimensions();
  const { isTablet } = useResponsive();
  const numColumns = getNumColumns(width, isTablet);
  const cellSize = (width - 32 - (GRID_GAPS * (numColumns - 1))) / numColumns;

  // FIX: this used to call getRecord('assets', ...) — a synchronous SQLite
  // hit — once PER PHOTO, on every render (the grouping ran directly in the
  // render body, not memoized), so a job with 100+ photos fired 100+
  // queries on every single re-render, not just mount. Batched into one
  // queryRecordsIn call and memoized so it only re-runs when the photo list
  // itself actually changes.
  const sections = useMemo(() => {
    const assetIds = [...new Set(photos.map((p) => p.asset_id).filter((id): id is string => !!id))];
    const assets = queryRecordsIn<{ id: string; asset_type: string; variant: string | null; location_on_site: string }>(
      'assets', 'id', assetIds,
    );
    const assetById = new Map(assets.map((a) => [a.id, a]));

    const sectionsObj: Record<string, InspectionPhoto[]> = {};
    for (const photo of photos) {
      let key = 'Site photos (general)';
      if (photo.asset_id) {
        const asset = assetById.get(photo.asset_id);
        key = asset
          ? [formatAssetName(asset.asset_type, asset.variant), asset.location_on_site ? formatLocationCode(asset.location_on_site) : null].filter(Boolean).join(' · ')
          : `Asset photos (${photo.asset_id.substring(0, 6)})`;
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

  // FIX: a photo whose upload has been permanently abandoned (retry budget
  // exhausted, or a terminal error) used to look IDENTICAL to one that's
  // simply mid-upload — both just checked `photo_url.startsWith('file://')`
  // and got the same amber "still syncing" clock badge. For a compliance
  // product, a photo that will never reach the server (so will never make
  // it into the PDF report) needs to be loudly flagged, not indistinguishable
  // from normal, temporary pending state. getFailedPhotoUploadIds() takes no
  // arguments (it queries sync_queue directly) — `photos` is intentionally
  // kept as the invalidation trigger so this re-checks on every reload
  // (i.e. after each sync cycle), not because it's read inside the callback.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const failedIds = useMemo(() => getFailedPhotoUploadIds(), [photos]);

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
    <>
    <SectionList
      sections={sections}
      keyExtractor={(row, index) => (row[0]?.id ?? index.toString())}
      contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 100 }}
      renderSectionHeader={({ section: { title, count } }) => (
        <View style={s.sectionHeader}>
          <Text style={[s.sectionTitle, { color: C.text }]}>{title}</Text>
          <View style={s.countBadge}>
            <Text style={[s.countText, { color: C.textSecondary }]}>{count}</Text>
          </View>
        </View>
      )}
      renderItem={({ item: row }) => (
        <View style={s.gridContainer}>
          {row.map(photo => (
            <PhotoCell
              key={photo.id}
              item={photo}
              cellSize={cellSize}
              isFailed={photo.photo_url.startsWith('file://') && failedIds.has(photo.id)}
              onLongPress={() => onPhotoLongPress(photo)}
              onPress={() => setViewing(photo)}
            />
          ))}
        </View>
      )}
    />
    <Modal visible={!!viewing} transparent animationType="fade" onRequestClose={() => setViewing(null)}>
      <View style={s.viewer}>
        {viewing ? (
          <ResilientPhoto photoId={viewing.id} uri={viewing.photo_url} style={s.viewerImage} contentFit="contain" />
        ) : null}
        {viewing?.caption ? (
          <Text style={[s.viewerCaption, { bottom: 24 + insets.bottom }]}>{viewing.caption}</Text>
        ) : null}
        <TouchableOpacity
          style={[s.viewerClose, { top: 12 + insets.top }]}
          onPress={() => setViewing(null)}
          hitSlop={10}
          accessibilityRole="button"
          accessibilityLabel="Close photo"
        >
          <MaterialCommunityIcons name="close" size={24} color={T.textOnPrimary} />
        </TouchableOpacity>
      </View>
    </Modal>
    </>
  );
}

const s = StyleSheet.create({
  sectionHeader: { flexDirection: 'row', alignItems: 'center', marginTop: 24, marginBottom: 12, gap: 8 },
  sectionTitle: { fontSize: 16, fontWeight: '700' },
  countBadge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 12, backgroundColor: T.surface, borderWidth: 1, borderColor: T.border },
  countText: { fontSize: 12, fontWeight: '700' },
  // Same gap between rows as between columns (rows used to touch).
  gridContainer: { flexDirection: 'row', flexWrap: 'wrap', gap: GRID_GAPS, marginBottom: GRID_GAPS },
  viewer: { flex: 1, backgroundColor: 'rgba(0,0,0,0.94)', justifyContent: 'center' },
  viewerImage: { width: '100%', height: '80%', backgroundColor: 'transparent' },
  viewerClose: { position: 'absolute', right: 16, width: 44, height: 44, borderRadius: 22, backgroundColor: 'rgba(255,255,255,0.16)', alignItems: 'center', justifyContent: 'center' },
  viewerCaption: { position: 'absolute', left: 16, right: 16, color: T.textOnPrimary, fontSize: 15, textAlign: 'center' },
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
  captionText: { color: T.textOnPrimary, fontSize: 11 },
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
