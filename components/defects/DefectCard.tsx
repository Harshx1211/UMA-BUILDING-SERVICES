import React, { useMemo } from 'react';
import { View, StyleSheet, TouchableOpacity, FlatList } from 'react-native';
import { Text } from 'react-native-paper';
import { Defect } from '@/types';
import { useColors } from '@/hooks/useColors';
import { cardShadow } from '@/components/ui/Card';
import { DefectSeverity, DefectStatus } from '@/constants/Enums';
import { Image } from 'expo-image';

interface Props {
  defect: Defect & { asset_type?: string; location_on_site?: string };
  onEdit?: () => void;
}

export default function DefectCard({ defect, onEdit }: Props) {
  const C = useColors();

  const borderColor = useMemo(() => {
    switch (defect.severity) {
      case DefectSeverity.Critical: return C.error;
      case DefectSeverity.Major: return C.warning;
      case DefectSeverity.Minor: return C.info;
      default: return C.border;
    }
  }, [defect.severity, C]);

  const severityBadge = useMemo(() => {
    switch (defect.severity) {
      case DefectSeverity.Critical:
        return { text: '🔴 Critical', bg: C.error };
      case DefectSeverity.Major:
        return { text: '🟡 Major', bg: C.warning };
      case DefectSeverity.Minor:
        return { text: '🔵 Minor', bg: C.info };
      default:
        return { text: 'Unknown', bg: C.border };
    }
  }, [defect.severity, C]);

  const statusBadge = useMemo(() => {
    switch (defect.status) {
      case DefectStatus.Open:
        return { text: 'Open', color: C.error, border: true };
      case DefectStatus.Monitoring:
        return { text: 'Monitoring', color: C.warning, border: true };
      case DefectStatus.Quoted:
        return { text: 'Quoted', color: C.info, border: true };
      case DefectStatus.Repaired:
        return { text: '✅ Repaired', color: C.success, bg: C.successLight || C.success + '20', border: false };
      default:
        return { text: 'Unknown', color: C.text, border: true };
    }
  }, [defect.status, C]);

  let photosArr: string[] = [];
  try {
    photosArr = typeof defect.photos === 'string' ? JSON.parse(defect.photos) : (defect.photos || []);
  } catch {
    // ignore
  }

  return (
    <View style={[s.card, { borderLeftColor: borderColor, backgroundColor: C.surface }, cardShadow]}>
      <View style={s.headerRow}>
        <View style={[s.severityBadge, { backgroundColor: severityBadge.bg }]}>
          <Text style={s.severityText}>{severityBadge.text}</Text>
        </View>
        <View style={[s.statusBadge, statusBadge.bg && { backgroundColor: statusBadge.bg }, statusBadge.border && { borderWidth: 1, borderColor: statusBadge.color }]}>
          <Text style={[s.statusText, { color: statusBadge.border ? statusBadge.color : C.successDark || C.success }]}>
            {statusBadge.text}
          </Text>
        </View>
      </View>

      {defect.asset_type && (
        <View style={s.assetRow}>
          <View style={[s.assetPill, { backgroundColor: C.backgroundSecondary }]}>
            <Text style={[s.assetPillText, { color: C.textSecondary }]}>🔧 {defect.asset_type} — {defect.location_on_site || 'No Location'}</Text>
          </View>
        </View>
      )}

      <Text style={[s.description, { color: C.text }]}>{defect.description}</Text>

      {photosArr.length > 0 && (
        <FlatList
          data={photosArr}
          horizontal
          keyExtractor={(item) => item}
          showsHorizontalScrollIndicator={false}
          style={s.photoList}
          contentContainerStyle={{ gap: 8 }}
          renderItem={({ item }) => (
            <TouchableOpacity activeOpacity={0.9}>
              <Image source={{ uri: item }} style={s.thumbnail} contentFit="cover" />
            </TouchableOpacity>
          )}
        />
      )}

      <View style={s.footerRow}>
        <Text style={[s.dateText, { color: C.textTertiary }]}>📅 {new Date(defect.created_at).toLocaleDateString()}</Text>
        <TouchableOpacity style={s.editBtn} onPress={onEdit} hitSlop={10}>
          <Text style={[s.editBtnText, { color: C.accent }]}>Edit</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  card: {
    borderRadius: 16,
    marginHorizontal: 16,
    marginBottom: 10,
    padding: 16,
    borderLeftWidth: 4,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  severityBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 20,
  },
  severityText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 11,
  },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 20,
  },
  statusText: {
    fontWeight: '700',
    fontSize: 11,
  },
  assetRow: {
    marginBottom: 8,
    flexDirection: 'row',
  },
  assetPill: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  assetPillText: {
    fontSize: 12,
    fontWeight: '600',
  },
  description: {
    fontSize: 14,
    lineHeight: 20,
    marginTop: 8,
  },
  photoList: {
    marginTop: 12,
  },
  thumbnail: {
    width: 60,
    height: 60,
    borderRadius: 8,
  },
  footerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 16,
  },
  dateText: {
    fontSize: 12,
  },
  editBtn: {
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  editBtnText: {
    fontWeight: '600',
    fontSize: 13,
  },
});
