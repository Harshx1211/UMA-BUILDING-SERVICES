import { useState, useRef, useEffect, useCallback } from 'react';
import {
  View, TouchableOpacity, StyleSheet,
  Platform, ScrollView, Image,
} from 'react-native';
import { TextInput } from '@/components/ui/AppTextInput';
import { Text } from '@/components/ui/AppText';
import { router, useLocalSearchParams, useNavigation } from 'expo-router';
import type { NavigationAction } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import SignatureScreenCanvas, { SignatureViewRef } from 'react-native-signature-canvas';
import { upsertRecord, addToSyncQueue, getSignatureForJob, getJobById } from '@/lib/database';
import { runSync } from '@/lib/sync';
import { useJobLiveSync } from '@/hooks/useJobLiveSync';
import { generateUUID } from '@/utils/uuid';
import { useColors } from '@/hooks/useColors';
import { useResponsive } from '@/hooks/useResponsive';
import { SyncOperation, JobStatus } from '@/constants/Enums';
import { useAuthStore } from '@/store/authStore';
import { useJobsStore } from '@/store/jobsStore';
import type { Signature } from '@/types';
import { ScreenHeader, Button, Card, showConfirm } from '@/components/ui';
import { T } from '@/constants/Colors';
import { MAX_LENGTHS } from '@/utils/sanitize';
import { readTechDraft, writeTechDraft, clearTechDraft } from '@/lib/signatureDraft';
import { warmUpReportService } from '@/lib/pdfGenerator';

export default function SignatureScreen() {
  const C = useColors();
  // FIX (signature bypass): site-inspect/[id].tsx's quick on-site flow now
  // routes here with ?autoComplete=1 instead of inserting a job that's
  // already status='completed' with no signature step at all — see that
  // screen's own comment. When set, a successful save here also flips the
  // job to Completed (the same updateJobStatus() the main per-job flow
  // uses) and continues on to the report, instead of just going back.
  const { id, autoComplete: autoCompleteParam } = useLocalSearchParams<{ id: string; autoComplete?: string }>();
  const autoComplete = autoCompleteParam === '1';
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();
  const { contentMaxWidth } = useResponsive();

  // Two SEPARATE refs, one per step — react-native-signature-canvas has a
  // known issue where the second SignatureCanvas instance on a screen stops
  // responding to touch if it shares a ref with the first (confirmed: the
  // technician canvas worked, the client canvas showed a blank, unresponsive
  // white box). Only one of the two is ever mounted at a time, but each needs
  // its own distinct ref object for the library to initialize it correctly.
  const techCanvasRef = useRef<SignatureViewRef | null>(null);
  const clientCanvasRef = useRef<SignatureViewRef | null>(null);
  // Scroll ref — lock/unlock WITHOUT a state update (zero re-renders mid-draw)
  const scrollRef = useRef<ScrollView>(null);

  const [signedBy, setSignedBy]     = useState('');
  const [saving, setSaving]         = useState(false);
  const [sigError, setSigError]     = useState('');
  const [hasSig, setHasSig]         = useState(false);
  const [existingSig, setExistingSig] = useState<Signature | null>(null);
  const [isEditing, setIsEditing]   = useState(false);
  const [step, setStep]             = useState<'tech' | 'client'>('tech');
  const [techSigBase64, setTechSigBase64] = useState<string | null>(null);
  // FIX: this screen never checked the job's own status at all — a
  // signature (which asserts "the inspection described in this report was
  // completed") could be captured on a job that was never started or had
  // since been cancelled. Mirrors the same Completed/Cancelled lock used
  // by inspectionStore/defectsStore elsewhere.
  const [jobLocked, setJobLocked] = useState(false);

  const canvasRef = step === 'tech' ? techCanvasRef : clientCanvasRef;

  const existingRecordId = useRef<string | null>(null);
  // Safety timer ref — never stored on the canvas ref
  const safetyTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // True when the technician signature on the client step was restored from
  // an earlier visit (see the draft notes below) — shown as a hint so it's
  // clear why step 1 is already done.
  const [resumedDraft, setResumedDraft] = useState(false);
  // Set right before this screen navigates away ON PURPOSE after a
  // successful save, so the beforeRemove guard below never mistakes its own
  // exit for the user abandoning an unsaved signature.
  const leavingAfterSaveRef = useRef(false);

  // ── Load existing / draft ──────────────────────────────────────────────
  // The technician signature captured in step 1 is kept as a draft (per
  // job, in AsyncStorage) until the client signs, the technician taps
  // Restart, or it expires. FIX: it used to be wiped on unmount, so leaving
  // the screen between the two steps — e.g. to check the report — silently
  // threw it away and the technician had to sign again from scratch. The
  // key is per job id (no cross-job bleed), drafts are swept on sign-out
  // (authStore's sweepDraftSignatureKeys), and a draft older than
  // DRAFT_TTL_MS is discarded so a stale signature is never reused days
  // later.
  useEffect(() => {
    if (!id) return;
    // Signing comes right before generating the report — wake the report
    // service now so it's up by then (see warmUpReportService).
    warmUpReportService(id);
    const job = getJobById<{ status: string }>(id);
    setJobLocked(job?.status === JobStatus.Completed || job?.status === JobStatus.Cancelled);

    const existing = getSignatureForJob(id) as Signature | null;
    if (existing) {
      setExistingSig(existing);
      setSignedBy(existing.signed_by_name || '');
      existingRecordId.current = existing.id ?? null;
    } else {
      readTechDraft(id).then(draft => {
        if (draft) { setTechSigBase64(draft); setStep('client'); setResumedDraft(true); }
      });
    }
    return () => {
      if (safetyTimerRef.current) clearTimeout(safetyTimerRef.current);
    };
  }, [id]);

  // What leaving this screen right now would genuinely lose. Kept in a ref
  // (refreshed every render) so the beforeRemove listener always reads the
  // CURRENT value — a closure captured at subscribe time can lag a render
  // behind the state that matters.
  //  - Strokes on the open canvas are never saved anywhere until Save.
  //  - A re-sign's new technician signature is held in memory only (the
  //    draft store is for first-time sign-off), so it's lost too.
  //  - A first-time technician draft is NOT lost — it's persisted above.
  const unsavedRef = useRef<'strokes' | 'resign' | null>(null);
  const showCanvasNow = !jobLocked && (!existingSig || isEditing);
  unsavedRef.current = !showCanvasNow
    ? null
    : (isEditing && step === 'client' && !!techSigBase64)
      ? 'resign'
      : hasSig
        ? 'strokes'
        : null;

  // This is a legally-binding document (see CONSENT text below, citing the
  // Electronic Transactions Act) — warn before leaving would discard
  // anything not yet saved.
  // FIX: `hasSig` was never cleared after a SUCCESSFUL save, so this guard
  // fired on the screen's own exit after "Signature Saved → OK" (and on any
  // back press afterwards), asking the technician to "Keep Signing" or
  // "Discard" a signature that had in fact already been saved — and with
  // ?autoComplete=1, "Keep Signing" stranded them on a now-completed job.
  useEffect(() => {
    const unsub = navigation.addListener('beforeRemove', (e: { preventDefault: () => void; data: { action: NavigationAction } }) => {
      const unsaved = unsavedRef.current;
      if (leavingAfterSaveRef.current || !unsaved) return; // nothing unsaved — let it navigate normally
      e.preventDefault();
      showConfirm({
        title: 'Discard signature?',
        message: unsaved === 'resign'
          ? "The new signatures haven't been saved. Leaving now will discard them and keep the existing signature."
          : "The signature you're drawing hasn't been saved yet. Leaving now will discard it.",
        icon: 'draw',
        buttons: [
          { text: 'Keep signing', style: 'cancel' },
          { text: 'Discard', style: 'destructive', onPress: () => navigation.dispatch(e.data.action) },
        ],
      });
    });
    return unsub;
  }, [navigation]);

  // Only reacts to the job locking/unlocking (Completed/Cancelled elsewhere)
  // while this screen is open — deliberately NOT a full reload on every
  // table change, since re-pulling `existingSig` while the technician is
  // mid-signature would be actively disruptive, not helpful.
  useJobLiveSync(id, useCallback((table) => {
    if (table !== 'jobs' || !id) return;
    const job = getJobById<{ status: string }>(id);
    setJobLocked(job?.status === JobStatus.Completed || job?.status === JobStatus.Cancelled);
  }, [id]));

  const CONSENT =
    'By signing below, I confirm that the inspection described in this report was ' +
    'completed on the property on the date shown, and that I have been given the ' +
    'opportunity to review the findings. This signature is legally binding under ' +
    'the Electronic Transactions Act 1999 (Cth).';

  // ── Scroll lock — NO state update, direct ref call ────────────────────
  // This is the core fix for "canvas acts like a scroll bar".
  // Previously setScrollEnabled(false) triggered a re-render mid-draw,
  // causing the gesture to be interrupted. Now we call setNativeProps
  // directly on the ScrollView — zero re-renders, zero jank.
  const lockScroll   = useCallback(() => { scrollRef.current?.setNativeProps({ scrollEnabled: false }); }, []);
  const unlockScroll = useCallback(() => { scrollRef.current?.setNativeProps({ scrollEnabled: true  }); }, []);

  // ── Canvas event handlers ──────────────────────────────────────────────
  const handleBegin = useCallback(() => {
    setHasSig(true);
    lockScroll();
  }, [lockScroll]);

  const handleEnd = useCallback(() => {
    unlockScroll();
  }, [unlockScroll]);

  // ── Clear current canvas ───────────────────────────────────────────────
  function handleClear() {
    canvasRef.current?.clearSignature();
    setHasSig(false);
  }

  function handleResetAll() {
    showConfirm({
      title: 'Restart sign-off',
      message: 'This will delete the captured technician signature. Are you sure?',
      icon: 'restart',
      buttons: [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Restart', style: 'destructive', onPress: async () => {
          if (safetyTimerRef.current) { clearTimeout(safetyTimerRef.current); safetyTimerRef.current = null; }
          if (id && !isEditing) await clearTechDraft(id);
          setStep('tech'); setTechSigBase64(null); setHasSig(false); setSigError(''); setResumedDraft(false);
        }},
      ],
    });
  }

  // ── Next / Save ────────────────────────────────────────────────────────
  function handleNextOrSave() {
    if (step === 'tech') {
      if (!hasSig) { setSigError('Please draw the technician signature before continuing.'); return; }
      setSigError('');
      setSaving(true);
      if (safetyTimerRef.current) clearTimeout(safetyTimerRef.current);
      safetyTimerRef.current = setTimeout(() => {
        setSaving(false);
        setSigError('Signature capture timed out — please try again.');
      }, 10_000);
      canvasRef.current?.readSignature();
    } else {
      if (!signedBy.trim()) { setSigError('Please enter the name of the authorised person.'); return; }
      if (!hasSig)          { setSigError('Please draw the client signature before saving.'); return; }
      setSigError('');
      setSaving(true);
      if (safetyTimerRef.current) clearTimeout(safetyTimerRef.current);
      safetyTimerRef.current = setTimeout(() => {
        setSaving(false);
        setSigError('Signature capture timed out — please try again.');
      }, 10_000);
      canvasRef.current?.readSignature();
    }
  }

  // Shared "what happens after a signature is successfully saved" action —
  // see the autoComplete comment near the top of this component.
  function finishAfterSignature() {
    leavingAfterSaveRef.current = true;
    if (autoComplete && id) {
      useJobsStore.getState().updateJobStatus(id, JobStatus.Completed);
      router.replace(`/jobs/${id}/report` as never);
    } else {
      router.back();
    }
  }

  // ── onOK from canvas ──────────────────────────────────────────────────
  async function handleOK(signature: string) {
    if (safetyTimerRef.current) { clearTimeout(safetyTimerRef.current); safetyTimerRef.current = null; }

    if (step === 'tech') {
      // First-time sign-off: persist so leaving and coming back resumes at
      // the client step. A re-sign keeps it in memory only, so abandoning a
      // re-sign can never leave a stray draft to resurface later.
      // FIX: this await used to be unguarded — a storage failure threw
      // after the safety timer was already cleared, leaving the button on
      // "Processing…" for good. writeTechDraft never throws.
      if (id && !isEditing) await writeTechDraft(id, signature);
      setTechSigBase64(signature);
      setStep('client');
      setHasSig(false);
      setSaving(false);
      return;
    }

    // Client step — final save. Defense-in-depth: the UI already hides
    // every path here when jobLocked, but guard the actual write too so no
    // other/future call site can silently sign a locked job.
    if (jobLocked) {
      setSaving(false);
      setSigError('This job is no longer active and can\'t be signed.');
      return;
    }
    try {
      const now      = new Date().toISOString();
      // Re-read the job's row rather than trusting the id captured on mount:
      // a sync conflict can re-key it to the server's id while this screen
      // is open (lib/sync.ts), and an Update aimed at the old id would
      // match nothing server-side.
      const currentId = (getSignatureForJob(id!) as Signature | null)?.id ?? existingRecordId.current;
      const recordId = currentId ?? generateUUID();
      const isUpdate = !!currentId;
      const companyId = useAuthStore.getState().user?.company_id ?? null;
      const record: Record<string, string | null> = {
        id: recordId,
        job_id: id!,
        company_id: companyId,
        signature_url: signature,
        tech_signature_url: techSigBase64,
        signed_by_name: signedBy.trim(),
        signed_at: now,
        device_info: Platform.OS === 'ios' ? 'iOS' : 'Android',
      };
      upsertRecord('signatures', record);
      // upsertRecord logs and swallows its own errors, so confirm the row
      // really landed before telling anyone it's saved (or queueing a sync
      // for a row that doesn't exist).
      const written = getSignatureForJob(id!) as Signature | null;
      if (written?.id !== recordId || written?.signed_at !== now) throw new Error('signature write not persisted');
      addToSyncQueue('signatures', recordId, isUpdate ? SyncOperation.Update : SyncOperation.Insert, record);
      void runSync();
      if (id) await clearTechDraft(id);
      existingRecordId.current = recordId;
      setSaving(false);
      setIsEditing(false);
      // Nothing is pending any more — see unsavedRef. Without this the
      // leave-guard still saw the old strokes and asked to discard them.
      setHasSig(false);
      setTechSigBase64(null);
      setStep('tech');
      setResumedDraft(false);
      const refreshed = getSignatureForJob(id!) as Signature | null;
      if (refreshed) setExistingSig(refreshed);
      showConfirm({
        title: 'Signature saved',
        message: 'All signatures have been recorded.',
        icon: 'check-circle-outline',
        buttons: [{ text: 'OK', onPress: finishAfterSignature }],
      });
    } catch {
      setSaving(false);
      setSigError('Failed to save signature. Please try again.');
    }
  }

  // ── Client Unavailable ────────────────────────────────────────────────
  async function handleClientUnavailable() {
    if (jobLocked) {
      setSigError("This job is no longer active and can't be signed.");
      return;
    }
    if (!techSigBase64) {
      setSigError('Technician must sign first before marking client as unavailable.');
      return;
    }
    setSaving(true);
    try {
      const now      = new Date().toISOString();
      // Re-read the job's row rather than trusting the id captured on mount:
      // a sync conflict can re-key it to the server's id while this screen
      // is open (lib/sync.ts), and an Update aimed at the old id would
      // match nothing server-side.
      const currentId = (getSignatureForJob(id!) as Signature | null)?.id ?? existingRecordId.current;
      const recordId = currentId ?? generateUUID();
      const isUpdate = !!currentId;
      const companyId = useAuthStore.getState().user?.company_id ?? null;
      const record: Record<string, string | null> = {
        id: recordId, job_id: id!,
        company_id: companyId,
        signature_url: 'UNAVAILABLE',
        tech_signature_url: techSigBase64,
        signed_by_name: 'Client Unavailable',
        signed_at: now,
        device_info: Platform.OS === 'ios' ? 'iOS' : 'Android',
      };
      upsertRecord('signatures', record);
      // upsertRecord logs and swallows its own errors, so confirm the row
      // really landed before telling anyone it's saved (or queueing a sync
      // for a row that doesn't exist).
      const written = getSignatureForJob(id!) as Signature | null;
      if (written?.id !== recordId || written?.signed_at !== now) throw new Error('signature write not persisted');
      addToSyncQueue('signatures', recordId, isUpdate ? SyncOperation.Update : SyncOperation.Insert, record);
      void runSync();
      if (id) await clearTechDraft(id);
      existingRecordId.current = recordId;
      setSaving(false);
      setIsEditing(false);
      // Nothing is pending any more — see unsavedRef. Without this the
      // leave-guard still saw the old strokes and asked to discard them.
      setHasSig(false);
      setTechSigBase64(null);
      setStep('tech');
      setResumedDraft(false);
      const refreshed = getSignatureForJob(id!) as Signature | null;
      if (refreshed) setExistingSig(refreshed);
      showConfirm({
        title: 'Recorded',
        message: 'Technician signature captured. Client was unavailable.',
        icon: 'check-circle-outline',
        buttons: [{ text: 'OK', onPress: finishAfterSignature }],
      });
    } catch {
      setSaving(false);
      setSigError('Failed to record. Please try again.');
    }
  }

  const showCanvas   = showCanvasNow;
  const showTechView = !showCanvas; // view-only after completion, cancellation, or lock
  const isClientStep = step === 'client';

  // Shared canvas webStyle — hides the library's own buttons/footer
  const CANVAS_STYLE = `
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { background: transparent; overflow: hidden; }
    .m-signature-pad { box-shadow: none !important; border: none !important; background: #FFFFFF; width: 100%; height: 100%; }
    .m-signature-pad--body { border: none !important; background: #FFFFFF; width: 100%; height: 100%; }
    .m-signature-pad--footer { display: none !important; }
    canvas { touch-action: none; }
  `;

  return (
    <View style={[s.root, { backgroundColor: C.background }]}>

      {/* ── Header ── */}
      <ScreenHeader
        eyebrow="JOB SIGN-OFF"
        title="Sign-Off"
        showBack={true}
        fallbackHref="/jobs"
        rightComponent={
          showCanvas ? (
            <View style={{ flexDirection: 'row', gap: 8 }}>
              {isClientStep && (
                <TouchableOpacity onPress={handleResetAll} style={[s.headerBtn, { backgroundColor: C.backgroundTertiary }]}>
                  <MaterialCommunityIcons name="refresh" size={15} color={C.textSecondary} />
                  <Text style={[s.headerBtnTxt, { color: C.textSecondary }]}>Restart</Text>
                </TouchableOpacity>
              )}
              <TouchableOpacity onPress={handleClear} style={[s.headerBtn, { backgroundColor: C.backgroundTertiary }]}>
                <MaterialCommunityIcons name="eraser" size={15} color={C.textSecondary} />
                <Text style={[s.headerBtnTxt, { color: C.textSecondary }]}>Clear</Text>
              </TouchableOpacity>
            </View>
          ) : undefined
        }
      />

      {/* ── Body ── */}
      <ScrollView
        ref={scrollRef}
        style={s.scroll}
        // FIX: every other screen in this flow caps content at
        // contentMaxWidth and centers it on a tablet (see useResponsive's
        // own doc comment) — this screen never adopted it, so the consent
        // card, name input, and signature canvas would stretch full-width
        // on a tablet, breaking visual consistency with the rest of the app.
        contentContainerStyle={{ maxWidth: contentMaxWidth, width: '100%', alignSelf: 'center' }}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        // Start with scroll enabled; lockScroll/unlockScroll toggle via setNativeProps
        scrollEnabled={true}
      >

        {/* Consent */}
        <Card variant="info" style={{ marginBottom: 16 }}>
          <View style={s.consentRow}>
            <MaterialCommunityIcons name="shield-check-outline" size={15} color={C.info} />
            <Text style={[s.consentTitle, { color: C.info }]}>CONSENT STATEMENT</Text>
          </View>
          <Text style={[s.consentTxt, { color: C.textSecondary }]}>{CONSENT}</Text>
        </Card>

        {/* ── Existing sig banner ── */}
        {existingSig && !isEditing && (
          <Card variant="success" style={s.bannerCard} padding={14}>
            <MaterialCommunityIcons name="check-circle" size={16} color={C.success} />
            <Text style={[s.bannerTxt, { color: C.successDark }]}>
              Signed by {existingSig.signed_by_name} · {new Date(existingSig.signed_at).toLocaleDateString('en-AU')}
            </Text>
            {!jobLocked && (
              <TouchableOpacity
                onPress={() => { setIsEditing(true); setStep('tech'); setHasSig(false); setSigError(''); }}
                style={[s.resignBtn, { backgroundColor: T.tintBg(C.warning), borderColor: T.tintBorder(C.warning) }]}
              >
                <MaterialCommunityIcons name="pencil-outline" size={13} color={C.warningDark} />
                <Text style={[s.resignTxt, { color: C.warningDark }]}>Re-sign</Text>
              </TouchableOpacity>
            )}
          </Card>
        )}

        {/* Locked notice — job is completed/cancelled, no signing possible */}
        {jobLocked && !existingSig && (
          <Card variant="info" style={s.bannerCard} padding={14}>
            <MaterialCommunityIcons name="lock-outline" size={16} color={C.textTertiary} />
            <Text style={[s.bannerTxt, { color: C.textSecondary }]}>
              This job is no longer active — a signature can&apos;t be captured.
            </Text>
          </Card>
        )}

        {/* ── Step indicator ── */}
        {showCanvas && (
          <View style={[s.stepRow, { borderColor: C.border }]}>
            <View style={[s.stepPill, { backgroundColor: C.accent }]}>
              <Text style={s.stepPillTxt}>
                {step === 'tech' ? 'STEP 1 OF 2' : 'STEP 2 OF 2'}
              </Text>
            </View>
            <Text style={[s.stepLabel, { color: C.textSecondary }]}>
              {step === 'tech' ? 'Technician Sign-off' : 'Client Sign-off'}
            </Text>
          </View>
        )}
        {showCanvas && isClientStep && resumedDraft && (
          <Text style={[s.resumedTxt, { color: C.textTertiary }]}>
            Your technician signature from earlier was kept. Tap Restart to sign it again.
          </Text>
        )}

        {/* ─────────────── TECHNICIAN SIGNATURE ─────────────── */}
        <Text style={[s.fieldLabel, { color: C.textTertiary, marginTop: 16 }]}>TECHNICIAN SIGNATURE *</Text>

        <View style={[s.canvasCard, { borderColor: C.border, backgroundColor: '#FFFFFF' }]}>

          {/* View-only: existing sig captured */}
          {showTechView && (
            existingSig?.tech_signature_url
              ? <Image source={{ uri: existingSig.tech_signature_url }} style={s.sigImage} resizeMode="contain" />
              : <View style={s.emptyState}>
                  <MaterialCommunityIcons name="draw" size={24} color={C.textTertiary} />
                  <Text style={[s.emptyTxt, { color: C.textTertiary }]}>No technician signature on file</Text>
                </View>
          )}

          {/* Active step = tech: show canvas */}
          {showCanvas && step === 'tech' && (
            <>
              <SignatureScreenCanvas
                ref={techCanvasRef}
                onOK={handleOK}
                onEmpty={() => { setSaving(false); setSigError('Please draw a signature first.'); }}
                onBegin={handleBegin}
                onEnd={handleEnd}
                descriptionText=""
                clearText="Clear"
                confirmText="Save"
                webStyle={CANVAS_STYLE}
                autoClear={false}
                backgroundColor="#FFFFFF"
                penColor="#111827"
                style={s.canvasInner}
                nestedScrollEnabled={false}
              />
              {!hasSig && (
                <View style={s.hint} pointerEvents="none">
                  <MaterialCommunityIcons name="draw" size={26} color={C.textTertiary} />
                  <Text style={[s.hintTxt, { color: C.textTertiary }]}>Draw technician signature here</Text>
                </View>
              )}
            </>
          )}

          {/* Captured tech sig displayed while on client step */}
          {showCanvas && step === 'client' && techSigBase64 && (
            <Image source={{ uri: techSigBase64 }} style={s.sigImage} resizeMode="contain" />
          )}
        </View>

        {/* ─────────────── CLIENT SIGNATURE ─────────────── */}
        {(isClientStep || showTechView) && (
          <View style={{ marginTop: 24 }}>
            <Text style={[s.fieldLabel, { color: C.textTertiary }]}>AUTHORISED PERSON — FULL NAME *</Text>
            <View style={[s.inputRow, { backgroundColor: C.surface, borderColor: (!signedBy && sigError) ? C.error : C.border }]}>
              <MaterialCommunityIcons name="account-outline" size={18} color={C.textTertiary} />
              <TextInput
                style={[s.nameInput, { color: C.text }]}
                placeholder="e.g. John Smith"
                placeholderTextColor={C.textTertiary}
                value={signedBy}
                onChangeText={t => { setSignedBy(t); setSigError(''); }}
                autoCapitalize="words"
                returnKeyType="done"
                maxLength={MAX_LENGTHS.name}
                editable={showCanvas}
              />
            </View>

            <Text style={[s.fieldLabel, { color: C.textTertiary, marginTop: 16 }]}>CLIENT SIGNATURE *</Text>

            <View style={[s.canvasCard, { borderColor: C.border, backgroundColor: '#FFFFFF' }]}>

              {/* View-only */}
              {showTechView && (
                existingSig?.signature_url === 'UNAVAILABLE'
                  ? <View style={s.emptyState}>
                      <MaterialCommunityIcons name="account-off-outline" size={26} color={C.warning} />
                      <Text style={[s.emptyTxt, { color: C.warningDark, fontWeight: '700' }]}>Client unavailable</Text>
                      <Text style={[s.emptyTxt, { color: C.textTertiary }]}>No client signature captured</Text>
                    </View>
                  : <Image source={{ uri: existingSig?.signature_url }} style={s.sigImage} resizeMode="contain" />
              )}

              {/* Active client canvas */}
              {isClientStep && (
                <>
                  <SignatureScreenCanvas
                    ref={clientCanvasRef}
                    onOK={handleOK}
                    onEmpty={() => { setSaving(false); setSigError('Please draw the client signature.'); }}
                    onBegin={handleBegin}
                    onEnd={handleEnd}
                    descriptionText=""
                    clearText="Clear"
                    confirmText="Save"
                    webStyle={CANVAS_STYLE}
                    autoClear={false}
                    backgroundColor="#FFFFFF"
                    penColor="#111827"
                    style={s.canvasInner}
                    nestedScrollEnabled={false}
                  />
                  {!hasSig && (
                    <View style={s.hint} pointerEvents="none">
                      <MaterialCommunityIcons name="draw" size={26} color={C.textTertiary} />
                      <Text style={[s.hintTxt, { color: C.textTertiary }]}>Draw client signature here</Text>
                    </View>
                  )}
                </>
              )}
            </View>
          </View>
        )}

        <View style={{ height: 32 }} />
      </ScrollView>

      {/* ── Footer ── */}
      <View style={[s.footer, { backgroundColor: C.surface, borderTopColor: C.border, paddingBottom: Math.max(insets.bottom, 20) }]}>

        {sigError ? (
          <Card variant="danger" style={s.errorCard} padding={12}>
            <MaterialCommunityIcons name="alert-circle" size={15} color={C.error} />
            <Text style={[s.errorTxt, { color: C.errorDark }]}>{sigError}</Text>
          </Card>
        ) : null}

        <View style={[s.legalRow, { backgroundColor: C.backgroundTertiary, borderColor: C.border }]}>
          <MaterialCommunityIcons name="lock-outline" size={11} color={C.textTertiary} />
          <Text style={[s.legalTxt, { color: C.textTertiary }]}>
            Electronic Transactions Act 1999 (Cth) · {Platform.OS === 'ios' ? 'iOS' : 'Android'} · {new Date().toLocaleDateString('en-AU')}
          </Text>
        </View>

        {showCanvas && (
          <View style={{ gap: 10 }}>
            <Button
              variant="primary"
              title={saving ? 'Processing…' : (step === 'tech' ? 'Next: Client Signature →' : 'Save All Signatures')}
              onPress={handleNextOrSave}
              disabled={saving}
              icon={step === 'tech' ? 'arrow-right-circle' : 'check-circle'}
            />
            {isClientStep && (
              <Button
                variant="secondary"
                title="Client Unavailable to Sign"
                onPress={handleClientUnavailable}
                disabled={saving}
              />
            )}
            {isEditing && (
              <Button
                variant="secondary"
                title="Cancel Re-sign"
                onPress={() => { setIsEditing(false); setStep('tech'); setHasSig(false); setTechSigBase64(null); setSigError(''); }}
                disabled={saving}
              />
            )}
          </View>
        )}
      </View>

    </View>
  );
}

const CANVAS_H = 200;

const s = StyleSheet.create({
  root:   { flex: 1 },
  scroll: { flex: 1, paddingHorizontal: 20, paddingTop: 16 },

  // Header buttons
  headerBtn:    { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 10, paddingVertical: 7, borderRadius: 10 },
  headerBtnTxt: { fontSize: 13, fontWeight: '600' },

  // Consent card
  consentRow:   { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 },
  consentTitle: { fontSize: 11, fontWeight: '700', letterSpacing: 0.8 },
  consentTxt:   { fontSize: 13, lineHeight: 20, fontWeight: '500' },

  // Banner
  bannerCard: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 16 },
  bannerTxt:  { fontSize: 13, fontWeight: '700', flex: 1 },
  resignBtn:  { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8, borderWidth: 1 },
  resignTxt:  { fontSize: 11, fontWeight: '700' },

  // Step indicator
  stepRow:    { flexDirection: 'row', alignItems: 'center', gap: 10, borderRadius: 12, borderWidth: 1, padding: 12, marginBottom: 4 },
  stepPill:   { borderRadius: 6, paddingHorizontal: 8, paddingVertical: 4 },
  stepPillTxt:{ fontSize: 11, fontWeight: '700', color: T.textOnPrimary, letterSpacing: 1 },
  stepLabel:  { fontSize: 14, fontWeight: '700' },
  resumedTxt: { fontSize: 12, fontWeight: '500', marginTop: 8, lineHeight: 17 },

  // Field label
  fieldLabel: { fontSize: 11, fontWeight: '700', letterSpacing: 0.8, marginBottom: 10, textTransform: 'uppercase' },

  // Name input
  inputRow:   { flexDirection: 'row', alignItems: 'center', gap: 10, borderRadius: 12, borderWidth: 1, paddingHorizontal: 16, paddingVertical: 14, marginBottom: 4 },
  nameInput:  { flex: 1, fontSize: 16, fontWeight: '600', padding: 0 },

  // Canvas card
  canvasCard:  { borderRadius: 14, borderWidth: 1.5, overflow: 'hidden', height: CANVAS_H, position: 'relative' },
  canvasInner: { flex: 1, width: '100%', height: CANVAS_H },
  sigImage:    { width: '100%', height: '100%' },

  // Empty / hint states
  emptyState: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 6 },
  emptyTxt:   { fontSize: 13, fontWeight: '600' },
  hint:       { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, justifyContent: 'center', alignItems: 'center', gap: 8 },
  hintTxt:    { fontSize: 14, fontWeight: '600', letterSpacing: 0.3 },

  // Footer
  footer:    { paddingHorizontal: 20, paddingTop: 14, borderTopWidth: 1 },
  errorCard: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10 },
  errorTxt:  { fontSize: 13, fontWeight: '700', flex: 1 },
  legalRow:  { flexDirection: 'row', alignItems: 'center', gap: 8, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 10, marginBottom: 12, borderWidth: 1 },
  legalTxt:  { flex: 1, fontSize: 11, lineHeight: 15, fontWeight: '500' },
});
