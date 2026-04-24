import React, { useState, forwardRef, useImperativeHandle, useRef, useEffect } from 'react';
import { View, StyleSheet, TouchableOpacity, TextInput, ScrollView } from 'react-native';
import { Text } from 'react-native-paper';
import BottomSheet, { BottomSheetScrollView, BottomSheetBackdrop } from '@gorhom/bottom-sheet';
import { useColors } from '@/hooks/useColors';
import { CameraView, useCameraPermissions, FlashMode } from 'expo-camera';
import * as MediaLibrary from 'expo-media-library';
import * as ImageManipulator from 'expo-image-manipulator';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { usePhotosStore } from '@/store/photosStore';
import { getAssetsForProperty } from '@/lib/database';
import { useAuthStore } from '@/store/authStore';
import { Asset } from '@/types';
import Toast from 'react-native-toast-message';

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
  const [mediaPerm, requestMediaPerm] = MediaLibrary.usePermissions();
  
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
      if (!mediaPerm?.granted) await requestMediaPerm();
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

  const getFlashIcon = () => {
    if (flash === 'on') return 'flash';
    if (flash === 'auto') return 'flash-auto';
    return 'flash-off';
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

        let uri = manipResult.uri;
        if (mediaPerm?.granted) {
          const asset = await MediaLibrary.createAssetAsync(manipResult.uri);
          uri = asset.uri;
        }

        addPhoto({
          job_id: jobId,
          asset_id: assetId === '' ? null : assetId,
          photo_url: uri,
          caption: caption.trim() || null,
          uploaded_by: useAuthStore.getState().user?.id || 'unknown',
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
        <TouchableOpacity style={[s.doneBtn, { backgroundColor: C.backgroundSecondary }]} onPress={() => bottomSheetRef.current?.close()}>
          <Text style={[s.doneText, { color: C.primary }]}>Done ({photosTaken} taken)</Text>
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
            >
              <View style={s.cameraOverlay}>
                <TouchableOpacity onPress={() => setFacing(f => f === 'back' ? 'front' : 'back')} style={s.camBtn}>
                  <MaterialCommunityIcons name="camera-flip" size={24} color="#FFF" />
                </TouchableOpacity>
                <TouchableOpacity onPress={cycleFlash} style={s.camBtn}>
                  <MaterialCommunityIcons name={getFlashIcon()} size={24} color={flash === 'on' ? C.warning : '#FFF'} />
                </TouchableOpacity>
              </View>
            </CameraView>
          </View>
        ) : (
          <View style={[s.cameraContainer, { justifyContent: 'center', alignItems: 'center' }]}>
            <Text>No camera permission</Text>
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
  topBar: { flexDirection: 'row', justifyContent: 'flex-end', paddingHorizontal: 16, paddingBottom: 8 },
  doneBtn: { paddingVertical: 8, paddingHorizontal: 12, borderRadius: 16 },
  doneText: { fontWeight: '700', fontSize: 14 },
  content: { paddingBottom: 64 },
  cameraContainer: { width: '100%', aspectRatio: 4/3, backgroundColor: '#000', overflow: 'hidden' },
  camera: { flex: 1 },
  cameraOverlay: { flexDirection: 'row', justifyContent: 'space-between', padding: 16 },
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
