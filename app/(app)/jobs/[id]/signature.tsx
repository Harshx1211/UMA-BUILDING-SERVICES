import { useState, useRef, useEffect } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  Alert, Platform, KeyboardAvoidingView, Image, ScrollView,
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
import { Signature } from '@/types';
import { ScreenHeader, Button, Card } from '@/components/ui';

export default function SignatureScreen() {
  const C = useColors();
  const { id } = useLocalSearchParams<{ id: string }>();
  const insets  = useSafeAreaInsets();
  const techCanvasRef = useRef<any>(null);
  const clientCanvasRef = useRef<any>(null);

  const [signedBy, setSignedBy] = useState('');
  const [saving,   setSaving]   = useState(false);
  const [sigError, setSigError] = useState('');
  const [hasSig,   setHasSig]   = useState(false);
  const [existingSig, setExistingSig] = useState<Signature | null>(null);
  const [scrollEnabled, setScrollEnabled] = useState(true);
  const [isEditing, setIsEditing] = useState(false); // true = re-sign mode even when existingSig is present

  // Track the record id for upsert — needed so updates hit ON CONFLICT(id)
  const existingRecordId = useRef<string | null>(null);

  // Two-step flow: tech signs first, then client.
  const [step, setStep] = useState<'tech' | 'client'>('tech');
  const [techSigBase64, setTechSigBase64] = useState<string | null>(null);

  useEffect(() => {
    if (id) {
      const existing = getSignatureForJob(id);
      if (existing) {
        setExistingSig(existing as unknown as Signature);
        setSignedBy((existing.signed_by_name as string) || '');
        existingRecordId.current = (existing as any).id ?? null;
      } else {
        // Load draft tech signature if available to prevent data loss
        AsyncStorage.getItem(`draft_tech_sig_${id}`).then(draft => {
          if (draft) {
            setTechSigBase64(draft);
            setStep('client');
          }
        });
      }
    }
  }, [id]);

  const CONSENT =
    'By signing below, I confirm that the inspection described in this report was ' +
    'completed on the property on the date shown, and that I have been given the ' +
    'opportunity to review the findings. This signature is legally binding under ' +
    'the Electronic Transactions Act 1999 (Cth).';

  function _handleClear() {
    if (step === 'tech') techCanvasRef.current?.clearSignature();
    else clientCanvasRef.current?.clearSignature();
    setHasSig(false);
  }

  function _handleStartEditing() {
    // Pre-fill tech sig from existing record if available so it can be carried forward
    setTechSigBase64(existingSig?.tech_signature_url ?? null);
    setSignedBy(existingSig?.signed_by_name ?? '');
    setStep('tech');
    setHasSig(false);
    setSigError('');
    setIsEditing(true);
  }

  function _handleResetAll() {
    Alert.alert('Restart Sign-off', 'This will delete the captured technician signature. Are you sure?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Restart', style: 'destructive', onPress: async () => {
        if (id) await AsyncStorage.removeItem(`draft_tech_sig_${id}`);
        setStep('tech');
        setTechSigBase64(null);
        setHasSig(false);
        setSigError('');
      }}
    ]);
  }

  function _handleNextOrSave() {
    if (step === 'tech') {
      if (!hasSig) { setSigError('Please ensure the technician signature is captured.'); return; }
      setSigError('');
      setSaving(true);
      techCanvasRef.current?.readSignature(); // triggers _handleOK
    } else {
      if (!signedBy.trim()) { setSigError('Please enter the name of the person signing.'); return; }
      if (!hasSig) { setSigError('Please ensure the client signature is captured.'); return; }
      setSigError('');
      setSaving(true);
      clientCanvasRef.current?.readSignature(); // triggers _handleOK
    }
  }

  async function _handleOK(signature: string) {
    if (step === 'tech') {
      if (id) await AsyncStorage.setItem(`draft_tech_sig_${id}`, signature);
      setTechSigBase64(signature);
      setStep('client');
      setHasSig(false);
      setSaving(false);
      return;
    }

    // Client step - final save
    try {
      const now       = new Date().toISOString();
      // Reuse existing id if one exists — so upsertRecord's ON CONFLICT(id) updates
      // the row instead of trying to INSERT a new one that violates the UNIQUE(job_id) constraint.
      const recordId  = existingRecordId.current ?? generateUUID();
      const isUpdate  = !!existingRecordId.current;
      const record = {
        id: recordId, job_id: id!,
        signature_url: signature, // client sig
        tech_signature_url: techSigBase64, // tech sig
        signed_by_name: signedBy.trim(),
        signed_at: now,
        device_info: Platform.OS === 'ios' ? 'iOS' : 'Android',
      };
      upsertRecord('signatures', record as any);
      addToSyncQueue('signatures', recordId, isUpdate ? SyncOperation.Update : SyncOperation.Insert, record);
      void runSync();
      if (id) await AsyncStorage.removeItem(`draft_tech_sig_${id}`);
      existingRecordId.current = recordId;
      setSaving(false);
      setIsEditing(false);
      // Refresh the displayed existingSig from DB so view-mode shows the new sigs
      const refreshed = getSignatureForJob(id!);
      if (refreshed) setExistingSig(refreshed as unknown as Signature);
      Alert.alert('Signature Saved', 'All signatures have been recorded.', [
        { text: 'OK', onPress: () => router.back() },
      ]);
    } catch {
      setSaving(false);
      setSigError('Failed to capture signature. Please try again.');
    }
  }

  async function _handleClientUnavailable() {
    setSaving(true);
    try {
      const now      = new Date().toISOString();
      const recordId = existingRecordId.current ?? generateUUID();
      const isUpdate = !!existingRecordId.current;
      const record = {
        id: recordId, job_id: id!,
        signature_url: 'UNAVAILABLE',
        tech_signature_url: techSigBase64,
        signed_by_name: 'Client Unavailable',
        signed_at: now,
        device_info: Platform.OS === 'ios' ? 'iOS' : 'Android',
      };
      upsertRecord('signatures', record as any);
      addToSyncQueue('signatures', recordId, isUpdate ? SyncOperation.Update : SyncOperation.Insert, record);
      void runSync();
      if (id) await AsyncStorage.removeItem(`draft_tech_sig_${id}`);
      existingRecordId.current = recordId;
      setSaving(false);
      setIsEditing(false);
      const refreshed = getSignatureForJob(id!);
      if (refreshed) setExistingSig(refreshed as unknown as Signature);
      Alert.alert('Signature Saved', 'The technician signature was recorded without a client signature.', [
        { text: 'OK', onPress: () => router.back() },
      ]);
    } catch {
      setSaving(false);
      setSigError('Failed to record signature. Please try again.');
    }
  }

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: C.background }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <View style={[styles.root, { backgroundColor: C.background }]}>

        {/* ── Flat Header — matches Home/Schedule style ──── */}
        <ScreenHeader
          eyebrow="JOB SIGN-OFF"
          title="Sign-Off"
          showBack={true}
          rightComponent={
            !existingSig ? (
              <View style={{ flexDirection: 'row', gap: 8 }}>
                {step === 'client' && (
                  <TouchableOpacity onPress={_handleResetAll} style={[styles.clearBtn, { backgroundColor: C.backgroundTertiary }]}>
                    <MaterialCommunityIcons name="refresh" size={16} color={C.textSecondary} />
                    <Text style={[styles.clearTxt, { color: C.textSecondary }]}>Restart</Text>
                  </TouchableOpacity>
                )}
                <TouchableOpacity onPress={_handleClear} style={[styles.clearBtn, { backgroundColor: C.backgroundTertiary }]}>
                  <MaterialCommunityIcons name="eraser" size={16} color={C.textSecondary} />
                  <Text style={[styles.clearTxt, { color: C.textSecondary }]}>Clear</Text>
                </TouchableOpacity>
              </View>
            ) : undefined
          }
        />

        {/* ── Consent Card ─────────────────────────────────── */}
        <ScrollView style={styles.scrollArea} scrollEnabled={scrollEnabled} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
          <Card variant="info" style={{ marginBottom: 16 }}>
            <View style={styles.consentHeader}>
              <MaterialCommunityIcons name="shield-check-outline" size={16} color={C.info} />
              <Text style={[styles.consentTitle, { color: C.info }]}>CONSENT STATEMENT</Text>
            </View>
            <Text style={[styles.consentTxt, { color: C.textSecondary }]}>{CONSENT}</Text>
          </Card>

          {/* When a sig exists AND we are not actively editing, show static view */}
          {existingSig && !isEditing && (
            <Card variant="success" style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 16 }} padding={14}>
              <MaterialCommunityIcons name="check-circle" size={16} color={C.success} />
              <Text style={[styles.capturedTxt, { color: C.successDark }]}>
                Signed by {existingSig.signed_by_name} · {new Date(existingSig.signed_at).toLocaleDateString('en-AU')}
              </Text>
            </Card>
          )}
          <Text style={[styles.label, { color: C.textTertiary, marginTop: 12 }]}>TECHNICIAN SIGNATURE *</Text>
          <View
            style={[
              styles.canvasWrap,
              { borderColor: (sigError.includes('technician') && step === 'tech') ? C.error : C.border },
            ]}
            onTouchStart={() => setScrollEnabled(false)}
            onTouchEnd={() => setScrollEnabled(true)}
            onTouchCancel={() => setScrollEnabled(true)}
          >
            {existingSig && !isEditing ? (
              <View style={styles.existingSigBg}>
                {existingSig.tech_signature_url ? (
                  <Image
                    source={{ uri: existingSig.tech_signature_url }}
                    style={{ width: '100%', height: '100%', resizeMode: 'contain' }}
                  />
                ) : (
                  <Text style={[styles.canvasHintTxt, { color: C.textTertiary }]}>No technician signature on file</Text>
                )}
              </View>
            ) : step === 'client' && techSigBase64 ? (
              <View style={styles.existingSigBg}>
                <Image
                  source={{ uri: techSigBase64 }}
                  style={{ width: '100%', height: '100%', resizeMode: 'contain' }}
                />
              </View>
            ) : step === 'tech' ? (
              <SignatureScreenCanvas
                ref={techCanvasRef}
                onOK={_handleOK}
                onEmpty={() => {
                  setSaving(false);
                  setSigError('Please draw a technician signature before saving.');
                }}
                onBegin={() => setHasSig(true)}
                descriptionText=""
                clearText="Clear"
                confirmText="Save"
                webStyle={`
                  .m-signature-pad { box-shadow: none; border: none; background: #FFFFFF; }
                  .m-signature-pad--body { border: none; background: #FFFFFF; }
                  .m-signature-pad--footer { display: none; }
                  body { background: transparent; }
                `}
                autoClear={false}
                backgroundColor="#FFFFFF"
                penColor="#111827"
              />
            ) : null}
            {!existingSig && step === 'tech' && !hasSig && (
              <View style={styles.canvasHint} pointerEvents="none">
                <MaterialCommunityIcons name="draw" size={28} color={C.textTertiary} />
                <Text style={[styles.canvasHintTxt, { color: C.textTertiary }]}>Technician to draw signature here</Text>
              </View>
            )}
            {isEditing && step === 'tech' && !hasSig && (
              <View style={styles.canvasHint} pointerEvents="none">
                <MaterialCommunityIcons name="draw" size={28} color={C.textTertiary} />
                <Text style={[styles.canvasHintTxt, { color: C.textTertiary }]}>Technician to draw signature here</Text>
              </View>
            )}
          </View>

          {/* ── Client Signature Section (shown when tech signed OR existing) ── */}
          {(step === 'client' || (existingSig && !isEditing)) && (
            <View style={{ marginTop: 24 }}>
              <Text style={[styles.label, { color: C.textTertiary }]}>FULL NAME OF AUTHORISED PERSON *</Text>
              <View style={[styles.inputWrap, {
                backgroundColor: C.surface,
                borderColor: sigError && !signedBy ? C.error : C.border,
              }]}>
                <MaterialCommunityIcons name="account-outline" size={18} color={C.textTertiary} />
                <TextInput
                  style={[styles.input, { color: C.text }]}
                  placeholder="e.g. John Smith"
                  placeholderTextColor={C.textTertiary}
                  value={signedBy}
                  onChangeText={t => { setSignedBy(t); setSigError(''); }}
                  autoCapitalize="words"
                  returnKeyType="done"
                  editable={!existingSig}
                />
              </View>

              <Text style={[styles.label, { color: C.textTertiary, marginTop: 16 }]}>CLIENT SIGNATURE *</Text>
              <View
                style={[
                  styles.canvasWrap,
                  { borderColor: (sigError.includes('client') && step === 'client') ? C.error : C.border },
                ]}
                onTouchStart={() => setScrollEnabled(false)}
                onTouchEnd={() => setScrollEnabled(true)}
                onTouchCancel={() => setScrollEnabled(true)}
              >
                {existingSig && !isEditing ? (
                  <View style={styles.existingSigBg}>
                    <Image
                      source={{ uri: existingSig.signature_url }}
                      style={{ width: '100%', height: '100%', resizeMode: 'contain' }}
                    />
                  </View>
                ) : step === 'client' ? (
                  <SignatureScreenCanvas
                    ref={clientCanvasRef}
                    onOK={_handleOK}
                    onEmpty={() => {
                      setSaving(false);
                      setSigError('Please draw a client signature before saving.');
                    }}
                    onBegin={() => setHasSig(true)}
                    descriptionText=""
                    clearText="Clear"
                    confirmText="Save"
                    webStyle={`
                      .m-signature-pad { box-shadow: none; border: none; background: #FFFFFF; }
                      .m-signature-pad--body { border: none; background: #FFFFFF; }
                      .m-signature-pad--footer { display: none; }
                      body { background: transparent; }
                    `}
                    autoClear={false}
                    backgroundColor="#FFFFFF"
                    penColor="#111827"
                  />
                ) : null}
                {(!existingSig || isEditing) && step === 'client' && !hasSig && (
                  <View style={styles.canvasHint} pointerEvents="none">
                    <MaterialCommunityIcons name="draw" size={28} color={C.textTertiary} />
                    <Text style={[styles.canvasHintTxt, { color: C.textTertiary }]}>Client to draw signature here</Text>
                  </View>
                )}
              </View>
            </View>
          )}

          {(!existingSig || isEditing) && (
            <Text style={[styles.hint, { color: C.textTertiary }]}>
              {step === 'tech' ? 'Step 1: Technician signs off on the inspection.' : 'Step 2: Client signs to confirm findings.'}
            </Text>
          )}
          <View style={{ height: 24 }} />
        </ScrollView>

        {/* ── Footer ───────────────────────────────────────── */}
        <View style={[styles.footer, {
          backgroundColor: C.surface,
          borderTopColor: C.border,
          paddingBottom: Math.max(insets.bottom, 20),
        }]}>
          {sigError ? (
            <Card variant="danger" style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 12 }} padding={14}>
              <MaterialCommunityIcons name="alert-circle" size={16} color={C.error} />
              <Text style={[styles.errorTxt, { color: C.errorDark }]}>{sigError}</Text>
            </Card>
          ) : null}

          <View style={[styles.legalNote, { backgroundColor: C.backgroundTertiary, borderColor: C.border }]}>
            <MaterialCommunityIcons name="lock-outline" size={12} color={C.textTertiary} />
            <Text style={[styles.legalTxt, { color: C.textTertiary }]}>
              Electronic Transactions Act 1999 (Cth) · {Platform.OS === 'ios' ? 'iOS' : 'Android'} · {new Date().toLocaleDateString('en-AU')}
            </Text>
          </View>

          {!existingSig && (
            <View>
              <Button
                variant="primary"
                title={saving ? 'Processing…' : (step === 'tech' ? 'Next: Client Signature' : 'Save Final Signatures')}
                onPress={_handleNextOrSave}
                disabled={saving}
                icon={step === 'tech' ? 'arrow-right-circle' : 'check-circle'}
              />
              {step === 'client' && (
                <View style={{ marginTop: 12 }}>
                  <Button
                    variant="secondary"
                    title="Client Unavailable to Sign"
                    onPress={_handleClientUnavailable}
                    disabled={saving}
                  />
                </View>
              )}
            </View>
          )}
        </View>

      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },

  clearBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 10, paddingVertical: 7,
    borderRadius: 10,
  },
  clearTxt: { fontSize: 13, fontWeight: '600' },

  // Body
  scrollArea: { flex: 1, paddingHorizontal: 20, paddingTop: 20 },
  consentHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10 },
  consentTitle: { fontSize: 11, fontWeight: '900', letterSpacing: 1.5 },
  consentTxt: { fontSize: 13, lineHeight: 20, fontWeight: '500' },

  label: { fontSize: 11, fontWeight: '800', letterSpacing: 1.2, marginBottom: 10, textTransform: 'uppercase' },

  inputWrap: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    borderRadius: 12, borderWidth: 1, paddingHorizontal: 16, paddingVertical: 14,
    marginBottom: 4,
  },
  input: { flex: 1, fontSize: 16, fontWeight: '600', padding: 0 },

  // Canvas
  canvasWrap: {
    borderRadius: 16, borderWidth: 1,
    overflow: 'hidden', height: 220,
    position: 'relative',
  },
  existingSigBg: {
    flex: 1,
    justifyContent: 'center', alignItems: 'center',
  },
  canvasHint: {
    position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
    justifyContent: 'center', alignItems: 'center', gap: 8,
    pointerEvents: 'none',
  },
  canvasHintTxt: {
    fontSize: 14, fontWeight: '600',
    letterSpacing: 0.5,
  },

  hint: { fontSize: 12, textAlign: 'center', marginTop: 10, fontWeight: '600', letterSpacing: 0.2 },


  capturedTxt: { fontSize: 13, fontWeight: '700', flex: 1 },

  // Footer
  footer: {
    paddingHorizontal: 20,
    paddingTop: 16,
    borderTopWidth: 1,
  },

  errorTxt: { fontSize: 13, fontWeight: '700', flex: 1 },

  legalNote: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    borderRadius: 14, paddingHorizontal: 14, paddingVertical: 12,
    marginBottom: 14, borderWidth: 1,
  },
  legalTxt: { flex: 1, fontSize: 11, lineHeight: 16, fontWeight: '600' },
});
