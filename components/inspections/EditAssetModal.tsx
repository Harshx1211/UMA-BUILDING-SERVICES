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
import { updateRecord, addToSyncQueue, queryRecords, deleteRecord, upsertRecord } from '@/lib/database';
import { SyncOperation } from '@/constants/Enums';
import { useAuthStore } from '@/store/authStore';
import { generateUUID } from '@/utils/uuid';
import type { Asset } from '@/types';

interface AssetTag { id: string; name: string; }
interface AssetTagAssignment { id: string; asset_id: string; tag_id: string; }

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

  const [allTags, setAllTags] = useState<AssetTag[]>([]);
  const [selectedTagIds, setSelectedTagIds] = useState<string[]>([]);
  const [initialAssignments, setInitialAssignments] = useState<AssetTagAssignment[]>([]);
  const [locationSuggestions, setLocationSuggestions] = useState<string[]>([]);
  const [addingNewLocation, setAddingNewLocation] = useState(false);

  // ── Structured "New Location" builder ───────────────────────────
  const [locMode,        setLocMode]        = useState<'unit' | 'common'>('unit');
  const [tower,          setTower]          = useState('');
  const [floorNo,        setFloorNo]        = useState('');
  const [unitNo,         setUnitNo]         = useState('');
  const [areaLabel,      setAreaLabel]      = useState('');
  const [locationDetail, setLocationDetail] = useState('');

  const generatedLocation = locMode === 'unit'
    ? (tower.trim() && floorNo.trim() && unitNo.trim() ? `${tower.trim()}-${floorNo.trim()}-${unitNo.trim()}` : '')
    : (tower.trim() && areaLabel.trim() ? `${tower.trim()}-${areaLabel.trim()}` : '');
  const effectiveLocation = addingNewLocation ? generatedLocation : location;

  useEffect(() => {
    if (visible && asset) {
      const currentLocation = asset.location_on_site || '';
      setLocation(currentLocation);
      setAssetRef(asset.asset_ref || '');
      setSerialNumber(asset.serial_number || '');
      setNotes(asset.description || '');
      setErrors({});
      setLocMode('unit');
      setTower('');
      setFloorNo('');
      setUnitNo('');
      setAreaLabel('');
      setLocationDetail(asset.location_detail || '');

      setAllTags(queryRecords<AssetTag>('asset_tags').sort((a, b) => a.name.localeCompare(b.name)));
      const current = queryRecords<AssetTagAssignment>('asset_tag_assignments', { asset_id: asset.id });
      setSelectedTagIds(current.map(a => a.tag_id));
      setInitialAssignments(current);

      // Include this asset's own location so it shows pre-selected — everything
      // else the property has recorded is offered alongside it.
      const rows = queryRecords<{ location_on_site: string | null }>('assets', { property_id: asset.property_id });
      const distinct = Array.from(new Set(rows.map(r => r.location_on_site).filter((v): v is string => !!v))).sort();
      setLocationSuggestions(distinct);
      setAddingNewLocation(distinct.length === 0);
    }
  }, [visible, asset]);

  const toggleTag = (tagId: string) =>
    setSelectedTagIds(prev => prev.includes(tagId) ? prev.filter(t => t !== tagId) : [...prev, tagId]);

  const handleClose = () => {
    onClose();
  };

  const handleSave = () => {
    if (!asset) return;

    if (!effectiveLocation.trim()) {
      setErrors({
        location: addingNewLocation
          ? (locMode === 'unit' ? 'Tower, floor and unit no. are all required.' : 'Tower and area are both required.')
          : 'Please pick a location.',
      });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      return;
    }

    setIsSaving(true);
    try {
      const payload = {
        location_on_site: effectiveLocation.trim(),
        location_detail: locationDetail.trim() || null,
        asset_ref: assetRef.trim() || null,
        serial_number: serialNumber.trim() || null,
        description: notes.trim() || null,
      };

      updateRecord('assets', asset.id, payload);
      addToSyncQueue('assets', asset.id, SyncOperation.Update, payload);

      // Tag changes — only write what actually changed, not the whole set.
      const companyId = useAuthStore.getState().user?.company_id ?? null;
      const initialTagIds = initialAssignments.map(a => a.tag_id);
      const addedTagIds = selectedTagIds.filter(id => !initialTagIds.includes(id));
      const removedAssignments = initialAssignments.filter(a => !selectedTagIds.includes(a.tag_id));

      for (const tagId of addedTagIds) {
        const assignmentId = generateUUID();
        const assignmentPayload = { id: assignmentId, asset_id: asset.id, tag_id: tagId, company_id: companyId };
        upsertRecord('asset_tag_assignments', assignmentPayload);
        addToSyncQueue('asset_tag_assignments', assignmentId, SyncOperation.Insert, assignmentPayload);
      }
      for (const removed of removedAssignments) {
        deleteRecord('asset_tag_assignments', removed.id);
        addToSyncQueue('asset_tag_assignments', removed.id, SyncOperation.Delete, { id: removed.id });
      }

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
                {locationSuggestions.length > 0 && !addingNewLocation ? (
                  <>
                    <Text style={[s.fieldHint, { color: C.textTertiary, marginTop: 0, marginBottom: 10 }]}>
                      Pick an existing block/unit so it groups correctly, or add a new one.
                    </Text>
                    <View style={s.locationSuggestWrap}>
                      {locationSuggestions.map(loc => {
                        const selected = location === loc;
                        return (
                          <TouchableOpacity
                            key={loc}
                            onPress={() => { setLocation(loc); setErrors(e => ({ ...e, location: undefined })); }}
                            style={[s.locationChip, { borderColor: selected ? C.primary : C.border, backgroundColor: selected ? C.primary : C.backgroundTertiary }]}
                          >
                            {selected && <MaterialCommunityIcons name="check" size={12} color="#fff" style={{ marginRight: 4 }} />}
                            <Text style={[s.locationChipTxt, { color: selected ? '#fff' : C.textSecondary }]} numberOfLines={1}>{loc}</Text>
                          </TouchableOpacity>
                        );
                      })}
                      <TouchableOpacity
                        onPress={() => { setLocation(''); setAddingNewLocation(true); setErrors(e => ({ ...e, location: undefined })); }}
                        style={[s.locationChip, { borderColor: C.primary, backgroundColor: C.background, borderStyle: 'dashed' }]}
                      >
                        <MaterialCommunityIcons name="plus" size={13} color={C.primary} style={{ marginRight: 3 }} />
                        <Text style={[s.locationChipTxt, { color: C.primary }]}>New Location</Text>
                      </TouchableOpacity>
                    </View>
                  </>
                ) : (
                  <>
                    <View style={s.locModeRow}>
                      {(['unit', 'common'] as const).map(mode => {
                        const active = locMode === mode;
                        return (
                          <TouchableOpacity
                            key={mode}
                            onPress={() => setLocMode(mode)}
                            style={[s.locModeBtn, { borderColor: active ? C.primary : C.border, backgroundColor: active ? C.primary : C.backgroundTertiary }]}
                          >
                            <Text style={[s.locModeTxt, { color: active ? '#fff' : C.textSecondary }]}>
                              {mode === 'unit' ? 'Unit' : 'Common Area'}
                            </Text>
                          </TouchableOpacity>
                        );
                      })}
                    </View>

                    {locMode === 'unit' ? (
                      <View style={s.locFieldsRow}>
                        <View style={s.locFieldCol}>
                          <Text style={[s.locFieldLabel, { color: C.textTertiary }]}>Tower No</Text>
                          <TextInput
                            style={[s.locInput, { backgroundColor: C.backgroundTertiary, color: C.text }]}
                            placeholder="1" placeholderTextColor={C.textTertiary}
                            value={tower} onChangeText={v => { setTower(v); setErrors(e => ({ ...e, location: undefined })); }}
                          />
                        </View>
                        <View style={s.locFieldCol}>
                          <Text style={[s.locFieldLabel, { color: C.textTertiary }]}>Floor No</Text>
                          <TextInput
                            style={[s.locInput, { backgroundColor: C.backgroundTertiary, color: C.text }]}
                            placeholder="1" placeholderTextColor={C.textTertiary}
                            value={floorNo} onChangeText={v => { setFloorNo(v); setErrors(e => ({ ...e, location: undefined })); }}
                          />
                        </View>
                        <View style={s.locFieldCol}>
                          <Text style={[s.locFieldLabel, { color: C.textTertiary }]}>Unit No</Text>
                          <TextInput
                            style={[s.locInput, { backgroundColor: C.backgroundTertiary, color: C.text }]}
                            placeholder="1" placeholderTextColor={C.textTertiary}
                            value={unitNo} onChangeText={v => { setUnitNo(v); setErrors(e => ({ ...e, location: undefined })); }}
                          />
                        </View>
                      </View>
                    ) : (
                      <View style={s.locFieldsRow}>
                        <View style={[s.locFieldCol, { flex: 0.7 }]}>
                          <Text style={[s.locFieldLabel, { color: C.textTertiary }]}>Tower No</Text>
                          <TextInput
                            style={[s.locInput, { backgroundColor: C.backgroundTertiary, color: C.text }]}
                            placeholder="1" placeholderTextColor={C.textTertiary}
                            value={tower} onChangeText={v => { setTower(v); setErrors(e => ({ ...e, location: undefined })); }}
                          />
                        </View>
                        <View style={[s.locFieldCol, { flex: 1.6 }]}>
                          <Text style={[s.locFieldLabel, { color: C.textTertiary }]}>Area</Text>
                          <TextInput
                            style={[s.locInput, { backgroundColor: C.backgroundTertiary, color: C.text }]}
                            placeholder="e.g. CR, Lobby, Bsmt" placeholderTextColor={C.textTertiary}
                            value={areaLabel} onChangeText={v => { setAreaLabel(v); setErrors(e => ({ ...e, location: undefined })); }}
                          />
                        </View>
                      </View>
                    )}

                    {!!generatedLocation && (
                      <View style={s.locPreviewRow}>
                        <MaterialCommunityIcons name="tag-outline" size={13} color={C.primary} />
                        <Text style={[s.locPreviewTxt, { color: C.primary }]}>Will be saved as: {generatedLocation}</Text>
                      </View>
                    )}

                    <View style={{ marginTop: 14 }}>
                      <Text style={[s.locFieldLabel, { color: C.textTertiary }]}>Other Detail (optional)</Text>
                      <TextInput
                        style={[s.locInput, { backgroundColor: C.backgroundTertiary, color: C.text }]}
                        placeholder="e.g. near fire exit, storage room" placeholderTextColor={C.textTertiary}
                        value={locationDetail} onChangeText={setLocationDetail}
                      />
                    </View>

                    {locationSuggestions.length > 0 && (
                      <TouchableOpacity onPress={() => { setAddingNewLocation(false); setLocation(asset.location_on_site || ''); }} style={{ marginTop: 10 }}>
                        <Text style={[s.locationBackLink, { color: C.primary }]}>← Choose from existing locations</Text>
                      </TouchableOpacity>
                    )}
                  </>
                )}
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

              {/* Tags */}
              {allTags.length > 0 && (
                <View style={s.field}>
                  <Text style={[s.fieldLabel, { color: C.text }]}>Tags</Text>
                  <View style={s.tagWrap}>
                    {allTags.map(tag => {
                      const selected = selectedTagIds.includes(tag.id);
                      return (
                        <TouchableOpacity
                          key={tag.id}
                          onPress={() => toggleTag(tag.id)}
                          style={[
                            s.tagChip,
                            { borderColor: selected ? C.primary : C.border, backgroundColor: selected ? C.primary : C.backgroundTertiary },
                          ]}
                        >
                          <Text style={[s.tagChipText, { color: selected ? '#fff' : C.textSecondary }]}>{tag.name}</Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                </View>
              )}

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
  fieldHint: { fontSize: 12, lineHeight: 17, marginTop: 6, fontWeight: '500' },
  locationSuggestWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 10 },
  locationChip: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 999, borderWidth: 1, maxWidth: '100%' },
  locationChipTxt: { fontSize: 12, fontWeight: '600' },
  locationBackLink: { fontSize: 12, fontWeight: '700' },
  locModeRow:   { flexDirection: 'row', gap: 8, marginBottom: 12 },
  locModeBtn:   { flex: 1, paddingVertical: 9, borderRadius: 10, borderWidth: 1, alignItems: 'center' },
  locModeTxt:   { fontSize: 12, fontWeight: '700' },
  locFieldsRow: { flexDirection: 'row', gap: 8 },
  locFieldCol:  { flex: 1 },
  locFieldLabel:{ fontSize: 11, fontWeight: '700', marginBottom: 5, letterSpacing: 0.2, textTransform: 'uppercase' },
  locInput:     { borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, fontSize: 14, fontWeight: '500' },
  locPreviewRow:{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 10 },
  locPreviewTxt:{ fontSize: 12, fontWeight: '700' },
  tagWrap:  { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  tagChip:  { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 999, borderWidth: 1 },
  tagChipText: { fontSize: 13, fontWeight: '700' },
  bottomBar: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingHorizontal: 20, paddingTop: 16,
    paddingBottom: Platform.OS === 'ios' ? 36 : 20,
    borderTopWidth: 1,
    shadowColor: T.black, shadowOffset: { width: 0, height: -8 }, shadowOpacity: 0.12, shadowRadius: 16, elevation: 16,
  }
});
