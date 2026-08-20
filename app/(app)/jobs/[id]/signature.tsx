import { useState, useRef, useEffect, useCallback } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  Alert, Platform, ScrollView, Image,
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import SignatureScreenCanvas from 'react-native-signature-canvas';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { upsertRecord, addToSyncQueue, getSignatureForJob } from '@/lib/database';
import { runSync } from '@/lib/sync';
import { generateUUID } from '@/utils/uuid';
import { useColors } from '@/hooks/useColors';
import { SyncOperation } from '@/constants/Enums';
import { useAuthStore } from '@/store/authStore';
import type { Signature } from '@/types';
import { ScreenHeader, Button, Card } from '@/components/ui';
import { T } from '@/constants/Colors';
import { MAX_LENGTHS } from '@/utils/sanitize';

// Canvas lib doesn't export its ref type — capture the minimal surface we use.
type CanvasRef = { readSignature: () => void; clearSignature: () => void };

export default function SignatureScreen() {
  const C = useColors();
  const { id } = useLocalSearchParams<{ id: string }>();
  const insets = useSafeAreaInsets();

  // ONE canvas ref — we only ever mount one canvas at a time
  const canvasRef = useRef<CanvasRef | null>(null);
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

  const existingRecordId = useRef<string | null>(null);
  // Safety timer ref — never stored on the canvas ref
  const safetyTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── Load existing / draft ──────────────────────────────────────────────
  useEffect(() => {
    if (!id) return;
    const existing = getSignatureForJob(id) as Signature | null;
    if (existing) {
      setExistingSig(existing);
      setSignedBy(existing.signed_by_name || '');
      existingRecordId.current = existing.id ?? null;
    } else {
      AsyncStorage.getItem(`draft_tech_sig_${id}`).then(draft => {
        if (draft) { setTechSigBase64(draft); setStep('client'); }
      });
    }
    return () => {
      // Clear draft on unmount — prevents cross-job bleed (BUG-N8)
      AsyncStorage.removeItem(`draft_tech_sig_${id}`).catch(() => {});
      if (safetyTimerRef.current) clearTimeout(safetyTimerRef.current);
    };
  }, [id]);

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
    Alert.alert('Restart Sign-off', 'This will delete the captured technician signature. Are you sure?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Restart', style: 'destructive', onPress: async () => {
        if (safetyTimerRef.current) { clearTimeout(safetyTimerRef.current); safetyTimerRef.current = null; }
        if (id) await AsyncStorage.removeItem(`draft_tech_sig_${id}`);
        setStep('tech'); setTechSigBase64(null); setHasSig(false); setSigError('');
      }},
    ]);
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

  // ── onOK from canvas ──────────────────────────────────────────────────
  async function handleOK(signature: string) {
    if (safetyTimerRef.current) { clearTimeout(safetyTimerRef.current); safetyTimerRef.current = null; }

    if (step === 'tech') {
      await AsyncStorage.setItem(`draft_tech_sig_${id}`, signature);
      setTechSigBase64(signature);
      setStep('client');
      setHasSig(false);
      setSaving(false);
      return;
    }

    // Client step — final save
    try {
      const now      = new Date().toISOString();
      const recordId = existingRecordId.current ?? generateUUID();
      const isUpdate = !!existingRecordId.current;
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
      addToSyncQueue('signatures', recordId, isUpdate ? SyncOperation.Update : SyncOperation.Insert, record);
      void runSync();
      if (id) await AsyncStorage.removeItem(`draft_tech_sig_${id}`);
      existingRecordId.current = recordId;
      setSaving(false);
      setIsEditing(false);
      const refreshed = getSignatureForJob(id!) as Signature | null;
      if (refreshed) setExistingSig(refreshed);
      Alert.alert('Signature Saved', 'All signatures have been recorded.', [
        { text: 'OK', onPress: () => router.back() },
      ]);
    } catch {
      setSaving(false);
      setSigError('Failed to save signature. Please try again.');
    }
  }

  // ── Client Unavailable ────────────────────────────────────────────────
  async function handleClientUnavailable() {
    if (!techSigBase64) {
      setSigError('Technician must sign first before marking client as unavailable.');
      return;
    }
    setSaving(true);
    try {
      const now      = new Date().toISOString();
      const recordId = existingRecordId.current ?? generateUUID();
      const isUpdate = !!existingRecordId.current;
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
      addToSyncQueue('signatures', recordId, isUpdate ? SyncOperation.Update : SyncOperation.Insert, record);
      void runSync();
      if (id) await AsyncStorage.removeItem(`draft_tech_sig_${id}`);
      existingRecordId.current = recordId;
      setSaving(false);
      setIsEditing(false);
      const refreshed = getSignatureForJob(id!) as Signature | null;
      if (refreshed) setExistingSig(refreshed);
      Alert.alert('Recorded', 'Technician signature captured. Client was unavailable.', [
        { text: 'OK', onPress: () => router.back() },
      ]);
    } catch {
      setSaving(false);
      setSigError('Failed to record. Please try again.');
    }
  }

  const showCanvas   = !existingSig || isEditing;
  const showTechView = !showCanvas; // view-only after completion
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
            <TouchableOpacity
              onPress={() => { setIsEditing(true); setStep('tech'); setHasSig(false); setSigError(''); }}
              style={[s.resignBtn, { backgroundColor: C.warning + '20', borderColor: C.warning + '60' }]}
            >
              <MaterialCommunityIcons name="pencil-outline" size={13} color={C.warningDark} />
              <Text style={[s.resignTxt, { color: C.warningDark }]}>Re-sign</Text>
            </TouchableOpacity>
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
                ref={canvasRef}
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
                      <Text style={[s.emptyTxt, { color: C.warningDark, fontWeight: '700' }]}>Client Unavailable</Text>
                      <Text style={[s.emptyTxt, { color: C.textTertiary }]}>No client signature captured</Text>
                    </View>
                  : <Image source={{ uri: existingSig?.signature_url }} style={s.sigImage} resizeMode="contain" />
              )}

              {/* Active client canvas */}
              {isClientStep && (
                <>
                  <SignatureScreenCanvas
                    ref={canvasRef}
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
                onPress={() => { setIsEditing(false); setStep('tech'); setHasSig(false); setSigError(''); }}
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
  consentTitle: { fontSize: 11, fontWeight: '900', letterSpacing: 1.5 },
  consentTxt:   { fontSize: 13, lineHeight: 20, fontWeight: '500' },

  // Banner
  bannerCard: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 16 },
  bannerTxt:  { fontSize: 13, fontWeight: '700', flex: 1 },
  resignBtn:  { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8, borderWidth: 1 },
  resignTxt:  { fontSize: 11, fontWeight: '800' },

  // Step indicator
  stepRow:    { flexDirection: 'row', alignItems: 'center', gap: 10, borderRadius: 12, borderWidth: 1, padding: 12, marginBottom: 4 },
  stepPill:   { borderRadius: 6, paddingHorizontal: 8, paddingVertical: 4 },
  stepPillTxt:{ fontSize: 10, fontWeight: '900', color: T.textPrimary, letterSpacing: 1 },
  stepLabel:  { fontSize: 14, fontWeight: '700' },

  // Field label
  fieldLabel: { fontSize: 11, fontWeight: '800', letterSpacing: 1.2, marginBottom: 10, textTransform: 'uppercase' },

  // Name input
  inputRow:   { flexDirection: 'row', alignItems: 'center', gap: 10, borderRadius: 12, borderWidth: 1, paddingHorizontal: 16, paddingVertical: 14, marginBottom: 4 },
  nameInput:  { flex: 1, fontSize: 16, fontWeight: '600', padding: 0 },

  // Canvas card
  canvasCard:  { borderRadius: 16, borderWidth: 1.5, overflow: 'hidden', height: CANVAS_H, position: 'relative' },
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
