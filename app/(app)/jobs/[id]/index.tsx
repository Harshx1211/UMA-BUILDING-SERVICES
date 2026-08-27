import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Linking, Modal, Platform, ScrollView, StyleSheet,
  View, TouchableOpacity, TextInput, Alert,
} from 'react-native';
import { Text, ActivityIndicator } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import Animated, { FadeInDown, FadeIn } from 'react-native-reanimated';
import Toast from 'react-native-toast-message';
import { router, useLocalSearchParams, useFocusEffect, useNavigation } from 'expo-router';
import type { NavigationAction } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '@/hooks/useAuth';
import { useJobsStore } from '@/store/jobsStore';
import { useReducedMotion } from '@/hooks/useReducedMotion';
import {
  JobStatus, JobType, Priority, InspectionResult, SyncOperation,
} from '@/constants/Enums';
import {
  getJobById, getAssetsWithJobResults, getDefectsForJob, getPhotosForJob,
  getSignatureForJob, updateRecord, addToSyncQueue,
} from '@/lib/database';
import CompletionBottomSheet from '@/components/jobs/CompletionBottomSheet';
import { useColors } from '@/hooks/useColors';
import { ScreenHeader, Button, Badge, Card } from '@/components/ui';
import { MAX_LENGTHS, sanitizeText } from '@/utils/sanitize';
import type { Asset, Defect, InspectionPhoto } from '@/types';

// ─── Types ────────────────────────────────────────────────────────────────
type AssetWithResult = Asset & {
  result: InspectionResult | null;
  inspection_notes: string | null;
  actioned_at: string | null;
};
type JobDetail = {
  id: string; property_id: string; assigned_to: string;
  job_type: JobType; status: JobStatus; scheduled_date: string;
  scheduled_time: string | null; priority: Priority; notes: string | null;
  created_at: string; updated_at: string;
  property_name: string | null; property_address: string | null;
  property_suburb: string | null; property_state: string | null; property_postcode: string | null;
  site_contact_name: string | null; site_contact_phone: string | null;
  access_notes: string | null; hazard_notes: string | null; site_note: string | null;
  report_url: string | null;
};

// ─── Helpers ──────────────────────────────────────────────────────────────
function fmtDate(iso: string) {
  try {
    return new Date(iso + 'T00:00:00').toLocaleDateString('en-AU', {
      weekday: 'short', day: 'numeric', month: 'short',
    });
  } catch { return iso; }
}
function fmtTime(hhmm: string) {
  try {
    const [h, m] = hhmm.split(':').map(Number);
    return `${h % 12 || 12}:${String(m).padStart(2, '0')} ${h >= 12 ? 'PM' : 'AM'}`;
  } catch { return hhmm; }
}

const PRIORITY_LABEL: Record<Priority, string> = {
  [Priority.Urgent]: 'Urgent', [Priority.High]: 'High',
  [Priority.Normal]: 'Normal', [Priority.Low]: 'Low',
};
const JOB_TYPE_LABEL: Record<JobType, string> = {
  [JobType.RoutineService]: 'Routine Service',
  [JobType.DefectRepair]:   'Defect Repair',
  [JobType.Installation]:   'Installation',
  [JobType.Emergency]:      'Emergency',
  [JobType.Quote]:          'Quote',
};

// ─── ActionRow mini-component ──────────────────────────────────────────────
type MCIconName = React.ComponentProps<typeof MaterialCommunityIcons>['name'];
type ColorsType = ReturnType<typeof useColors>;
function ActionRow({
  icon, iconBg, iconColor, title, subtitle, badge, badgeColor, onPress, isLast, C,
}: {
  icon: MCIconName; iconBg: string; iconColor: string; title: string; subtitle?: string;
  badge?: number; badgeColor?: string; onPress: () => void; isLast: boolean; C: ColorsType;
}) {
  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.7}
      style={[ar.row, !isLast && { borderBottomWidth: 1, borderBottomColor: C.border }]}
    >
      <View style={[ar.iconWrap, { backgroundColor: iconBg }]}>
        <MaterialCommunityIcons name={icon} size={20} color={iconColor} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={[ar.title, { color: C.text }]} numberOfLines={1}>{title}</Text>
        {subtitle ? <Text style={[ar.sub, { color: C.textSecondary }]} numberOfLines={1}>{subtitle}</Text> : null}
      </View>
      {badge !== undefined && badge > 0 && (
        <View style={[ar.badge, { backgroundColor: badgeColor ?? C.accent }]}>
          <Text style={[ar.badgeTxt, { color: C.textOnPrimary }]}>{badge}</Text>
        </View>
      )}
      <MaterialCommunityIcons name="chevron-right" size={18} color={C.borderStrong} />
    </TouchableOpacity>
  );
}
const ar = StyleSheet.create({
  row:      { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14 },
  iconWrap: { width: 38, height: 38, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
  title:    { fontSize: 14, fontWeight: '700', letterSpacing: -0.1 },
  sub:      { fontSize: 12, marginTop: 1, fontWeight: '500' },
  badge:    { minWidth: 20, height: 20, borderRadius: 10, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 5 },
  badgeTxt: { fontSize: 10, fontWeight: '800' },
});

// ─── Main Screen ─────────────────────────────────────────────────────────
export default function JobDetailScreen() {
  const C = useColors();
  const insets = useSafeAreaInsets();
  const noMotion = useReducedMotion();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { user } = useAuth();
  const { updateJobStatus } = useJobsStore();
  const navigation = useNavigation();

  const PRIORITY_COLOR: Record<Priority, string> = {
    [Priority.Urgent]: C.error,
    [Priority.High]:   C.warning,
    [Priority.Normal]: C.primary,
    [Priority.Low]:    C.textTertiary,
  };

  // ── State ─────────────────────────────────────────────────────────────
  const [job,     setJob]     = useState<JobDetail | null>(null);
  const [assets,  setAssets]  = useState<AssetWithResult[]>([]);
  const [defects, setDefects] = useState<Defect[]>([]);
  const [photos,  setPhotos]  = useState<InspectionPhoto[]>([]);
  const [notes,   setNotes]   = useState('');
  const [isEditingNotes,   setIsEditingNotes]   = useState(false);
  const [isLoading,        setIsLoading]        = useState(true);
  const [hasSig,           setHasSig]           = useState(false);
  const [showBottomSheet,  setShowBottomSheet]  = useState(false);
  const [detailsExpanded,  setDetailsExpanded]  = useState(false);
  const [showCompletionModal, setShowCompletionModal] = useState(false);
  const [completionCountdown, setCompletionCountdown] = useState(5);
  const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    return () => { if (countdownRef.current) clearInterval(countdownRef.current); };
  }, []);

  // ── Data loading ──────────────────────────────────────────────────────
  const loadJob = useCallback(async () => {
    if (!id) return;
    setIsLoading(true);
    try {
      const j = getJobById<JobDetail>(id);
      if (!j) { setIsLoading(false); return; }
      setJob(j);
      setNotes(j.notes ?? '');
      setAssets(getAssetsWithJobResults<AssetWithResult>(id, j.property_id));
      setDefects(getDefectsForJob<Defect>(id));
      setPhotos(getPhotosForJob<InspectionPhoto>(id));
      setHasSig(!!getSignatureForJob(id));
    } catch (err) {
      console.error('[JobDetail] load error:', err);
    } finally {
      setIsLoading(false);
    }
  }, [id]);

  const handleSaveNotes = useCallback(() => {
    if (!job) return;
    const now = new Date().toISOString();
    // Sanitize before persisting — prevents injection patterns from reaching
    // the sync queue payload and eventually the PDF HTML template.
    const sanitized = sanitizeText(notes, MAX_LENGTHS.longNotes);
    setNotes(sanitized);
    updateRecord('jobs', job.id, { status: job.status, notes: sanitized, updated_at: now });
    addToSyncQueue('jobs', job.id, SyncOperation.Update, { notes: sanitized, updated_at: now });
    setIsEditingNotes(false);
    Toast.show({ type: 'success', text1: 'Notes saved' });
  }, [job, notes]);

  useEffect(() => { loadJob(); }, [loadJob]);
  // Refresh data whenever we navigate back to this screen
  useFocusEffect(useCallback(() => { loadJob(); }, [loadJob]));

  // Warn before leaving if there are unsaved notes
  useEffect(() => {
    const unsub = navigation.addListener('beforeRemove', (e: { preventDefault: () => void; data: { action: NavigationAction } }) => {
      if (!isEditingNotes) return; // no unsaved changes
      e.preventDefault();
      Alert.alert(
        'Unsaved Notes',
        'You have unsaved field notes. Save them before leaving?',
        [
          {
            text: 'Discard',
            style: 'destructive',
            onPress: () => navigation.dispatch(e.data.action),
          },
          { text: 'Keep Editing', style: 'cancel' },
          {
            text: 'Save & Leave',
            onPress: () => { handleSaveNotes(); navigation.dispatch(e.data.action); },
          },
        ]
      );
    });
    return unsub;
  }, [navigation, isEditingNotes, handleSaveNotes]);

  // ── Job actions ────────────────────────────────────────────────────────
  const handleStartJob = async () => {
    if (!job || !user) return;
    try {
      updateJobStatus(job.id, JobStatus.InProgress);
      setJob(p => p ? { ...p, status: JobStatus.InProgress } : p);
      Toast.show({ type: 'success', text1: 'Job Started' });
    } catch {
      Toast.show({ type: 'error', text1: 'Failed to start job' });
    }
  };

  const handleCompleteRequest = () => setShowBottomSheet(true);

  // Last-line-of-defence signature guard.
  const handleFinalizeConfirm = () => {
    setShowBottomSheet(false);
    if (!hasSig) {
      Alert.alert(
        'Signature Required',
        'A client signature is required before completing this job. Please capture a signature first.',
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Go to Signature',
            onPress: () => { if (job) router.push(`/jobs/${job.id}/signature` as never); },
          },
        ]
      );
      return;
    }
    // FIX: Check that all assets have a result (pass/fail/not_tested),
    // not just that pass+fail count > 0.
    // Previously: inspected = passedCount + failedCount, so an all-N/T job
    // had inspected===0 and was permanently blocked from completion.
    // N/T is a valid final inspection state — a tech who marks everything N/T
    // has completed their assessment.
    const allAssetsResulted = totalAssets > 0 && assets.every(a => a.result !== null);
    if (!allAssetsResulted && totalAssets > 0) {
      Alert.alert(
        'Inspection Incomplete',
        'All assets must have a result (Pass, Fail, or Not Tested) before completing this job.',
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Open Inspection',
            onPress: () => { if (job) router.push(`/jobs/${job.id}/inspect` as never); },
          },
        ]
      );
      return;
    }
    finalizeCompletion();
  };

  const finalizeCompletion = () => {
    if (!job) return;
    updateJobStatus(job.id, JobStatus.Completed);
    setJob(p => p ? { ...p, status: JobStatus.Completed } : p);
    setShowCompletionModal(true);
    setCompletionCountdown(5);
    countdownRef.current = setInterval(() => {
      setCompletionCountdown(prev => {
        if (prev <= 1) {
          if (countdownRef.current) clearInterval(countdownRef.current);
          setShowCompletionModal(false);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  };

  const handleContinueWorking = () => {
    if (!job) return;
    Alert.alert(
      'Continue Working?',
      'This will re-open the job and unlock the inspection form. All existing data is preserved.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Continue Working',
          onPress: () => {
            const now = new Date().toISOString();
            updateRecord('jobs', job.id, { status: JobStatus.InProgress, report_url: null, updated_at: now });
            addToSyncQueue('jobs', job.id, SyncOperation.Update, {
              status: JobStatus.InProgress,
              report_url: null,
              updated_at: now,
            });
            updateJobStatus(job.id, JobStatus.InProgress);
            setJob(p => p ? { ...p, status: JobStatus.InProgress, report_url: null } : p);
            Toast.show({
              type: 'success',
              text1: 'Job re-opened',
              text2: 'Changes will sync to the server automatically',
            });
          },
        },
      ]
    );
  };

  const handleNavigate = () => {
    if (!job) return;
    const addr = [job.property_address, job.property_suburb, job.property_state].filter(Boolean).join(', ');
    if (!addr.trim()) {
      Toast.show({ type: 'info', text1: 'No address on file', text2: 'Contact your manager to update this property.' });
      return;
    }
    Linking.openURL(`https://maps.google.com/?q=${encodeURIComponent(addr)}`);
  };

  const totalAssets = assets.length;
  const passedCount = assets.filter(a => a.result === InspectionResult.Pass).length;
  const failedCount = assets.filter(a => a.result === InspectionResult.Fail).length;
  const inspected   = passedCount + failedCount;
  const progressPct = totalAssets > 0 ? Math.round((inspected / totalAssets) * 100) : 0;
  
  const passedPct = totalAssets > 0 ? (passedCount / totalAssets) * 100 : 0;
  const failedPct = totalAssets > 0 ? (failedCount / totalAssets) * 100 : 0;

  // ── Loading / error states ─────────────────────────────────────────────
  if (isLoading) {
    return (
      <View style={[s.screen, s.centered, { backgroundColor: C.background }]}>
        <ActivityIndicator color={C.primary} size="large" />
      </View>
    );
  }
  if (!job) {
    return (
      <View style={[s.screen, s.centered, { backgroundColor: C.background }]}>
        <MaterialCommunityIcons name="file-search-outline" size={48} color={C.textTertiary} />
        <Text style={[s.notFound, { color: C.textSecondary }]}>Job not found</Text>
        <View style={{ marginTop: 16 }}>
          <Button title="Go Back" onPress={() => router.back()} />
        </View>
      </View>
    );
  }

  const isInProgress = job.status === JobStatus.InProgress;
  const isCompleted  = job.status === JobStatus.Completed;
  const isCancelled  = job.status === JobStatus.Cancelled;
  const isScheduled  = job.status === JobStatus.Scheduled;

  const actionRows: (Omit<React.ComponentProps<typeof ActionRow>, 'isLast' | 'C'> & { key: string })[] = [
    {
      key: 'defects', icon: 'alert-circle-outline',
      iconBg: defects.length > 0 ? C.error + '15' : C.backgroundTertiary,
      iconColor: defects.length > 0 ? C.error : C.textSecondary,
      title: 'Defects',
      subtitle: defects.length === 0 ? 'None logged' : `${defects.length} defect${defects.length !== 1 ? 's' : ''}`,
      badge: defects.length, badgeColor: C.error,
      onPress: () => router.push(`/jobs/${id}/defects` as never),
    },
    {
      key: 'photos', icon: 'camera-outline', iconBg: C.backgroundTertiary, iconColor: C.textSecondary,
      title: 'Photos',
      subtitle: photos.length === 0 ? 'None captured' : `${photos.length} photo${photos.length !== 1 ? 's' : ''}`,
      onPress: () => router.push(`/jobs/${id}/photos` as never),
    },
    {
      key: 'quote', icon: 'file-document-outline', iconBg: C.backgroundTertiary, iconColor: C.textSecondary,
      title: 'Quote', subtitle: 'Parts & labour',
      onPress: () => router.push(`/jobs/${id}/quote` as never),
    },
    {
      key: 'signature', icon: 'draw', iconBg: hasSig ? C.success + '15' : C.backgroundTertiary, iconColor: hasSig ? C.success : C.textSecondary,
      title: 'Signature', subtitle: hasSig ? 'Captured' : 'Required for report',
      onPress: () => router.push(`/jobs/${id}/signature` as never),
    },
    {
      key: 'navigate', icon: 'map-marker-path', iconBg: C.backgroundTertiary, iconColor: C.textSecondary,
      title: 'Navigate to Site',
      subtitle: [job.property_address, job.property_suburb].filter(Boolean).join(', ') || undefined,
      onPress: handleNavigate,
    },
    ...(job.site_contact_phone ? [{
      key: 'call', icon: 'phone-in-talk' as MCIconName, iconBg: C.backgroundTertiary, iconColor: C.textSecondary,
      title: job.site_contact_name || 'Call Site Contact',
      subtitle: job.site_contact_phone,
      onPress: () => Linking.openURL(`tel:${job.site_contact_phone}`),
    }] : []),
  ];

  // ── Render ─────────────────────────────────────────────────────────────
  return (
    <View style={[s.screen, { backgroundColor: C.background }]}>
      {/* ── HEADER — outside ScrollView so it never overlaps the status bar ── */}
      <ScreenHeader
        eyebrow={`Job #${job.id.substring(0, 8).toUpperCase()}`}
        title={job.property_name || 'Job Details'}
        subtitle={[job.property_address, job.property_suburb].filter(Boolean).join(', ') || 'No address on record'}
        showBack={true}
        rightComponent={
          <Badge
            status={job.status}
            label={
              isInProgress ? 'In Progress'
              : isCompleted ? 'Completed'
              : isCancelled ? 'Cancelled'
              : 'Scheduled'
            }
          />
        }
      />

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={s.scrollContent}>
        <View style={s.body}>

          {/* ── JOB ACTIONS WIDGET (scheduled state only — once in progress, the
               Inspection Progress card below is the single hub for both
               opening the form and completing the job) ── */}
          {isScheduled && (
            <Animated.View entering={noMotion ? undefined : FadeInDown.delay(40).duration(360)}>
              <Card style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
                <View style={{ flex: 1 }}>
                  <Text style={[s.timerLabel, { color: C.text }]}>Job Scheduled</Text>
                  <Text style={[s.timerSub, { color: C.textSecondary }]}>Start the job to begin work.</Text>
                </View>
                <TouchableOpacity
                  onPress={handleStartJob}
                  style={[s.continueBtn, { backgroundColor: C.primary, borderColor: C.primary, paddingHorizontal: 20, paddingVertical: 10 }]}
                >
                  <Text style={[s.continueBtnTxt, { color: C.textOnPrimary }]}>Start Job</Text>
                </TouchableOpacity>
              </Card>
            </Animated.View>
          )}

          {/* Completed banner */}
          {isCompleted && (
            <Card variant="success" style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
              <MaterialCommunityIcons name="check-decagram" size={22} color={C.success} />
              <View style={{ flex: 1 }}>
                <Text style={[s.statusBannerTitle, { color: C.success }]}>Job Completed</Text>
                {hasSig && (
                  <Text style={[s.statusBannerSub, { color: C.success }]}>Client signature captured</Text>
                )}
              </View>
              <TouchableOpacity
                onPress={handleContinueWorking}
                style={[s.continueBtn, { backgroundColor: C.success + '18', borderColor: C.success }]}
              >
                <MaterialCommunityIcons name="pencil-outline" size={14} color={C.success} />
                <Text style={[s.continueBtnTxt, { color: C.success }]}>Continue</Text>
              </TouchableOpacity>
            </Card>
          )}

          {/* Cancelled banner */}
          {isCancelled && (
            <Card variant="default" style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
              <MaterialCommunityIcons name="cancel" size={22} color={C.textSecondary} />
              <View style={{ flex: 1 }}>
                <Text style={[s.statusBannerTitle, { color: C.textSecondary }]}>Job Cancelled</Text>
                <Text style={[s.statusBannerSub, { color: C.textTertiary }]}>
                  Contact your manager for details.
                </Text>
              </View>
            </Card>
          )}

          {/* ── SAFETY HAZARD (always visible — never hidden behind a tap) ── */}
          {job.hazard_notes && (
            <Animated.View entering={noMotion ? undefined : FadeInDown.delay(60).duration(360)}>
              <Card variant="danger" style={{ flexDirection: 'row', gap: 12 }}>
                <MaterialCommunityIcons name="alert" size={20} color={C.error} />
                <View style={{ flex: 1 }}>
                  <Text style={[s.alertTitle, { color: C.error }]}>Site Hazard</Text>
                  <Text style={[s.alertBody, { color: C.text }]}>{job.hazard_notes}</Text>
                </View>
              </Card>
            </Animated.View>
          )}

          {/* ── INSPECTION PROGRESS + CTA (the single hub once a job is started —
               opening the form and completing the job both live here, so
               there's no second competing card while in progress) ── */}
          {(isInProgress || isCompleted) && (
            <Animated.View entering={noMotion ? undefined : FadeInDown.delay(80).duration(360)}>
              <Card variant="default" noPadding>
                <View style={{ padding: 16 }}>
                  <View style={s.progressHeader}>
                    <View style={{ flex: 1 }}>
                      <Text style={[s.progressTitle, { color: C.text }]}>Inspection Progress</Text>
                      <Text style={[s.progressSubtitle, { color: C.textSecondary }]}>
                        {totalAssets === 0
                          ? 'No assets registered for this property'
                          : `${inspected} of ${totalAssets} assets inspected`}
                      </Text>
                    </View>
                    <Text style={[s.progressPct, { color: progressPct === 100 ? (failedCount > 0 ? C.error : C.success) : C.textSecondary }]}>
                      {progressPct}%
                    </Text>
                  </View>
                  <View style={[s.progressTrack, { backgroundColor: C.backgroundTertiary, flexDirection: 'row' }]}>
                    {passedPct > 0 && <View style={[s.progressFill, { width: `${passedPct}%`, backgroundColor: C.success }]} />}
                    {failedPct > 0 && <View style={[s.progressFill, { width: `${failedPct}%`, backgroundColor: C.error }]} />}
                  </View>
                  {totalAssets > 0 && (
                    <View style={s.progressStatRow}>
                      {[
                        { label: 'Passed',  count: assets.filter(a => a.result === InspectionResult.Pass).length,  color: C.success },
                        { label: 'Failed',  count: assets.filter(a => a.result === InspectionResult.Fail).length,  color: C.error },
                        { label: 'Pending', count: assets.filter(a => !a.result).length, color: C.textTertiary },
                      ].map(stat => (
                        <View key={stat.label} style={s.progressStat}>
                          <View style={[s.progressStatDot, { backgroundColor: stat.color }]} />
                          <Text style={[s.progressStatTxt, { color: C.textSecondary }]}>
                            {stat.count} {stat.label}
                          </Text>
                        </View>
                      ))}
                    </View>
                  )}
                </View>

                <TouchableOpacity
                  onPress={isInProgress ? () => router.push(`/jobs/${id}/inspect` as never) : handleContinueWorking}
                  activeOpacity={0.7}
                  style={[
                    s.inspectRow,
                    { borderTopWidth: 1, borderTopColor: C.border },
                    isInProgress && { backgroundColor: C.primary + '0D' },
                  ]}
                >
                  <View style={[s.inspectCtaIcon, { backgroundColor: isInProgress ? C.primary + '20' : C.backgroundTertiary }]}>
                    <MaterialCommunityIcons
                      name={isInProgress ? 'clipboard-check' : 'lock-open-outline'}
                      size={22}
                      color={isInProgress ? C.primary : C.textTertiary}
                    />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[s.inspectCtaTitle, { color: isInProgress ? C.primary : C.text }]}>
                      {isCompleted ? 'Re-open inspection' : 'Open inspection form'}
                    </Text>
                    <Text style={[s.inspectCtaSub, { color: C.textSecondary }]}>
                      {isInProgress
                        ? (totalAssets === 0
                            ? 'Add assets and begin the on-site inspection'
                            : progressPct === 100
                            ? 'All assets inspected'
                            : `${totalAssets - inspected} asset${totalAssets - inspected !== 1 ? 's' : ''} remaining`)
                        : 'Tap here to unlock and edit the form'}
                    </Text>
                  </View>
                  <View style={[s.inspectChevronWrap, isInProgress && { backgroundColor: C.primary }]}>
                    <MaterialCommunityIcons name="chevron-right" size={18} color={isInProgress ? C.textOnPrimary : C.textTertiary} />
                  </View>
                </TouchableOpacity>

                {isInProgress && (
                  <TouchableOpacity
                    onPress={handleCompleteRequest}
                    activeOpacity={0.6}
                    style={[s.completeRow, { borderTopWidth: 1, borderTopColor: C.border }]}
                  >
                    <Text style={[s.completeRowTxt, { color: C.textTertiary }]}>Mark Job Complete</Text>
                  </TouchableOpacity>
                )}
              </Card>
            </Animated.View>
          )}

          {/* ── DETAILS (collapsed by default — scheduling info, access/site notes) ── */}
          <Animated.View entering={noMotion ? undefined : FadeInDown.delay(100).duration(360)}>
            <Card variant="default" noPadding>
              <TouchableOpacity
                activeOpacity={0.7}
                onPress={() => setDetailsExpanded(v => !v)}
                style={s.detailsHeader}
              >
                <View style={{ flex: 1 }}>
                  <Text style={[s.detailsTitle, { color: C.text }]}>Details</Text>
                  <Text style={[s.detailsSub, { color: C.textSecondary }]} numberOfLines={1}>
                    {JOB_TYPE_LABEL[job.job_type as JobType] ?? job.job_type} · {PRIORITY_LABEL[job.priority] ?? job.priority} priority · Sch: {fmtDate(job.scheduled_date)}
                  </Text>
                </View>
                <MaterialCommunityIcons name={detailsExpanded ? 'chevron-up' : 'chevron-down'} size={18} color={C.textTertiary} />
              </TouchableOpacity>

              {detailsExpanded && (
                <Animated.View entering={FadeIn.duration(150)} style={{ borderTopWidth: 1, borderTopColor: C.border }}>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.chipsRow}>
                    <View style={[s.chip, { backgroundColor: C.backgroundTertiary }]}>
                      <MaterialCommunityIcons name="calendar" size={15} color={C.textSecondary} />
                      <Text style={[s.chipTxt, { color: C.text }]}>Sch: {fmtDate(job.scheduled_date)}</Text>
                    </View>
                    {(isCompleted || isInProgress) && job.updated_at && (
                      <View style={[s.chip, { backgroundColor: C.backgroundTertiary }]}>
                        <MaterialCommunityIcons name={isCompleted ? "check-circle-outline" : "play-circle-outline"} size={15} color={C.textSecondary} />
                        <Text style={[s.chipTxt, { color: C.text }]}>
                          {isCompleted ? 'Done: ' : 'Started: '}{fmtDate(job.updated_at.substring(0, 10))}
                        </Text>
                      </View>
                    )}
                    {job.scheduled_time && (
                      <View style={[s.chip, { backgroundColor: C.backgroundTertiary }]}>
                        <MaterialCommunityIcons name="clock-outline" size={15} color={C.textSecondary} />
                        <Text style={[s.chipTxt, { color: C.text }]}>{fmtTime(job.scheduled_time)}</Text>
                      </View>
                    )}
                    <View style={[s.chip, { backgroundColor: C.backgroundTertiary }]}>
                      <MaterialCommunityIcons name="wrench-outline" size={15} color={C.textSecondary} />
                      <Text style={[s.chipTxt, { color: C.text }]}>
                        {JOB_TYPE_LABEL[job.job_type as JobType] ?? job.job_type.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())}
                      </Text>
                    </View>
                    <View style={[s.chip, { backgroundColor: (PRIORITY_COLOR[job.priority] ?? C.accent) + '18' }]}>
                      <MaterialCommunityIcons name="lightning-bolt" size={15} color={PRIORITY_COLOR[job.priority] ?? C.accent} />
                      <Text style={[s.chipTxt, { color: PRIORITY_COLOR[job.priority] ?? C.accent, fontWeight: '800' }]}>
                        {PRIORITY_LABEL[job.priority] ?? job.priority}
                      </Text>
                    </View>
                  </ScrollView>

                  {job.access_notes && (
                    <View style={[s.noteRow, { borderTopWidth: 1, borderTopColor: C.border }]}>
                      <MaterialCommunityIcons name="key" size={18} color={C.textSecondary} />
                      <View style={{ flex: 1 }}>
                        <Text style={[s.alertTitle, { color: C.textSecondary }]}>Access Notes</Text>
                        <Text style={[s.alertBody, { color: C.text }]}>{job.access_notes}</Text>
                      </View>
                    </View>
                  )}
                  {job.site_note && (
                    <View style={[s.noteRow, { borderTopWidth: 1, borderTopColor: C.border }]}>
                      <MaterialCommunityIcons name="note-text-outline" size={18} color={C.textSecondary} />
                      <View style={{ flex: 1 }}>
                        <Text style={[s.alertTitle, { color: C.textSecondary }]}>Property Note</Text>
                        <Text style={[s.alertBody, { color: C.text }]}>{job.site_note}</Text>
                        <Text style={[s.detailsCaption, { color: C.textTertiary }]}>
                          Read-only — set on the property record, shared by every job at this site
                        </Text>
                      </View>
                    </View>
                  )}
                </Animated.View>
              )}
            </Card>
          </Animated.View>

          {/* ── ACTIONS ── */}
          <Animated.View entering={noMotion ? undefined : FadeInDown.delay(140).duration(360)}>
            <Text style={[s.sectionLabel, { color: C.textTertiary }]}>Actions</Text>
            <Card variant="default" noPadding>
              {actionRows.map(({ key, ...row }, i) => (
                <ActionRow key={key} {...row} isLast={i === actionRows.length - 1} C={C} />
              ))}
            </Card>
          </Animated.View>

          {/* ── FIELD NOTES ── */}
          <Animated.View entering={noMotion ? undefined : FadeInDown.delay(180).duration(360)}>
            <Text style={[s.sectionLabel, { color: C.textTertiary }]}>Field notes</Text>
            {job.site_note && (
              <Text style={[s.sectionCaption, { color: C.textTertiary }]}>
                Your notes for this visit — separate from the read-only Property Note in Details above.
              </Text>
            )}
            <Card variant="default">
              {isEditingNotes ? (
                <>
                  <TextInput
                    style={[s.notesInput, { color: C.text, borderColor: C.border, backgroundColor: C.backgroundTertiary }]}
                    value={notes}
                    onChangeText={setNotes}
                    multiline
                    maxLength={MAX_LENGTHS.longNotes}
                    placeholder="Document site conditions, access details, or follow-up actions…"
                    placeholderTextColor={C.textTertiary}
                    textAlignVertical="top"
                    autoCorrect={false}
                  />
                  <View style={s.notesActionRow}>
                    <TouchableOpacity
                      style={[s.notesCancelBtn, { borderColor: C.border }]}
                      onPress={() => { setNotes(job.notes ?? ''); setIsEditingNotes(false); }}
                    >
                      <Text style={[s.notesCancelTxt, { color: C.textSecondary }]}>Cancel</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[s.notesSaveBtn, { backgroundColor: C.accent }]}
                      onPress={handleSaveNotes}
                    >
                      <Text style={[s.notesSaveTxt, { color: C.textOnPrimary }]}>Save Notes</Text>
                    </TouchableOpacity>
                  </View>
                </>
              ) : (
                <>
                  <Text style={[notes ? s.notesText : s.notesEmpty, { color: notes ? C.text : C.textTertiary }]}>
                    {notes || 'No notes yet. Tap edit to document site conditions or follow-up actions.'}
                  </Text>
                  <TouchableOpacity
                    style={[s.notesEditBtn, { borderColor: C.border }]}
                    onPress={() => setIsEditingNotes(true)}
                  >
                    <MaterialCommunityIcons name="pencil-outline" size={16} color={C.accent} />
                    <Text style={[s.notesEditTxt, { color: C.accent }]}>
                      {notes ? 'Edit Notes' : 'Add Notes'}
                    </Text>
                  </TouchableOpacity>
                </>
              )}
            </Card>
          </Animated.View>

        </View>
      </ScrollView>

      {/* ── BOTTOM ACTION BAR ── */}
      <View style={[s.bottomBar, { backgroundColor: C.surface, borderTopColor: C.border, borderTopWidth: 1, shadowColor: C.shadow, paddingBottom: 20 + insets.bottom }]}>
        <Button
          title={
            isCompleted && job?.report_url ? 'View Report' :
            isCompleted                    ? 'Generate Report' :
            'Report Not Available'
          }
          variant={isCompleted ? 'secondary' : 'primary'}
          // Report actions only exist once the job is completed — completing
          // it (via Report Summary's Generate Report, or Complete Job here)
          // is what unlocks this. No mid-inspection "draft preview" shortcut:
          // there's exactly one way to get a report, at the end.
          disabled={!isCompleted}
          onPress={() => {
            if (!isCompleted) return;
            if (job?.report_url) {
              // Report is guaranteed current — a completed job only ever
              // loses its report_url via "Continue Working", which also
              // reopens the job. Just show it, don't burn a regeneration.
              router.push(`/jobs/${id}/preview?mode=view` as never);
            } else {
              router.push(`/jobs/${id}/preview` as never);
            }
          }}
          icon={
            <MaterialCommunityIcons
              name={isCompleted && job?.report_url ? 'file-check-outline' : 'file-chart-outline'}
              size={20}
              color={!isCompleted ? C.textTertiary : C.textOnPrimary}
            />
          }
          style={{ height: 52, borderRadius: 26 }}
        />
      </View>


      <CompletionBottomSheet
        visible={showBottomSheet}
        onClose={() => setShowBottomSheet(false)}
        onConfirm={handleFinalizeConfirm}
        onNeedSignature={() => {
          setShowBottomSheet(false);
          if (job) router.push(`/jobs/${job.id}/signature` as never);
        }}
        assetsTotal={totalAssets}
        assetsInspected={inspected}
        hasSignature={hasSig}
        hasDefects={defects.length > 0}
      />

      {/* Job completion celebration modal */}
      <Modal
        visible={showCompletionModal}
        animationType="fade"
        transparent
        onRequestClose={() => {
          if (countdownRef.current) clearInterval(countdownRef.current);
          setShowCompletionModal(false);
        }}
      >
        <View style={[cm.overlay, { backgroundColor: C.shadow + 'D9' }]}>
          <View style={[cm.card, { backgroundColor: C.surface, borderColor: C.border, borderWidth: 1, shadowColor: C.shadow }]}>
            <View style={[cm.checkCircle, { backgroundColor: C.success + '18' }]}>
              <Animated.View entering={noMotion ? undefined : FadeInDown.delay(100).springify()}>
                <MaterialCommunityIcons name="check-bold" size={44} color={C.success} />
              </Animated.View>
            </View>
            <Text style={[cm.title, { color: C.text }]}>Job Complete!</Text>
            <Text style={[cm.property, { color: C.textSecondary }]}>{job?.property_name ?? 'Property'}</Text>

            <View style={[cm.statsRow, { backgroundColor: C.backgroundTertiary, borderColor: C.border, borderWidth: 1 }]}>
              <View style={cm.statItem}>
                <MaterialCommunityIcons name="clipboard-check-outline" size={20} color={C.textTertiary} style={cm.statIcon} />
                <Text style={[cm.statValue, { color: C.text }]}>{assets.filter(a => a.result !== null).length}/{assets.length}</Text>
                <Text style={[cm.statLabel, { color: C.textTertiary }]}>Inspected</Text>
              </View>
              <View style={[cm.statDivider, { backgroundColor: C.border }]} />
              <View style={cm.statItem}>
                <MaterialCommunityIcons name="alert-circle-outline" size={20} color={C.textTertiary} style={cm.statIcon} />
                <Text style={[cm.statValue, { color: C.text }]}>{defects.length}</Text>
                <Text style={[cm.statLabel, { color: C.textTertiary }]}>Defects</Text>
              </View>
              <View style={[cm.statDivider, { backgroundColor: C.border }]} />
              <View style={cm.statItem}>
                <MaterialCommunityIcons name="draw" size={20} color={C.textTertiary} style={cm.statIcon} />
                <Text style={[cm.statValue, { color: C.text }]}>{hasSig ? 'Yes' : 'No'}</Text>
                <Text style={[cm.statLabel, { color: C.textTertiary }]}>Signed</Text>
              </View>
            </View>

            <Text style={[cm.autoCloseTxt, { color: C.textSecondary }]}>
              Returning to dashboard in {completionCountdown}s…
            </Text>

            <TouchableOpacity
              style={[cm.btn, { backgroundColor: C.primary }]}
              onPress={() => {
                if (countdownRef.current) clearInterval(countdownRef.current);
                setShowCompletionModal(false);
              }}
            >
              <Text style={[cm.btnTxt, { color: C.textOnPrimary }]}>Close Now</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

    </View>
  );
}

// ─── Styles ─────────────────────────────────────────────────────────────
const s = StyleSheet.create({
  screen: { flex: 1 },
  centered: { alignItems: 'center', justifyContent: 'center', padding: 24, flex: 1 },
  notFound: { fontSize: 20, fontWeight: '900', marginTop: 12, letterSpacing: -0.5 },
  scrollContent: { paddingBottom: 120 },

  body: { padding: 20, gap: 20 },

  timerLabel: { fontSize: 16, fontWeight: '800', marginBottom: 4 },
  timerSub: { fontSize: 13, fontWeight: '500' },

  statusBannerTitle: { fontSize: 15, fontWeight: '800', marginBottom: 2 },
  statusBannerSub: { fontSize: 13, fontWeight: '500' },
  continueBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 10, borderWidth: 1 },
  continueBtnTxt: { fontSize: 13, fontWeight: '700' },

  alertTitle: { fontSize: 12, fontWeight: '800', letterSpacing: 0.5, textTransform: 'uppercase', marginBottom: 4 },
  alertBody: { fontSize: 14, fontWeight: '500', lineHeight: 20 },
  noteRow: { flexDirection: 'row', gap: 12, padding: 16 },

  chipsRow: { gap: 10, padding: 16 },
  detailsHeader: { flexDirection: 'row', alignItems: 'center', padding: 16, gap: 12 },
  detailsTitle: { fontSize: 15, fontWeight: '800', letterSpacing: -0.2, marginBottom: 2 },
  detailsSub: { fontSize: 12, fontWeight: '600' },
  detailsCaption: { fontSize: 11, fontWeight: '500', fontStyle: 'italic', marginTop: 6 },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 12 },
  chipTxt: { fontSize: 13, fontWeight: '700' },

  progressHeader: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 12 },
  progressTitle: { fontSize: 15, fontWeight: '800', marginBottom: 2, letterSpacing: -0.2 },
  progressSubtitle: { fontSize: 13, fontWeight: '500' },
  progressPct: { fontSize: 20, fontWeight: '800' },
  progressTrack: { height: 8, borderRadius: 4, width: '100%', overflow: 'hidden', marginBottom: 12 },
  progressFill: { height: '100%', borderRadius: 4 },
  progressStatRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 4 },
  progressStat: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  progressStatDot: { width: 8, height: 8, borderRadius: 4 },
  progressStatTxt: { fontSize: 12, fontWeight: '600' },

  inspectRow: { flexDirection: 'row', alignItems: 'center', gap: 14, padding: 16 },
  completeRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 12 },
  completeRowTxt: { fontSize: 13, fontWeight: '600' },
  inspectCtaIcon: { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  inspectChevronWrap: { width: 26, height: 26, borderRadius: 13, alignItems: 'center', justifyContent: 'center' },
  inspectCtaTitle: { fontSize: 16, fontWeight: '800', marginBottom: 2 },
  inspectCtaSub: { fontSize: 13, fontWeight: '500' },

  sectionLabel: { fontSize: 11, fontWeight: '700', letterSpacing: 1.2, marginLeft: 2, marginBottom: 10, textTransform: 'uppercase', },
  sectionCaption: { fontSize: 12, fontWeight: '500', marginLeft: 2, marginTop: -6, marginBottom: 10 },

  notesText: { fontSize: 14, lineHeight: 22, marginBottom: 14, fontWeight: '500' },
  notesEmpty: { fontSize: 13, fontStyle: 'italic', marginBottom: 14, fontWeight: '500' },
  notesEditBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 10, borderRadius: 10, borderWidth: 1 },
  notesEditTxt: { fontSize: 13, fontWeight: '700' },
  notesInput: { borderRadius: 12, borderWidth: 1, padding: 14, fontSize: 15, minHeight: 120, marginBottom: 12, fontWeight: '500' },
  notesActionRow: { flexDirection: 'row', gap: 10, justifyContent: 'flex-end' },
  notesCancelBtn: { paddingHorizontal: 16, paddingVertical: 10, borderRadius: 10, borderWidth: 1 },
  notesCancelTxt: { fontSize: 13, fontWeight: '600' },
  notesSaveBtn: { paddingHorizontal: 20, paddingVertical: 10, borderRadius: 10 },
  notesSaveTxt: { fontSize: 13, fontWeight: '700' },

  bottomBar: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    padding: 20, paddingTop: 20,
    paddingBottom: Platform.OS === 'ios' ? 44 : 20,
    borderTopWidth: 1,
    shadowOffset: { width: 0, height: -10 }, shadowOpacity: 0.15, shadowRadius: 20, elevation: 20,
  },
});

const cm = StyleSheet.create({
  overlay: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  card: { width: '100%', maxWidth: 360, borderRadius: 32, padding: 32, alignItems: 'center', shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.3, shadowRadius: 20, elevation: 15 },
  checkCircle: { width: 88, height: 88, borderRadius: 44, alignItems: 'center', justifyContent: 'center', marginBottom: 20 },
  title: { fontSize: 26, fontWeight: '900', marginBottom: 4, letterSpacing: -0.5 },
  property: { fontSize: 14, fontWeight: '600', marginBottom: 28, textAlign: 'center' },
  statsRow: { flexDirection: 'row', borderRadius: 20, padding: 20, width: '100%', marginBottom: 28 },
  statItem: { flex: 1, alignItems: 'center' },
  statIcon: { marginBottom: 6 },
  statValue: { fontSize: 18, fontWeight: '900', marginBottom: 2, letterSpacing: -0.5 },
  statLabel: { fontSize: 10, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.5 },
  statDivider: { width: 1, height: '80%', alignSelf: 'center' },
  autoCloseTxt: { fontSize: 13, marginBottom: 16, fontWeight: '600' },
  btn: { paddingVertical: 16, paddingHorizontal: 32, borderRadius: 24, width: '100%', alignItems: 'center' },
  btnTxt: { fontSize: 15, fontWeight: '800', letterSpacing: 0.5 },
});
