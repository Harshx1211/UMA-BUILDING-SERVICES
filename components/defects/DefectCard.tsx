import React, { useMemo } from 'react';
import { View, StyleSheet, TouchableOpacity, FlatList, StyleProp, ViewStyle } from 'react-native';
import { Text } from '@/components/ui/AppText';
import { Defect } from '@/types';
import { useColors } from '@/hooks/useColors';
import { T } from '@/constants/Colors';
import { cardShadow } from '@/components/ui/Card';
import { DefectSeverity, DefectStatus } from '@/constants/Enums';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { findDefectCode } from '@/constants/DefectCodes';
import ResilientPhoto from '@/components/camera/ResilientPhoto';
import { formatAssetType, formatLocationCode } from '@/utils/assetHelpers';
import { stripPrices } from '@/utils/prices';
import { queryRecords } from '@/lib/database';

interface Props {
  defect: Defect & { asset_type?: string; location_on_site?: string };
  onPress?: () => void;
  onEdit?: () => void;
  /** Overrides this card's own list-level spacing — for embedding it inside
   * a screen that already provides its own horizontal padding (e.g. an
   * asset's own defects list), where the default marginHorizontal would
   * double up. */
  style?: StyleProp<ViewStyle>;
}

export default function DefectCard({ defect, onPress, onEdit, style }: Props) {
  const C = useColors();

  const borderColor = useMemo(() => {
    switch (defect.severity) {
      case DefectSeverity.Critical: return C.error;
      case DefectSeverity.NonCritical: return C.warning;
      case DefectSeverity.NonConformance: return C.info;
      default: return C.border;
    }
  }, [defect.severity, C]);

  const severityBadge = useMemo(() => {
    switch (defect.severity) {
      case DefectSeverity.Critical:       return { text: 'Critical', bg: C.error };
      case DefectSeverity.NonCritical:    return { text: 'Non-critical', bg: C.warning };
      case DefectSeverity.NonConformance: return { text: 'Non-conformance', bg: C.info };
      default: return { text: 'Unknown', bg: C.border };
    }
  }, [defect.severity, C]);

  const statusBadge = useMemo((): { text: string; color: string; bg?: string; border: boolean } => {
    switch (defect.status) {
      case DefectStatus.Open:       return { text: 'Open',       color: C.error,   border: true };
      case DefectStatus.Monitoring: return { text: 'Monitoring', color: C.warning, border: true };
      case DefectStatus.Quoted:     return { text: 'Quoted',     color: C.info,    border: true };
      case DefectStatus.Repaired:   return { text: 'Repaired',   color: C.success, bg: C.successLight ?? T.tintBg(C.success), border: false };
      default: return { text: 'Unknown', color: C.text, border: true };
    }
  }, [defect.status, C]);

  // Defect code info
  const codeInfo = useMemo(() =>
    defect.defect_code ? findDefectCode(defect.defect_code) : null,
  [defect.defect_code]);

  // FIX: the flat `defects.photos` mirror keeps the capturing phone's own
  // file:// paths (the upload rewrites inspection_photos.photo_url, never the
  // mirror), so on any other device every thumbnail here was a broken image.
  // Prefer the real inspection_photos rows for this defect — uploaded https
  // links, or the local file on the phone that took them — and only fall
  // back to the mirror when there are no rows yet.
  const photosArr = useMemo((): string[] => {
    const rows = queryRecords<{ photo_url: string | null; uploaded_at: string | null }>(
      'inspection_photos', { defect_id: defect.id },
    ).filter((r) => !!r.photo_url);
    if (rows.length > 0) {
      return rows
        .sort((a, b) => (a.uploaded_at ?? '').localeCompare(b.uploaded_at ?? ''))
        .map((r) => r.photo_url as string);
    }
    try {
      return typeof defect.photos === 'string' ? JSON.parse(defect.photos) : (defect.photos || []);
    } catch { return []; }
  }, [defect.id, defect.photos]);

  return (
    <TouchableOpacity
      style={[s.card, { borderColor: C.border, borderLeftColor: borderColor, backgroundColor: C.surface }, cardShadow, style]}
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
            <View style={[s.codeBadge, { backgroundColor: T.tintBg(C.primary), borderColor: T.tintBorder(C.primary) }]}>
              <Text style={[s.codeBadgeTxt, { color: C.primary }]}>{codeInfo.code.toUpperCase()}</Text>
            </View>
          )}
          <View style={[
            s.statusBadge,
            statusBadge.bg && { backgroundColor: statusBadge.bg },
            statusBadge.border && { borderWidth: 1, borderColor: statusBadge.color },
          ]}>
            <Text style={[s.statusText, { color: statusBadge.border ? statusBadge.color : (C.successDark ?? C.success) }]}>
              {statusBadge.text}
            </Text>
          </View>
        </View>
      </View>

      {/* Resolved on site — informational only, independent of status above
          (see defectsStore's resolved_on_site comment). Data's already on
          this object; the full Before/After photo split lives one tap away
          on the detail screen (defects/[defectId].tsx). */}
      {defect.resolved_on_site && (
        <View style={s.resolvedRow}>
          <MaterialCommunityIcons name="check-decagram-outline" size={12} color={C.success} />
          <Text style={[s.resolvedText, { color: C.success }]}>Resolved on site</Text>
        </View>
      )}

      {/* Asset pill */}
      {defect.asset_type && (
        <View style={s.assetRow}>
          <View style={[s.assetPill, { backgroundColor: C.backgroundSecondary }]}>
            <MaterialCommunityIcons name="tools" size={11} color={C.textSecondary} />
            <Text style={[s.assetPillText, { color: C.textSecondary }]}>
              {formatAssetType(defect.asset_type ?? '')} — {defect.location_on_site ? formatLocationCode(defect.location_on_site) : 'No location'}
            </Text>
          </View>
        </View>
      )}

      {/* Description */}
      <Text style={[s.description, { color: C.text }]} numberOfLines={2}>{stripPrices(defect.description)}</Text>

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
            // FIX: was a raw expo-image <Image> reading straight off
            // defects.photos (a flat URL-only mirror with no row id) — a
            // defect can sit open/unresolved for months, long enough for
            // an old signed URL to expire, and this card had no way to
            // self-heal that the way the defect detail screen (which reads
            // real inspection_photos rows) already does. ResilientPhoto
            // now resolves the id itself by matching the URL when one
            // isn't passed in — see its own comment.
            <ResilientPhoto uri={item} style={s.thumbnail} contentFit="cover" />
          )}
        />
      )}

      {/* Footer */}
      <View style={s.footerRow}>
        <View style={s.dateRow}>
          <MaterialCommunityIcons name="calendar-outline" size={12} color={C.textTertiary} />
          <Text style={[s.dateText, { color: C.textTertiary }]}>
            {new Date(defect.created_at).toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' })}
          </Text>
        </View>
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
    borderRadius: 14,
    marginHorizontal: 16,
    marginBottom: 12,
    padding: 16,
    borderWidth: 1,
    borderLeftWidth: 4,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  severityBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20 },
  severityText:  { color: T.textOnPrimary, fontWeight: '600', fontSize: 12 },

  codeBadge: {
    paddingHorizontal: 7, paddingVertical: 3,
    borderRadius: 7, borderWidth: 1,
  },
  codeBadgeTxt: { fontSize: 12, fontWeight: '700', letterSpacing: 0.3 },

  statusBadge: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 20 },
  statusText:  { fontWeight: '600', fontSize: 12 },

  resolvedRow: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 8 },
  resolvedText: { fontSize: 12, fontWeight: '600' },

  assetRow: { marginBottom: 8, flexDirection: 'row' },
  assetPill: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 12 },
  assetPillText: { fontSize: 13, fontWeight: '600' },

  description: { fontSize: 15, lineHeight: 21, marginTop: 4 },

  priceBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    marginTop: 8, alignSelf: 'flex-start',
    paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8, borderWidth: 1,
  },
  priceTxt: { fontSize: 11, fontWeight: '700' },

  photoList: { marginTop: 12 },
  thumbnail: { width: 64, height: 64, borderRadius: 10 },

  footerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 14,
  },
  dateRow:  { flexDirection: 'row', alignItems: 'center', gap: 4 },
  dateText: { fontSize: 12 },
  footerActions: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  viewBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: 10, paddingVertical: 5, borderRadius: 10,
  },
  viewBtnTxt: { fontSize: 12, fontWeight: '700' },
  editBtn: { paddingHorizontal: 8, paddingVertical: 4 },
  editBtnText: { fontWeight: '700', fontSize: 14 },
});
