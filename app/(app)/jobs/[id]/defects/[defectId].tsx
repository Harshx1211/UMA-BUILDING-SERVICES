/**
 * Defect Detail Screen — app/(app)/jobs/[id]/defects/[defectId].tsx
 * Full view of a single defect with status update, photos lightbox, and edit/delete.
 */
import React, { useEffect, useState, useCallback } from 'react';
import {
  View, StyleSheet, ScrollView, TouchableOpacity, Modal,
  Alert, Platform, Image,
} from 'react-native';
import { Text, ActivityIndicator } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import Animated, { FadeInDown } from 'react-native-reanimated';
import Toast from 'react-native-toast-message';
import { useColors } from '@/hooks/useColors';
import { ScreenHeader, Button } from '@/components/ui';
import { cardShadow } from '@/components/ui/Card';
import { getDefectById } from '@/lib/database';
import { useDefectsStore } from '@/store/defectsStore';
import { DefectSeverity, DefectStatus } from '@/constants/Enums';
import { findDefectCode } from '@/constants/DefectCodes';
import { formatAssetType } from '@/utils/assetHelpers';
import { getValidLocalUri } from '@/utils/fileHelpers';

type FullDefect = {
  id: string;
  job_id: string;
  asset_id: string;
  property_id: string;
  description: string;
  severity: DefectSeverity;
  status: DefectStatus;
  photos: string;
  created_at: string;
  defect_code?: string | null;
  quote_price?: number | null;
  asset_type?: string;
  location_on_site?: string;
  serial_number?: string;
  property_name?: string;
  scheduled_date?: string;
};

const SEVERITY_CONFIG: Record<DefectSeverity, { color: string; label: string; icon: string; bg: string }> = {
  [DefectSeverity.Critical]: { color: '#DC2626', label: 'Critical', icon: 'alert-octagon',        bg: '#FEE2E2' },
  [DefectSeverity.Major]:    { color: '#EA580C', label: 'Major',    icon: 'alert',                bg: '#FFEDD5' },
  [DefectSeverity.Minor]:    { color: '#2563EB', label: 'Minor',    icon: 'alert-circle-outline', bg: '#DBEAFE' },
};

const STATUS_OPTIONS: { value: DefectStatus; label: string; color: string; icon: string }[] = [
  { value: DefectStatus.Open,       label: 'Open',       color: '#DC2626', icon: 'alert-circle' },
  { value: DefectStatus.Monitoring, label: 'Monitoring', color: '#D97706', icon: 'eye-outline' },
  { value: DefectStatus.Quoted,     label: 'Quoted',     color: '#2563EB', icon: 'file-document-outline' },
  { value: DefectStatus.Repaired,   label: 'Repaired',   color: '#16A34A', icon: 'check-circle' },
];

export default function DefectDetailScreen() {
  const C = useColors();
  const { id: jobId, defectId } = useLocalSearchParams<{ id: string; defectId: string }>();
  const { updateDefectStatus, deleteDefect } = useDefectsStore();

  const [defect,        setDefect]        = useState<FullDefect | null>(null);
  const [isLoading,     setIsLoading]     = useState(true);
  const [lightboxUri,   setLightboxUri]   = useState<string | null>(null);

  const loadDefect = useCallback(() => {
    if (!defectId) return;
    setIsLoading(true);
    const d = getDefectById<FullDefect>(defectId);
    setDefect(d);
    setIsLoading(false);
  }, [defectId]);

  useEffect(() => { loadDefect(); }, [loadDefect]);

  const handleStatusChange = (status: DefectStatus) => {
    if (!defect) return;
    updateDefectStatus(defect.id, status);
    setDefect(prev => prev ? { ...prev, status } : prev);
    Toast.show({ type: 'success', text1: `Status updated to ${status}` });
  };

  const handleDelete = () => {
    Alert.alert(
      'Delete Defect',
      'This cannot be undone. The defect record will be permanently removed.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => {
            if (!defect) return;
            deleteDefect(defect.id);
            Toast.show({ type: 'success', text1: 'Defect deleted' });
            router.back();
          },
        },
      ],
    );
  };

  if (isLoading) {
    return (
      <View style={[s.center, { backgroundColor: C.background }]}>
        <ActivityIndicator color={C.primary} size="large" />
      </View>
    );
  }

  if (!defect) {
    return (
      <View style={[s.center, { backgroundColor: C.background }]}>
        <Text style={{ fontSize: 40 }}>🔍</Text>
        <Text style={{ color: C.textSecondary, marginTop: 8 }}>Defect not found</Text>
        <View style={{ marginTop: 16 }}>
          <Button title="Go Back" onPress={() => router.back()} />
        </View>
      </View>
    );
  }

  const sev = SEVERITY_CONFIG[defect.severity] ?? SEVERITY_CONFIG[DefectSeverity.Minor];
  const statusOpt = STATUS_OPTIONS.find(s => s.value === defect.status) ?? STATUS_OPTIONS[0];
  const codeInfo = defect.defect_code ? findDefectCode(defect.defect_code) : null;

  let photosArr: string[] = [];
  try {
    photosArr = typeof defect.photos === 'string' ? JSON.parse(defect.photos) : (defect.photos || []);
  } catch { /* ignore */ }

  return (
    <View style={[s.screen, { backgroundColor: C.background }]}>
      <ScreenHeader
        eyebrow="DEFECT RECORD"
        title={defect.asset_type ? formatAssetType(defect.asset_type) : 'Defect Details'}
        subtitle={defect.property_name || defect.location_on_site || ''}
        showBack
        curved
        rightComponent={
          <View
            style={[s.statusChip, { backgroundColor: statusOpt.color + '22', borderColor: statusOpt.color + '55' }]}
          >
            <MaterialCommunityIcons name={statusOpt.icon as any} size={13} color={statusOpt.color} />
            <Text style={[s.statusChipTxt, { color: statusOpt.color }]}>{statusOpt.label.toUpperCase()}</Text>
            <MaterialCommunityIcons name="chevron-down" size={12} color={statusOpt.color} />
          </View>
        }
      />

      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 100 }} showsVerticalScrollIndicator={false}>

        {/* Severity Banner */}
        <Animated.View entering={FadeInDown.delay(40).duration(380)}>
          <View style={[s.sevBanner, { backgroundColor: sev.bg, borderColor: sev.color + '40' }]}>
            <View style={[s.sevIconWrap, { backgroundColor: sev.color }]}>
              <MaterialCommunityIcons name={sev.icon as any} size={22} color="#FFF" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[s.sevLabel, { color: sev.color }]}>{sev.label.toUpperCase()} DEFECT</Text>
              <Text style={[s.sevDate, { color: sev.color + 'AA' }]}>
                Logged {new Date(defect.created_at).toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' })}
              </Text>
            </View>
            {defect.quote_price && (
              <View style={[s.priceBadge, { backgroundColor: '#10B981' + '18', borderColor: '#10B981' + '40' }]}>
                <Text style={s.priceBadgeTxt}>Ref: ${defect.quote_price}</Text>
              </View>
            )}
          </View>
        </Animated.View>

        {/* Code badge */}
        {codeInfo && (
          <Animated.View entering={FadeInDown.delay(70).duration(380)}>
            <View style={[s.codeBanner, { backgroundColor: C.primary + '0D', borderColor: C.primary + '30' }]}>
              <View style={[s.codeIconWrap, { backgroundColor: C.primary + '18' }]}>
                <MaterialCommunityIcons name="tag-outline" size={16} color={C.primary} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[s.codeLabel, { color: C.primary }]}>
                  Code: {codeInfo.code.toUpperCase()} — {codeInfo.category}
                </Text>
                <Text style={[s.codeDesc, { color: C.textSecondary }]} numberOfLines={2}>
                  {codeInfo.description}
                </Text>
              </View>
            </View>
          </Animated.View>
        )}

        {/* Description */}
        <Animated.View entering={FadeInDown.delay(100).duration(380)}>
          <View style={[s.card, { backgroundColor: C.surface, borderColor: C.border }, cardShadow]}>
            <Text style={[s.cardLabel, { color: C.textTertiary }]}>DESCRIPTION</Text>
            <Text style={[s.cardBody, { color: C.text }]}>{defect.description}</Text>
          </View>
        </Animated.View>

        {/* Asset & Location */}
        {(defect.asset_type || defect.location_on_site) && (
          <Animated.View entering={FadeInDown.delay(130).duration(380)}>
            <View style={[s.card, { backgroundColor: C.surface, borderColor: C.border }, cardShadow]}>
              <Text style={[s.cardLabel, { color: C.textTertiary }]}>ASSET</Text>
              {defect.asset_type && (
                <View style={s.infoRow}>
                  <MaterialCommunityIcons name="tools" size={15} color={C.textSecondary} />
                  <Text style={[s.infoTxt, { color: C.text }]}>{formatAssetType(defect.asset_type)}</Text>
                </View>
              )}
              {defect.location_on_site && (
                <View style={s.infoRow}>
                  <MaterialCommunityIcons name="map-marker-outline" size={15} color={C.textSecondary} />
                  <Text style={[s.infoTxt, { color: C.text }]}>{defect.location_on_site}</Text>
                </View>
              )}
              {defect.serial_number && (
                <View style={s.infoRow}>
                  <MaterialCommunityIcons name="barcode" size={15} color={C.textSecondary} />
                  <Text style={[s.infoTxt, { color: C.textSecondary }]}>S/N: {defect.serial_number}</Text>
                </View>
              )}
            </View>
          </Animated.View>
        )}

        {/* Photos */}
        {photosArr.length > 0 && (
          <Animated.View entering={FadeInDown.delay(160).duration(380)}>
            <View style={[s.card, { backgroundColor: C.surface, borderColor: C.border }, cardShadow]}>
              <Text style={[s.cardLabel, { color: C.textTertiary }]}>PHOTOS ({photosArr.length})</Text>
              <View style={s.photoGrid}>
                {photosArr.map((uri, i) => (
                  <TouchableOpacity
                    key={i}
                    onPress={() => setLightboxUri(uri)}
                    activeOpacity={0.85}
                    style={s.photoThumbWrap}
                  >
                    <Image source={{ uri: getValidLocalUri(uri) }} style={s.photoThumb} resizeMode="cover" />
                    <View style={[s.photoOverlay, { backgroundColor: 'rgba(0,0,0,0.15)' }]}>
                      <MaterialCommunityIcons name="magnify-plus-outline" size={18} color="#FFF" />
                    </View>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          </Animated.View>
        )}

        {/* Status history hint */}
        <Animated.View entering={FadeInDown.delay(190).duration(380)}>
          <View style={[s.card, { backgroundColor: C.surface, borderColor: C.border }, cardShadow]}>
            <Text style={[s.cardLabel, { color: C.textTertiary }]}>STATUS</Text>
            <View style={s.statusRow}>
              {STATUS_OPTIONS.map(opt => {
                const isActive = defect.status === opt.value;
                return (
                  <TouchableOpacity
                    key={opt.value}
                    style={[
                      s.statusOption,
                      {
                        backgroundColor: isActive ? opt.color : C.backgroundTertiary,
                        borderColor: isActive ? opt.color : C.border,
                      },
                    ]}
                    onPress={() => handleStatusChange(opt.value)}
                    activeOpacity={0.8}
                  >
                    <MaterialCommunityIcons
                      name={opt.icon as any}
                      size={14}
                      color={isActive ? '#FFF' : C.textSecondary}
                    />
                    <Text style={[s.statusOptionTxt, { color: isActive ? '#FFF' : C.textSecondary }]}>
                      {opt.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>
        </Animated.View>

      </ScrollView>

      {/* Bottom action bar */}
      <View style={[s.bottomBar, { backgroundColor: C.surface, borderTopColor: C.border }]}>
        {/* Navigate to quote */}
        <TouchableOpacity
          style={[s.bottomBtn, { backgroundColor: C.primary + '18', borderColor: C.primary + '30' }]}
          onPress={() => router.push(`/jobs/${jobId}/quote` as never)}
          activeOpacity={0.8}
        >
          <MaterialCommunityIcons name="file-document-edit-outline" size={18} color={C.primary} />
          <Text style={[s.bottomBtnTxt, { color: C.primary }]}>Add to Quote</Text>
        </TouchableOpacity>

        {/* Delete */}
        <TouchableOpacity
          style={[s.bottomBtn, { backgroundColor: C.error + '12', borderColor: C.error + '30' }]}
          onPress={handleDelete}
          activeOpacity={0.8}
        >
          <MaterialCommunityIcons name="delete-outline" size={18} color={C.error} />
          <Text style={[s.bottomBtnTxt, { color: C.error }]}>Delete</Text>
        </TouchableOpacity>
      </View>

      {/* Photo Lightbox */}
      <Modal visible={!!lightboxUri} transparent animationType="fade" onRequestClose={() => setLightboxUri(null)}>
        <View style={s.lightbox}>
          <TouchableOpacity style={s.lightboxClose} onPress={() => setLightboxUri(null)}>
            <MaterialCommunityIcons name="close" size={28} color="#FFF" />
          </TouchableOpacity>
          {lightboxUri && (
            <Image source={{ uri: getValidLocalUri(lightboxUri) }} style={s.lightboxImg} resizeMode="contain" />
          )}
        </View>
      </Modal>
    </View>
  );
}

const s = StyleSheet.create({
  screen: { flex: 1 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 8 },

  statusChip: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    paddingHorizontal: 10, paddingVertical: 6,
    borderRadius: 10, borderWidth: 1,
  },
  statusChipTxt: { fontSize: 10, fontWeight: '800', letterSpacing: 0.5 },

  sevBanner: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    padding: 14, borderRadius: 16, borderWidth: 1,
    marginBottom: 12,
  },
  sevIconWrap: { width: 44, height: 44, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  sevLabel:    { fontSize: 12, fontWeight: '800', letterSpacing: 0.5 },
  sevDate:     { fontSize: 11, marginTop: 2 },
  priceBadge:  { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8, borderWidth: 1 },
  priceBadgeTxt: { fontSize: 11, fontWeight: '800', color: '#10B981' },

  codeBanner: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    padding: 12, borderRadius: 16, borderWidth: 1,
    marginBottom: 12,
  },
  codeIconWrap: { width: 36, height: 36, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  codeLabel:    { fontSize: 12, fontWeight: '700' },
  codeDesc:     { fontSize: 11, marginTop: 2, lineHeight: 16 },

  card: {
    borderRadius: 16, padding: 16, borderWidth: 1,
    marginBottom: 12,
  },
  cardLabel: { fontSize: 10, fontWeight: '700', letterSpacing: 1, marginBottom: 10 },
  cardBody:  { fontSize: 15, lineHeight: 22 },

  infoRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 6 },
  infoTxt: { fontSize: 14, flex: 1 },

  photoGrid:     { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  photoThumbWrap: { width: 88, height: 88, borderRadius: 12, overflow: 'hidden', position: 'relative' },
  photoThumb:    { width: '100%', height: '100%' },
  photoOverlay:  {
    position: 'absolute', bottom: 0, right: 0,
    width: 28, height: 28, borderRadius: 8,
    alignItems: 'center', justifyContent: 'center',
  },

  statusRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  statusOption: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 12, paddingVertical: 8,
    borderRadius: 20, borderWidth: 1,
  },
  statusOptionTxt: { fontSize: 12, fontWeight: '700' },

  bottomBar: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    flexDirection: 'row', gap: 12,
    padding: 16, paddingBottom: Platform.OS === 'ios' ? 36 : 20,
    borderTopWidth: 1,
  },
  bottomBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 8, height: 50, borderRadius: 14, borderWidth: 1,
  },
  bottomBtnTxt: { fontSize: 14, fontWeight: '700' },

  // Lightbox
  lightbox:      { flex: 1, backgroundColor: 'rgba(0,0,0,0.92)', alignItems: 'center', justifyContent: 'center' },
  lightboxClose: {
    position: 'absolute', top: Platform.OS === 'ios' ? 56 : 20, right: 20,
    width: 44, height: 44, borderRadius: 22,
    backgroundColor: 'rgba(255,255,255,0.15)',
    alignItems: 'center', justifyContent: 'center',
    zIndex: 10,
  },
  lightboxImg: { width: '100%', height: '70%' },
});
