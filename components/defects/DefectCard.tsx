import React, { useMemo } from 'react';
import { View, StyleSheet, TouchableOpacity, FlatList } from 'react-native';
import { Text } from 'react-native-paper';
import { Defect } from '@/types';
import { useColors } from '@/hooks/useColors';
import { cardShadow } from '@/components/ui/Card';
import { DefectSeverity, DefectStatus } from '@/constants/Enums';
import { Image } from 'expo-image';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { findDefectCode } from '@/constants/DefectCodes';
import { getValidLocalUri } from '@/utils/fileHelpers';

interface Props {
  defect: Defect & { asset_type?: string; location_on_site?: string };
  onPress?: () => void;
  onEdit?: () => void;
}

export default function DefectCard({ defect, onPress, onEdit }: Props) {
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
      case DefectSeverity.Critical: return { text: '🔴 Critical', bg: C.error };
      case DefectSeverity.Major:    return { text: '🟡 Major',    bg: C.warning };
      case DefectSeverity.Minor:    return { text: '🔵 Minor',    bg: C.info };
      default: return { text: 'Unknown', bg: C.border };
    }
  }, [defect.severity, C]);

  const statusBadge = useMemo(() => {
    switch (defect.status) {
      case DefectStatus.Open:       return { text: 'Open',         color: C.error,   border: true };
      case DefectStatus.Monitoring: return { text: 'Monitoring',   color: C.warning, border: true };
      case DefectStatus.Quoted:     return { text: 'Quoted',       color: C.info,    border: true };
      case DefectStatus.Repaired:   return { text: '✅ Repaired',  color: C.success, bg: C.successLight || C.success + '20', border: false };
      default: return { text: 'Unknown', color: C.text, border: true };
    }
  }, [defect.status, C]);

  // Defect code info
  const codeInfo = useMemo(() =>
    defect.defect_code ? findDefectCode(defect.defect_code) : null,
  [defect.defect_code]);

  let photosArr: string[] = [];
  try {
    photosArr = typeof defect.photos === 'string' ? JSON.parse(defect.photos) : (defect.photos || []);
  } catch { /* ignore */ }

  return (
    <TouchableOpacity
      style={[s.card, { borderLeftColor: borderColor, backgroundColor: C.surface }, cardShadow]}
      onPress={onPress}
      activeOpacity={onPress ? 0.78 : 1}
    >
      {/* Header row: severity + status */}
      <View style={s.headerRow}>
        <View style={[s.severityBadge, { backgroundColor: severityBadge.bg }]}>
          <Text style={s.severityText}>{severityBadge.text}</Text>
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          {/* Code badge */}
          {codeInfo && (
            <View style={[s.codeBadge, { backgroundColor: C.primary + '12', borderColor: C.primary + '30' }]}>
              <Text style={[s.codeBadgeTxt, { color: C.primary }]}>{codeInfo.code.toUpperCase()}</Text>
            </View>
          )}
          <View style={[
            s.statusBadge,
            (statusBadge as any).bg && { backgroundColor: (statusBadge as any).bg },
            statusBadge.border && { borderWidth: 1, borderColor: statusBadge.color },
          ]}>
            <Text style={[s.statusText, { color: statusBadge.border ? statusBadge.color : C.successDark || C.success }]}>
              {statusBadge.text}
            </Text>
          </View>
        </View>
      </View>

      {/* Asset pill */}
      {defect.asset_type && (
        <View style={s.assetRow}>
          <View style={[s.assetPill, { backgroundColor: C.backgroundSecondary }]}>
            <Text style={[s.assetPillText, { color: C.textSecondary }]}>🔧 {defect.asset_type} — {defect.location_on_site || 'No Location'}</Text>
          </View>
        </View>
      )}

      {/* Description */}
      <Text style={[s.description, { color: C.text }]} numberOfLines={2}>{defect.description}</Text>

      {/* Price badge */}
      {defect.quote_price != null && (
        <View style={[s.priceBadge, { backgroundColor: '#10B981' + '12', borderColor: '#10B981' + '30' }]}>
          <MaterialCommunityIcons name="tag-outline" size={11} color="#10B981" />
          <Text style={s.priceTxt}>Ref: ${defect.quote_price}</Text>
        </View>
      )}

      {/* Photo thumbnails */}
      {photosArr.length > 0 && (
        <FlatList
          data={photosArr}
          horizontal
          keyExtractor={(item) => item}
          showsHorizontalScrollIndicator={false}
          style={s.photoList}
          contentContainerStyle={{ gap: 8 }}
          renderItem={({ item }) => (
            <Image source={{ uri: getValidLocalUri(item) }} style={s.thumbnail} contentFit="cover" />
          )}
        />
      )}

      {/* Footer */}
      <View style={s.footerRow}>
        <Text style={[s.dateText, { color: C.textTertiary }]}>
          📅 {new Date(defect.created_at).toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' })}
        </Text>
        <View style={s.footerActions}>
          {onPress && (
            <TouchableOpacity style={[s.viewBtn, { backgroundColor: C.backgroundTertiary }]} onPress={onPress} hitSlop={8}>
              <MaterialCommunityIcons name="eye-outline" size={13} color={C.primary} />
              <Text style={[s.viewBtnTxt, { color: C.primary }]}>View</Text>
            </TouchableOpacity>
          )}
          {onEdit && (
            <TouchableOpacity style={s.editBtn} onPress={onEdit} hitSlop={10}>
              <Text style={[s.editBtnText, { color: C.accent }]}>Edit</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
    </TouchableOpacity>
  );
}

const s = StyleSheet.create({
  card: {
    borderRadius: 16,
    marginHorizontal: 16,
    marginBottom: 14,
    padding: 18,
    borderLeftWidth: 5,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  severityBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20 },
  severityText:  { color: '#FFFFFF', fontWeight: '700', fontSize: 11 },

  codeBadge: {
    paddingHorizontal: 7, paddingVertical: 3,
    borderRadius: 7, borderWidth: 1,
  },
  codeBadgeTxt: { fontSize: 10, fontWeight: '800', letterSpacing: 0.3 },

  statusBadge: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 20 },
  statusText:  { fontWeight: '800', fontSize: 11, letterSpacing: 0.2 },

  assetRow: { marginBottom: 8, flexDirection: 'row' },
  assetPill: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 12 },
  assetPillText: { fontSize: 12, fontWeight: '700' },

  description: { fontSize: 14, lineHeight: 20, marginTop: 4 },

  priceBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    marginTop: 8, alignSelf: 'flex-start',
    paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8, borderWidth: 1,
  },
  priceTxt: { fontSize: 11, fontWeight: '700', color: '#10B981' },

  photoList: { marginTop: 12 },
  thumbnail: { width: 60, height: 60, borderRadius: 8 },

  footerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 14,
  },
  dateText: { fontSize: 12 },
  footerActions: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  viewBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: 10, paddingVertical: 5, borderRadius: 10,
  },
  viewBtnTxt: { fontSize: 12, fontWeight: '700' },
  editBtn: { paddingHorizontal: 8, paddingVertical: 4 },
  editBtnText: { fontWeight: '800', fontSize: 14 },
});
