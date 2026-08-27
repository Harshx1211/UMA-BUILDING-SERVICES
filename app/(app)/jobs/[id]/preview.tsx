import React, { useEffect, useState, useCallback, useRef } from 'react';
import {
  View,
  StyleSheet,
  Alert,
  ActivityIndicator,
  TouchableOpacity,
  Linking,
} from 'react-native';
import { Text } from 'react-native-paper';
import { useLocalSearchParams } from 'expo-router';
import * as Sharing from 'expo-sharing';
import * as FileSystem from 'expo-file-system/legacy';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, { FadeIn, FadeInDown, useSharedValue, withRepeat, withTiming, useAnimatedStyle } from 'react-native-reanimated';
import { ScreenHeader, Button } from '@/components/ui';
import { useColors } from '@/hooks/useColors';
import { useReducedMotion } from '@/hooks/useReducedMotion';
import { useReportGeneration } from '@/hooks/useReportGeneration';
import { useJobsStore } from '@/store/jobsStore';
import { JobStatus } from '@/constants/Enums';
import Toast from 'react-native-toast-message';

// ─── Screen states ─────────────────────────────────────────────────────────────
type ScreenState = 'pending' | 'ready' | 'downloading' | 'error';

// ─── Pending animation view ────────────────────────────────────────────────────
function PendingView({
  primaryColor,
  textColor,
  textSecondary,
  border,
  elapsedS,
  isViewMode,
}: {
  primaryColor: string;
  textColor: string;
  textSecondary: string;
  border: string;
  elapsedS: number;
  isViewMode: boolean;
}) {
  const pulse = useSharedValue(1);
  useEffect(() => {
    pulse.value = withRepeat(withTiming(0.5, { duration: 900 }), -1, true);
  }, [pulse]);
  const animStyle = useAnimatedStyle(() => ({ opacity: pulse.value }));
  const noMotion = useReducedMotion();

  return (
    <Animated.View entering={noMotion ? undefined : FadeIn} style={styles.centeredWrap}>
      {/* Cloud icon with pulse */}
      <View style={[styles.iconCircle, { backgroundColor: primaryColor + '18', borderColor: primaryColor + '30' }]}>
        <Animated.View style={noMotion ? undefined : animStyle}>
          <MaterialCommunityIcons name={isViewMode ? 'cloud-download-outline' : 'cloud-upload-outline'} size={42} color={primaryColor} />
        </Animated.View>
      </View>

      <Text style={[styles.bigTitle, { color: textColor }]}>{isViewMode ? 'Loading Report' : 'Generating Report'}</Text>
      <Text style={[styles.subTitle, { color: primaryColor }]}>
        {isViewMode ? 'Fetching your existing report…' : 'Processing on our servers…'}
      </Text>

      {/* Progress dots */}
      <View style={styles.dotsRow}>
        {[0, 1, 2].map(i => (
          <Animated.View
            key={i}
            style={[styles.dot, { backgroundColor: primaryColor }, noMotion ? undefined : animStyle]}
          />
        ))}
      </View>

      <View style={[styles.infoBox, { borderColor: border }]}>
        {isViewMode ? (
          <Text style={[styles.infoLine, { color: textSecondary }]}>
            This job&apos;s report was already generated — just checking its current status.
            {'\n'}This isn&apos;t creating a new PDF.
          </Text>
        ) : (
          <>
            <Text style={[styles.infoLine, { color: textSecondary }]}>
              ⏱  Elapsed: {elapsedS}s
            </Text>
            <Text style={[styles.infoLine, { color: textSecondary }]}>
              The PDF is being built on our servers with full-resolution photos.
              {'\n'}Large sites (1000+ assets) take 15–45 seconds.
            </Text>
            <Text style={[styles.infoLine, { color: textSecondary, marginTop: 8 }]}>
              You can go back — the report will be ready in the cloud when done.
              Come back to this screen to download it.
            </Text>
          </>
        )}
      </View>
    </Animated.View>
  );
}

// ─── Ready view ────────────────────────────────────────────────────────────────
function ReadyView({
  pdfUrl,
  pdfTitle,
  primaryColor,
  textColor,
  textSecondary,
  insetBottom,
  onDownloadShare,
  onOpenBrowser,
  isDownloading,
}: {
  pdfUrl: string;
  pdfTitle: string;
  primaryColor: string;
  textColor: string;
  textSecondary: string;
  insetBottom: number;
  onDownloadShare: () => void;
  onOpenBrowser: () => void;
  isDownloading: boolean;
}) {
  const noMotion = useReducedMotion();
  return (
    <Animated.View entering={noMotion ? undefined : FadeInDown} style={styles.centeredWrap}>
      <View style={[styles.iconCircle, { backgroundColor: '#05966918', borderColor: '#05966930' }]}>
        <MaterialCommunityIcons name="check-circle-outline" size={42} color="#059669" />
      </View>

      <Text style={[styles.bigTitle, { color: textColor }]}>Report Ready</Text>
      <Text style={[styles.subTitle, { color: '#059669' }]}>{pdfTitle}</Text>
      <Text style={[styles.hintTxt, { color: textSecondary }]}>
        Generated on our servers · Full-resolution · AS1851 compliant
      </Text>

      <View style={[styles.btnStack, { paddingBottom: Math.max(insetBottom, 20) }]}>
        <Button
          title="Share PDF"
          icon="export-variant"
          onPress={onDownloadShare}
          loading={isDownloading}
          disabled={isDownloading}
        />
        <TouchableOpacity onPress={onOpenBrowser} style={styles.secondaryBtn}>
          <MaterialCommunityIcons name="open-in-new" size={16} color={primaryColor} />
          <Text style={[styles.secondaryTxt, { color: primaryColor }]}>Open in Browser</Text>
        </TouchableOpacity>
      </View>
    </Animated.View>
  );
}

// ─── Main screen ───────────────────────────────────────────────────────────────

export default function PreviewScreen() {
  const C = useColors();
  const insets = useSafeAreaInsets();
  const { id: jobId, mode } = useLocalSearchParams<{ id: string; mode?: string }>();
  const { updateJobStatus, jobs } = useJobsStore();

  const job = jobs.find(j => j.id === jobId);

  const [isDownloading, setIsDownloading] = useState(false);
  const isMounted = useRef(true);
  useEffect(() => {
    isMounted.current = true;
    return () => { isMounted.current = false; };
  }, []);

  // The one place that tracks report generation. Every "make me a PDF"
  // button (Generate Report, Draft Preview, Regenerate) navigates here and
  // this screen always starts a fresh generation on mount (forceOnMount) —
  // without that, tapping Regenerate on a job that already has a completed
  // report would just silently re-show that same old PDF, since the
  // server's last-known status is already 'completed' and nothing would
  // otherwise realize a new run was actually being asked for.
  //
  // "Open PDF" (viewing an already-current report, nothing changed since it
  // was made) navigates here with ?mode=view instead — that's the one case
  // that should NOT trigger a wasteful re-generation, just check the current
  // status and show it.
  const {
    status: genStatus,
    elapsedS,
    pdfUrl,
    error: errorMsg,
    generate,
  } = useReportGeneration(jobId, { forceOnMount: mode !== 'view' });

  const screenState: ScreenState =
    genStatus === 'completed' ? (isDownloading ? 'downloading' : 'ready') :
    genStatus === 'failed'    ? 'error' :
    'pending';

  // Mirror the job-completed toast/status-store update the old inline poller
  // did — purely cosmetic/defensive at this point since job.status is set to
  // Completed independently of report generation, but harmless to keep.
  const notifiedCompletedRef = useRef(false);
  useEffect(() => {
    if (genStatus === 'completed' && !notifiedCompletedRef.current && jobId) {
      notifiedCompletedRef.current = true;
      if (job?.status === JobStatus.Completed) updateJobStatus(jobId, JobStatus.Completed);
    }
  }, [genStatus, job?.status, jobId, updateJobStatus]);


  // ── Download and share ───────────────────────────────────────────────────────
  const handleDownloadShare = useCallback(async () => {
    if (!pdfUrl || isDownloading) return;
    setIsDownloading(true);
    try {
      const localPath = `${FileSystem.cacheDirectory}report_${jobId}.pdf`;
      const { uri } = await FileSystem.downloadAsync(pdfUrl, localPath);
      const available = await Sharing.isAvailableAsync();
      if (!available) {
        Toast.show({ type: 'error', text1: 'Sharing not available on this device' });
        return;
      }
      await Sharing.shareAsync(uri, {
        mimeType: 'application/pdf',
        dialogTitle: `Service Report — ${job?.property_name ?? jobId}`,
        UTI: 'com.adobe.pdf',
      });
    } catch (e) {
      console.error('[Preview] Share failed:', e);
      Alert.alert('Share Failed', 'Could not download or share the report. Please try again.');
    } finally {
      if (isMounted.current) setIsDownloading(false);
    }
  }, [pdfUrl, jobId, job, isDownloading]);

  const handleOpenBrowser = useCallback(() => {
    if (!pdfUrl) return;
    Linking.openURL(pdfUrl).catch(() =>
      Toast.show({ type: 'error', text1: 'Could not open URL' })
    );
  }, [pdfUrl]);

  // ── Render ───────────────────────────────────────────────────────────────────
  const pdfTitle = `Service Report — ${job?.property_name ?? jobId}`;
  const isViewMode = mode === 'view';

  return (
    <View style={[styles.screen, { backgroundColor: C.background }]}>
      <ScreenHeader
        title={
          screenState === 'ready' || screenState === 'downloading' ? 'Report Preview'
          : isViewMode ? 'Loading Report'
          : 'Generating Report'
        }
        showBack
        rightComponent={
          (screenState === 'ready' && pdfUrl) ? (
            <TouchableOpacity
              onPress={handleDownloadShare}
              disabled={isDownloading}
              style={styles.headerShareBtn}
            >
              {isDownloading ? (
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

      {screenState === 'pending' && (
        <PendingView
          primaryColor={C.primary}
          textColor={C.text}
          textSecondary={C.textSecondary}
          border={C.border}
          elapsedS={elapsedS}
          isViewMode={isViewMode}
        />
      )}

      {screenState === 'error' && (
        <Animated.View entering={FadeIn} style={styles.centeredWrap}>
          <View style={[styles.iconCircle, { backgroundColor: '#DC262618', borderColor: '#DC262630' }]}>
            <MaterialCommunityIcons name="alert-circle-outline" size={42} color="#DC2626" />
          </View>
          <Text style={[styles.bigTitle, { color: C.text }]}>Generation Failed</Text>
          <Text style={[styles.hintTxt, { color: C.textSecondary }]}>
            {errorMsg ?? 'Could not generate report. Please try again.'}
          </Text>
          <TouchableOpacity
            onPress={() => generate()}
            style={[styles.secondaryBtn, { backgroundColor: C.primary + '18', borderRadius: 10, paddingHorizontal: 24 }]}
          >
            <MaterialCommunityIcons name="refresh" size={18} color={C.primary} />
            <Text style={[styles.secondaryTxt, { color: C.primary }]}>Try Again</Text>
          </TouchableOpacity>
        </Animated.View>
      )}

      {(screenState === 'ready' || screenState === 'downloading') && pdfUrl && (
        <ReadyView
          pdfUrl={pdfUrl}
          pdfTitle={pdfTitle}
          primaryColor={C.primary}
          textColor={C.text}
          textSecondary={C.textSecondary}
          insetBottom={insets.bottom}
          onDownloadShare={handleDownloadShare}
          onOpenBrowser={handleOpenBrowser}
          isDownloading={isDownloading}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screen:       { flex: 1 },
  centeredWrap: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 28 },

  iconCircle:  { width: 88, height: 88, borderRadius: 44, borderWidth: 1, alignItems: 'center', justifyContent: 'center', marginBottom: 24 },
  bigTitle:    { fontSize: 24, fontWeight: '800', marginBottom: 6, textAlign: 'center' },
  subTitle:    { fontSize: 16, fontWeight: '600', marginBottom: 8, textAlign: 'center' },
  hintTxt:     { fontSize: 13, textAlign: 'center', lineHeight: 20, marginBottom: 32 },

  dotsRow:     { flexDirection: 'row', gap: 8, marginVertical: 20 },
  dot:         { width: 8, height: 8, borderRadius: 4 },

  infoBox:     { borderWidth: 1, borderRadius: 10, padding: 16, width: '100%', marginTop: 8 },
  infoLine:    { fontSize: 12, lineHeight: 18, textAlign: 'center' },

  btnStack:    { width: '100%', gap: 12, marginTop: 28 },
  secondaryBtn:{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 14 },
  secondaryTxt:{ fontSize: 14, fontWeight: '600' },

  headerShareBtn:{ flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8 },
  headerShareTxt:{ fontSize: 13, fontWeight: '700' },
});
