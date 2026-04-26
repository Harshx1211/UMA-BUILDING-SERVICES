import React, { useState, useEffect } from 'react';
import {
  View, StyleSheet, TouchableOpacity, TextInput, Modal,
  KeyboardAvoidingView, Platform, ScrollView,
} from 'react-native';
import { Text } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useColors } from '@/hooks/useColors';
import * as ImagePicker from 'expo-image-picker';
import * as FileSystem from 'expo-file-system/legacy';
import { Image } from 'expo-image';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { AssetWithResult } from '@/store/inspectionStore';
import * as Haptics from 'expo-haptics';
import { cardShadow } from '@/components/ui/Card';
import { DefectSeverity } from '@/constants/Enums';
import { getValidLocalUri } from '@/utils/fileHelpers';
import DefectCodePicker from '@/components/defects/DefectCodePicker';
import type { DefectCode } from '@/constants/DefectCodes';
import { router } from 'expo-router';

// ─── Severity config ─────────────────────────────────────────
const SEVERITIES: { value: DefectSeverity; label: string; icon: string; desc: string }[] = [
  { value: DefectSeverity.Minor,    label: 'Minor',    icon: 'alert-circle-outline', desc: 'Can be deferred' },
  { value: DefectSeverity.Major,    label: 'Major',    icon: 'alert',                desc: 'Action within 30 days' },
  { value: DefectSeverity.Critical, label: 'Critical', icon: 'alert-octagon',        desc: 'Immediate action required' },
];

function getSeverityColors(severity: DefectSeverity, C: any) {
  switch (severity) {
    case DefectSeverity.Minor:    return { active: C.info,    light: C.infoLight,    dark: C.infoDark };
    case DefectSeverity.Major:    return { active: C.warning, light: C.warningLight, dark: C.warningDark };
    case DefectSeverity.Critical: return { active: C.error,   light: C.errorLight,   dark: C.errorDark };
  }
}

// ─── Props ───────────────────────────────────────────────────
interface AssetInspectModalProps {
  visible: boolean;
  asset: AssetWithResult | null;
  jobId?: string;
  onClose: () => void;
  onSaveFail: (
    reason: string,
    notes: string,
    photos: string[],
    severity?: DefectSeverity,
    defectCode?: string | null,
    quotePrice?: number | null,
  ) => void;
}

// ═══════════════════════════════════════════════════════════════
// COMPONENT
// ═══════════════════════════════════════════════════════════════
export default function AssetInspectModal({ visible, asset, jobId, onClose, onSaveFail }: AssetInspectModalProps) {
  const C = useColors();
  const insets = useSafeAreaInsets();

  const [defectReason,    setDefectReason]    = useState('');
  const [notes,           setNotes]           = useState('');
  const [photos,          setPhotos]          = useState<string[]>([]);
  const [severity,        setSeverity]        = useState<DefectSeverity>(DefectSeverity.Minor);
  const [reasonError,     setReasonError]     = useState(false);
  const [pickerVisible,   setPickerVisible]   = useState(false);
  const [selectedCode,    setSelectedCode]    = useState<DefectCode | null>(null);
  const [suggestedPrice,  setSuggestedPrice]  = useState<number | null>(null);

  useEffect(() => {
    if (visible && asset) {
      setDefectReason(asset.defect_reason || '');
      setNotes(asset.technician_notes || '');
      setPhotos([...(asset.photos || [])]);
      setSeverity(DefectSeverity.Minor);
      setReasonError(false);
      setSelectedCode(null);
      setSuggestedPrice(null);
    }
  }, [visible, asset]);

  const handleCodeSelect = (code: DefectCode | null) => {
    setPickerVisible(false);
    if (code === null) {
      // Custom note — clear any selected code but keep free-text
      setSelectedCode(null);
      setSuggestedPrice(null);
    } else {
      setSelectedCode(code);
      setDefectReason(code.description);
      setSuggestedPrice(code.quote_price ?? null);
      setReasonError(false);
      // Auto-suggest severity based on price/category
      if (code.category === 'Alarm' || (code.quote_price && code.quote_price >= 300)) {
        setSeverity(DefectSeverity.Major);
      }
    }
  };

  const handleTakePhoto = async () => {
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    if (!perm.granted) return;
    const result = await ImagePicker.launchCameraAsync({ quality: 0.75, allowsEditing: false });
    if (!result.canceled && result.assets.length > 0) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      const sourceUri = result.assets[0].uri;
      const filename = sourceUri.split('/').pop() || `photo_${Date.now()}.jpg`;
      const destUri = `${FileSystem.documentDirectory}${filename}`;
      try {
        await FileSystem.copyAsync({ from: sourceUri, to: destUri });
        setPhotos(prev => [...prev, destUri]);
      } catch (e) {
        console.warn('Failed to copy image', e);
        setPhotos(prev => [...prev, sourceUri]);
      }
    }
  };

  const handlePickPhoto = async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) return;
    const result = await ImagePicker.launchImageLibraryAsync({ quality: 0.75, allowsMultipleSelection: true, selectionLimit: 5 });
    if (!result.canceled) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      const newPhotos: string[] = [];
      for (const asset of result.assets) {
        const sourceUri = asset.uri;
        const filename = sourceUri.split('/').pop() || `photo_${Date.now()}.jpg`;
        const destUri = `${FileSystem.documentDirectory}${filename}`;
        try {
          await FileSystem.copyAsync({ from: sourceUri, to: destUri });
          newPhotos.push(destUri);
        } catch {
          newPhotos.push(sourceUri);
        }
      }
      setPhotos(prev => [...prev, ...newPhotos]);
    }
  };

  const handleSave = () => {
    if (!defectReason.trim()) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      setReasonError(true);
      return;
    }
    setReasonError(false);
    onSaveFail(
      defectReason.trim(),
      notes.trim(),
      photos,
      severity,
      selectedCode?.code ?? null,
      suggestedPrice,
    );
  };

  const handleReplaceNow = () => {
    if (!defectReason.trim()) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      setReasonError(true);
      return;
    }
    // Save as Critical and navigate to quote
    setReasonError(false);
    onSaveFail(
      defectReason.trim(),
      notes.trim(),
      photos,
      DefectSeverity.Critical,
      selectedCode?.code ?? null,
      suggestedPrice,
    );
    if (jobId) {
      setTimeout(() => router.push(`/jobs/${jobId}/quote` as never), 400);
    }
  };

  if (!asset) return null;

  return (
    <>
      <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
        <KeyboardAvoidingView
          style={[s.container, { backgroundColor: C.background }]}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          {/* ── MODAL HEADER ──────────────────────────────────── */}
          <View style={[s.header, { backgroundColor: C.surface, paddingTop: Math.max(insets.top, 16) }]}>
            <TouchableOpacity onPress={onClose} style={s.headerIconBtn} hitSlop={12}>
              <MaterialCommunityIcons name="close" size={24} color={C.textSecondary} />
            </TouchableOpacity>
            <View style={{ flex: 1, alignItems: 'center' }}>
              <Text style={[s.headerTitle, { color: C.text }]}>Log Defect</Text>
              <Text style={[s.headerSub, { color: C.textTertiary }]} numberOfLines={1}>{asset.asset_type}</Text>
            </View>
            <View style={{ width: 44 }} />
          </View>

          <ScrollView
            contentContainerStyle={s.scrollContent}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            {/* ── ASSET INFO BANNER ──────────────────────────── */}
            <View style={[s.assetBanner, { backgroundColor: C.surface, borderColor: C.border }, cardShadow]}>
              <View style={[s.assetBannerIcon, { backgroundColor: C.errorLight }]}>
                <MaterialCommunityIcons name="close-circle" size={22} color={C.error} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[s.assetBannerType, { color: C.text }]}>{asset.asset_type}</Text>
                <Text style={[s.assetBannerLoc, { color: C.textSecondary }]}>
                  {asset.location_on_site || 'No location specified'}
                </Text>
                {asset.serial_number && (
                  <Text style={[s.assetBannerSerial, { color: C.textTertiary }]}>S/N: {asset.serial_number}</Text>
                )}
              </View>
              <View style={[s.failBadge, { backgroundColor: C.errorLight, borderColor: C.error }]}>
                <Text style={[s.failBadgeTxt, { color: C.error }]}>FAILED</Text>
              </View>
            </View>

            {/* ── SEVERITY SELECTOR ──────────────────────────── */}
            <View style={s.formSection}>
              <Text style={[s.formLabel, { color: C.text }]}>Defect Severity *</Text>
              <View style={s.severityRow}>
                {SEVERITIES.map(sev => {
                  const isActive = severity === sev.value;
                  const colors   = getSeverityColors(sev.value, C);
                  return (
                    <TouchableOpacity
                      key={sev.value}
                      style={[
                        s.severityCard,
                        { backgroundColor: isActive ? colors.active : C.surface, borderColor: isActive ? colors.active : C.border },
                        !isActive && cardShadow,
                      ]}
                      onPress={() => {
                        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                        setSeverity(sev.value);
                      }}
                      activeOpacity={0.75}
                    >
                      <MaterialCommunityIcons
                        name={sev.icon as any}
                        size={20}
                        color={isActive ? '#FFF' : colors.active}
                      />
                      <Text style={[s.severityLabel, { color: isActive ? '#FFF' : C.text }]}>{sev.label}</Text>
                      <Text style={[s.severityDesc, { color: isActive ? 'rgba(255,255,255,0.75)' : C.textTertiary }]}>
                        {sev.desc}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>

            {/* ── DEFECT CODE PICKER ──────────────────────────── */}
            <View style={s.formSection}>
              <Text style={[s.formLabel, { color: C.text }]}>Defect Description *</Text>
              {reasonError && (
                <View style={[s.errorBanner, { backgroundColor: C.errorLight, borderColor: C.error }]}>
                  <MaterialCommunityIcons name="alert-circle" size={14} color={C.error} />
                  <Text style={[s.errorBannerTxt, { color: C.error }]}>Please describe the defect before saving.</Text>
                </View>
              )}

              {/* Code Library Button */}
              <TouchableOpacity
                style={[s.codePickerBtn, { backgroundColor: C.surface, borderColor: selectedCode ? C.primary : C.border }]}
                onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); setPickerVisible(true); }}
                activeOpacity={0.8}
              >
                <View style={[s.codePickerIcon, { backgroundColor: selectedCode ? C.primary + '18' : C.backgroundTertiary }]}>
                  <MaterialCommunityIcons
                    name={selectedCode ? 'tag-check-outline' : 'tag-search-outline'}
                    size={18}
                    color={selectedCode ? C.primary : C.textSecondary}
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[s.codePickerTitle, { color: selectedCode ? C.primary : C.text }]}>
                    {selectedCode ? `Code: ${selectedCode.code.toUpperCase()}` : 'Select from Code Library'}
                  </Text>
                  <Text style={[s.codePickerSub, { color: C.textSecondary }]} numberOfLines={1}>
                    {selectedCode ? selectedCode.description : 'Browse 100+ Uptick defect codes'}
                  </Text>
                </View>
                {/* Price badge */}
                {suggestedPrice !== null && (
                  <View style={s.priceBadge}>
                    <Text style={s.priceBadgeTxt}>${suggestedPrice}</Text>
                  </View>
                )}
                {/* Clear code */}
                {selectedCode ? (
                  <TouchableOpacity
                    onPress={() => { setSelectedCode(null); setSuggestedPrice(null); }}
                    hitSlop={8}
                    style={{ padding: 4 }}
                  >
                    <MaterialCommunityIcons name="close-circle" size={18} color={C.textTertiary} />
                  </TouchableOpacity>
                ) : (
                  <MaterialCommunityIcons name="chevron-right" size={18} color={C.textTertiary} />
                )}
              </TouchableOpacity>

              {/* Free-text input */}
              <TextInput

                placeholder="Or type a custom description…"
                placeholderTextColor={C.textTertiary}
                value={defectReason}
                onChangeText={v => {
                  setDefectReason(v);
                  if (v.trim()) setReasonError(false);
                  // If user edits, detach from code
                  if (selectedCode && v !== selectedCode.description) {
                    setSelectedCode(null);
                    setSuggestedPrice(null);
                  }
                }}
                multiline
                textAlignVertical="top"
                style={[
                  s.input,
                  s.textArea,
                  { backgroundColor: C.backgroundTertiary, borderColor: reasonError ? C.error : 'transparent', color: C.text, marginTop: 10 },
                ]}
              />
            </View>

            {/* ── TECHNICIAN NOTES ───────────────────────────── */}
            <View style={s.formSection}>
              <Text style={[s.formLabel, { color: C.text }]}>Technician Notes</Text>
              <Text style={[s.formHint, { color: C.textTertiary }]}>
                Recommended actions, parts required, or follow-up details.
              </Text>
              <TextInput
                style={[
                  s.input, s.textArea,
                  { backgroundColor: C.backgroundTertiary, borderColor: 'transparent', color: C.text },
                ]}
                placeholder="e.g. Extinguisher requires replacement — valve corroded. Order part #FE-205."
                placeholderTextColor={C.textTertiary}
                value={notes}
                onChangeText={setNotes}
                multiline
                textAlignVertical="top"
              />
            </View>

            {/* ── PHOTO EVIDENCE ─────────────────────────────── */}
            <View style={s.formSection}>
              <View style={s.photoHeaderRow}>
                <Text style={[s.formLabel, { color: C.text }]}>Photo Evidence</Text>
                <Text style={[s.photoBadge, { backgroundColor: C.backgroundTertiary, color: C.textSecondary }]}>
                  {photos.length} / 5
                </Text>
              </View>
              <Text style={[s.formHint, { color: C.textTertiary }]}>
                Photos are required for Critical defects and strongly recommended for all others.
              </Text>

              <View style={s.photoGrid}>
                <TouchableOpacity
                  style={[s.addPhotoBtn, { borderColor: C.border, backgroundColor: C.surface }]}
                  onPress={handleTakePhoto}
                  activeOpacity={0.75}
                >
                  <MaterialCommunityIcons name="camera-plus-outline" size={24} color={C.primary} />
                  <Text style={[s.addPhotoBtnTxt, { color: C.primary }]}>Camera</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[s.addPhotoBtn, { borderColor: C.border, backgroundColor: C.surface }]}
                  onPress={handlePickPhoto}
                  activeOpacity={0.75}
                >
                  <MaterialCommunityIcons name="image-plus" size={24} color={C.primary} />
                  <Text style={[s.addPhotoBtnTxt, { color: C.primary }]}>Gallery</Text>
                </TouchableOpacity>

                {photos.map((uri, idx) => (
                  <View key={idx} style={s.thumbWrap}>
                    <Image source={{ uri: getValidLocalUri(uri) }} style={s.thumb} contentFit="cover" />
                    <TouchableOpacity
                      style={[s.delPhotoBtn, { backgroundColor: C.error }]}
                      onPress={() => {
                        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                        setPhotos(p => p.filter((_, i) => i !== idx));
                      }}
                    >
                      <MaterialCommunityIcons name="close" size={11} color="#FFF" />
                    </TouchableOpacity>
                  </View>
                ))}
              </View>
            </View>

            {/* ── ACTION BUTTONS MOVED TO BOTTOM BAR ───────────────── */}
            <View style={{ height: 16 }} />
          </ScrollView>

          {/* ── BOTTOM ACTION BAR ───────────────────────────── */}
          <View style={[s.bottomBar, { backgroundColor: C.surface, borderTopColor: C.border }]}>
            {/* Replace Now */}
            <TouchableOpacity
              style={[s.replaceBtn, { backgroundColor: C.warning + '18', borderColor: C.warning }]}
              onPress={handleReplaceNow}
              activeOpacity={0.8}
            >
              <MaterialCommunityIcons name="tools" size={18} color={C.warning} />
              <Text style={[s.replaceBtnTxt, { color: C.warning }]}>Replace</Text>
            </TouchableOpacity>

            {/* Save Defect */}
            <TouchableOpacity
              style={[s.saveBtn, { backgroundColor: C.error, flex: 1 }]}
              onPress={handleSave}
              activeOpacity={0.8}
            >
              <MaterialCommunityIcons name="alert-circle-check" size={20} color="#FFF" />
              <Text style={s.saveBtnTxt}>Save Defect</Text>
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* Defect Code Picker (full-screen modal) */}
      <DefectCodePicker
        visible={pickerVisible}
        onSelect={handleCodeSelect}
        onClose={() => setPickerVisible(false)}
      />
    </>
  );
}

const s = StyleSheet.create({
  container: { flex: 1 },

  // Header
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingBottom: 16,
  },
  headerIconBtn: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  headerTitle:   { fontSize: 16, fontWeight: '800' },
  headerSub:     { fontSize: 12, marginTop: 2, fontWeight: '500' },

  scrollContent: { padding: 16, paddingBottom: 48 },

  // Asset banner
  assetBanner: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    padding: 14, borderRadius: 16, borderWidth: 1,
    marginBottom: 20,
  },
  assetBannerIcon:   { width: 44, height: 44, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  assetBannerType:   { fontSize: 15, fontWeight: '700' },
  assetBannerLoc:    { fontSize: 12, marginTop: 2 },
  assetBannerSerial: { fontSize: 11, fontFamily: 'monospace', marginTop: 1 },
  failBadge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  failBadgeTxt: { fontSize: 10, fontWeight: '800', letterSpacing: 0.5 },

  // Form sections
  formSection: { marginBottom: 24 },
  formLabel:   { fontSize: 13, fontWeight: '700', marginBottom: 8, letterSpacing: 0.1 },
  formHint:    { fontSize: 11, marginBottom: 10, lineHeight: 16 },

  // Error banner
  errorBanner:    { flexDirection: 'row', alignItems: 'center', gap: 6, padding: 10, borderRadius: 8, borderWidth: 1, marginBottom: 10 },
  errorBannerTxt: { fontSize: 12, fontWeight: '600', flex: 1 },

  // Severity
  severityRow: { flexDirection: 'row', gap: 10 },
  severityCard: {
    flex: 1, alignItems: 'center', padding: 12, borderRadius: 16, borderWidth: 1, gap: 4,
  },
  severityLabel: { fontSize: 12, fontWeight: '700', marginTop: 2 },
  severityDesc:  { fontSize: 9, textAlign: 'center', letterSpacing: 0.1 },

  // Code picker button
  codePickerBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    padding: 14, borderRadius: 14, borderWidth: 1,
  },
  codePickerIcon: {
    width: 38, height: 38, borderRadius: 10,
    alignItems: 'center', justifyContent: 'center',
  },
  codePickerTitle: { fontSize: 13, fontWeight: '700' },
  codePickerSub:   { fontSize: 11, marginTop: 2 },
  priceBadge: {
    backgroundColor: '#10B981' + '18',
    borderWidth: 1,
    borderColor: '#10B981' + '40',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  priceBadgeTxt: { fontSize: 11, fontWeight: '800', color: '#10B981' },

  // Input
  input: {
    borderWidth: 1, borderRadius: 12,
    paddingHorizontal: 14, paddingVertical: 13,
    fontSize: 15, lineHeight: 22,
  },
  textArea: { minHeight: 80, paddingTop: 13, textAlignVertical: 'top' },

  // Photos
  photoHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 },
  photoBadge:     { fontSize: 11, fontWeight: '700', paddingHorizontal: 10, paddingVertical: 3, borderRadius: 10 },
  photoGrid:      { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 2 },
  addPhotoBtn:    {
    width: 86, height: 86, borderRadius: 14,
    borderWidth: 1, borderStyle: 'dashed',
    alignItems: 'center', justifyContent: 'center', gap: 4,
  },
  addPhotoBtnTxt: { fontSize: 11, fontWeight: '700' },
  thumbWrap:      { width: 86, height: 86, borderRadius: 14, overflow: 'visible' },
  thumb:          { width: '100%', height: '100%', borderRadius: 14 },
  delPhotoBtn:    {
    position: 'absolute', top: -6, right: -6,
    width: 22, height: 22, borderRadius: 11,
    alignItems: 'center', justifyContent: 'center',
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.25, shadowRadius: 2, elevation: 3,
  },

  // Bottom action bar
  bottomBar: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    flexDirection: 'row', gap: 12,
    padding: 16, paddingTop: 16,
    paddingBottom: Platform.OS === 'ios' ? 36 : 16,
    borderTopWidth: 1,
    shadowColor: '#000', shadowOffset: { width: 0, height: -4 }, shadowOpacity: 0.05, shadowRadius: 10, elevation: 10,
  },
  saveBtn:    { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, borderRadius: 14, height: 54 },
  saveBtnTxt: { color: '#FFF', fontSize: 16, fontWeight: '800', letterSpacing: 0.2 },
  replaceBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    borderRadius: 14, height: 54, borderWidth: 1, paddingHorizontal: 16,
  },
  replaceBtnTxt: { fontSize: 15, fontWeight: '800' },
});
