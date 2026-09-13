// components/camera/PhotoChooserSheet.tsx
// Small "Take Photo / Choose from Gallery" action sheet — extracted from
// asset/[assetId].tsx (its original, only consumer) so DefectFieldsCard's
// new Before/After photo capture can share the exact same picker UI
// instead of a third copy of it.
import React from 'react';
import { Modal, View, StyleSheet, TouchableOpacity } from 'react-native';
import { Text } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useColors } from '@/hooks/useColors';

export function PhotoChooserSheet({
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

const s = StyleSheet.create({
  chooserOverlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.4)', padding: 12, gap: 8 },
  chooserSheet: { borderRadius: 18, overflow: 'hidden', paddingTop: 14, paddingBottom: 6 },
  chooserTitle: { fontSize: 12, fontWeight: '700', textAlign: 'center', textTransform: 'uppercase', letterSpacing: 0.5, opacity: 0.6, paddingBottom: 10 },
  chooserRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 18, paddingVertical: 14 },
  chooserIconWrap: { width: 36, height: 36, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  chooserRowTxt: { fontSize: 15, fontWeight: '700' },
  chooserDivider: { height: StyleSheet.hairlineWidth, marginLeft: 18 },
  chooserCancel: { borderRadius: 18, paddingVertical: 15, alignItems: 'center' },
  chooserCancelTxt: { fontSize: 16, fontWeight: '700' },
});
