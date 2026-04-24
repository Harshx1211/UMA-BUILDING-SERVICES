import React, { useState, useEffect, useMemo } from 'react';
import {
  View, StyleSheet, TouchableOpacity, TextInput, Modal,
  KeyboardAvoidingView, Platform, ScrollView, Pressable,
} from 'react-native';
import { Text } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useColors } from '@/hooks/useColors';
import * as ImagePicker from 'expo-image-picker';
import { Image } from 'expo-image';
import type { AssetWithResult } from '@/store/inspectionStore';
import * as Haptics from 'expo-haptics';
import { DefectSeverity } from '@/constants/Enums';

// ─── Defect suggestion presets per asset type ───────────────
const DEFECT_SUGGESTIONS: Record<string, string[]> = {
  'fire extinguisher': ['Pressure Low', 'Tag Expired', 'Damaged Body', 'Missing', 'Pin Removed', 'Obstructed'],
  'sprinkler head':    ['Obstructed', 'Damaged', 'Corroded', 'Leaking', 'Missing Deflector'],
  'fire alarm':        ['No Response', 'Battery Low', 'Damaged', 'False Triggering', 'Wiring Fault'],
  'emergency light':   ['Battery Fail', 'Bulb Fail', 'Damaged', 'Not Charging', 'Duration Fail'],
  'fire door':         ['Not Self-Closing', 'Damaged', 'Missing Hardware', 'Held Open', 'Seal Damaged'],
  'hose reel':         ['Damaged', 'Hose Perished', 'Missing', 'Valve Stiff', 'Reel Seized'],
};

function getSuggestions(assetType: string): string[] {
  const norm = assetType.toLowerCase().trim();
  for (const key of Object.keys(DEFECT_SUGGESTIONS)) {
    if (norm.includes(key)) return DEFECT_SUGGESTIONS[key];
  }
  return ['Damaged', 'Missing', 'Not Functioning', 'Requires Replacement', 'Obstruction'];
}

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
  onClose: () => void;
  onSaveFail: (reason: string, notes: string, photos: string[], severity?: DefectSeverity) => void;
}

// ═══════════════════════════════════════════════════════════════
// COMPONENT
// ═══════════════════════════════════════════════════════════════
export default function AssetInspectModal({ visible, asset, onClose, onSaveFail }: AssetInspectModalProps) {
  const C = useColors();

  const [defectReason, setDefectReason] = useState('');
  const [notes,        setNotes]        = useState('');
  const [photos,       setPhotos]       = useState<string[]>([]);
  const [severity,     setSeverity]     = useState<DefectSeverity>(DefectSeverity.Minor);
  const [reasonError,  setReasonError]  = useState(false);

  const suggestions = useMemo(() => asset ? getSuggestions(asset.asset_type) : [], [asset]);

  useEffect(() => {
    if (visible && asset) {
      setDefectReason(asset.defect_reason || '');
      setNotes(asset.technician_notes || '');
      setPhotos([...(asset.photos || [])]);
      setSeverity(DefectSeverity.Minor);
      setReasonError(false);
    }
  }, [visible, asset]);

  const handleTakePhoto = async () => {
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    if (!perm.granted) return;
    const result = await ImagePicker.launchCameraAsync({ quality: 0.75, allowsEditing: false });
    if (!result.canceled && result.assets.length > 0) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      setPhotos(prev => [...prev, result.assets[0].uri]);
    }
  };

  const handlePickPhoto = async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) return;
    const result = await ImagePicker.launchImageLibraryAsync({ quality: 0.75, allowsMultipleSelection: true, selectionLimit: 5 });
    if (!result.canceled) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      setPhotos(prev => [...prev, ...result.assets.map(a => a.uri)]);
    }
  };

  const handleSave = () => {
    if (!defectReason.trim()) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      setReasonError(true);
      return;
    }
    setReasonError(false);
    onSaveFail(defectReason.trim(), notes.trim(), photos, severity);
  };

  if (!asset) return null;

  const activeSev = SEVERITIES.find(s => s.value === severity)!;
  const activeSevColors = getSeverityColors(severity, C);

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <KeyboardAvoidingView
        style={[s.container, { backgroundColor: C.background }]}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        {/* ── MODAL HEADER ──────────────────────────────────── */}
        <View style={[s.header, { backgroundColor: C.surface, borderBottomColor: C.border }]}>
          <TouchableOpacity onPress={onClose} style={s.headerIconBtn} hitSlop={12}>
            <MaterialCommunityIcons name="close" size={22} color={C.textSecondary} />
          </TouchableOpacity>
          <View style={{ flex: 1, alignItems: 'center' }}>
            <Text style={[s.headerTitle, { color: C.text }]}>Log Defect</Text>
            <Text style={[s.headerSub, { color: C.textTertiary }]}>{asset.asset_type}</Text>
          </View>
          <TouchableOpacity
            onPress={handleSave}
            style={[s.headerSaveBtn, { backgroundColor: C.error }]}
            hitSlop={8}
          >
            <Text style={s.headerSaveTxt}>Save</Text>
          </TouchableOpacity>
        </View>

        <ScrollView
          contentContainerStyle={s.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* ── ASSET INFO BANNER ──────────────────────────── */}
          <View style={[s.assetBanner, { backgroundColor: C.surface, borderColor: C.border }]}>
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

          {/* ── DEFECT REASON ──────────────────────────────── */}
          <View style={s.formSection}>
            <Text style={[s.formLabel, { color: C.text }]}>Defect Description *</Text>
            {reasonError && (
              <View style={[s.errorBanner, { backgroundColor: C.errorLight, borderColor: C.error }]}>
                <MaterialCommunityIcons name="alert-circle" size={14} color={C.error} />
                <Text style={[s.errorBannerTxt, { color: C.error }]}>Please describe the defect before saving.</Text>
              </View>
            )}
            <TextInput
              style={[
                s.input,
                { backgroundColor: C.surface, borderColor: reasonError ? C.error : C.border, color: C.text },
              ]}
              placeholder="Describe the specific defect found…"
              placeholderTextColor={C.textTertiary}
              value={defectReason}
              onChangeText={v => { setDefectReason(v); if (v.trim()) setReasonError(false); }}
              returnKeyType="done"
            />

            {/* Quick-select suggestion chips */}
            <Text style={[s.chipGroupLabel, { color: C.textTertiary }]}>Quick select:</Text>
            <View style={s.chipsWrap}>
              {suggestions.map(sug => {
                const isSelected = defectReason === sug;
                return (
                  <TouchableOpacity
                    key={sug}
                    style={[
                      s.sugChip,
                      {
                        backgroundColor: isSelected ? activeSevColors.active : C.backgroundTertiary,
                        borderColor:     isSelected ? activeSevColors.active : C.border,
                      },
                    ]}
                    onPress={() => {
                      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                      setDefectReason(sug);
                      setReasonError(false);
                    }}
                  >
                    {isSelected && (
                      <MaterialCommunityIcons name="check" size={11} color="#FFF" />
                    )}
                    <Text style={[s.sugChipTxt, { color: isSelected ? '#FFF' : C.textSecondary }]}>
                      {sug}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
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
                { backgroundColor: C.surface, borderColor: C.border, color: C.text },
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

            {/* Photo grid */}
            <View style={s.photoGrid}>
              {/* Add camera button */}
              <TouchableOpacity
                style={[s.addPhotoBtn, { borderColor: C.border, backgroundColor: C.surface }]}
                onPress={handleTakePhoto}
                activeOpacity={0.75}
              >
                <MaterialCommunityIcons name="camera-plus-outline" size={24} color={C.primary} />
                <Text style={[s.addPhotoBtnTxt, { color: C.primary }]}>Camera</Text>
              </TouchableOpacity>

              {/* Add library button */}
              <TouchableOpacity
                style={[s.addPhotoBtn, { borderColor: C.border, backgroundColor: C.surface }]}
                onPress={handlePickPhoto}
                activeOpacity={0.75}
              >
                <MaterialCommunityIcons name="image-plus" size={24} color={C.primary} />
                <Text style={[s.addPhotoBtnTxt, { color: C.primary }]}>Gallery</Text>
              </TouchableOpacity>

              {/* Photo thumbnails */}
              {photos.map((uri, idx) => (
                <View key={idx} style={s.thumbWrap}>
                  <Image source={{ uri }} style={s.thumb} contentFit="cover" />
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

          {/* ── SAVE BUTTON ────────────────────────────────── */}
          <TouchableOpacity
            style={[s.saveBtn, { backgroundColor: C.error }]}
            onPress={handleSave}
            activeOpacity={0.8}
          >
            <MaterialCommunityIcons name="alert-circle-check" size={20} color="#FFF" />
            <Text style={s.saveBtnTxt}>Save Defect Record</Text>
          </TouchableOpacity>

          <TouchableOpacity style={s.cancelBtn} onPress={onClose}>
            <Text style={[s.cancelBtnTxt, { color: C.textSecondary }]}>Cancel — Mark as Not Tested</Text>
          </TouchableOpacity>

        </ScrollView>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const s = StyleSheet.create({
  container: { flex: 1 },

  // Header
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: Platform.OS === 'ios' ? 14 : 20,
    paddingBottom: 14,
    borderBottomWidth: 1,
    gap: 8,
  },
  headerIconBtn: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  headerTitle:   { fontSize: 16, fontWeight: '800' },
  headerSub:     { fontSize: 11, marginTop: 1 },
  headerSaveBtn: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 18 },
  headerSaveTxt: { color: '#FFF', fontWeight: '800', fontSize: 13, letterSpacing: 0.3 },

  scrollContent: { padding: 16, paddingBottom: 48 },

  // Asset banner
  assetBanner: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    padding: 14, borderRadius: 14, borderWidth: 1,
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
    flex: 1, alignItems: 'center', padding: 12, borderRadius: 14, borderWidth: 1.5, gap: 4,
  },
  severityLabel: { fontSize: 12, fontWeight: '700', marginTop: 2 },
  severityDesc:  { fontSize: 9, textAlign: 'center', letterSpacing: 0.1 },

  // Input
  input: {
    borderWidth: 1.5, borderRadius: 12,
    paddingHorizontal: 14, paddingVertical: 13,
    fontSize: 15, lineHeight: 22,
  },
  textArea: { minHeight: 100, paddingTop: 13 },

  // Suggestion chips
  chipGroupLabel: { fontSize: 11, fontWeight: '600', marginTop: 12, marginBottom: 8, letterSpacing: 0.2 },
  chipsWrap:  { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  sugChip:    { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 13, paddingVertical: 8, borderRadius: 20, borderWidth: 1 },
  sugChipTxt: { fontSize: 12, fontWeight: '600' },

  // Photos
  photoHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 },
  photoBadge:     { fontSize: 11, fontWeight: '700', paddingHorizontal: 10, paddingVertical: 3, borderRadius: 10 },
  photoGrid:      { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 2 },
  addPhotoBtn:    {
    width: 86, height: 86, borderRadius: 14,
    borderWidth: 1.5, borderStyle: 'dashed',
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

  // Save / cancel
  saveBtn:    { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, borderRadius: 14, height: 54, marginTop: 8 },
  saveBtnTxt: { color: '#FFF', fontSize: 16, fontWeight: '800', letterSpacing: 0.3 },
  cancelBtn:  { marginTop: 14, alignItems: 'center', padding: 8 },
  cancelBtnTxt: { fontSize: 13, fontWeight: '500' },
});
