import React, { useEffect, useState, useCallback, useRef } from 'react';
import {
  View,
  StyleSheet,
  ActivityIndicator,
  TouchableOpacity,
  Linking,
} from 'react-native';
import { Text } from '@/components/ui/AppText';
import { useLocalSearchParams } from 'expo-router';
import * as Sharing from 'expo-sharing';
import * as FileSystem from 'expo-file-system/legacy';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, { FadeIn, FadeInDown, useSharedValue, withRepeat, withTiming, useAnimatedStyle } from 'react-native-reanimated';
import { ScreenHeader, Button, showConfirm } from '@/components/ui';
import { useColors } from '@/hooks/useColors';
import { T } from '@/constants/Colors';
import { useReducedMotion } from '@/hooks/useReducedMotion';
import { useReportGeneration } from '@/hooks/useReportGeneration';
import { useJobsStore } from '@/store/jobsStore';
import { JobStatus } from '@/constants/Enums';
import Toast from 'react-native-toast-message';
import type { ReportWaitInfo } from '@/lib/sync';

// ─── Screen states ─────────────────────────────────────────────────────────────
type ScreenState = 'pending' | 'ready' | 'downloading' | 'error';

// ─── Pending view ──────────────────────────────────────────────────────────────
// Three plain steps — upload, build, ready — with the real upload count, the
// way delivery or banking apps show progress. Technical error text only
// appears behind "Show details".
type StepState = 'todo' | 'active' | 'done';

function Step({ state, title, detail, progress, last }: {
  state: StepState; title: string; detail: string; progress?: number; last?: boolean;
}) {
  const C = useColors();
  return (
    <View style={styles.step}>
      <View style={styles.stepRail}>
        {state === 'done' ? (
          <MaterialCommunityIcons name="check-circle" size={22} color={C.success} />
        ) : state === 'active' ? (
          <View style={[styles.stepActive, { borderColor: C.primary, backgroundColor: C.primary + '14' }]}>
            <ActivityIndicator size={14} color={C.primary} />
          </View>
        ) : (
          <View style={[styles.stepTodo, { borderColor: C.border }]} />
        )}
        {!last ? <View style={[styles.stepLine, { backgroundColor: state === 'done' ? C.success : C.border }]} /> : null}
      </View>
      <View style={styles.stepText}>
        <Text style={[styles.stepTitle, { color: state === 'todo' ? C.textTertiary : C.text }]}>{title}</Text>
        <Text style={[styles.stepDetail, { color: C.textSecondary }]}>{detail}</Text>
        {progress !== undefined ? (
          <View style={[styles.bar, { backgroundColor: C.border }]}>
            <View style={[styles.barFill, { backgroundColor: C.primary, width: `${Math.round(progress * 100)}%` }]} />
          </View>
        ) : null}
      </View>
    </View>
  );
}

const mmss = (secs: number) => `${Math.floor(secs / 60)}:${String(secs % 60).padStart(2, '0')}`;

function PendingView({
  elapsedS,
  isViewMode,
  waitInfo,
}: {
  elapsedS: number;
  isViewMode: boolean;
  waitInfo: ReportWaitInfo | null;
}) {
  const C = useColors();
  const pulse = useSharedValue(1);
  useEffect(() => {
    pulse.value = withRepeat(withTiming(0.5, { duration: 900 }), -1, true);
  }, [pulse]);
  const animStyle = useAnimatedStyle(() => ({ opacity: pulse.value }));
  const noMotion = useReducedMotion();
  const [showDetails, setShowDetails] = useState(false);

  // Largest number of changes seen waiting, so "done of total" only ever counts up.
  const totalRef = useRef(0);
  const remaining = waitInfo?.remaining ?? 0;
  totalRef.current = Math.max(totalRef.current, remaining);
  const total = totalRef.current;
  const uploading = remaining > 0;

  const icon = (
    <View style={[styles.iconCircle, { backgroundColor: T.tintBg(C.primary), borderColor: T.tintBorder(C.primary) }]}>
      <Animated.View style={noMotion ? undefined : animStyle}>
        <MaterialCommunityIcons name={isViewMode ? 'cloud-download-outline' : 'file-document-outline'} size={40} color={C.primary} />
      </Animated.View>
    </View>
  );

  if (isViewMode) {
    return (
      <Animated.View entering={noMotion ? undefined : FadeIn} style={styles.centeredWrap}>
        {icon}
        <Text style={[styles.bigTitle, { color: C.text }]}>Opening report</Text>
        <Text style={[styles.lead, { color: C.textSecondary }]}>
          Checking the latest version of this job&apos;s report. This doesn&apos;t create a new PDF.
        </Text>
        <ActivityIndicator style={{ marginTop: 20 }} color={C.primary} />
      </Animated.View>
    );
  }

  return (
    <Animated.View entering={noMotion ? undefined : FadeIn} style={styles.centeredWrap}>
      {icon}
      <Text style={[styles.bigTitle, { color: C.text }]}>Preparing your report</Text>
      <Text style={[styles.lead, { color: C.textSecondary }]}>
        {uploading ? 'Sending your latest work first, so the report includes all of it.' : 'Your work is on the server. Building the PDF now.'}
      </Text>

      <View style={[styles.stepsCard, { backgroundColor: C.surface, borderColor: C.border }]}>
        <Step
          state={uploading ? 'active' : 'done'}
          title="Upload your work"
          detail={uploading
            ? (total <= 1
                ? `Sending ${waitInfo?.label ?? 'your change'}…`
                : `${total - remaining} of ${total} changes sent · ${waitInfo?.label ?? ''} next`)
            : 'Everything is on the server'}
          progress={uploading && total > 0 ? (total - remaining) / total : undefined}
        />
        <Step
          state={uploading ? 'todo' : 'active'}
          title="Build the PDF"
          detail={uploading ? 'Starts when the upload finishes' : `Running on our servers · ${mmss(elapsedS)}`}
        />
        <Step state="todo" title="Ready to share" detail="Opens here when it's done" last />
      </View>

      {waitInfo?.retrying ? (
        <View style={[styles.retryBox, { backgroundColor: C.warningLight }]}>
          <MaterialCommunityIcons name="refresh" size={16} color={C.warningDark} />
          <View style={{ flex: 1 }}>
            <Text style={[styles.retryTitle, { color: C.warningDark }]}>
              Retrying {waitInfo.retrying.label}. Your work is safe on this phone.
            </Text>
            <TouchableOpacity onPress={() => setShowDetails((v) => !v)} hitSlop={8} accessibilityRole="button">
              <Text style={[styles.retryLink, { color: C.warningDark }]}>{showDetails ? 'Hide details' : 'Show details'}</Text>
            </TouchableOpacity>
            {showDetails ? (
              <Text selectable style={[styles.retryError, { color: C.warningDark }]}>{waitInfo.retrying.error}</Text>
            ) : null}
          </View>
        </View>
      ) : null}

      <Text style={[styles.footnote, { color: C.textTertiary }]}>
        You can leave this screen. The report keeps building and will be here when you come back.
      </Text>
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
  const C = useColors();
  const noMotion = useReducedMotion();
  return (
    <Animated.View entering={noMotion ? undefined : FadeInDown} style={styles.centeredWrap}>
      <View style={[styles.iconCircle, { backgroundColor: T.iconBg(C.success), borderColor: T.tintBorder(C.success) }]}>
        <MaterialCommunityIcons name="check-circle-outline" size={42} color={C.success} />
      </View>

      <Text style={[styles.bigTitle, { color: textColor }]}>Report ready</Text>
      <Text style={[styles.subTitle, { color: C.success }]}>{pdfTitle}</Text>
      <Text style={[styles.hintTxt, { color: textSecondary }]}>
        Full-resolution photos · AS 1851-2012 format
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
          <Text style={[styles.secondaryTxt, { color: primaryColor }]}>Open in browser</Text>
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
    waitInfo,
    generate,
    loadExisting,
  } = useReportGeneration(jobId, { forceOnMount: mode !== 'view', hasExistingReport: mode === 'view' });

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
      showConfirm({ title: 'Share failed', message: 'Could not download or share the report. Please try again.', icon: 'alert-circle-outline' });
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
      <ScreenHeader hideSyncStrip
        title={
          screenState === 'ready' || screenState === 'downloading' ? 'Report Preview'
          : isViewMode ? 'Loading Report'
          : 'Generating Report'
        }
        showBack
        fallbackHref="/jobs"
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
          elapsedS={elapsedS}
          isViewMode={isViewMode}
          waitInfo={waitInfo}
        />
      )}

      {screenState === 'error' && (
        <Animated.View entering={FadeIn} style={styles.centeredWrap}>
          <View style={[styles.iconCircle, { backgroundColor: T.iconBg(C.error), borderColor: T.tintBorder(C.error) }]}>
            <MaterialCommunityIcons name="alert-circle-outline" size={42} color={C.error} />
          </View>
          <Text style={[styles.bigTitle, { color: C.text }]}>Generation failed</Text>
          <Text style={[styles.hintTxt, { color: C.textSecondary }]}>
            {errorMsg ?? 'Could not generate report. Please try again.'}
          </Text>
          <TouchableOpacity
            // FIX: this used to always call generate() — for a genuine
            // generation failure that's right, but in view mode (just
            // trying to open an existing report) it would wrongly kick off
            // a brand new server-side regeneration via the report service, even though
            // the actual failure here is just "couldn't reach Supabase" —
            // completely unrelated to the report service. Retry the same thing that
            // just failed.
            onPress={() => (isViewMode ? loadExisting() : generate())}
            style={[styles.secondaryBtn, { backgroundColor: T.iconBg(C.primary), borderRadius: 10, paddingHorizontal: 24 }]}
          >
            <MaterialCommunityIcons name="refresh" size={18} color={C.primary} />
            <Text style={[styles.secondaryTxt, { color: C.primary }]}>Try again</Text>
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
  lead:        { fontSize: 14, lineHeight: 20, textAlign: 'center', maxWidth: 340, marginBottom: 20 },
  stepsCard:   { width: '100%', maxWidth: 420, borderWidth: 1, borderRadius: 14, paddingHorizontal: 16, paddingTop: 16, paddingBottom: 4 },
  step:        { flexDirection: 'row', gap: 12 },
  stepRail:    { alignItems: 'center', width: 24 },
  stepActive:  { width: 22, height: 22, borderRadius: 11, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  stepTodo:    { width: 18, height: 18, borderRadius: 9, borderWidth: 2, marginTop: 2 },
  stepLine:    { width: 2, flex: 1, minHeight: 14, marginVertical: 4, borderRadius: 1 },
  stepText:    { flex: 1, paddingBottom: 16, gap: 2 },
  stepTitle:   { fontSize: 15, fontWeight: '700' },
  stepDetail:  { fontSize: 13, lineHeight: 18 },
  bar:         { height: 4, borderRadius: 2, overflow: 'hidden', marginTop: 8 },
  barFill:     { height: 4, borderRadius: 2 },
  retryBox:    { width: '100%', maxWidth: 420, flexDirection: 'row', gap: 10, borderRadius: 12, padding: 12, marginTop: 12 },
  retryTitle:  { fontSize: 13, fontWeight: '600', lineHeight: 18 },
  retryLink:   { fontSize: 13, fontWeight: '700', textDecorationLine: 'underline', marginTop: 4 },
  retryError:  { fontSize: 12, lineHeight: 17, marginTop: 6, opacity: 0.85 },
  footnote:    { fontSize: 12, lineHeight: 18, textAlign: 'center', maxWidth: 340, marginTop: 16 },

  btnStack:    { width: '100%', gap: 12, marginTop: 28 },
  secondaryBtn:{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 14 },
  secondaryTxt:{ fontSize: 14, fontWeight: '600' },

  headerShareBtn:{ flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8 },
  headerShareTxt:{ fontSize: 13, fontWeight: '700' },
});
