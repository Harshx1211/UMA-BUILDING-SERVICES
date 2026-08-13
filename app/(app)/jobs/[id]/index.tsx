import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Linking, Modal, Platform, ScrollView, StyleSheet,
  View, TouchableOpacity, TextInput, Alert,
} from 'react-native';
import { Text, ActivityIndicator } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import Animated, { FadeInDown } from 'react-native-reanimated';
import Toast from 'react-native-toast-message';
import { router, useLocalSearchParams, useFocusEffect, useNavigation } from 'expo-router';
import { useAuth } from '@/hooks/useAuth';
import { useJobsStore } from '@/store/jobsStore';
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

// ─── ActionCard mini-component ─────────────────────────────────────────────
type MCIconName = React.ComponentProps<typeof MaterialCommunityIcons>['name'];
type ColorsType = ReturnType<typeof useColors>;
function ActionCard({
  icon, title, subtitle, badge, badgeColor, onPress, C,
}: {
  icon: MCIconName; title: string; subtitle?: string;
  badge?: number; badgeColor?: string; onPress: () => void; C: ColorsType;
}) {
  return (
    <Card
      variant="default"
      style={ac.card}
      onPress={onPress}
      padding={14}
    >
      <View style={[ac.iconWrap, { backgroundColor: C.accent + '15' }]}>
        <MaterialCommunityIcons name={icon} size={22} color={C.accent} />
      </View>
      <View style={{ marginTop: 'auto', paddingTop: 12 }}>
        <Text style={[ac.title, { color: C.text }]} numberOfLines={1}>{title}</Text>
        {subtitle ? (
          <Text style={[ac.sub, { color: C.textSecondary }]} numberOfLines={1}>{subtitle}</Text>
        ) : null}
      </View>
      {(badge !== undefined && badge > 0) ? (
        <View style={[ac.badge, { backgroundColor: badgeColor ?? C.accent }]}>
          <Text style={[ac.badgeTxt, { color: C.textOnPrimary }]}>{badge}</Text>
        </View>
      ) : null}
    </Card>
  );
}
const ac = StyleSheet.create({
  card:     { flex: 1, aspectRatio: 1, position: 'relative' },
  iconWrap: { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  title:    { fontSize: 14, fontWeight: '700', letterSpacing: -0.2 },
  sub:      { fontSize: 12, marginTop: 2, fontWeight: '500' },
  badge:    { position: 'absolute', top: 12, right: 12, minWidth: 20, height: 20, borderRadius: 10, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 4, borderWidth: 0 },
  badgeTxt: { fontSize: 9, fontWeight: '800' },
});

// ─── Main Screen ─────────────────────────────────────────────────────────
export default function JobDetailScreen() {
  const C = useColors();
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
    const unsub = navigation.addListener('beforeRemove', (e: any) => {
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
    // FIX: block completion if no assets have been inspected at all.
    // A completed job with 0 inspected assets generates a meaningless blank PDF.
    if (inspected === 0) {
      Alert.alert(
        'No Assets Inspected',
        'You must inspect at least one asset before completing this job.',
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

          {/* ── JOB ACTIONS WIDGET ── */}
          {!isCompleted && !isCancelled && (
            <Animated.View entering={FadeInDown.delay(40).duration(360)}>
              {isInProgress ? (
                <Card style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
                  <View style={{ flex: 1 }}>
                    <Text style={[s.timerLabel, { color: C.text }]}>Job In Progress</Text>
                    <Text style={[s.timerSub, { color: C.textSecondary }]}>You can now perform inspections.</Text>
                  </View>
                  <TouchableOpacity
                    onPress={handleCompleteRequest}
                    style={[s.continueBtn, { backgroundColor: C.primary, borderColor: C.primary, paddingHorizontal: 16, paddingVertical: 10 }]}
                  >
                    <Text style={[s.continueBtnTxt, { color: C.textOnPrimary }]}>Complete Job</Text>
                  </TouchableOpacity>
                </Card>
              ) : (
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
              )}
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

          {/* ── SAFETY ALERTS ── */}
          {(job.hazard_notes || job.access_notes || job.site_note) && (
            <Animated.View entering={FadeInDown.delay(60).duration(360)} style={{ gap: 8 }}>
              {job.hazard_notes && (
                <Card variant="danger" style={{ flexDirection: 'row', gap: 12 }}>
                  <MaterialCommunityIcons name="alert" size={20} color={C.error} />
                  <View style={{ flex: 1 }}>
                    <Text style={[s.alertTitle, { color: C.error }]}>Site Hazard</Text>
                    <Text style={[s.alertBody, { color: C.text }]}>{job.hazard_notes}</Text>
                  </View>
                </Card>
              )}
              {job.access_notes && (
                <Card variant="info" style={{ flexDirection: 'row', gap: 12 }}>
                  <MaterialCommunityIcons name="key" size={20} color={C.info} />
                  <View style={{ flex: 1 }}>
                    <Text style={[s.alertTitle, { color: C.info }]}>Access Notes</Text>
                    <Text style={[s.alertBody, { color: C.text }]}>{job.access_notes}</Text>
                  </View>
                </Card>
              )}
              {job.site_note && (
                <Card variant="info" style={{ flexDirection: 'row', gap: 12 }}>
                  <MaterialCommunityIcons name="note-text-outline" size={20} color={C.info} />
                  <View style={{ flex: 1 }}>
                    <Text style={[s.alertTitle, { color: C.info }]}>Site Note</Text>
                    <Text style={[s.alertBody, { color: C.text }]}>{job.site_note}</Text>
                  </View>
                </Card>
              )}
            </Animated.View>
          )}

          {/* ── INFO CHIPS ── */}
          <Animated.View entering={FadeInDown.delay(80).duration(360)}>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.chipsRow}>
              <View style={[s.chip, { backgroundColor: C.backgroundTertiary }]}>
                <MaterialCommunityIcons name="calendar" size={15} color={C.textSecondary} />
                <Text style={[s.chipTxt, { color: C.text }]}>Sch: {fmtDate(job.scheduled_date)}</Text>
              </View>
              {(isCompleted || isInProgress) && job.updated_at && (
                <View style={[s.chip, { backgroundColor: isCompleted ? C.success + '18' : C.primary + '18' }]}>
                  <MaterialCommunityIcons name={isCompleted ? "check-circle-outline" : "play-circle-outline"} size={15} color={isCompleted ? C.success : C.primary} />
                  <Text style={[s.chipTxt, { color: isCompleted ? C.success : C.primary, fontWeight: '700' }]}>
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
          </Animated.View>

          {/* ── INSPECTION PROGRESS ── */}
          <Animated.View entering={FadeInDown.delay(100).duration(360)}>
            <Card variant="default">
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
            </Card>
          </Animated.View>

          {/* ── OPEN INSPECTION FORM CTA ── */}
          <Animated.View entering={FadeInDown.delay(120).duration(360)}>
            <TouchableOpacity
              style={{ borderRadius: 16, overflow: 'hidden' }}
              onPress={
                isInProgress ? () => router.push(`/jobs/${id}/inspect` as never)
                : isCompleted ? handleContinueWorking
                : undefined
              }
              activeOpacity={0.88}
              disabled={isScheduled || isCancelled}
            >
              {isInProgress ? (
                <Card
                  variant="success"
                  style={s.inspectCta}
                >
                  <View style={[s.inspectCtaIcon, { backgroundColor: C.success + '20' }]}>
                    <MaterialCommunityIcons name="clipboard-check" size={26} color={C.success} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[s.inspectCtaTitle, { color: C.success }]}>
                      Open inspection form
                    </Text>
                    <Text style={[s.inspectCtaSub, { color: C.success, opacity: 0.85 }]}>
                      {totalAssets === 0
                        ? 'Add assets and begin the on-site inspection'
                        : progressPct === 100
                        ? 'All assets inspected'
                        : `${totalAssets - inspected} asset${totalAssets - inspected !== 1 ? 's' : ''} remaining`}
                    </Text>
                  </View>
                  <MaterialCommunityIcons name="arrow-right" size={24} color={C.success} />
                </Card>
              ) : (
                <Card variant="default" style={[s.inspectCta, { opacity: isCompleted ? 1 : 0.7 }]}>
                  <View style={[s.inspectCtaIcon, { backgroundColor: isCompleted ? C.warning + '18' : C.backgroundTertiary }]}>
                    <MaterialCommunityIcons name={isCompleted ? "lock-open-outline" : "clipboard-check-outline"} size={26} color={isCompleted ? C.warningDark : C.textTertiary} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[s.inspectCtaTitle, { color: C.text }]}>
                      {isCompleted ? 'Re-open inspection' : 'Open inspection form'}
                    </Text>
                    <Text style={[s.inspectCtaSub, { color: isCompleted ? C.warningDark : C.textSecondary }]}>
                      {isScheduled
                        ? 'Start job first to begin the inspection'
                        : isCancelled
                        ? 'This job has been cancelled'
                        : 'Tap here to unlock and edit the form'}
                    </Text>
                  </View>
                  {isCompleted && (
                     <MaterialCommunityIcons name="chevron-right" size={24} color={C.warningDark} />
                  )}
                </Card>
              )}
            </TouchableOpacity>
          </Animated.View>

          {/* ── QUICK ACTIONS GRID ── */}
          <Animated.View entering={FadeInDown.delay(140).duration(360)}>
            <Text style={[s.sectionLabel, { color: C.textTertiary }]}>Quick actions</Text>
            <View style={s.actionsRow}>
              <ActionCard
                icon="alert-circle-outline"
                title="Defects"
                subtitle={defects.length === 0 ? 'None logged' : `${defects.length} defect${defects.length !== 1 ? 's' : ''}`}
                badge={defects.length}
                badgeColor={C.error}
                onPress={() => router.push(`/jobs/${id}/defects` as never)}
                C={C}
              />
              <ActionCard
                icon="camera-outline"
                title="Photos"
                subtitle={photos.length === 0 ? 'None captured' : `${photos.length} photo${photos.length !== 1 ? 's' : ''}`}
                badge={photos.length}
                badgeColor={C.accent}
                onPress={() => router.push(`/jobs/${id}/photos` as never)}
                C={C}
              />
            </View>
            <View style={[s.actionsRow, { marginTop: 12 }]}>
              <ActionCard
                icon="file-document-outline"
                title="Quote"
                subtitle="Parts & labour"
                onPress={() => router.push(`/jobs/${id}/quote` as never)}
                C={C}
              />
              <ActionCard
                icon="draw"
                title="Signature"
                subtitle={hasSig ? 'Captured' : 'Required for report'}
                onPress={() => router.push(`/jobs/${id}/signature` as never)}
                C={C}
              />
            </View>
          </Animated.View>

          {/* ── NAVIGATE & CONTACT ── */}
          <Animated.View entering={FadeInDown.delay(160).duration(360)} style={{ gap: 12 }}>
            <TouchableOpacity
              style={[s.quickBtn, { backgroundColor: C.surface, borderColor: C.border }]}
              onPress={handleNavigate}
              activeOpacity={0.8}
            >
              <View style={[s.quickBtnIcon, { backgroundColor: C.info + '18' }]}>
                <MaterialCommunityIcons name="map-marker-path" size={22} color={C.infoDark} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[s.quickBtnTitle, { color: C.text }]}>Navigate to Site</Text>
                {[job.property_address, job.property_suburb].filter(Boolean).length > 0 && (
                  <Text style={[s.quickBtnSub, { color: C.textSecondary }]} numberOfLines={1}>
                    {[job.property_address, job.property_suburb].filter(Boolean).join(', ')}
                  </Text>
                )}
              </View>
              <MaterialCommunityIcons name="chevron-right" size={20} color={C.borderStrong} />
            </TouchableOpacity>

            {job.site_contact_phone && (
              <TouchableOpacity
                style={[s.quickBtn, { backgroundColor: C.surface, borderColor: C.border }]}
                onPress={() => Linking.openURL(`tel:${job.site_contact_phone}`)}
                activeOpacity={0.8}
              >
                <View style={[s.quickBtnIcon, { backgroundColor: C.success + '18' }]}>
                  <MaterialCommunityIcons name="phone-in-talk" size={22} color={C.successDark} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[s.quickBtnTitle, { color: C.text }]}>
                    {job.site_contact_name || 'Call Site Contact'}
                  </Text>
                  <Text style={[s.quickBtnSub, { color: C.textSecondary }]}>{job.site_contact_phone}</Text>
                </View>
                <MaterialCommunityIcons name="chevron-right" size={20} color={C.borderStrong} />
              </TouchableOpacity>
            )}
          </Animated.View>

          {/* ── FIELD NOTES ── */}
          <Animated.View entering={FadeInDown.delay(180).duration(360)}>
            <Text style={[s.sectionLabel, { color: C.textTertiary }]}>Field notes</Text>
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
      <View style={[s.bottomBar, { backgroundColor: C.surface, borderTopColor: C.border, borderTopWidth: 1, shadowColor: C.shadow }]}>
        <Button
          title={
            isCompleted && job?.report_url ? 'View Report' :
            isCompleted                    ? 'Generate Report' :
            isInProgress                   ? 'Draft Preview' :
            'Report Not Available'
          }
          variant={isCompleted ? 'secondary' : 'primary'}
          disabled={isScheduled || isCancelled}
          onPress={() => {
            if (isCompleted && job?.report_url) {
              router.push(`/jobs/${id}/report` as never);
            } else if (isCompleted || isInProgress) {
              router.push(`/jobs/${id}/preview` as never);
            }
          }}
          icon={
            <MaterialCommunityIcons
              name={isCompleted && job?.report_url ? 'file-check-outline' : isCompleted ? 'file-chart-outline' : 'file-eye-outline'}
              size={20}
              color={(isScheduled || isCancelled) ? C.textTertiary : C.textOnPrimary}
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
              <Animated.View entering={FadeInDown.delay(100).springify()}>
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

  body: { padding: 20, gap: 24 },

  timerLabel: { fontSize: 16, fontWeight: '800', marginBottom: 4 },
  timerSub: { fontSize: 13, fontWeight: '500' },

  statusBannerTitle: { fontSize: 15, fontWeight: '800', marginBottom: 2 },
  statusBannerSub: { fontSize: 13, fontWeight: '500' },
  continueBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 10, borderWidth: 1 },
  continueBtnTxt: { fontSize: 13, fontWeight: '700' },

  alertTitle: { fontSize: 12, fontWeight: '800', letterSpacing: 0.5, textTransform: 'uppercase', marginBottom: 4 },
  alertBody: { fontSize: 14, fontWeight: '500', lineHeight: 20 },

  chipsRow: { gap: 10, paddingBottom: 6 },
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

  inspectCta: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  inspectCtaIcon: { width: 44, height: 44, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  inspectCtaTitle: { fontSize: 16, fontWeight: '800', marginBottom: 2 },
  inspectCtaSub: { fontSize: 13, fontWeight: '500' },

  sectionLabel: { fontSize: 11, fontWeight: '700', letterSpacing: 1.2, marginLeft: 2, marginBottom: 10, textTransform: 'uppercase', },

  actionsRow: { flexDirection: 'row', gap: 12, width: '100%' },

  quickBtn: { flexDirection: 'row', alignItems: 'center', padding: 16, borderRadius: 16, borderWidth: 1, gap: 12, flex: 1 },
  quickBtnIcon: { width: 36, height: 36, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  quickBtnTitle: { fontSize: 14, fontWeight: '800', marginBottom: 2 },
  quickBtnSub: { fontSize: 12, fontWeight: '500' },

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
