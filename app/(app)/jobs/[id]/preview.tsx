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
import { useLocalSearchParams, router } from 'expo-router';
import * as Sharing from 'expo-sharing';
import * as FileSystem from 'expo-file-system/legacy';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, { FadeIn, FadeInDown, useSharedValue, withRepeat, withTiming, useAnimatedStyle } from 'react-native-reanimated';
import { queueReportGeneration, getReportUrl } from '@/lib/pdfGenerator';
import { ScreenHeader, Button } from '@/components/ui';
import { useColors } from '@/hooks/useColors';
import { useReducedMotion } from '@/hooks/useReducedMotion';
import { useJobsStore } from '@/store/jobsStore';
import { JobStatus } from '@/constants/Enums';
import Toast from 'react-native-toast-message';
import { onSyncComplete, offSyncComplete } from '@/lib/sync';

// ─── Poll interval for checking if server finished ─────────────────────────────
const POLL_MS = 5_000;

// ─── Screen states ─────────────────────────────────────────────────────────────
type ScreenState = 'queuing' | 'pending' | 'ready' | 'downloading' | 'error';

// ─── Pending animation view ────────────────────────────────────────────────────
function PendingView({
  primaryColor,
  textColor,
  textSecondary,
  border,
  elapsedS,
}: {
  primaryColor: string;
  textColor: string;
  textSecondary: string;
  border: string;
  elapsedS: number;
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
          <MaterialCommunityIcons name="cloud-upload-outline" size={42} color={primaryColor} />
        </Animated.View>
      </View>

      <Text style={[styles.bigTitle, { color: textColor }]}>Generating Report</Text>
      <Text style={[styles.subTitle, { color: primaryColor }]}>Processing on our servers…</Text>

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
  const { id: jobId } = useLocalSearchParams<{ id: string }>();
  const { updateJobStatus, jobs } = useJobsStore();

  const job = jobs.find(j => j.id === jobId);

  const [screenState, setScreenState] = useState<ScreenState>('queuing');
  const [pdfUrl, setPdfUrl]           = useState<string | null>(null);
  const [isDownloading, setIsDownloading] = useState(false);
  const [elapsedS, setElapsedS]       = useState(0);

  const pollRef    = useRef<ReturnType<typeof setInterval> | null>(null);
  const elapsedRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const isMounted  = useRef(true);

  useEffect(() => {
    isMounted.current = true;
    return () => {
      isMounted.current = false;
      if (pollRef.current)    clearInterval(pollRef.current);
      if (elapsedRef.current) clearInterval(elapsedRef.current);
    };
  }, []);

  // ── Queue the generation on mount ───────────────────────────────────────────
  useEffect(() => {
    if (!jobId) return;

    const { existingUrl, queued } = queueReportGeneration(jobId);

    if (existingUrl) {
      // Report already exists — show it immediately
      setPdfUrl(existingUrl);
      setScreenState('ready');
      return;
    }

    // New generation queued
    setScreenState('pending');

    // Start elapsed timer
    elapsedRef.current = setInterval(() => {
      if (isMounted.current) setElapsedS(s => s + 1);
    }, 1000);

    // Poll local SQLite every 5s for the report_url (set by sync engine)
    const check = () => {
      const url = getReportUrl(jobId);
      if (url && isMounted.current) {
        clearInterval(pollRef.current!);
        clearInterval(elapsedRef.current!);
        setPdfUrl(url);
        setScreenState('ready');

        // Mark job complete in store if applicable
        if (job?.status === JobStatus.Completed) {
          updateJobStatus(jobId, JobStatus.Completed);
          Toast.show({ type: 'success', text1: 'Report Ready', text2: 'Admin can now access this report.' });
        } else {
          Toast.show({ type: 'info', text1: 'Report Ready', text2: 'Tap Share to send.' });
        }
      }
    };

    pollRef.current = setInterval(check, POLL_MS);

    // Also check immediately after each sync cycle completes
    const onSync = () => check();
    onSyncComplete(onSync);

    return () => {
      offSyncComplete(onSync);
      if (pollRef.current)    clearInterval(pollRef.current);
      if (elapsedRef.current) clearInterval(elapsedRef.current);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [jobId]);

  // ── Download and share ───────────────────────────────────────────────────────
  const handleDownloadShare = useCallback(async () => {
    if (!pdfUrl || isDownloading) return;
    setIsDownloading(true);
    setScreenState('downloading');
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
      if (isMounted.current) {
        setIsDownloading(false);
        setScreenState('ready');
      }
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

  return (
    <View style={[styles.screen, { backgroundColor: C.background }]}>
      <ScreenHeader
        title={screenState === 'ready' || screenState === 'downloading' ? 'Report Preview' : 'Generating Report'}
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

      {(screenState === 'queuing' || screenState === 'pending') && (
        <PendingView
          primaryColor={C.primary}
          textColor={C.text}
          textSecondary={C.textSecondary}
          border={C.border}
          elapsedS={elapsedS}
        />
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
