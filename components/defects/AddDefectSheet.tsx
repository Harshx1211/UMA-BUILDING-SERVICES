import React, { useState, forwardRef, useImperativeHandle, useRef, useEffect } from 'react';
import { View, StyleSheet, TouchableOpacity, TextInput, FlatList, ScrollView } from 'react-native';
import { Text } from 'react-native-paper';
import BottomSheet, { BottomSheetScrollView, BottomSheetBackdrop } from '@gorhom/bottom-sheet';
import { useColors } from '@/hooks/useColors';
import { DefectSeverity } from '@/constants/Enums';
import { useDefectsStore } from '@/store/defectsStore';
import * as ImagePicker from 'expo-image-picker';
import * as FileSystem from 'expo-file-system/legacy';
import { Image } from 'expo-image';
import { Asset } from '@/types';
import { getAssetsForProperty } from '@/lib/database';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import Toast from 'react-native-toast-message';
import * as Haptics from 'expo-haptics';
import DefectCodePicker from '@/components/defects/DefectCodePicker';
import type { DefectCode } from '@/constants/DefectCodes';
import { getValidLocalUri } from '@/utils/fileHelpers';

interface Props {
  jobId: string;
  propertyId: string;
  onSaved: () => void;
}

export interface AddDefectSheetRef {
  open: () => void;
  close: () => void;
}

const AddDefectSheet = forwardRef<AddDefectSheetRef, Props>(({ jobId, propertyId, onSaved }, ref) => {
  const C = useColors();
  const bottomSheetRef = useRef<BottomSheet>(null);
  const snapPoints = ['75%', '90%'];

  const { addDefect } = useDefectsStore();
  const [severity, setSeverity] = useState<DefectSeverity>(DefectSeverity.Minor);
  const [assetId, setAssetId] = useState<string>('');
  const [description, setDescription] = useState<string>('');
  const [photos, setPhotos] = useState<string[]>([]);
  const [assets, setAssets] = useState<Asset[]>([]);
  const [pickerVisible, setPickerVisible] = useState(false);
  const [selectedCode, setSelectedCode] = useState<DefectCode | null>(null);
  const [suggestedPrice, setSuggestedPrice] = useState<number | null>(null);
  const [reasonError, setReasonError] = useState(false);

  useEffect(() => {
    setAssets(getAssetsForProperty(propertyId));
  }, [propertyId]);

  useImperativeHandle(ref, () => ({
    open: () => {
      setSeverity(DefectSeverity.Minor);
      setAssetId('');
      setDescription('');
      setPhotos([]);
      setSelectedCode(null);
      setSuggestedPrice(null);
      setReasonError(false);
      bottomSheetRef.current?.expand();
    },
    close: () => {
      bottomSheetRef.current?.close();
    }
  }));

  const handleCodeSelect = (code: DefectCode | null) => {
    setPickerVisible(false);
    if (code === null) {
      setSelectedCode(null);
      setSuggestedPrice(null);
    } else {
      setSelectedCode(code);
      setDescription(code.description);
      setSuggestedPrice(code.quote_price ?? null);
      setReasonError(false);
      if (code.category === 'Alarm' || (code.quote_price && code.quote_price >= 300)) {
        setSeverity(DefectSeverity.Major);
      }
    }
  };

  const handleTakePhoto = async () => {
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    if (!perm.granted) return;
    const result = await ImagePicker.launchCameraAsync({ quality: 0.7 });
    if (!result.canceled && result.assets.length > 0) {
      const sourceUri = result.assets[0].uri;
      const filename = sourceUri.split('/').pop() || `photo_${Date.now()}.jpg`;
      const destUri = `${FileSystem.documentDirectory}${filename}`;
      try {
        await FileSystem.copyAsync({ from: sourceUri, to: destUri });
        setPhotos([...photos, destUri]);
      } catch (e) {
        console.warn('Failed to copy image', e);
        setPhotos([...photos, sourceUri]);
      }
    }
  };

  const handleSave = () => {
    if (!description.trim() || !severity) {
      setReasonError(true);
      return;
    }
    if (severity === DefectSeverity.Critical && photos.length === 0) {
      Toast.show({ type: 'error', text1: 'Photos required', text2: 'Critical defects must have visual evidence.' });
      return;
    }

    addDefect({
      job_id: jobId,
      property_id: propertyId,
      asset_id: assetId === '' ? 'unlinked' : assetId,
      description,
      severity,
      photos: JSON.stringify(photos) as any, // Text storage mapped to DB correctly
      defect_code: selectedCode?.code ?? null,
      quote_price: suggestedPrice,
    });
    bottomSheetRef.current?.close();
    onSaved();
  };

  const SeverityCard = ({ type, title, subtitle, color }: any) => {
    const isSelected = severity === type;
    return (
      <TouchableOpacity
        style={[s.sevCard, isSelected && { backgroundColor: color, borderColor: color }]}
        onPress={() => setSeverity(type)}
        activeOpacity={0.8}
      >
        <Text style={[s.sevTitle, isSelected && { color: '#FFF' }]}>{title}</Text>
        <Text style={[s.sevSub, isSelected && { color: 'rgba(255,255,255,0.8)' }]}>{subtitle}</Text>
      </TouchableOpacity>
    );
  };

  return (
    <>
      <BottomSheet
        ref={bottomSheetRef}
        index={-1}
        snapPoints={snapPoints}
        enablePanDownToClose
        backdropComponent={(props) => (
          <BottomSheetBackdrop {...props} disappearsOnIndex={-1} appearsOnIndex={0} />
        )}
        backgroundStyle={{ backgroundColor: C.background }}
      >
        <BottomSheetScrollView contentContainerStyle={s.content}>
          <Text style={[s.title, { color: C.text }]}>Log New Defect</Text>
          <Text style={[s.subtitle, { color: C.textSecondary }]}>Document an issue found on site</Text>

          <Text style={[s.label, { color: C.text }]}>Severity (required)</Text>
          <View style={s.sevRow}>
            <SeverityCard type={DefectSeverity.Minor} title="🔵 Minor" subtitle="Won't affect safety immediately" color={C.info} />
            <SeverityCard type={DefectSeverity.Major} title="🟡 Major" subtitle="Needs attention soon" color={C.warningDark || C.warning} />
            <SeverityCard type={DefectSeverity.Critical} title="🔴 Critical" subtitle="Immediate safety risk" color={C.error} />
          </View>

          <Text style={[s.label, { color: C.text }]}>Link to Asset (optional)</Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={s.assetChipRow}
          >
            {/* None chip */}
            <TouchableOpacity
              style={[
                s.assetChip,
                assetId === ''
                  ? { backgroundColor: C.primary, borderColor: C.primary }
                  : { backgroundColor: C.surface, borderColor: C.border },
              ]}
              onPress={() => setAssetId('')}
              activeOpacity={0.75}
            >
              <MaterialCommunityIcons
                name="link-off"
                size={13}
                color={assetId === '' ? '#FFF' : C.textSecondary}
              />
              <Text style={[s.assetChipTxt, { color: assetId === '' ? '#FFF' : C.textSecondary }]}>
                None
              </Text>
            </TouchableOpacity>

            {assets.map(a => {
              const isSelected = assetId === a.id;
              return (
                <TouchableOpacity
                  key={a.id}
                  style={[
                    s.assetChip,
                    isSelected
                      ? { backgroundColor: C.primary, borderColor: C.primary }
                      : { backgroundColor: C.surface, borderColor: C.border },
                  ]}
                  onPress={() => setAssetId(a.id)}
                  activeOpacity={0.75}
                >
                  <MaterialCommunityIcons
                    name="shield-check-outline"
                    size={13}
                    color={isSelected ? '#FFF' : C.textSecondary}
                  />
                  <View>
                    <Text style={[s.assetChipTxt, { color: isSelected ? '#FFF' : C.text }]} numberOfLines={1}>
                      {a.asset_type}
                    </Text>
                    {a.location_on_site ? (
                      <Text style={[s.assetChipSub, { color: isSelected ? 'rgba(255,255,255,0.75)' : C.textTertiary }]} numberOfLines={1}>
                        {a.location_on_site}
                      </Text>
                    ) : null}
                  </View>
                </TouchableOpacity>
              );
            })}
          </ScrollView>

          <Text style={[s.label, { color: C.text }]}>Description (required)</Text>
          {reasonError && (
            <View style={[s.errorBanner, { backgroundColor: C.errorLight, borderColor: C.error }]}>
              <MaterialCommunityIcons name="alert-circle" size={14} color={C.error} />
              <Text style={[s.errorBannerTxt, { color: C.error }]}>Please provide a description.</Text>
            </View>
          )}

          {/* Code Library Button */}
          <TouchableOpacity
            style={[s.codePickerBtn, { backgroundColor: C.surface, borderColor: selectedCode ? C.primary : C.border }]}
            onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); setPickerVisible(true); }}
            activeOpacity={0.8}
          >
            <View style={[s.codePickerIcon, { backgroundColor: selectedCode ? C.primary + '18' : C.backgroundTertiary }]}>
              <MaterialCommunityIcons
                name={selectedCode ? 'tag-check-outline' : 'tag-search-outline'}
                size={18}
                color={selectedCode ? C.primary : C.textSecondary}
              />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[s.codePickerTitle, { color: selectedCode ? C.primary : C.text }]}>
                {selectedCode ? `Code: ${selectedCode.code.toUpperCase()}` : 'Select from Code Library'}
              </Text>
              <Text style={[s.codePickerSub, { color: C.textSecondary }]} numberOfLines={1}>
                {selectedCode ? selectedCode.description : 'Browse 100+ Uptick defect codes'}
              </Text>
            </View>
            {suggestedPrice !== null && (
              <View style={s.priceBadge}>
                <Text style={s.priceBadgeTxt}>${suggestedPrice}</Text>
              </View>
            )}
            {selectedCode ? (
              <TouchableOpacity
                onPress={() => { setSelectedCode(null); setSuggestedPrice(null); }}
                hitSlop={8}
                style={{ padding: 4 }}
              >
                <MaterialCommunityIcons name="close-circle" size={18} color={C.textTertiary} />
              </TouchableOpacity>
            ) : (
              <MaterialCommunityIcons name="chevron-right" size={18} color={C.textTertiary} />
            )}
          </TouchableOpacity>

          <TextInput
            style={[s.input, { backgroundColor: C.surface, borderColor: reasonError ? C.error : C.border, color: C.text, marginTop: 12 }]}
            placeholderTextColor={C.textTertiary}
            placeholder="Or type a custom description…"
            multiline
            maxLength={500}
            value={description}
            onChangeText={v => {
              setDescription(v);
              if (v.trim()) setReasonError(false);
              if (selectedCode && v !== selectedCode.description) {
                setSelectedCode(null);
                setSuggestedPrice(null);
              }
            }}
          />
          <Text style={[s.charCount, { color: C.textTertiary }]}>{description.length}/500</Text>

          <TouchableOpacity style={[s.addPhotosBtn, { borderColor: C.accent }]} onPress={handleTakePhoto}>
            <MaterialCommunityIcons name="camera-plus" size={20} color={C.accent} />
            <Text style={[s.addPhotosText, { color: C.accent }]}>Add Photos</Text>
          </TouchableOpacity>

          {photos.length > 0 && (
            <FlatList
              data={photos}
              horizontal
              keyExtractor={item => item}
              style={s.photoList}
              contentContainerStyle={{ gap: 8 }}
              renderItem={({item}) => <Image source={{ uri: getValidLocalUri(item) }} style={s.thumb} />}
            />
          )}

          <TouchableOpacity
            style={[s.saveBtn, { backgroundColor: C.accent }, (!description.trim()) && s.saveBtnDisabled]}
            disabled={!description.trim()}
            onPress={handleSave}
          >
            <Text style={s.saveBtnText}>Save Defect</Text>
          </TouchableOpacity>
        </BottomSheetScrollView>
      </BottomSheet>

      {/* Defect Code Picker (full-screen modal) */}
      <DefectCodePicker
        visible={pickerVisible}
        onSelect={handleCodeSelect}
        onClose={() => setPickerVisible(false)}
      />
    </>
  );
});

const s = StyleSheet.create({
  content: { padding: 24, paddingBottom: 64 },
  title: { fontSize: 18, fontWeight: '700' },
  subtitle: { fontSize: 13, marginBottom: 24 },
  label: { fontSize: 14, fontWeight: '700', marginTop: 16, marginBottom: 8 },
  sevRow: { flexDirection: 'row', gap: 8, justifyContent: 'space-between' },
  sevCard: { flex: 1, borderWidth: 1, borderRadius: 12, padding: 12, minHeight: 90 },
  sevTitle: { fontSize: 14, fontWeight: '700', marginBottom: 4 },
  sevSub: { fontSize: 11, lineHeight: 14 },
  // Asset chip selector
  assetChipRow: { gap: 8, paddingBottom: 4 },
  assetChip: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, paddingVertical: 9, borderRadius: 14, borderWidth: 1.5, maxWidth: 180 },
  assetChipTxt: { fontSize: 12, fontWeight: '700' },
  assetChipSub: { fontSize: 10, marginTop: 1 },

  // Error banner
  errorBanner: { flexDirection: 'row', alignItems: 'center', gap: 6, padding: 10, borderRadius: 8, borderWidth: 1, marginBottom: 10 },
  errorBannerTxt: { fontSize: 12, fontWeight: '600', flex: 1 },

  // Code picker button
  codePickerBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    padding: 14, borderRadius: 14, borderWidth: 1.5,
  },
  codePickerIcon: {
    width: 38, height: 38, borderRadius: 10,
    alignItems: 'center', justifyContent: 'center',
  },
  codePickerTitle: { fontSize: 13, fontWeight: '700' },
  codePickerSub:   { fontSize: 11, marginTop: 2 },
  priceBadge: {
    backgroundColor: '#10B981' + '18',
    borderWidth: 1,
    borderColor: '#10B981' + '40',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  priceBadgeTxt: { fontSize: 11, fontWeight: '800', color: '#10B981' },

  input: { borderRadius: 12, borderWidth: 1, padding: 16, paddingTop: 16, fontSize: 14, minHeight: 120, textAlignVertical: 'top' },
  charCount: { textAlign: 'right', fontSize: 12, marginTop: 4 },
  addPhotosBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', borderWidth: 1.5, borderRadius: 12, height: 52, marginTop: 16, gap: 8, borderStyle: 'solid' },
  addPhotosText: { fontWeight: '700', fontSize: 15 },
  photoList: { marginTop: 16 },
  thumb: { width: 60, height: 60, borderRadius: 8 },
  saveBtn: { height: 52, borderRadius: 12, justifyContent: 'center', alignItems: 'center', marginTop: 32 },
  saveBtnDisabled: { opacity: 0.5 },
  saveBtnText: { color: '#FFF', fontSize: 16, fontWeight: '700' },
});

AddDefectSheet.displayName = 'AddDefectSheet';

export default AddDefectSheet;
