// app/(app)/jobs/[id]/index.tsx
// Clean dashboard layout — no tabs, action card grid, inline notes, no overflow
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Linking, Modal, Platform, ScrollView, StyleSheet,
  View, TouchableOpacity, TextInput, Alert,
} from 'react-native';
import { Text, ActivityIndicator } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import Animated, { FadeInDown } from 'react-native-reanimated';
import Toast from 'react-native-toast-message';
import { router, useLocalSearchParams, useFocusEffect } from 'expo-router';
import { useAuth } from '@/hooks/useAuth';
import { useJobsStore } from '@/store/jobsStore';
import { LinearGradient } from 'expo-linear-gradient';
import {
  JobStatus, JobType, Priority, InspectionResult, SyncOperation,
} from '@/constants/Enums';
import {
  getJobById, getAssetsWithJobResults, getDefectsForJob, getPhotosForJob,
  getSignatureForJob, updateRecord, addToSyncQueue,
} from '@/lib/database';
import { supabase } from '@/lib/supabase';
import CompletionBottomSheet from '@/components/jobs/CompletionBottomSheet';
import { useColors } from '@/hooks/useColors';
import { ScreenHeader, Button } from '@/components/ui';
import { cardShadow } from '@/components/ui/Card';
import type { Asset, Defect, InspectionPhoto } from '@/types';

// ─── Types ────────────────────────────────────────────────────────────────────
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
  access_notes: string | null; hazard_notes: string | null;
  report_url: string | null;
};

// ─── Helpers ──────────────────────────────────────────────────────────────────
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

// ─── ActionCard mini-component ────────────────────────────────────────────────
type MCIconName = React.ComponentProps<typeof MaterialCommunityIcons>['name'];
function ActionCard({
  icon, title, subtitle, badge, badgeColor, onPress, C,
}: {
  icon: MCIconName; title: string; subtitle?: string;
  badge?: number; badgeColor?: string; onPress: () => void; C: any;
}) {
  return (
    <TouchableOpacity
      style={[ac.card, { backgroundColor: C.surface, borderColor: C.border }, cardShadow]}
      onPress={onPress}
      activeOpacity={0.75}
    >
      <MaterialCommunityIcons name={icon} size={22} color={C.primary} />
      <Text style={[ac.title, { color: C.text }]} numberOfLines={1}>{title}</Text>
      {subtitle ? (
        <Text style={[ac.sub, { color: C.textSecondary }]} numberOfLines={1}>{subtitle}</Text>
      ) : null}
      {(badge !== undefined && badge > 0) ? (
        <View style={[ac.badge, { backgroundColor: badgeColor ?? C.accent }]}>
          <Text style={ac.badgeTxt}>{badge}</Text>
        </View>
      ) : null}
    </TouchableOpacity>
  );
}
const ac = StyleSheet.create({
  card:     { flex: 1, borderRadius: 16, padding: 18, gap: 10, borderWidth: 1, minHeight: 110, position: 'relative' },
  title:    { fontSize: 15, fontWeight: '800', letterSpacing: -0.2 },
  sub:      { fontSize: 13, marginTop: -2 },
  badge:    { position: 'absolute', top: 12, right: 12, minWidth: 22, height: 22, borderRadius: 11, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 6, borderWidth: 2, borderColor: '#FFFFFF' },
  badgeTxt: { fontSize: 10, fontWeight: '800', color: '#FFF' },
});

// ─── Main Screen ──────────────────────────────────────────────────────────────
export default function JobDetailScreen() {
  const C = useColors();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { user } = useAuth();
  const { updateJobStatus } = useJobsStore();


  const PRIORITY_COLOR: Record<Priority, string> = {
    [Priority.Urgent]: C.error,
    [Priority.High]:   C.warning,
    [Priority.Normal]: C.primary,
    [Priority.Low]:    C.textTertiary,
  };

  // ── State ──────────────────────────────────────────────────────────────────
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

  // ── Data loading ───────────────────────────────────────────────────────────
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

  useEffect(() => { loadJob(); }, [loadJob]);
  // Refresh data whenever we navigate back to this screen
  useFocusEffect(useCallback(() => { loadJob(); }, [loadJob]));

  // ── Job actions ────────────────────────────────────────────────────────────
  const handleStartJob = async () => {
    if (!job || !user) return;
    try {
      updateJobStatus(job.id, JobStatus.InProgress);
      setJob(p => p ? { ...p, status: JobStatus.InProgress } : p);
      Toast.show({ type: 'success', text1: 'Job Started ✓' });
    } catch {
      Toast.show({ type: 'error', text1: 'Failed to start job' });
    }
  };

  const handleCompleteRequest = () => setShowBottomSheet(true);
  const handleFinalizeConfirm = () => { setShowBottomSheet(false); finalizeCompletion(); };


  const finalizeCompletion = () => {
    if (!job) return;
    updateJobStatus(job.id, JobStatus.Completed);
    setJob(p => p ? { ...p, status: JobStatus.Completed } : p);
    setShowCompletionModal(true);
    setCompletionCountdown(5);
    // Auto-DISMISS only (no forced redirect) — user controls navigation via buttons
    countdownRef.current = setInterval(() => {
      setCompletionCountdown(prev => {
        if (prev <= 1) {
          if (countdownRef.current) clearInterval(countdownRef.current);
          setShowCompletionModal(false); // just close, stay on job detail
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  };

  const handleSaveNotes = () => {
    if (!job) return;
    const now = new Date().toISOString();
    updateRecord('jobs', job.id, { notes, updated_at: now });
    addToSyncQueue('jobs', job.id, SyncOperation.Update, { notes, updated_at: now });
    setIsEditingNotes(false);
    Toast.show({ type: 'success', text1: 'Notes saved ✓' });
  };

  // ── Continue Working ────────────────────────────────────────────────────────
  const handleContinueWorking = () => {
    if (!job) return;
    Alert.alert(
      'Continue Working?',
      'This will re-open the job and unlock the inspection form. The existing data is preserved — you can add more and re-generate the report when done.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Continue Working',
          onPress: async () => {
            const now = new Date().toISOString();
            // Update local DB first for instant UI response
            updateRecord('jobs', job.id, { status: JobStatus.InProgress, report_url: null, updated_at: now });
            // Update jobsStore so list reflects change
            updateJobStatus(job.id, JobStatus.InProgress);
            // Update local state
            setJob(p => p ? { ...p, status: JobStatus.InProgress, report_url: null } : p);
            Toast.show({ type: 'success', text1: '🔓 Job re-opened', text2: 'Inspection form unlocked' });
            // Directly update Supabase (we need connectivity for this)
            try {
              await supabase.from('jobs')
                .update({ status: 'in_progress', report_url: null, updated_at: now })
                .eq('id', job.id);
            } catch (e) {
              console.warn('[SiteTrack] Could not sync continue-working to Supabase:', e);
              // Add to sync queue as fallback
              addToSyncQueue('jobs', job.id, SyncOperation.Update, { status: JobStatus.InProgress, report_url: null, updated_at: now });
            }
          },
        },
      ]
    );
  };

  const handleNavigate = () => {
    if (!job) return;
    const addr = [job.property_address, job.property_suburb, job.property_state].filter(Boolean).join(', ');
    Linking.openURL(`https://maps.google.com/?q=${encodeURIComponent(addr)}`);
  };

  // ── Derived counts ─────────────────────────────────────────────────────────
  // FLOW-8 FIX: NotTested is a deliberate result choice — count it as inspected.
  // Previously this excluded NotTested, showing lower progress than the inspection form.
  const inspected   = assets.filter(a => a.result !== null).length;
  const totalAssets = assets.length;
  const progressPct = totalAssets > 0 ? Math.round((inspected / totalAssets) * 100) : 0;

  // ── Loading / error states ─────────────────────────────────────────────────
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
        <Text style={{ fontSize: 40 }}>🔍</Text>
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
  const isScheduled  = job.status === JobStatus.Scheduled; // FLOW-10

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <View style={[s.screen, { backgroundColor: C.background }]}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={s.scrollContent}>

        {/* ── HEADER ────────────────────────────────────────────── */}
        <ScreenHeader
          eyebrow={`JOB #${job.id.substring(0, 8).toUpperCase()}`}
          title={job.property_name || 'Job Details'}
          subtitle={[job.property_address, job.property_suburb].filter(Boolean).join(', ') || 'No address on record'}
          showBack={true}
          curved={true}
          rightComponent={
            <View style={[s.statusBadge, {
              backgroundColor: isCompleted  ? 'rgba(74,222,128,0.25)'
                : isCancelled  ? 'rgba(255,255,255,0.15)'
                : isInProgress ? 'rgba(249,115,22,0.28)'
                : 'rgba(255,255,255,0.15)',
            }]}>
              <Text style={[s.statusBadgeTxt, {
                color: isCompleted  ? '#4ADE80'
                  : isCancelled  ? 'rgba(255,255,255,0.7)'
                  : isInProgress ? '#FCD34D'
                  : '#FFFFFF',
              }]}>
                {isInProgress ? '⏱ In Progress'
                  : isCompleted  ? '✓ Completed'
                  : isCancelled  ? '✗ Cancelled'
                  : job.status.replace('_', ' ')}
              </Text>
            </View>
          }
        />

        <View style={s.body}>

          {/* ── JOB ACTIONS WIDGET ──────────────────────────────── */}
          {!isCompleted && !isCancelled && (
            <Animated.View entering={FadeInDown.delay(40).duration(360)}>
              {isInProgress ? (
                <View style={[s.timerCard, { backgroundColor: C.surface, borderColor: C.border, borderWidth: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }]}>
                  <View style={{ flex: 1, marginRight: 16 }}>
                    <Text style={[s.timerLabel, { color: C.text }]}>Job In Progress</Text>
                    <Text style={[s.timerSub, { color: C.textSecondary }]}>You can now perform inspections.</Text>
                  </View>
                  <Button
                    title="Complete Job"
                    onPress={handleCompleteRequest}
                    style={{ borderRadius: 22, height: 44, backgroundColor: C.success }}
                  />
                </View>
              ) : (
                <View style={[s.timerCard, { backgroundColor: C.surface, borderColor: C.border, borderWidth: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }]}>
                  <View style={{ flex: 1, marginRight: 16 }}>
                    <Text style={[s.timerLabel, { color: C.text }]}>Job Scheduled</Text>
                    <Text style={[s.timerSub, { color: C.textSecondary }]}>Start the job to begin work.</Text>
                  </View>
                  <Button
                    title="Start Job"
                    onPress={handleStartJob}
                    style={{ borderRadius: 22, height: 44, minWidth: 110 }}
                  />
                </View>
              )}
            </Animated.View>
          )}

          {/* Completed banner */}
          {isCompleted && (
            <View style={[s.statusBanner, { backgroundColor: C.successLight, borderColor: C.success }]}>
              <MaterialCommunityIcons name="check-decagram" size={22} color={C.successDark} />
              <View style={{ flex: 1 }}>
                <Text style={[s.statusBannerTitle, { color: C.successDark }]}>Job Completed</Text>
                {hasSig && (
                  <Text style={[s.statusBannerSub, { color: C.successDark }]}>Client signature captured</Text>
                )}
              </View>
              <TouchableOpacity
                onPress={handleContinueWorking}
                style={[s.continueBtn, { backgroundColor: C.successDark + '18', borderColor: C.success }]}
              >
                <MaterialCommunityIcons name="pencil-outline" size={14} color={C.successDark} />
                <Text style={[s.continueBtnTxt, { color: C.successDark }]}>Continue</Text>
              </TouchableOpacity>
            </View>
          )}

          {/* Cancelled banner */}
          {isCancelled && (
            <View style={[s.statusBanner, { backgroundColor: C.backgroundTertiary, borderColor: C.border }]}>
              <MaterialCommunityIcons name="cancel" size={22} color={C.textSecondary} />
              <View style={{ flex: 1 }}>
                <Text style={[s.statusBannerTitle, { color: C.textSecondary }]}>Job Cancelled</Text>
                <Text style={[s.statusBannerSub, { color: C.textTertiary }]}>
                  Contact your manager for details.
                </Text>
              </View>
            </View>
          )}

          {/* ── SAFETY ALERTS ─────────────────────────────────────── */}
          {(job.hazard_notes || job.access_notes) && (
            <Animated.View entering={FadeInDown.delay(60).duration(360)} style={{ gap: 8 }}>
              {job.hazard_notes && (
                <View style={[s.alertBox, { backgroundColor: C.errorLight, borderColor: C.error + '40' }]}>
                  <MaterialCommunityIcons name="alert" size={18} color={C.errorDark} />
                  <View style={{ flex: 1 }}>
                    <Text style={[s.alertTitle, { color: C.errorDark }]}>⚠️ Site Hazard</Text>
                    <Text style={[s.alertBody, { color: C.error }]}>{job.hazard_notes}</Text>
                  </View>
                </View>
              )}
              {job.access_notes && (
                <View style={[s.alertBox, { backgroundColor: C.infoLight, borderColor: C.info + '40' }]}>
                  <MaterialCommunityIcons name="key" size={18} color={C.infoDark} />
                  <View style={{ flex: 1 }}>
                    <Text style={[s.alertTitle, { color: C.infoDark }]}>🔑 Access Notes</Text>
                    <Text style={[s.alertBody, { color: C.infoDark }]}>{job.access_notes}</Text>
                  </View>
                </View>
              )}
            </Animated.View>
          )}

          {/* ── INFO CHIPS ────────────────────────────────────────── */}
          <Animated.View entering={FadeInDown.delay(80).duration(360)}>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.chipsRow}>
              <View style={[s.chip, { backgroundColor: C.backgroundTertiary }]}>
                <Text style={s.chipIcon}>📅</Text>
                <Text style={[s.chipTxt, { color: C.text }]}>{fmtDate(job.scheduled_date)}</Text>
              </View>
              {job.scheduled_time && (
                <View style={[s.chip, { backgroundColor: C.backgroundTertiary }]}>
                  <Text style={s.chipIcon}>🕐</Text>
                  <Text style={[s.chipTxt, { color: C.text }]}>{fmtTime(job.scheduled_time)}</Text>
                </View>
              )}
              <View style={[s.chip, { backgroundColor: C.backgroundTertiary }]}>
                <Text style={s.chipIcon}>🔧</Text>
                <Text style={[s.chipTxt, { color: C.text }]}>
                  {JOB_TYPE_LABEL[job.job_type] ?? job.job_type}
                </Text>
              </View>
              <View style={[s.chip, { backgroundColor: (PRIORITY_COLOR[job.priority] ?? C.primary) + '18' }]}>
                <Text style={s.chipIcon}>⚡</Text>
                <Text style={[s.chipTxt, { color: PRIORITY_COLOR[job.priority] ?? C.primary, fontWeight: '700' }]}>
                  {PRIORITY_LABEL[job.priority] ?? job.priority}
                </Text>
              </View>
            </ScrollView>
          </Animated.View>

          {/* ── INSPECTION PROGRESS ───────────────────────────────── */}
          <Animated.View entering={FadeInDown.delay(100).duration(360)}>
            <View style={[s.progressCard, { backgroundColor: C.surface, borderColor: C.border }]}>
              <View style={s.progressHeader}>
                <View style={{ flex: 1 }}>
                  <Text style={[s.progressTitle, { color: C.text }]}>Inspection Progress</Text>
                  <Text style={[s.progressSubtitle, { color: C.textSecondary }]}>
                    {totalAssets === 0
                      ? 'No assets registered for this property'
                      : `${inspected} of ${totalAssets} assets inspected`}
                  </Text>
                </View>
                <Text style={[s.progressPct, { color: progressPct === 100 ? C.success : C.primary }]}>
                  {progressPct}%
                </Text>
              </View>
              <View style={[s.progressTrack, { backgroundColor: C.backgroundTertiary }]}>
                <View style={[s.progressFill, {
                  width: totalAssets > 0 ? (`${progressPct}%` as `${number}%`) : '0%',
                  backgroundColor: progressPct === 100 ? C.success : C.accent,
                }]} />
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
          </Animated.View>

          {/* ── OPEN INSPECTION FORM CTA ──────────────────────────── */}
          <Animated.View entering={FadeInDown.delay(120).duration(360)}>
            <TouchableOpacity
              style={{ borderRadius: 16, overflow: 'hidden' }}
              onPress={isInProgress ? () => router.push(`/jobs/${id}/inspect` as never) : undefined}
              activeOpacity={0.88}
              disabled={!isInProgress}
            >
              {isInProgress ? (
                <LinearGradient
                  colors={['#10B981', '#059669']} // Energetic green gradient when active
                  start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
                  style={[s.inspectCta, { borderWidth: 0 }]}
                >
                  <View style={s.inspectCtaIcon}>
                    <MaterialCommunityIcons name="clipboard-check" size={26} color="#FFF" />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[s.inspectCtaTitle, { color: '#FFF' }]}>
                      Open Inspection Form
                    </Text>
                    <Text style={[s.inspectCtaSub, { color: 'rgba(255,255,255,0.85)' }]}>
                      {totalAssets === 0
                        ? 'Add assets and begin the on-site inspection'
                        : progressPct === 100
                        ? '✓ All assets inspected'
                        : `${totalAssets - inspected} asset${totalAssets - inspected !== 1 ? 's' : ''} remaining`}
                    </Text>
                  </View>
                  <MaterialCommunityIcons name="arrow-right" size={24} color="#FFF" />
                </LinearGradient>
              ) : (
                <View style={[s.inspectCta, { backgroundColor: C.backgroundTertiary, opacity: 0.7 }]}>
                  <View style={s.inspectCtaIcon}>
                    <MaterialCommunityIcons name="clipboard-check-outline" size={26} color={C.textTertiary} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[s.inspectCtaTitle, { color: C.text }]}>
                      Open Inspection Form
                    </Text>
                    <Text style={[s.inspectCtaSub, { color: C.textSecondary }]}>
                      {isScheduled
                        ? '🔒 Start job first to begin the inspection'
                        : isCancelled
                        ? 'This job has been cancelled'
                        : '✓ Inspection locked after job completion'}
                    </Text>
                  </View>
                </View>
              )}
            </TouchableOpacity>
          </Animated.View>

          {/* ── QUICK ACTIONS GRID ────────────────────────────────── */}
          <Animated.View entering={FadeInDown.delay(140).duration(360)}>
            <Text style={[s.sectionLabel, { color: C.textTertiary }]}>QUICK ACTIONS</Text>
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
            <View style={[s.actionsRow, { marginTop: 10 }]}>
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
                subtitle={hasSig ? '✓ Captured' : 'Required for report'}
                onPress={() => router.push(`/jobs/${id}/signature` as never)}
                C={C}
              />
            </View>
          </Animated.View>

          {/* ── NAVIGATE & CONTACT ────────────────────────────────── */}
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

          {/* ── FIELD NOTES ───────────────────────────────────────── */}
          <Animated.View entering={FadeInDown.delay(180).duration(360)}>
            <Text style={[s.sectionLabel, { color: C.textTertiary }]}>FIELD NOTES</Text>
            <View style={[s.notesCard, { backgroundColor: C.surface, borderColor: C.border }]}>
              {isEditingNotes ? (
                <>
                  <TextInput
                    style={[s.notesInput, { color: C.text, borderColor: C.border, backgroundColor: C.backgroundTertiary }]}
                    value={notes}
                    onChangeText={setNotes}
                    multiline
                    placeholder="Document site conditions, access details, or follow-up actions…"
                    placeholderTextColor={C.textTertiary}
                    textAlignVertical="top"
                  />
                  <View style={s.notesActionRow}>
                    <TouchableOpacity
                      style={[s.notesCancelBtn, { borderColor: C.border }]}
                      onPress={() => { setNotes(job.notes ?? ''); setIsEditingNotes(false); }}
                    >
                      <Text style={[s.notesCancelTxt, { color: C.textSecondary }]}>Cancel</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[s.notesSaveBtn, { backgroundColor: C.primary }]}
                      onPress={handleSaveNotes}
                    >
                      <Text style={s.notesSaveTxt}>Save Notes</Text>
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
                    <MaterialCommunityIcons name="pencil-outline" size={14} color={C.primary} />
                    <Text style={[s.notesEditTxt, { color: C.primary }]}>
                      {notes ? 'Edit Notes' : 'Add Notes'}
                    </Text>
                  </TouchableOpacity>
                </>
              )}
            </View>
          </Animated.View>

        </View>
      </ScrollView>

      {/* ── BOTTOM ACTION BAR ─────────────────────────────────────── */}
      <View style={[s.bottomBar, { backgroundColor: C.surface, borderTopColor: C.border }]}>
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
            if (isScheduled || isCancelled) return;
            if (isCompleted && job?.report_url) {
              // Already have a report — go to report screen which shows Open + Re-generate
              router.push(`/jobs/${id}/report` as never);
            } else {
              router.push(`/jobs/${id}/report` as never);
            }
          }}
          icon={
            <MaterialCommunityIcons
              name={isCompleted && job?.report_url ? 'file-check-outline' : isCompleted ? 'file-chart-outline' : 'file-eye-outline'}
              size={20}
              color={(isScheduled || isCancelled) ? C.textTertiary : '#FFFFFF'}
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
        <View style={cm.overlay}>
          <View style={[cm.card, { backgroundColor: C.primary }]}>
            <View style={[cm.checkCircle, { backgroundColor: C.success, shadowColor: C.success }]}>
              <Animated.View entering={FadeInDown.delay(100).springify()}>
                <MaterialCommunityIcons name="check-bold" size={48} color="#FFFFFF" />
              </Animated.View>
            </View>
            <Text style={cm.title}>Job Complete!</Text>
            <Text style={cm.property}>{job?.property_name ?? 'Property'}</Text>

            <View style={cm.statsRow}>
              <View style={cm.statItem}>
                <Text style={cm.statEmoji}>✅</Text>
                <Text style={cm.statValue}>{assets.filter(a => a.result).length}/{assets.length}</Text>
                <Text style={cm.statLabel}>Inspected</Text>
              </View>
              <View style={cm.statDivider} />
              <View style={cm.statItem}>
                <Text style={cm.statEmoji}>⚠️</Text>
                <Text style={cm.statValue}>{defects.length}</Text>
                <Text style={cm.statLabel}>Defects</Text>
              </View>
              <View style={cm.statDivider} />
              <View style={cm.statItem}>
                <Text style={cm.statEmoji}>📷</Text>
                <Text style={cm.statValue}>{photos.length}</Text>
                <Text style={cm.statLabel}>Photos</Text>
              </View>
            </View>

            <View style={{ width: '100%', marginTop: 12 }}>
              <Button
                title="Generate Report"
                icon={<MaterialCommunityIcons name="file-chart-outline" size={20} color="#FFF" />}
                onPress={() => {
                  if (countdownRef.current) clearInterval(countdownRef.current);
                  setShowCompletionModal(false);
                  router.push(`/jobs/${job?.id}/report` as never);
                }}
                style={{ borderRadius: 20 }}
              />
            </View>
            <View style={{ width: '100%', marginTop: 8 }}>
              <Button
                variant="outline"
                title="← Back to Schedule"
                onPress={() => {
                  if (countdownRef.current) clearInterval(countdownRef.current);
                  setShowCompletionModal(false);
                  router.replace('/jobs' as never);
                }}
                style={{ borderRadius: 20, borderColor: 'rgba(255,255,255,0.3)' }}
                textStyle={{ color: '#FFF' }}
              />
            </View>
            <Text style={cm.countdown}>This will close in {completionCountdown}s</Text>
          </View>
        </View>
      </Modal>
    </View>
  );
}

// ─── Styles ────────────────────────────────────────────────────────────────────
const s = StyleSheet.create({
  screen:        { flex: 1 },
  centered:      { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 },
  scrollContent: { paddingBottom: Platform.OS === 'ios' ? 140 : 120 },
  body:          { padding: 16, gap: 18 },
  notFound:      { fontSize: 16, marginTop: 12 },

  // Header status badge
  statusBadge:    { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 10 },
  statusBadgeTxt: { fontSize: 11, fontWeight: '700', letterSpacing: 0.2 },

  // Timer card
  timerCard:        { borderRadius: 16, padding: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
                      shadowColor: '#0D1526', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.1, shadowRadius: 16, elevation: 6 },
  timerLabel:       { fontSize: 16, fontWeight: '700', marginBottom: 2 },
  timerSub:         { fontSize: 13, marginTop: 2 },

  // Status banners
  statusBanner:      { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 16, borderRadius: 16, borderWidth: 1 },
  statusBannerTitle: { fontSize: 14, fontWeight: '700' },
  statusBannerSub:   { fontSize: 12, marginTop: 2 },
  continueBtn:       { flexDirection: 'row', alignItems: 'center', gap: 5, borderRadius: 10, borderWidth: 1, paddingHorizontal: 10, paddingVertical: 7 },
  continueBtnTxt:    { fontSize: 12, fontWeight: '700' },

  // Safety alerts
  alertBox:   { flexDirection: 'row', padding: 16, borderRadius: 16, gap: 12, borderWidth: 1 },
  alertTitle: { fontSize: 14, fontWeight: '800', marginBottom: 4 },
  alertBody:  { fontSize: 13, lineHeight: 20 },

  // Info chips
  chipsRow: { gap: 8, flexDirection: 'row', paddingBottom: 2, paddingRight: 4 },
  chip:     { flexDirection: 'row', alignItems: 'center', gap: 6, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 8 },
  chipIcon: { fontSize: 13 },
  chipTxt:  { fontSize: 13, fontWeight: '500' },

  // Inspection progress card
  progressCard:     { borderRadius: 16, padding: 18, borderWidth: 1,
                      shadowColor: '#0D1526', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.08, shadowRadius: 12, elevation: 4 },
  progressHeader:   { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 14 },
  progressTitle:    { fontSize: 15, fontWeight: '700', marginBottom: 3 },
  progressSubtitle: { fontSize: 12 },
  progressPct:      { fontSize: 22, fontWeight: '800', marginLeft: 8 },
  progressTrack:    { height: 8, borderRadius: 4, overflow: 'hidden', marginBottom: 10 },
  progressFill:     { height: 8, borderRadius: 4 },
  progressStatRow:  { flexDirection: 'row', gap: 16 },
  progressStat:     { flexDirection: 'row', alignItems: 'center', gap: 5 },
  progressStatDot:  { width: 6, height: 6, borderRadius: 3 },
  progressStatTxt:  { fontSize: 11, fontWeight: '600' },

  // Inspection form CTA
  inspectCta:     { borderRadius: 16, padding: 20, flexDirection: 'row', alignItems: 'center', gap: 16 },
  inspectCtaIcon: { width: 56, height: 56, borderRadius: 16, backgroundColor: 'rgba(255,255,255,0.2)', alignItems: 'center', justifyContent: 'center' },
  inspectCtaTitle:{ fontSize: 17, fontWeight: '800', color: '#FFFFFF', marginBottom: 4 },
  inspectCtaSub:  { fontSize: 13, color: 'rgba(255,255,255,0.75)' },

  // Section label
  sectionLabel: { fontSize: 12, fontWeight: '800', letterSpacing: 1.5, marginBottom: 10, marginTop: 6 },

  // Action cards row
  actionsRow: { flexDirection: 'row', gap: 12 },

  // Quick navigate / contact buttons
  quickBtn:      { flexDirection: 'row', alignItems: 'center', gap: 16, borderRadius: 16, padding: 18, borderWidth: 1,
                   shadowColor: '#0D1526', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 10, elevation: 2 },
  quickBtnIcon:  { width: 44, height: 44, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  quickBtnTitle: { fontSize: 15, fontWeight: '700', marginBottom: 2 },
  quickBtnSub:   { fontSize: 13 },

  // Notes card
  notesCard:      { borderRadius: 16, padding: 18, borderWidth: 1,
                    shadowColor: '#0D1526', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.07, shadowRadius: 10, elevation: 3 },
  notesText:      { fontSize: 14, lineHeight: 22, marginBottom: 14 },
  notesEmpty:     { fontSize: 14, lineHeight: 22, fontStyle: 'italic', marginBottom: 14 },
  notesInput:     { borderRadius: 10, borderWidth: 1, padding: 14, fontSize: 14, lineHeight: 22, minHeight: 110, marginBottom: 14 },
  notesActionRow: { flexDirection: 'row', gap: 10 },
  notesCancelBtn: { flex: 1, height: 44, borderRadius: 10, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  notesCancelTxt: { fontSize: 14, fontWeight: '600' },
  notesSaveBtn:   { flex: 2, height: 44, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  notesSaveTxt:   { fontSize: 14, fontWeight: '700', color: '#FFF' },
  notesEditBtn:   { flexDirection: 'row', alignItems: 'center', gap: 6, borderRadius: 10, borderWidth: 1, paddingVertical: 9, justifyContent: 'center' },
  notesEditTxt:   { fontSize: 13, fontWeight: '700' },

  // Bottom action bar
  bottomBar: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    padding: 16, paddingTop: 16,
    paddingBottom: Platform.OS === 'ios' ? 36 : 16,
    borderTopWidth: 1,
    shadowColor: '#000', shadowOffset: { width: 0, height: -4 }, shadowOpacity: 0.05, shadowRadius: 10, elevation: 10,
  },
});

// Completion modal styles
const cm = StyleSheet.create({
  overlay:     { flex: 1, backgroundColor: 'rgba(0,0,0,0.75)', justifyContent: 'center', padding: 24 },
  card:        { borderRadius: 28, padding: 28, alignItems: 'center', gap: 10 },
  checkCircle: { width: 88, height: 88, borderRadius: 44, alignItems: 'center', justifyContent: 'center', marginBottom: 8, shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.4, shadowRadius: 12, elevation: 8 },
  title:       { fontSize: 28, fontWeight: '800', color: '#FFFFFF', letterSpacing: -0.5 },
  property:    { fontSize: 14, color: 'rgba(255,255,255,0.6)', marginBottom: 8 },
  statsRow:    { flexDirection: 'row', width: '100%', backgroundColor: 'rgba(255,255,255,0.1)', borderRadius: 16, padding: 14, marginVertical: 8 },
  statItem:    { flex: 1, alignItems: 'center', gap: 4 },
  statDivider: { width: 1, backgroundColor: 'rgba(255,255,255,0.15)' },
  statEmoji:   { fontSize: 18 },
  statValue:   { fontSize: 18, fontWeight: '800', color: '#FFFFFF' },
  statLabel:   { fontSize: 11, color: 'rgba(255,255,255,0.55)' },
  countdown:   { fontSize: 12, color: 'rgba(255,255,255,0.7)', marginTop: 4 },
});
