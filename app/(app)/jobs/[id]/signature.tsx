// app/(app)/jobs/[id]/signature.tsx — Fixed: signature canvas scroll conflict resolved,
// sign detection improved, and full-screen landscape-friendly layout
import React, { useRef, useState, useCallback } from 'react';
import {
  View, StyleSheet, TouchableOpacity, Alert,
  Platform, ScrollView,
} from 'react-native';
import { Text } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { router, useLocalSearchParams, useFocusEffect } from 'expo-router';
import { useNavigation } from '@react-navigation/native';
import SignatureCanvas, { SignatureViewRef } from 'react-native-signature-canvas';
import Toast from 'react-native-toast-message';
import Animated, { FadeIn, ZoomIn } from 'react-native-reanimated';

import { useColors } from '@/hooks/useColors';
import { Card, Input, Button, ScreenHeader } from '@/components/ui';
import { upsertRecord, addToSyncQueue, getRecord, queryRecords } from '@/lib/database';
import { SyncOperation } from '@/constants/Enums';
import { supabase } from '@/lib/supabase';
import { generateUUID } from '@/utils/uuid';


export default function SignatureScreen() {
  const C = useColors();
  const navigation = useNavigation();
  const { id: jobId } = useLocalSearchParams<{ id: string }>();
  const sigRef = useRef<SignatureViewRef>(null);

  useFocusEffect(useCallback(() => {
    navigation.getParent()?.setOptions({ tabBarStyle: { display: 'none' } });
    return () => navigation.getParent()?.setOptions({ tabBarStyle: undefined });
  }, [navigation]));

  const [clientName, setClientName] = useState('');
  const [nameError,  setNameError]  = useState(false);
  const [hasSig,     setHasSig]     = useState(false);
  const [isSaving,   setIsSaving]   = useState(false);
  const [showSuccess,setShowSuccess] = useState(false);
  const [quoteTotal, setQuoteTotal]  = useState<number | null>(null);
  // FLOW-7: tracks an existing signature so we can show read-only state on re-entry
  const [existingSig, setExistingSig] = useState<{ signed_by_name: string; signed_at: string } | null>(null);

  React.useEffect(() => {
    if (!jobId) return;
    try {
      const job = getRecord<{ site_contact_name: string | null }>('jobs', jobId);
      if (job?.site_contact_name) setClientName(job.site_contact_name);
      const quotes = queryRecords<{ total_amount: number; status: string }>('quotes', { job_id: jobId });
      if (quotes.length > 0 && quotes[0].status === 'approved') {
        setQuoteTotal(quotes[0].total_amount);
      }
      // FLOW-7 FIX: Check for existing signature — show readonly state if already captured
      const sigs = queryRecords<{ signed_by_name: string; signed_at: string }>('signatures', { job_id: jobId });
      if (sigs.length > 0) setExistingSig(sigs[0]);
    } catch { /* ignore */ }
  }, [jobId]);

  const handleClear = () => {
    sigRef.current?.clearSignature();
    setHasSig(false);
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
      setTimeout(() => { router.back(); }, 1800);
    } catch (err: any) {
      console.error('[Signature] Save error:', err);
      Alert.alert('Error', 'Failed to save signature.\n' + String(err?.message ?? err));
    } finally {
      setIsSaving(false);
    }
  };

  const handleEmpty = () => {
    // Called by SignatureCanvas when readSignature() is called on an empty pad
    Alert.alert('Canvas is Empty', 'Please ask the client to sign before confirming.');
  };

  // ── Inline webStyle injected into the WebView ──────────────
  // KEY FIX: `touch-action: none` on body prevents the native scroll
  // from stealing touch events from the drawing canvas.
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

  return (
    <View style={[s.screen, { backgroundColor: C.background }]}>
      <ScreenHeader
        eyebrow="JOB REQUIREMENTS"
        title="Client Sign-Off"
        subtitle="Capture official client signature"
        showBack={true}
        curved={false}
      />

      {/* FLOW-7 FIX: Already-signed read-only view */}
      {existingSig ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32, gap: 16 }}>
          <View style={[s.successCircle, { backgroundColor: C.successLight }]}>
            <MaterialCommunityIcons name="check-decagram" size={52} color={C.success} />
          </View>
          <Text style={{ fontSize: 22, fontWeight: '800', color: C.text }}>Signature Captured</Text>
          <Text style={{ fontSize: 15, color: C.textSecondary, textAlign: 'center' }}>
            Signed by <Text style={{ fontWeight: '700' }}>{existingSig.signed_by_name}</Text>
          </Text>
          <Text style={{ fontSize: 13, color: C.textTertiary }}>
            {new Date(existingSig.signed_at).toLocaleString('en-AU', {
              day: 'numeric', month: 'short', year: 'numeric',
              hour: '2-digit', minute: '2-digit',
            })}
          </Text>
          <View style={{ gap: 10, width: '100%', marginTop: 8 }}>
            <TouchableOpacity
              style={[s.confirmBtn, { backgroundColor: C.backgroundTertiary, borderWidth: 1, borderColor: C.border }]}
              onPress={() => setExistingSig(null)}
              activeOpacity={0.8}
            >
              <MaterialCommunityIcons name="lead-pencil" size={18} color={C.primary} />
              <Text style={[s.confirmBtnTxt, { color: C.primary }]}>Re-sign (override)</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[s.confirmBtn, { backgroundColor: C.primary }]}
              onPress={() => router.back()}
              activeOpacity={0.85}
            >
              <Text style={[s.confirmBtnTxt, { color: '#FFF' }]}>Done</Text>
            </TouchableOpacity>
          </View>
        </View>
      ) : (
        <>
      {/* Use ScrollView only ABOVE the canvas — canvas must NOT be inside a scrollable */}
      <ScrollView
        contentContainerStyle={s.scroll}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        // Disable scroll while signing via scrollEnabled — controlled below
        scrollEnabled={!hasSig}
      >
        {/* ── Instruction card ────────────────────────── */}
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
      <View style={[s.sigBox, { backgroundColor: C.surface, borderColor: hasSig ? C.primary : C.border }]}>
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
          // Prevent scroll from blocking drawing
          scrollable={false}
        />
        {/* Placeholder overlay — shown only when no signature yet */}
        {!hasSig && (
          <View style={s.sigPlaceholder} pointerEvents="none">
            <MaterialCommunityIcons name="gesture" size={30} color={C.border} />
            <Text style={[s.sigPlaceholderTxt, { color: C.textTertiary }]}>Sign here</Text>
            <Text style={[s.sigPlaceholderHint, { color: C.border }]}>Draw your signature in this area</Text>
          </View>
        )}
        {/* Top corner label */}
        <View style={[s.sigCornerLabel, { backgroundColor: hasSig ? C.primary : C.backgroundTertiary }]}>
          <MaterialCommunityIcons
            name={hasSig ? 'check-circle' : 'draw'}
            size={12}
            color={hasSig ? '#FFF' : C.textTertiary}
          />
          <Text style={[s.sigCornerTxt, { color: hasSig ? '#FFF' : C.textTertiary }]}>
            {hasSig ? 'Signed' : 'Touch to sign'}
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
                name="check-decagram"
                size={20}
                color={(hasSig && clientName.trim()) ? '#FFF' : C.textTertiary}
              />
              <Text style={[s.confirmBtnTxt, {
                color: (hasSig && clientName.trim()) ? '#FFF' : C.textTertiary,
              }]}>
                {!clientName.trim() ? 'Enter Name Above' : !hasSig ? 'Awaiting Signature…' : 'Confirm & Save Signature'}
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
          <Animated.View entering={ZoomIn.springify().damping(12).delay(150)} style={[s.successCard, { backgroundColor: C.surface }]}>
            <View style={[s.successCircle, { backgroundColor: C.successLight }]}>
              <MaterialCommunityIcons name="check-decagram" size={52} color={C.success} />
            </View>
            <Text style={[s.successTitle, { color: C.text }]}>Signature Saved!</Text>
            <Text style={[s.successSub, { color: C.textSecondary }]}>Signed by {clientName}</Text>
            <View style={[s.successDivider, { backgroundColor: C.border }]} />
            <Text style={[s.successHint, { color: C.textTertiary }]}>Tap anywhere to continue →</Text>
          </Animated.View>
        </Animated.View>
      )}
      </>
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
  quoteBanner: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, borderRadius: 14, borderWidth: 1, marginBottom: 16 },
  quoteTitle:  { fontSize: 12, fontWeight: '700', marginBottom: 2 },
  quoteAmount: { fontSize: 16, fontWeight: '800' },

  fieldGroup: { marginBottom: 14 },

  // Sig label row
  sigLabelRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 0, marginBottom: 8 },
  sigLabel:    { fontSize: 13, fontWeight: '700', letterSpacing: 0.1 },
  clearBtn:    { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 10, borderWidth: 1 },
  clearBtnTxt: { fontSize: 12, fontWeight: '600' },

  // Signature box — OUTSIDE scrollview
  sigBox: {
    marginHorizontal: 16,
    height: 220,
    borderRadius: 16,
    borderWidth: 2,
    overflow: 'hidden',
    position: 'relative',
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
  },
  sigCornerTxt: { fontSize: 11, fontWeight: '700' },

  // Bottom bar
  bottomBar: {
    flexDirection: 'row', gap: 10,
    padding: 16,
    paddingBottom: Platform.OS === 'ios' ? 32 : 16,
    borderTopWidth: 1,
  },
  clearBtnLarge:    { flex: 1, height: 54, borderRadius: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, borderWidth: 1.5 },
  clearBtnLargeTxt: { fontSize: 14, fontWeight: '700' },
  confirmBtn:       { height: 54, borderRadius: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  confirmBtnTxt:    { fontSize: 15, fontWeight: '800' },

  // Success overlay
  successOverlay: { backgroundColor: 'rgba(0,0,0,0.65)', alignItems: 'center', justifyContent: 'center', padding: 32 },
  successCard:    { width: '100%', padding: 32, borderRadius: 24, alignItems: 'center', gap: 8, elevation: 12, shadowColor: '#000', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.2, shadowRadius: 20 },
  successCircle:  { width: 90, height: 90, borderRadius: 45, alignItems: 'center', justifyContent: 'center', marginBottom: 8 },
  successTitle:   { fontSize: 24, fontWeight: '800', marginTop: 4 },
  successSub:     { fontSize: 14, marginBottom: 4 },
  successDivider: { height: 1, width: '60%', marginVertical: 8 },
  successHint:    { fontSize: 12 },
});
