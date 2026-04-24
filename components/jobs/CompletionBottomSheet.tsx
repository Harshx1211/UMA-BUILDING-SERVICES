import React from 'react';
import { View, StyleSheet, Modal, TouchableOpacity, ScrollView } from 'react-native';
import { Text } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useColors } from '@/hooks/useColors';
import { Button } from '@/components/ui';

interface Props {
  visible: boolean;
  onClose: () => void;
  onConfirm: () => void;
  assetsTotal: number;
  assetsInspected: number;
  hasSignature: boolean;
  hasDefects: boolean;
  onNeedSignature?: () => void;
}

export default function CompletionBottomSheet({ 
  visible, onClose, onConfirm, assetsTotal, assetsInspected, hasSignature, hasDefects, onNeedSignature 
}: Props) {
  const C = useColors();

  const allAssetsDone = assetsTotal > 0 && assetsTotal === assetsInspected;

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={s.overlay}>
        <TouchableOpacity style={s.backdrop} onPress={onClose} activeOpacity={1} />
        
        <View style={[s.sheet, { backgroundColor: C.background }]}>
          <View style={s.handleWrap}>
            <View style={[s.handle, { backgroundColor: C.border }]} />
          </View>
          
          <Text style={[s.title, { color: C.text }]}>Complete Job?</Text>
          <Text style={[s.subtitle, { color: C.textSecondary }]}>Review checklist before closing out</Text>

          <ScrollView style={s.list}>
            {/* Asset checklist */}
            <View style={[s.checkItem, { backgroundColor: C.surface, borderColor: C.border }]}>
              <View style={[s.iconBox, { backgroundColor: allAssetsDone ? C.success + '20' : C.warning + '20' }]}>
                <MaterialCommunityIcons name={allAssetsDone ? "tools" : "alert"} size={20} color={allAssetsDone ? C.success : C.warning} />
              </View>
              <View style={s.checkTextWrap}>
                <Text style={[s.itemTitle, { color: C.text }]}>Asset Inspection</Text>
                <Text style={[s.itemSub, { color: C.textSecondary }]}>{assetsInspected} / {assetsTotal} inspected</Text>
              </View>
              <MaterialCommunityIcons name={allAssetsDone ? "check-circle" : "check-circle-outline"} size={24} color={allAssetsDone ? C.success : C.textTertiary} />
            </View>

            {/* Signature checklist */}
            <View style={[s.checkItem, { backgroundColor: C.surface, borderColor: C.border }]}>
              <View style={[s.iconBox, { backgroundColor: hasSignature ? C.success + '20' : C.error + '20' }]}>
                <MaterialCommunityIcons name={hasSignature ? "pen" : "pen-remove"} size={20} color={hasSignature ? C.success : C.error} />
              </View>
              <View style={s.checkTextWrap}>
                <Text style={[s.itemTitle, { color: C.text }]}>Client Signature</Text>
                <Text style={[s.itemSub, { color: C.textSecondary }]}>{hasSignature ? 'Signature secured' : 'Missing signature (Required)'}</Text>
              </View>
              <MaterialCommunityIcons name={hasSignature ? "check-circle" : "check-circle-outline"} size={24} color={hasSignature ? C.success : C.error} />
            </View>

            {/* Defects warning */}
            {hasDefects && (
              <View style={[s.checkItem, { backgroundColor: C.warning + '10', borderColor: C.warning + '40' }]}>
                <View style={[s.iconBox, { backgroundColor: C.warning + '20' }]}>
                  <MaterialCommunityIcons name="alert-decagram" size={20} color={C.warningDark} />
                </View>
                <View style={s.checkTextWrap}>
                  <Text style={[s.itemTitle, { color: C.warningDark }]}>Defects Logged</Text>
                  <Text style={[s.itemSub, { color: C.warning }]}>Make sure client is aware</Text>
                </View>
              </View>
            )}
          </ScrollView>

          <View style={s.actionRow}>
            <Button variant="outline" title="Review" onPress={onClose} style={{ flex: 1 }} />
            <Button 
              title={hasSignature ? "Finalize Job" : "Need Signature"} 
              onPress={hasSignature ? onConfirm : () => onNeedSignature?.()} 
              style={{ flex: 1.5 }}
            />
          </View>
        </View>
      </View>
    </Modal>
  );
}

const s = StyleSheet.create({
  overlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.5)' },
  backdrop: { ...StyleSheet.absoluteFillObject },
  sheet: { borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, paddingBottom: 40, maxHeight: '80%' },
  handleWrap: { alignItems: 'center', marginBottom: 16 },
  handle: { width: 40, height: 4, borderRadius: 2 },
  title: { fontSize: 22, fontWeight: '800', marginBottom: 4 },
  subtitle: { fontSize: 14, marginBottom: 24 },
  list: { marginBottom: 24 },
  
  checkItem: { flexDirection: 'row', alignItems: 'center', padding: 16, borderRadius: 16, borderWidth: 1, marginBottom: 12 },
  iconBox: { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center', marginRight: 12 },
  checkTextWrap: { flex: 1 },
  itemTitle: { fontSize: 15, fontWeight: '700', marginBottom: 2 },
  itemSub: { fontSize: 13 },

  actionRow: { flexDirection: 'row', gap: 12 },
});
