import React, { useEffect, useState, useCallback, useRef } from 'react';
import {
  View,
  StyleSheet,
  Alert,
  ActivityIndicator,
  TouchableOpacity,
  BackHandler,
  Platform,
} from 'react-native';
import { Text } from 'react-native-paper';
import { useLocalSearchParams, router } from 'expo-router';
import { WebView } from 'react-native-webview';
import * as Sharing from 'expo-sharing';
import * as FileSystem from 'expo-file-system/legacy';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, { FadeIn, FadeInDown } from 'react-native-reanimated';
import { generateJobReport, ReportStage } from '@/lib/pdfGenerator';
import { ScreenHeader, Button } from '@/components/ui';
import { useColors } from '@/hooks/useColors';
import { useJobsStore } from '@/store/jobsStore';
import { JobStatus } from '@/constants/Enums';
import Toast from 'react-native-toast-message';

// ─── Stage display config ──────────────────────────────────────────────────

type StageConfig = {
  label: string;
  icon: React.ComponentProps<typeof MaterialCommunityIcons>['name'];
  step: number;
};

const STAGE_CONFIG: Record<ReportStage, StageConfig> = {
  fetching_data:     { label: 'Loading job data',               icon: 'database-outline',       step: 1 },
  processing_photos: { label: 'Encoding photos',                 icon: 'image-multiple-outline', step: 2 },
  building_html:     { label: 'Building report layout',          icon: 'file-document-outline',  step: 3 },
  generating_pdf:    { label: 'Rendering PDF — please wait',    icon: 'file-pdf-box',           step: 4 },
  uploading:         { label: 'Saving to cloud',                 icon: 'cloud-upload-outline',   step: 5 },
  sharing:           { label: 'Ready',                           icon: 'check-circle-outline',   step: 5 },
  cached:            { label: 'Report is already up to date',    icon: 'check-circle',           step: 5 },
};
const TOTAL_STEPS = 5;

// ─── Progress indicator ────────────────────────────────────────────────────

type ProgressProps = {
  stage: ReportStage;
  detail?: string;
  primaryColor: string;
  textColor: string;
  textSecondary: string;
  surface: string;
  border: string;
};

function GeneratingView({ stage, detail, primaryColor, textColor, textSecondary, surface, border }: ProgressProps) {
  const cfg      = STAGE_CONFIG[stage] ?? STAGE_CONFIG.fetching_data;
  const progress = cfg.step / TOTAL_STEPS;

  return (
    <Animated.View entering={FadeIn} style={styles.generatingWrap}>
      {/* Icon circle */}
      <View style={[styles.genIconCircle, { backgroundColor: primaryColor + '18', borderColor: primaryColor + '30' }]}>
        <MaterialCommunityIcons name={cfg.icon} size={36} color={primaryColor} />
      </View>

      <Text style={[styles.genTitle, { color: textColor }]}>Preparing Report</Text>
      <Text style={[styles.genStage, { color: primaryColor }]}>{cfg.label}…</Text>

      {/* Progress bar */}
      <View style={[styles.progressTrack, { backgroundColor: border }]}>
        <Animated.View
          style={[styles.progressFill, { backgroundColor: primaryColor, width: `${progress * 100}%` }]}
        />
      </View>

      <Text style={[styles.genStep, { color: textSecondary }]}>
        Step {cfg.step} of {TOTAL_STEPS}
      </Text>

      {detail ? (
        <Text style={[styles.genDetail, { color: textSecondary }]}>{detail}</Text>
      ) : null}

      <Text style={[styles.genHint, { color: textSecondary }]}>
        {stage === 'generating_pdf'
          ? 'Rendering PDF with all photos. This takes 15–40s on first run — screen is not frozen.'
          : stage === 'processing_photos'
          ? 'Photos are encoded in parallel. Large jobs may take 10–20s.'
          : stage === 'cached'
          ? 'No changes detected. Instantly opening your existing report.'
          : 'Please keep this screen open until complete.'}
      </Text>
    </Animated.View>
  );
}

// ─── Viewport injection for Android ───────────────────────────────────────
// The report HTML uses <meta name="viewport" content="width=794"/> (A4 width).
// On Android, scalesPageToFit is deprecated and doesn't reliably scale a 794px
// layout to fit a ~360–414px screen. We inject JS to set the meta tag correctly
// and let the WebView scale the content to the visible width automatically.

const VIEWPORT_INJECTION = `
(function() {
  var meta = document.querySelector('meta[name="viewport"]');
  if (!meta) {
    meta = document.createElement('meta');
    meta.name = 'viewport';
    document.head.appendChild(meta);
  }
  meta.content = 'width=device-width, initial-scale=1.0, shrink-to-fit=yes';
  // Allow pinch-to-zoom for detailed review of the PDF content
  document.body.style.webkitTextSizeAdjust = '100%';
  true;
})();
`;

// ─── Main screen ───────────────────────────────────────────────────────────

export default function PreviewScreen() {
  const C = useColors();
  const insets = useSafeAreaInsets();
  const { id: jobId } = useLocalSearchParams<{ id: string }>();
  const { updateJobStatus } = useJobsStore();

  const [isGenerating, setIsGenerating] = useState(true);
  const [stage, setStage]               = useState<ReportStage>('fetching_data');
  const [stageDetail, setStageDetail]   = useState<string | undefined>();
  const [htmlContent, setHtmlContent]   = useState<string | null>(null);
  const [pdfUri, setPdfUri]             = useState<string | null>(null);
  const [pdfTitle, setPdfTitle]         = useState('Service Report');
  const [webViewReady, setWebViewReady] = useState(false);
  const [isSharing, setIsSharing]       = useState(false);

  // isMountedRef: prevents state updates after unmount (e.g. fast back-navigation
  // while generation is still running in the background).
  const isMountedRef    = useRef(true);
  // isRunningRef: prevents re-entrant calls to generate() (e.g. rapid retry taps).
  const isRunningRef    = useRef(false);

  useEffect(() => {
    isMountedRef.current = true;
    return () => { isMountedRef.current = false; };
  }, []);

  // ── BackHandler: warn user if generation is in progress ──────────────────
  useEffect(() => {
    if (!isGenerating) return;

    const handler = BackHandler.addEventListener('hardwareBackPress', () => {
      Alert.alert(
        'Report in Progress',
        'The PDF is still generating. Going back will not cancel it — it will complete in the background.\n\nWould you like to go back anyway?',
        [
          { text: 'Stay', style: 'cancel' },
          { text: 'Go Back', style: 'destructive', onPress: () => router.back() },
        ],
      );
      return true; // Consume the back press — our Alert handles navigation
    });

    return () => handler.remove();
  }, [isGenerating]);

  // M6: `generate` as useCallback so the retry Alert always calls the current closure.
  const generate = useCallback(async () => {
    if (!jobId) return;

    // Re-entrant guard — prevents double-generation if the user taps Retry very fast
    if (isRunningRef.current) return;
    isRunningRef.current = true;

    // Reset all display state for a clean retry experience
    setIsGenerating(true);
    setStage('fetching_data');
    setStageDetail(undefined);
    setWebViewReady(false);

    try {
      const result = await generateJobReport(jobId, (s, detail) => {
        if (!isMountedRef.current) return;
        setStage(s);
        setStageDetail(detail);
      });

      if (!isMountedRef.current) return;

      // FIX: stable path (no timestamp) — overwrites the previous HTML file
      // instead of accumulating a new one per generation in cacheDirectory.
      const fileUri = `${FileSystem.cacheDirectory}preview_${jobId}.html`;
      await FileSystem.writeAsStringAsync(fileUri, result.html);
      setHtmlContent(fileUri);
      setPdfUri(result.pdfUri);
      setPdfTitle(result.title);

      // FIX: Only show Toasts when something actually happened this call.
      // Cache hits (result.wasCacheHit=true) mean nothing was uploaded —
      // showing "Report Uploaded" would be misleading.
      if (result.completed && !result.wasCacheHit) {
        // A NEW upload just completed and the job was already in completed state
        updateJobStatus(jobId, JobStatus.Completed);
        Toast.show({
          type: 'success',
          text1: 'Report Uploaded',
          text2: 'Admin can now access this report.',
        });
      } else if (result.completed && result.wasCacheHit) {
        // Just opened a cached report for a completed job — no Toast needed,
        // the report is already there and the user can immediately share it.
        // Silently proceed.
      } else if (result.reportUrl && !result.wasCacheHit) {
        // A NEW draft PDF was saved to cloud for an in-progress job
        Toast.show({
          type: 'info',
          text1: 'Draft Preview Saved',
          text2: 'Complete the job first to finalise this report.',
        });
      }

      setIsGenerating(false);
    } catch (e: unknown) {
      if (!isMountedRef.current) return;
      const msg = e instanceof Error ? e.message : 'Unknown error occurred';
      console.error('[UMA BUILDING SERVICES] Preview generation failed:', e);
      Alert.alert(
        'Generation Failed',
        'The PDF report could not be generated.\n\n' + msg,
        [
          {
            text: 'Retry',
            // M6: Calling the stable useCallback ref — never a stale closure
            onPress: () => generate(),
          },
          { text: 'Go Back', style: 'cancel', onPress: () => router.back() },
        ],
      );
      setIsGenerating(false);
    } finally {
      isRunningRef.current = false;
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [jobId]);

  // Kick off generation on mount
  useEffect(() => {
    generate();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [jobId]);

  const handleShare = useCallback(async () => {
    if (!pdfUri || isSharing) return;
    setIsSharing(true);
    try {
      const available = await Sharing.isAvailableAsync();
      if (!available) {
        Toast.show({ type: 'error', text1: 'Sharing not available on this device' });
        return;
      }
      await Sharing.shareAsync(pdfUri, {
        mimeType:    'application/pdf',
        dialogTitle: pdfTitle,
        UTI:         'com.adobe.pdf',
      });
    } catch (e) {
      console.error('[UMA BUILDING SERVICES] Share failed:', e);
      Toast.show({ type: 'error', text1: 'Failed to share report', text2: 'Please try again' });
    } finally {
      setIsSharing(false);
    }
  }, [pdfUri, pdfTitle, isSharing]);

  return (
    <View style={[styles.screen, { backgroundColor: C.background }]}>
      <ScreenHeader
        title={isGenerating ? 'Generating Report' : 'Report Preview'}
        showBack
        rightComponent={
          !isGenerating && pdfUri ? (
            <TouchableOpacity onPress={handleShare} disabled={isSharing} style={styles.headerShareBtn}>
              {isSharing ? (
                <ActivityIndicator size="small" color={C.accent} />
              ) : (
                <>
                  <MaterialCommunityIcons name="export-variant" size={18} color={C.accent} />
                  <Text style={[styles.headerShareTxt, { color: C.accent }]}>Share</Text>
                </>
              )}
            </TouchableOpacity>
          ) : undefined
        }
      />

      {isGenerating ? (
        <GeneratingView
          stage={stage}
          detail={stageDetail}
          primaryColor={C.primary}
          textColor={C.text}
          textSecondary={C.textSecondary}
          surface={C.surface}
          border={C.border}
        />
      ) : (
        <Animated.View entering={FadeInDown} style={{ flex: 1 }}>
          {!webViewReady && (
            <View style={[styles.loadingOverlay, { backgroundColor: C.background }]}>
              <ActivityIndicator color={C.primary} size="large" />
              <Text style={[styles.loadingOverlayTxt, { color: C.textSecondary }]}>Rendering document…</Text>
            </View>
          )}

          {htmlContent ? (
            <WebView
              originWhitelist={['*']}
              source={{ uri: htmlContent }}
              allowFileAccess={true}
              // FIX: allowFileAccessFromFileURLs is required on Android for data: URIs
              // embedded in a file:// HTML to load (photos encoded as base64 data URIs).
              allowFileAccessFromFileURLs={true}
              // FIX: scalesPageToFit is deprecated on Android. Use injectedJavaScript
              // to set a proper viewport meta tag so the 794px A4 layout scales to
              // fit the device screen width correctly on both iOS and Android.
              scalesPageToFit={Platform.OS === 'ios'}
              injectedJavaScript={Platform.OS === 'android' ? VIEWPORT_INJECTION : undefined}
              style={{ flex: 1, backgroundColor: C.surface }}
              onLoadEnd={() => setWebViewReady(true)}
              showsVerticalScrollIndicator={false}
              bounces={false}
            />
          ) : (
            <View style={[styles.errorView, { backgroundColor: C.background }]}>
              <MaterialCommunityIcons name="alert-circle-outline" size={48} color={C.error} />
              <Text style={[styles.errorTxt, { color: C.text }]}>Report layout could not be loaded.</Text>
              <Button title="Retry" onPress={generate} style={{ marginTop: 20 }} />
            </View>
          )}

          <View style={[styles.bottomBar, { backgroundColor: C.surface, borderTopColor: C.border, shadowColor: C.shadow, paddingBottom: Math.max(insets.bottom, 20) }]}>
            <Button
              title="Share PDF"
              icon="export-variant"
              onPress={handleShare}
              loading={isSharing}
              disabled={!pdfUri || isSharing}
            />
          </View>
        </Animated.View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },

  headerShareBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 10, paddingVertical: 6,
    borderRadius: 8,
  },
  headerShareTxt: { fontSize: 13, fontWeight: '700' },

  generatingWrap: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 32 },
  genIconCircle: { width: 80, height: 80, borderRadius: 40, borderWidth: 1, alignItems: 'center', justifyContent: 'center', marginBottom: 24 },
  genTitle: { fontSize: 24, fontWeight: '800', marginBottom: 8 },
  genStage: { fontSize: 16, fontWeight: '600', marginBottom: 32 },

  progressTrack: { width: '100%', height: 8, borderRadius: 4, overflow: 'hidden', marginBottom: 16 },
  progressFill: { height: '100%', borderRadius: 4 },

  genStep: { fontSize: 14, fontWeight: '700', marginBottom: 8 },
  genDetail: { fontSize: 12, fontStyle: 'italic', marginBottom: 24, textAlign: 'center' },
  genHint: { fontSize: 12, textAlign: 'center', lineHeight: 18, paddingHorizontal: 20 },

  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 10, justifyContent: 'center', alignItems: 'center',
  },
  loadingOverlayTxt: { marginTop: 12, fontSize: 14, fontWeight: '500' },

  errorView: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 32 },
  errorTxt: { fontSize: 16, textAlign: 'center', marginTop: 16 },

  bottomBar: {
    padding: 16,
    borderTopWidth: 1,
    shadowOffset: { width: 0, height: -4 }, shadowOpacity: 0.05, shadowRadius: 10, elevation: 10,
  },
});
