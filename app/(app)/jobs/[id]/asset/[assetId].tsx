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
import { InspectionResult, DefectSeverity, JobStatus } from '@/constants/Enums';
import { useInspectionStore } from '@/store/inspectionStore';
import Animated, { FadeIn } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import * as ImagePicker from 'expo-image-picker';
import * as ImageManipulator from 'expo-image-manipulator';
import * as FileSystem from 'expo-file-system/legacy';
import Toast from 'react-native-toast-message';

import { DefectFieldsCard, DefectFieldsValue } from '@/components/defects/DefectFieldsCard';
import DefectCard from '@/components/defects/DefectCard';
import { formatAssetType, formatLocationCode, formatRelativeDays } from '@/utils/assetHelpers';
import { getValidLocalUri } from '@/utils/fileHelpers';
import { getAssetHistory, AssetHistoryEntry, getJobById } from '@/lib/database';
import { Timeline } from '@/components/audit/Timeline';
import { useDefectsStore } from '@/store/defectsStore';
import { useJobLiveSync } from '@/hooks/useJobLiveSync';
import { onSyncComplete, offSyncComplete } from '@/lib/sync';

type ColorsType = ReturnType<typeof useColors>;
type MCIconName = React.ComponentProps<typeof MaterialCommunityIcons>['name'];

// Prior visits shown by default before the technician has to explicitly
// ask for more — see the History section's own loadMoreHistory().
const HISTORY_PAGE_SIZE = 3;

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

  // An asset can have more than one defect (e.g. "past service life" AND
  // "bracket damaged"). The oldest one (by created_at) is the "primary" —
  // it's the one a fresh Fail creates via updateAssetResult below, so it
  // keeps that exact save path; any further ones are independent defects
  // saved directly through defectsStore. Whichever isn't the one currently
  // being edited renders as a DefectCard summary (see editingDefectId).
  const { defects: jobDefects, loadDefects: loadJobDefects } = useDefectsStore();
  const assetDefects = jobDefects
    .filter((d) => d.asset_id === assetId)
    .sort((a, b) => a.created_at.localeCompare(b.created_at));
  const primaryDefect = assetDefects[0] ?? null;
  const additionalDefects = assetDefects.slice(1);
  // A real defect's id = editing that one; 'new' = composing an additional
  // defect that doesn't exist yet; null = everything collapsed to summaries.
  const [editingDefectId, setEditingDefectId] = useState<string | 'new' | null>(null);

  // FIX: this screen had NO awareness at all of the job being Completed/
  // Cancelled — updateAssetResult/defectsStore already refuse the write in
  // that case, but nothing here reflected that upfront. A technician who
  // landed here via back-navigation (or a stale nav stack) after the job
  // had been completed elsewhere saw a fully interactive-looking screen —
  // every button, the defect form, notes — and only discovered it was
  // locked when a save silently failed with a toast. Mirrors the same
  // locked-banner treatment defects/[defectId].tsx already has.
  const [jobLocked, setJobLocked] = useState(false);

  const refreshJobLocked = useCallback(() => {
    if (!jobId) return;
    const job = getJobById<{ status: string }>(jobId);
    setJobLocked(job?.status === JobStatus.Completed || job?.status === JobStatus.Cancelled);
  }, [jobId]);

  useFocusEffect(
    useCallback(() => {
      if (jobId) loadJobDefects(jobId);
      refreshJobLocked();
    }, [jobId, loadJobDefects, refreshJobLocked])
  );

  // This screen — not the checklist list — is where a technician actually
  // spends their time (viewing photos, filling in a defect, tapping Save
  // Defect), so it needs its own live subscription just like inspect.tsx
  // does. Without this, opening any asset's detail screen silently dropped
  // the job's live channel (inspect.tsx's own useFocusEffect tore it down on
  // blur) and nothing here ever reopened it — a teammate's change made while
  // you were sitting on this exact screen just never arrived. See
  // useJobLiveSync's comment for how multiple screens hand the channel off.
  useJobLiveSync(jobId, useCallback((table) => {
    // job_assets AND inspection_photos both surface on this asset's own
    // fields (result/notes, and the Photos section respectively).
    // FIX: this used to be an unconditional `else` written when the live
    // channel only ever carried job_assets/defects/inspection_photos/jobs —
    // now that it also carries job_technicians/quotes/quote_items/
    // time_logs/site_documents (none of which this screen displays), that
    // catch-all fired a full, unnecessary loadAssetsForInspection reload
    // for every one of them too.
    if (table === 'jobs') refreshJobLocked();
    else if (table === 'defects') loadJobDefects(jobId);
    else if (table === 'job_assets' || table === 'inspection_photos') useInspectionStore.getState().loadAssetsForInspection(jobId);
  }, [jobId, loadJobDefects, refreshJobLocked]));

  // FIX: subscribeToJobLive never subscribes to DELETE events for any
  // table — the only way a deletion made on another device reaches this
  // device at all is via deletion_log's own onSyncComplete event
  // (subscribeToMyDataLive), a completely separate signal from
  // useJobLiveSync's onChange above. This is the screen a technician
  // actually spends the most time on (viewing photos, filling in a
  // defect), so without this a crew-mate deleting the very asset/defect
  // being viewed left it showing fully editable stale data with zero live
  // signal — and saving against it could silently resurrect the deleted
  // job_assets row locally (see updateAssetResult's own fix comment in
  // store/inspectionStore.ts). Same reloads the live-sync callback above
  // already does.
  useEffect(() => {
    if (!jobId) return;
    const reload = () => {
      loadJobDefects(jobId);
      useInspectionStore.getState().loadAssetsForInspection(jobId);
    };
    onSyncComplete(reload);
    return () => offSyncComplete(reload);
  }, [jobId, loadJobDefects]);

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
  const [historyTotal, setHistoryTotal] = useState(0);
  const [historyLoadingMore, setHistoryLoadingMore] = useState(false);

  // `note` backs job_assets.technician_notes for both the Fail and Pass/N-T
  // "Note" cards — same column, same field, whichever card happens to be
  // showing for the current result.
  const [note, setNote] = useState(asset?.technician_notes || '');

  // Live draft of whichever defect card is currently expanded for editing —
  // reported up via DefectFieldsCard's onDraftChange.
  const [primaryDraft, setPrimaryDraft] = useState<DefectFieldsValue | null>(null);
  // FIX: an in-progress ADDITIONAL defect (new, or editing an existing one)
  // previously had no equivalent leave-without-saving protection — a
  // technician who started a second defect, typed a description, then left
  // (interrupted, wrong screen, phone call) lost the whole draft silently,
  // while the exact same interruption on the primary defect was already
  // protected. Mirrors primaryDraft below.
  const [additionalDraft, setAdditionalDraft] = useState<DefectFieldsValue | null>(null);

  // FIX: this used to load the asset's ENTIRE prior-visit history (however
  // many years of results/defects/photos that adds up to) every time the
  // screen opened. Most of the time a technician only cares about the most
  // recent visits, so only HISTORY_PAGE_SIZE loads up front — the rest is
  // only ever fetched if they explicitly ask for more (loadMoreHistory
  // below), in a batch size they pick themselves.
  useEffect(() => {
    if (!assetId || !jobId) return;
    setHistoryLoading(true);
    const { entries, totalCount } = getAssetHistory(assetId, jobId, { limit: HISTORY_PAGE_SIZE });
    setHistory(entries);
    setHistoryTotal(totalCount);
    setHistoryLoading(false);
  }, [assetId, jobId]);

  // `count` is however many MORE visits the technician asked for (see the
  // "+5"/"+10"/"All remaining" chips in the History section) — always
  // starts reading right after whatever's already loaded, never refetches
  // visits already on screen.
  const loadMoreHistory = useCallback((count: number) => {
    if (!assetId || !jobId || historyLoadingMore) return;
    setHistoryLoadingMore(true);
    try {
      const { entries } = getAssetHistory(assetId, jobId, { limit: count, offset: history.length });
      setHistory((prev) => [...prev, ...entries]);
    } finally {
      setHistoryLoadingMore(false);
    }
  }, [assetId, jobId, history.length, historyLoadingMore]);

  // Always-current snapshot of the editable fields + asset, read by the
  // flush-on-leave effect below. A plain ref assigned every render (not a
  // `useEffect`) so the focus-effect's cleanup — set up once, at the last
  // time this screen gained focus — never sees stale values no matter how
  // long the screen's been open or how many keystrokes happened since.
  const latestRef = useRef({
    note, primaryDraft, additionalDraft, editingDefectId,
    isFailed: asset?.result === InspectionResult.Fail || pendingFail, asset,
    primaryDefectId: primaryDefect?.id ?? null,
  });
  latestRef.current = {
    note, primaryDraft, additionalDraft, editingDefectId,
    isFailed: asset?.result === InspectionResult.Fail || pendingFail, asset,
    primaryDefectId: primaryDefect?.id ?? null,
  };

  // Persist whatever's unsaved the moment this screen loses focus — back
  // button, swipe-back, or navigating elsewhere — so typing a note or a
  // defect description and leaving without an explicit Save never loses it.
  // Fires on blur, not on every keystroke, so it doesn't fight the explicit
  // Save Defect/Save-on-blur paths; it's a safety net for whatever they
  // didn't get to.
  useFocusEffect(
    useCallback(() => {
      return () => {
        const {
          note: n, primaryDraft: pd, additionalDraft: ad, editingDefectId: eid,
          isFailed: failed, asset: a, primaryDefectId,
        } = latestRef.current;
        if (!a) return;
        // FIX: both stores reject a write against a locked (Completed/
        // Cancelled) job by catching their own thrown error internally and
        // setting it on `error` state — neither ever surfaces to a caller
        // that doesn't explicitly check. This leave-effect fires silently on
        // blur, so an edit made just as the job locked (e.g. a crew-mate
        // completing it elsewhere) used to vanish with zero indication to
        // the technician. Checking each store's own error state right after
        // the call reliably reflects THIS call's outcome, since both clear
        // `error` to null at the very start of their own try block.
        const notifyIfRejected = (getError: () => string | null) => {
          const err = getError();
          if (err) Toast.show({ type: 'error', text1: "Couldn't save your change", text2: err });
        };

        const descTrim = pd?.description.trim() ?? '';
        if (failed && descTrim) {
          const noteTrim = n.trim();
          if (descTrim !== (a.defect_reason || '') || noteTrim !== (a.technician_notes || '')) {
            updateAssetResult(a.id, InspectionResult.Fail, a.checklist_data ?? undefined, false, descTrim, noteTrim, undefined, pd!.severity, pd!.defectCode, pd!.quotePrice);
            notifyIfRejected(() => useInspectionStore.getState().error);
          }
        } else if (!failed && n.trim() !== (a.technician_notes || '')) {
          updateAssetResult(a.id, a.result, a.checklist_data ?? undefined, a.is_compliant, a.defect_reason ?? undefined, n.trim());
          notifyIfRejected(() => useInspectionStore.getState().error);
        }

        // FIX: same safety net as above, extended to an in-progress
        // additional defect — `eid` is only a real additional-defect id or
        // 'new' while that card is actively expanded; Cancel/Save both
        // clear it immediately, so this can't double-fire against an
        // already-handled save.
        const adDescTrim = ad?.description.trim() ?? '';
        if (adDescTrim && eid && eid !== primaryDefectId) {
          if (eid === 'new') {
            useDefectsStore.getState().addDefect({
              job_id: jobId as string,
              property_id: a.property_id,
              asset_id: a.id,
              description: ad!.description,
              severity: ad!.severity,
              photos: [],
              defect_code: ad!.defectCode,
              quote_price: ad!.quotePrice,
            });
          } else {
            useDefectsStore.getState().updateDefect(eid, {
              description: ad!.description,
              severity: ad!.severity,
              defect_code: ad!.defectCode,
              quote_price: ad!.quotePrice,
            });
          }
          notifyIfRejected(() => useDefectsStore.getState().error);
        }
      };
    }, [updateAssetResult, jobId])
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

  // The primary defect's real save — unchanged from before: still the one
  // write that actually commits result: 'fail' via updateAssetResult.
  // Validation now happens inside DefectFieldsCard itself, so onSave only
  // ever fires with a non-empty description.
  const handleSaveDefect = (value: DefectFieldsValue) => {
    // FIX: forceNewDefect=pendingFail — a fresh Pass/N-T -> Fail transition
    // must never merge into whatever unrelated defect might already exist
    // on this asset (see updateAssetResult's own comment on this param).
    // Re-editing an already-Fail asset's existing defect (pendingFail is
    // false by then) still merges into it exactly as before.
    updateAssetResult(asset.id, InspectionResult.Fail, asset.checklist_data ?? undefined, false, value.description, note.trim(), undefined, value.severity, value.defectCode, value.quotePrice, pendingFail);
    setPendingFail(false);
    setPrimaryDraft(null);
    setEditingDefectId(null);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    Toast.show({ type: 'success', text1: 'Defect saved' });
  };

  const handleReplaceNow = (value: DefectFieldsValue) => {
    updateAssetResult(asset.id, InspectionResult.Fail, asset.checklist_data ?? undefined, false, value.description, note.trim(), undefined, DefectSeverity.Critical, value.defectCode, value.quotePrice);
    setPendingFail(false);
    setPrimaryDraft(null);
    setEditingDefectId(null);
    setTimeout(() => router.push(`/jobs/${jobId}/quote` as never), 400);
  };

  // Any defect beyond the first is a genuinely independent record, saved
  // directly through defectsStore — the same store the standalone Defects
  // screen already uses, not routed through updateAssetResult at all.
  const handleSaveAdditionalDefect = (defectId: string | null, value: DefectFieldsValue) => {
    if (defectId) {
      useDefectsStore.getState().updateDefect(defectId, {
        description: value.description,
        severity: value.severity,
        defect_code: value.defectCode,
        quote_price: value.quotePrice,
      });
      Toast.show({ type: 'success', text1: 'Defect updated' });
    } else {
      const newId = useDefectsStore.getState().addDefect({
        job_id: jobId as string,
        property_id: asset.property_id,
        asset_id: asset.id,
        description: value.description,
        severity: value.severity,
        photos: [],
        defect_code: value.defectCode,
        quote_price: value.quotePrice,
      });
      if (!newId) {
        Toast.show({ type: 'error', text1: 'Could not save defect', text2: useDefectsStore.getState().error ?? 'Please try again.' });
        return;
      }
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      Toast.show({ type: 'success', text1: 'Defect added' });
    }
    loadJobDefects(jobId as string);
    setAdditionalDraft(null);
    setEditingDefectId(null);
  };

  const handleDeleteAdditionalDefect = (defectId: string) => {
    showConfirm({
      title: 'Remove Defect',
      message: 'This will permanently remove this defect record. Continue?',
      icon: 'trash-can-outline',
      buttons: [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: () => {
            useDefectsStore.getState().deleteDefect(defectId);
            loadJobDefects(jobId as string);
            // Removing the last defect on this asset resets it back to
            // not-inspected (see deleteDefect's clearOrphanedFail) — refresh
            // so this screen's Result track reflects that immediately
            // instead of still showing a stale Fail.
            useInspectionStore.getState().loadAssetsForInspection(jobId as string);
            setEditingDefectId(null);
            Toast.show({ type: 'success', text1: 'Defect removed' });
          },
        },
      ],
    });
  };

  // Notes-only save, shared by Pass/N-T's Note card AND Fail's (once a
  // primary defect already exists — see the Notes card's onBlur guard).
  // updateAssetResult still re-syncs the defects table whenever result is
  // Fail and defect_reason is truthy (unchanged, pre-existing behaviour —
  // see its own "Defect auto-create / update" block), so a Fail asset's
  // notes save MUST pass the primary defect's real current severity/code/
  // price through here too. Omitting them isn't "leave them alone" — that
  // block defaults a missing severity to Non-critical, which would have
  // silently downgraded a Critical defect on every single notes edit.
  const handleSaveNote = () => {
    updateAssetResult(
      asset.id, asset.result, asset.checklist_data ?? undefined, asset.is_compliant,
      asset.defect_reason ?? undefined, note.trim(), undefined,
      primaryDefect?.severity, primaryDefect?.defect_code ?? null, primaryDefect?.quote_price ?? null,
    );
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
        {jobLocked && (
          <Animated.View entering={noMotion ? undefined : FadeIn.duration(220)}>
            <View style={[s.lockedBanner, { backgroundColor: C.backgroundTertiary, borderColor: C.border }]}>
              <MaterialCommunityIcons name="lock-outline" size={15} color={C.textTertiary} />
              <Text style={[s.lockedTxt, { color: C.textTertiary }]}>
                This job is completed or cancelled — read-only. Tap &quot;Continue Working&quot; on the job screen to make changes.
              </Text>
            </View>
          </Animated.View>
        )}
        {(asset.asset_ref || asset.serial_number || history[0]?.date) && (
          <Text style={[s.refLine, { color: C.textTertiary }]}>
            {asset.asset_ref ? `Ref: ${asset.asset_ref}` : asset.serial_number ? `S/N: ${asset.serial_number}` : ''}
            {history[0]?.date ? `${asset.asset_ref || asset.serial_number ? '  ·  ' : ''}Last serviced ${formatRelativeDays(history[0].date)}` : ''}
          </Text>
        )}

        {/* ── Result — one segmented track, not three separate boxes ──── */}
        <Text style={[s.sectionLabel, { color: C.textTertiary, marginTop: 0 }]}>Result</Text>
        <View style={[s.resultTrack, { backgroundColor: C.backgroundTertiary, opacity: (isSaving || jobLocked) ? 0.5 : 1 }]}>
          <TouchableOpacity
            style={[s.resultSeg, isPassed && { backgroundColor: C.success }]}
            onPress={() => !isSaving && !jobLocked && handleResult(InspectionResult.Pass)}
            activeOpacity={0.8}
            disabled={isSaving || jobLocked}
          >
            <MaterialCommunityIcons name="check-circle" size={16} color={isPassed ? C.textOnPrimary : C.success} />
            <Text style={[s.resultSegTxt, { color: isPassed ? C.textOnPrimary : C.success }]}>Pass</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[s.resultSeg, isFailed && { backgroundColor: C.error }]}
            onPress={() => !isSaving && !jobLocked && handleResult(InspectionResult.Fail)}
            activeOpacity={0.8}
            disabled={isSaving || jobLocked}
          >
            <MaterialCommunityIcons name="close-circle" size={16} color={isFailed ? C.textOnPrimary : C.error} />
            <Text style={[s.resultSegTxt, { color: isFailed ? C.textOnPrimary : C.error }]}>Fail</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[s.resultSeg, isNT && { backgroundColor: C.textSecondary }]}
            onPress={() => !isSaving && !jobLocked && handleResult(InspectionResult.NotTested)}
            activeOpacity={0.8}
            disabled={isSaving || jobLocked}
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
            {!jobLocked && (
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
            )}
          </View>
        </SectionCard>

        {/* ── Defects — one card per defect. Whichever one isn't being
            actively edited collapses to a DefectCard summary (the same
            component the standalone Defects screen uses), so a fresh Fail's
            form, a re-opened existing defect, and a second/third defect
            added later all look and behave like the same feature instead of
            three different ones. ─────────────────────────────────────── */}
        {isFailed && (
          <Animated.View entering={noMotion ? undefined : FadeIn.duration(300)}>
            <Text style={[s.sectionLabel, { color: C.textTertiary }]}>
              Defects{assetDefects.length > 0 ? ` · ${assetDefects.length}` : ''}
            </Text>

            {primaryDefect === null || pendingFail ? (
              // Nothing saved yet — this IS the Fail commit (see
              // handleSaveDefect), so there's no summary state to collapse to.
              // FIX: `pendingFail` (a fresh Pass/N-T -> Fail transition) is
              // included here too, not just `primaryDefect === null` — this
              // asset can already carry a genuinely unrelated defect (logged
              // earlier via the standalone Defects screen against an asset
              // that wasn't Fail yet), and collapsing straight to that
              // defect's own DefectCard summary meant the only way to
              // actually commit this new Fail was to tap Edit on it and
              // overwrite its unrelated content. A fresh Fail always gets
              // its own blank form; handleSaveDefect's forceNewDefect keeps
              // this as an independent record rather than merging the two.
              <DefectFieldsCard
                onSave={handleSaveDefect}
                onReplace={handleReplaceNow}
                onDraftChange={setPrimaryDraft}
                saving={isSaving || jobLocked}
                saveLabel="Save Defect"
              />
            ) : editingDefectId === primaryDefect.id && !jobLocked ? (
              <DefectFieldsCard
                initial={primaryDefect}
                onSave={handleSaveDefect}
                onReplace={handleReplaceNow}
                onCancel={() => { setPrimaryDraft(null); setEditingDefectId(null); }}
                onDraftChange={setPrimaryDraft}
                saving={isSaving}
                saveLabel="Save Changes"
              />
            ) : (
              <DefectCard
                defect={primaryDefect}
                style={s.defectCardFlush}
                onPress={() => router.push(`/jobs/${jobId}/defects/${primaryDefect.id}` as never)}
                onEdit={jobLocked ? undefined : () => setEditingDefectId(primaryDefect.id)}
              />
            )}

            {additionalDefects.map((d) => (
              editingDefectId === d.id && !jobLocked ? (
                <DefectFieldsCard
                  key={d.id}
                  initial={d}
                  onSave={(v) => handleSaveAdditionalDefect(d.id, v)}
                  onDelete={() => handleDeleteAdditionalDefect(d.id)}
                  onCancel={() => { setAdditionalDraft(null); setEditingDefectId(null); }}
                  onDraftChange={setAdditionalDraft}
                  saveLabel="Save Changes"
                />
              ) : (
                <DefectCard
                  key={d.id}
                  defect={d}
                  style={s.defectCardFlush}
                  onPress={() => router.push(`/jobs/${jobId}/defects/${d.id}` as never)}
                  onEdit={jobLocked ? undefined : () => setEditingDefectId(d.id)}
                />
              )
            ))}

            {editingDefectId === 'new' && !jobLocked ? (
              <DefectFieldsCard
                onSave={(v) => handleSaveAdditionalDefect(null, v)}
                onCancel={() => { setAdditionalDraft(null); setEditingDefectId(null); }}
                onDraftChange={setAdditionalDraft}
                saveLabel="Add Defect"
              />
            ) : primaryDefect !== null && !jobLocked && (
              <TouchableOpacity
                style={[s.addDefectBtn, { borderColor: C.borderStrong }]}
                onPress={() => setEditingDefectId('new')}
                activeOpacity={0.8}
              >
                <MaterialCommunityIcons name="plus" size={16} color={C.accent} />
                <Text style={[s.addDefectBtnTxt, { color: C.accent }]}>Add Defect</Text>
              </TouchableOpacity>
            )}
          </Animated.View>
        )}

        {/* ── Remarks (job_assets.technician_notes) — one field, one place,
            for all three results. Auto-saves on blur once there's an actual
            saved result to attach it to; a first-ever Fail (nothing saved
            yet) instead bundles whatever's typed here into that same Save
            Defect / Replace call, and the leave-without-saving safety net
            below covers the rest. */}
        {(result !== null || pendingFail) && (
          <SectionCard icon="note-text-outline" title="Remarks" C={C}>
            <TextInput
              placeholder={isFailed
                ? 'Recommended actions, parts required, or follow-up details…'
                : 'e.g. Flow test done, unit relocated, access restricted…'}
              placeholderTextColor={C.textTertiary}
              value={note}
              onChangeText={setNote}
              onBlur={() => { if (!jobLocked && result !== null && note !== (asset.technician_notes || '')) handleSaveNote(); }}
              multiline
              textAlignVertical="top"
              editable={!jobLocked}
              style={[s.input, s.textArea, { backgroundColor: C.background, borderColor: C.border, color: C.text, opacity: jobLocked ? 0.6 : 1 }]}
            />
          </SectionCard>
        )}

        {/* ── History — proper pass/fail badge + photos per visit ──────── */}
        <SectionCard icon="history" title={`History${historyTotal > 0 ? ` · ${historyTotal} prior visit${historyTotal === 1 ? '' : 's'}` : ''}`} C={C}>
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

              {/* Only ever fetches more when explicitly asked — see
                  loadMoreHistory's own comment. Remaining count picked by
                  the technician rather than one all-or-nothing fetch. */}
              {history.length < historyTotal && (
                historyLoadingMore ? (
                  <ActivityIndicator size="small" color={C.textTertiary} style={{ marginTop: 12 }} />
                ) : (
                  <View style={s.historyLoadMoreRow}>
                    <Text style={[s.historyLoadMoreLabel, { color: C.textTertiary }]}>
                      {historyTotal - history.length} more visit{historyTotal - history.length === 1 ? '' : 's'} available
                    </Text>
                    <View style={s.historyLoadMoreChips}>
                      {[5, 10].filter((n) => n < historyTotal - history.length).map((n) => (
                        <TouchableOpacity
                          key={n}
                          style={[s.historyLoadMoreChip, { borderColor: C.border }]}
                          onPress={() => loadMoreHistory(n)}
                        >
                          <Text style={[s.historyLoadMoreChipTxt, { color: C.text }]}>+{n}</Text>
                        </TouchableOpacity>
                      ))}
                      <TouchableOpacity
                        style={[s.historyLoadMoreChip, { borderColor: C.border }]}
                        onPress={() => loadMoreHistory(historyTotal - history.length)}
                      >
                        <Text style={[s.historyLoadMoreChipTxt, { color: C.text }]}>Show all</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                )
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

      <PhotoChooserSheet
        visible={showPhotoChooser}
        onClose={() => setShowPhotoChooser(false)}
        onTakePhoto={handleTakePhoto}
        onPickGallery={handlePickPhoto}
      />
      <PhotoViewer
        uri={viewingPhoto}
        onClose={() => setViewingPhoto(null)}
        onDelete={jobLocked ? undefined : () => viewingPhoto && handleRemovePhoto(viewingPhoto)}
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
  lockedBanner: { flexDirection: 'row', alignItems: 'center', gap: 8, borderRadius: 12, borderWidth: 1, padding: 12, marginBottom: 16 },
  lockedTxt: { fontSize: 12, fontWeight: '600', flex: 1, lineHeight: 17 },

  sectionLabel: {
    fontSize: 11, fontWeight: '700', letterSpacing: 0.5, textTransform: 'uppercase',
    marginTop: 22, marginBottom: 10,
  },

  // Result — single segmented track
  resultTrack: { flexDirection: 'row', borderRadius: 14, padding: 4, gap: 4, marginBottom: 20 },
  resultSeg: { flex: 1, height: 42, borderRadius: 10, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 },
  resultSegTxt: { fontSize: 14, fontWeight: '700' },

  // Section card — every section (Photos / Note / History / Timeline)
  card: { borderRadius: 16, borderWidth: 1, padding: 16, marginBottom: 16 },
  cardHeaderRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 14 },
  cardHeaderIconWrap: { width: 30, height: 30, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  cardHeaderTitle: { fontSize: 13.5, fontWeight: '700' },

  // Defects — DefectFieldsCard/DefectCard (both their own components) sit
  // flush against this screen's own 16px padding instead of DefectCard's
  // default list-level margin.
  defectCardFlush: { marginHorizontal: 0 },
  addDefectBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, height: 44, borderRadius: 12, borderWidth: 1.5, borderStyle: 'dashed', marginBottom: 12 },
  addDefectBtnTxt: { fontSize: 13.5, fontWeight: '700' },

  // Input (shared by the Technician Notes card)
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

  historyLoadMoreRow: { marginTop: 12, gap: 8 },
  historyLoadMoreLabel: { fontSize: 12 },
  historyLoadMoreChips: { flexDirection: 'row', gap: 8 },
  historyLoadMoreChip: { paddingHorizontal: 14, paddingVertical: 7, borderRadius: 999, borderWidth: 1 },
  historyLoadMoreChipTxt: { fontSize: 12.5, fontWeight: '700' },

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
