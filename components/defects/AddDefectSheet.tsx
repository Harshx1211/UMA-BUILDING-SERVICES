import React, { useState, forwardRef, useImperativeHandle, useRef, useEffect } from 'react';
import { View, StyleSheet, TouchableOpacity, TextInput, ScrollView, Alert } from 'react-native';
import { Text } from 'react-native-paper';
import BottomSheet, { BottomSheetScrollView, BottomSheetBackdrop } from '@gorhom/bottom-sheet';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import * as FileSystem from 'expo-file-system/legacy';
import * as Haptics from 'expo-haptics';
import Toast from 'react-native-toast-message';
import { useColors } from '@/hooks/useColors';
import { DefectSeverity } from '@/constants/Enums';
import { useDefectsStore } from '@/store/defectsStore';
import { getAssetsForProperty } from '@/lib/database';
import { formatAssetType, getAssetTypeIcon } from '@/utils/assetHelpers';
import { getValidLocalUri } from '@/utils/fileHelpers';
import DefectCodePicker from '@/components/defects/DefectCodePicker';
import type { DefectCode } from '@/constants/DefectCodes';
import type { Asset } from '@/types';

// ─── Types ────────────────────────────────────────────────────
interface Props { jobId: string; propertyId: string; onSaved: () => void; }
export interface AddDefectSheetRef { open: () => void; close: () => void; }

// ─── Severity config ──────────────────────────────────────────
const SEV_CFG = [
  { value: DefectSeverity.Minor,    label: 'Minor',    icon: 'alert-circle-outline', color: '#2563EB', desc: 'No immediate safety risk' },
  { value: DefectSeverity.Major,    label: 'Major',    icon: 'alert',                color: '#EA580C', desc: 'Needs attention soon' },
  { value: DefectSeverity.Critical, label: 'Critical', icon: 'alert-octagon',        color: '#DC2626', desc: 'Immediate safety risk' },
];

// ─── Component ────────────────────────────────────────────────
const AddDefectSheet = forwardRef<AddDefectSheetRef, Props>(({ jobId, propertyId, onSaved }, ref) => {
  const C = useColors();
  const sheetRef = useRef<BottomSheet>(null);
  const { addDefect } = useDefectsStore();

  const [step,         setStep]         = useState<1|2|3>(1);
  const [severity,     setSeverity]     = useState<DefectSeverity>(DefectSeverity.Minor);
  const [assetId,      setAssetId]      = useState('');
  const [description,  setDescription]  = useState('');
  const [photos,       setPhotos]       = useState<string[]>([]);
  const [assets,       setAssets]       = useState<Asset[]>([]);
  const [codeVisible,  setCodeVisible]  = useState(false);
  const [selectedCode, setSelectedCode] = useState<DefectCode | null>(null);
  const [descError,    setDescError]    = useState(false);

  useEffect(() => { setAssets(getAssetsForProperty(propertyId)); }, [propertyId]);

  const reset = () => {
    setStep(1); setSeverity(DefectSeverity.Minor); setAssetId('');
    setDescription(''); setPhotos([]); setSelectedCode(null); setDescError(false);
  };

  useImperativeHandle(ref, () => ({
    open:  () => { reset(); sheetRef.current?.expand(); },
    close: () => sheetRef.current?.close(),
  }));

  const handleCodeSelect = (code: DefectCode | null) => {
    setCodeVisible(false);
    setSelectedCode(code);
    if (code) { setDescription(code.description); setDescError(false); }
  };

  const handlePhoto = async () => {
    const { granted } = await ImagePicker.requestCameraPermissionsAsync();
    if (!granted) return;
    const res = await ImagePicker.launchCameraAsync({ quality: 0.75 });
    if (!res.canceled && res.assets[0]) {
      const src = res.assets[0].uri;
      const dest = `${FileSystem.documentDirectory}defect_${Date.now()}.jpg`;
      try { await FileSystem.copyAsync({ from: src, to: dest }); setPhotos(p => [...p, dest]); }
      catch { setPhotos(p => [...p, src]); }
    }
  };

  const removePhoto = (uri: string) => {
    Alert.alert('Remove photo?', '', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Remove', style: 'destructive', onPress: () => setPhotos(p => p.filter(x => x !== uri)) },
    ]);
  };

  const handleSave = () => {
    if (!description.trim()) { setDescError(true); return; }
    if (severity === DefectSeverity.Critical && photos.length === 0) {
      Toast.show({ type: 'error', text1: 'Photos required', text2: 'Critical defects need visual evidence.' });
      return;
    }
    addDefect({
      job_id: jobId, property_id: propertyId,
      asset_id: assetId || 'unlinked',
      description, severity,
      photos: photos as any,
      defect_code: selectedCode?.code ?? null,
      quote_price: selectedCode?.quote_price ?? null,
    });
    sheetRef.current?.close();
    onSaved();
    Toast.show({ type: 'success', text1: 'Defect logged ✓' });
  };

  const selectedAsset = assets.find(a => a.id === assetId) ?? null;
  const sevCfg = SEV_CFG.find(s => s.value === severity)!;

  // ─── Step 1: Severity ──────────────────────────────────────
  const renderStep1 = () => (
    <View style={s.stepWrap}>
      <Text style={[s.stepTitle, { color: C.text }]}>How severe is this defect?</Text>
      <Text style={[s.stepSub, { color: C.textSecondary }]}>This determines urgency and client priority</Text>
      <View style={s.sevStack}>
        {SEV_CFG.map(cfg => {
          const active = severity === cfg.value;
          return (
            <TouchableOpacity
              key={cfg.value}
              style={[s.sevCard, { borderColor: active ? cfg.color : C.border, backgroundColor: active ? cfg.color + '12' : C.surface }]}
              onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); setSeverity(cfg.value); }}
              activeOpacity={0.8}
            >
              <View style={[s.sevIconWrap, { backgroundColor: active ? cfg.color : C.backgroundTertiary }]}>
                <MaterialCommunityIcons name={cfg.icon as any} size={22} color={active ? '#FFF' : C.textSecondary} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[s.sevLabel, { color: active ? cfg.color : C.text }]}>{cfg.label}</Text>
                <Text style={[s.sevDesc, { color: C.textSecondary }]}>{cfg.desc}</Text>
              </View>
              {active && <MaterialCommunityIcons name="check-circle" size={20} color={cfg.color} />}
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );

  // ─── Step 2: Asset ────────────────────────────────────────
  const renderStep2 = () => (
    <View style={s.stepWrap}>
      <Text style={[s.stepTitle, { color: C.text }]}>Link to an asset</Text>
      <Text style={[s.stepSub, { color: C.textSecondary }]}>Which asset is affected? (optional)</Text>

      {/* None option */}
      <TouchableOpacity
        style={[s.assetCard, { borderColor: assetId === '' ? C.primary : C.border, backgroundColor: assetId === '' ? C.primary + '10' : C.surface }]}
        onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); setAssetId(''); }}
        activeOpacity={0.8}
      >
        <View style={[s.assetIconBox, { backgroundColor: assetId === '' ? C.primary + '20' : C.backgroundTertiary }]}>
          <MaterialCommunityIcons name="link-off" size={20} color={assetId === '' ? C.primary : C.textTertiary} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={[s.assetName, { color: assetId === '' ? C.primary : C.text }]}>Not linked to an asset</Text>
          <Text style={[s.assetMeta, { color: C.textTertiary }]}>General site defect</Text>
        </View>
        {assetId === '' && <MaterialCommunityIcons name="check-circle" size={18} color={C.primary} />}
      </TouchableOpacity>

      {assets.length === 0 ? (
        <View style={[s.emptyBox, { backgroundColor: C.backgroundTertiary }]}>
          <Text style={[s.emptyTxt, { color: C.textTertiary }]}>No assets registered for this property</Text>
        </View>
      ) : (
        assets.map(a => {
          const active = assetId === a.id;
          const iconName = getAssetTypeIcon(a.asset_type);
          return (
            <TouchableOpacity
              key={a.id}
              style={[s.assetCard, { borderColor: active ? C.accent : C.border, backgroundColor: active ? C.accent + '0E' : C.surface }]}
              onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); setAssetId(a.id); }}
              activeOpacity={0.8}
            >
              <View style={[s.assetIconBox, { backgroundColor: active ? C.accent + '20' : C.backgroundTertiary }]}>
                <MaterialCommunityIcons name={iconName as any} size={20} color={active ? C.accent : C.textSecondary} />
              </View>
              <View style={{ flex: 1, gap: 3 }}>
                <Text style={[s.assetName, { color: active ? C.accent : C.text }]} numberOfLines={1}>
                  {formatAssetType(a.asset_type)}
                  {a.variant ? ` — ${a.variant}` : ''}
                </Text>
                <View style={s.assetMetaRow}>
                  {a.location_on_site && (
                    <View style={s.metaChip}>
                      <MaterialCommunityIcons name="map-marker-outline" size={11} color={C.textTertiary} />
                      <Text style={[s.assetMeta, { color: C.textTertiary }]} numberOfLines={1}>{a.location_on_site}</Text>
                    </View>
                  )}
                  {(a.asset_ref || a.serial_number) && (
                    <View style={s.metaChip}>
                      <MaterialCommunityIcons name="barcode" size={11} color={C.textTertiary} />
                      <Text style={[s.assetMeta, { color: C.textTertiary }]}>
                        {a.asset_ref ? `Ref: ${a.asset_ref}` : `S/N: ${a.serial_number}`}
                      </Text>
                    </View>
                  )}
                </View>
                {a.last_service_date && (
                  <Text style={[s.assetServiceDate, { color: C.textTertiary }]}>
                    Last serviced: {new Date(a.last_service_date).toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' })}
                  </Text>
                )}
              </View>
              {active && <MaterialCommunityIcons name="check-circle" size={18} color={C.accent} />}
            </TouchableOpacity>
          );
        })
      )}
    </View>
  );

  // ─── Step 3: Description + Photos ────────────────────────
  const renderStep3 = () => (
    <View style={s.stepWrap}>
      <Text style={[s.stepTitle, { color: C.text }]}>Describe the defect</Text>
      <Text style={[s.stepSub, { color: C.textSecondary }]}>Use the code library or type your own description</Text>

      {/* Code library picker */}
      <TouchableOpacity
        style={[s.codeBtn, { borderColor: selectedCode ? C.primary : C.border, backgroundColor: selectedCode ? C.primary + '0C' : C.surface }]}
        onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); setCodeVisible(true); }}
        activeOpacity={0.8}
      >
        <View style={[s.codeIconBox, { backgroundColor: selectedCode ? C.primary + '20' : C.backgroundTertiary }]}>
          <MaterialCommunityIcons name={selectedCode ? 'tag-check-outline' : 'tag-search-outline'} size={18} color={selectedCode ? C.primary : C.textSecondary} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={[s.codeBtnTitle, { color: selectedCode ? C.primary : C.text }]}>
            {selectedCode ? `Code: ${selectedCode.code.toUpperCase()}` : 'Browse Code Library'}
          </Text>
          <Text style={[s.codeBtnSub, { color: C.textSecondary }]} numberOfLines={1}>
            {selectedCode ? selectedCode.description : '100+ Uptick defect codes with suggested prices'}
          </Text>
        </View>
        {selectedCode ? (
          <TouchableOpacity onPress={() => { setSelectedCode(null); setDescription(''); }} hitSlop={8}>
            <MaterialCommunityIcons name="close-circle" size={18} color={C.textTertiary} />
          </TouchableOpacity>
        ) : (
          <MaterialCommunityIcons name="chevron-right" size={18} color={C.textTertiary} />
        )}
      </TouchableOpacity>

      {/* Description input */}
      <View style={[s.inputWrap, { borderColor: descError ? C.error : C.border, backgroundColor: C.surface }]}>
        <TextInput
          style={[s.input, { color: C.text }]}
          placeholderTextColor={C.textTertiary}
          placeholder="Describe what you observed on site…"
          multiline
          maxLength={500}
          value={description}
          onChangeText={v => { setDescription(v); if (v.trim()) setDescError(false); if (selectedCode && v !== selectedCode.description) setSelectedCode(null); }}
        />
        <Text style={[s.charCount, { color: C.textTertiary }]}>{description.length}/500</Text>
      </View>
      {descError && (
        <View style={[s.errRow, { backgroundColor: C.errorLight }]}>
          <MaterialCommunityIcons name="alert-circle-outline" size={14} color={C.error} />
          <Text style={[s.errTxt, { color: C.error }]}>Description is required</Text>
        </View>
      )}

      {/* Photos */}
      <View style={s.photoSection}>
        <View style={s.photoHeader}>
          <Text style={[s.photoLabel, { color: C.text }]}>
            Photos {severity === DefectSeverity.Critical ? '(required for Critical)' : '(optional)'}
          </Text>
          <TouchableOpacity style={[s.addPhotoBtn, { borderColor: C.accent, backgroundColor: C.accent + '10' }]} onPress={handlePhoto} activeOpacity={0.8}>
            <MaterialCommunityIcons name="camera-plus-outline" size={16} color={C.accent} />
            <Text style={[s.addPhotoTxt, { color: C.accent }]}>Add Photo</Text>
          </TouchableOpacity>
        </View>

        {photos.length > 0 && (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.photoRow}>
            {photos.map(uri => (
              <TouchableOpacity key={uri} onLongPress={() => removePhoto(uri)} activeOpacity={0.85} style={s.thumbWrap}>
                <Image source={{ uri: getValidLocalUri(uri) }} style={s.thumb} contentFit="cover" />
                <TouchableOpacity style={s.thumbDel} onPress={() => removePhoto(uri)}>
                  <MaterialCommunityIcons name="close" size={12} color="#FFF" />
                </TouchableOpacity>
              </TouchableOpacity>
            ))}
          </ScrollView>
        )}
        {photos.length === 0 && (
          <Text style={[s.noPhotoTxt, { color: C.textTertiary }]}>Tap camera to attach photos</Text>
        )}
      </View>
    </View>
  );

  // ─── Summary bar (always visible at bottom) ───────────────
  const renderSummary = () => (
    <View style={[s.summaryBar, { backgroundColor: C.backgroundTertiary, borderColor: C.border }]}>
      <View style={[s.summaryDot, { backgroundColor: sevCfg.color }]} />
      <Text style={[s.summaryTxt, { color: C.text }]} numberOfLines={1}>
        {sevCfg.label}
        {selectedAsset ? ` · ${formatAssetType(selectedAsset.asset_type)}` : ''}
        {description.trim() ? ` · "${description.slice(0, 30)}${description.length > 30 ? '…' : ''}"` : ''}
      </Text>
    </View>
  );

  return (
    <>
      <BottomSheet
        ref={sheetRef}
        index={-1}
        snapPoints={['80%', '95%']}
        enablePanDownToClose
        backdropComponent={p => <BottomSheetBackdrop {...p} disappearsOnIndex={-1} appearsOnIndex={0} />}
        backgroundStyle={{ backgroundColor: C.background }}
        handleIndicatorStyle={{ backgroundColor: C.border }}
      >
        <BottomSheetScrollView contentContainerStyle={s.sheet} showsVerticalScrollIndicator={false}>

          {/* Header */}
          <View style={s.header}>
            <View style={[s.headerIcon, { backgroundColor: sevCfg.color + '18' }]}>
              <MaterialCommunityIcons name="alert-circle-outline" size={22} color={sevCfg.color} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[s.headerTitle, { color: C.text }]}>Log New Defect</Text>
              <Text style={[s.headerSub, { color: C.textSecondary }]}>Step {step} of 3</Text>
            </View>
          </View>

          {/* Step tabs */}
          <View style={s.tabs}>
            {(['Severity', 'Asset', 'Details'] as const).map((label, i) => {
              const idx = i + 1;
              const active = step === idx;
              const done = step > idx;
              return (
                <TouchableOpacity
                  key={label}
                  style={[s.tab, { borderBottomColor: active ? sevCfg.color : done ? C.success : C.border }]}
                  onPress={() => setStep(idx as 1|2|3)}
                  activeOpacity={0.7}
                >
                  <Text style={[s.tabTxt, { color: active ? sevCfg.color : done ? C.success : C.textTertiary }]}>
                    {done ? '✓ ' : ''}{label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          {/* Summary pill */}
          {renderSummary()}

          {/* Step content */}
          {step === 1 && renderStep1()}
          {step === 2 && renderStep2()}
          {step === 3 && renderStep3()}

          {/* Navigation */}
          <View style={s.navRow}>
            {step > 1 ? (
              <TouchableOpacity style={[s.backBtn, { borderColor: C.border }]} onPress={() => setStep(s => (s - 1) as 1|2|3)}>
                <MaterialCommunityIcons name="arrow-left" size={16} color={C.text} />
                <Text style={[s.backBtnTxt, { color: C.text }]}>Back</Text>
              </TouchableOpacity>
            ) : <View style={{ flex: 1 }} />}

            {step < 3 ? (
              <TouchableOpacity
                style={[s.nextBtn, { backgroundColor: sevCfg.color }]}
                onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); setStep(s => (s + 1) as 1|2|3); }}
                activeOpacity={0.85}
              >
                <Text style={s.nextBtnTxt}>Next</Text>
                <MaterialCommunityIcons name="arrow-right" size={16} color="#FFF" />
              </TouchableOpacity>
            ) : (
              <TouchableOpacity
                style={[s.nextBtn, { backgroundColor: description.trim() ? C.success : C.textTertiary }]}
                onPress={handleSave}
                disabled={!description.trim()}
                activeOpacity={0.85}
              >
                <MaterialCommunityIcons name="check" size={16} color="#FFF" />
                <Text style={s.nextBtnTxt}>Save Defect</Text>
              </TouchableOpacity>
            )}
          </View>

        </BottomSheetScrollView>
      </BottomSheet>

      <DefectCodePicker visible={codeVisible} onSelect={handleCodeSelect} onClose={() => setCodeVisible(false)} />
    </>
  );
});

AddDefectSheet.displayName = 'AddDefectSheet';
export default AddDefectSheet;

// ─── Styles ───────────────────────────────────────────────────
const s = StyleSheet.create({
  sheet: { paddingBottom: 48 },

  header: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 20, paddingVertical: 16 },
  headerIcon: { width: 44, height: 44, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontSize: 17, fontWeight: '800' },
  headerSub:   { fontSize: 12, marginTop: 2 },

  tabs: { flexDirection: 'row', paddingHorizontal: 20, marginBottom: 4 },
  tab:  { flex: 1, paddingVertical: 10, alignItems: 'center', borderBottomWidth: 2 },
  tabTxt: { fontSize: 12, fontWeight: '700' },

  summaryBar: { flexDirection: 'row', alignItems: 'center', gap: 8, marginHorizontal: 20, marginBottom: 4, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 10, borderWidth: 1 },
  summaryDot: { width: 8, height: 8, borderRadius: 4 },
  summaryTxt: { fontSize: 12, fontWeight: '600', flex: 1 },

  stepWrap:  { paddingHorizontal: 20, paddingTop: 12, gap: 10 },
  stepTitle: { fontSize: 15, fontWeight: '800' },
  stepSub:   { fontSize: 13, marginTop: -4, marginBottom: 4 },

  // Severity
  sevStack:   { gap: 10 },
  sevCard:    { flexDirection: 'row', alignItems: 'center', gap: 14, padding: 16, borderRadius: 16, borderWidth: 1.5 },
  sevIconWrap: { width: 44, height: 44, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  sevLabel:   { fontSize: 15, fontWeight: '800' },
  sevDesc:    { fontSize: 12, marginTop: 2 },

  // Asset
  assetCard:    { flexDirection: 'row', alignItems: 'flex-start', gap: 12, padding: 14, borderRadius: 14, borderWidth: 1.5 },
  assetIconBox: { width: 40, height: 40, borderRadius: 10, alignItems: 'center', justifyContent: 'center', marginTop: 2 },
  assetName:    { fontSize: 14, fontWeight: '700' },
  assetMetaRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  metaChip:     { flexDirection: 'row', alignItems: 'center', gap: 3 },
  assetMeta:    { fontSize: 11 },
  assetServiceDate: { fontSize: 10, marginTop: 2 },
  emptyBox:     { padding: 16, borderRadius: 12, alignItems: 'center' },
  emptyTxt:     { fontSize: 13 },

  // Code picker
  codeBtn:    { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, borderRadius: 14, borderWidth: 1.5 },
  codeIconBox: { width: 38, height: 38, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  codeBtnTitle: { fontSize: 13, fontWeight: '700' },
  codeBtnSub:   { fontSize: 11, marginTop: 2 },

  // Input
  inputWrap:  { borderRadius: 14, borderWidth: 1.5, padding: 14, minHeight: 110 },
  input:      { fontSize: 14, lineHeight: 21, textAlignVertical: 'top', flex: 1 },
  charCount:  { fontSize: 11, textAlign: 'right', marginTop: 6 },
  errRow:     { flexDirection: 'row', alignItems: 'center', gap: 6, padding: 10, borderRadius: 10 },
  errTxt:     { fontSize: 12, fontWeight: '600' },

  // Photos
  photoSection: { gap: 10, marginTop: 4 },
  photoHeader:  { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  photoLabel:   { fontSize: 13, fontWeight: '700' },
  addPhotoBtn:  { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, paddingVertical: 7, borderRadius: 10, borderWidth: 1 },
  addPhotoTxt:  { fontSize: 12, fontWeight: '700' },
  photoRow:     { gap: 10, paddingBottom: 4 },
  thumbWrap:    { position: 'relative' },
  thumb:        { width: 80, height: 80, borderRadius: 12 },
  thumbDel:     { position: 'absolute', top: 4, right: 4, width: 22, height: 22, borderRadius: 11, backgroundColor: 'rgba(0,0,0,0.6)', alignItems: 'center', justifyContent: 'center' },
  noPhotoTxt:   { fontSize: 12, fontStyle: 'italic' },

  // Navigation
  navRow:     { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingTop: 20, gap: 12 },
  backBtn:    { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 16, paddingVertical: 12, borderRadius: 12, borderWidth: 1, flex: 1 },
  backBtnTxt: { fontSize: 14, fontWeight: '700' },
  nextBtn:    { flex: 2, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, height: 50, borderRadius: 14 },
  nextBtnTxt: { color: '#FFF', fontSize: 15, fontWeight: '800' },
});
