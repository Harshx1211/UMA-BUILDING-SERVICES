import React, { useRef, useState } from 'react';
import { Modal, StyleSheet, TouchableOpacity, View, ActivityIndicator } from 'react-native';
import { Text } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import SignatureCanvas, { SignatureViewRef } from 'react-native-signature-canvas';
import Toast from 'react-native-toast-message';

const NAVY = '#0E2141', WHITE = '#FFFFFF', SUCCESS = '#15803D';

interface Props {
  visible: boolean;
  onClose: () => void;
  onSign: (signatureBase64: string) => Promise<void>;
  clientName?: string;
}

export function SignatureModal({ visible, onClose, onSign, clientName }: Props) {
  const sigRef = useRef<SignatureViewRef>(null);
  const [isSaving, setIsSaving] = useState(false);

  // The HTML for the webview that SignatureCanvas uses
  const webStyle = `
    .m-signature-pad { box-shadow: none; border: 2px solid #E4E8EF; border-radius: 12px; }
    .m-signature-pad--body { background-color: #F8FAFC; border-radius: 10px; }
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

  const handleClear = () => {
    sigRef.current?.clearSignature();
  };

  const handleConfirm = () => {
    sigRef.current?.readSignature();
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={s.overlay}>
        <View style={s.sheet}>
          <View style={s.header}>
            <View>
              <Text style={s.title}>Client Sign-off</Text>
              <Text style={s.sub}>Please sign to confirm job completion</Text>
            </View>
            <TouchableOpacity onPress={onClose} style={s.closeBtn}>
              <MaterialCommunityIcons name="close" size={24} color="#8896A8" />
            </TouchableOpacity>
          </View>

          {clientName ? (
            <View style={s.contactBanner}>
              <MaterialCommunityIcons name="account-tie" size={16} color={NAVY} />
              <Text style={s.contactTxt}>Signing as: <Text style={{ fontWeight: '700' }}>{clientName}</Text></Text>
            </View>
          ) : null}

          <View style={s.canvasWrap}>
            <SignatureCanvas
              ref={sigRef}
              onOK={handleOK}
              webStyle={webStyle}
              backgroundColor="#F8FAFC"
              penColor={NAVY}
            />
          </View>

          <View style={s.actions}>
            <TouchableOpacity style={s.clearBtn} onPress={handleClear} disabled={isSaving}>
              <Text style={s.clearTxt}>Clear</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[s.okBtn, isSaving && s.okBtnDisabled]} onPress={handleConfirm} disabled={isSaving}>
              {isSaving ? <ActivityIndicator color={WHITE} size="small" /> : <Text style={s.okTxt}>Save Signature</Text>}
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const s = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'flex-end' },
  sheet:   { backgroundColor: WHITE, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, paddingBottom: 32 },
  header:  { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 },
  title:   { fontSize: 20, fontWeight: '800', color: NAVY },
  sub:     { fontSize: 13, color: '#4B5A6E', marginTop: 2 },
  closeBtn:{ padding: 4, backgroundColor: '#F1F4F8', borderRadius: 20 },
  contactBanner: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#F1F5F9', padding: 12, borderRadius: 8, marginBottom: 16 },
  contactTxt: { fontSize: 13, color: NAVY },
  canvasWrap: { height: 260, marginBottom: 20 },
  actions: { flexDirection: 'row', gap: 12 },
  clearBtn: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 16, backgroundColor: '#F1F4F8', borderRadius: 12 },
  clearTxt: { fontSize: 15, fontWeight: '700', color: '#4B5A6E' },
  okBtn:    { flex: 2, alignItems: 'center', justifyContent: 'center', paddingVertical: 16, backgroundColor: SUCCESS, borderRadius: 12 },
  okBtnDisabled: { opacity: 0.7 },
  okTxt:    { fontSize: 15, fontWeight: '700', color: WHITE },
});
