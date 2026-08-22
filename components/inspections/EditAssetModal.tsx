import React, { useState, useEffect } from 'react';
import {
  View, StyleSheet, Modal, TouchableOpacity, TextInput,
  ScrollView, Platform,
} from 'react-native';
import { Text } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Card, Button } from '@/components/ui';
import { useColors } from '@/hooks/useColors';
import { T } from '@/constants/Colors';
import { updateRecord, addToSyncQueue } from '@/lib/database';
import { SyncOperation } from '@/constants/Enums';
import type { Asset } from '@/types';

interface EditAssetModalProps {
  visible: boolean;
  asset: Asset | null;
  onClose: () => void;
  onAssetEdited: () => void;
}

export default function EditAssetModal({ visible, asset, onClose, onAssetEdited }: EditAssetModalProps) {
  const C = useColors();
  const insets = useSafeAreaInsets();

  const [location, setLocation] = useState('');
  const [assetRef, setAssetRef] = useState('');
  const [serialNumber, setSerialNumber] = useState('');
  const [notes, setNotes] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [errors, setErrors] = useState<{ location?: string }>({});

  useEffect(() => {
    if (visible && asset) {
      setLocation(asset.location_on_site || '');
      setAssetRef(asset.asset_ref || '');
      setSerialNumber(asset.serial_number || '');
      setNotes(asset.description || '');
      setErrors({});
    }
  }, [visible, asset]);

  const handleClose = () => {
    onClose();
  };

  const handleSave = () => {
    if (!asset) return;

    if (!location.trim()) {
      setErrors({ location: 'Location is required.' });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      return;
    }

    setIsSaving(true);
    try {
      const payload = {
        location_on_site: location.trim(),
        asset_ref: assetRef.trim() || null,
        serial_number: serialNumber.trim() || null,
        description: notes.trim() || null,
      };

      updateRecord('assets', asset.id, payload);
      addToSyncQueue('assets', asset.id, SyncOperation.Update, payload);
      
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      onAssetEdited();
    } catch (err) {
      console.error('[EditAssetModal] save error:', err);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    } finally {
      setIsSaving(false);
    }
  };

  if (!asset) return null;

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={handleClose}>
      <View style={[s.container, { backgroundColor: C.background }]}>
        
        {/* ── HEADER ── */}
        <View style={[s.header, { backgroundColor: C.surface, paddingTop: Math.max(insets.top, 16), borderBottomWidth: 1, borderBottomColor: C.border }]}>
          <TouchableOpacity onPress={handleClose} style={[s.headerIconBtn, { backgroundColor: C.backgroundTertiary, borderColor: C.border }]} hitSlop={12}>
            <MaterialCommunityIcons name="close" size={22} color={C.text} />
          </TouchableOpacity>
          <View style={{ flex: 1, alignItems: 'center' }}>
            <Text style={[s.headerTitle, { color: C.text }]}>Edit Asset</Text>
            <Text style={[s.headerSub, { color: C.textTertiary }]} numberOfLines={1}>
              {asset.asset_type} {asset.variant ? `— ${asset.variant}` : ''}
            </Text>
          </View>
          <View style={{ width: 40 }} />
        </View>

        <ScrollView contentContainerStyle={s.detailsScroll} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
          <Card style={s.formCard} noPadding>
            <View style={{ padding: 16 }}>
              {/* Location */}
              <View style={s.field}>
                <Text style={[s.fieldLabel, { color: C.text }]}>Location on Site <Text style={{color: C.primary}}>*</Text></Text>
                {errors.location && (
                  <View style={[s.errorRow, { backgroundColor: C.errorLight, borderColor: C.error }]}>
                    <MaterialCommunityIcons name="alert-circle" size={13} color={C.error} />
                    <Text style={[s.errorTxt, { color: C.error }]}>{errors.location}</Text>
                  </View>
                )}
                <TextInput
                  style={[s.input, { backgroundColor: C.backgroundTertiary, borderColor: errors.location ? C.error : 'transparent', color: C.text }]}
                  placeholder="Location on site..."
                  placeholderTextColor={C.textTertiary}
                  value={location}
                  onChangeText={v => { setLocation(v); setErrors(e => ({ ...e, location: undefined })); }}
                />
              </View>

              {/* Ref */}
              <View style={s.field}>
                <Text style={[s.fieldLabel, { color: C.text }]}>Asset Reference</Text>
                <TextInput
                  style={[s.input, { backgroundColor: C.backgroundTertiary, borderColor: 'transparent', color: C.text, fontFamily: 'monospace' }]}
                  placeholder="Reference code..."
                  placeholderTextColor={C.textTertiary}
                  value={assetRef}
                  onChangeText={setAssetRef}
                  keyboardType="default"
                  maxLength={15}
                />
              </View>

              {/* Serial number */}
              <View style={s.field}>
                <Text style={[s.fieldLabel, { color: C.text }]}>Serial Number / Barcode</Text>
                <TextInput
                  style={[s.input, { backgroundColor: C.backgroundTertiary, borderColor: 'transparent', color: C.text, fontFamily: 'monospace' }]}
                  placeholder="Serial number or barcode..."
                  placeholderTextColor={C.textTertiary}
                  value={serialNumber}
                  onChangeText={setSerialNumber}
                  autoCapitalize="characters"
                />
              </View>

              {/* Notes */}
              <View style={[s.field, { marginBottom: 0 }]}>
                <Text style={[s.fieldLabel, { color: C.text }]}>Notes</Text>
                <TextInput
                  style={[s.input, s.textArea, { backgroundColor: C.backgroundTertiary, borderColor: 'transparent', color: C.text }]}
                  placeholder="Condition, age, notes..."
                  placeholderTextColor={C.textTertiary}
                  value={notes}
                  onChangeText={setNotes}
                  multiline
                  textAlignVertical="top"
                />
              </View>
            </View>
          </Card>
          <View style={{ height: 16 }} />
        </ScrollView>

        {/* ── BOTTOM ACTION BAR ───────────────────────────── */}
        <View style={[s.bottomBar, { backgroundColor: C.surface, borderTopColor: C.border }]}>
          <View style={{ flex: 1, paddingRight: 8 }}>
            <Button variant="secondary" title="Cancel" onPress={handleClose} />
          </View>
          <View style={{ flex: 2 }}>
            <Button 
              title={isSaving ? 'Saving…' : 'Save Changes'} 
              icon="content-save" 
              onPress={handleSave} 
              disabled={isSaving} 
            />
          </View>
        </View>

      </View>
    </Modal>
  );
}

const s = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 20, paddingBottom: 18,
  },
  headerIconBtn: {
    width: 40, height: 40, borderRadius: 20,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1,
  },
  headerTitle: { fontSize: 20, fontWeight: '900', letterSpacing: -0.4 },
  headerSub:   { fontSize: 12, marginTop: 2, fontWeight: '600' },
  detailsScroll: { padding: 16, paddingBottom: 100, gap: 6 },
  formCard:     { marginBottom: 16 },
  field:      { marginBottom: 18 },
  fieldLabel: { fontSize: 13, fontWeight: '800', marginBottom: 6, letterSpacing: -0.1 },
  errorRow: { flexDirection: 'row', alignItems: 'center', gap: 8, padding: 12, borderRadius: 12, borderWidth: 1.5, marginBottom: 10 },
  errorTxt: { fontSize: 12, fontWeight: '800', flex: 1 },
  input:    { borderWidth: 1, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, fontSize: 14, fontWeight: '500' },
  textArea: { minHeight: 80, paddingTop: 12 },
  bottomBar: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingHorizontal: 20, paddingTop: 16,
    paddingBottom: Platform.OS === 'ios' ? 36 : 20,
    borderTopWidth: 1,
    shadowColor: T.black, shadowOffset: { width: 0, height: -8 }, shadowOpacity: 0.12, shadowRadius: 16, elevation: 16,
  }
});
