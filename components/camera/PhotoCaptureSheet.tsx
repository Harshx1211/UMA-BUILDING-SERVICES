import React, { useState, forwardRef, useImperativeHandle, useRef, useEffect, useCallback } from 'react';
import { useSheetBackHandler } from '@/hooks/useSheetBackHandler';
import { View, StyleSheet, TouchableOpacity, ScrollView, Animated } from 'react-native';
import { TextInput } from '@/components/ui/AppTextInput';
import { Text } from '@/components/ui/AppText';
import BottomSheet, { BottomSheetScrollView, BottomSheetBackdrop } from '@gorhom/bottom-sheet';
import { useColors } from '@/hooks/useColors';
import { T } from '@/constants/Colors';
import { CameraView, useCameraPermissions, FlashMode } from 'expo-camera';

import * as ImageManipulator from 'expo-image-manipulator';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { usePhotosStore } from '@/store/photosStore';
import { getAssetsForProperty } from '@/lib/database';
import { useAuthStore } from '@/store/authStore';
import { useResponsive } from '@/hooks/useResponsive';
import { Asset } from '@/types';
import Toast from 'react-native-toast-message';
import * as FileSystem from 'expo-file-system/legacy';
import { generateUUID } from '@/utils/uuid';
import { formatLocationCode } from '@/utils/assetHelpers';

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
  // Back closes the sheet instead of leaving the screen behind it.
  const [sheetOpen, setSheetOpen] = useState(false);
  const closeSheet = useCallback(() => bottomSheetRef.current?.close(), []);
  useSheetBackHandler(sheetOpen, closeSheet);
  const cameraRef = useRef<CameraView>(null);
  const snapPoints = ['92%'];

  const { addPhoto } = usePhotosStore();
  const [permission, requestPermission] = useCameraPermissions();
  const { contentMaxWidth } = useResponsive();

  const [facing, setFacing] = useState<'back' | 'front'>('back');
  const [flash, setFlash] = useState<FlashMode>('off');
  const [caption, setCaption] = useState('');
  const [assetId, setAssetId] = useState('');
  const [assets, setAssets] = useState<Asset[]>([]);
  const [photosTaken, setPhotosTaken] = useState(0);
  // Drives the shutter's visual disabled/dim state — a ref alone (isTakingRef
  // below) doesn't trigger a re-render, so the button looked fully tappable
  // during the native capture call with no feedback at all.
  const [isCapturing, setIsCapturing] = useState(false);
  const flashOpacity = useRef(new Animated.Value(0)).current;

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
    if (flash === 'on')   return C.warning;       // amber = active
    if (flash === 'auto') return C.textTertiary;  // muted = standby
    return 'rgba(255,255,255,0.4)';               // dim white = off
  };

  // Guard: prevent double-tap from firing two concurrent takePicture calls
  const isTakingRef = useRef(false);

  // FIX (shutter felt laggy on rapid-fire multi-photo capture — the exact
  // workflow this screen exists for): this used to await resize/compress/
  // copy-to-disk/addPhoto all in sequence BEFORE releasing isTakingRef, so
  // the shutter stayed unresponsive for the full ~300-800ms of that chain
  // on every single shot. Split into a fast native-capture step (guarded,
  // released immediately after) and this background processing step, which
  // runs fire-and-forget so the shutter is ready for the next photo right
  // away while this one finishes compressing/saving/queuing in the
  // background. Takes the caption/assetId as params (captured at the
  // moment of the shot, before the caption field resets) rather than
  // reading live state, since a technician may change the caption before
  // this async chain for the PREVIOUS photo finishes.
  const processPhoto = async (photo: { uri: string }, capturedCaption: string, capturedAssetId: string) => {
    try {
      // Industry standard compression (saves MBs per job)
      const manipResult = await ImageManipulator.manipulateAsync(
        photo.uri,
        [{ resize: { width: 1600 } }],
        { compress: 0.7, format: ImageManipulator.SaveFormat.JPEG }
      );

      // Save to document directory for permanent app access. FIX: filename
      // used to be just `photo_${Date.now()}` — safe when capture was fully
      // serialized (guaranteed unique), but now that processing can overlap
      // across rapid shots, two photos could collide within the same
      // millisecond. A random suffix makes it unique regardless of timing.
      const filename = `photo_${Date.now()}_${generateUUID().slice(0, 8)}.jpg`;
      const destUri = `${FileSystem.documentDirectory}${filename}`;

      // FIX: If the permanent copy fails, abort entirely. Previously the catch was
      // silent and addPhoto still ran with the temp camera URI — that temp file is
      // deleted by the OS, leaving a broken photo row and an upload task that retries
      // 5 times before being permanently abandoned.
      try {
        await FileSystem.copyAsync({ from: manipResult.uri, to: destUri });
      } catch (copyErr) {
        console.error('[PhotoCapture] Failed to copy to document directory:', copyErr);
        Toast.show({ type: 'error', text1: 'Photo save failed', text2: 'Could not write to device storage. Please try again.' });
        return;
      }

      const currentUserId = useAuthStore.getState().user?.id ?? null;

      // Defensive guard — the app layout enforces authentication, so user?.id
      // should never be null here. But if it somehow is, abort gracefully.
      if (!currentUserId) {
        Toast.show({
          type: 'error',
          text1: 'Session error',
          text2: 'Please re-sign in before taking photos.',
        });
        return;
      }

      addPhoto({
        job_id: jobId,
        company_id: useAuthStore.getState().user?.company_id ?? null,
        asset_id: capturedAssetId === '' ? null : capturedAssetId,
        defect_id: null,
        stage: null,
        photo_url: destUri,
        // local_uri preserves the device file path so offline PDF generation
        // can encode the photo directly without downloading from Supabase.
        local_uri: destUri,
        caption: capturedCaption.trim() || null,
        uploaded_by: currentUserId,
      });

      setPhotosTaken(prev => prev + 1);
      Toast.show({ type: 'success', text1: 'Photo saved' });
    } catch (e) {
      console.error(e);
      Toast.show({ type: 'error', text1: 'Failed to process photo' });
    }
  };

  const takePicture = async () => {
    if (!cameraRef.current || isTakingRef.current) return;
    isTakingRef.current = true;
    setIsCapturing(true);
    // FIX: animateShutter={false} on the CameraView disables the native
    // shutter flash/animation with nothing replacing it — no haptic, no
    // visual confirmation at all, unlike every other primary action in this
    // app (Button, JobCard's destructive actions, etc.). A quick flash
    // overlay + haptic gives the same instant "I heard your tap" feedback.
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    flashOpacity.setValue(0.85);
    Animated.timing(flashOpacity, { toValue: 0, duration: 200, useNativeDriver: true }).start();
    try {
      const photo = await cameraRef.current.takePictureAsync({ quality: 0.8 });
      if (photo) {
        const capturedCaption = caption;
        const capturedAssetId = assetId;
        setCaption(''); // reset per photo as a nice touch
        void processPhoto(photo, capturedCaption, capturedAssetId);
      }
    } catch (e) {
      console.error(e);
      Toast.show({ type: 'error', text1: 'Failed to take photo' });
    } finally {
      // Released immediately once the native capture itself is done — the
      // (now backgrounded) processing chain no longer holds this open.
      isTakingRef.current = false;
      setIsCapturing(false);
    }
  };

  return (
    <BottomSheet
      ref={bottomSheetRef}
      index={-1}
      snapPoints={snapPoints}
      enablePanDownToClose
      onChange={(index) => setSheetOpen(index >= 0)}
      backdropComponent={(props) => (
        <BottomSheetBackdrop {...props} disappearsOnIndex={-1} appearsOnIndex={0} />
      )}
      backgroundStyle={{ backgroundColor: C.background }}
    >
      <View style={s.topBar}>
        <TouchableOpacity style={[s.doneBtn, { backgroundColor: T.tintBg(C.accent), borderWidth: 1, borderColor: T.tintBorder(C.accent) }]} onPress={() => bottomSheetRef.current?.close()}>
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
              // FIX: without an explicit ratio, expo-camera on Android can
              // capture at a different native aspect ratio than what's
              // shown in this 4:3 preview box, so the saved photo can be
              // framed/cropped differently than what the technician saw.
              // Harmless no-op on iOS.
              ratio="4:3"
            />
            <Animated.View
              pointerEvents="none"
              style={[StyleSheet.absoluteFillObject, { backgroundColor: '#FFFFFF', opacity: flashOpacity }]}
            />
            <View style={s.cameraOverlay}>
              <TouchableOpacity onPress={() => setFacing(f => f === 'back' ? 'front' : 'back')} style={s.camBtn}>
                <MaterialCommunityIcons name="camera-flip" size={24} color={T.textOnPrimary} />
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

        {/* FIX: this form rendered at raw full width with no cap — every
            other polished screen in the app adopted useResponsive's
            contentMaxWidth specifically because unconstrained full-width
            controls stretch edge-to-edge and look unfinished on a tablet
            (see the hook's own doc comment). */}
        <View style={[s.form, { maxWidth: contentMaxWidth, width: '100%', alignSelf: 'center' }]}>
          <Text style={[s.label, { color: C.textSecondary }]}>Add a caption (optional)</Text>
          <TextInput
            style={[s.input, { backgroundColor: C.surface, borderColor: C.border, color: C.text }]}
            placeholderTextColor={C.textTertiary}
            placeholder="e.g. Extinguisher bay B2, Level 3"
            value={caption}
            onChangeText={setCaption}
            maxLength={120}
            returnKeyType="done"
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
                color={assetId === '' ? T.textOnPrimary : C.textSecondary}
              />
              <Text style={[s.assetChipTxt, { color: assetId === '' ? T.textOnPrimary : C.textSecondary }]}>
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
                    color={isSelected ? T.textOnPrimary : C.textSecondary}
                  />
                  <View>
                    <Text style={[s.assetChipTxt, { color: isSelected ? T.textOnPrimary : C.text }]} numberOfLines={1}>
                      {a.asset_type}
                    </Text>
                    {a.location_on_site ? (
                      <Text style={[s.assetChipSub, { color: isSelected ? T.textOnPrimary : C.textTertiary, opacity: isSelected ? 0.75 : 1 }]} numberOfLines={1}>
                        {formatLocationCode(a.location_on_site)}
                      </Text>
                    ) : null}
                  </View>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>

        <TouchableOpacity
          style={s.captureBtnInner}
          onPress={takePicture}
          activeOpacity={0.7}
          disabled={isCapturing}
        >
          <View style={[s.captureBtnOuter, { backgroundColor: C.accent, borderColor: C.accentLight, opacity: isCapturing ? 0.5 : 1 }]}>
             <MaterialCommunityIcons name="camera" size={32} color={T.textOnPrimary} />
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
  doneText: { fontWeight: '700', fontSize: 14 },
  content: { paddingBottom: 64 },
  cameraContainer: { width: '100%', aspectRatio: 4/3, backgroundColor: T.black, overflow: 'hidden' },
  camera: { flex: 1 },
  cameraOverlay: { position: 'absolute', top: 0, left: 0, right: 0, flexDirection: 'row', justifyContent: 'space-between', padding: 16 },
  camBtn: { width: 44, height: 44, borderRadius: 22, backgroundColor: T.controlButtonBg, justifyContent: 'center', alignItems: 'center' },
  form: { padding: 16 },
  label: { fontSize: 13, fontWeight: '700', marginBottom: 8 },
  input: { borderRadius: 12, borderWidth: 1.5, padding: 12, fontSize: 15, marginBottom: 16 },
  // Asset chip selector
  assetChipRow: { gap: 8, paddingBottom: 8 },
  assetChip: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, paddingVertical: 9, borderRadius: 14, borderWidth: 1.5, maxWidth: 180 },
  assetChipTxt: { fontSize: 12, fontWeight: '700' },
  assetChipSub: { fontSize: 10, marginTop: 1 },
  // FIX: was marginTop 32 — on a compact phone (iPhone SE-class), the
  // camera box + form + this button's total height can exceed the sheet's
  // visible area, pushing the shutter below the fold and forcing a scroll
  // before every shot. Trimmed to reclaim a little vertical room; a full
  // fix (pinning the shutter outside the scroll content) needs on-device
  // verification across screen sizes before attempting.
  captureBtnInner: { alignSelf: 'center', marginTop: 16 },
  captureBtnOuter: { width: 72, height: 72, borderRadius: 36, justifyContent: 'center', alignItems: 'center', borderWidth: 4 },
});

export default PhotoCaptureSheet;
