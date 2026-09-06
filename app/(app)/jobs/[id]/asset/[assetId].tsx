/**
 * Asset Detail screen — everything about ONE asset that used to be crammed
 * inline onto its card in the inspect list (photos, note, defect detail),
 * plus History: every prior visit's result/note/defect/photos for this exact
 * physical asset. Reached via router.push from inspect.tsx's AssetCard —
 * tapping the card body, or tapping Fail (which saves instantly, same as
 * Pass/N-T, then lands here so the Defect Details section can be filled in).
 * Pass/N-T stay fully on the list for speed. A real screen with native back,
 * not a modal.
 */
import React, { useEffect, useRef, useCallback, useState } from 'react';
import {
  View, StyleSheet, TouchableOpacity, ScrollView, Modal, TextInput,
  KeyboardAvoidingView, Platform,
} from 'react-native';
import { Text, ActivityIndicator } from 'react-native-paper';
import { Image } from 'expo-image';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useLocalSearchParams, useFocusEffect, router } from 'expo-router';
import { useColors } from '@/hooks/useColors';
import { useReducedMotion } from '@/hooks/useReducedMotion';
import { ScreenHeader, showConfirm } from '@/components/ui';
import { cardShadow } from '@/components/ui/Card';
import { InspectionResult, DefectSeverity } from '@/constants/Enums';
import { useInspectionStore } from '@/store/inspectionStore';
import Animated, { FadeIn } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import * as ImagePicker from 'expo-image-picker';
import * as ImageManipulator from 'expo-image-manipulator';
import * as FileSystem from 'expo-file-system/legacy';
import Toast from 'react-native-toast-message';

import DefectCodePicker from '@/components/defects/DefectCodePicker';
import type { DefectCode } from '@/constants/DefectCodes';
import { formatAssetType, formatLocationCode, formatRelativeDays } from '@/utils/assetHelpers';
import { getValidLocalUri } from '@/utils/fileHelpers';
import { getAssetHistory, AssetHistoryEntry } from '@/lib/database';
import { Timeline } from '@/components/audit/Timeline';

type ColorsType = ReturnType<typeof useColors>;
type MCIconName = React.ComponentProps<typeof MaterialCommunityIcons>['name'];

// ─── Severity config — short labels here (chip width is tight at 1/3 of the
// card); the full name still appears everywhere else (history, PDF, etc.) ──
const SEVERITIES: { value: DefectSeverity; label: string; chipLabel: string; icon: MCIconName; desc: string }[] = [
  { value: DefectSeverity.NonConformance, label: 'Non-conformance', chipLabel: 'Minor',        icon: 'alert-circle-outline', desc: "Doesn't affect system operation" },
  { value: DefectSeverity.NonCritical,    label: 'Non-critical',    chipLabel: 'Non-critical',  icon: 'alert',                desc: 'Action within 30 days' },
  { value: DefectSeverity.Critical,       label: 'Critical',        chipLabel: 'Critical',      icon: 'alert-octagon',        desc: 'Immediate action required' },
];

function getSeverityColors(severity: DefectSeverity, C: ColorsType) {
  switch (severity) {
    case DefectSeverity.NonConformance: return { active: C.info,    light: C.infoLight,    dark: C.infoDark };
    case DefectSeverity.NonCritical:    return { active: C.warning, light: C.warningLight, dark: C.warningDark };
    case DefectSeverity.Critical:       return { active: C.error,   light: C.errorLight,   dark: C.errorDark };
  }
}

// ─── Small bottom sheet: Take Photo / Choose from Gallery ─────────────────
function PhotoChooserSheet({
  visible, onClose, onTakePhoto, onPickGallery,
}: {
  visible: boolean;
  onClose: () => void;
  onTakePhoto: () => void;
  onPickGallery: () => void;
}) {
  const C = useColors();
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <TouchableOpacity style={s.chooserOverlay} activeOpacity={1} onPress={onClose}>
        <TouchableOpacity activeOpacity={1} style={[s.chooserSheet, { backgroundColor: C.surface }]}>
          <Text style={[s.chooserTitle, { color: C.text }]}>Add Photo</Text>
          <TouchableOpacity style={s.chooserRow} onPress={onTakePhoto} activeOpacity={0.7}>
            <View style={[s.chooserIconWrap, { backgroundColor: C.primary + '18' }]}>
              <MaterialCommunityIcons name="camera-outline" size={20} color={C.primary} />
            </View>
            <Text style={[s.chooserRowTxt, { color: C.text }]}>Take Photo</Text>
          </TouchableOpacity>
          <View style={[s.chooserDivider, { backgroundColor: C.border }]} />
          <TouchableOpacity style={s.chooserRow} onPress={onPickGallery} activeOpacity={0.7}>
            <View style={[s.chooserIconWrap, { backgroundColor: C.primary + '18' }]}>
              <MaterialCommunityIcons name="image-multiple-outline" size={20} color={C.primary} />
            </View>
            <Text style={[s.chooserRowTxt, { color: C.text }]}>Choose from Gallery</Text>
          </TouchableOpacity>
        </TouchableOpacity>
        <TouchableOpacity style={[s.chooserCancel, { backgroundColor: C.surface }]} onPress={onClose} activeOpacity={0.7}>
          <Text style={[s.chooserCancelTxt, { color: C.text }]}>Cancel</Text>
        </TouchableOpacity>
      </TouchableOpacity>
    </Modal>
  );
}

// ─── Full-screen photo viewer ───────────────────────────────────────────
function PhotoViewer({
  uri, onClose, onDelete,
}: {
  uri: string | null;
  onClose: () => void;
  onDelete?: () => void;
}) {
  return (
    <Modal visible={!!uri} transparent animationType="fade" onRequestClose={onClose}>
      <View style={s.viewerOverlay}>
        <TouchableOpacity style={s.viewerCloseBtn} onPress={onClose} hitSlop={10}>
          <MaterialCommunityIcons name="close" size={26} color="#fff" />
        </TouchableOpacity>
        {uri ? (
          <Image source={{ uri: getValidLocalUri(uri) }} style={s.viewerImage} contentFit="contain" />
        ) : null}
        {onDelete && (
          <TouchableOpacity style={s.viewerDeleteBtn} onPress={onDelete} activeOpacity={0.8}>
            <MaterialCommunityIcons name="trash-can-outline" size={18} color="#fff" />
            <Text style={s.viewerDeleteTxt}>Delete Photo</Text>
          </TouchableOpacity>
        )}
      </View>
    </Modal>
  );
}

// ─── Section card — the one container every section below sits in, per the
// approved "Segmented Card Stack" direction. `variant` tints Defect Details
// red while Fail is active; every other section stays the plain default. ──
function SectionCard({
  icon, title, variant = 'default', children, C,
}: {
  icon: MCIconName;
  title: string;
  variant?: 'default' | 'danger';
  children: React.ReactNode;
  C: ColorsType;
}) {
  const tinted = variant === 'danger';
  return (
    <View
      style={[
        s.card,
        cardShadow,
        {
          backgroundColor: tinted ? C.errorLight : C.surface,
          borderColor: tinted ? C.error + '60' : C.border,
        },
      ]}
    >
      <View style={s.cardHeaderRow}>
        <View style={[s.cardHeaderIconWrap, { backgroundColor: (tinted ? C.error : C.textSecondary) + '26' }]}>
          <MaterialCommunityIcons name={icon} size={15} color={tinted ? C.error : C.textSecondary} />
        </View>
        <Text style={[s.cardHeaderTitle, { color: C.text }]}>{title}</Text>
      </View>
      {children}
    </View>
  );
}

const SEVERITY_LABEL: Record<string, string> = {
  critical: 'Critical Defect',
  non_critical: 'Non-critical Defect',
  non_conformance: 'Non-conformance',
};

function resultLabel(r: string | null): string {
  return r === 'pass' ? 'Pass' : r === 'fail' ? 'Fail' : 'N/T';
}

export default function AssetDetailScreen() {
  const C = useColors();
  const noMotion = useReducedMotion();
  const { id: jobId, assetId, pendingFail: pendingFailParam } = useLocalSearchParams<{ id: string; assetId: string; pendingFail?: string }>();
  const { assets, updateAssetResult, addPhotoToAsset, removePhotoFromAsset, isSaving } = useInspectionStore();
  const asset = assets.find((a) => a.id === assetId);

  // Fail is selected but not yet saved — set when arriving here straight off
  // a Fail tap (see inspect.tsx's AssetCard) or by tapping Fail below on an
  // asset that wasn't already failed. Nothing is written to job_assets until
  // Save Defect actually commits it — same one-tap-one-save shape Pass/N-T
  // already have, just with a required field in between instead of an
  // instant, possibly-incomplete write.
  const [pendingFail, setPendingFail] = useState(() => pendingFailParam === '1');

  const [showPhotoChooser, setShowPhotoChooser] = useState(false);
  const [isAddingPhoto, setIsAddingPhoto] = useState(false);
  const [viewingPhoto, setViewingPhoto] = useState<string | null>(null);
  const [viewingHistoryPhoto, setViewingHistoryPhoto] = useState<string | null>(null);

  const [history, setHistory] = useState<AssetHistoryEntry[]>([]);
  const [historyLoading, setHistoryLoading] = useState(true);

  // ── Inline defect details (Fail) + note (Pass/N-T) — replaces the old
  // AssetInspectModal/AssetNoteModal popups. Severity/code/price never round-
  // trip from the asset (same as the modal they replace — only defectReason
  // and technician_notes are persisted columns), so they always start at
  // their defaults; the tech re-picks them if they're editing an existing
  // defect. `note` backs job_assets.technician_notes for BOTH the Fail
  // section's "Technician Notes" field and the Pass/N-T "Note" field — same
  // column, mutually-exclusive UI depending on the result.
  const [severity, setSeverity] = useState<DefectSeverity>(DefectSeverity.NonConformance);
  // Inline dropdown, not a bottom-sheet modal — tap the trigger row to expand
  // the 3 options directly underneath it, tap an option to select + collapse.
  const [severityExpanded, setSeverityExpanded] = useState(false);
  const [codePickerVisible, setCodePickerVisible] = useState(false);
  const [selectedCode, setSelectedCode] = useState<DefectCode | null>(null);
  const [suggestedPrice, setSuggestedPrice] = useState<number | null>(null);
  const [defectReason, setDefectReason] = useState(asset?.defect_reason || '');
  const [reasonError, setReasonError] = useState(false);
  const [note, setNote] = useState(asset?.technician_notes || '');

  useEffect(() => {
    if (!assetId || !jobId) return;
    setHistoryLoading(true);
    setHistory(getAssetHistory(assetId, jobId));
    setHistoryLoading(false);
  }, [assetId, jobId]);

  // Always-current snapshot of the editable fields + asset, read by the
  // flush-on-leave effect below. A plain ref assigned every render (not a
  // `useEffect`) so the focus-effect's cleanup — set up once, at the last
  // time this screen gained focus — never sees stale values no matter how
  // long the screen's been open or how many keystrokes happened since.
  const latestRef = useRef({ note, defectReason, severity, selectedCode, suggestedPrice, isFailed: asset?.result === InspectionResult.Fail || pendingFail, asset });
  latestRef.current = { note, defectReason, severity, selectedCode, suggestedPrice, isFailed: asset?.result === InspectionResult.Fail || pendingFail, asset };

  // Persist whatever's unsaved the moment this screen loses focus — back
  // button, swipe-back, or navigating elsewhere — so typing a note or a
  // defect description and leaving without an explicit Save never loses it.
  // Fires on blur, not on every keystroke, so it doesn't fight the explicit
  // Save Defect/Save-on-blur paths; it's a safety net for whatever they
  // didn't get to.
  useFocusEffect(
    useCallback(() => {
      return () => {
        const { note: n, defectReason: dr, severity: sev, selectedCode: sc, suggestedPrice: sp, isFailed: failed, asset: a } = latestRef.current;
        if (!a) return;
        if (failed) {
          const drTrim = dr.trim();
          const noteTrim = n.trim();
          if (drTrim !== (a.defect_reason || '') || noteTrim !== (a.technician_notes || '')) {
            updateAssetResult(a.id, InspectionResult.Fail, a.checklist_data ?? undefined, false, drTrim, noteTrim, undefined, sev, sc?.code ?? null, sp);
          }
        } else if (n.trim() !== (a.technician_notes || '')) {
          updateAssetResult(a.id, a.result, a.checklist_data ?? undefined, a.is_compliant, a.defect_reason ?? undefined, n.trim());
        }
      };
    }, [updateAssetResult])
  );

  if (!asset) {
    return (
      <View style={[s.container, { backgroundColor: C.background }]}>
        <ScreenHeader title="Asset" showBack />
        <View style={s.emptyWrap}>
          <MaterialCommunityIcons name="alert-circle-outline" size={28} color={C.textTertiary} />
          <Text style={{ color: C.textSecondary, marginTop: 8 }}>This asset couldn&apos;t be found.</Text>
        </View>
      </View>
    );
  }

  const savePickedPhoto = async (sourceUri: string) => {
    let resizedUri = sourceUri;
    try {
      const manipResult = await ImageManipulator.manipulateAsync(
        sourceUri,
        [{ resize: { width: 1600 } }],
        { compress: 0.7, format: ImageManipulator.SaveFormat.JPEG }
      );
      resizedUri = manipResult.uri;
    } catch (e) {
      console.warn('Failed to resize/compress image, using original', e);
    }
    const filename = `photo_${Date.now()}.jpg`;
    const destUri = `${FileSystem.documentDirectory}${filename}`;
    try {
      await FileSystem.copyAsync({ from: resizedUri, to: destUri });
      addPhotoToAsset(asset.id, destUri);
    } catch (e) {
      console.warn('Failed to copy image', e);
      addPhotoToAsset(asset.id, resizedUri);
    }
  };

  const handleTakePhoto = async () => {
    setShowPhotoChooser(false);
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    if (!perm.granted) return;
    setIsAddingPhoto(true);
    try {
      const result = await ImagePicker.launchCameraAsync({ quality: 0.75, allowsEditing: false });
      if (!result.canceled && result.assets.length > 0) {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        await savePickedPhoto(result.assets[0].uri);
      }
    } finally {
      setIsAddingPhoto(false);
    }
  };

  const handlePickPhoto = async () => {
    setShowPhotoChooser(false);
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) return;
    setIsAddingPhoto(true);
    try {
      const result = await ImagePicker.launchImageLibraryAsync({ quality: 0.75, allowsMultipleSelection: true, selectionLimit: 5 });
      if (!result.canceled && result.assets.length > 0) {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        for (const a of result.assets) await savePickedPhoto(a.uri);
      }
    } finally {
      setIsAddingPhoto(false);
    }
  };

  const handleRemovePhoto = (uri: string) => {
    showConfirm({
      title: 'Delete Photo?',
      message: "This can't be undone.",
      icon: 'trash-can-outline',
      buttons: [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
            removePhotoFromAsset(asset.id, uri);
            setViewingPhoto(null);
          },
        },
      ],
    });
  };

  const handleResult = (res: InspectionResult) => {
    if (res === InspectionResult.Pass) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setPendingFail(false);
      updateAssetResult(asset.id, res, asset.checklist_data ?? undefined, asset.is_compliant ?? true, undefined, asset.technician_notes || '');
    } else if (res === InspectionResult.Fail) {
      // Reveal the Defect Details card, don't save yet — Save Defect below is
      // the one real write (see pendingFail's own comment). Re-tapping Fail
      // on an asset that's ALREADY a saved Fail (re-opening an existing
      // defect) isn't a fresh transition, so there's nothing pending about it.
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      if (asset.result !== InspectionResult.Fail) setPendingFail(true);
    } else {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      setPendingFail(false);
      updateAssetResult(asset.id, res, asset.checklist_data ?? undefined, false, undefined, asset.technician_notes || '');
    }
  };

  const handleSelectSeverity = (v: DefectSeverity) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setSeverity(v);
    setSeverityExpanded(false);
  };

  const handleCodeSelect = (code: DefectCode | null) => {
    setCodePickerVisible(false);
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
        setSeverity(DefectSeverity.NonCritical);
      }
    }
  };

  const handleSaveDefect = () => {
    if (!defectReason.trim()) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      setReasonError(true);
      return;
    }
    setReasonError(false);
    updateAssetResult(asset.id, InspectionResult.Fail, asset.checklist_data ?? undefined, false, defectReason.trim(), note.trim(), undefined, severity, selectedCode?.code ?? null, suggestedPrice);
    setPendingFail(false);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    Toast.show({ type: 'success', text1: 'Defect saved' });
  };

  const handleReplaceNow = () => {
    if (!defectReason.trim()) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      setReasonError(true);
      return;
    }
    setReasonError(false);
    updateAssetResult(asset.id, InspectionResult.Fail, asset.checklist_data ?? undefined, false, defectReason.trim(), note.trim(), undefined, DefectSeverity.Critical, selectedCode?.code ?? null, suggestedPrice);
    setPendingFail(false);
    setTimeout(() => router.push(`/jobs/${jobId}/quote` as never), 400);
  };

  const handleSaveNote = () => {
    updateAssetResult(asset.id, asset.result, asset.checklist_data ?? undefined, asset.is_compliant, asset.defect_reason ?? undefined, note.trim());
  };

  const result = asset.result;
  // A pending (not-yet-saved) Fail always wins the segmented display — Pass/NT
  // can't also read as selected while the tech is mid-way through describing
  // a defect they haven't saved yet.
  const isFailed = result === InspectionResult.Fail || pendingFail;
  const isPassed = !pendingFail && result === InspectionResult.Pass;
  const isNT = !pendingFail && result === InspectionResult.NotTested;

  const failCount = history.filter((h) => h.result === 'fail').length;
  const location = asset.location_on_site ? formatLocationCode(asset.location_on_site) : 'No location specified';

  const resultPillColors = (r: string | null) =>
    r === 'pass' ? { bg: C.successLight, fg: C.successDark }
    : r === 'fail' ? { bg: C.errorLight, fg: C.errorDark }
    : { bg: C.backgroundTertiary, fg: C.textSecondary };

  return (
    <View style={[s.container, { backgroundColor: C.background }]}>
      <ScreenHeader title={formatAssetType(asset.asset_type)} subtitle={location} showBack />

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
      >
      <ScrollView contentContainerStyle={s.scrollContent} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
        {(asset.asset_ref || asset.serial_number || history[0]?.date) && (
          <Text style={[s.refLine, { color: C.textTertiary }]}>
            {asset.asset_ref ? `Ref: ${asset.asset_ref}` : asset.serial_number ? `S/N: ${asset.serial_number}` : ''}
            {history[0]?.date ? `${asset.asset_ref || asset.serial_number ? '  ·  ' : ''}Last serviced ${formatRelativeDays(history[0].date)}` : ''}
          </Text>
        )}

        {/* ── Result — one segmented track, not three separate boxes ──── */}
        <Text style={[s.sectionLabel, { color: C.textTertiary, marginTop: 0 }]}>Result</Text>
        <View style={[s.resultTrack, { backgroundColor: C.backgroundTertiary, opacity: isSaving ? 0.5 : 1 }]}>
          <TouchableOpacity
            style={[s.resultSeg, isPassed && { backgroundColor: C.success }]}
            onPress={() => !isSaving && handleResult(InspectionResult.Pass)}
            activeOpacity={0.8}
            disabled={isSaving}
          >
            <MaterialCommunityIcons name="check-circle" size={16} color={isPassed ? C.textOnPrimary : C.success} />
            <Text style={[s.resultSegTxt, { color: isPassed ? C.textOnPrimary : C.success }]}>Pass</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[s.resultSeg, isFailed && { backgroundColor: C.error }]}
            onPress={() => !isSaving && handleResult(InspectionResult.Fail)}
            activeOpacity={0.8}
            disabled={isSaving}
          >
            <MaterialCommunityIcons name="close-circle" size={16} color={isFailed ? C.textOnPrimary : C.error} />
            <Text style={[s.resultSegTxt, { color: isFailed ? C.textOnPrimary : C.error }]}>Fail</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[s.resultSeg, isNT && { backgroundColor: C.textSecondary }]}
            onPress={() => !isSaving && handleResult(InspectionResult.NotTested)}
            activeOpacity={0.8}
            disabled={isSaving}
          >
            <MaterialCommunityIcons name="minus-circle-outline" size={16} color={isNT ? C.textOnPrimary : C.textSecondary} />
            <Text style={[s.resultSegTxt, { color: isNT ? C.textOnPrimary : C.textSecondary }]}>N/T</Text>
          </TouchableOpacity>
        </View>

        {/* ── Photos ─────────────────────────────────────────── */}
        <SectionCard icon="camera-outline" title={`Photos${(asset.photos ?? []).length > 0 ? ` · ${(asset.photos ?? []).length}` : ''}`} C={C}>
          <View style={s.photoRow}>
            {(asset.photos ?? []).map((uri) => (
              <TouchableOpacity key={uri} style={s.photoThumbWrap} onPress={() => setViewingPhoto(uri)} activeOpacity={0.8}>
                <Image source={{ uri: getValidLocalUri(uri) }} style={s.photoThumb} contentFit="cover" />
              </TouchableOpacity>
            ))}
            <TouchableOpacity
              style={[s.photoAddTile, { backgroundColor: C.background, borderColor: C.border }]}
              onPress={() => !isAddingPhoto && setShowPhotoChooser(true)}
              activeOpacity={0.8}
              disabled={isAddingPhoto}
            >
              {isAddingPhoto
                ? <ActivityIndicator size="small" color={C.textSecondary} />
                : <MaterialCommunityIcons name="camera-plus-outline" size={20} color={C.textSecondary} />}
            </TouchableOpacity>
          </View>
        </SectionCard>

        {/* ── Defect Details (Fail) — tinted card, inline severity chips ── */}
        {isFailed && (
          <Animated.View entering={noMotion ? undefined : FadeIn.duration(300)}>
            <SectionCard icon="alert-octagon-outline" title="Defect Details" variant="danger" C={C}>
              <Text style={[s.chipRowLabel, { color: C.textTertiary }]}>Severity</Text>
              {(() => {
                const current = SEVERITIES.find((sv) => sv.value === severity) ?? SEVERITIES[0];
                const currentColors = getSeverityColors(current.value, C);
                return (
                  <View style={{ marginBottom: 14 }}>
                    <TouchableOpacity
                      style={[s.severityDropdown, { backgroundColor: C.surface, borderColor: C.border }]}
                      onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); setSeverityExpanded((v) => !v); }}
                      activeOpacity={0.75}
                    >
                      <View style={[s.severityDropdownIconWrap, { backgroundColor: currentColors.active + '18' }]}>
                        <MaterialCommunityIcons name={current.icon} size={18} color={currentColors.active} />
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={[s.severityDropdownLabel, { color: C.text }]}>{current.label}</Text>
                        <Text style={[s.severityDropdownDesc, { color: C.textTertiary }]}>{current.desc}</Text>
                      </View>
                      <MaterialCommunityIcons name={severityExpanded ? 'chevron-up' : 'chevron-down'} size={22} color={C.textTertiary} />
                    </TouchableOpacity>

                    {severityExpanded && (
                      <View style={[s.severityOptions, { backgroundColor: C.surface, borderColor: C.border }]}>
                        {SEVERITIES.map((sev, i) => {
                          const active = severity === sev.value;
                          const colors = getSeverityColors(sev.value, C);
                          return (
                            <TouchableOpacity
                              key={sev.value}
                              style={[s.severityOptionRow, i > 0 && { borderTopColor: C.border, borderTopWidth: StyleSheet.hairlineWidth }]}
                              onPress={() => handleSelectSeverity(sev.value)}
                              activeOpacity={0.7}
                            >
                              <View style={[s.severityDropdownIconWrap, { backgroundColor: colors.active + '18' }]}>
                                <MaterialCommunityIcons name={sev.icon} size={18} color={colors.active} />
                              </View>
                              <View style={{ flex: 1 }}>
                                <Text style={[s.severityDropdownLabel, { color: C.text }]}>{sev.label}</Text>
                                <Text style={[s.severityDropdownDesc, { color: C.textTertiary }]}>{sev.desc}</Text>
                              </View>
                              {active && <MaterialCommunityIcons name="check" size={20} color={colors.active} />}
                            </TouchableOpacity>
                          );
                        })}
                      </View>
                    )}
                  </View>
                );
              })()}

              {reasonError && (
                <View style={[s.errorBanner, { backgroundColor: C.surface, borderColor: C.error }]}>
                  <MaterialCommunityIcons name="alert-circle" size={14} color={C.error} />
                  <Text style={[s.errorBannerTxt, { color: C.error }]}>Please describe the defect before saving.</Text>
                </View>
              )}
              <TouchableOpacity
                style={[s.codePickerBtn, { backgroundColor: C.surface, borderColor: selectedCode ? C.primary : C.border }]}
                onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); setCodePickerVisible(true); }}
                activeOpacity={0.8}
              >
                <View style={[s.codePickerIcon, { backgroundColor: selectedCode ? C.primary + '18' : C.background }]}>
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
                {suggestedPrice !== null && (
                  <View style={s.priceBadge}><Text style={s.priceBadgeTxt}>${suggestedPrice}</Text></View>
                )}
                {selectedCode ? (
                  <TouchableOpacity onPress={() => { setSelectedCode(null); setSuggestedPrice(null); }} hitSlop={8} style={{ padding: 4 }}>
                    <MaterialCommunityIcons name="close-circle" size={18} color={C.textTertiary} />
                  </TouchableOpacity>
                ) : (
                  <MaterialCommunityIcons name="chevron-right" size={18} color={C.textTertiary} />
                )}
              </TouchableOpacity>
              <TextInput
                placeholder="Or type a custom description…"
                placeholderTextColor={C.textTertiary}
                value={defectReason}
                onChangeText={(v) => {
                  setDefectReason(v);
                  if (v.trim()) setReasonError(false);
                  if (selectedCode && v !== selectedCode.description) { setSelectedCode(null); setSuggestedPrice(null); }
                }}
                multiline
                textAlignVertical="top"
                style={[s.input, s.textArea, { backgroundColor: C.surface, borderColor: reasonError ? C.error : C.border, color: C.text, marginTop: 10 }]}
              />

              <Text style={[s.formLabel, { color: C.text }]}>Technician Notes</Text>
              <TextInput
                placeholder="Recommended actions, parts required, or follow-up details…"
                placeholderTextColor={C.textTertiary}
                value={note}
                onChangeText={setNote}
                multiline
                textAlignVertical="top"
                style={[s.input, s.textArea, { backgroundColor: C.surface, borderColor: C.border, color: C.text }]}
              />

              {/* The one real commit for a Fail — sits last, after every field
                  it saves, not in the middle of the card. */}
              <View style={s.defectActionsRow}>
                <TouchableOpacity
                  style={[s.replaceBtn, { backgroundColor: C.warning + '18', borderColor: C.warning }]}
                  onPress={handleReplaceNow}
                  activeOpacity={0.8}
                >
                  <MaterialCommunityIcons name="tools" size={16} color={C.warning} />
                  <Text style={[s.replaceBtnTxt, { color: C.warning }]}>Replace</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[s.saveDefectBtn, { backgroundColor: C.error }]}
                  onPress={handleSaveDefect}
                  activeOpacity={0.85}
                >
                  <MaterialCommunityIcons name="content-save-outline" size={16} color={C.textOnPrimary} />
                  <Text style={[s.saveDefectBtnTxt, { color: C.textOnPrimary }]}>Save Defect</Text>
                </TouchableOpacity>
              </View>
            </SectionCard>
          </Animated.View>
        )}

        {/* ── Note (Pass/N-T) — auto-saves on blur ─────────────────────── */}
        {result !== null && !isFailed && (
          <SectionCard icon="note-text-outline" title="Note" C={C}>
            <TextInput
              placeholder="e.g. Flow test done, unit relocated, access restricted…"
              placeholderTextColor={C.textTertiary}
              value={note}
              onChangeText={setNote}
              onBlur={() => { if (note !== (asset.technician_notes || '')) handleSaveNote(); }}
              multiline
              textAlignVertical="top"
              style={[s.input, s.textArea, { backgroundColor: C.background, borderColor: C.border, color: C.text }]}
            />
          </SectionCard>
        )}

        {/* ── History — proper pass/fail badge + photos per visit ──────── */}
        <SectionCard icon="history" title={`History${history.length > 0 ? ` · ${history.length} prior visit${history.length === 1 ? '' : 's'}` : ''}`} C={C}>
          {historyLoading ? (
            <ActivityIndicator size="small" color={C.textTertiary} />
          ) : history.length === 0 ? (
            <Text style={[s.historyEmpty, { color: C.textTertiary }]}>No prior visits recorded for this asset.</Text>
          ) : (
            <View>
              {history.map((h, i) => {
                const pill = resultPillColors(h.result);
                return (
                  <View key={h.jobId} style={[s.historyRow, i > 0 && { borderTopColor: C.border, borderTopWidth: 1 }]}>
                    <View style={{ flex: 1 }}>
                      <View style={s.historyTopRow}>
                        <Text style={[s.historyDate, { color: C.text }]}>{h.date ? h.date.slice(0, 10) : '—'}</Text>
                        <View style={[s.historyResultPill, { backgroundColor: pill.bg }]}>
                          <Text style={[s.historyResultPillTxt, { color: pill.fg }]}>{resultLabel(h.result)}</Text>
                        </View>
                      </View>
                      {h.technicianNotes ? <Text style={[s.historyNote, { color: C.textSecondary }]}>{h.technicianNotes}</Text> : null}
                      {h.defects.map((d) => (
                        <Text key={d.id} style={[s.historyNote, { color: C.textSecondary }]}>
                          {SEVERITY_LABEL[d.severity] ?? d.severity}: {d.description}
                        </Text>
                      ))}
                      {h.photos.length > 0 && (
                        <View style={s.historyPhotoRow}>
                          {h.photos.map((p) => (
                            <TouchableOpacity key={p.id} onPress={() => setViewingHistoryPhoto(p.photo_url)} activeOpacity={0.8}>
                              <Image source={{ uri: getValidLocalUri(p.photo_url) }} style={s.historyPhotoThumb} contentFit="cover" />
                            </TouchableOpacity>
                          ))}
                        </View>
                      )}
                    </View>
                  </View>
                );
              })}
              {failCount >= 2 && (
                <View style={[s.recurringFlag, { backgroundColor: C.errorLight }]}>
                  <MaterialCommunityIcons name="alert" size={14} color={C.errorDark} />
                  <Text style={[s.recurringTxt, { color: C.errorDark }]}>
                    Failed {failCount} of the last {history.length} visits — recurring issue
                  </Text>
                </View>
              )}
            </View>
          )}
        </SectionCard>

        {/* ── Timeline — raw field-level change log, distinct from the
            visit-level History above ──────────────────────────────── */}
        {asset.job_asset_id && (
          <SectionCard icon="clock-edit-outline" title="Timeline" C={C}>
            <Timeline tableName="job_assets" recordId={asset.job_asset_id} />
          </SectionCard>
        )}
      </ScrollView>
      </KeyboardAvoidingView>

      <DefectCodePicker
        visible={codePickerVisible}
        onSelect={handleCodeSelect}
        onClose={() => setCodePickerVisible(false)}
      />
      <PhotoChooserSheet
        visible={showPhotoChooser}
        onClose={() => setShowPhotoChooser(false)}
        onTakePhoto={handleTakePhoto}
        onPickGallery={handlePickPhoto}
      />
      <PhotoViewer
        uri={viewingPhoto}
        onClose={() => setViewingPhoto(null)}
        onDelete={() => viewingPhoto && handleRemovePhoto(viewingPhoto)}
      />
      <PhotoViewer
        uri={viewingHistoryPhoto}
        onClose={() => setViewingHistoryPhoto(null)}
      />
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1 },
  scrollContent: { padding: 16, paddingBottom: 48 },
  emptyWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32 },

  refLine: { fontSize: 12, fontWeight: '600', marginBottom: 18 },

  sectionLabel: {
    fontSize: 11, fontWeight: '700', letterSpacing: 0.5, textTransform: 'uppercase',
    marginTop: 22, marginBottom: 10,
  },

  // Result — single segmented track
  resultTrack: { flexDirection: 'row', borderRadius: 14, padding: 4, gap: 4, marginBottom: 20 },
  resultSeg: { flex: 1, height: 42, borderRadius: 10, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 },
  resultSegTxt: { fontSize: 14, fontWeight: '700' },

  // Section card — every section (Photos / Defect Details / Note / History)
  card: { borderRadius: 16, borderWidth: 1, padding: 16, marginBottom: 16 },
  cardHeaderRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 14 },
  cardHeaderIconWrap: { width: 30, height: 30, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  cardHeaderTitle: { fontSize: 13.5, fontWeight: '700' },

  chipRowLabel: { fontSize: 11, fontWeight: '700', letterSpacing: 0.4, textTransform: 'uppercase', marginBottom: 8 },

  // Severity — inline dropdown (trigger row + expanding options list, no modal)
  severityDropdown: { flexDirection: 'row', alignItems: 'center', gap: 12, borderRadius: 12, borderWidth: 1, padding: 12 },
  severityDropdownIconWrap: { width: 36, height: 36, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  severityDropdownLabel: { fontSize: 14, fontWeight: '700' },
  severityDropdownDesc: { fontSize: 12, marginTop: 1 },
  severityOptions: { borderRadius: 12, borderWidth: 1, marginTop: 8, overflow: 'hidden' },
  severityOptionRow: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12 },

  formLabel: { fontSize: 13, fontWeight: '700', marginBottom: 8, marginTop: 18, letterSpacing: 0.1 },

  errorBanner: { flexDirection: 'row', alignItems: 'center', gap: 6, padding: 10, borderRadius: 8, borderWidth: 1, marginBottom: 4 },
  errorBannerTxt: { fontSize: 12, fontWeight: '600', flex: 1 },

  codePickerBtn: { flexDirection: 'row', alignItems: 'center', gap: 12, borderRadius: 14, borderWidth: 1, padding: 14, marginBottom: 10 },
  codePickerIcon: { width: 36, height: 36, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  codePickerTitle: { fontSize: 13, fontWeight: '700' },
  codePickerSub: { fontSize: 11, marginTop: 2 },
  priceBadge: { backgroundColor: 'rgba(34,197,94,0.15)', borderWidth: 1, borderColor: 'rgba(34,197,94,0.3)', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8 },
  priceBadgeTxt: { fontSize: 11, fontWeight: '800', color: '#16A34A' },

  defectActionsRow: { flexDirection: 'row', gap: 10, marginTop: 4 },
  replaceBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, height: 46, borderRadius: 14, borderWidth: 1, paddingHorizontal: 16 },
  replaceBtnTxt: { fontSize: 13.5, fontWeight: '700' },
  saveDefectBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, height: 46, borderRadius: 14 },
  saveDefectBtnTxt: { fontSize: 14, fontWeight: '700' },

  // Input (shared by Defect Details description/notes + Pass/N-T note)
  input: { borderWidth: 1, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, fontSize: 14, fontWeight: '500' },
  textArea: { minHeight: 80, paddingTop: 12, textAlignVertical: 'top' },

  photoRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  photoThumbWrap: { width: 72, height: 72, borderRadius: 12, overflow: 'hidden' },
  photoThumb: { width: '100%', height: '100%' },
  photoAddTile: { width: 72, height: 72, borderRadius: 12, borderWidth: 1.5, borderStyle: 'dashed', alignItems: 'center', justifyContent: 'center' },

  historyEmpty: { fontSize: 12.5, fontStyle: 'italic' },
  historyRow: { flexDirection: 'row', gap: 10, paddingVertical: 12 },
  historyTopRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  historyDate: { fontSize: 12.5, fontWeight: '700' },
  historyResultPill: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 999 },
  historyResultPillTxt: { fontSize: 10, fontWeight: '800', letterSpacing: 0.3, textTransform: 'uppercase' },
  historyNote: { fontSize: 12, lineHeight: 17, marginTop: 4 },
  historyPhotoRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 10 },
  historyPhotoThumb: { width: 56, height: 56, borderRadius: 10 },

  recurringFlag: { flexDirection: 'row', alignItems: 'center', gap: 7, padding: 10, borderRadius: 10, marginTop: 4 },
  recurringTxt: { fontSize: 12, fontWeight: '700', flex: 1 },

  // Photo chooser sheet
  chooserOverlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.4)', padding: 12, gap: 8 },
  chooserSheet: { borderRadius: 18, overflow: 'hidden', paddingTop: 14, paddingBottom: 6 },
  chooserTitle: { fontSize: 12, fontWeight: '700', textAlign: 'center', textTransform: 'uppercase', letterSpacing: 0.5, opacity: 0.6, paddingBottom: 10 },
  chooserRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 18, paddingVertical: 14 },
  chooserIconWrap: { width: 36, height: 36, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  chooserRowTxt: { fontSize: 15, fontWeight: '700' },
  chooserDivider: { height: StyleSheet.hairlineWidth, marginLeft: 18 },
  chooserCancel: { borderRadius: 18, paddingVertical: 15, alignItems: 'center' },
  chooserCancelTxt: { fontSize: 16, fontWeight: '700' },

  // Photo viewer
  viewerOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.92)', alignItems: 'center', justifyContent: 'center' },
  viewerCloseBtn: { position: 'absolute', top: 50, right: 20, zIndex: 10, padding: 8 },
  viewerImage: { width: '100%', height: '80%' },
  viewerDeleteBtn: {
    position: 'absolute', bottom: 50, flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: 'rgba(220,38,38,0.9)', paddingHorizontal: 18, paddingVertical: 12, borderRadius: 24,
  },
  viewerDeleteTxt: { color: '#fff', fontSize: 14, fontWeight: '700' },
});
