// AddAssetModal — Type → Variant → Details three-step flow
// Mirrors the "Edit Asset" form captured in reference screenshots from Uptick
import React, { useState, useMemo } from 'react';
import {
  View, StyleSheet, Modal, TouchableOpacity, TextInput,
  ScrollView, Platform, Alert, FlatList,
} from 'react-native';
import { Text } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useColors } from '@/hooks/useColors';
import { insertRecord, addToSyncQueue } from '@/lib/database';
import { AssetStatus, SyncOperation } from '@/constants/Enums';
import { ASSET_TYPES, getInspectionRoutine } from '@/constants/AssetData';
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

  // ── Derived ───────────────────────────────────────────────────
  const typeDef    = useMemo(() => ASSET_TYPES.find(t => t.value === selectedType), [selectedType]);
  const variants   = typeDef?.variants ?? [];
  const routine    = selectedType ? getInspectionRoutine(selectedType) : '';

  const filteredVariants = useMemo(() => {
    if (!variantSearch.trim()) return variants;
    const q = variantSearch.toLowerCase();
    return variants.filter(v => v.toLowerCase().includes(q));
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
    const def = ASSET_TYPES.find(t => t.value === value);
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
    if (step === 'variant') setStep('type');
    else if (step === 'details') {
      if (variants.length > 0) setStep('variant');
      else setStep('type');
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
    if (quantity > 10) {
      Alert.alert('Max Quantity', 'You can add up to 10 assets at once.');
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
        insertRecord('assets', payload as any);
        addToSyncQueue('assets', id, SyncOperation.Insert, payload as any);
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
        <View style={[s.header, { backgroundColor: C.surface, borderBottomColor: C.border }]}>
          <TouchableOpacity onPress={step === 'type' ? handleClose : handleBack} style={s.headerIconBtn} hitSlop={12}>
            <MaterialCommunityIcons
              name={step === 'type' ? 'close' : 'arrow-left'}
              size={22} color={C.textSecondary}
            />
          </TouchableOpacity>
          <View style={{ flex: 1, alignItems: 'center' }}>
            <Text style={[s.headerTitle, { color: C.text }]}>{stepTitle}</Text>
            <Text style={[s.headerSub, { color: C.textTertiary }]} numberOfLines={1}>{stepSub}</Text>
          </View>
          {step === 'details' ? (
            <TouchableOpacity
              style={[s.headerSaveBtn, { backgroundColor: C.primary }]}
              onPress={handleSave} disabled={isSaving} hitSlop={8}
            >
              <Text style={s.headerSaveTxt}>{isSaving ? 'Saving…' : 'Add'}</Text>
            </TouchableOpacity>
          ) : (
            <View style={{ width: 60 }} />
          )}
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
                    <View style={[s.stepDot, { backgroundColor: isActive ? C.primary : isDone ? C.success : C.border }]}>
                      {isDone
                        ? <MaterialCommunityIcons name="check" size={10} color="#fff" />
                        : <Text style={[s.stepNum, { color: isActive ? '#fff' : C.textTertiary }]}>{i + 1}</Text>
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
              {ASSET_TYPES.map(t => (
                <TouchableOpacity
                  key={t.value}
                  style={[s.typeCard, {
                    backgroundColor: selectedType === t.value ? t.color : C.surface,
                    borderColor: selectedType === t.value ? t.color : C.border,
                  }]}
                  onPress={() => handleTypeSelect(t.value)}
                  activeOpacity={0.75}
                >
                  <View style={[s.typeIconWrap, {
                    backgroundColor: selectedType === t.value ? 'rgba(255,255,255,0.2)' : t.color + '18',
                  }]}>
                    <MaterialCommunityIcons name={t.icon} size={26} color={selectedType === t.value ? '#fff' : t.color} />
                  </View>
                  <Text style={[s.typeLabel, { color: selectedType === t.value ? '#fff' : C.text }]}>{t.label}</Text>
                  <MaterialCommunityIcons
                    name="chevron-right"
                    size={14}
                    color={selectedType === t.value ? 'rgba(255,255,255,0.7)' : C.textTertiary}
                  />
                </TouchableOpacity>
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
                autoFocus
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
                  <TouchableOpacity
                    style={[s.variantRow, {
                      backgroundColor: isSelected ? C.primary + '12' : 'transparent',
                      borderBottomColor: C.border,
                    }]}
                    onPress={() => handleVariantSelect(item)}
                    activeOpacity={0.7}
                  >
                    <Text style={[s.variantTxt, { color: isSelected ? C.primary : C.text, fontWeight: isSelected ? '700' : '500' }]}>
                      {item}
                    </Text>
                    {isSelected && <MaterialCommunityIcons name="check" size={18} color={C.primary} />}
                  </TouchableOpacity>
                );
              }}
              ListEmptyComponent={
                <View style={s.emptyVariant}>
                  <Text style={{ color: C.textTertiary }}>No variants match "{variantSearch}"</Text>
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
          <ScrollView
            contentContainerStyle={s.detailsScroll}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          >
            {/* Inspection Routine (read-only) */}
            {routine ? (
              <View style={[s.routineBox, { backgroundColor: C.primary + '12', borderColor: C.primary + '30' }]}>
                <MaterialCommunityIcons name="calendar-check" size={15} color={C.primary} />
                <View style={{ flex: 1 }}>
                  <Text style={[s.routineLabel, { color: C.primary }]}>INSPECTION ROUTINE</Text>
                  <Text style={[s.routineValue, { color: C.text }]}>{routine}</Text>
                </View>
              </View>
            ) : null}

            {/* Location */}
            <View style={s.field}>
              <Text style={[s.fieldLabel, { color: C.text }]}>Location on Site *</Text>
              <Text style={[s.fieldHint, { color: C.textTertiary }]}>
                Where is this asset physically located? e.g. "13-roof adj rain water tank"
              </Text>
              {errors.location && (
                <View style={[s.errorRow, { backgroundColor: C.errorLight, borderColor: C.error }]}>
                  <MaterialCommunityIcons name="alert-circle" size={13} color={C.error} />
                  <Text style={[s.errorTxt, { color: C.error }]}>{errors.location}</Text>
                </View>
              )}
              <TextInput
                style={[s.input, { backgroundColor: C.surface, borderColor: errors.location ? C.error : C.border, color: C.text }]}
                placeholder="e.g. Level 2 – near lift bank"
                placeholderTextColor={C.textTertiary}
                value={location}
                onChangeText={v => { setLocation(v); setErrors(e => ({ ...e, location: undefined })); }}
              />
            </View>

            {/* Ref */}
            <View style={s.field}>
              <Text style={[s.fieldLabel, { color: C.text }]}>Ref (Asset Reference)</Text>
              <Text style={[s.fieldHint, { color: C.textTertiary }]}>
                Short reference number for this asset at the site. e.g. "001", "040"
              </Text>
              <TextInput
                style={[s.input, { backgroundColor: C.surface, borderColor: C.border, color: C.text, fontFamily: 'monospace' }]}
                placeholder="e.g. 001"
                placeholderTextColor={C.textTertiary}
                value={assetRef}
                onChangeText={setAssetRef}
                keyboardType="default"
                maxLength={15}
              />
            </View>

            {/* Quantity */}
            <View style={s.field}>
              <Text style={[s.fieldLabel, { color: C.text }]}>Quantity</Text>
              <Text style={[s.fieldHint, { color: C.textTertiary }]}>
                Adding multiple identical assets in the same area?
              </Text>
              <View style={s.qtyRow}>
                <TouchableOpacity
                  style={[s.qtyBtn, { backgroundColor: C.backgroundTertiary, borderColor: C.border }]}
                  onPress={() => { if (quantity > 1) { setQuantity(q => q - 1); Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); } }}
                  activeOpacity={0.7}
                >
                  <MaterialCommunityIcons name="minus" size={20} color={C.text} />
                </TouchableOpacity>
                <View style={[s.qtyDisplay, { backgroundColor: C.surface, borderColor: C.border }]}>
                  <Text style={[s.qtyValue, { color: C.text }]}>{quantity}</Text>
                  <Text style={[s.qtyUnit, { color: C.textTertiary }]}>{quantity === 1 ? 'asset' : 'assets'}</Text>
                </View>
                <TouchableOpacity
                  style={[s.qtyBtn, { backgroundColor: C.backgroundTertiary, borderColor: C.border }]}
                  onPress={() => { if (quantity < 10) { setQuantity(q => q + 1); Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); } }}
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
                <Text style={[s.fieldHint, { color: C.textTertiary }]}>
                  Original install / commission date. Leave blank to use today.
                </Text>
                <TextInput
                  style={[s.input, { backgroundColor: C.surface, borderColor: C.border, color: C.text }]}
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
                <Text style={[s.fieldHint, { color: C.textTertiary }]}>
                  Found on the asset tag or compliance label.
                </Text>
                <TextInput
                  style={[s.input, { backgroundColor: C.surface, borderColor: C.border, color: C.text, fontFamily: 'monospace' }]}
                  placeholder="e.g. FE-20240415-0042"
                  placeholderTextColor={C.textTertiary}
                  value={serialNumber}
                  onChangeText={setSerialNumber}
                  autoCapitalize="characters"
                />
              </View>
            )}

            {/* Notes */}
            <View style={s.field}>
              <Text style={[s.fieldLabel, { color: C.text }]}>Notes</Text>
              <TextInput
                style={[s.input, s.textArea, { backgroundColor: C.surface, borderColor: C.border, color: C.text }]}
                placeholder="Condition, age, additional info…"
                placeholderTextColor={C.textTertiary}
                value={notes}
                onChangeText={setNotes}
                multiline
                textAlignVertical="top"
              />
            </View>

            {/* Save button */}
            <TouchableOpacity
              style={[s.saveBtn, { backgroundColor: C.primary }]}
              onPress={handleSave}
              disabled={isSaving}
              activeOpacity={0.8}
            >
              <MaterialCommunityIcons name="plus-circle-outline" size={20} color="#FFF" />
              <Text style={s.saveBtnTxt}>
                {isSaving ? 'Saving…' : quantity === 1 ? 'Add Asset to Register' : `Add ${quantity} Assets to Register`}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity style={s.cancelBtn} onPress={handleClose}>
              <Text style={[s.cancelBtnTxt, { color: C.textTertiary }]}>Cancel</Text>
            </TouchableOpacity>
          </ScrollView>
        )}
      </View>
    </Modal>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const s = StyleSheet.create({
  container: { flex: 1 },

  header: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: Platform.OS === 'ios' ? 14 : 20,
    paddingBottom: 14,
    borderBottomWidth: 1, gap: 8,
  },
  headerIconBtn:  { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  headerTitle:    { fontSize: 16, fontWeight: '800' },
  headerSub:      { fontSize: 11, marginTop: 1 },
  headerSaveBtn:  { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 18 },
  headerSaveTxt:  { color: '#FFF', fontWeight: '800', fontSize: 13 },

  // Step indicators
  stepBar:    { flexDirection: 'row', paddingVertical: 12, paddingHorizontal: 24, borderBottomWidth: 1, justifyContent: 'space-around' },
  stepItem:   { alignItems: 'center', gap: 4 },
  stepDot:    { width: 22, height: 22, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
  stepNum:    { fontSize: 11, fontWeight: '800' },
  stepLabel:  { fontSize: 10, fontWeight: '700', letterSpacing: 0.3 },

  // Type grid
  typeScroll: { padding: 16, paddingBottom: 48 },
  typeGrid:   { gap: 10 },
  typeCard: {
    flexDirection: 'row', alignItems: 'center',
    padding: 16, borderRadius: 16, borderWidth: 1.5, gap: 14,
  },
  typeIconWrap: { width: 48, height: 48, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  typeLabel:    { flex: 1, fontSize: 14, fontWeight: '700', lineHeight: 20 },

  // Variant list
  searchBar: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 16, paddingVertical: 12,
    borderBottomWidth: 1, gap: 10,
  },
  searchInput:    { flex: 1, fontSize: 15, padding: 0 },
  variantRow:     { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 16, borderBottomWidth: 1 },
  variantTxt:     { flex: 1, fontSize: 15 },
  emptyVariant:   { padding: 32, alignItems: 'center' },
  skipBtn:        { borderTopWidth: 1, padding: 16, alignItems: 'center' },
  skipTxt:        { fontSize: 13 },

  // Details
  detailsScroll: { padding: 16, paddingBottom: 48, gap: 4 },

  routineBox:   { flexDirection: 'row', alignItems: 'flex-start', gap: 10, padding: 12, borderRadius: 12, borderWidth: 1, marginBottom: 16 },
  routineLabel: { fontSize: 9, fontWeight: '800', letterSpacing: 1.2, textTransform: 'uppercase', marginBottom: 2 },
  routineValue: { fontSize: 13, fontWeight: '600', lineHeight: 18 },

  field:      { marginBottom: 16 },
  fieldLabel: { fontSize: 13, fontWeight: '700', marginBottom: 6 },
  fieldHint:  { fontSize: 11, lineHeight: 16, marginBottom: 10 },

  errorRow: { flexDirection: 'row', alignItems: 'center', gap: 6, padding: 9, borderRadius: 8, borderWidth: 1, marginBottom: 10 },
  errorTxt: { fontSize: 12, fontWeight: '600', flex: 1 },

  input:    { borderWidth: 1.5, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 13, fontSize: 15 },
  textArea: { minHeight: 90, paddingTop: 13 },

  qtyRow:    { flexDirection: 'row', alignItems: 'center', gap: 12 },
  qtyBtn:    { width: 48, height: 48, borderRadius: 12, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  qtyDisplay:{ flex: 1, borderWidth: 1, borderRadius: 12, alignItems: 'center', paddingVertical: 10, gap: 2 },
  qtyValue:  { fontSize: 24, fontWeight: '800' },
  qtyUnit:   { fontSize: 11, fontWeight: '600', letterSpacing: 0.2 },

  saveBtn:    { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, borderRadius: 14, height: 54, marginTop: 8 },
  saveBtnTxt: { color: '#FFF', fontSize: 16, fontWeight: '800' },
  cancelBtn:  { marginTop: 10, alignItems: 'center', padding: 8 },
  cancelBtnTxt: { fontSize: 13, fontWeight: '500' },
});
