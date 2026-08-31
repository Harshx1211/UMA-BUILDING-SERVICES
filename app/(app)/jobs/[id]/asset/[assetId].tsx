/**
 * Asset Detail screen — everything about ONE asset that used to be crammed
 * inline onto its card in the inspect list (photos, note, defect detail),
 * plus History: every prior visit's result/note/defect/photos for this exact
 * physical asset. Reached via router.push from inspect.tsx's AssetCard
 * (tapping the card body, not the Pass/Fail/N-T buttons — those stay on the
 * list for speed). A real screen with native back, not a modal.
 */
import React, { useEffect, useState } from 'react';
import {
  View, StyleSheet, TouchableOpacity, ScrollView, Modal,
} from 'react-native';
import { Text, ActivityIndicator } from 'react-native-paper';
import { Image } from 'expo-image';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useLocalSearchParams } from 'expo-router';
import { useColors } from '@/hooks/useColors';
import { useReducedMotion } from '@/hooks/useReducedMotion';
import { ScreenHeader, showConfirm } from '@/components/ui';
import { InspectionResult, DefectSeverity } from '@/constants/Enums';
import { useInspectionStore } from '@/store/inspectionStore';
import Animated, { FadeIn } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import * as ImagePicker from 'expo-image-picker';
import * as ImageManipulator from 'expo-image-manipulator';
import * as FileSystem from 'expo-file-system/legacy';

import AssetInspectModal from '@/components/inspections/AssetInspectModal';
import AssetNoteModal from '@/components/inspections/AssetNoteModal';
import { formatAssetType, formatLocationCode } from '@/utils/assetHelpers';
import { getValidLocalUri } from '@/utils/fileHelpers';
import { getAssetHistory, AssetHistoryEntry } from '@/lib/database';

// ─── Small bottom sheet: Take Photo / Choose from Gallery ─────────────────
// Same component as inspect.tsx used to have inline — moved here since this
// is now the only screen that captures photos for an asset.
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
  const { id: jobId, assetId } = useLocalSearchParams<{ id: string; assetId: string }>();
  const { assets, updateAssetResult, addPhotoToAsset, removePhotoFromAsset, isSaving } = useInspectionStore();
  const asset = assets.find((a) => a.id === assetId);

  const [showFailModal, setShowFailModal] = useState(false);
  const [showNoteModal, setShowNoteModal] = useState(false);
  const [showPhotoChooser, setShowPhotoChooser] = useState(false);
  const [isAddingPhoto, setIsAddingPhoto] = useState(false);
  const [viewingPhoto, setViewingPhoto] = useState<string | null>(null);
  const [viewingHistoryPhoto, setViewingHistoryPhoto] = useState<string | null>(null);

  const [history, setHistory] = useState<AssetHistoryEntry[]>([]);
  const [historyLoading, setHistoryLoading] = useState(true);

  useEffect(() => {
    if (!assetId || !jobId) return;
    setHistoryLoading(true);
    setHistory(getAssetHistory(assetId, jobId));
    setHistoryLoading(false);
  }, [assetId, jobId]);

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
      updateAssetResult(asset.id, res, asset.checklist_data ?? undefined, asset.is_compliant ?? true, undefined, asset.technician_notes || '');
    } else if (res === InspectionResult.Fail) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      setShowFailModal(true);
    } else {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      updateAssetResult(asset.id, res, asset.checklist_data ?? undefined, false, undefined, asset.technician_notes || '');
    }
  };

  const handleSaveFail = (
    reason: string,
    notes: string,
    severity?: DefectSeverity,
    defectCode?: string | null,
    quotePrice?: number | null,
  ) => {
    updateAssetResult(asset.id, InspectionResult.Fail, asset.checklist_data ?? undefined, false, reason, notes, undefined, severity, defectCode, quotePrice);
    setShowFailModal(false);
  };

  const handleSaveNote = (note: string) => {
    updateAssetResult(asset.id, asset.result, asset.checklist_data ?? undefined, asset.is_compliant, asset.defect_reason ?? undefined, note);
  };

  const result = asset.result;
  const isPassed = result === InspectionResult.Pass;
  const isFailed = result === InspectionResult.Fail;
  const isNT = result === InspectionResult.NotTested;

  const failCount = history.filter((h) => h.result === 'fail').length;
  const location = asset.location_on_site ? formatLocationCode(asset.location_on_site) : 'No location specified';

  return (
    <View style={[s.container, { backgroundColor: C.background }]}>
      <ScreenHeader title={formatAssetType(asset.asset_type)} subtitle={location} showBack />

      <ScrollView contentContainerStyle={s.scrollContent} showsVerticalScrollIndicator={false}>
        {(asset.asset_ref || asset.serial_number) && (
          <Text style={[s.refLine, { color: C.textTertiary }]}>
            {asset.asset_ref ? `Ref: ${asset.asset_ref}` : `S/N: ${asset.serial_number}`}
          </Text>
        )}

        {/* ── Result ─────────────────────────────────────────── */}
        <Text style={[s.sectionLabel, { color: C.textTertiary }]}>Result</Text>
        <View style={[s.resultBtnRow, { opacity: isSaving ? 0.5 : 1 }]}>
          <TouchableOpacity
            style={[s.resultBtn, isPassed ? { backgroundColor: C.success, borderColor: C.success } : { backgroundColor: C.successLight, borderColor: C.success }]}
            onPress={() => !isSaving && handleResult(InspectionResult.Pass)}
            activeOpacity={0.8}
            disabled={isSaving}
          >
            <MaterialCommunityIcons name="check-circle" size={17} color={isPassed ? C.textOnPrimary : C.success} />
            <Text style={[s.resultBtnTxt, { color: isPassed ? C.textOnPrimary : C.success }]}>Pass</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[s.resultBtn, isFailed ? { backgroundColor: C.error, borderColor: C.error } : { backgroundColor: C.errorLight, borderColor: C.error }]}
            onPress={() => !isSaving && handleResult(InspectionResult.Fail)}
            activeOpacity={0.8}
            disabled={isSaving}
          >
            <MaterialCommunityIcons name="close-circle" size={17} color={isFailed ? C.textOnPrimary : C.error} />
            <Text style={[s.resultBtnTxt, { color: isFailed ? C.textOnPrimary : C.error }]}>Fail</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[s.resultBtn, isNT ? { backgroundColor: C.textSecondary, borderColor: C.textSecondary } : { backgroundColor: C.backgroundTertiary, borderColor: C.border }]}
            onPress={() => !isSaving && handleResult(InspectionResult.NotTested)}
            activeOpacity={0.8}
            disabled={isSaving}
          >
            <MaterialCommunityIcons name="minus-circle-outline" size={17} color={isNT ? C.textOnPrimary : C.textSecondary} />
            <Text style={[s.resultBtnTxt, { color: isNT ? C.textOnPrimary : C.textSecondary }]}>N/T</Text>
          </TouchableOpacity>
        </View>

        {isFailed && Boolean(asset.defect_reason) && (
          <Animated.View entering={noMotion ? undefined : FadeIn.duration(300)} style={[s.noticeBox, { backgroundColor: C.errorLight, borderColor: C.error }]}>
            <MaterialCommunityIcons name="alert-circle" size={15} color={C.errorDark} />
            <View style={{ flex: 1 }}>
              <Text style={[s.noticeTitle, { color: C.errorDark }]}>Defect Logged</Text>
              <Text style={[s.noticeBody, { color: C.error }]}>{asset.defect_reason}</Text>
            </View>
            <TouchableOpacity onPress={() => setShowFailModal(true)} hitSlop={8}>
              <Text style={[s.noticeEditTxt, { color: C.errorDark }]}>Edit</Text>
            </TouchableOpacity>
          </Animated.View>
        )}

        {/* ── Photos ─────────────────────────────────────────── */}
        <Text style={[s.sectionLabel, { color: C.textTertiary }]}>Photos</Text>
        <View style={s.photoRow}>
          {(asset.photos ?? []).map((uri) => (
            <TouchableOpacity key={uri} style={s.photoThumbWrap} onPress={() => setViewingPhoto(uri)} activeOpacity={0.8}>
              <Image source={{ uri: getValidLocalUri(uri) }} style={s.photoThumb} contentFit="cover" />
            </TouchableOpacity>
          ))}
          <TouchableOpacity
            style={[s.photoAddTile, { backgroundColor: C.backgroundTertiary, borderColor: C.border }]}
            onPress={() => !isAddingPhoto && setShowPhotoChooser(true)}
            activeOpacity={0.8}
            disabled={isAddingPhoto}
          >
            {isAddingPhoto
              ? <ActivityIndicator size="small" color={C.textSecondary} />
              : <MaterialCommunityIcons name="camera-plus-outline" size={20} color={C.textSecondary} />}
          </TouchableOpacity>
        </View>

        {/* ── Note ───────────────────────────────────────────── */}
        {result !== null && !isFailed && (
          <>
            <Text style={[s.sectionLabel, { color: C.textTertiary }]}>Note</Text>
            {asset.technician_notes ? (
              <TouchableOpacity
                style={[s.noticeBox, { backgroundColor: C.infoLight, borderColor: C.info }]}
                onPress={() => setShowNoteModal(true)}
                activeOpacity={0.8}
              >
                <MaterialCommunityIcons name="note-text-outline" size={15} color={C.infoDark} />
                <Text style={[s.noticeBody, { color: C.info, flex: 1 }]}>{asset.technician_notes}</Text>
                <Text style={[s.noticeEditTxt, { color: C.infoDark }]}>Edit</Text>
              </TouchableOpacity>
            ) : (
              <TouchableOpacity
                style={[s.addNoteRow, { borderColor: C.border }]}
                onPress={() => setShowNoteModal(true)}
              >
                <MaterialCommunityIcons name="note-plus-outline" size={16} color={C.textTertiary} />
                <Text style={[s.addNoteTxt, { color: C.textTertiary }]}>Add a note</Text>
              </TouchableOpacity>
            )}
          </>
        )}

        {/* ── History ────────────────────────────────────────── */}
        <Text style={[s.sectionLabel, { color: C.textTertiary }]}>
          History{history.length > 0 ? ` · ${history.length} prior visit${history.length === 1 ? '' : 's'}` : ''}
        </Text>
        {historyLoading ? (
          <ActivityIndicator size="small" color={C.textTertiary} style={{ marginTop: 4 }} />
        ) : history.length === 0 ? (
          <Text style={[s.historyEmpty, { color: C.textTertiary }]}>No prior visits recorded for this asset.</Text>
        ) : (
          <View>
            {history.map((h, i) => (
              <View key={h.jobId} style={[s.historyRow, i > 0 && { borderTopColor: C.border, borderTopWidth: 1 }]}>
                <View style={[s.historyDot, { backgroundColor: h.result === 'pass' ? C.success : h.result === 'fail' ? C.error : C.textTertiary }]} />
                <View style={{ flex: 1 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                    <Text style={[s.historyDate, { color: C.text }]}>{h.date ? h.date.slice(0, 10) : '—'}</Text>
                    <Text style={[s.historyResult, { color: h.result === 'pass' ? C.success : h.result === 'fail' ? C.error : C.textTertiary }]}>
                      {resultLabel(h.result)}
                    </Text>
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
            ))}
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
      </ScrollView>

      <AssetInspectModal
        visible={showFailModal}
        asset={asset}
        jobId={jobId as string}
        onClose={() => setShowFailModal(false)}
        onSaveFail={handleSaveFail}
      />
      <AssetNoteModal
        visible={showNoteModal}
        initialNote={asset.technician_notes ?? ''}
        assetType={formatAssetType(asset.asset_type)}
        location={asset.location_on_site ? formatLocationCode(asset.location_on_site) : null}
        onClose={() => setShowNoteModal(false)}
        onSave={handleSaveNote}
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

  resultBtnRow: { flexDirection: 'row', gap: 8 },
  resultBtn: { flex: 1, height: 46, borderRadius: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, borderWidth: 1 },
  resultBtnTxt: { fontSize: 14.5, fontWeight: '700' },

  noticeBox: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 12, borderRadius: 12, borderWidth: 1, marginTop: 10 },
  noticeTitle: { fontSize: 11, fontWeight: '800', letterSpacing: 0.2, textTransform: 'uppercase' },
  noticeBody: { fontSize: 13, fontWeight: '500', marginTop: 1 },
  noticeEditTxt: { fontSize: 12, fontWeight: '700' },

  addNoteRow: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    borderWidth: 1, borderStyle: 'dashed', borderRadius: 12, padding: 12,
  },
  addNoteTxt: { fontSize: 13, fontWeight: '600' },

  photoRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  photoThumbWrap: { width: 76, height: 76, borderRadius: 12, overflow: 'hidden' },
  photoThumb: { width: '100%', height: '100%' },
  photoAddTile: { width: 76, height: 76, borderRadius: 12, borderWidth: 1, borderStyle: 'dashed', alignItems: 'center', justifyContent: 'center' },

  historyEmpty: { fontSize: 12.5, fontStyle: 'italic' },
  historyRow: { flexDirection: 'row', gap: 10, paddingVertical: 12 },
  historyDot: { width: 8, height: 8, borderRadius: 4, marginTop: 5 },
  historyDate: { fontSize: 12.5, fontWeight: '700' },
  historyResult: { fontSize: 10.5, fontWeight: '800', letterSpacing: 0.3, textTransform: 'uppercase' },
  historyNote: { fontSize: 12, lineHeight: 17, marginTop: 3 },
  historyPhotoRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 8 },
  historyPhotoThumb: { width: 48, height: 48, borderRadius: 8 },

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
