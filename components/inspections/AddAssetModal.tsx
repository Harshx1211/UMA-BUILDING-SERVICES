// AddAssetModal — Type (with variant picked inline) → Details, two-step flow
// Mirrors the "Edit Asset" form captured in reference screenshots from Uptick
import React, { useState, useMemo, useEffect } from 'react';
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
import { upsertRecord, addToSyncQueue, queryRecords } from '@/lib/database';
import type { RecordData } from '@/lib/database';
import { AssetStatus, SyncOperation } from '@/constants/Enums';
import { useCatalogueStore } from '@/store/catalogueStore';
import type { Asset } from '@/types';
import { generateUUID } from '@/utils/uuid';

type Step = 'type' | 'details';

interface AddAssetModalProps {
  visible: boolean;
  propertyId: string;
  onClose: () => void;
  onAssetAdded: (newAssets: Asset[]) => void;
}

export default function AddAssetModal({ visible, propertyId, onClose, onAssetAdded }: AddAssetModalProps) {
  const C = useColors();
  const insets = useSafeAreaInsets();
  const { assetTypes } = useCatalogueStore();

  // ── Step state ────────────────────────────────────────────────
  const [step, setStep]               = useState<Step>('type');
  const [selectedType, setSelectedType] = useState('');
  const [selectedVariant, setSelectedVariant] = useState('');
  const [variantSearch, setVariantSearch] = useState('');

  // ── Details fields ────────────────────────────────────────────
  const [location,     setLocation]     = useState('');
  const [assetRef,     setAssetRef]     = useState('');
  const [serialNumber, setSerialNumber] = useState('');
  const [baseDate,     setBaseDate]     = useState('');
  const [notes,        setNotes]        = useState('');
  const [quantity,     setQuantity]     = useState(1);
  const [isSaving,     setIsSaving]     = useState(false);
  const [errors,       setErrors]       = useState<{ location?: string; type?: string }>({});
  const [locationSuggestions, setLocationSuggestions] = useState<string[]>([]);
  const [addingNewLocation, setAddingNewLocation] = useState(false);
  const [showMoreFields, setShowMoreFields] = useState(false);

  // ── Structured "New Location" builder — Tower / Floor / Unit-or-Area ──
  const [tower,   setTower]   = useState('');
  const [floorNo, setFloorNo] = useState('');
  const [unitNo,  setUnitNo]  = useState('');

  const generatedLocation = tower.trim() && floorNo.trim() && unitNo.trim()
    ? `${tower.trim()}-${floorNo.trim()}-${unitNo.trim()}`
    : '';
  const effectiveLocation = addingNewLocation ? generatedLocation : location;

  useEffect(() => {
    if (!visible) return;
    const rows = queryRecords<{ location_on_site: string | null }>('assets', { property_id: propertyId });
    const distinct = Array.from(new Set(rows.map(r => r.location_on_site).filter((v): v is string => !!v))).sort();
    setLocationSuggestions(distinct);
    // No locations recorded for this property yet — nothing to pick from, go
    // straight to free text. Otherwise force picking an existing one so two
    // assets in the same unit can't end up with slightly different spellings.
    setAddingNewLocation(distinct.length === 0);
  }, [visible, propertyId]);

  // ── Derived ───────────────────────────────────────────────────
  const typeDef  = useMemo(() => assetTypes.find(t => t.value === selectedType), [selectedType, assetTypes]);
  const variants  = useMemo(() => typeDef?.variants ?? [], [typeDef]);
  const routine   = useMemo(() => typeDef?.inspectionRoutine ?? '', [typeDef]);

  const filteredVariants = useMemo(() => {
    let arr = variants;
    if (variantSearch.trim()) {
      const q = variantSearch.toLowerCase();
      arr = arr.filter(v => v.toLowerCase().includes(q));
    }
    return Array.from(new Set(arr));
  }, [variants, variantSearch]);

  // ── Reset ─────────────────────────────────────────────────────
  const resetAll = () => {
    setStep('type');
    setSelectedType('');
    setSelectedVariant('');
    setVariantSearch('');
    setLocation('');
    setAssetRef('');
    setSerialNumber('');
    setBaseDate('');
    setNotes('');
    setQuantity(1);
    setErrors({});
    setAddingNewLocation(false);
    setTower('');
    setFloorNo('');
    setUnitNo('');
    setShowMoreFields(false);
  };

  const handleClose = () => { resetAll(); onClose(); };

  // ── Navigation ────────────────────────────────────────────────
  // Tapping a type expands its variant list inline (right under that row) —
  // no separate page. Tapping a variant there advances straight to Details.
  // A type with no variants advances to Details immediately.
  const handleTypeSelect = (value: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (selectedType === value) {
      // Tapping the already-expanded type again collapses it.
      setSelectedType('');
      setSelectedVariant('');
      setVariantSearch('');
      return;
    }
    setSelectedType(value);
    setSelectedVariant('');
    setVariantSearch('');
    const def = assetTypes.find(t => t.value === value);
    if (!def || def.variants.length === 0) {
      setStep('details');
    }
  };

  const handleVariantSelect = (v: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setSelectedVariant(v);
    setStep('details');
  };

  const handleBack = () => {
    if (step === 'details') {
      setStep('type');
      if (variants.length > 0) {
        // Keep the type selected so its variant list re-expands — just
        // clear the pick so they can choose a different one, or Skip again.
        setSelectedVariant('');
      } else {
        setSelectedType('');
      }
    }
  };

  // ── Save ──────────────────────────────────────────────────────
  const handleSave = () => {
    const e: { location?: string; type?: string } = {};
    if (!selectedType) e.type = 'Please select an asset type.';
    if (!effectiveLocation.trim()) {
      e.location = addingNewLocation ? 'Tower, floor and unit no. are all required.' : 'Please pick a location.';
    }
    setErrors(e);
    if (Object.keys(e).length > 0) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      return;
    }
    if (quantity > 100) {
      showConfirm({ title: 'Max Quantity', message: 'You can add up to 100 assets at once.', icon: 'alert-circle-outline' });
      return;
    }
    setIsSaving(true);
    const now   = new Date().toISOString();
    const today = now.slice(0, 10);
    try {
      const created: Asset[] = [];
      for (let i = 0; i < quantity; i++) {
        const id = generateUUID();
        const payload = {
          id,
          property_id:      propertyId,
          asset_type:       selectedType,
          variant:          selectedVariant || null,
          asset_ref:        assetRef.trim() || null,
          description:      notes.trim() || null,
          location_on_site: effectiveLocation.trim(),
          serial_number:    quantity === 1 && serialNumber.trim() ? serialNumber.trim() : null,
          barcode_id:       null,
          install_date:     baseDate.trim() || today,
          last_service_date: null,
          next_service_date: null,
          status:           AssetStatus.Active,
          created_at:       now,
        };
        upsertRecord('assets', payload as RecordData);
        addToSyncQueue('assets', id, SyncOperation.Insert, payload as RecordData);
        created.push(payload as unknown as Asset);
      }
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      onAssetAdded(created);
      handleClose();
    } catch (err) {
      console.error('[AddAssetModal] save error:', err);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    } finally {
      setIsSaving(false);
    }
  };

  // ── Step titles ───────────────────────────────────────────────
  const stepTitle = step === 'type' ? 'Select Asset Type' : 'Asset Details';

  const stepSub = step === 'type' ? 'What kind of asset is this?'
    : selectedVariant ? `${selectedType} — ${selectedVariant}` : selectedType;

  // ─────────────────────────────────────────────────────────────
  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={handleClose}>
      <View style={[s.container, { backgroundColor: C.background }]}>

        {/* ── HEADER ── */}
        <View style={[s.header, { backgroundColor: C.surface, paddingTop: Math.max(insets.top, 16), borderBottomWidth: 1, borderBottomColor: C.border }]}>
          <TouchableOpacity onPress={step === 'type' ? handleClose : handleBack} style={[s.headerIconBtn, { backgroundColor: C.backgroundTertiary, borderColor: C.border }]} hitSlop={12}>
            <MaterialCommunityIcons
              name={step === 'type' ? 'close' : 'arrow-left'}
              size={22} color={C.text}
            />
          </TouchableOpacity>
          <View style={{ flex: 1, alignItems: 'center' }}>
            <Text style={[s.headerTitle, { color: C.text }]}>{stepTitle}</Text>
            <Text style={[s.headerSub, { color: C.textTertiary }]} numberOfLines={1}>{stepSub}</Text>
          </View>
          <View style={{ width: 40 }} />
        </View>

        {/* ── STEP INDICATORS ── */}
        {(() => {
          const STEPS: Step[] = ['type', 'details'];
          const currentIdx = STEPS.indexOf(step);
          return (
            <View style={[s.stepBar, { backgroundColor: C.surface, borderBottomColor: C.border }]}>
              {STEPS.map((s2, i) => {
                const isDone = i < currentIdx;
                const isActive = step === s2;
                return (
                  <View key={s2} style={s.stepItem}>
                    <View style={[s.stepDot, { backgroundColor: isActive ? C.primary : isDone ? C.success : C.backgroundTertiary, borderColor: isActive ? C.primary : isDone ? C.success : C.border, borderWidth: 1 }]}>
                      {isDone
                        ? <MaterialCommunityIcons name="check" size={12} color={T.textOnPrimary} />
                        : <Text style={[s.stepNum, { color: isActive ? T.textOnPrimary : C.textTertiary }]}>{i + 1}</Text>
                      }
                    </View>
                    <Text style={[s.stepLabel, { color: isActive ? C.primary : C.textTertiary }]}>
                      {s2 === 'type' ? 'Type' : 'Details'}
                    </Text>
                  </View>
                );
              })}
            </View>
          );
        })()}

        {/* ══ STEP 1: TYPE LIST — tapping a type expands its variants right below it ══ */}
        {step === 'type' && (
          <ScrollView contentContainerStyle={s.typeScroll} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
            {errors.type && (
              <View style={[s.errorRow, { backgroundColor: C.errorLight, borderColor: C.error }]}>
                <MaterialCommunityIcons name="alert-circle" size={13} color={C.error} />
                <Text style={[s.errorTxt, { color: C.error }]}>{errors.type}</Text>
              </View>
            )}
            <View style={s.typeGrid}>
              {assetTypes.map(t => {
                const isExpanded = selectedType === t.value && t.variants.length > 0;
                return (
                  <Card
                    key={t.value}
                    style={[s.typeCard, isExpanded ? { borderColor: t.color, backgroundColor: t.color + '15' } : {}]}
                    noPadding
                  >
                    <TouchableOpacity
                      style={s.typeCardTouch}
                      onPress={() => handleTypeSelect(t.value)}
                      activeOpacity={0.75}
                    >
                      <View style={[s.typeIconWrap, {
                        backgroundColor: isExpanded ? t.color : C.backgroundTertiary,
                      }]}>
                        <MaterialCommunityIcons name={t.icon} size={24} color={isExpanded ? T.textOnPrimary : t.color} />
                      </View>
                      <Text style={[s.typeLabel, { color: isExpanded ? t.color : C.text }]}>{t.label}</Text>
                      <MaterialCommunityIcons
                        name={isExpanded ? 'chevron-up' : 'chevron-down'}
                        size={18}
                        color={isExpanded ? t.color : C.textTertiary}
                      />
                    </TouchableOpacity>

                    {isExpanded && (
                      <View style={[s.variantDropdown, { borderTopColor: t.color + '30' }]}>
                        {t.variants.length > 6 && (
                          <View style={[s.variantSearchBar, { backgroundColor: C.background, borderColor: C.border }]}>
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

                        {filteredVariants.length === 0 ? (
                          <Text style={[s.emptyVariantTxt, { color: C.textTertiary }]}>
                            No variants match &quot;{variantSearch}&quot;
                          </Text>
                        ) : (
                          filteredVariants.map(v => {
                            const isSelected = selectedVariant === v;
                            return (
                              <TouchableOpacity
                                key={v}
                                style={[s.variantDropdownRow, { borderColor: isSelected ? t.color : C.border, backgroundColor: isSelected ? t.color + '18' : C.background }]}
                                onPress={() => handleVariantSelect(v)}
                                activeOpacity={0.7}
                              >
                                <Text style={[s.variantDropdownTxt, { color: isSelected ? t.color : C.text, fontWeight: isSelected ? '800' : '600' }]} numberOfLines={2}>
                                  {v}
                                </Text>
                                {isSelected && <MaterialCommunityIcons name="check" size={18} color={t.color} />}
                              </TouchableOpacity>
                            );
                          })
                        )}

                        <TouchableOpacity onPress={() => setStep('details')} style={s.skipInlineBtn}>
                          <Text style={[s.skipTxt, { color: C.textTertiary }]}>Skip — enter details without variant</Text>
                        </TouchableOpacity>
                      </View>
                    )}
                  </Card>
                );
              })}
            </View>
          </ScrollView>
        )}

        {/* ══ STEP 3: DETAILS FORM ══════════════════════════════════ */}
        {step === 'details' && (
          <View style={{ flex: 1 }}>
            <ScrollView
              contentContainerStyle={s.detailsScroll}
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
            >
            {/* Inspection Routine (read-only) */}
            {routine ? (
              <View style={s.routineRow}>
                <MaterialCommunityIcons name="calendar-check" size={14} color={C.textTertiary} />
                <Text style={[s.routineInlineTxt, { color: C.textSecondary }]}>{routine}</Text>
              </View>
            ) : null}

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
                  <Text style={[s.fieldHint, { color: C.textTertiary, marginBottom: 10, marginTop: 0 }]}>
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
                    <TouchableOpacity onPress={() => setAddingNewLocation(false)} style={{ marginTop: 10 }}>
                      <Text style={[s.locationBackLink, { color: C.primary }]}>← Choose from existing locations</Text>
                    </TouchableOpacity>
                  )}
                </>
              )}
            </View>

            <View style={s.field}>
              <Text style={[s.fieldLabel, { color: C.text }]}>Quantity</Text>
              <View style={s.qtyRow}>
                <TouchableOpacity
                  style={[s.qtyBtn, { backgroundColor: C.backgroundTertiary, borderColor: 'transparent' }]}
                  onPress={() => { if (quantity > 1) { setQuantity(q => q - 1); Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); } }}
                  activeOpacity={0.7}
                >
                  <MaterialCommunityIcons name="minus" size={20} color={C.text} />
                </TouchableOpacity>
                <View style={[s.qtyDisplay, { backgroundColor: C.backgroundTertiary, borderColor: 'transparent' }]}>
                  <Text style={[s.qtyValue, { color: C.text }]}>{quantity}</Text>
                  <Text style={[s.qtyUnit, { color: C.textTertiary }]}>{quantity === 1 ? 'asset' : 'assets'}</Text>
                </View>
                <TouchableOpacity
                  style={[s.qtyBtn, { backgroundColor: C.backgroundTertiary, borderColor: 'transparent' }]}
                  onPress={() => { if (quantity < 100) { setQuantity(q => q + 1); Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); } }}
                  activeOpacity={0.7}
                >
                  <MaterialCommunityIcons name="plus" size={20} color={C.text} />
                </TouchableOpacity>
              </View>
            </View>

            {/* Notes */}
            <View style={s.field}>
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

            {showMoreFields ? (
              <>
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

                {/* Base date (single asset only) */}
                {quantity === 1 && (
                  <View style={s.field}>
                    <Text style={[s.fieldLabel, { color: C.text }]}>Base Date</Text>
                    <TextInput
                      style={[s.input, { backgroundColor: C.backgroundTertiary, borderColor: 'transparent', color: C.text }]}
                      placeholder="YYYY-MM-DD"
                      placeholderTextColor={C.textTertiary}
                      value={baseDate}
                      onChangeText={setBaseDate}
                      keyboardType="numbers-and-punctuation"
                      maxLength={10}
                    />
                  </View>
                )}

                {/* Serial number (single asset only) */}
                {quantity === 1 && (
                  <View style={[s.field, { marginBottom: 0 }]}>
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
                )}
              </>
            ) : (
              <TouchableOpacity onPress={() => setShowMoreFields(true)} style={s.moreFieldsBtn}>
                <MaterialCommunityIcons name="plus" size={14} color={C.primary} />
                <Text style={[s.moreFieldsTxt, { color: C.primary }]}>Reference, serial no. &amp; base date</Text>
              </TouchableOpacity>
            )}
              </View>
            </Card>

            {/* Spacer for bottom bar */}
            <View style={{ height: 16 }} />
          </ScrollView>

          {/* ── BOTTOM ACTION BAR ───────────────────────────── */}
          <View style={[s.bottomBar, { backgroundColor: C.surface, borderTopColor: C.border, paddingBottom: 20 + insets.bottom }]}>
            <View style={{ flex: 1, paddingRight: 8 }}>
              <Button variant="secondary" title="Cancel" onPress={handleClose} />
            </View>
            <View style={{ flex: 2 }}>
              <Button 
                title={isSaving ? 'Saving…' : quantity === 1 ? 'Add Asset' : `Add ${quantity} Assets`} 
                icon="check-circle" 
                onPress={handleSave} 
                disabled={isSaving} 
              />
            </View>
          </View>
        </View>
        )}
      </View>
    </Modal>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const s = StyleSheet.create({
  container: { flex: 1 },

  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingBottom: 18,
  },
  headerIconBtn: {
    width: 40, height: 40, borderRadius: 20,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1,
  },
  headerTitle: { fontSize: 20, fontWeight: '900', letterSpacing: -0.4 },
  headerSub:   { fontSize: 12, marginTop: 2, fontWeight: '600' },

  // Step indicators
  stepBar:    { flexDirection: 'row', paddingVertical: 14, paddingHorizontal: 24, borderBottomWidth: 1, justifyContent: 'space-between' },
  stepItem:   { alignItems: 'center', gap: 6, flex: 1 },
  stepDot:    { width: 24, height: 24, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  stepNum:    { fontSize: 11, fontWeight: '900' },
  stepLabel:  { fontSize: 10, fontWeight: '800', letterSpacing: 0.5, textTransform: 'uppercase' },

  // Type grid
  typeScroll: { padding: 16, paddingBottom: 40 },
  typeGrid:   { gap: 12 },
  typeCard: {
    flexDirection: 'column',
  },
  typeCardTouch: {
    flexDirection: 'row', alignItems: 'center', padding: 14, gap: 14, flex: 1,
  },
  typeIconWrap: { width: 44, height: 44, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  typeLabel:    { flex: 1, fontSize: 15, fontWeight: '800', letterSpacing: -0.1 },

  // Variant dropdown — expands inline under the tapped type row
  variantDropdown: { borderTopWidth: 1, padding: 12, gap: 8 },
  variantSearchBar: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    borderWidth: 1, borderRadius: 10,
    paddingHorizontal: 12, paddingVertical: 8,
    marginBottom: 2,
  },
  variantSearchInput: { flex: 1, fontSize: 14, fontWeight: '600', padding: 0 },
  variantDropdownRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    borderWidth: 1, borderRadius: 10,
    paddingHorizontal: 14, paddingVertical: 12,
  },
  variantDropdownTxt: { flex: 1, fontSize: 14, letterSpacing: -0.1, marginRight: 8 },
  emptyVariantTxt: { fontSize: 13, textAlign: 'center', paddingVertical: 16 },
  skipInlineBtn: { alignItems: 'center', paddingVertical: 10, marginTop: 2 },
  skipTxt:      { fontSize: 13, fontWeight: '700' },

  // Details
  detailsScroll: { padding: 16, paddingBottom: 100, gap: 6 },

  routineRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 14, marginLeft: 2 },
  routineInlineTxt: { fontSize: 12, fontWeight: '600' },
  moreFieldsBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 8 },
  moreFieldsTxt: { fontSize: 13, fontWeight: '700' },

  sectionTitle: { fontSize: 11, fontWeight: '900', letterSpacing: 1.5, textTransform: 'uppercase', marginBottom: 10, marginLeft: 4 },
  formCard:     { marginBottom: 16 },

  field:      { marginBottom: 18 },
  fieldLabel: { fontSize: 13, fontWeight: '800', marginBottom: 6, letterSpacing: -0.1 },
  fieldHint:  { fontSize: 12, lineHeight: 17, marginBottom: 10, fontWeight: '500' },

  errorRow: { flexDirection: 'row', alignItems: 'center', gap: 8, padding: 12, borderRadius: 12, borderWidth: 1.5, marginBottom: 10 },
  errorTxt: { fontSize: 12, fontWeight: '800', flex: 1 },

  input:    { borderWidth: 1, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, fontSize: 14, fontWeight: '500' },
  textArea: { minHeight: 80, paddingTop: 12 },
  locationSuggestWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 10 },
  locationChip: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 999, borderWidth: 1, maxWidth: '100%' },
  locationChipTxt: { fontSize: 12, fontWeight: '600' },
  locationBackLink: { fontSize: 12, fontWeight: '700' },
  locFieldsRow: { flexDirection: 'row', gap: 8 },
  locFieldCol:  { flex: 1 },
  locFieldLabel:{ fontSize: 11, fontWeight: '700', marginBottom: 5, letterSpacing: 0.2, textTransform: 'uppercase' },
  locInput:     { borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, fontSize: 14, fontWeight: '500' },

  qtyRow:    { flexDirection: 'row', alignItems: 'center', gap: 10 },
  qtyBtn:    { width: 40, height: 40, borderRadius: 10, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  qtyDisplay:{ flex: 1, flexDirection: 'row', borderWidth: 1, borderRadius: 10, alignItems: 'center', justifyContent: 'center', height: 40, gap: 6 },
  qtyValue:  { fontSize: 16, fontWeight: '800' },
  qtyUnit:   { fontSize: 12, fontWeight: '700', textTransform: 'uppercase' },

  // Bottom action bar
  bottomBar: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingHorizontal: 20, paddingTop: 16,
    paddingBottom: Platform.OS === 'ios' ? 36 : 20,
    borderTopWidth: 1,
    shadowColor: T.black, shadowOffset: { width: 0, height: -8 }, shadowOpacity: 0.12, shadowRadius: 16, elevation: 16,
  },
  saveBtn:    { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, borderRadius: 18, height: 54 },
  saveBtnTxt: { color: T.textOnPrimary, fontSize: 16, fontWeight: '900', letterSpacing: 0.3 },
  cancelBtn:  { paddingHorizontal: 12 },
  cancelBtnTxt: { fontSize: 15, fontWeight: '800' },
});
