// AddAssetModal — Type → Variant → Details three-step flow
// Mirrors the "Edit Asset" form captured in reference screenshots from Uptick
import React, { useState, useMemo, useEffect } from 'react';
import {
  View, StyleSheet, Modal, TouchableOpacity, TextInput,
  ScrollView, Platform, Alert, FlatList,
} from 'react-native';
import { Text } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Card, Button } from '@/components/ui';
import { useColors } from '@/hooks/useColors';
import { T } from '@/constants/Colors';
import { upsertRecord, addToSyncQueue, queryRecords } from '@/lib/database';
import type { RecordData } from '@/lib/database';
import { AssetStatus, SyncOperation } from '@/constants/Enums';
import { useCatalogueStore } from '@/store/catalogueStore';
import type { Asset } from '@/types';
import { generateUUID } from '@/utils/uuid';

type Step = 'type' | 'variant' | 'details';

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

  useEffect(() => {
    if (!visible) return;
    const rows = queryRecords<{ location_on_site: string | null }>('assets', { property_id: propertyId });
    const distinct = Array.from(new Set(rows.map(r => r.location_on_site).filter((v): v is string => !!v))).sort();
    setLocationSuggestions(distinct);
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
  };

  const handleClose = () => { resetAll(); onClose(); };

  // ── Navigation ────────────────────────────────────────────────
  const handleTypeSelect = (value: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setSelectedType(value);
    setSelectedVariant('');
    setVariantSearch('');
    const def = assetTypes.find(t => t.value === value);
    if (def && def.variants.length > 0) {
      setStep('variant');
    } else {
      setStep('details');
    }
  };

  const handleVariantSelect = (v: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setSelectedVariant(v);
    setStep('details');
  };

  const handleBack = () => {
    if (step === 'variant') {
      setStep('type');
      setSelectedType('');
    } else if (step === 'details') {
      if (variants.length > 0) {
        setStep('variant');
        setSelectedVariant('');
      } else {
        setStep('type');
        setSelectedType('');
      }
    }
  };

  // ── Save ──────────────────────────────────────────────────────
  const handleSave = () => {
    const e: { location?: string; type?: string } = {};
    if (!selectedType) e.type = 'Please select an asset type.';
    if (!location.trim()) e.location = 'Location is required.';
    setErrors(e);
    if (Object.keys(e).length > 0) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      return;
    }
    if (quantity > 100) {
      Alert.alert('Max Quantity', 'You can add up to 100 assets at once.');
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
          location_on_site: location.trim(),
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
  const stepTitle = step === 'type' ? 'Select Asset Type'
    : step === 'variant' ? 'Select Variant'
    : 'Asset Details';

  const stepSub = step === 'type' ? 'What kind of asset is this?'
    : step === 'variant' ? typeDef?.fullLabel ?? ''
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
          const STEPS: Step[] = ['type', 'variant', 'details'];
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
                      {s2 === 'type' ? 'Type' : s2 === 'variant' ? 'Variant' : 'Details'}
                    </Text>
                  </View>
                );
              })}
            </View>
          );
        })()}

        {/* ══ STEP 1: TYPE GRID ══════════════════════════════════════ */}
        {step === 'type' && (
          <ScrollView contentContainerStyle={s.typeScroll} showsVerticalScrollIndicator={false}>
            {errors.type && (
              <View style={[s.errorRow, { backgroundColor: C.errorLight, borderColor: C.error }]}>
                <MaterialCommunityIcons name="alert-circle" size={13} color={C.error} />
                <Text style={[s.errorTxt, { color: C.error }]}>{errors.type}</Text>
              </View>
            )}
            <View style={s.typeGrid}>
              {assetTypes.map(t => (
                <Card
                  key={t.value}
                  style={[s.typeCard, selectedType === t.value ? { borderColor: t.color, backgroundColor: t.color + '15' } : {}]}
                  noPadding
                >
                  <TouchableOpacity
                    style={s.typeCardTouch}
                    onPress={() => handleTypeSelect(t.value)}
                    activeOpacity={0.75}
                  >
                    <View style={[s.typeIconWrap, {
                      backgroundColor: selectedType === t.value ? t.color : C.backgroundTertiary,
                    }]}>
                      <MaterialCommunityIcons name={t.icon} size={24} color={selectedType === t.value ? T.textOnPrimary : t.color} />
                    </View>
                    <Text style={[s.typeLabel, { color: selectedType === t.value ? t.color : C.text }]}>{t.label}</Text>
                    <MaterialCommunityIcons
                      name="chevron-right"
                      size={16}
                      color={C.textTertiary}
                    />
                  </TouchableOpacity>
                </Card>
              ))}
            </View>
          </ScrollView>
        )}

        {/* ══ STEP 2: VARIANT LIST ══════════════════════════════════ */}
        {step === 'variant' && (
          <View style={{ flex: 1 }}>
            {/* Search */}
            <View style={[s.searchBar, { backgroundColor: C.surface, borderBottomColor: C.border }]}>
              <MaterialCommunityIcons name="magnify" size={18} color={C.textTertiary} />
              <TextInput
                style={[s.searchInput, { color: C.text }]}
                placeholder="Filter variants…"
                placeholderTextColor={C.textTertiary}
                value={variantSearch}
                onChangeText={setVariantSearch}
              />
              {variantSearch.length > 0 && (
                <TouchableOpacity onPress={() => setVariantSearch('')} hitSlop={8}>
                  <MaterialCommunityIcons name="close-circle" size={16} color={C.textTertiary} />
                </TouchableOpacity>
              )}
            </View>

            <FlatList
              data={filteredVariants}
              keyExtractor={item => item}
              contentContainerStyle={{ paddingVertical: 8 }}
              renderItem={({ item }) => {
                const isSelected = selectedVariant === item;
                return (
                  <Card key={item} style={[s.variantRow, isSelected ? { borderColor: C.primary, backgroundColor: C.primary + '15' } : {}]} noPadding>
                    <TouchableOpacity
                      style={s.variantTouch}
                      onPress={() => handleVariantSelect(item)}
                      activeOpacity={0.7}
                    >
                      <Text style={[s.variantTxt, { color: isSelected ? C.primary : C.text, fontWeight: isSelected ? '800' : '600' }]}>
                        {item}
                      </Text>
                      {isSelected && <MaterialCommunityIcons name="check" size={20} color={C.primary} />}
                    </TouchableOpacity>
                  </Card>
                );
              }}
              ListEmptyComponent={
                <View style={s.emptyVariant}>
                  <Text style={{ color: C.textTertiary }}>No variants match &quot;{variantSearch}&quot;</Text>
                </View>
              }
            />

            {/* Skip variant */}
            <TouchableOpacity
              style={[s.skipBtn, { borderTopColor: C.border }]}
              onPress={() => setStep('details')}
            >
              <Text style={[s.skipTxt, { color: C.textTertiary }]}>Skip — enter details without variant</Text>
            </TouchableOpacity>
          </View>
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
              <Card variant="info" style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 12, marginBottom: 16 }}>
                <MaterialCommunityIcons name="calendar-check" size={18} color={C.info} />
                <View style={{ flex: 1 }}>
                  <Text style={[s.routineLabel, { color: C.info }]}>INSPECTION ROUTINE</Text>
                  <Text style={[s.routineValue, { color: C.text }]}>{routine}</Text>
                </View>
              </Card>
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
              <TextInput
                style={[s.input, { backgroundColor: C.backgroundTertiary, borderColor: errors.location ? C.error : 'transparent', color: C.text }]}
                placeholder="e.g. Tower A, Floor 3, Unit 3"
                placeholderTextColor={C.textTertiary}
                value={location}
                onChangeText={v => { setLocation(v); setErrors(e => ({ ...e, location: undefined })); }}
              />
              <Text style={[s.fieldHint, { color: C.textTertiary, marginBottom: 0, marginTop: 6 }]}>
                Tip: separate with commas (building, floor, unit) to make filtering and grouping by unit easier later.
              </Text>
              {locationSuggestions.length > 0 && (
                <View style={s.locationSuggestWrap}>
                  {locationSuggestions.map(loc => (
                    <TouchableOpacity
                      key={loc}
                      onPress={() => { setLocation(loc); setErrors(e => ({ ...e, location: undefined })); }}
                      style={[s.locationChip, { borderColor: C.border, backgroundColor: C.backgroundTertiary }]}
                    >
                      <Text style={[s.locationChipTxt, { color: C.textSecondary }]} numberOfLines={1}>{loc}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
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

            {/* Spacer for bottom bar */}
            <View style={{ height: 16 }} />
          </ScrollView>

          {/* ── BOTTOM ACTION BAR ───────────────────────────── */}
          <View style={[s.bottomBar, { backgroundColor: C.surface, borderTopColor: C.border }]}>
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
    flexDirection: 'row', alignItems: 'center',
    gap: 14,
  },
  typeCardTouch: {
    flexDirection: 'row', alignItems: 'center', padding: 14, gap: 14, flex: 1,
  },
  typeIconWrap: { width: 44, height: 44, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  typeLabel:    { flex: 1, fontSize: 15, fontWeight: '800', letterSpacing: -0.1 },

  // Variant list
  searchBar: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 16, paddingVertical: 12,
    borderBottomWidth: 1, gap: 10,
  },
  searchInput: { flex: 1, fontSize: 15, fontWeight: '600', padding: 0 },
  variantRow: {
    marginHorizontal: 16, marginVertical: 4,
  },
  variantTouch: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 16, paddingVertical: 14,
  },
  variantTxt:   { flex: 1, fontSize: 15, letterSpacing: -0.1 },
  emptyVariant: { padding: 40, alignItems: 'center' },
  skipBtn:      { borderTopWidth: 1, padding: 18, alignItems: 'center' },
  skipTxt:      { fontSize: 13, fontWeight: '700' },

  // Details
  detailsScroll: { padding: 16, paddingBottom: 100, gap: 6 },

  routineLabel: { fontSize: 10, fontWeight: '900', letterSpacing: 1, textTransform: 'uppercase', marginBottom: 2 },
  routineValue: { fontSize: 14, fontWeight: '700', lineHeight: 20 },

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
  locationChip: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 999, borderWidth: 1, maxWidth: '100%' },
  locationChipTxt: { fontSize: 12, fontWeight: '600' },

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
