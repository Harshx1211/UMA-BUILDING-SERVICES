import React, { useState, forwardRef, useImperativeHandle, useRef, useEffect } from 'react';
import { View, StyleSheet, TouchableOpacity, TextInput, ScrollView } from 'react-native';
import { Text } from 'react-native-paper';
import BottomSheet, { BottomSheetScrollView, BottomSheetBackdrop } from '@gorhom/bottom-sheet';
import { useColors } from '@/hooks/useColors';
import { CameraView, useCameraPermissions, FlashMode } from 'expo-camera';

import * as ImageManipulator from 'expo-image-manipulator';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { usePhotosStore } from '@/store/photosStore';
import { getAssetsForProperty } from '@/lib/database';
import { useAuthStore } from '@/store/authStore';
import { Asset } from '@/types';
import Toast from 'react-native-toast-message';
import * as FileSystem from 'expo-file-system/legacy';

interface Props {
  jobId: string;
  propertyId: string;
}

export interface PhotoCaptureSheetRef {
  open: () => void;
  close: () => void;
}

const PhotoCaptureSheet = forwardRef<PhotoCaptureSheetRef, Props>(({ jobId, propertyId }, ref) => {
  const C = useColors();
  const bottomSheetRef = useRef<BottomSheet>(null);
  const cameraRef = useRef<CameraView>(null);
  const snapPoints = ['92%'];

  const { addPhoto } = usePhotosStore();
  const [permission, requestPermission] = useCameraPermissions();
  
  const [facing, setFacing] = useState<'back' | 'front'>('back');
  const [flash, setFlash] = useState<FlashMode>('off');
  const [caption, setCaption] = useState('');
  const [assetId, setAssetId] = useState('');
  const [assets, setAssets] = useState<Asset[]>([]);
  const [photosTaken, setPhotosTaken] = useState(0);

  useEffect(() => {
    setAssets(getAssetsForProperty(propertyId));
  }, [propertyId]);

  useImperativeHandle(ref, () => ({
    open: async () => {
      setCaption('');
      setAssetId('');
      setPhotosTaken(0);
      if (!permission?.granted) await requestPermission();

      bottomSheetRef.current?.expand();
    },
    close: () => {
      bottomSheetRef.current?.close();
    }
  }));

  const cycleFlash = () => {
    if (flash === 'off') setFlash('on');
    else if (flash === 'on') setFlash('auto');
    else setFlash('off');
  };

  // Bug #2 fix: clear filled vs outline flash states
  const getFlashIcon = (): React.ComponentProps<typeof MaterialCommunityIcons>['name'] => {
    if (flash === 'on')   return 'flash';       // filled = clearly ON
    if (flash === 'auto') return 'flash-auto';  // filled auto = intermediate
    return 'flash-off';                          // filled with X = clearly OFF
  };
  const getFlashColor = (): string => {
    if (flash === 'on')   return '#F59E0B';  // amber = active
    if (flash === 'auto') return '#94A3B8';  // slate = auto/standby
    return 'rgba(255,255,255,0.4)';           // muted = off
  };

  const takePicture = async () => {
    if (!cameraRef.current) return;
    try {
      const photo = await cameraRef.current.takePictureAsync({ quality: 0.8 });
      if (photo) {
        // Industry standard compression (saves MBs per job)
        const manipResult = await ImageManipulator.manipulateAsync(
          photo.uri,
          [{ resize: { width: 1600 } }],
          { compress: 0.7, format: ImageManipulator.SaveFormat.JPEG }
        );

        // Save to document directory for permanent app access
        const filename = `photo_${Date.now()}.jpg`;
        const destUri = `${FileSystem.documentDirectory}${filename}`;
        
        try {
          await FileSystem.copyAsync({ from: manipResult.uri, to: destUri });
        } catch (e) {
          console.warn('Failed to copy to document directory', e);
        }

        const currentUserId = useAuthStore.getState().user?.id ?? null;

        // Defensive guard — the app layout enforces authentication, so user?.id
        // should never be null here. But if it somehow is, abort gracefully.
        if (!currentUserId) {
          Toast.show({
            type: 'error',
            text1: 'Session Error',
            text2: 'Please re-sign in before taking photos.',
          });
          return;
        }

        addPhoto({
          job_id: jobId,
          asset_id: assetId === '' ? null : assetId,
          defect_id: null,
          photo_url: destUri,
          caption: caption.trim() || null,
          // Use null rather than 'unknown' — 'unknown' is not a valid UUID and
          // would silently fail Supabase FK constraints. The photoUpload H1 guard
          // prevents queue processing without a valid user.id anyway.
          uploaded_by: currentUserId,
        });

        setPhotosTaken(prev => prev + 1);
        setCaption(''); // reset per photo as a nice touch
        Toast.show({ type: 'success', text1: 'Photo saved ✓' });
      }
    } catch (e) {
      console.error(e);
      Toast.show({ type: 'error', text1: 'Failed to take photo' });
    }
  };

  return (
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
      <View style={s.topBar}>
        <TouchableOpacity style={[s.doneBtn, { backgroundColor: C.accent + '18', borderWidth: 1, borderColor: C.accent + '40' }]} onPress={() => bottomSheetRef.current?.close()}>
          <MaterialCommunityIcons name="check" size={16} color={C.accent} />
          <Text style={[s.doneText, { color: C.accent }]}>Done ({photosTaken} taken)</Text>
        </TouchableOpacity>
      </View>
      <BottomSheetScrollView contentContainerStyle={s.content}>
        
        {permission?.granted ? (
          <View style={s.cameraContainer}>
            <CameraView 
              ref={cameraRef}
              style={s.camera} 
              facing={facing} 
              flash={flash}
              animateShutter={false}
            />
            <View style={s.cameraOverlay}>
              <TouchableOpacity onPress={() => setFacing(f => f === 'back' ? 'front' : 'back')} style={s.camBtn}>
                <MaterialCommunityIcons name="camera-flip" size={24} color="#FFF" />
              </TouchableOpacity>
              <TouchableOpacity onPress={cycleFlash} style={[
                s.camBtn,
                flash === 'on' && { backgroundColor: 'rgba(245,158,11,0.3)' },
              ]}>
                <MaterialCommunityIcons name={getFlashIcon()} size={24} color={getFlashColor()} />
              </TouchableOpacity>
            </View>
          </View>
        ) : (
          <View style={[s.cameraContainer, { justifyContent: 'center', alignItems: 'center', gap: 16, backgroundColor: C.backgroundSecondary }]}>
            <MaterialCommunityIcons name="camera-off" size={40} color={C.textTertiary} />
            <Text style={{ color: C.textSecondary, fontSize: 15, fontWeight: '700' }}>Camera permission required</Text>
            <Text style={{ color: C.textTertiary, fontSize: 13, textAlign: 'center', paddingHorizontal: 32 }}>Go to Settings and allow camera access to take photos during inspections.</Text>
          </View>
        )}

        <View style={s.form}>
          <Text style={[s.label, { color: C.textSecondary }]}>Add a caption (optional)</Text>
          <TextInput
            style={[s.input, { backgroundColor: C.surface, borderColor: C.border, color: C.text }]}
            placeholderTextColor={C.textTertiary}
            placeholder="e.g. Extinguisher bay B2, Level 3"
            value={caption}
            onChangeText={setCaption}
          />

          <Text style={[s.label, { color: C.textSecondary }]}>Link to Asset (optional)</Text>
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
                  ? { backgroundColor: C.accent, borderColor: C.accent }
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
                      ? { backgroundColor: C.accent, borderColor: C.accent }
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
        </View>

        <TouchableOpacity style={s.captureBtnInner} onPress={takePicture} activeOpacity={0.7}>
          <View style={[s.captureBtnOuter, { backgroundColor: C.accent, borderColor: C.accentLight || C.accent + '80' }]}>
             <MaterialCommunityIcons name="camera" size={32} color="#FFF" />
          </View>
        </TouchableOpacity>

      </BottomSheetScrollView>
    </BottomSheet>
  );
});

PhotoCaptureSheet.displayName = 'PhotoCaptureSheet';

const s = StyleSheet.create({
  topBar: { flexDirection: 'row', justifyContent: 'flex-end', paddingHorizontal: 16, paddingBottom: 12 },
  doneBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 10, paddingHorizontal: 16, borderRadius: 20 },
  doneText: { fontWeight: '800', fontSize: 14 },
  content: { paddingBottom: 64 },
  cameraContainer: { width: '100%', aspectRatio: 4/3, backgroundColor: '#000', overflow: 'hidden' },
  camera: { flex: 1 },
  cameraOverlay: { position: 'absolute', top: 0, left: 0, right: 0, flexDirection: 'row', justifyContent: 'space-between', padding: 16 },
  camBtn: { width: 44, height: 44, borderRadius: 22, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center' },
  form: { padding: 16 },
  label: { fontSize: 13, fontWeight: '700', marginBottom: 8 },
  input: { borderRadius: 12, borderWidth: 1.5, padding: 12, fontSize: 15, marginBottom: 16 },
  // Asset chip selector
  assetChipRow: { gap: 8, paddingBottom: 8 },
  assetChip: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, paddingVertical: 9, borderRadius: 14, borderWidth: 1.5, maxWidth: 180 },
  assetChipTxt: { fontSize: 12, fontWeight: '700' },
  assetChipSub: { fontSize: 10, marginTop: 1 },
  captureBtnInner: { alignSelf: 'center', marginTop: 32 },
  captureBtnOuter: { width: 72, height: 72, borderRadius: 36, justifyContent: 'center', alignItems: 'center', borderWidth: 4 },
});

export default PhotoCaptureSheet;
