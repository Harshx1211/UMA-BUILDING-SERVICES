// app/(app)/jobs/[id]/signature.tsx
// Fixed: signature canvas scroll conflict, sign detection improved,
// existing signature image shown in read-only view, captured sig shown in success overlay
import React, { useRef, useState } from 'react';
import {
  View, StyleSheet, TouchableOpacity, Alert,
  Platform, ScrollView, Image,
} from 'react-native';
import { Text } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import SignatureCanvas, { SignatureViewRef } from 'react-native-signature-canvas';
import Toast from 'react-native-toast-message';
import { getValidLocalUri } from '@/utils/fileHelpers';
import Animated, { FadeIn, ZoomIn, FadeInDown } from 'react-native-reanimated';

import { useColors } from '@/hooks/useColors';
import { Card, Input, ScreenHeader } from '@/components/ui';
import { upsertRecord, addToSyncQueue, getRecord, queryRecords } from '@/lib/database';
import { SyncOperation } from '@/constants/Enums';
import { supabase } from '@/lib/supabase';
import { generateUUID } from '@/utils/uuid';


export default function SignatureScreen() {
  const C = useColors();
  const { id: jobId } = useLocalSearchParams<{ id: string }>();
  const sigRef = useRef<SignatureViewRef>(null);



  const [clientName, setClientName] = useState('');
  const [nameError,  setNameError]  = useState(false);
  const [hasSig,     setHasSig]     = useState(false);
  const [isSaving,   setIsSaving]   = useState(false);
  const [showSuccess,setShowSuccess] = useState(false);
  const [quoteTotal, setQuoteTotal]  = useState<number | null>(null);
  // Stores the captured signature data URI so we can preview it in the success overlay
  const [capturedSigUri, setCapturedSigUri] = useState<string | null>(null);

  // FLOW-7: tracks an existing signature — full record including signature_url for image preview
  const [existingSig, setExistingSig] = useState<{
    signed_by_name: string;
    signed_at: string;
    signature_url: string;
  } | null>(null);

  React.useEffect(() => {
    if (!jobId) return;
    try {
      const job = getRecord<{ site_contact_name: string | null }>('jobs', jobId);
      if (job?.site_contact_name) setClientName(job.site_contact_name);
      const quotes = queryRecords<{ total_amount: number; status: string }>('quotes', { job_id: jobId });
      if (quotes.length > 0 && quotes[0].status === 'approved') {
        setQuoteTotal(quotes[0].total_amount);
      }
      // FLOW-7 FIX: Check for existing signature — show readonly state with image if already captured
      const sigs = queryRecords<{ signed_by_name: string; signed_at: string; signature_url: string }>(
        'signatures', { job_id: jobId }
      );
      if (sigs.length > 0) setExistingSig(sigs[0]);
    } catch { /* ignore */ }
  }, [jobId]);

  const handleClear = () => {
    sigRef.current?.clearSignature();
    setHasSig(false);
    setCapturedSigUri(null);
  };

  const handleConfirm = () => {
    if (!clientName.trim()) {
      setNameError(true);
      Toast.show({ type: 'error', text1: 'Name Required', text2: 'Enter the client\'s full name first.' });
      return;
    }
    if (!hasSig) {
      Alert.alert('Signature Required', 'Please ask the client to sign in the box below before confirming.');
      return;
    }
    sigRef.current?.readSignature();
  };

  const handleSignature = async (base64: string) => {
    if (!jobId) return;
    setIsSaving(true);
    try {
      const signatureDataUri = base64.startsWith('data:')
        ? base64
        : `data:image/png;base64,${base64}`;

      // Store locally for preview in success overlay
      setCapturedSigUri(signatureDataUri);

      let signatureUrl = signatureDataUri;

      try {
        const pureB64   = signatureDataUri.split(',')[1];
        const byteChars = atob(pureB64);
        const byteArr   = new Uint8Array(byteChars.length);
        for (let i = 0; i < byteChars.length; i++) byteArr[i] = byteChars.charCodeAt(i);
        const storagePath = `signatures/${jobId}/signature.png`;
        const { error: uploadErr } = await supabase.storage
          .from('job-photos')
          .upload(storagePath, byteArr, { contentType: 'image/png', upsert: true });
        if (!uploadErr) {
          const { data: { publicUrl } } = supabase.storage.from('job-photos').getPublicUrl(storagePath);
          signatureUrl = publicUrl;
        }
      } catch (up) {
        console.warn('[Signature] Upload failed — using data URI:', up);
      }

      const sigId   = generateUUID();
      const now     = new Date().toISOString();
      const payload = {
        id: sigId, job_id: jobId,
        signature_url: signatureUrl,
        signed_by_name: clientName.trim(),
        signed_at: now,
      };
      upsertRecord('signatures', payload); // FLOW-3 FIX: upsert prevents UNIQUE constraint crash on re-sign
      addToSyncQueue('signatures', sigId, SyncOperation.Insert, payload);

      setShowSuccess(true);
      Toast.show({ type: 'success', text1: '✅ Signature Saved', text2: `Signed by ${clientName.trim()}` });
      setTimeout(() => { router.back(); }, 2800);
    } catch (err: any) {
      console.error('[Signature] Save error:', err);
      Alert.alert('Error', 'Failed to save signature.\n' + String(err?.message ?? err));
    } finally {
      setIsSaving(false);
    }
  };

  const handleEmpty = () => {
    Alert.alert('Canvas is Empty', 'Please ask the client to sign before confirming.');
  };

  // ── Inline webStyle injected into the WebView ──────────────
  const webStyle = `
    * { box-sizing: border-box; }
    body {
      margin: 0; padding: 0;
      background: transparent;
      overflow: hidden;
      touch-action: none;
      user-select: none;
      -webkit-user-select: none;
    }
    .m-signature-pad {
      box-shadow: none;
      border: none;
      margin: 0;
      padding: 0;
      position: absolute;
      inset: 0;
    }
    .m-signature-pad--body {
      position: absolute;
      inset: 0;
      border: none;
      border-radius: 0;
      background: transparent;
    }
    .m-signature-pad--footer { display: none !important; }
    canvas { width: 100% !important; height: 100% !important; }
  `;

  // ── EXISTING SIGNATURE — read-only, professional view ──────
  if (existingSig) {
    const isDataUri = existingSig.signature_url?.startsWith('data:') || existingSig.signature_url?.startsWith('http');
    return (
      <View style={[s.screen, { backgroundColor: C.background }]}>
        <ScreenHeader
          eyebrow="JOB REQUIREMENTS"
          title="Client Sign-Off"
          subtitle="Capture official client signature"
          showBack={true}
          curved={false}
        />
        <ScrollView contentContainerStyle={s.existingScroll} showsVerticalScrollIndicator={false}>
          <Animated.View entering={FadeInDown.duration(400)} style={[s.existingCard, { backgroundColor: C.surface, borderColor: C.success + '40', shadowColor: C.success }]}>
            {/* Checkmark badge */}
            <View style={[s.existingBadge, { backgroundColor: C.successLight }]}>
              <MaterialCommunityIcons name="check-decagram" size={36} color={C.success} />
            </View>

            <Text style={[s.existingTitle, { color: C.text }]}>Signature Captured</Text>
            <Text style={[s.existingSub, { color: C.textSecondary }]}>
              Signed by{' '}<Text style={{ fontWeight: '800', color: C.text }}>{existingSig.signed_by_name}</Text>
            </Text>
            <Text style={[s.existingDate, { color: C.textTertiary }]}>
              {new Date(existingSig.signed_at).toLocaleString('en-AU', {
                day: 'numeric', month: 'short', year: 'numeric',
                hour: '2-digit', minute: '2-digit',
              })}
            </Text>

            {/* Actual signature image preview */}
            {isDataUri && (
              <View style={[s.sigPreviewBox, { backgroundColor: C.backgroundTertiary, borderColor: C.border }]}>
                <Image
                  source={{ uri: getValidLocalUri(existingSig.signature_url) }}
                  style={s.sigPreviewImg}
                  resizeMode="contain"
                />
                <View style={[s.sigPreviewLabel, { backgroundColor: C.surface, borderColor: C.border }]}>
                  <MaterialCommunityIcons name="draw" size={11} color={C.textTertiary} />
                  <Text style={[s.sigPreviewLabelTxt, { color: C.textTertiary }]}>Client Signature</Text>
                </View>
              </View>
            )}
          </Animated.View>

          {/* Actions */}
          <Animated.View entering={FadeInDown.delay(120).duration(400)} style={s.existingActions}>
            <TouchableOpacity
              style={[s.existingBtn, { backgroundColor: C.backgroundTertiary, borderWidth: 1.5, borderColor: C.border }]}
              onPress={() => setExistingSig(null)}
              activeOpacity={0.8}
            >
              <MaterialCommunityIcons name="lead-pencil" size={18} color={C.primary} />
              <Text style={[s.existingBtnTxt, { color: C.primary }]}>Re-sign (override existing)</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[s.existingBtn, { backgroundColor: C.primary }]}
              onPress={() => router.back()}
              activeOpacity={0.85}
            >
              <MaterialCommunityIcons name="check" size={18} color="#FFF" />
              <Text style={[s.existingBtnTxt, { color: '#FFF' }]}>Done</Text>
            </TouchableOpacity>
          </Animated.View>
        </ScrollView>
      </View>
    );
  }

  return (
    <View style={[s.screen, { backgroundColor: C.background }]}>
      <ScreenHeader
        eyebrow="JOB REQUIREMENTS"
        title="Client Sign-Off"
        subtitle="Capture official client signature"
        showBack={true}
        curved={false}
      />

      {/* Use ScrollView only ABOVE the canvas — canvas must NOT be inside a scrollable */}
      <ScrollView
        contentContainerStyle={s.scroll}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        scrollEnabled={!hasSig}
      >
        {/* ── Instruction card ────────────────────── */}
        <Card style={s.infoCard}>
          <MaterialCommunityIcons name="hand-pointing-right" size={20} color={C.accent} />
          <View style={{ flex: 1 }}>
            <Text style={[s.infoTitle, { color: C.text }]}>Hand device to client</Text>
            <Text style={[s.infoBody, { color: C.textSecondary }]}>
              Ask the client to sign in the box below to confirm the inspection was completed to their satisfaction.
            </Text>
          </View>
        </Card>

        {/* ── Quote summary if applicable ──────────────── */}
        {quoteTotal !== null && (
          <View style={[s.quoteBanner, { backgroundColor: C.successLight, borderColor: C.success }]}>
            <MaterialCommunityIcons name="currency-usd" size={18} color={C.success} />
            <View style={{ flex: 1 }}>
              <Text style={[s.quoteTitle, { color: C.successDark }]}>Approved Quote Total</Text>
              <Text style={[s.quoteAmount, { color: C.success }]}>${quoteTotal.toFixed(2)} (to be invoiced)</Text>
            </View>
          </View>
        )}

        {/* ── Client name input ────────────────────────── */}
        <View style={s.fieldGroup}>
          <Input
            label="Client Full Name *"
            placeholder="e.g. John Smith"
            value={clientName}
            onChangeText={(v) => { setClientName(v); setNameError(false); }}
            autoCapitalize="words"
            error={nameError ? 'Full name is required before confirming' : undefined}
          />
        </View>

        {/* ── Signature label ──────────────────────────── */}
        <View style={s.sigLabelRow}>
          <Text style={[s.sigLabel, { color: C.text }]}>Signature *</Text>
          {hasSig && (
            <TouchableOpacity
              style={[s.clearBtn, { backgroundColor: C.backgroundTertiary, borderColor: C.border }]}
              onPress={handleClear}
            >
              <MaterialCommunityIcons name="eraser" size={13} color={C.textSecondary} />
              <Text style={[s.clearBtnTxt, { color: C.textSecondary }]}>Clear</Text>
            </TouchableOpacity>
          )}
        </View>
      </ScrollView>

      {/* ── SIGNATURE BOX — rendered OUTSIDE ScrollView to prevent touch hijacking ── */}
      <View style={[s.sigBox, {
        backgroundColor: C.surface,
        borderColor: hasSig ? C.success : C.border,
        borderWidth: hasSig ? 2.5 : 1.5,
        shadowColor: hasSig ? C.success : C.primary,
      }]}>
        <SignatureCanvas
          ref={sigRef}
          onOK={handleSignature}
          onEmpty={handleEmpty}
          onBegin={() => setHasSig(true)}
          webStyle={webStyle}
          backgroundColor="transparent"
          imageType="image/png"
          dataURL="image/png"
          descriptionText=""
          clearText=""
          confirmText=""
          style={s.sigCanvas}
          scrollable={false}
        />
        {/* Placeholder overlay — shown only when no signature yet */}
        {!hasSig && (
          <View style={s.sigPlaceholder} pointerEvents="none">
            <MaterialCommunityIcons name="gesture" size={32} color={C.border} />
            <Text style={[s.sigPlaceholderTxt, { color: C.textTertiary }]}>Sign here</Text>
            <Text style={[s.sigPlaceholderHint, { color: C.border }]}>Draw your signature in this area</Text>
          </View>
        )}
        {/* Status corner pill */}
        <View style={[s.sigCornerLabel, {
          backgroundColor: hasSig ? C.success : C.backgroundTertiary,
          borderColor: hasSig ? C.success + '80' : C.border,
        }]}>
          <MaterialCommunityIcons
            name={hasSig ? 'check-circle' : 'draw'}
            size={12}
            color={hasSig ? '#FFF' : C.textTertiary}
          />
          <Text style={[s.sigCornerTxt, { color: hasSig ? '#FFF' : C.textTertiary }]}>
            {hasSig ? 'Signed ✓' : 'Touch to sign'}
          </Text>
        </View>
      </View>

      {/* ── BOTTOM ACTION BAR ─────────────────────────── */}
      <View style={[s.bottomBar, { backgroundColor: C.surface, borderTopColor: C.border }]}>
        {hasSig && (
          <TouchableOpacity
            style={[s.clearBtnLarge, { backgroundColor: C.backgroundTertiary, borderColor: C.border }]}
            onPress={handleClear}
          >
            <MaterialCommunityIcons name="eraser" size={16} color={C.textSecondary} />
            <Text style={[s.clearBtnLargeTxt, { color: C.textSecondary }]}>Clear</Text>
          </TouchableOpacity>
        )}
        <TouchableOpacity
          style={[
            s.confirmBtn,
            {
              backgroundColor: (hasSig && clientName.trim()) ? C.success : C.backgroundTertiary,
              flex: hasSig ? 2 : 1,
              borderWidth: (hasSig && clientName.trim()) ? 0 : 1.5,
              borderColor: C.border,
            },
          ]}
          onPress={handleConfirm}
          disabled={isSaving}
          activeOpacity={0.85}
        >
          {isSaving ? (
            <Text style={[s.confirmBtnTxt, { color: '#FFF' }]}>Saving…</Text>
          ) : (
            <>
              <MaterialCommunityIcons
                name={hasSig && clientName.trim() ? 'check-decagram' : 'pen-off'}
                size={20}
                color={(hasSig && clientName.trim()) ? '#FFF' : C.textTertiary}
              />
              <Text style={[s.confirmBtnTxt, {
                color: (hasSig && clientName.trim()) ? '#FFF' : C.textTertiary,
              }]}>
                {!clientName.trim() ? 'Enter Name Above' : !hasSig ? 'Awaiting Signature…' : 'Confirm & Save'}
              </Text>
            </>
          )}
        </TouchableOpacity>
      </View>

      {/* ── SUCCESS OVERLAY ──────────────────────────── */}
      {showSuccess && (
        <Animated.View entering={FadeIn.duration(250)} style={[StyleSheet.absoluteFill, s.successOverlay]}>
          <TouchableOpacity
            style={StyleSheet.absoluteFill}
            onPress={() => { setShowSuccess(false); router.back(); }}
            activeOpacity={1}
          />
          <Animated.View entering={ZoomIn.springify().damping(14).delay(150)} style={[s.successCard, { backgroundColor: C.surface }]}>
            {/* Top accent bar */}
            <View style={[s.successAccentBar, { backgroundColor: C.success }]} />

            <View style={[s.successCircle, { backgroundColor: C.successLight }]}>
              <MaterialCommunityIcons name="check-decagram" size={44} color={C.success} />
            </View>

            <Text style={[s.successTitle, { color: C.text }]}>Signature Saved!</Text>
            <Text style={[s.successSub, { color: C.textSecondary }]}>
              Signed by <Text style={{ fontWeight: '800', color: C.text }}>{clientName}</Text>
            </Text>

            {/* Show the actual captured signature image */}
            {capturedSigUri && (
              <View style={[s.successSigBox, { backgroundColor: C.backgroundTertiary, borderColor: C.border }]}>
                <Image
                  source={{ uri: getValidLocalUri(capturedSigUri) }}
                  style={s.successSigImg}
                  resizeMode="contain"
                />
              </View>
            )}

            <View style={[s.successDivider, { backgroundColor: C.border }]} />
            <View style={s.successHintRow}>
              <MaterialCommunityIcons name="gesture-tap" size={14} color={C.textTertiary} />
              <Text style={[s.successHint, { color: C.textTertiary }]}>Tap anywhere to continue</Text>
            </View>
          </Animated.View>
        </Animated.View>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  screen: { flex: 1 },
  scroll: { padding: 16, paddingBottom: 8 },

  // Info card
  infoCard:  { flexDirection: 'row', alignItems: 'flex-start', gap: 12, marginBottom: 16 },
  infoTitle: { fontSize: 14, fontWeight: '700', marginBottom: 4 },
  infoBody:  { fontSize: 13, lineHeight: 20 },

  // Quote banner
  quoteBanner: { flexDirection: 'row', alignItems: 'center', gap: 14, padding: 18, borderRadius: 16, borderWidth: 1, marginBottom: 16 },
  quoteTitle:  { fontSize: 13, fontWeight: '800', marginBottom: 2 },
  quoteAmount: { fontSize: 18, fontWeight: '800' },

  fieldGroup: { marginBottom: 14 },

  // Sig label row
  sigLabelRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  sigLabel:    { fontSize: 13, fontWeight: '700', letterSpacing: 0.1 },
  clearBtn:    { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 10, borderWidth: 1 },
  clearBtnTxt: { fontSize: 12, fontWeight: '600' },

  // Signature box — OUTSIDE scrollview
  sigBox: {
    marginHorizontal: 16,
    height: 220,
    borderRadius: 16,
    overflow: 'hidden',
    position: 'relative',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 6,
  },
  sigCanvas: { flex: 1 },
  sigPlaceholder: {
    position: 'absolute', inset: 0,
    alignItems: 'center', justifyContent: 'center', gap: 8,
    pointerEvents: 'none',
  } as any,
  sigPlaceholderTxt:  { fontSize: 18, fontWeight: '700' },
  sigPlaceholderHint: { fontSize: 12 },
  sigCornerLabel: {
    position: 'absolute', top: 10, right: 10,
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12,
    borderWidth: 1,
  },
  sigCornerTxt: { fontSize: 11, fontWeight: '700' },

  // Bottom bar
  bottomBar: {
    flexDirection: 'row', gap: 10,
    padding: 16,
    paddingBottom: Platform.OS === 'ios' ? 32 : 16,
    borderTopWidth: 1,
  },
  clearBtnLarge:    { flex: 1, height: 56, borderRadius: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, borderWidth: 1.5 },
  clearBtnLargeTxt: { fontSize: 15, fontWeight: '800' },
  confirmBtn:       { height: 56, borderRadius: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  confirmBtnTxt:    { fontSize: 16, fontWeight: '800' },

  // ── EXISTING SIG READ-ONLY VIEW ──────────────────────────
  existingScroll: { padding: 20, paddingBottom: 40, gap: 16 },
  existingCard: {
    borderRadius: 16, padding: 24,
    alignItems: 'center', gap: 12,
    borderWidth: 1.5,
    shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.1, shadowRadius: 16, elevation: 6,
  },
  existingBadge:  { width: 72, height: 72, borderRadius: 36, alignItems: 'center', justifyContent: 'center', marginBottom: 4 },
  existingTitle:  { fontSize: 22, fontWeight: '800', letterSpacing: -0.3 },
  existingSub:    { fontSize: 15, textAlign: 'center' },
  existingDate:   { fontSize: 12, textAlign: 'center', marginTop: 2 },

  // Sig preview in read-only view
  sigPreviewBox: {
    width: '100%', borderRadius: 14, borderWidth: 1.5,
    overflow: 'hidden', marginTop: 8, position: 'relative',
  },
  sigPreviewImg: { width: '100%', height: 120 },
  sigPreviewLabel: {
    position: 'absolute', bottom: 8, right: 8,
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8, borderWidth: 1,
  },
  sigPreviewLabelTxt: { fontSize: 10, fontWeight: '600' },

  existingActions: { gap: 10 },
  existingBtn: { height: 54, borderRadius: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  existingBtnTxt: { fontSize: 15, fontWeight: '700' },

  // ── SUCCESS OVERLAY ──────────────────────────────────────
  successOverlay: { backgroundColor: 'rgba(0,0,0,0.72)', alignItems: 'center', justifyContent: 'center', padding: 24 },
  successCard:    {
    width: '100%', borderRadius: 28, overflow: 'hidden',
    alignItems: 'center', gap: 8,
    elevation: 14, shadowColor: '#000', shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.25, shadowRadius: 24,
  },
  successAccentBar: { width: '100%', height: 5 },
  successCircle:  { width: 80, height: 80, borderRadius: 40, alignItems: 'center', justifyContent: 'center', marginTop: 20, marginBottom: 4 },
  successTitle:   { fontSize: 24, fontWeight: '800', letterSpacing: -0.3, marginTop: 4 },
  successSub:     { fontSize: 14, marginBottom: 4 },

  // Signature image in success overlay
  successSigBox: {
    width: '85%', borderRadius: 14, borderWidth: 1.5,
    overflow: 'hidden', marginVertical: 8,
    height: 100,
  },
  successSigImg: { width: '100%', height: '100%' },

  successDivider: { height: 1, width: '70%', marginVertical: 8 },
  successHintRow: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingBottom: 24 },
  successHint:    { fontSize: 12 },
});
