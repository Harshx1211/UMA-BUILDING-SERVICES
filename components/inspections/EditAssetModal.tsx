import React, { useState, useEffect, useMemo } from 'react';
import {
  View, StyleSheet, Modal, TouchableOpacity, TextInput,
  ScrollView, Platform,
} from 'react-native';
import { Text } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Card, Button, showConfirm } from '@/components/ui';
import { useColors } from '@/hooks/useColors';
import { T } from '@/constants/Colors';
import { updateRecord, addToSyncQueue, queryRecords, deleteRecord, upsertRecord, getAssetHistory } from '@/lib/database';
import { SyncOperation } from '@/constants/Enums';
import { useAuthStore } from '@/store/authStore';
import { useCatalogueStore } from '@/store/catalogueStore';
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
  const { assetTypes } = useCatalogueStore();

  const [location, setLocation] = useState('');
  const [assetRef, setAssetRef] = useState('');
  const [serialNumber, setSerialNumber] = useState('');
  const [notes, setNotes] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [errors, setErrors] = useState<{ location?: string }>({});

  // ── Asset Type / Variant — fixes a mis-added asset (e.g. wrong extinguisher
  // type) without forcing a delete-and-recreate. Collapsed by default, showing
  // the current type; tapping it expands the same type/variant picker used by
  // AddAssetModal so re-selection stays a one-tap affair. ──
  const [selectedType, setSelectedType] = useState('');
  const [selectedVariant, setSelectedVariant] = useState('');
  const [typeEditing, setTypeEditing] = useState(false);
  const [variantSearch, setVariantSearch] = useState('');

  const [allTags, setAllTags] = useState<AssetTag[]>([]);
  const [selectedTagIds, setSelectedTagIds] = useState<string[]>([]);
  const [initialAssignments, setInitialAssignments] = useState<AssetTagAssignment[]>([]);
  const [locationSuggestions, setLocationSuggestions] = useState<string[]>([]);
  const [addingNewLocation, setAddingNewLocation] = useState(false);

  // ── Structured "New Location" builder — Tower / Floor / Unit-or-Area ──
  const [tower,   setTower]   = useState('');
  const [floorNo, setFloorNo] = useState('');
  const [unitNo,  setUnitNo]  = useState('');

  const generatedLocation = tower.trim() && floorNo.trim() && unitNo.trim()
    ? `${tower.trim()}-${floorNo.trim()}-${unitNo.trim()}`
    : '';
  const effectiveLocation = addingNewLocation ? generatedLocation : location;

  const typeDef = useMemo(() => assetTypes.find(t => t.value === selectedType), [selectedType, assetTypes]);
  const variants = useMemo(() => typeDef?.variants ?? [], [typeDef]);
  const filteredVariants = useMemo(() => {
    let arr = variants;
    if (variantSearch.trim()) {
      const q = variantSearch.toLowerCase();
      arr = arr.filter(v => v.toLowerCase().includes(q));
    }
    return Array.from(new Set(arr));
  }, [variants, variantSearch]);

  useEffect(() => {
    if (visible && asset) {
      const currentLocation = asset.location_on_site || '';
      setLocation(currentLocation);
      setAssetRef(asset.asset_ref || '');
      setSerialNumber(asset.serial_number || '');
      setNotes(asset.description || '');
      setErrors({});
      setTower('');
      setFloorNo('');
      setUnitNo('');
      setSelectedType(asset.asset_type);
      setSelectedVariant(asset.variant || '');
      setTypeEditing(false);
      setVariantSearch('');

      // FIX: asset_tags is per-company (never global) — an unfiltered query
      // could surface another company's tag vocabulary if this device ever
      // cached one (see lib/database.ts Migration 40 / clearDatabase()).
      const companyId = useAuthStore.getState().user?.company_id;
      setAllTags(
        (companyId ? queryRecords<AssetTag>('asset_tags', { company_id: companyId }) : queryRecords<AssetTag>('asset_tags'))
          .sort((a, b) => a.name.localeCompare(b.name))
      );
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

  // Tapping a type re-selects it immediately; a type with no variants closes
  // the picker right away, one with variants stays open for that pick.
  const handleTypeSelect = (value: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setSelectedType(value);
    setSelectedVariant('');
    setVariantSearch('');
    const def = assetTypes.find(t => t.value === value);
    if (!def || def.variants.length === 0) setTypeEditing(false);
  };

  const handleVariantSelect = (v: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setSelectedVariant(v);
    setTypeEditing(false);
  };

  const handleSave = () => {
    if (!asset) return;

    if (!effectiveLocation.trim()) {
      setErrors({ location: addingNewLocation ? 'Tower, floor and unit no. are all required.' : 'Please pick a location.' });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      return;
    }

    // Changing the type/variant only affects future jobs' checklists and
    // reports — anything already actioned keeps the wording it was recorded
    // with. Only worth flagging when there's actual history to reassure
    // about; a same-day fix on a freshly-added asset needs no ceremony.
    const typeChanged = selectedType !== asset.asset_type || (selectedVariant || null) !== (asset.variant || null);
    if (typeChanged) {
      const { totalCount } = getAssetHistory(asset.id, '__none__');
      if (totalCount > 0) {
        showConfirm({
          title: 'Change Asset Type?',
          message: `This asset already has ${totalCount} completed inspection${totalCount === 1 ? '' : 's'} on record. Past history and reports won't change, but future jobs will use the ${typeDef?.label ?? selectedType}${selectedVariant ? ' — ' + selectedVariant : ''} checklist instead.`,
          icon: 'swap-horizontal-circle-outline',
          buttons: [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Change Type', style: 'destructive', onPress: () => doSave(asset) },
          ],
        });
        return;
      }
    }

    doSave(asset);
  };

  const doSave = (asset: Asset) => {
    setIsSaving(true);
    try {
      const payload = {
        asset_type: selectedType,
        variant: selectedVariant || null,
        location_on_site: effectiveLocation.trim(),
        asset_ref: assetRef.trim() || null,
        serial_number: serialNumber.trim() || null,
        description: notes.trim() || null,
        updated_at: new Date().toISOString(),
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
              {typeDef?.label ?? selectedType} {selectedVariant ? `— ${selectedVariant}` : ''}
            </Text>
          </View>
          <View style={{ width: 40 }} />
        </View>

        <ScrollView contentContainerStyle={s.detailsScroll} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
          <Card style={s.formCard} noPadding>
            <View style={{ padding: 16 }}>
              {/* Asset Type — fixes a mis-added type without delete + recreate */}
              <View style={s.field}>
                <Text style={[s.fieldLabel, { color: C.text }]}>Asset Type</Text>
                {!typeEditing ? (
                  <TouchableOpacity
                    onPress={() => setTypeEditing(true)}
                    style={[s.typeSummaryRow, { backgroundColor: C.backgroundTertiary }]}
                    activeOpacity={0.75}
                  >
                    <View style={[s.typeSummaryIcon, { backgroundColor: typeDef?.color ?? C.primary }]}>
                      <MaterialCommunityIcons name={(typeDef?.icon as React.ComponentProps<typeof MaterialCommunityIcons>['name']) ?? 'help-circle-outline'} size={20} color="#fff" />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={[s.typeSummaryLabel, { color: C.text }]} numberOfLines={1}>{typeDef?.label ?? selectedType}</Text>
                      {selectedVariant ? (
                        <Text style={[s.typeSummarySub, { color: C.textTertiary }]} numberOfLines={1}>{selectedVariant}</Text>
                      ) : null}
                    </View>
                    <MaterialCommunityIcons name="pencil-outline" size={16} color={C.textTertiary} />
                  </TouchableOpacity>
                ) : (
                  <View style={[s.typeEditWrap, { borderColor: C.border, backgroundColor: C.background }]}>
                    <Text style={[s.fieldHint, { color: C.textTertiary, marginTop: 0 }]}>
                      Fixing a mistake? Pick the correct type — past inspection history keeps the wording it was recorded with.
                    </Text>
                    <View style={s.typeChipWrap}>
                      {assetTypes.map(t => {
                        const selected = selectedType === t.value;
                        return (
                          <TouchableOpacity
                            key={t.value}
                            onPress={() => handleTypeSelect(t.value)}
                            style={[s.typeChip, { borderColor: selected ? t.color : C.border, backgroundColor: selected ? t.color + '18' : C.backgroundTertiary }]}
                          >
                            <MaterialCommunityIcons name={t.icon as React.ComponentProps<typeof MaterialCommunityIcons>['name']} size={14} color={selected ? t.color : C.textSecondary} style={{ marginRight: 5 }} />
                            <Text style={[s.typeChipTxt, { color: selected ? t.color : C.textSecondary }]} numberOfLines={1}>{t.label}</Text>
                          </TouchableOpacity>
                        );
                      })}
                    </View>

                    {variants.length > 0 && (
                      <View style={{ marginTop: 12 }}>
                        <Text style={[s.locFieldLabel, { color: C.textTertiary, marginBottom: 8 }]}>Variant</Text>
                        {variants.length > 6 && (
                          <View style={[s.variantSearchBar, { backgroundColor: C.backgroundTertiary, borderColor: C.border }]}>
                            <MaterialCommunityIcons name="magnify" size={16} color={C.textTertiary} />
                            <TextInput
                              style={[s.variantSearchInput, { color: C.text }]}
                              placeholder="Filter variants…"
                              placeholderTextColor={C.textTertiary}
                              value={variantSearch}
                              onChangeText={setVariantSearch}
                            />
                            {variantSearch.length > 0 && (
                              <TouchableOpacity onPress={() => setVariantSearch('')} hitSlop={8}>
                                <MaterialCommunityIcons name="close-circle" size={15} color={C.textTertiary} />
                              </TouchableOpacity>
                            )}
                          </View>
                        )}
                        <View style={s.typeChipWrap}>
                          {filteredVariants.map(v => {
                            const selected = selectedVariant === v;
                            return (
                              <TouchableOpacity
                                key={v}
                                onPress={() => handleVariantSelect(v)}
                                style={[s.typeChip, { borderColor: selected ? C.primary : C.border, backgroundColor: selected ? C.primary + '18' : C.backgroundTertiary }]}
                              >
                                <Text style={[s.typeChipTxt, { color: selected ? C.primary : C.textSecondary }]} numberOfLines={1}>{v}</Text>
                              </TouchableOpacity>
                            );
                          })}
                        </View>
                      </View>
                    )}

                    <TouchableOpacity onPress={() => setTypeEditing(false)} style={{ marginTop: 12, alignSelf: 'flex-start' }}>
                      <Text style={[s.locationBackLink, { color: C.primary }]}>Done</Text>
                    </TouchableOpacity>
                  </View>
                )}
              </View>

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
                        <Text style={[s.locFieldLabel, { color: C.textTertiary }]}>Unit / Area</Text>
                        <TextInput
                          style={[s.locInput, { backgroundColor: C.backgroundTertiary, color: C.text }]}
                          placeholder="1 or CR" placeholderTextColor={C.textTertiary}
                          value={unitNo} onChangeText={v => { setUnitNo(v); setErrors(e => ({ ...e, location: undefined })); }}
                        />
                      </View>
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

              {/* Serial number. FIX: labeled "Serial Number / Barcode" but
                  only ever wrote to serial_number — the asset detail
                  screen's separate "Barcode / QR ID" row reads a distinct
                  barcode_id column nothing in this app populates, so it
                  always showed "No barcode" regardless of what was typed
                  here. Relabeled to stop implying otherwise. */}
              <View style={s.field}>
                <Text style={[s.fieldLabel, { color: C.text }]}>Serial Number</Text>
                <TextInput
                  style={[s.input, { backgroundColor: C.backgroundTertiary, borderColor: 'transparent', color: C.text, fontFamily: 'monospace' }]}
                  placeholder="Serial number..."
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
        <View style={[s.bottomBar, { backgroundColor: C.surface, borderTopColor: C.border, paddingBottom: 20 + insets.bottom }]}>
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
  typeSummaryRow: { flexDirection: 'row', alignItems: 'center', gap: 12, borderRadius: 12, padding: 12 },
  typeSummaryIcon: { width: 36, height: 36, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
  typeSummaryLabel: { fontSize: 14, fontWeight: '800', letterSpacing: -0.1 },
  typeSummarySub: { fontSize: 12, fontWeight: '600', marginTop: 1 },
  typeEditWrap: { borderWidth: 1, borderRadius: 12, padding: 12 },
  typeChipWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 10 },
  typeChip: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 999, borderWidth: 1, maxWidth: '100%' },
  typeChipTxt: { fontSize: 12, fontWeight: '700' },
  variantSearchBar: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    borderWidth: 1, borderRadius: 10,
    paddingHorizontal: 12, paddingVertical: 8,
    marginBottom: 8,
  },
  variantSearchInput: { flex: 1, fontSize: 14, fontWeight: '600', padding: 0 },
  locationSuggestWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 10 },
  locationChip: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 999, borderWidth: 1, maxWidth: '100%' },
  locationChipTxt: { fontSize: 12, fontWeight: '600' },
  locationBackLink: { fontSize: 12, fontWeight: '700' },
  locFieldsRow: { flexDirection: 'row', gap: 8 },
  locFieldCol:  { flex: 1 },
  locFieldLabel:{ fontSize: 11, fontWeight: '700', marginBottom: 5, letterSpacing: 0.2, textTransform: 'uppercase' },
  locInput:     { borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, fontSize: 14, fontWeight: '500' },
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
