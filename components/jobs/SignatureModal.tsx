import React, { useRef, useState } from 'react';
import { Modal, StyleSheet, TouchableOpacity, View, ActivityIndicator } from 'react-native';
import { Text } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import SignatureCanvas, { SignatureViewRef } from 'react-native-signature-canvas';
import Toast from 'react-native-toast-message';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useColors } from '@/hooks/useColors';
import { T } from '@/constants/Colors';

interface Props {
  visible: boolean;
  onClose: () => void;
  onSign: (signatureBase64: string) => Promise<void>;
  clientName?: string;
}

export function SignatureModal({ visible, onClose, onSign, clientName }: Props) {
  const C = useColors();
  const insets = useSafeAreaInsets();
  const sigRef = useRef<SignatureViewRef>(null);
  const [isSaving, setIsSaving] = useState(false);

  // WebView HTML style — canvas background must be a static string (not RN theme context)
  // Using CSS custom values that match T.backgroundSecondary and T.border
  const webStyle = `
    .m-signature-pad { box-shadow: none; border: 2px solid ${T.border}; border-radius: 12px; }
    .m-signature-pad--body { background-color: #FFFFFF; border-radius: 10px; }
    .m-signature-pad--footer { display: none; }
  `;

  const handleOK = async (signature: string) => {
    setIsSaving(true);
    try {
      await onSign(signature);
      onClose();
    } catch {
      Toast.show({ type: 'error', text1: 'Failed to save signature' });
    } finally {
      setIsSaving(false);
    }
  };

  const handleClear   = () => sigRef.current?.clearSignature();
  const handleConfirm = () => sigRef.current?.readSignature();

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={[s.overlay, { backgroundColor: C.overlay }]}>
        <View style={[s.sheet, { backgroundColor: C.surface, paddingBottom: 24 + insets.bottom }]}>
          <View style={s.header}>
            <View>
              <Text style={[s.title, { color: C.text }]}>Client Sign-off</Text>
              <Text style={[s.sub, { color: C.textSecondary }]}>Please sign to confirm job completion</Text>
            </View>
            <TouchableOpacity
              onPress={onClose}
              style={[s.closeBtn, { backgroundColor: C.backgroundTertiary }]}
            >
              <MaterialCommunityIcons name="close" size={24} color={C.textSecondary} />
            </TouchableOpacity>
          </View>

          {clientName ? (
            <View style={[s.contactBanner, { backgroundColor: C.backgroundSecondary }]}>
              <MaterialCommunityIcons name="account-tie" size={16} color={C.primary} />
              <Text style={[s.contactTxt, { color: C.text }]}>
                Signing as: <Text style={{ fontWeight: '700' }}>{clientName}</Text>
              </Text>
            </View>
          ) : null}

          <View style={s.canvasWrap}>
            <SignatureCanvas
              ref={sigRef}
              onOK={handleOK}
              webStyle={webStyle}
              backgroundColor="#FFFFFF"
              penColor={C.primary}
            />
          </View>

          <View style={s.actions}>
            <TouchableOpacity
              style={[s.clearBtn, { backgroundColor: C.backgroundTertiary }]}
              onPress={handleClear}
              disabled={isSaving}
            >
              <Text style={[s.clearTxt, { color: C.textSecondary }]}>Clear</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[s.okBtn, { backgroundColor: C.success }, isSaving && s.okBtnDisabled]}
              onPress={handleConfirm}
              disabled={isSaving}
            >
              {isSaving
                ? <ActivityIndicator color={C.textOnPrimary} size="small" />
                : <Text style={[s.okTxt, { color: C.textOnPrimary }]}>Save Signature</Text>
              }
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const s = StyleSheet.create({
  overlay: { flex: 1, justifyContent: 'flex-end' },
  sheet:   { borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, paddingBottom: 32 },
  header:  { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 },
  title:   { fontSize: 20, fontWeight: '800' },
  sub:     { fontSize: 13, marginTop: 2 },
  closeBtn:{ padding: 4, borderRadius: 20 },
  contactBanner: { flexDirection: 'row', alignItems: 'center', gap: 8, padding: 12, borderRadius: 8, marginBottom: 16 },
  contactTxt: { fontSize: 13 },
  canvasWrap: { height: 260, marginBottom: 20 },
  actions: { flexDirection: 'row', gap: 12 },
  clearBtn: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 16, borderRadius: 12 },
  clearTxt: { fontSize: 15, fontWeight: '700' },
  okBtn:    { flex: 2, alignItems: 'center', justifyContent: 'center', paddingVertical: 16, borderRadius: 12 },
  okBtnDisabled: { opacity: 0.7 },
  okTxt:    { fontSize: 15, fontWeight: '700' },
});
