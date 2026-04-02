// Job Detail — Deep integration w/ Native Map & Signature Canvas — visual overhaul only
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Alert, Linking, ScrollView, StyleSheet,
  TextInput, TouchableOpacity, View,
} from 'react-native';
import { Text, ActivityIndicator } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import Animated, { FadeInDown } from 'react-native-reanimated';
import * as Location from 'expo-location';
import MapView, { Marker, PROVIDER_DEFAULT } from 'react-native-maps';
import Toast from 'react-native-toast-message';
import { router, useLocalSearchParams } from 'expo-router';
import { useAuth } from '@/hooks/useAuth';
import { useJobsStore } from '@/store/jobsStore';
import {
  JobStatus, JobType, Priority, InspectionResult, DefectSeverity, SyncOperation,
} from '@/constants/Enums';
import {
  getJobById, getAssetsWithJobResults, getDefectsForJob, getPhotosForJob,
  getTimeLogsForJob, getSignatureForJob, insertRecord, updateRecord, addToSyncQueue,
} from '@/lib/database';
import { SignatureModal } from '@/components/jobs/SignatureModal';
import Colors from '@/constants/Colors';
import type { Asset, Defect, InspectionPhoto, TimeLog } from '@/types';

// ─── Types ────────────────────────────────────
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
};
type TabKey = 'assets' | 'defects' | 'photos' | 'notes';

// ─── Helpers ──────────────────────────────────
function uuid(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
    const r = (Math.random() * 16) | 0;
    return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
  });
}
function fmtDate(iso: string) {
  try { return new Date(iso).toLocaleDateString('en-AU', { weekday: 'short', day: 'numeric', month: 'short' }); }
  catch { return iso; }
}
function fmtTime(hhmm: string) {
  try {
    const [h, m] = hhmm.split(':').map(Number);
    return `${h % 12 || 12}:${String(m).padStart(2, '0')} ${h >= 12 ? 'PM' : 'AM'}`;
  } catch { return hhmm; }
}
function fmtElapsed(s: number) {
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), sec = s % 60;
  return h > 0 ? `${h}h ${m}m` : `${m}m ${sec}s`;
}

const PRIORITY_LABEL: Record<Priority, string> = {
  [Priority.Urgent]: 'Urgent', [Priority.High]: 'High',
  [Priority.Normal]: 'Normal', [Priority.Low]: 'Low',
};
const PRIORITY_COLOR: Record<Priority, string> = {
  [Priority.Urgent]: Colors.light.error,
  [Priority.High]:   Colors.light.warning,
  [Priority.Normal]: Colors.light.primary,
  [Priority.Low]:    '#94A3B8',
};
const JOB_TYPE_LABEL: Record<JobType, string> = {
  [JobType.RoutineService]: 'Routine Service',
  [JobType.DefectRepair]:   'Defect Repair',
  [JobType.Installation]:   'Installation',
  [JobType.Emergency]:      'Emergency',
  [JobType.Quote]:          'Quote',
};
const RESULT_CFG = {
  [InspectionResult.Pass]:      { icon: 'check-circle' as const,        color: Colors.light.success },
  [InspectionResult.Fail]:      { icon: 'close-circle' as const,        color: Colors.light.error },
  [InspectionResult.NotTested]: { icon: 'minus-circle-outline' as const, color: '#94A3B8' },
};
const SEVERITY_CFG: Record<DefectSeverity, { color: string; label: string }> = {
  [DefectSeverity.Critical]: { color: Colors.light.error,   label: 'Critical' },
  [DefectSeverity.Major]:    { color: Colors.light.warning, label: 'Major' },
  [DefectSeverity.Minor]:    { color: Colors.light.info,    label: 'Minor' },
};

// ─── Info Chip ────────────────────────────────
function InfoChip({ icon, label, color }: { icon: string; label: string; color?: string }) {
  return (
    <View style={chip.wrap}>
      <Text style={chip.icon}>{icon}</Text>
      <Text style={[chip.label, color ? { color } : null]}>{label}</Text>
    </View>
  );
}
const chip = StyleSheet.create({
  wrap:  { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: '#FFFFFF', borderRadius: 20, paddingHorizontal: 12, paddingVertical: 6, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 3, elevation: 1 },
  icon:  { fontSize: 13 },
  label: { fontSize: 13, color: Colors.light.text, fontWeight: '500' },
});

// ─── Main ─────────────────────────────────────
export default function JobDetailScreen() {
  const { id }   = useLocalSearchParams<{ id: string }>();
  const { user } = useAuth();
  const { updateJobStatus } = useJobsStore();

  const [job,     setJob]     = useState<JobDetail | null>(null);
  const [assets,  setAssets]  = useState<AssetWithResult[]>([]);
  const [defects, setDefects] = useState<Defect[]>([]);
  const [photos,  setPhotos]  = useState<InspectionPhoto[]>([]);
  const [notes,   setNotes]   = useState('');
  const [isEditingNotes, setIsEditingNotes] = useState(false);
  const [activeTab, setActiveTab] = useState<TabKey>('assets');
  const [isClocking,   setIsClocking]   = useState(false);
  const [isLoading,    setIsLoading]    = useState(true);
  const [showSigModal, setShowSigModal] = useState(false);
  const [hasSig,       setHasSig]       = useState(false);
  const [elapsed,      setElapsed]      = useState(0);
  const [coords, setCoords] = useState<{ latitude: number; longitude: number } | null>(null);

  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  useEffect(() => {
    if (job?.status === JobStatus.InProgress) {
      timerRef.current = setInterval(() => setElapsed(e => e + 1), 1000);
    }
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [job?.status]);

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
      setIsLoading(false);
      const addr = [j.property_address, j.property_suburb, j.property_state].filter(Boolean).join(', ');
      if (addr) {
        try {
          const res = await Location.geocodeAsync(addr);
          if (res.length > 0) setCoords({ latitude: res[0].latitude, longitude: res[0].longitude });
        } catch { /* ignore */ }
      }
    } catch (err) {
      console.error('[JobDetail] load error:', err);
      setIsLoading(false);
    }
  }, [id]);

  useEffect(() => { loadJob(); }, [loadJob]);

  // ── Actions ─────────────────────────────────
  const handleStartJob = async () => {
    if (!job || !user) return;
    setIsClocking(true);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      let lat: number | null = null, lng: number | null = null;
      if (status === 'granted') {
        const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
        lat = loc.coords.latitude; lng = loc.coords.longitude;
      }
      const now = new Date().toISOString(), logId = uuid();
      insertRecord('time_logs', { id: logId, job_id: job.id, user_id: user.id, clock_in: now, gps_lat: lat, gps_lng: lng });
      addToSyncQueue('time_logs', logId, SyncOperation.Insert, { id: logId, job_id: job.id, user_id: user.id, clock_in: now, gps_lat: lat, gps_lng: lng });
      updateJobStatus(job.id, JobStatus.InProgress);
      setJob(p => p ? { ...p, status: JobStatus.InProgress } : p);
      setElapsed(0);
      Toast.show({ type: 'success', text1: 'Clocked in ✓', text2: lat ? 'GPS location recorded' : 'No GPS — location not recorded' });
    } catch {
      Toast.show({ type: 'error', text1: 'Failed to clock in' });
    } finally { setIsClocking(false); }
  };

  const handleClockOut = async () => {
    if (!job || !user) return;
    setIsClocking(true);
    try {
      const now = new Date().toISOString();
      const logs = getTimeLogsForJob<TimeLog>(job.id);
      const open = logs.find(l => !l.clock_out);
      if (open) {
        updateRecord('time_logs', open.id, { clock_out: now });
        addToSyncQueue('time_logs', open.id, SyncOperation.Update, { clock_out: now });
      }
      if (timerRef.current) clearInterval(timerRef.current);
      Toast.show({ type: 'info', text1: 'Paused', text2: `Time logged — ${fmtElapsed(elapsed)}` });
    } catch { } finally { setIsClocking(false); }
  };

  const handleCompleteRequest = () => {
    if (assets.some(a => !a.result || a.result === InspectionResult.NotTested)) {
      Alert.alert('Incomplete Assets', 'Proceed without inspecting all assets?', [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Proceed', style: 'destructive', onPress: () => setShowSigModal(true) },
      ]);
      return;
    }
    if (!hasSig) { setShowSigModal(true); } else { finalizeCompletion(); }
  };

  const handleSignatureSaved = async (sigBase64: string) => {
    if (!job) return;
    const now = new Date().toISOString(), sigId = uuid();
    const payload = { id: sigId, job_id: job.id, signature_url: sigBase64, signed_by_name: job.site_contact_name ?? 'Client', signed_at: now };
    insertRecord('signatures', payload);
    addToSyncQueue('signatures', sigId, SyncOperation.Insert, payload);
    setHasSig(true);
    finalizeCompletion();
  };

  const finalizeCompletion = () => {
    if (!job) return;
    updateJobStatus(job.id, JobStatus.Completed);
    setJob(p => p ? { ...p, status: JobStatus.Completed } : p);
    if (timerRef.current) clearInterval(timerRef.current);
    Toast.show({ type: 'success', text1: '✓ Job completed!', text2: 'Signature verified and job closed.' });
  };

  const handleSaveNotes = () => {
    if (!job) return;
    const now = new Date().toISOString();
    updateRecord('jobs', job.id, { notes, updated_at: now });
    addToSyncQueue('jobs', job.id, SyncOperation.Update, { notes, updated_at: now });
    setIsEditingNotes(false);
    Toast.show({ type: 'success', text1: 'Notes saved ✓' });
  };

  const handleNavigate = () => {
    if (!job) return;
    const addr = [job.property_address, job.property_suburb, job.property_state].filter(Boolean).join(', ');
    Linking.openURL(`https://maps.google.com/?q=${encodeURIComponent(addr)}`);
  };

  // ── Derived ──────────────────────────────────
  const inspected   = assets.filter(a => a.result && a.result !== InspectionResult.NotTested).length;
  const totalAssets = assets.length;
  const progressPct = totalAssets > 0 ? Math.round((inspected / totalAssets) * 100) : 0;
  const fullAddress = [job?.property_address, job?.property_suburb, job?.property_state, job?.property_postcode].filter(Boolean).join(', ');

  const TAB_LABELS: Record<TabKey, string> = {
    assets:  `Assets${totalAssets > 0 ? ` (${totalAssets})` : ''}`,
    defects: `Defects${defects.length > 0 ? ` (${defects.length})` : ''}`,
    photos:  `Photos${photos.length > 0 ? ` (${photos.length})` : ''}`,
    notes:   'Notes',
  };

  if (isLoading) return (
    <View style={[s.screen, s.centered]}>
      <ActivityIndicator color={Colors.light.primary} size="large" />
    </View>
  );

  if (!job) return (
    <View style={[s.screen, s.centered]}>
      <Text style={{ fontSize: 40 }}>🔍</Text>
      <Text style={s.notFound}>Job not found</Text>
      <TouchableOpacity style={s.backBtn} onPress={() => router.back()}>
        <Text style={s.backBtnTxt}>← Go Back</Text>
      </TouchableOpacity>
    </View>
  );

  const isScheduled  = job.status === JobStatus.Scheduled;
  const isInProgress = job.status === JobStatus.InProgress;
  const isCompleted  = job.status === JobStatus.Completed;
  const isCancelled  = job.status === JobStatus.Cancelled;

  return (
    <View style={s.screen}>

      {/* ── MAP HEADER ─────────────────────── */}
      <View style={s.mapWrap}>
        {coords ? (
          <MapView
            style={s.map}
            provider={PROVIDER_DEFAULT}
            initialRegion={{ latitude: coords.latitude, longitude: coords.longitude, latitudeDelta: 0.005, longitudeDelta: 0.005 }}
            scrollEnabled={false} zoomEnabled={false} pitchEnabled={false}
          >
            <Marker coordinate={coords} pinColor={Colors.light.accent} />
          </MapView>
        ) : (
          <View style={s.mapFallback}>
            <MaterialCommunityIcons name="map-marker-off-outline" size={32} color={Colors.light.border} />
          </View>
        )}
        {/* Back button overlay */}
        <TouchableOpacity style={s.backOverlay} onPress={() => router.back()}>
          <MaterialCommunityIcons name="arrow-left" size={20} color={Colors.light.primary} />
        </TouchableOpacity>
        {/* Navigate pill overlay */}
        <TouchableOpacity style={s.navOverlay} onPress={handleNavigate}>
          <Text style={{ fontSize: 13 }}>🗺️</Text>
          <Text style={s.navOverlayTxt}>Navigate</Text>
        </TouchableOpacity>
      </View>

      {/* ── PROPERTY NAME BAR ───────────────── */}
      <View style={s.propBar}>
        <View style={{ flex: 1 }}>
          <Text style={s.propName} numberOfLines={1}>{job.property_name ?? 'Job'}</Text>
          {fullAddress ? <Text style={s.propAddr} numberOfLines={1}>{fullAddress}</Text> : null}
        </View>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 110 }}>

        {/* ── SAFETY ALERTS ───────────────── */}
        {job.access_notes ? (
          <View style={s.alertAccess}>
            <MaterialCommunityIcons name="key-variant" size={18} color="#1D4ED8" />
            <View style={{ flex: 1 }}>
              <Text style={s.alertAccessTitle}>Access Notes</Text>
              <Text style={s.alertAccessBody}>{job.access_notes}</Text>
            </View>
          </View>
        ) : null}
        {job.hazard_notes ? (
          <View style={s.alertHazard}>
            <MaterialCommunityIcons name="alert-outline" size={18} color={Colors.light.error} />
            <View style={{ flex: 1 }}>
              <Text style={s.alertHazardTitle}>⚠️ Hazard Warning</Text>
              <Text style={s.alertHazardBody}>{job.hazard_notes}</Text>
            </View>
          </View>
        ) : null}

        {/* ── INFO CHIPS ROW ───────────────── */}
        <Animated.View entering={FadeInDown.delay(40).duration(350)}>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={s.chipsRow}
          >
            <InfoChip icon="📅" label={fmtDate(job.scheduled_date)} />
            {job.scheduled_time ? <InfoChip icon="🕐" label={fmtTime(job.scheduled_time)} /> : null}
            <InfoChip icon="🔧" label={JOB_TYPE_LABEL[job.job_type] ?? job.job_type} />
            <InfoChip 
              icon="⚡" 
              label={(PRIORITY_LABEL[job.priority] ?? job.priority) + ' Priority'} 
              color={PRIORITY_COLOR[job.priority]}
            />
          </ScrollView>
        </Animated.View>

        {/* ── SITE CONTACT CARD ─────────────── */}
        {job.site_contact_name ? (
          <Animated.View entering={FadeInDown.delay(80).duration(350)} style={s.contactCard}>
            <View style={s.contactRow}>
              <View style={s.contactIcon}>
                <MaterialCommunityIcons name="account-outline" size={16} color={Colors.light.primary} />
              </View>
              <Text style={s.contactName}>{job.site_contact_name}</Text>
            </View>
            {job.site_contact_phone ? (
              <TouchableOpacity
                style={s.contactRow}
                onPress={() => Linking.openURL(`tel:${job.site_contact_phone}`)}
              >
                <View style={s.contactIcon}>
                  <MaterialCommunityIcons name="phone-outline" size={16} color={Colors.light.accent} />
                </View>
                <Text style={s.contactPhone}>{job.site_contact_phone}</Text>
              </TouchableOpacity>
            ) : null}
          </Animated.View>
        ) : null}

        {/* ── CLOCK IN / TIME TRACKING ──────── */}
        <Animated.View entering={FadeInDown.delay(120).duration(350)} style={s.clockCard}>
          <Text style={s.clockTitle}>Time Tracking</Text>

          {isScheduled && (
            <TouchableOpacity
              style={[s.startBtn, isClocking && s.startBtnLoading]}
              onPress={handleStartJob}
              disabled={isClocking}
              activeOpacity={0.85}
            >
              {isClocking
                ? <ActivityIndicator color="#FFFFFF" size="small" />
                : <MaterialCommunityIcons name="map-marker-radius" size={20} color="#FFFFFF" />
              }
              <View>
                <Text style={s.startBtnTitle}>Clock In & Start Job</Text>
                <Text style={s.startBtnSub}>GPS location will be recorded</Text>
              </View>
            </TouchableOpacity>
          )}

          {isInProgress && (
            <View style={s.activeBox}>
              <View style={s.activeTimerRow}>
                <Text style={s.activeTimerTxt}>Started at {job.scheduled_time ? fmtTime(job.scheduled_time) : 'unknown'} — {fmtElapsed(elapsed)}</Text>
              </View>
              <View style={s.activeActions}>
                <TouchableOpacity style={s.pauseBtn} onPress={handleClockOut} disabled={isClocking}>
                  <Text style={{ fontSize: 14 }}>⏸</Text>
                  <Text style={s.pauseBtnTxt}>Pause</Text>
                </TouchableOpacity>
                <TouchableOpacity style={s.completeBtn} onPress={handleCompleteRequest} disabled={isClocking}>
                  <Text style={{ fontSize: 14 }}>✅</Text>
                  <Text style={s.completeBtnTxt}>Complete</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}

          {isCompleted && (
            <View style={s.completedBanner}>
              <MaterialCommunityIcons name="check-circle" size={20} color={Colors.light.success} />
              <View>
                <Text style={s.completedBannerTxt}>Job Completed</Text>
                {hasSig && <Text style={s.completedBannerSub}>Client signature recorded</Text>}
              </View>
            </View>
          )}

          {isCancelled && (
            <View style={s.cancelledBanner}>
              <MaterialCommunityIcons name="cancel" size={20} color={Colors.light.textSecondary} />
              <Text style={s.cancelledBannerTxt}>Job Cancelled</Text>
            </View>
          )}
        </Animated.View>

        {/* ── ASSET PROGRESS ────────────────── */}
        {totalAssets > 0 && (
          <Animated.View entering={FadeInDown.delay(150).duration(350)} style={s.progressCard}>
            <View style={s.progressRow}>
              <Text style={s.progressLabel}>{inspected}/{totalAssets} assets inspected</Text>
              <Text style={[s.progressPct, { color: progressPct === 100 ? Colors.light.success : Colors.light.primary }]}>
                {progressPct}%
              </Text>
            </View>
            <View style={s.progressTrack}>
              <View
                style={[
                  s.progressFill,
                  {
                    width: `${progressPct}%` as `${number}%`,
                    backgroundColor: progressPct === 100 ? Colors.light.success : Colors.light.accent,
                  },
                ]}
              />
            </View>
          </Animated.View>
        )}

        {/* ── CUSTOM TAB BAR ───────────────── */}
        <Animated.View entering={FadeInDown.delay(180).duration(350)}>
          <View style={s.tabBar}>
            {(Object.keys(TAB_LABELS) as TabKey[]).map(t => (
              <TouchableOpacity
                key={t}
                style={[s.tabItem, activeTab === t && s.tabItemActive]}
                onPress={() => setActiveTab(t)}
              >
                <Text style={[s.tabItemTxt, activeTab === t && s.tabItemTxtActive]} numberOfLines={1}>
                  {TAB_LABELS[t]}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* ── TAB CONTENT ──────────────────── */}
          <View style={s.tabContent}>

            {/* ASSETS */}
            {activeTab === 'assets' && (
              <View>
                {assets.length === 0 ? (
                  <View style={s.tabEmpty}>
                    <Text style={{ fontSize: 32 }}>🧯</Text>
                    <Text style={s.tabEmptyTitle}>No assets registered</Text>
                    <Text style={s.tabEmptySub}>Contact office to add assets to this property</Text>
                  </View>
                ) : (
                  assets.map((asset, i) => {
                    const rc = asset.result ? RESULT_CFG[asset.result] : null;
                    return (
                      <TouchableOpacity
                        key={asset.id}
                        style={[s.assetRow, i < assets.length - 1 && s.rowBorder]}
                        onPress={() => router.push(`/jobs/${id}/inspect` as never)}
                      >
                        <View style={s.assetIconCircle}>
                          <Text style={{ fontSize: 16 }}>🔥</Text>
                        </View>
                        <View style={{ flex: 1 }}>
                          <Text style={s.assetType}>{asset.asset_type}</Text>
                          {asset.location_on_site ? (
                            <Text style={s.assetLoc}>{asset.location_on_site}</Text>
                          ) : null}
                        </View>
                        {rc ? (
                          <View style={s.resultPill}>
                            <MaterialCommunityIcons name={rc.icon} size={16} color={rc.color} />
                            <Text style={[s.resultTxt, { color: rc.color }]}>
                              {asset.result === InspectionResult.Pass ? 'Pass' : 'Fail'}
                            </Text>
                          </View>
                        ) : (
                          <View style={s.pendingPill}>
                            <Text style={s.pendingTxt}>Pending</Text>
                          </View>
                        )}
                        <MaterialCommunityIcons name="chevron-right" size={16} color={Colors.light.border} />
                      </TouchableOpacity>
                    );
                  })
                )}
                {assets.length > 0 && (
                  <TouchableOpacity style={s.tabActionBtn} onPress={() => router.push(`/jobs/${id}/inspect` as never)}>
                    <MaterialCommunityIcons name="barcode-scan" size={18} color="#FFFFFF" />
                    <Text style={s.tabActionTxt}>Inspect All Assets</Text>
                  </TouchableOpacity>
                )}
              </View>
            )}

            {/* DEFECTS */}
            {activeTab === 'defects' && (
              <View>
                {defects.length === 0 ? (
                  <View style={s.tabEmpty}>
                    <Text style={{ fontSize: 32 }}>✅</Text>
                    <Text style={[s.tabEmptyTitle, { color: Colors.light.success }]}>No defects raised</Text>
                  </View>
                ) : (
                  defects.map((d, i) => {
                    const sc = SEVERITY_CFG[d.severity as DefectSeverity];
                    return (
                      <View key={d.id} style={[s.defectCard, { borderLeftColor: sc?.color ?? '#ccc' }]}>
                        <View style={{ flex: 1 }}>
                          <Text style={s.defectDesc}>{d.description}</Text>
                          <Text style={s.defectMeta}>{sc?.label ?? d.severity} · {d.status.toUpperCase()}</Text>
                        </View>
                        <View style={[s.defectStatusPill, { backgroundColor: d.status === 'open' ? Colors.light.errorLight : Colors.light.successLight }]}>
                          <Text style={{ fontSize: 10, fontWeight: '700', color: d.status === 'open' ? Colors.light.errorDark : Colors.light.successDark }}>
                            {d.status.toUpperCase()}
                          </Text>
                        </View>
                      </View>
                    );
                  })
                )}
                <TouchableOpacity
                  style={[s.tabActionBtn, s.tabActionBtnOutline]}
                  onPress={() => router.push(`/jobs/${id}/defects` as never)}
                >
                  <MaterialCommunityIcons name="plus" size={18} color={Colors.light.primary} />
                  <Text style={[s.tabActionTxt, { color: Colors.light.primary }]}>Log Defect</Text>
                </TouchableOpacity>
              </View>
            )}

            {/* PHOTOS */}
            {activeTab === 'photos' && (
              <View>
                {photos.length === 0 ? (
                  <View style={s.tabEmpty}>
                    <Text style={{ fontSize: 32 }}>📷</Text>
                    <Text style={s.tabEmptyTitle}>No photos yet</Text>
                    <Text style={s.tabEmptySub}>Document your inspection with photos</Text>
                  </View>
                ) : (
                  <View style={s.photoGrid}>
                    {photos.map(p => (
                      <View key={p.id} style={s.photoThumb}>
                        <MaterialCommunityIcons name="image-outline" size={28} color={Colors.light.border} />
                      </View>
                    ))}
                  </View>
                )}
                <TouchableOpacity style={s.tabActionBtn} onPress={() => router.push(`/jobs/${id}/photos` as never)}>
                  <MaterialCommunityIcons name="camera-plus-outline" size={18} color="#FFFFFF" />
                  <Text style={s.tabActionTxt}>Add Photo</Text>
                </TouchableOpacity>
              </View>
            )}

            {/* NOTES */}
            {activeTab === 'notes' && (
              <View style={s.notesCard}>
                {isEditingNotes ? (
                  <View>
                    <TextInput
                      style={s.notesInput}
                      value={notes}
                      onChangeText={setNotes}
                      placeholder="Add job notes here..."
                      placeholderTextColor={Colors.light.textTertiary}
                      multiline
                      textAlignVertical="top"
                      maxLength={1000}
                    />
                    <Text style={s.notesCount}>{notes.length}/1000</Text>
                    <View style={{ flexDirection: 'row', gap: 10 }}>
                      <TouchableOpacity style={[s.tabActionBtn, { flex: 1, backgroundColor: '#FFFFFF', borderWidth: 1.5, borderColor: '#E2E8F0', marginTop: 0 }]} onPress={() => setIsEditingNotes(false)}>
                        <Text style={[s.tabActionTxt, { color: '#64748B' }]}>Cancel</Text>
                      </TouchableOpacity>
                      <TouchableOpacity style={[s.tabActionBtn, { flex: 1, marginTop: 0 }]} onPress={handleSaveNotes}>
                        <Text style={s.tabActionTxt}>Save Notes</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                ) : (
                  <View>
                    {notes ? (
                      <Text style={{ fontSize: 14, color: '#0F172A', lineHeight: 22, marginBottom: 16 }}>{notes}</Text>
                    ) : (
                      <Text style={{ fontSize: 14, color: '#64748B', fontStyle: 'italic', marginBottom: 16 }}>No notes documented.</Text>
                    )}
                    <TouchableOpacity style={[s.tabActionBtn, s.tabActionBtnOutline]} onPress={() => setIsEditingNotes(true)}>
                      <Text style={{ fontSize: 14 }}>✏️</Text>
                      <Text style={[s.tabActionTxt, { color: Colors.light.primary }]}>Edit Notes</Text>
                    </TouchableOpacity>
                  </View>
                )}
              </View>
            )}
          </View>
        </Animated.View>
      </ScrollView>

      {/* ── BOTTOM FIXED BUTTON ───────────── */}
      <View style={s.bottomBar}>
        <TouchableOpacity
          style={[s.reportBtn, isCompleted ? s.reportBtnNavy : null]}
          onPress={() => router.push(`/jobs/${id}/report` as never)}
          activeOpacity={0.8}
        >
          <Text style={{ fontSize: 16 }}>📄</Text>
          <Text style={s.reportBtnTxt}>{isCompleted ? 'View Report' : 'Generate Report'}</Text>
        </TouchableOpacity>
      </View>

      {/* Signature Modal */}
      <SignatureModal
        visible={showSigModal}
        onClose={() => setShowSigModal(false)}
        clientName={job?.site_contact_name ?? undefined}
        onSign={handleSignatureSaved}
      />
    </View>
  );
}

// ─── Styles ──────────────────────────────────
const s = StyleSheet.create({
  screen:   { flex: 1, backgroundColor: Colors.light.background },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 },

  // Map header
  mapWrap:    { height: 160, backgroundColor: Colors.light.backgroundTertiary, position: 'relative' },
  map:        { ...StyleSheet.absoluteFillObject },
  mapFallback:{ flex: 1, alignItems: 'center', justifyContent: 'center' },
  backOverlay:{ position: 'absolute', top: 48, left: 16, backgroundColor: '#FFFFFF', padding: 8, borderRadius: 20, shadowColor: '#000', shadowOpacity: 0.12, shadowRadius: 6, elevation: 4 },
  navOverlay: { position: 'absolute', top: 48, right: 16, backgroundColor: '#FFFFFF', flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 20, shadowColor: '#000', shadowOpacity: 0.1, shadowRadius: 6, elevation: 4 },
  navOverlayTxt: { fontSize: 13, fontWeight: '700', color: Colors.light.primary },

  // Property bar
  propBar:  { backgroundColor: Colors.light.primary, padding: 16, flexDirection: 'row', alignItems: 'center' },
  propName: { fontSize: 18, fontWeight: '700', color: '#FFFFFF', letterSpacing: -0.2 },
  propAddr: { fontSize: 12, color: 'rgba(255,255,255,0.65)', marginTop: 3, lineHeight: 16 },

  // Alert cards
  alertAccess: { borderLeftWidth: 4, borderLeftColor: '#1D4ED8', backgroundColor: '#EFF6FF', flexDirection: 'row', gap: 10, padding: 14, marginHorizontal: 16, marginTop: 12, borderRadius: 12, alignItems: 'flex-start' },
  alertAccessTitle: { fontSize: 12, fontWeight: '700', color: '#1E40AF', marginBottom: 3 },
  alertAccessBody:  { fontSize: 12, color: '#1E40AF', lineHeight: 18 },
  alertHazard: { borderLeftWidth: 4, borderLeftColor: Colors.light.error, backgroundColor: '#FEF2F2', flexDirection: 'row', gap: 10, padding: 14, marginHorizontal: 16, marginTop: 8, borderRadius: 12, alignItems: 'flex-start' },
  alertHazardTitle: { fontSize: 12, fontWeight: '700', color: Colors.light.errorDark, marginBottom: 3 },
  alertHazardBody:  { fontSize: 12, color: Colors.light.errorDark, lineHeight: 18 },

  // Info chips
  chipsRow: { paddingHorizontal: 16, paddingVertical: 12, gap: 8, flexDirection: 'row' },

  // Site contact
  contactCard: { backgroundColor: '#FFFFFF', borderRadius: 16, marginHorizontal: 16, marginBottom: 4, padding: 14, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 8, elevation: 3, gap: 10 },
  contactRow:  { flexDirection: 'row', alignItems: 'center', gap: 10 },
  contactIcon: { width: 32, height: 32, borderRadius: 16, backgroundColor: Colors.light.background, alignItems: 'center', justifyContent: 'center' },
  contactName: { fontSize: 14, fontWeight: '600', color: Colors.light.text },
  contactPhone:{ fontSize: 14, fontWeight: '600', color: Colors.light.accent, textDecorationLine: 'underline' },

  // Clock card
  clockCard:  { backgroundColor: '#FFFFFF', borderRadius: 16, marginHorizontal: 16, marginTop: 8, padding: 16, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 8, elevation: 3, gap: 12 },
  clockTitle: { fontSize: 14, fontWeight: '700', color: Colors.light.text },

  startBtn:        { backgroundColor: Colors.light.accent, borderRadius: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 12, paddingVertical: 16, paddingHorizontal: 20, shadowColor: Colors.light.accent, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8, elevation: 4 },
  startBtnLoading: { opacity: 0.75 },
  startBtnTitle:   { fontSize: 16, fontWeight: '700', color: '#FFFFFF' },
  startBtnSub:     { fontSize: 11, color: 'rgba(255,255,255,0.75)', marginTop: 2 },

  activeBox:       { padding: 12 },
  activeTimerRow:  { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
  activeTimerTxt:  { fontSize: 13, color: Colors.light.textSecondary },
  activeActions:   { flexDirection: 'row', gap: 10 },
  pauseBtn:        { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: '#FFFFFF', borderWidth: 1.5, borderColor: '#E2E8F0', paddingVertical: 12, borderRadius: 12 },
  pauseBtnTxt:     { fontSize: 14, fontWeight: '600', color: Colors.light.textSecondary },
  completeBtn:     { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: Colors.light.success, paddingVertical: 12, borderRadius: 12 },
  completeBtnTxt:  { fontSize: 14, fontWeight: '600', color: '#FFFFFF' },

  completedBanner:    { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: Colors.light.successLight, borderRadius: 10, padding: 12 },
  completedBannerTxt: { fontSize: 14, fontWeight: '700', color: Colors.light.successDark },
  completedBannerSub: { fontSize: 11, color: Colors.light.success, marginTop: 2 },
  cancelledBanner:    { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: Colors.light.backgroundSecondary, borderRadius: 10, padding: 12 },
  cancelledBannerTxt: { fontSize: 14, fontWeight: '600', color: Colors.light.textSecondary },

  // Progress
  progressCard:  { backgroundColor: '#FFFFFF', borderRadius: 12, marginHorizontal: 16, marginTop: 10, padding: 14, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 4, elevation: 2 },
  progressRow:   { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  progressLabel: { fontSize: 13, fontWeight: '600', color: Colors.light.textSecondary },
  progressPct:   { fontSize: 15, fontWeight: '800' },
  progressTrack: { height: 6, backgroundColor: Colors.light.backgroundTertiary, borderRadius: 3, overflow: 'hidden' },
  progressFill:  { height: 6, borderRadius: 3 },

  // Tab bar — orange underline active
  tabBar:          { flexDirection: 'row', backgroundColor: '#FFFFFF', borderBottomWidth: 1, borderBottomColor: Colors.light.border, marginTop: 12 },
  tabItem:         { flex: 1, paddingVertical: 12, alignItems: 'center', borderBottomWidth: 2, borderBottomColor: 'transparent' },
  tabItemActive:   { borderBottomColor: Colors.light.accent },
  tabItemTxt:      { fontSize: 12, fontWeight: '500', color: Colors.light.textSecondary },
  tabItemTxtActive:{ fontSize: 12, fontWeight: '700', color: Colors.light.accent },
  tabContent:      { backgroundColor: Colors.light.background, padding: 16 },

  // Tab empty
  tabEmpty:       { alignItems: 'center', gap: 8, paddingVertical: 28 },
  tabEmptyTitle:  { fontSize: 15, fontWeight: '600', color: Colors.light.text },
  tabEmptySub:    { fontSize: 13, color: Colors.light.textSecondary, textAlign: 'center' },

  // Asset rows
  assetRow:       { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, gap: 10, backgroundColor: '#FFFFFF', marginBottom: 8, borderRadius: 12, paddingHorizontal: 12, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.04, shadowRadius: 3, elevation: 1 },
  rowBorder:      {},
  assetIconCircle:{ width: 36, height: 36, borderRadius: 10, backgroundColor: Colors.light.errorLight, alignItems: 'center', justifyContent: 'center' },
  assetType:      { fontSize: 14, fontWeight: '600', color: Colors.light.text },
  assetLoc:       { fontSize: 12, color: Colors.light.textSecondary, marginTop: 2 },
  resultPill:     { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: Colors.light.background, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 20 },
  resultTxt:      { fontSize: 11, fontWeight: '700' },
  pendingPill:    { backgroundColor: Colors.light.backgroundTertiary, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 20 },
  pendingTxt:     { fontSize: 11, color: Colors.light.textSecondary, fontWeight: '500' },

  // Defect cards
  defectCard:     { backgroundColor: '#FFFFFF', borderRadius: 12, borderLeftWidth: 4, flexDirection: 'row', alignItems: 'center', padding: 12, marginBottom: 8, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.04, shadowRadius: 3, elevation: 1 },
  defectDesc:     { fontSize: 13, fontWeight: '600', color: Colors.light.text, flex: 1 },
  defectMeta:     { fontSize: 11, color: Colors.light.textSecondary, marginTop: 2 },
  defectStatusPill: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 20, marginLeft: 8 },

  // Photo grid
  photoGrid:  { flexDirection: 'row', flexWrap: 'wrap', gap: 4, marginBottom: 12 },
  photoThumb: { width: '31%', aspectRatio: 1, backgroundColor: Colors.light.backgroundTertiary, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },

  // Notes
  notesCard:  { backgroundColor: '#FFFFFF', borderRadius: 12, padding: 16, margin: 4, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 3, elevation: 2 },
  notesInput: { backgroundColor: '#FFFFFF', borderRadius: 12, padding: 14, minHeight: 120, fontSize: 14, color: Colors.light.text, lineHeight: 21, borderWidth: 1.5, borderColor: Colors.light.border, marginBottom: 4 },
  notesCount: { fontSize: 11, color: Colors.light.textSecondary, textAlign: 'right', marginBottom: 12 },

  // Tab action buttons
  tabActionBtn:        { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: Colors.light.accent, borderRadius: 12, height: 48, marginTop: 8 },
  tabActionBtnOutline: { backgroundColor: '#FFFFFF', borderWidth: 1.5, borderColor: Colors.light.primary },
  tabActionTxt:        { fontSize: 14, fontWeight: '700', color: '#FFFFFF' },

  // Bottom Fixed Bar
  bottomBar: { position: 'absolute', bottom: 0, left: 0, right: 0, backgroundColor: '#FFFFFF', padding: 16, paddingTop: 16, paddingBottom: 32, shadowColor: '#000', shadowOffset: { width: 0, height: -4 }, shadowOpacity: 0.06, shadowRadius: 8, elevation: 10 },
  reportBtn: { backgroundColor: Colors.light.accent, borderRadius: 12, height: 52, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, width: '100%' },
  reportBtnNavy: { backgroundColor: Colors.light.primary },
  reportBtnTxt: { fontSize: 16, fontWeight: '600', color: '#FFFFFF' },

  notFound:  { fontSize: 16, color: Colors.light.textSecondary, marginTop: 12 },
  backBtn:   { backgroundColor: Colors.light.primary, paddingHorizontal: 28, paddingVertical: 12, borderRadius: 10, marginTop: 8 },
  backBtnTxt:{ color: '#FFFFFF', fontWeight: '700' },
});
