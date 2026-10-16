import React, { useEffect, useState } from 'react';
import { View, StyleSheet, Modal, TouchableOpacity, ScrollView } from 'react-native';
import { Text } from '@/components/ui/AppText';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useColors } from '@/hooks/useColors';
import { T } from '@/constants/Colors';
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
  const insets = useSafeAreaInsets();

  // FIX: this confirm button had no loading/disabled/double-tap guard at
  // all, unlike the Pass/Fail/N-T buttons elsewhere in this same flow
  // (explicitly disabled while a save is in flight, per this codebase's
  // own documented BUG-N7 fix). A rapid double-tap here could fire
  // onConfirm twice before the sheet's own `visible` prop flips to false.
  // Reset whenever the sheet is (re)opened so a second Complete attempt
  // after Review->Finalize isn't permanently stuck disabled.
  const [isConfirming, setIsConfirming] = useState(false);
  useEffect(() => { if (visible) setIsConfirming(false); }, [visible]);
  const handleConfirmPress = () => {
    if (isConfirming) return;
    setIsConfirming(true);
    onConfirm();
  };

  // FIX: assetsInspected used to be pass+fail only, so an all-N/T job showed
  // the warning state even though all assets had been actioned.
  // allAssetsResulted is passed from the parent and uses .every(a=>a.result!==null).
  const allAssetsDone = assetsTotal > 0 && assetsInspected === assetsTotal;

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={s.overlay}>
        <TouchableOpacity style={s.backdrop} onPress={onClose} activeOpacity={1} />
        
        <View style={[s.sheet, { backgroundColor: C.background, paddingBottom: 24 + insets.bottom }]}>
          <View style={s.handleWrap}>
            <View style={[s.handle, { backgroundColor: C.border }]} />
          </View>
          
          <Text style={[s.title, { color: C.text }]}>Complete Job?</Text>
          <Text style={[s.subtitle, { color: C.textSecondary }]}>Review checklist before closing out</Text>

          <ScrollView style={s.list}>
            {/* Asset checklist */}
            <View style={[s.checkItem, { backgroundColor: C.surface, borderColor: C.border }]}>
              <View style={[s.iconBox, { backgroundColor: allAssetsDone ? T.iconBg(C.success) : T.iconBg(C.warning) }]}>
                <MaterialCommunityIcons name={allAssetsDone ? "tools" : "alert"} size={18} color={allAssetsDone ? C.success : C.warning} />
              </View>
              <View style={s.checkTextWrap}>
                <Text style={[s.itemTitle, { color: C.text }]}>Asset inspection</Text>
                <Text style={[s.itemSub, { color: C.textSecondary }]}>{assetsInspected} / {assetsTotal} inspected</Text>
              </View>
              <MaterialCommunityIcons name={allAssetsDone ? "check-circle" : "check-circle-outline"} size={24} color={allAssetsDone ? C.success : C.textTertiary} />
            </View>

            {/* Signature checklist */}
            <View style={[s.checkItem, { backgroundColor: C.surface, borderColor: C.border }]}>
              <View style={[s.iconBox, { backgroundColor: hasSignature ? T.iconBg(C.success) : T.iconBg(C.error) }]}>
                <MaterialCommunityIcons name={hasSignature ? "pen" : "pen-remove"} size={18} color={hasSignature ? C.success : C.error} />
              </View>
              <View style={s.checkTextWrap}>
                <Text style={[s.itemTitle, { color: C.text }]}>Client signature</Text>
                <Text style={[s.itemSub, { color: C.textSecondary }]}>{hasSignature ? 'Signature secured' : 'Missing signature (Required)'}</Text>
              </View>
              <MaterialCommunityIcons name={hasSignature ? "check-circle" : "check-circle-outline"} size={24} color={hasSignature ? C.success : C.error} />
            </View>

            {/* Defects warning */}
            {hasDefects && (
              <View style={[s.checkItem, { backgroundColor: T.selectedBg(C.warning), borderColor: T.tintBorder(C.warning) }]}>
                <View style={[s.iconBox, { backgroundColor: T.iconBg(C.warning) }]}>
                  <MaterialCommunityIcons name="alert-decagram" size={18} color={C.warningDark} />
                </View>
                <View style={s.checkTextWrap}>
                  <Text style={[s.itemTitle, { color: C.warningDark }]}>Defects logged</Text>
                  <Text style={[s.itemSub, { color: C.warning }]}>Make sure client is aware</Text>
                </View>
              </View>
            )}
          </ScrollView>

          <View style={s.actionRow}>
            <Button variant="secondary" title="Review" onPress={onClose} style={{ flex: 1 }} />
            <Button
              title={hasSignature ? "Finalize Job" : "Need Signature"}
              onPress={hasSignature ? handleConfirmPress : () => onNeedSignature?.()}
              isLoading={hasSignature && isConfirming}
              disabled={hasSignature && isConfirming}
              style={{ flex: 1.5 }}
            />
          </View>
        </View>
      </View>
    </Modal>
  );
}

const s = StyleSheet.create({
  overlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: T.overlay },
  backdrop: { ...StyleSheet.absoluteFillObject },
  sheet: { borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, paddingBottom: 40, maxHeight: '80%' },
  handleWrap: { alignItems: 'center', marginBottom: 16 },
  handle: { width: 40, height: 4, borderRadius: 2 },
  title: { fontSize: 22, fontWeight: '800', marginBottom: 4 },
  subtitle: { fontSize: 14, marginBottom: 24 },
  list: { marginBottom: 24 },
  
  checkItem: { flexDirection: 'row', alignItems: 'center', padding: 16, borderRadius: 16, borderWidth: 1, marginBottom: 12 },
  iconBox: { width: 36, height: 36, borderRadius: 10, alignItems: 'center', justifyContent: 'center', marginRight: 12 },
  checkTextWrap: { flex: 1 },
  itemTitle: { fontSize: 15, fontWeight: '700', marginBottom: 2 },
  itemSub: { fontSize: 13 },

  actionRow: { flexDirection: 'row', gap: 12 },
});
