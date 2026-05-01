import React, { useEffect, useState, useCallback, useRef } from 'react';
import {
  View,
  StyleSheet,
  Alert,
  ActivityIndicator,
  Platform,
  TouchableOpacity,
} from 'react-native';
import { Text } from 'react-native-paper';
import { useLocalSearchParams, router } from 'expo-router';
import { WebView } from 'react-native-webview';
import * as Sharing from 'expo-sharing';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import Animated, { FadeIn, FadeInDown } from 'react-native-reanimated';
import { generateJobReport, ReportStage } from '@/lib/pdfGenerator';
import { ScreenHeader, Button } from '@/components/ui';
import { useColors } from '@/hooks/useColors';
import { useJobsStore } from '@/store/jobsStore';
import Toast from 'react-native-toast-message';

// ─── Stage display config ──────────────────────────────────────────────────────

type StageConfig = {
  label: string;
  icon: React.ComponentProps<typeof MaterialCommunityIcons>['name'];
  step: number;
};

const STAGE_CONFIG: Record<ReportStage, StageConfig> = {
  fetching_data:     { label: 'Loading job data',        icon: 'database-outline',       step: 1 },
  processing_photos: { label: 'Encoding photos',          icon: 'image-multiple-outline', step: 2 },
  building_html:     { label: 'Building report layout',   icon: 'file-document-outline',  step: 3 },
  generating_pdf:    { label: 'Generating PDF document',  icon: 'file-pdf-box',           step: 4 },
  uploading:         { label: 'Saving to cloud',          icon: 'cloud-upload-outline',   step: 5 },
  sharing:           { label: 'Ready',                    icon: 'check-circle-outline',   step: 5 },
};
const TOTAL_STEPS = 5;

// ─── Progress indicator ────────────────────────────────────────────────────────

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
        Large jobs with many photos may take a moment. Please keep this screen open.
      </Text>
    </Animated.View>
  );
}

// ─── Main screen ───────────────────────────────────────────────────────────────

export default function PreviewScreen() {
  const C = useColors();
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
  const [jobCompleted, setJobCompleted] = useState(false); // tracks if this generation auto-completed the job
  const isMountedRef                    = useRef(true);

  useEffect(() => {
    isMountedRef.current = true;
    return () => { isMountedRef.current = false; };
  }, []);

  useEffect(() => {
    if (!jobId) return;

    const generate = async () => {
      try {
        const result = await generateJobReport(jobId, (s, detail) => {
          if (!isMountedRef.current) return;
          setStage(s);
          setStageDetail(detail);
        });

        if (!isMountedRef.current) return;
        setHtmlContent(result.html);
        setPdfUri(result.pdfUri);
        setPdfTitle(result.title);

        // If the PDF was successfully uploaded, the job is now completed in Supabase.
        // Reflect this in the local jobs store so the job list and detail show the right status.
        if (result.reportUrl) {
          setJobCompleted(true);
          updateJobStatus(jobId, 'completed' as any);
          Toast.show({
            type: 'success',
            text1: '✅ Report Uploaded',
            text2: 'Job marked complete. Admin can now access this report.',
          });
        }

        setIsGenerating(false);
      } catch (e: unknown) {
        if (!isMountedRef.current) return;
        const msg = e instanceof Error ? e.message : 'Unknown error occurred';
        console.error('[SiteTrack] Preview generation failed:', e);
        Alert.alert(
          'Generation Failed',
          'The PDF report could not be generated.\n\n' + msg,
          [{ text: 'Go Back', onPress: () => router.back() }]
        );
        setIsGenerating(false);
      }
    };

    generate();
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
      console.error('[SiteTrack] Share failed:', e);
      Toast.show({ type: 'error', text1: 'Failed to share report', text2: 'Please try again' });
    } finally {
      setIsSharing(false);
    }
  }, [pdfUri, pdfTitle, isSharing]);


  return (
    <View style={[styles.screen, { backgroundColor: C.background }]}>
      <ScreenHeader
        title="PDF Preview"
        subtitle={isGenerating ? 'Generating…' : pdfTitle}
        showBack={!isGenerating}
        curved={false}
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
      ) : htmlContent ? (
        <Animated.View entering={FadeIn.duration(350)} style={styles.content}>
          {/* WebView renders the same HTML used for the PDF — 1:1 preview */}
          {!webViewReady && (
            <View style={[styles.webviewLoader, { backgroundColor: C.background }]}>
              <ActivityIndicator color={C.primary} size="large" />
              <Text style={[styles.webviewLoaderText, { color: C.textSecondary }]}>
                Rendering preview…
              </Text>
            </View>
          )}
          <WebView
            originWhitelist={['*']}
            source={{ html: htmlContent }}
            style={styles.webview}
            showsVerticalScrollIndicator={false}
            showsHorizontalScrollIndicator={false}
            onLoadEnd={() => setWebViewReady(true)}
            // Scale down for mobile so the A4 layout is readable
            injectedJavaScript={`
              (function() {
                var meta = document.querySelector('meta[name="viewport"]');
                if (meta) {
                  meta.setAttribute('content', 'width=794, initial-scale=${Platform.OS === 'ios' ? 0.45 : 0.42}, minimum-scale=0.3, maximum-scale=2.0, user-scalable=yes');
                }
              })();
              true;
            `}
          />

          {/* Job completed banner — shown when upload succeeded */}
          {jobCompleted && (
            <Animated.View
              entering={FadeInDown.duration(400)}
              style={[styles.completedBanner, { backgroundColor: C.successLight, borderColor: C.success }]}
            >
              <MaterialCommunityIcons name="check-decagram" size={18} color={C.successDark} />
              <View style={{ flex: 1 }}>
                <Text style={[styles.completedBannerTitle, { color: C.successDark }]}>Job Marked Complete</Text>
                <Text style={[styles.completedBannerSub, { color: C.success }]}>Report is live — admin can now view and share it.</Text>
              </View>
            </Animated.View>
          )}

          {/* Bottom action bar */}
          <View style={[styles.bottomBar, { backgroundColor: C.surface, borderTopColor: C.border }]}>
            {/* PDF info chip */}
            <View style={[styles.pdfInfoChip, { backgroundColor: C.backgroundTertiary ?? '#F1F5F9', borderColor: C.border }]}>
              <MaterialCommunityIcons name="file-pdf-box" size={18} color="#DC2626" />
              <Text style={[styles.pdfInfoText, { color: C.textSecondary }]} numberOfLines={1}>
                {pdfTitle}
              </Text>
            </View>

            <Button
              title={isSharing ? 'Sharing…' : 'Share / Save PDF'}
              onPress={handleShare}
              icon={
                isSharing
                  ? <ActivityIndicator size="small" color="#FFF" />
                  : <MaterialCommunityIcons name="share-variant-outline" size={20} color="#FFF" />
              }
              style={{ height: 52, borderRadius: 26, flex: 1 }}
            />
          </View>
        </Animated.View>
      ) : (
        /* Error state */
        <Animated.View entering={FadeIn} style={styles.errorWrap}>
          <MaterialCommunityIcons name="alert-circle-outline" size={52} color={C.error} />
          <Text style={[styles.errorTitle, { color: C.text }]}>Preview Unavailable</Text>
          <Text style={[styles.errorSub, { color: C.textSecondary }]}>
            The report could not be generated. Please go back and try again.
          </Text>
          <View style={{ marginTop: 20 }}>
            <Button title="Go Back" onPress={() => router.back()} />
          </View>
        </Animated.View>
      )}
    </View>
  );
}

// ─── Styles ────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  screen:  { flex: 1 },
  content: { flex: 1 },
  webview: { flex: 1, backgroundColor: '#F8FAFC' },

  // Generating
  generatingWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
    gap: 10,
  },
  genIconCircle: {
    width: 80, height: 80, borderRadius: 40,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1.5, marginBottom: 8,
  },
  genTitle:  { fontSize: 20, fontWeight: '800', textAlign: 'center' },
  genStage:  { fontSize: 14, fontWeight: '600', textAlign: 'center' },
  genStep:   { fontSize: 12, marginTop: 4 },
  genDetail: { fontSize: 11, textAlign: 'center', marginTop: 2 },
  genHint:   { fontSize: 11, textAlign: 'center', marginTop: 12, lineHeight: 16, opacity: 0.7 },

  progressTrack: { width: '100%', height: 5, borderRadius: 3, overflow: 'hidden', marginTop: 12 },
  progressFill:  { height: '100%', borderRadius: 3 },

  // WebView loading
  webviewLoader: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 10,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  webviewLoaderText: { fontSize: 13, fontWeight: '500' },

  // Bottom bar
  bottomBar: {
    padding: 14,
    paddingBottom: Platform.OS === 'ios' ? 32 : 18,
    borderTopWidth: 1,
    flexDirection: 'row',
    gap: 10,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -3 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 8,
  },
  pdfInfoChip: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 10, paddingVertical: 8,
    borderRadius: 10, borderWidth: 1,
    maxWidth: 140,
  },
  pdfInfoText: { fontSize: 10.5, fontWeight: '600', flex: 1 },

  // Error
  errorWrap: {
    flex: 1, alignItems: 'center', justifyContent: 'center',
    paddingHorizontal: 32, gap: 10,
  },
  errorTitle: { fontSize: 18, fontWeight: '800', textAlign: 'center' },
  errorSub:   { fontSize: 13, textAlign: 'center', lineHeight: 20 },

  // Job completed banner
  completedBanner: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    marginHorizontal: 14, marginBottom: 6,
    padding: 12, borderRadius: 14, borderWidth: 1.5,
  },
  completedBannerTitle: { fontSize: 13, fontWeight: '800', marginBottom: 2 },
  completedBannerSub:   { fontSize: 11, fontWeight: '500' },
});
