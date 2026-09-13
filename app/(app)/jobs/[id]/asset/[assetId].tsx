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
import { InspectionResult, DefectSeverity, JobStatus, PhotoStage } from '@/constants/Enums';
import { useInspectionStore } from '@/store/inspectionStore';
import Animated, { FadeIn } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import * as ImagePicker from 'expo-image-picker';
import * as ImageManipulator from 'expo-image-manipulator';
import * as FileSystem from 'expo-file-system/legacy';
import Toast from 'react-native-toast-message';

import { DefectFieldsCard, DefectFieldsValue, DefectPhotosDraft } from '@/components/defects/DefectFieldsCard';
import DefectCard from '@/components/defects/DefectCard';
import { PhotoChooserSheet } from '@/components/camera/PhotoChooserSheet';
import { formatAssetType, formatLocationCode, formatRelativeDays } from '@/utils/assetHelpers';
import { getValidLocalUri, resolveExistingLocalUri } from '@/utils/fileHelpers';
import { getAssetHistory, AssetHistoryEntry, getJobById, queryRecords } from '@/lib/database';
import { Timeline } from '@/components/audit/Timeline';
import { useDefectsStore } from '@/store/defectsStore';
import { useJobLiveSync } from '@/hooks/useJobLiveSync';
import { onSyncComplete, offSyncComplete } from '@/lib/sync';

type ColorsType = ReturnType<typeof useColors>;
type MCIconName = React.ComponentProps<typeof MaterialCommunityIcons>['name'];

// Prior visits shown by default before the technician has to explicitly
// ask for more — see the History section's own loadMoreHistory().
const HISTORY_PAGE_SIZE = 3;


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

// Diffs an already-saved defect's Before/After photo draft against what's
// actually in the DB (defectPhotosMap's entry for it) and issues only the
// add/remove calls needed to reconcile the two — mirrors the diff-and-
// reconcile approach updateAssetResult's own asset-photo block already
// uses, applied per-defect instead of per-asset. A no-op call for any URI
// already present, so this is safe to call even when nothing changed.
function reconcileDefectPhotos(defectId: string, existing: DefectPhotosDraft, next: DefectPhotosDraft) {
  const store = useDefectsStore.getState();
  next.before.filter((u) => !existing.before.includes(u)).forEach((u) => store.addPhotoToDefect(defectId, u, PhotoStage.Before));
  next.after.filter((u) => !existing.after.includes(u)).forEach((u) => store.addPhotoToDefect(defectId, u, PhotoStage.After));
  existing.before.filter((u) => !next.before.includes(u)).forEach((u) => store.removePhotoFromDefect(defectId, u));
  existing.after.filter((u) => !next.after.includes(u)).forEach((u) => store.removePhotoFromDefect(defectId, u));
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
  //
  // Declared up here (rather than alongside the rest of this screen's state
  // further down) purely so primaryDefect below can tell a genuine Fail
  // apart from a Pass/N-T asset that merely HAS defects (Remarks) —
  // `failedNow` is recomputed as `isFailed` further down, identically, once
  // `asset` is guaranteed non-null past the early-return guard. Two names
  // for one formula, not two sources of truth; keep them in sync if this
  // ever changes.
  const [pendingFail, setPendingFail] = useState(() => pendingFailParam === '1');
  const failedNow = asset?.result === InspectionResult.Fail || pendingFail;

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
  // FIX: "primary" (the Fail-reason defect) used to be picked positionally
  // (oldest by created_at) — safe only while a defect could never predate a
  // Fail. Now that Remarks lets a Pass/N-T asset carry its own defect(s),
  // that assumption breaks in TWO ways: (1) log a Remark on Pass, then later
  // fail the same asset for something else — the Remark is older, so
  // matching positionally would land it in the "primary" slot and editing it
  // would overwrite job_assets.defect_reason with the Remark's text; fixed by
  // matching on content against defect_reason instead, the same relationship
  // reconcileJobAssetOnDefectDelete (lib/database.ts) already relies on.
  // (2) an asset that's never been Failed at all (Pass/N-T) has NO primary
  // defect by definition — every one of its defects is a Remark. Without the
  // `failedNow` guard, `?? assetDefects[0]` still picked ONE of them as
  // "primary" purely because defect_reason (null on a non-Fail asset) never
  // matches anything — and the primary slot only renders `{isFailed && ...}`
  // below, so that defect vanished from this screen entirely the moment it
  // was saved (still in the DB, just invisible here — additionalDefects had
  // filtered it out too, having wrongly ceded it to "primary").
  const primaryDefect = failedNow
    ? (assetDefects.find((d) => d.description === asset?.defect_reason) ?? assetDefects[0] ?? null)
    : null;
  const additionalDefects = assetDefects.filter((d) => d.id !== primaryDefect?.id);
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

  const [showPhotoChooser, setShowPhotoChooser] = useState(false);
  const [isAddingPhoto, setIsAddingPhoto] = useState(false);
  const [viewingPhoto, setViewingPhoto] = useState<string | null>(null);
  const [viewingHistoryPhoto, setViewingHistoryPhoto] = useState<string | null>(null);

  // Maps each photo_url in asset.photos to the fastest URI actually worth
  // rendering it from — the original on-device file when this device still
  // has it (skips the network entirely), otherwise the remote URL
  // unchanged. Resolved once per photo list change, not per render/tap, so
  // opening this screen or tapping a thumbnail never waits on a fresh
  // filesystem check. resolveExistingLocalUri is a local filesystem stat,
  // not a network call, so this resolves well before any Image below could
  // have started a real fetch — no visible flash from remote to local.
  // Rebuilt from scratch (not merged onto the previous map) each time, so a
  // deleted photo's entry is naturally dropped rather than accumulating.
  const [displayUris, setDisplayUris] = useState<Record<string, string>>({});
  useEffect(() => {
    const photoUrls = asset?.photos ?? [];
    const localMap = asset?.photoLocalUris ?? {};
    if (photoUrls.length === 0) { setDisplayUris({}); return; }
    let cancelled = false;
    (async () => {
      const entries = await Promise.all(photoUrls.map(async (url): Promise<[string, string]> => {
        const local = await resolveExistingLocalUri(localMap[url]);
        return [url, local ?? getValidLocalUri(url)];
      }));
      if (!cancelled) setDisplayUris(Object.fromEntries(entries));
    })();
    return () => { cancelled = true; };
  }, [asset?.photos, asset?.photoLocalUris]);

  const [history, setHistory] = useState<AssetHistoryEntry[]>([]);
  const [historyLoading, setHistoryLoading] = useState(true);
  const [historyTotal, setHistoryTotal] = useState(0);
  const [historyLoadingMore, setHistoryLoadingMore] = useState(false);

  // `note` backs job_assets.technician_notes for both the Fail and Pass/N-T
  // "Note" cards — same column, same field, whichever card happens to be
  // showing for the current result.
  const [note, setNote] = useState(asset?.technician_notes || '');

  // `internalNote` backs job_assets.internal_notes — a second per-visit
  // field alongside Remarks, available regardless of PASS/FAIL/N-T, but
  // team-internal only: never read by the report-generator service (see
  // its fetchReportData.ts/types.ts), so it can never reach a client-facing
  // PDF. Same auto-save-on-blur + leave-without-saving safety net as
  // Remarks, kept as a genuinely separate field/card so the two are never
  // visually confused for each other.
  const [internalNote, setInternalNote] = useState(asset?.internal_notes || '');

  // Remarks/Internal Notes are per-visit crew communication — a teammate on
  // the same job can write to either field (job_assets rides the live
  // per-job Realtime channel, see useJobLiveSync below) while this screen
  // is already open. Without this, `note`/`internalNote` only ever reflect
  // whatever was here at mount: a teammate's update would silently not
  // show up, AND blurring this screen's own (now-stale) field would fire
  // Save and clobber it right back with the old value. Only adopts the
  // incoming value when the technician hasn't started a divergent local
  // edit of their own — an in-progress draft is never overwritten.
  const lastKnownNoteRef = useRef(asset?.technician_notes || '');
  useEffect(() => {
    const incoming = asset?.technician_notes || '';
    if (incoming !== lastKnownNoteRef.current) {
      setNote((current) => (current === lastKnownNoteRef.current ? incoming : current));
      lastKnownNoteRef.current = incoming;
    }
  }, [asset?.technician_notes]);

  const lastKnownInternalNoteRef = useRef(asset?.internal_notes || '');
  useEffect(() => {
    const incoming = asset?.internal_notes || '';
    if (incoming !== lastKnownInternalNoteRef.current) {
      setInternalNote((current) => (current === lastKnownInternalNoteRef.current ? incoming : current));
      lastKnownInternalNoteRef.current = incoming;
    }
  }, [asset?.internal_notes]);

  // Live draft of whichever defect card is currently expanded for editing —
  // reported up via DefectFieldsCard's onDraftChange.
  const [primaryDraft, setPrimaryDraft] = useState<DefectFieldsValue | null>(null);
  // Mirrors primaryDraft one level down — the in-progress Before/After photo
  // picks for the primary (Fail-reason) defect card. Same leave-without-
  // saving purpose as additionalPhotosDraft below.
  const [primaryPhotosDraft, setPrimaryPhotosDraft] = useState<DefectPhotosDraft | null>(null);
  // FIX: an in-progress ADDITIONAL defect (new, or editing an existing one)
  // previously had no equivalent leave-without-saving protection — a
  // technician who started a second defect, typed a description, then left
  // (interrupted, wrong screen, phone call) lost the whole draft silently,
  // while the exact same interruption on the primary defect was already
  // protected. Mirrors primaryDraft below.
  const [additionalDraft, setAdditionalDraft] = useState<DefectFieldsValue | null>(null);
  // Mirrors additionalDraft one level down — the in-progress Before/After
  // photo picks for whichever additional-defect card is currently expanded.
  // Same leave-without-saving purpose: a tech who photographs a fix and
  // then just navigates away must not silently lose it.
  const [additionalPhotosDraft, setAdditionalPhotosDraft] = useState<DefectPhotosDraft | null>(null);

  // Existing Before/After photos per additional defect, loaded from
  // inspection_photos and grouped by defect_id/stage — feeds each
  // additional-defect DefectFieldsCard's `photos` prop so reopening one for
  // edit shows what's already there instead of starting blank. Untagged
  // (stage === null) rows are deliberately excluded — those are the primary
  // defect's own asset-level photos, never shown inside this per-defect UI.
  const [defectPhotosMap, setDefectPhotosMap] = useState<Record<string, DefectPhotosDraft>>({});
  useEffect(() => {
    if (!jobId || !assetId) { setDefectPhotosMap({}); return; }
    const rows = queryRecords<{ defect_id: string | null; photo_url: string; stage: string | null }>(
      'inspection_photos', { job_id: jobId, asset_id: assetId }
    );
    const map: Record<string, DefectPhotosDraft> = {};
    for (const row of rows) {
      if (!row.defect_id || !row.stage) continue;
      const entry = map[row.defect_id] ?? (map[row.defect_id] = { before: [], after: [] });
      if (row.stage === PhotoStage.Before) entry.before.push(row.photo_url);
      else if (row.stage === PhotoStage.After) entry.after.push(row.photo_url);
    }
    setDefectPhotosMap(map);
    // Re-runs whenever the job's defects reload (new photo saved, teammate's
    // live-synced change, or this asset's own save) — jobDefects is the raw
    // store array, which only gets a new reference on an actual change.
  }, [jobId, assetId, jobDefects]);

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
    note, internalNote, primaryDraft, primaryPhotosDraft, additionalDraft, additionalPhotosDraft, editingDefectId,
    isFailed: asset?.result === InspectionResult.Fail || pendingFail, asset,
    primaryDefect, pendingFail, defectPhotosMap,
  });
  latestRef.current = {
    note, internalNote, primaryDraft, primaryPhotosDraft, additionalDraft, additionalPhotosDraft, editingDefectId,
    isFailed: asset?.result === InspectionResult.Fail || pendingFail, asset,
    primaryDefect, pendingFail, defectPhotosMap,
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
          note: n, internalNote: inNote, primaryDraft: pd, primaryPhotosDraft: pdPhotos, additionalDraft: ad, additionalPhotosDraft: adPhotos, editingDefectId: eid,
          isFailed: failed, asset: a, primaryDefect: pDefect, pendingFail: wasPendingFail, defectPhotosMap: dpMap,
        } = latestRef.current;
        const primaryDefectId = pDefect?.id ?? null;
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
        const internalNoteTrim = inNote.trim();
        const internalNoteChanged = internalNoteTrim !== (a.internal_notes || '');
        // FIX: resolved_on_site/before-after-photos live on the DEFECT row,
        // not job_assets, so a change to only one of those never showed up
        // in descTrim/noteTrim/internalNoteChanged above — a tech who ticks
        // "resolved on site" or adds an after-photo and leaves without an
        // explicit Save (no text edit) used to lose it silently, same bug
        // class as additionalPhotosDraft's own fix just above.
        const resolvedOnSiteChanged = pd ? pd.resolvedOnSite !== (pDefect?.resolved_on_site ?? false) : false;
        const pdPhotosChanged = !!pdPhotos && primaryDefectId !== null
          && JSON.stringify(pdPhotos) !== JSON.stringify(dpMap[primaryDefectId] ?? { before: [], after: [] });
        if (failed && descTrim) {
          const noteTrim = n.trim();
          if (descTrim !== (a.defect_reason || '') || noteTrim !== (a.technician_notes || '') || internalNoteChanged) {
            // FIX: forceNewDefect was never passed here at all, unlike
            // handleSaveDefect's own identical call — a fresh Pass/N-T->Fail
            // transition (wasPendingFail) that got left via back/swipe
            // instead of an explicit Save Defect tap would silently MERGE
            // into whatever unrelated defect already existed on this asset
            // (e.g. an earlier Remark), exactly the bug forceNewDefect
            // exists to prevent — see updateAssetResult's own comment on it.
            const touchedId = updateAssetResult(a.id, InspectionResult.Fail, a.checklist_data ?? undefined, false, descTrim, noteTrim, undefined, pd!.severity, pd!.defectCode, pd!.quotePrice, wasPendingFail, internalNoteTrim);
            notifyIfRejected(() => useInspectionStore.getState().error);
            if (touchedId) {
              useDefectsStore.getState().updateDefect(touchedId, { resolved_on_site: pd!.resolvedOnSite });
              if (pdPhotos) reconcileDefectPhotos(touchedId, dpMap[touchedId] ?? { before: [], after: [] }, pdPhotos);
            }
          } else if (primaryDefectId && (resolvedOnSiteChanged || pdPhotosChanged)) {
            // Description/notes unchanged (so no reason to touch job_assets/
            // updateAssetResult at all) but resolved-on-site or photos
            // drifted on an ALREADY-SAVED primary defect — reconcile
            // directly against its existing id.
            if (resolvedOnSiteChanged) useDefectsStore.getState().updateDefect(primaryDefectId, { resolved_on_site: pd!.resolvedOnSite });
            if (pdPhotosChanged) reconcileDefectPhotos(primaryDefectId, dpMap[primaryDefectId] ?? { before: [], after: [] }, pdPhotos!);
            notifyIfRejected(() => useDefectsStore.getState().error);
          }
        } else if (!failed && (n.trim() !== (a.technician_notes || '') || internalNoteChanged)) {
          updateAssetResult(a.id, a.result, a.checklist_data ?? undefined, a.is_compliant, a.defect_reason ?? undefined, n.trim(), undefined, undefined, undefined, undefined, undefined, internalNoteTrim);
          notifyIfRejected(() => useInspectionStore.getState().error);
        }

        // FIX: same safety net as above, extended to an in-progress
        // additional defect — `eid` is only a real additional-defect id or
        // 'new' while that card is actively expanded; Cancel/Save both
        // clear it immediately, so this can't double-fire against an
        // already-handled save.
        const adDescTrim = ad?.description.trim() ?? '';
        // FIX: a tech who photographs a fix (or checks "resolved on site")
        // and then just navigates away — without a description edit — used
        // to lose the photos silently, since this whole branch was gated on
        // adDescTrim alone. A photo-only change on an ALREADY-SAVED defect
        // (eid !== 'new') is worth flushing even with no text changed; a
        // brand-new defect still requires a description (nothing to attach
        // photos to otherwise — addDefect always needs one).
        const adPhotosChanged = !!adPhotos && eid !== 'new' && eid
          && JSON.stringify(adPhotos) !== JSON.stringify(dpMap[eid] ?? { before: [], after: [] });
        if (eid && eid !== primaryDefectId && (adDescTrim || adPhotosChanged)) {
          if (eid === 'new') {
            if (adDescTrim) {
              useDefectsStore.getState().addDefect({
                job_id: jobId as string,
                property_id: a.property_id,
                asset_id: a.id,
                description: ad!.description,
                severity: ad!.severity,
                photos: [],
                defect_code: ad!.defectCode,
                quote_price: ad!.quotePrice,
                resolved_on_site: ad!.resolvedOnSite,
                beforePhotos: adPhotos?.before,
                afterPhotos: adPhotos?.after,
              });
            }
          } else {
            if (adDescTrim) {
              useDefectsStore.getState().updateDefect(eid, {
                description: ad!.description,
                severity: ad!.severity,
                defect_code: ad!.defectCode,
                quote_price: ad!.quotePrice,
                resolved_on_site: ad!.resolvedOnSite,
              });
            }
            if (adPhotosChanged) {
              reconcileDefectPhotos(eid, dpMap[eid] ?? { before: [], after: [] }, adPhotos!);
            }
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
      updateAssetResult(asset.id, res, asset.checklist_data ?? undefined, asset.is_compliant ?? true, undefined, asset.technician_notes || '', undefined, undefined, undefined, undefined, undefined, asset.internal_notes || '');
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
      updateAssetResult(asset.id, res, asset.checklist_data ?? undefined, false, undefined, asset.technician_notes || '', undefined, undefined, undefined, undefined, undefined, asset.internal_notes || '');
    }
  };

  // The primary defect's real save — unchanged from before: still the one
  // write that actually commits result: 'fail' via updateAssetResult.
  // Validation now happens inside DefectFieldsCard itself, so onSave only
  // ever fires with a non-empty description.
  const handleSaveDefect = (value: DefectFieldsValue, photos?: DefectPhotosDraft) => {
    // FIX: forceNewDefect=pendingFail — a fresh Pass/N-T -> Fail transition
    // must never merge into whatever unrelated defect might already exist
    // on this asset (see updateAssetResult's own comment on this param).
    // Re-editing an already-Fail asset's existing defect (pendingFail is
    // false by then) still merges into it exactly as before.
    const touchedId = updateAssetResult(asset.id, InspectionResult.Fail, asset.checklist_data ?? undefined, false, value.description, note.trim(), undefined, value.severity, value.defectCode, value.quotePrice, pendingFail, internalNote.trim());
    // updateAssetResult only creates/updates the defect ROW itself — it has
    // no concept of before/after photos or resolved_on_site, so those go
    // through defectsStore directly against the id it just handed back,
    // exactly the same mechanism the "additional defect" flow already uses.
    // Works identically whether touchedId is a brand-new defect (existing
    // photos default to empty, so reconcileDefectPhotos just adds
    // everything) or an already-saved one being re-edited.
    if (touchedId) {
      useDefectsStore.getState().updateDefect(touchedId, { resolved_on_site: value.resolvedOnSite });
      if (photos) {
        reconcileDefectPhotos(touchedId, defectPhotosMap[touchedId] ?? { before: [], after: [] }, photos);
      }
    }
    setPendingFail(false);
    setPrimaryDraft(null);
    setPrimaryPhotosDraft(null);
    setEditingDefectId(null);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    Toast.show({ type: 'success', text1: 'Defect saved' });
  };

  const handleReplaceNow = (value: DefectFieldsValue) => {
    // FIX: forceNewDefect was never passed here (unlike handleSaveDefect's
    // identical call) — Replace Now is offered on the exact same fresh-Fail
    // form as Save Defect, so a Pass/N-T asset that already carries an
    // unrelated Remark defect had this fast path silently MERGE into it
    // instead of creating an independent record. See updateAssetResult's
    // own comment on forceNewDefect for why that's wrong.
    const touchedId = updateAssetResult(asset.id, InspectionResult.Fail, asset.checklist_data ?? undefined, false, value.description, note.trim(), undefined, DefectSeverity.Critical, value.defectCode, value.quotePrice, pendingFail, internalNote.trim());
    // FIX: this form now offers the same Before/After photos + resolved-on-
    // site fields as Save Defect (see handleSaveDefect's own comment) — a
    // tech who filled those in and then tapped Replace Now instead used to
    // have them silently discarded, since this handler never looked at
    // primaryPhotosDraft/value.resolvedOnSite at all.
    if (touchedId) {
      useDefectsStore.getState().updateDefect(touchedId, { resolved_on_site: value.resolvedOnSite });
      if (primaryPhotosDraft) {
        reconcileDefectPhotos(touchedId, defectPhotosMap[touchedId] ?? { before: [], after: [] }, primaryPhotosDraft);
      }
    }
    setPendingFail(false);
    setPrimaryDraft(null);
    setPrimaryPhotosDraft(null);
    setEditingDefectId(null);
    setTimeout(() => router.push(`/jobs/${jobId}/quote` as never), 400);
  };

  // Any defect beyond the first is a genuinely independent record, saved
  // directly through defectsStore — the same store the standalone Defects
  // screen already uses, not routed through updateAssetResult at all.
  const handleSaveAdditionalDefect = (defectId: string | null, value: DefectFieldsValue, photos?: DefectPhotosDraft) => {
    if (defectId) {
      useDefectsStore.getState().updateDefect(defectId, {
        description: value.description,
        severity: value.severity,
        defect_code: value.defectCode,
        quote_price: value.quotePrice,
        resolved_on_site: value.resolvedOnSite,
      });
      if (photos) {
        reconcileDefectPhotos(defectId, defectPhotosMap[defectId] ?? { before: [], after: [] }, photos);
      }
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
        resolved_on_site: value.resolvedOnSite,
        beforePhotos: photos?.before,
        afterPhotos: photos?.after,
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
    setAdditionalPhotosDraft(null);
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
  // Shared by BOTH the Remarks and Internal Notes cards' onBlur — always
  // writes both fields together (each card only calls this when its OWN
  // value actually changed, but writing both here every time means
  // whichever card fires this can never clobber the other's already-saved
  // value with a stale re-send of its own unrelated field).
  const handleSaveNote = () => {
    updateAssetResult(
      asset.id, asset.result, asset.checklist_data ?? undefined, asset.is_compliant,
      asset.defect_reason ?? undefined, note.trim(), undefined,
      primaryDefect?.severity, primaryDefect?.defect_code ?? null, primaryDefect?.quote_price ?? null,
      undefined, internalNote.trim(),
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
                <Image source={{ uri: displayUris[uri] ?? getValidLocalUri(uri) }} style={s.photoThumb} contentFit="cover" />
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
            three different ones.
            FIX: this used to be gated on `isFailed` alone, so logging a
            defect/remark was only possible once the asset had already been
            marked Fail — a technician who found and fixed something minor
            (e.g. replaced a dead smoke-alarm battery) had no way to note it
            without incorrectly failing an asset that otherwise passed. The
            "Additional Defects" mechanism below (addDefect/updateDefect,
            never touching job_assets.result) was already exactly this
            result-independent pattern — it just needed the same
            `result !== null || pendingFail` gate the Remarks card below
            already uses, so Defects and Remarks appear together for any
            result. Only the PRIMARY (Fail-reason) card stays Fail-specific;
            everything inside its own `isFailed &&` block is unchanged. ── */}
        {(result !== null || pendingFail) && (
          <Animated.View entering={noMotion ? undefined : FadeIn.duration(300)}>
            <Text style={[s.sectionLabel, { color: C.textTertiary }]}>
              Defects{assetDefects.length > 0 ? ` · ${assetDefects.length}` : ''}
            </Text>
            {!isFailed && (
              <Text style={[s.defectsHint, { color: C.textTertiary }]}>
                Log something you noticed on this asset, even if you already
                fixed it — this is separate from the Pass/Fail result above.
              </Text>
            )}

            {isFailed && (primaryDefect === null || pendingFail ? (
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
                photos={{ before: [], after: [] }}
                onPhotosDraftChange={setPrimaryPhotosDraft}
                saving={isSaving || jobLocked}
                saveLabel="Save Defect"
              />
            ) : editingDefectId === primaryDefect.id && !jobLocked ? (
              <DefectFieldsCard
                initial={primaryDefect}
                onSave={handleSaveDefect}
                onReplace={handleReplaceNow}
                onCancel={() => { setPrimaryDraft(null); setPrimaryPhotosDraft(null); setEditingDefectId(null); }}
                onDraftChange={setPrimaryDraft}
                photos={defectPhotosMap[primaryDefect.id] ?? { before: [], after: [] }}
                onPhotosDraftChange={setPrimaryPhotosDraft}
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
            ))}

            {additionalDefects.map((d) => (
              editingDefectId === d.id && !jobLocked ? (
                <DefectFieldsCard
                  key={d.id}
                  initial={d}
                  onSave={(v, p) => handleSaveAdditionalDefect(d.id, v, p)}
                  onDelete={() => handleDeleteAdditionalDefect(d.id)}
                  onCancel={() => { setAdditionalDraft(null); setAdditionalPhotosDraft(null); setEditingDefectId(null); }}
                  onDraftChange={setAdditionalDraft}
                  photos={defectPhotosMap[d.id] ?? { before: [], after: [] }}
                  onPhotosDraftChange={setAdditionalPhotosDraft}
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
                onSave={(v, p) => handleSaveAdditionalDefect(null, v, p)}
                onCancel={() => { setAdditionalDraft(null); setAdditionalPhotosDraft(null); setEditingDefectId(null); }}
                onDraftChange={setAdditionalDraft}
                photos={{ before: [], after: [] }}
                onPhotosDraftChange={setAdditionalPhotosDraft}
                saveLabel="Add Defect"
              />
            ) : (!isFailed || primaryDefect !== null) && !jobLocked && (
              // FIX: was gated on `primaryDefect !== null` alone, which made
              // sense when this button only ever appeared post-Fail (a fresh
              // Fail always has a form on screen already, never a bare
              // button with zero defects). Now that this section renders for
              // Pass/N-T too, a defect-free Pass/N-T asset needs this button
              // visible from the start — `!isFailed` covers that case.
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

        {/* ── Internal Notes (job_assets.internal_notes) — a second,
            deliberately separate field from Remarks above. Same
            availability/auto-save/leave-without-saving shape, but this one
            is never read by the report-generator service (see its
            fetchReportData.ts/types.ts) — team-internal communication only,
            never client-facing. Distinct icon + caption so it's never
            mistaken for Remarks. */}
        {(result !== null || pendingFail) && (
          <SectionCard icon="shield-lock-outline" title="Internal Notes" C={C}>
            <Text style={[s.internalNotesCaption, { color: C.textTertiary }]}>
              Visible to your team only — never included in the report.
            </Text>
            <TextInput
              placeholder="e.g. Client mentioned this keeps tripping, worth a follow-up call…"
              placeholderTextColor={C.textTertiary}
              value={internalNote}
              onChangeText={setInternalNote}
              onBlur={() => { if (!jobLocked && result !== null && internalNote !== (asset.internal_notes || '')) handleSaveNote(); }}
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
                      {h.internalNotes ? (
                        <View style={s.historyInternalNoteRow}>
                          <MaterialCommunityIcons name="shield-lock-outline" size={11} color={C.textTertiary} />
                          <Text style={[s.historyNote, { color: C.textTertiary, fontStyle: 'italic', flex: 1 }]}>{h.internalNotes}</Text>
                        </View>
                      ) : null}
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
        uri={viewingPhoto ? (displayUris[viewingPhoto] ?? viewingPhoto) : null}
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
  defectsHint: { fontSize: 12, lineHeight: 17, marginTop: -4, marginBottom: 10 },

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
  historyInternalNoteRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 4, marginTop: 4 },
  internalNotesCaption: { fontSize: 11, fontStyle: 'italic', marginBottom: 8 },
  historyPhotoRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 10 },
  historyPhotoThumb: { width: 56, height: 56, borderRadius: 10 },

  recurringFlag: { flexDirection: 'row', alignItems: 'center', gap: 7, padding: 10, borderRadius: 10, marginTop: 4 },
  recurringTxt: { fontSize: 12, fontWeight: '700', flex: 1 },

  historyLoadMoreRow: { marginTop: 12, gap: 8 },
  historyLoadMoreLabel: { fontSize: 12 },
  historyLoadMoreChips: { flexDirection: 'row', gap: 8 },
  historyLoadMoreChip: { paddingHorizontal: 14, paddingVertical: 7, borderRadius: 999, borderWidth: 1 },
  historyLoadMoreChipTxt: { fontSize: 12.5, fontWeight: '700' },

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
