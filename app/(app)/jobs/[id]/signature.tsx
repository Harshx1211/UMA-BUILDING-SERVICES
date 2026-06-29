import { useState, useRef } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  Alert, ScrollView, Platform, Dimensions,
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { WebView } from 'react-native-webview';
import { upsertRecord, addToSyncQueue } from '@/lib/database';
import { runSync } from '@/lib/sync';
import { C } from '@/constants/Config';
import { SyncOperation } from '@/constants/Enums';

const { width: SCREEN_W } = Dimensions.get('window');
const SIG_PAD_H = 220;

// Inline signature pad HTML — no external dependencies, works fully offline
const SIG_HTML = `
<!DOCTYPE html>
<html>
<head>
  <meta name="viewport" content="width=device-width,initial-scale=1,user-scalable=no">
  <style>
    * { margin:0; padding:0; box-sizing:border-box; }
    body { background:#182745; }
    canvas { display:block; touch-action:none; cursor:crosshair; }
  </style>
</head>
<body>
<canvas id="c"></canvas>
<script>
  const canvas = document.getElementById('c');
  const ctx = canvas.getContext('2d');
  let drawing = false;
  let hasMark = false;

  function resize() {
    const w = window.innerWidth;
    const h = window.innerHeight;
    const img = ctx.getImageData(0, 0, canvas.width, canvas.height);
    canvas.width = w;
    canvas.height = h;
    ctx.putImageData(img, 0, 0);
    ctx.strokeStyle = '#FFFFFF';
    ctx.lineWidth = 2;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
  }
  resize();
  window.addEventListener('resize', resize);

  function pos(e) {
    const r = canvas.getBoundingClientRect();
    const t = e.touches ? e.touches[0] : e;
    return { x: t.clientX - r.left, y: t.clientY - r.top };
  }

  canvas.addEventListener('pointerdown', e => { drawing = true; hasMark = true; const p = pos(e); ctx.beginPath(); ctx.moveTo(p.x, p.y); });
  canvas.addEventListener('pointermove', e => { if (!drawing) return; const p = pos(e); ctx.lineTo(p.x, p.y); ctx.stroke(); });
  canvas.addEventListener('pointerup',   () => { drawing = false; });

  window.clearSig = () => { ctx.clearRect(0, 0, canvas.width, canvas.height); hasMark = false; };
  window.getSig   = () => hasMark ? canvas.toDataURL('image/png') : null;
</script>
</body>
</html>
`;

export default function SignatureScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const insets = useSafeAreaInsets();
  const webRef = useRef<WebView>(null);

  const [signedBy, setSignedBy] = useState('');
  const [saving, setSaving]     = useState(false);
  const [sigError, setSigError] = useState('');

  const CONSENT_STATEMENT =
    'By signing below, I confirm that the inspection described in this report was completed ' +
    'on the property on the date shown, and that I have been given the opportunity to review ' +
    'the findings. This signature is legally binding under the Electronic Transactions Act 1999 (Cth).';

  function _clear() {
    webRef.current?.injectJavaScript('window.clearSig(); true;');
  }

  async function _save() {
    if (!signedBy.trim()) {
      setSigError('Please enter the name of the person signing.');
      return;
    }
    setSigError('');
    setSaving(true);

    // Get signature data URL from canvas
    webRef.current?.injectJavaScript(`
      window.ReactNativeWebView.postMessage(JSON.stringify({ sig: window.getSig() }));
      true;
    `);
  }

  async function _onMessage(event: { nativeEvent: { data: string } }) {
    try {
      const { sig } = JSON.parse(event.nativeEvent.data) as { sig: string | null };
      if (!sig) {
        setSigError('Please draw a signature before saving.');
        setSaving(false);
        return;
      }

      const deviceInfo = `${Platform.OS === 'ios' ? 'iOS' : 'Android'}`;
      const now = new Date().toISOString();
      const newId = `sig-${id}`;

      const record = {
        id: newId,
        job_id: id!,
        signature_url: sig,       // stored as base64 data URL for offline PDF rendering
        signed_by_name: signedBy.trim(),
        signed_at: now,
        device_info: deviceInfo,
      };

      upsertRecord('signatures', record as any);
      addToSyncQueue('signatures', newId, SyncOperation.Insert, record);

      void runSync();
      setSaving(false);
      Alert.alert('Signature Saved', 'The client signature has been recorded.', [
        { text: 'OK', onPress: () => router.back() },
      ]);
    } catch {
      setSaving(false);
      setSigError('Failed to capture signature. Please try again.');
    }
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Text style={styles.backText}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Client Signature</Text>
        <TouchableOpacity onPress={_clear} style={styles.clearBtn}>
          <Text style={styles.clearText}>Clear</Text>
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        {/* Consent statement */}
        <View style={styles.consentCard}>
          <Text style={styles.consentTitle}>CONSENT STATEMENT</Text>
          <Text style={styles.consentText}>{CONSENT_STATEMENT}</Text>
        </View>

        {/* Name field */}
        <View style={styles.fieldWrap}>
          <Text style={styles.label}>Full Name of Authorised Person *</Text>
          <TextInput
            style={[styles.input, sigError && !signedBy && styles.inputError]}
            placeholder="e.g. John Smith"
            placeholderTextColor={C.textMuted}
            value={signedBy}
            onChangeText={t => { setSignedBy(t); setSigError(''); }}
            autoCapitalize="words"
            returnKeyType="done"
          />
        </View>

        {/* Signature pad */}
        <View style={styles.padWrap}>
          <Text style={styles.label}>Signature *</Text>
          <View style={[styles.padBorder, sigError.includes('draw') && styles.padBorderError]}>
            <WebView
              ref={webRef}
              source={{ html: SIG_HTML }}
              style={{ width: SCREEN_W - 64, height: SIG_PAD_H, backgroundColor: C.surface }}
              scrollEnabled={false}
              onMessage={_onMessage}
              javaScriptEnabled
            />
          </View>
          <Text style={styles.padHint}>Draw signature above using your finger or stylus</Text>
        </View>

        {sigError ? <Text style={styles.error}>{sigError}</Text> : null}

        {/* Legal note */}
        <View style={styles.legalNote}>
          <Text style={styles.legalText}>
            🔒 This signature is captured in accordance with the{'\n'}
            Electronic Transactions Act 1999 (Cth){'\n'}
            Device: {Platform.OS === 'ios' ? 'iOS' : 'Android'}  •  {new Date().toLocaleDateString('en-AU')}
          </Text>
        </View>

        {/* Save button */}
        <TouchableOpacity
          style={[styles.saveBtn, saving && styles.saveBtnDisabled]}
          onPress={_save}
          disabled={saving}
          activeOpacity={0.85}
        >
          <Text style={styles.saveBtnText}>{saving ? 'Saving…' : 'Save Signature'}</Text>
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container:    { flex: 1, backgroundColor: C.primary },
  header:       {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingVertical: 12, backgroundColor: C.surface,
    borderBottomWidth: 1, borderBottomColor: C.border,
  },
  backBtn:      { paddingVertical: 4, paddingRight: 8 },
  backText:     { color: C.accent, fontSize: 14, fontWeight: '600' },
  title:        { color: C.textLight, fontSize: 17, fontWeight: '700', flex: 1, textAlign: 'center' },
  clearBtn:     { paddingVertical: 4, paddingLeft: 8 },
  clearText:    { color: C.danger, fontSize: 14, fontWeight: '600' },
  scroll:       { padding: 20, paddingBottom: 40 },
  consentCard:  {
    backgroundColor: 'rgba(37,99,235,0.08)', borderRadius: 14, borderWidth: 1,
    borderColor: 'rgba(37,99,235,0.3)', padding: 16, marginBottom: 20,
  },
  consentTitle: { color: C.info, fontSize: 10, fontWeight: '800', letterSpacing: 1.5, marginBottom: 8 },
  consentText:  { color: C.textBody, fontSize: 13, lineHeight: 20 },
  fieldWrap:    { marginBottom: 20 },
  label:        { color: C.textMuted, fontSize: 12, fontWeight: '600', marginBottom: 8, letterSpacing: 0.5 },
  input:        {
    backgroundColor: C.surface, borderRadius: 12, borderWidth: 1,
    borderColor: C.border, color: C.textLight, fontSize: 15,
    paddingHorizontal: 16, paddingVertical: 14,
  },
  inputError:   { borderColor: C.danger },
  padWrap:      { marginBottom: 16 },
  padBorder:    {
    borderRadius: 14, borderWidth: 1.5, borderColor: C.border,
    overflow: 'hidden', backgroundColor: C.surface,
  },
  padBorderError: { borderColor: C.danger },
  padHint:      { color: C.textMuted, fontSize: 11, textAlign: 'center', marginTop: 8 },
  error:        { color: '#FCA5A5', fontSize: 13, marginBottom: 12 },
  legalNote:    {
    backgroundColor: C.primaryLight, borderRadius: 12, padding: 14, marginBottom: 20,
    borderWidth: 1, borderColor: C.border,
  },
  legalText:    { color: C.textMuted, fontSize: 11, lineHeight: 18, textAlign: 'center' },
  saveBtn:      {
    backgroundColor: C.accent, borderRadius: 14, paddingVertical: 16,
    alignItems: 'center', shadowColor: C.accent, shadowOpacity: 0.4, shadowRadius: 10, elevation: 6,
  },
  saveBtnDisabled: { opacity: 0.6 },
  saveBtnText:  { color: '#fff', fontSize: 16, fontWeight: '700' },
});
