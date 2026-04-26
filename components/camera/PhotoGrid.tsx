import React from 'react';
import { View, StyleSheet, Dimensions, TouchableOpacity, SectionList } from 'react-native';
import { Text } from 'react-native-paper';
import { InspectionPhoto } from '@/types';
import { useColors } from '@/hooks/useColors';
import { Image } from 'expo-image';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { getValidLocalUri } from '@/utils/fileHelpers';

interface Props {
  photos: InspectionPhoto[];
  onPhotoLongPress: (photo: InspectionPhoto) => void;
}

const { width } = Dimensions.get('window');
const GRID_GAPS = 8;
const numColumns = 3;
const CELL_SIZE = (width - 32 - (GRID_GAPS * (numColumns - 1))) / numColumns;

export default function PhotoGrid({ photos, onPhotoLongPress }: Props) {
  const C = useColors();

  // Grouping logic
  const sectionsObj = photos.reduce((acc, photo) => {
    // If we had asset name, we'd use it here. 
    // The prompt says "Sub-grouped by asset name". 
    // We only have `asset_id` in InspectionPhoto. Let's group by `asset_id` or "Site Photos (General)".
    // A clean way is just showing "Asset: [id]" for now, since we'd need to join assets to get the real name.
    const key = photo.asset_id ? `Asset Photos (${photo.asset_id.substring(0,6)})` : 'Site Photos (General)';
    if (!acc[key]) acc[key] = [];
    acc[key].push(photo);
    return acc;
  }, {} as Record<string, InspectionPhoto[]>);

  const sections = Object.keys(sectionsObj).map(key => ({
    title: key,
    data: [{ list: sectionsObj[key] }] // FlatList or grid wrapper inside section list
  }));

  const renderPhotoContent = (item: InspectionPhoto) => {
    const isPending = item.photo_url.startsWith('file://');
    return (
      <TouchableOpacity 
        key={item.id} 
        style={[s.cell, { backgroundColor: C.backgroundTertiary }]} 
        onLongPress={() => onPhotoLongPress(item)}
        activeOpacity={0.8}
      >
        <Image source={{ uri: getValidLocalUri(item.photo_url) }} style={s.image} contentFit="cover" />
        {item.caption && (
          <View style={s.captionOverlay}>
            <Text style={s.captionText} numberOfLines={1}>{item.caption}</Text>
          </View>
        )}
        {isPending && (
          <View style={[s.pendingBadge, { backgroundColor: C.accent, shadowColor: '#000' }]}>
            <MaterialCommunityIcons name="timer-sand" size={10} color="#FFF" />
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
      keyExtractor={(item, index) => index.toString()}
      contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 100 }}
      renderSectionHeader={({ section: { title, data } }) => (
        <View style={s.sectionHeader}>
          <Text style={[s.sectionTitle, { color: C.text }]}>{title}</Text>
          <View style={[s.countBadge, { backgroundColor: C.backgroundTertiary }]}>
            <Text style={[s.countText, { color: C.textSecondary }]}>{data[0].list.length}</Text>
          </View>
        </View>
      )}
      renderItem={({ item }) => (
        <View style={s.gridContainer}>
          {item.list.map(photo => renderPhotoContent(photo))}
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
  cell: { width: CELL_SIZE, height: CELL_SIZE, borderRadius: 12, overflow: 'hidden' },
  image: { width: '100%', height: '100%' },
  captionOverlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'rgba(0,0,0,0.6)',
    paddingHorizontal: 4,
    paddingVertical: 4,
  },
  captionText: { color: '#FFF', fontSize: 10 },
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
