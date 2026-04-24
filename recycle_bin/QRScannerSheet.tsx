// components/camera/QRScannerSheet.tsx — Phase 10: QR/barcode scanner bottom sheet
import React, {
  forwardRef, useImperativeHandle, useRef, useState, useCallback,
} from 'react';
import {
  View, StyleSheet, TouchableOpacity, TextInput,
  ActivityIndicator, Dimensions,
} from 'react-native';
import { Text } from 'react-native-paper';
import BottomSheet, { BottomSheetBackdrop, BottomSheetView } from '@gorhom/bottom-sheet';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import Animated, {
  useSharedValue, useAnimatedStyle, withRepeat, withTiming,
  withSequence, cancelAnimation,
} from 'react-native-reanimated';
import { router } from 'expo-router';
import Toast from 'react-native-toast-message';
import { useColors } from '@/hooks/useColors';
import { openDatabase } from '@/lib/database';

const { width: SCREEN_W } = Dimensions.get('window');
const FRAME_SIZE = SCREEN_W * 0.65;

export interface QRScannerSheetRef {
  open:  () => void;
  close: () => void;
}

const QRScannerSheet = forwardRef<QRScannerSheetRef>((_props, ref) => {
  const C = useColors();
  const bottomSheetRef = useRef<BottomSheet>(null);
  const [permission, requestPermission] = useCameraPermissions();
  const [manualCode, setManualCode] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [scanEnabled, setScanEnabled] = useState(true);

  // Animated scanner line
  const lineY = useSharedValue(0);
  const lineStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: lineY.value }],
  }));

  const startLineAnim = useCallback(() => {
    lineY.value = withRepeat(
      withSequence(
        withTiming(FRAME_SIZE - 4, { duration: 1800 }),
        withTiming(0, { duration: 1800 })
      ),
      -1,
      false
    );
  }, [lineY]);

  const stopLineAnim = useCallback(() => {
    cancelAnimation(lineY);
  }, [lineY]);

  useImperativeHandle(ref, () => ({
    open: async () => {
      if (!permission?.granted) await requestPermission();
      setManualCode('');
      setScanEnabled(true);
      bottomSheetRef.current?.expand();
      startLineAnim();
    },
    close: () => {
      stopLineAnim();
      bottomSheetRef.current?.close();
    },
  }));

  // ── Core asset lookup ─────────────────────────────────
  const navigateToAsset = (assetOrBarcode: string) => {
    try {
      const db = openDatabase();
      // Search by barcode_id or serial_number
      const asset = db.getFirstSync<{ id: string }>(
        `SELECT id FROM assets WHERE barcode_id = ? OR serial_number = ? LIMIT 1`,
        [assetOrBarcode, assetOrBarcode]
      );

      if (asset) {
        stopLineAnim();
        bottomSheetRef.current?.close();
        setTimeout(() => {
          router.push(`/assets/${asset.id}` as never);
        }, 300);
      } else {
        Toast.show({
          type: 'error',
          text1: 'Asset not found',
          text2: `No asset matched: ${assetOrBarcode.substring(0, 20)}`,
        });
      }
    } catch (err) {
      console.error('[QRScanner] lookup error:', err);
      Toast.show({ type: 'error', text1: 'Lookup failed', text2: 'Could not search database' });
    }
  };

  const handleBarcodeScanned = ({ data }: { data: string }) => {
    if (!scanEnabled || !data) return;
    // Debounce: disable scanning for 2 seconds after a scan
    setScanEnabled(false);
    setTimeout(() => setScanEnabled(true), 2000);
    navigateToAsset(data.trim());
  };

  const handleManualSearch = () => {
    const code = manualCode.trim();
    if (!code) return;
    setIsSearching(true);
    setTimeout(() => {
      navigateToAsset(code);
      setIsSearching(false);
    }, 200);
  };

  return (
    <BottomSheet
      ref={bottomSheetRef}
      index={-1}
      snapPoints={['85%']}
      enablePanDownToClose
      onClose={stopLineAnim}
      backdropComponent={(props) => (
        <BottomSheetBackdrop {...props} disappearsOnIndex={-1} appearsOnIndex={0} />
      )}
      backgroundStyle={{ backgroundColor: C.background }}
      handleIndicatorStyle={{ backgroundColor: C.border }}
    >
      <BottomSheetView style={s.container}>
        {/* Title */}
        <Text style={[s.title, { color: C.text }]}>Scan Asset QR Code</Text>
        <Text style={[s.subtitle, { color: C.textSecondary }]}>Point camera at the QR code or barcode on the asset label</Text>

        {/* Camera + scanning frame */}
        {permission?.granted ? (
          <View style={s.cameraWrap}>
            <CameraView
              style={s.camera}
              facing="back"
              onBarcodeScanned={scanEnabled ? handleBarcodeScanned : undefined}
              barcodeScannerSettings={{ barcodeTypes: ['qr', 'code128', 'code39', 'ean13', 'ean8'] }}
            />
            {/* Dark overlay with transparent center */}
            <View style={s.overlay} pointerEvents="none">
              <View style={s.overlayTop} />
              <View style={s.overlayMiddle}>
                <View style={s.overlaySide} />
                <View style={s.scanFrame}>
                  {/* Corner markers */}
                  <View style={[s.corner, s.cornerTL, { borderColor: C.accent }]} />
                  <View style={[s.corner, s.cornerTR, { borderColor: C.accent }]} />
                  <View style={[s.corner, s.cornerBL, { borderColor: C.accent }]} />
                  <View style={[s.corner, s.cornerBR, { borderColor: C.accent }]} />
                  {/* Animated scan line */}
                  <Animated.View style={[s.scanLine, { backgroundColor: C.accent, shadowColor: C.accent }, lineStyle]} />
                </View>
                <View style={s.overlaySide} />
              </View>
              <View style={s.overlayBottom}>
                <Text style={s.scanHint}>
                  {scanEnabled ? 'Align barcode within the frame' : '⏳ Processing...'}
                </Text>
              </View>
            </View>
          </View>
        ) : (
          <View style={[s.noPermWrap, { backgroundColor: C.backgroundTertiary }]}>
            <MaterialCommunityIcons name="camera-off" size={40} color={C.textSecondary} />
            <Text style={[s.noPermText, { color: C.textSecondary }]}>Camera permission required</Text>
            <TouchableOpacity style={[s.permBtn, { backgroundColor: C.accent }]} onPress={requestPermission}>
              <Text style={s.permBtnText}>Grant Permission</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Manual entry */}
        <View style={s.manualSection}>
          <View style={s.dividerRow}>
            <View style={[s.dividerLine, { backgroundColor: C.border }]} />
            <Text style={[s.dividerText, { color: C.textTertiary }]}>Can&apos;t scan? Enter manually</Text>
            <View style={[s.dividerLine, { backgroundColor: C.border }]} />
          </View>
          <View style={s.manualRow}>
            <TextInput
              style={[s.manualInput, { borderColor: C.border, color: C.text, backgroundColor: C.surface }]}
              placeholder="Enter barcode / QR code value"
              placeholderTextColor={C.textTertiary}
              value={manualCode}
              onChangeText={setManualCode}
              returnKeyType="search"
              onSubmitEditing={handleManualSearch}
              autoCapitalize="none"
              autoCorrect={false}
            />
            <TouchableOpacity
              style={[s.searchBtn, { backgroundColor: C.primary }, (!manualCode.trim() || isSearching) && s.searchBtnDisabled]}
              onPress={handleManualSearch}
              disabled={!manualCode.trim() || isSearching}
            >
              {isSearching
                ? <ActivityIndicator color="#FFFFFF" size="small" />
                : <MaterialCommunityIcons name="magnify" size={20} color="#FFFFFF" />
              }
            </TouchableOpacity>
          </View>
        </View>
      </BottomSheetView>
    </BottomSheet>
  );
});

QRScannerSheet.displayName = 'QRScannerSheet';
export default QRScannerSheet;

const s = StyleSheet.create({
  container: { flex: 1, paddingHorizontal: 16, paddingBottom: 32 },

  title:    { fontSize: 20, fontWeight: '700', textAlign: 'center', marginBottom: 4 },
  subtitle: { fontSize: 13, textAlign: 'center', marginBottom: 16 },

  cameraWrap: { width: '100%', aspectRatio: 1, borderRadius: 16, overflow: 'hidden', marginBottom: 24 },
  camera:     { ...StyleSheet.absoluteFillObject },

  // Overlay system
  overlay:       { ...StyleSheet.absoluteFillObject },
  overlayTop:    { flex: 1, backgroundColor: 'rgba(0,0,0,0.55)' },
  overlayMiddle: { flexDirection: 'row', height: FRAME_SIZE },
  overlaySide:   { flex: 1, backgroundColor: 'rgba(0,0,0,0.55)' },
  overlayBottom: { flex: 1, backgroundColor: 'rgba(0,0,0,0.55)', alignItems: 'center', paddingTop: 12 },
  scanHint:      { color: '#FFFFFF', fontSize: 13, fontWeight: '600' },

  scanFrame: {
    width: FRAME_SIZE, height: FRAME_SIZE,
    borderRadius: 4, overflow: 'hidden',
  },
  scanLine: {
    position: 'absolute', left: 0, right: 0,
    height: 2,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 6,
    elevation: 5,
  },

  // Corner markers
  corner: { position: 'absolute', width: 24, height: 24, borderWidth: 3 },
  cornerTL: { top: 0, left: 0,  borderBottomWidth: 0, borderRightWidth: 0 },
  cornerTR: { top: 0, right: 0, borderBottomWidth: 0, borderLeftWidth: 0 },
  cornerBL: { bottom: 0, left: 0,  borderTopWidth: 0, borderRightWidth: 0 },
  cornerBR: { bottom: 0, right: 0, borderTopWidth: 0, borderLeftWidth: 0 },

  noPermWrap: {
    width: '100%', aspectRatio: 1, alignItems: 'center',
    justifyContent: 'center', gap: 12,
    borderRadius: 16, marginBottom: 24,
  },
  noPermText: { fontSize: 14 },
  permBtn:    { paddingHorizontal: 24, paddingVertical: 12, borderRadius: 12 },
  permBtnText:{ color: '#FFFFFF', fontWeight: '700', fontSize: 14 },

  manualSection: { marginTop: 4 },
  dividerRow:    { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 12 },
  dividerLine:   { flex: 1, height: 1 },
  dividerText:   { fontSize: 12, fontWeight: '500' },

  manualRow:   { flexDirection: 'row', gap: 10 },
  manualInput: {
    flex: 1, height: 48, borderRadius: 12,
    borderWidth: 1.5,
    paddingHorizontal: 14, fontSize: 14,
  },
  searchBtn: {
    width: 48, height: 48, borderRadius: 12,
    alignItems: 'center', justifyContent: 'center',
  },
  searchBtnDisabled: { opacity: 0.4 },
});
