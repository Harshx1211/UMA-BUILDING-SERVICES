import { useState, useEffect, useCallback } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  Alert, RefreshControl, ActivityIndicator,
  Modal, TextInput, KeyboardAvoidingView, Platform,
  TouchableWithoutFeedback,
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '@/hooks/useAuth';
import {
  getJobById, getAssetsWithJobResults, getDefectsForJob,
  getSignatureForJob, updateRecord, upsertRecord, addToSyncQueue,
  getActiveTimeLog, getJobAssetRecord,
} from '@/lib/database';
import { runSync } from '@/lib/sync';
import { C } from '@/constants/Config';
import { JobStatus, DefectSeverity, SyncOperation } from '@/constants/Enums';
import type { Job, JobAsset, Defect, Signature } from '@/types';

type JobWithJoins = Job & {
  property_name?: string; address?: string; suburb?: string; state?: string; postcode?: string;
  site_contact_name?: string; site_contact_phone?: string;
  access_notes?: string; hazard_notes?: string;
  client_name?: string; building_class?: string;
};

type AssetWithResult = JobAsset & {
  asset_type?: string; asset_ref?: string; location_on_site?: string; variant?: string;
};

const SEVERITY_COLOR: Record<string, string> = {
  minor: C.warning, major: C.accent, critical: C.danger,
};

export default function JobDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const insets = useSafeAreaInsets();

  const [job, setJob]           = useState<JobWithJoins | null>(null);
  const [assets, setAssets]     = useState<AssetWithResult[]>([]);
  const [defects, setDefects]   = useState<Defect[]>([]);
  const [signature, setSign]    = useState<Signature | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [tab, setTab]           = useState<'assets' | 'defects' | 'info'>('assets');
  const [starting, setStarting] = useState(false);

  // ── Inspection modal state ────────────────────────────────
  const [modalAsset, setModalAsset]       = useState<AssetWithResult | null>(null);
  const [inspectResult, setInspectResult] = useState<'pass' | 'fail' | 'not_tested' | null>(null);
  const [inspectNotes, setInspectNotes]   = useState('');
  const [defectSeverity, setDefectSeverity] = useState<'minor' | 'major' | 'critical'>('major');
  const [defectDesc, setDefectDesc]       = useState('');
  const [defectCode, setDefectCode]       = useState('');
  const [defectPrice, setDefectPrice]     = useState('');
  const [isSaving, setIsSaving]           = useState(false);
  const { user } = useAuth();

  function _load() {
    if (!id) return;
    const j = getJobById<JobWithJoins>(id);
    setJob(j);
    if (j) {
      setAssets(getAssetsWithJobResults<AssetWithResult>(id, j.property_id));
      setDefects(getDefectsForJob<Defect>(id));
      setSign(getSignatureForJob<Signature>(id));
    }
  }

  useEffect(() => { _load(); }, [id]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await runSync();
    _load();
    setRefreshing(false);
  }, [id]);

  function _openAsset(asset: AssetWithResult) {
    if (job?.status !== JobStatus.InProgress) {
      Alert.alert('Job Not Started', 'Start the job first before inspecting assets.');
      return;
    }
    // Pre-fill with existing result if already inspected
    const existing = getJobAssetRecord(job!.id, asset.id);
    setModalAsset(asset);
    setInspectResult((existing?.result as any) ?? null);
    setInspectNotes(existing?.technician_notes ?? '');
    setDefectDesc('');
    setDefectCode('');
    setDefectPrice('');
    setDefectSeverity('major');
  }

  function _closeModal() {
    setModalAsset(null);
    setInspectResult(null);
    setInspectNotes('');
  }

  async function _saveInspection() {
    if (!modalAsset || !inspectResult || !job) return;
    if (inspectResult === 'fail' && !defectDesc.trim()) {
      Alert.alert('Defect Required', 'Please describe the defect before saving a fail result.');
      return;
    }
    setIsSaving(true);
    try {
      const now    = new Date().toISOString();
      const existing = getJobAssetRecord(job.id, modalAsset.id);
      const jaId   = existing?.id ?? _uuid();

      upsertRecord('job_assets', {
        id: jaId, job_id: job.id, asset_id: modalAsset.id,
        result: inspectResult,
        is_compliant: inspectResult === 'pass' ? 1 : 0,
        technician_notes: inspectNotes,
        actioned_at: now,
      });
      addToSyncQueue('job_assets', jaId, existing ? SyncOperation.Update : SyncOperation.Insert, {
        id: jaId, job_id: job.id, asset_id: modalAsset.id,
        result: inspectResult, is_compliant: inspectResult === 'pass',
        technician_notes: inspectNotes, actioned_at: now,
      });

      // Create defect record if failed
      if (inspectResult === 'fail' && defectDesc.trim()) {
        const defId = _uuid();
        const price = defectPrice ? parseFloat(defectPrice) : null;
        upsertRecord('defects', {
          id: defId, job_id: job.id, asset_id: modalAsset.id,
          property_id: job.property_id,
          description: defectDesc.trim(), severity: defectSeverity,
          status: 'open',
          defect_code: defectCode.trim() || null,
          quote_price: price,
          photos: '{}', created_at: now, updated_at: now,
        });
        addToSyncQueue('defects', defId, SyncOperation.Insert, {
          id: defId, job_id: job.id, asset_id: modalAsset.id,
          property_id: job.property_id,
          description: defectDesc.trim(), severity: defectSeverity,
          status: 'open',
          defect_code: defectCode.trim() || undefined,
          quote_price: price,
          photos: [],
        });
      }

      _load();
      _closeModal();
      void runSync();
    } finally {
      setIsSaving(false);
    }
  }

  async function _startJob() {
    if (!job) return;
    setStarting(true);
    const now = new Date().toISOString();
    updateRecord('jobs', job.id, { status: JobStatus.InProgress, updated_at: now });
    addToSyncQueue('jobs', job.id, SyncOperation.Update, {
      id: job.id, status: JobStatus.InProgress, updated_at: now,
    });
    _load();
    setStarting(false);
    void runSync();
  }

  function _completeJob() {
    if (!job) return;
    if (!signature) {
      Alert.alert('Signature Required', 'The client must sign off before the job can be completed.', [
        { text: 'Get Signature', onPress: () => router.push(`/(app)/jobs/${job.id}/signature`) },
        { text: 'Cancel', style: 'cancel' },
      ]);
      return;
    }
    Alert.alert('Complete Job', 'Mark this job as completed?', [
      {
        text: 'Complete & Generate Report',
        onPress: async () => {
          const now = new Date().toISOString();
          updateRecord('jobs', job.id, { status: JobStatus.Completed, updated_at: now });
          addToSyncQueue('jobs', job.id, SyncOperation.Update, {
            id: job.id, status: JobStatus.Completed, updated_at: now,
          });
          _load();
          void runSync();
          router.push(`/(app)/jobs/${job.id}/preview`);
        },
      },
      { text: 'Cancel', style: 'cancel' },
    ]);
  }

  if (!job) {
    return (
      <View style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}>
        <ActivityIndicator color={C.accent} size="large" />
      </View>
    );
  }

  const passCount = assets.filter(a => a.result === 'pass').length;
  const failCount = assets.filter(a => a.result === 'fail').length;
  const doneCount = assets.filter(a => a.result !== null).length;
  const totalAssets = assets.length;
  const progress = totalAssets > 0 ? doneCount / totalAssets : 0;

  const openDefects  = defects.filter(d => d.status === 'open').length;
  const criticalCount = defects.filter(d => d.severity === DefectSeverity.Critical).length;

  return (
    <>
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Text style={styles.backText}>← Back</Text>
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <Text style={styles.headerTitle} numberOfLines={1}>
            {job.property_name ?? 'Unknown Property'}
          </Text>
          <View style={[styles.statusChip, { backgroundColor: _statusBg(job.status) }]}>
            <Text style={[styles.statusText, { color: _statusColor(job.status) }]}>
              {_statusLabel(job.status)}
            </Text>
          </View>
        </View>
      </View>

      {/* Progress bar (only when in progress or completed) */}
      {(job.status === JobStatus.InProgress || job.status === JobStatus.Completed) && totalAssets > 0 && (
        <View style={styles.progressWrap}>
          <View style={styles.progressBg}>
            <View style={[styles.progressFill, { width: `${progress * 100}%` as any }]} />
          </View>
          <Text style={styles.progressText}>
            {doneCount}/{totalAssets} inspected  •  ✅ {passCount}  ❌ {failCount}
          </Text>
        </View>
      )}

      {/* Tabs */}
      <View style={styles.tabRow}>
        {(['assets', 'defects', 'info'] as const).map(t => (
          <TouchableOpacity
            key={t}
            style={[styles.tab, tab === t && styles.tabActive]}
            onPress={() => setTab(t)}
          >
            <Text style={[styles.tabText, tab === t && styles.tabTextActive]}>
              {t === 'assets' ? `Assets (${totalAssets})` : t === 'defects' ? `Defects (${defects.length})` : 'Site Info'}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={C.accent} />}
        contentContainerStyle={styles.scroll}
      >
        {/* ── ASSETS TAB ───────────────────────────────────── */}
        {tab === 'assets' && (
          <>
            {assets.length === 0 ? (
              <View style={styles.emptyState}>
                <Text style={styles.emptyIcon}>🏢</Text>
                <Text style={styles.emptyTitle}>No assets linked</Text>
                <Text style={styles.emptyText}>Assets are linked to this property by the admin team.</Text>
              </View>
            ) : (
              assets.map(asset => (
                <TouchableOpacity
                  key={asset.id}
                  style={styles.assetCard}
                  onPress={() => _openAsset(asset)}
                  activeOpacity={job?.status === JobStatus.InProgress ? 0.7 : 1}
                >
                  <View style={styles.assetLeft}>
                    <View style={[
                      styles.resultDot,
                      { backgroundColor: asset.result === 'pass' ? C.success : asset.result === 'fail' ? C.danger : C.textMuted }
                    ]} />
                  </View>
                  <View style={styles.assetBody}>
                    <Text style={styles.assetType}>{asset.asset_type ?? 'Asset'}</Text>
                    {asset.variant ? <Text style={styles.assetVariant}>{asset.variant}</Text> : null}
                    {asset.location_on_site ? <Text style={styles.assetLocation}>📍 {asset.location_on_site}</Text> : null}
                    {asset.asset_ref ? <Text style={styles.assetRef}>Ref: {asset.asset_ref}</Text> : null}
                  </View>
                  <View style={styles.assetRight}>
                    <Text style={[
                      styles.resultLabel,
                      { color: asset.result === 'pass' ? C.success : asset.result === 'fail' ? C.danger : C.textMuted }
                    ]}>
                      {asset.result === 'pass' ? 'PASS' : asset.result === 'fail' ? 'FAIL' : 'PENDING'}
                    </Text>
                    {job?.status === JobStatus.InProgress && (
                      <Text style={styles.assetChevron}>›</Text>
                    )}
                  </View>
                </TouchableOpacity>
              ))
            )}
          </>
        )}

        {/* ── DEFECTS TAB ──────────────────────────────────── */}
        {tab === 'defects' && (
          <>
            {criticalCount > 0 && (
              <View style={styles.criticalBanner}>
                <Text style={styles.criticalText}>⚠️  {criticalCount} CRITICAL defect{criticalCount > 1 ? 's' : ''} — immediate action required</Text>
              </View>
            )}
            {defects.length === 0 ? (
              <View style={styles.emptyState}>
                <Text style={styles.emptyIcon}>✅</Text>
                <Text style={styles.emptyTitle}>No defects recorded</Text>
                <Text style={styles.emptyText}>All items are compliant for this job.</Text>
              </View>
            ) : (
              defects.map(d => (
                <View key={d.id} style={[styles.defectCard, { borderLeftColor: SEVERITY_COLOR[d.severity] }]}>
                  <View style={styles.defectTop}>
                    <Text style={[styles.defectSeverity, { color: SEVERITY_COLOR[d.severity] }]}>
                      {d.severity.toUpperCase()}
                    </Text>
                    <View style={[styles.defectStatusChip, { backgroundColor: _defectStatusBg(d.status) }]}>
                      <Text style={[styles.defectStatusText, { color: _defectStatusColor(d.status) }]}>
                        {d.status.toUpperCase()}
                      </Text>
                    </View>
                  </View>
                  <Text style={styles.defectDesc}>{d.description}</Text>
                  {d.defect_code ? <Text style={styles.defectCode}>Code: {d.defect_code}</Text> : null}
                  {d.quote_price != null ? (
                    <Text style={styles.defectPrice}>Est. ${d.quote_price.toFixed(2)}</Text>
                  ) : null}
                </View>
              ))
            )}
          </>
        )}

        {/* ── SITE INFO TAB ─────────────────────────────────── */}
        {tab === 'info' && (
          <View style={styles.infoSection}>
            <InfoBlock label="Property" value={job.property_name} />
            <InfoBlock label="Address" value={[job.address, job.suburb, job.state, job.postcode].filter(Boolean).join(', ')} />
            <InfoBlock label="Client" value={job.client_name} />
            <InfoBlock label="Building Class" value={job.building_class} />
            <InfoBlock label="Site Contact" value={job.site_contact_name} />
            <InfoBlock label="Contact Phone" value={job.site_contact_phone} />
            <InfoBlock label="Job Type" value={job.job_type?.replace(/_/g, ' ')} />
            <InfoBlock label="Priority" value={job.priority?.toUpperCase()} />
            <InfoBlock label="Scheduled" value={`${job.scheduled_date}${job.scheduled_time ? ' at ' + job.scheduled_time : ''}`} />
            {job.access_notes ? (
              <View style={styles.noteCard}>
                <Text style={styles.noteLabel}>Access Notes</Text>
                <Text style={styles.noteText}>{job.access_notes}</Text>
              </View>
            ) : null}
            {job.hazard_notes ? (
              <View style={[styles.noteCard, styles.hazardCard]}>
                <Text style={[styles.noteLabel, { color: C.warning }]}>⚠️  Hazard Notes</Text>
                <Text style={styles.noteText}>{job.hazard_notes}</Text>
              </View>
            ) : null}
          </View>
        )}
      </ScrollView>

      {/* Bottom action bar */}
      <View style={[styles.actionBar, { paddingBottom: insets.bottom + 8 }]}>
        {job.status === JobStatus.Scheduled && (
          <TouchableOpacity
            style={[styles.actionBtn, styles.actionBtnPrimary]}
            onPress={_startJob}
            disabled={starting}
          >
            {starting
              ? <ActivityIndicator color="#fff" />
              : <Text style={styles.actionBtnText}>Start Job</Text>
            }
          </TouchableOpacity>
        )}
        {job.status === JobStatus.InProgress && (
          <>
            <TouchableOpacity
              style={[styles.actionBtn, styles.actionBtnSecondary]}
              onPress={() => router.push(`/(app)/jobs/${job.id}/signature`)}
            >
              <Text style={[styles.actionBtnText, { color: C.textLight }]}>
                {signature ? '✅ Signed' : 'Get Signature'}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.actionBtn, styles.actionBtnSuccess]}
              onPress={_completeJob}
            >
              <Text style={styles.actionBtnText}>Complete Job</Text>
            </TouchableOpacity>
          </>
        )}
        {job.status === JobStatus.Completed && (
          <TouchableOpacity
            style={[styles.actionBtn, styles.actionBtnPrimary]}
            onPress={() => router.push(`/(app)/jobs/${job.id}/preview`)}
          >
            <Text style={styles.actionBtnText}>View Report PDF</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>

    {/* ── Asset Inspection Modal ─────────────────────────── */}
    <AssetInspectionModal
      asset={modalAsset}
      visible={!!modalAsset}
      result={inspectResult}        onResult={setInspectResult}
      notes={inspectNotes}          onNotes={setInspectNotes}
      defectSeverity={defectSeverity} onSeverity={setDefectSeverity}
      defectDesc={defectDesc}       onDefectDesc={setDefectDesc}
      defectCode={defectCode}       onDefectCode={setDefectCode}
      defectPrice={defectPrice}     onDefectPrice={setDefectPrice}
      isSaving={isSaving}
      onClose={_closeModal}
      onSave={_saveInspection}
    />
  </>
  );
}

function InfoBlock({ label, value }: { label: string; value?: string | null }) {
  if (!value) return null;
  return (
    <View style={styles.infoRow}>
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={styles.infoValue}>{value}</Text>
    </View>
  );
}

function _statusLabel(s: string) {
  return { scheduled: 'Scheduled', in_progress: 'In Progress', completed: 'Completed', cancelled: 'Cancelled' }[s] ?? s;
}
function _statusBg(s: string) {
  return { scheduled: 'rgba(37,99,235,0.15)', in_progress: 'rgba(232,101,10,0.15)', completed: 'rgba(22,163,74,0.15)', cancelled: 'rgba(100,116,139,0.1)' }[s] ?? 'transparent';
}
function _statusColor(s: string) {
  return { scheduled: C.info, in_progress: C.accent, completed: C.success, cancelled: C.textMuted }[s] ?? C.textMuted;
}
function _defectStatusBg(s: string) {
  return { open: 'rgba(220,38,38,0.1)', quoted: 'rgba(217,119,6,0.1)', repaired: 'rgba(22,163,74,0.1)', monitoring: 'rgba(37,99,235,0.1)' }[s] ?? 'transparent';
}
function _defectStatusColor(s: string) {
  return { open: C.danger, quoted: C.warning, repaired: C.success, monitoring: C.info }[s] ?? C.textMuted;
}

const styles = StyleSheet.create({
  container:       { flex: 1, backgroundColor: C.primary },
  header:          {
    flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12,
    backgroundColor: C.surface, borderBottomWidth: 1, borderBottomColor: C.border, gap: 12,
  },
  backBtn:         { paddingVertical: 4, paddingRight: 4 },
  backText:        { color: C.accent, fontSize: 14, fontWeight: '600' },
  headerCenter:    { flex: 1 },
  headerTitle:     { color: C.textLight, fontSize: 16, fontWeight: '700' },
  statusChip:      { alignSelf: 'flex-start', borderRadius: 6, paddingHorizontal: 8, paddingVertical: 2, marginTop: 2 },
  statusText:      { fontSize: 10, fontWeight: '700' },
  progressWrap:    { backgroundColor: C.surface, paddingHorizontal: 16, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: C.border },
  progressBg:     { backgroundColor: C.border, borderRadius: 4, height: 6, overflow: 'hidden', marginBottom: 6 },
  progressFill:    { backgroundColor: C.accent, height: 6, borderRadius: 4 },
  progressText:    { color: C.textMuted, fontSize: 11 },
  tabRow:          { flexDirection: 'row', backgroundColor: C.surface, borderBottomWidth: 1, borderBottomColor: C.border },
  tab:             { flex: 1, paddingVertical: 12, alignItems: 'center' },
  tabActive:       { borderBottomWidth: 2, borderBottomColor: C.accent },
  tabText:         { color: C.textMuted, fontSize: 12, fontWeight: '600' },
  tabTextActive:   { color: C.accent },
  scroll:          { padding: 16, paddingBottom: 32 },
  emptyState:      { alignItems: 'center', paddingVertical: 48, backgroundColor: C.surface, borderRadius: 16, borderWidth: 1, borderColor: C.border },
  emptyIcon:       { fontSize: 36, marginBottom: 10 },
  emptyTitle:      { color: C.textLight, fontSize: 16, fontWeight: '700', marginBottom: 4 },
  emptyText:       { color: C.textMuted, fontSize: 13, textAlign: 'center', paddingHorizontal: 24 },
  assetCard:       { backgroundColor: C.surface, borderRadius: 14, borderWidth: 1, borderColor: C.border, flexDirection: 'row', alignItems: 'center', padding: 14, marginBottom: 8 },
  assetLeft:       { marginRight: 12 },
  resultDot:       { width: 10, height: 10, borderRadius: 5 },
  assetBody:       { flex: 1 },
  assetType:       { color: C.textLight, fontSize: 14, fontWeight: '600' },
  assetVariant:    { color: C.textMuted, fontSize: 12, marginTop: 2 },
  assetLocation:   { color: C.textMuted, fontSize: 11, marginTop: 2 },
  assetRef:        { color: C.textMuted, fontSize: 11 },
  assetRight:      { marginLeft: 8 },
  resultLabel:     { fontSize: 11, fontWeight: '800', letterSpacing: 0.5 },
  criticalBanner:  { backgroundColor: 'rgba(220,38,38,0.12)', borderRadius: 12, borderWidth: 1, borderColor: C.danger, padding: 12, marginBottom: 12 },
  criticalText:    { color: '#FCA5A5', fontSize: 13, fontWeight: '600' },
  defectCard:      { backgroundColor: C.surface, borderRadius: 14, borderWidth: 1, borderColor: C.border, borderLeftWidth: 3, padding: 14, marginBottom: 8 },
  defectTop:       { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 },
  defectSeverity:  { fontSize: 11, fontWeight: '800', letterSpacing: 0.5 },
  defectStatusChip:{ borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2 },
  defectStatusText:{ fontSize: 10, fontWeight: '700' },
  defectDesc:      { color: C.textLight, fontSize: 14, lineHeight: 20 },
  defectCode:      { color: C.textMuted, fontSize: 11, marginTop: 4 },
  defectPrice:     { color: C.success, fontSize: 12, fontWeight: '600', marginTop: 4 },
  infoSection:     { gap: 0 },
  infoRow:         { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 13, borderBottomWidth: 1, borderBottomColor: C.border },
  infoLabel:       { color: C.textMuted, fontSize: 13 },
  infoValue:       { color: C.textLight, fontSize: 13, fontWeight: '500', maxWidth: '60%', textAlign: 'right' },
  noteCard:        { backgroundColor: C.surface, borderRadius: 12, borderWidth: 1, borderColor: C.border, padding: 14, marginTop: 12 },
  hazardCard:      { borderColor: C.warning, backgroundColor: 'rgba(217,119,6,0.08)' },
  noteLabel:       { color: C.textMuted, fontSize: 11, fontWeight: '700', letterSpacing: 0.5, marginBottom: 6 },
  noteText:        { color: C.textBody, fontSize: 13, lineHeight: 20 },
  actionBar:       { backgroundColor: C.surface, borderTopWidth: 1, borderTopColor: C.border, padding: 12, flexDirection: 'row', gap: 10 },
  actionBtn:       { flex: 1, borderRadius: 12, paddingVertical: 14, alignItems: 'center' },
  actionBtnPrimary:{ backgroundColor: C.accent },
  actionBtnSecondary: { backgroundColor: C.primaryLight, borderWidth: 1, borderColor: C.border },
  actionBtnSuccess:{ backgroundColor: C.success },
  actionBtnText:   { color: '#fff', fontSize: 15, fontWeight: '700' },
  assetChevron:    { color: C.textMuted, fontSize: 20, marginTop: 2 },
  // Modal styles
  overlay:         { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'flex-end' },
  sheet:           { backgroundColor: C.surface, borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingHorizontal: 20, paddingBottom: 32 },
  sheetHandle:     { width: 40, height: 4, backgroundColor: C.border, borderRadius: 2, alignSelf: 'center', marginTop: 12, marginBottom: 16 },
  sheetTitle:      { color: C.textLight, fontSize: 17, fontWeight: '700', marginBottom: 4 },
  sheetSub:        { color: C.textMuted, fontSize: 12, marginBottom: 20 },
  resultRow:       { flexDirection: 'row', gap: 10, marginBottom: 20 },
  resultBtn:       { flex: 1, borderRadius: 12, paddingVertical: 16, alignItems: 'center', borderWidth: 2, borderColor: C.border },
  resultBtnPass:   { backgroundColor: 'rgba(22,163,74,0.12)', borderColor: C.success },
  resultBtnFail:   { backgroundColor: 'rgba(220,38,38,0.12)', borderColor: C.danger },
  resultBtnNT:     { backgroundColor: 'rgba(148,163,184,0.1)', borderColor: C.textMuted },
  resultBtnText:   { fontSize: 13, fontWeight: '800', letterSpacing: 0.5 },
  notesInput:      { backgroundColor: C.primaryLight, borderRadius: 12, borderWidth: 1, borderColor: C.border, color: C.textLight, padding: 12, fontSize: 13, minHeight: 72, textAlignVertical: 'top', marginBottom: 16 },
  sectionLabel:    { color: C.textMuted, fontSize: 11, fontWeight: '700', letterSpacing: 0.5, marginBottom: 10 },
  severityRow:     { flexDirection: 'row', gap: 8, marginBottom: 14 },
  sevBtn:          { flex: 1, borderRadius: 10, paddingVertical: 10, alignItems: 'center', borderWidth: 1.5, borderColor: C.border, backgroundColor: C.primaryLight },
  sevBtnMinor:     { borderColor: C.info },
  sevBtnMajor:     { borderColor: C.warning },
  sevBtnCritical:  { borderColor: C.danger },
  sevBtnText:      { fontSize: 11, fontWeight: '700' },
  defectInput:     { backgroundColor: C.primaryLight, borderRadius: 12, borderWidth: 1, borderColor: C.border, color: C.textLight, padding: 12, fontSize: 13, minHeight: 60, textAlignVertical: 'top', marginBottom: 10 },
  rowInputs:       { flexDirection: 'row', gap: 10, marginBottom: 16 },
  halfInput:       { flex: 1, backgroundColor: C.primaryLight, borderRadius: 12, borderWidth: 1, borderColor: C.border, color: C.textLight, padding: 12, fontSize: 13 },
  saveBtn:         { backgroundColor: C.accent, borderRadius: 14, paddingVertical: 16, alignItems: 'center' },
  saveBtnText:     { color: '#fff', fontSize: 16, fontWeight: '800' },
  defectBanner:    { backgroundColor: 'rgba(220,38,38,0.08)', borderRadius: 12, borderWidth: 1, borderColor: 'rgba(220,38,38,0.3)', padding: 14, marginBottom: 14 },
  defectBannerLabel: { color: C.danger, fontSize: 11, fontWeight: '700', letterSpacing: 0.5, marginBottom: 8 },
});

// ─── UUID helper ─────────────────────────────────────────────
function _uuid(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
    const r = Math.random() * 16 | 0;
    return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16);
  });
}

// ─── Inspection Modal ─────────────────────────────────────────
function AssetInspectionModal({
  asset, visible,
  result, onResult,
  notes, onNotes,
  defectSeverity, onSeverity,
  defectDesc, onDefectDesc,
  defectCode, onDefectCode,
  defectPrice, onDefectPrice,
  isSaving, onClose, onSave,
}: {
  asset: any; visible: boolean;
  result: 'pass' | 'fail' | 'not_tested' | null; onResult: (r: any) => void;
  notes: string; onNotes: (s: string) => void;
  defectSeverity: string; onSeverity: (s: any) => void;
  defectDesc: string; onDefectDesc: (s: string) => void;
  defectCode: string; onDefectCode: (s: string) => void;
  defectPrice: string; onDefectPrice: (s: string) => void;
  isSaving: boolean; onClose: () => void; onSave: () => void;
}) {
  if (!asset) return null;
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <TouchableWithoutFeedback onPress={onClose}>
        <View style={styles.overlay}>
          <TouchableWithoutFeedback>
            <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
              <ScrollView style={styles.sheet} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
                <View style={styles.sheetHandle} />
                <Text style={styles.sheetTitle}>{asset.asset_type ?? 'Asset'}</Text>
                <Text style={styles.sheetSub}>
                  {[asset.variant, asset.asset_ref && `Ref: ${asset.asset_ref}`, asset.location_on_site].filter(Boolean).join('  ·  ')}
                </Text>

                {/* Pass / Fail / Not Tested */}
                <Text style={styles.sectionLabel}>INSPECTION RESULT</Text>
                <View style={styles.resultRow}>
                  <TouchableOpacity
                    style={[styles.resultBtn, styles.resultBtnPass, result === 'pass' && { opacity: 1 }, result !== 'pass' && result !== null && { opacity: 0.4 }]}
                    onPress={() => onResult(result === 'pass' ? null : 'pass')}
                  >
                    <Text style={[styles.resultBtnText, { color: C.success }]}>✓ PASS</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.resultBtn, styles.resultBtnFail, result === 'fail' && { opacity: 1 }, result !== 'fail' && result !== null && { opacity: 0.4 }]}
                    onPress={() => onResult(result === 'fail' ? null : 'fail')}
                  >
                    <Text style={[styles.resultBtnText, { color: C.danger }]}>✗ FAIL</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.resultBtn, styles.resultBtnNT, result === 'not_tested' && { opacity: 1 }, result !== 'not_tested' && result !== null && { opacity: 0.4 }]}
                    onPress={() => onResult(result === 'not_tested' ? null : 'not_tested')}
                  >
                    <Text style={[styles.resultBtnText, { color: C.textMuted }]}>N/T</Text>
                  </TouchableOpacity>
                </View>

                {/* Notes */}
                <Text style={styles.sectionLabel}>TECHNICIAN NOTES (OPTIONAL)</Text>
                <TextInput
                  style={styles.notesInput}
                  value={notes} onChangeText={onNotes}
                  placeholder="Add notes about this asset..." placeholderTextColor={C.textMuted}
                  multiline returnKeyType="done"
                />

                {/* Defect section — only if FAIL */}
                {result === 'fail' && (
                  <View style={styles.defectBanner}>
                    <Text style={styles.defectBannerLabel}>⚠  DEFECT DETAILS (REQUIRED)</Text>

                    <Text style={[styles.sectionLabel, { marginBottom: 8 }]}>SEVERITY</Text>
                    <View style={styles.severityRow}>
                      {(['minor', 'major', 'critical'] as const).map(s => (
                        <TouchableOpacity
                          key={s}
                          style={[styles.sevBtn, s === 'minor' && styles.sevBtnMinor, s === 'major' && styles.sevBtnMajor, s === 'critical' && styles.sevBtnCritical, defectSeverity === s && { opacity: 1 }, defectSeverity !== s && { opacity: 0.45 }]}
                          onPress={() => onSeverity(s)}
                        >
                          <Text style={[styles.sevBtnText, { color: s === 'minor' ? C.info : s === 'major' ? C.warning : C.danger }]}>
                            {s.toUpperCase()}
                          </Text>
                        </TouchableOpacity>
                      ))}
                    </View>

                    <Text style={[styles.sectionLabel, { marginBottom: 8 }]}>DESCRIPTION *</Text>
                    <TextInput
                      style={styles.defectInput}
                      value={defectDesc} onChangeText={onDefectDesc}
                      placeholder="Describe the defect..." placeholderTextColor={C.textMuted}
                      multiline returnKeyType="done"
                    />

                    <View style={styles.rowInputs}>
                      <TextInput
                        style={styles.halfInput}
                        value={defectCode} onChangeText={onDefectCode}
                        placeholder="Defect code (opt.)" placeholderTextColor={C.textMuted}
                        autoCapitalize="characters"
                      />
                      <TextInput
                        style={styles.halfInput}
                        value={defectPrice} onChangeText={onDefectPrice}
                        placeholder="Est. $ (opt.)" placeholderTextColor={C.textMuted}
                        keyboardType="decimal-pad"
                      />
                    </View>
                  </View>
                )}

                <TouchableOpacity
                  style={[styles.saveBtn, (!result || isSaving) && { opacity: 0.5 }]}
                  onPress={onSave}
                  disabled={!result || isSaving}
                >
                  {isSaving
                    ? <ActivityIndicator color="#fff" />
                    : <Text style={styles.saveBtnText}>Save Inspection</Text>
                  }
                </TouchableOpacity>
                <View style={{ height: 20 }} />
              </ScrollView>
            </KeyboardAvoidingView>
          </TouchableWithoutFeedback>
        </View>
      </TouchableWithoutFeedback>
    </Modal>
  );
}
