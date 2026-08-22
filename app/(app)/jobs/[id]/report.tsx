import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  Platform,
  TouchableOpacity,
  RefreshControl,
} from 'react-native';
import { Text, ActivityIndicator } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { router, useLocalSearchParams, useFocusEffect } from 'expo-router';
import {
  getJobById,
  getAssetsWithJobResults,
  getDefectsForJob,
  getSignatureForJob,
  getRecord,
  getPendingSyncItems,
} from '@/lib/database';
import Toast from 'react-native-toast-message';
import { useColors } from '@/hooks/useColors';
import { T } from '@/constants/Colors';
import { useReducedMotion } from '@/hooks/useReducedMotion';
import { ScreenHeader, Button, SectionHeader, Card } from '@/components/ui';
import Animated, { FadeInDown, FadeIn } from 'react-native-reanimated';
import { formatAssetType, getAssetTypeIcon } from '@/utils/assetHelpers';
import { DefectSeverity } from '@/constants/Enums';
import type { Defect, Signature } from '@/types';
import { useReportGeneration } from '@/hooks/useReportGeneration';

type MCIcon = React.ComponentProps<typeof MaterialCommunityIcons>['name'];

type JobWithProperty = {
  id: string; property_id: string; assigned_to: string;
  job_type: string; status: string; scheduled_date: string;
  scheduled_time: string | null; priority: string; notes: string | null;
  property_name: string | null; property_address: string | null;
  property_suburb: string | null; property_state: string | null;
  site_contact_name: string | null;
  report_url: string | null;
};

type ReportAsset = {
  id: string; asset_type: string; location_on_site: string | null;
  result: string | null; defect_reason: string | null;
  technician_notes: string | null; is_compliant: number | boolean;
};

// C2: Typed joined fields from getAllDefects SQL so we don't need `as any`
type ExtendedDefect = Defect & {
  asset_type?: string;
  defect_code?: string | null;
  quote_price?: number | null;
};

const SEVERITY_CONFIG: Record<string, { color: (C: ReturnType<typeof useColors>) => string; label: string; icon: MCIcon }> = {
  [DefectSeverity.Critical]: { color: (C) => C.error, label: 'Critical',       icon: 'alert-circle' },
  [DefectSeverity.Major]:    { color: (C) => C.warning, label: 'Major',           icon: 'alert' },
  [DefectSeverity.Minor]:    { color: (C) => C.info, label: 'Non-conformance', icon: 'information' },
};

// ─── Stat card ────────────────────────────────────────────────────────────────

type StatCardProps = {
  icon: MCIcon; iconColor: string; iconBg: string;
  value: number | string; label: string; valueColor: string;
  surface: string; border: string;
};

function StatCard({ icon, iconColor, iconBg, value, label, valueColor }: StatCardProps) {
  const C = useColors();
  return (
    <Card variant="default" style={s.statCard} padding={12}>
      <View style={[s.statIconWrap, { backgroundColor: iconBg }]}>
        <MaterialCommunityIcons name={icon} size={20} color={iconColor} />
      </View>
      <Text style={[s.statVal, { color: valueColor }]}>{value}</Text>
      <Text style={[s.statLabel, { color: C.textTertiary }]}>{label}</Text>
    </Card>
  );
}

// ─── Asset row ────────────────────────────────────────────────────────────────

type AssetRowProps = {
  asset: ReportAsset;
  index: number;
  isLast: boolean;
  colors: ReturnType<typeof useColors>;
};

function AssetRow({ asset, index, isLast, colors: C }: AssetRowProps) {
  const isPass   = asset.result === 'pass';
  const isFail   = asset.result === 'fail';

  const pillStyle = isPass
    ? { bg: C.successLight, text: C.successDark, border: C.success, label: 'PASS' }
    : isFail
    ? { bg: C.errorLight, text: C.errorDark, border: C.error, label: 'FAIL' }
    : { bg: C.backgroundTertiary, text: C.textSecondary, border: C.borderStrong, label: 'N/T' };

  return (
    <View style={[
      s.assetRow,
      !isLast && { borderBottomWidth: 1, borderBottomColor: C.border },
      isFail && { backgroundColor: C.errorLight },
    ]}>
      <View style={[s.assetIndexBadge, { backgroundColor: pillStyle.bg }]}>
        <Text style={[s.assetIndexText, { color: pillStyle.text }]}>
          {String(index + 1).padStart(2, '0')}
        </Text>
      </View>
      <View style={s.assetMiddle}>
        <Text style={[s.assetName, { color: C.text }]}>
          <MaterialCommunityIcons name={getAssetTypeIcon(asset.asset_type)} size={14} color={C.textSecondary} /> {formatAssetType(asset.asset_type)}
        </Text>
        {asset.location_on_site ? (
          <Text style={[s.assetLoc, { color: C.textSecondary }]}>
            <MaterialCommunityIcons name="map-marker-outline" size={10} color={C.textSecondary} />{' '}
            {asset.location_on_site}
          </Text>
        ) : null}
        {isFail && asset.defect_reason ? (
          <View style={s.defectReasonRow}>
            <MaterialCommunityIcons name="alert-circle-outline" size={11} color={C.error} />
            <Text style={[s.defectReasonTxt, { color: C.error }]}>{asset.defect_reason}</Text>
          </View>
        ) : null}
      </View>
      <View style={[s.resultPill, { backgroundColor: pillStyle.bg, borderColor: pillStyle.border }]}>
        <Text style={[s.resultPillTxt, { color: pillStyle.text }]}>{pillStyle.label}</Text>
      </View>
    </View>
  );
}

// ─── Defect card ──────────────────────────────────────────────────────────────

// C2: Uses ExtendedDefect type — no `as any` needed for joined fields
function DefectCard({ defect, index, colors: C }: { defect: ExtendedDefect; index: number; colors: ReturnType<typeof useColors> }) {
  const noMotion = useReducedMotion();
  const sev = SEVERITY_CONFIG[defect.severity as DefectSeverity] ?? SEVERITY_CONFIG[DefectSeverity.Minor];
  const isOpen = !defect.status || defect.status === 'open';
  // M7: severity badge bg derived from color token to be dark-mode safe
  const sevBg  = defect.severity === DefectSeverity.Critical ? C.errorLight
               : defect.severity === DefectSeverity.Major    ? C.warningLight
               : C.infoLight;

  return (
    <Animated.View entering={noMotion ? undefined : FadeInDown.delay(index * 60).duration(300)}>
      <Card variant="default" noPadding style={s.defectCard}>
        {/* Severity stripe */}
        <View style={[s.defectStripe, { backgroundColor: sev.color(C) }]} />

        <View style={s.defectContent}>
          {/* Header row */}
          <View style={s.defectHeaderRow}>
            <View style={[s.sevBadge, { backgroundColor: sevBg, borderColor: sev.color(C) + '40' }]}>
              <MaterialCommunityIcons name={sev.icon} size={11} color={sev.color(C)} />
              <Text style={[s.sevBadgeTxt, { color: sev.color(C) }]}>{sev.label.toUpperCase()}</Text>
            </View>
            {/* M2: Status badge uses theme tokens */}
            <View style={[
              s.statusBadge,
              { backgroundColor: isOpen ? C.warningLight : C.successLight,
                borderColor: isOpen ? C.warning + '60' : C.success + '60' },
            ]}>
              <View style={[s.statusDot, { backgroundColor: isOpen ? C.warning : C.success }]} />
              <Text style={[s.statusBadgeTxt, { color: isOpen ? C.warningDark : C.successDark }]}>
                {defect.status?.replace('_', ' ').toUpperCase() ?? 'OPEN'}
              </Text>
            </View>
          </View>

          {/* Description */}
          <Text style={[s.defectDesc, { color: C.text }]}>{defect.description}</Text>

          {/* Meta row — C2: uses typed ExtendedDefect fields, no `as any` */}
          <View style={s.defectMetaRow}>
            {defect.asset_type ? (
              <Text style={[s.defectMeta, { color: C.textSecondary }]}>
                <MaterialCommunityIcons name={getAssetTypeIcon(defect.asset_type)} size={12} color={C.textTertiary} /> {formatAssetType(defect.asset_type)}
              </Text>
            ) : null}
            {defect.defect_code ? (
              <View style={[s.codeChip, { backgroundColor: C.primary + '15', borderColor: C.primary + '30' }]}>
                <Text style={[s.codeChipTxt, { color: C.primary }]}>
                  {defect.defect_code.toUpperCase()}
                </Text>
              </View>
            ) : null}
            {defect.quote_price != null ? (
              <Text style={[s.defectPrice, { color: C.success }]}>
                Ref: ${defect.quote_price}
              </Text>
            ) : null}
          </View>
        </View>
      </Card>
    </Animated.View>
  );
}

// ─── Main Screen ──────────────────────────────────────────────────────────────

export default function ReportSummaryScreen() {
  const C = useColors();
  const noMotion = useReducedMotion();
  const { id: jobId } = useLocalSearchParams<{ id: string }>();

  const [job, setJob]             = useState<JobWithProperty | null>(null);
  const [assets, setAssets]       = useState<ReportAsset[]>([]);
  const [defects, setDefects]     = useState<ExtendedDefect[]>([]);
  const [signature, setSignature] = useState<Signature | null>(null);
  const [hasPendingSync, setHasPendingSync] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadData = useCallback(() => {
    if (!jobId) return;
    try {
      const j = getJobById<JobWithProperty>(jobId);
      if (!j) { setIsLoading(false); return; }
      setJob(j);

      const a = getAssetsWithJobResults<ReportAsset>(jobId, j.property_id);
      setAssets(a);
      setDefects(getDefectsForJob<ExtendedDefect>(jobId));
      setSignature(getSignatureForJob(jobId));

      const pendingSyncs = getPendingSyncItems();
      // Only ACTUAL DATA CHANGES that affect PDF content trigger the banner.
      // Exclusions:
      //   photo_upload   — binary task, not PDF content (PDF encodes from local_uri)
      //   report_generate — this is the PDF job itself (table_name='jobs'), NOT a data
      //                     change. Without this exclusion, the banner showed every time
      //                     a PDF was in-flight because the report_generate item matches
      //                     table_name='jobs' which is in PDF_TABLES.
      const PDF_TABLES = new Set(['job_assets', 'defects', 'signatures', 'jobs']);
      const MAX_RETRIES = 5;
      const hasPending = pendingSyncs.some(item => {
        const op = String(item.operation);
        if (op === 'photo_upload') return false;      // binary upload task, not PDF data
        if (op === 'report_generate') return false;   // PDF generation task itself, not a data change
        if ((item.retry_count ?? 0) >= MAX_RETRIES) return false; // permanently failed — stale
        if (!PDF_TABLES.has(item.table_name)) return false;       // not PDF-relevant table
        return (item.payload ?? '').includes(`"${jobId}"`);
      });
      setHasPendingSync(hasPending);

    } catch (e) {
      console.error('[ReportSummary] load error:', e);
    } finally {
      setIsLoading(false);
      setRefreshing(false);
    }
  }, [jobId]);

  useEffect(() => { loadData(); }, [loadData]);
  useFocusEffect(useCallback(() => { loadData(); }, [loadData]));

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    loadData();
  }, [loadData]);

  // Shared with the job detail screen and /preview — all three poll the same
  // GET /report-status endpoint through this hook, so they always agree on
  // whether a report is generating instead of showing conflicting states.
  // Queues generation and stays on this screen: a toast confirms it, not a
  // forced trip to a "Generating…" screen. "Open PDF"/"Preview Draft Report"
  // below still navigate to /preview since those are explicit "show me the
  // PDF" taps, not generation triggers.
  const {
    status: genStatus,
    elapsedS: genElapsedS,
    pdfUrl: genPdfUrl,
    generate: handleGenerateReport,
  } = useReportGeneration(jobId, { hasExistingReport: !!job?.report_url });

  // The hook persists report_url to SQLite itself; mirror it into this
  // screen's local job state too so the bottom bar flips to "Open PDF"
  // immediately instead of waiting for the next reload.
  useEffect(() => {
    if (genStatus === 'completed' && genPdfUrl) {
      setJob(p => (p && p.report_url !== genPdfUrl) ? { ...p, report_url: genPdfUrl } : p);
    }
  }, [genStatus, genPdfUrl]);

  if (isLoading) {
    return (
      <View style={[s.screen, s.center, { backgroundColor: C.background }]}>
        <ActivityIndicator color={C.primary} size="large" />
      </View>
    );
  }

  if (!job) {
    return (
      <View style={[s.screen, s.center, { backgroundColor: C.background }]}>
        <MaterialCommunityIcons name="file-document-outline" size={48} color={C.textTertiary} style={{ marginBottom: 16 }} />
        <Text style={{ color: C.textSecondary }}>Report data not found</Text>
        <Button title="Go Back" onPress={() => router.back()} style={{ marginTop: 16 }} />
      </View>
    );
  }

  // Derived stats
  const totalAssets = assets.length;
  const passedCount = assets.filter(a => a.result === 'pass').length;
  const failedCount = assets.filter(a => a.result === 'fail').length;
  const ntCount     = assets.filter(a => !a.result || a.result === 'not_tested').length;
  const compliantCount = assets.filter(a => a.is_compliant).length;

  const progressPct = totalAssets > 0 ? (passedCount / totalAssets) * 100 : 0;
  const failPct     = totalAssets > 0 ? (failedCount / totalAssets) * 100 : 0;
  const ntPct       = totalAssets > 0 ? (ntCount / totalAssets) * 100 : 0;

  // FIX: After Phase 2 auto-marking, 'not_tested' IS a valid final state.
  // Previously only pass+fail counted toward completion, meaning a job with
  // any NT assets was never considered "fully inspected" even though the
  // tech had reviewed every asset (some just couldn't be tested).
  // Correct check: every asset has a non-null result.
  const isFullyInspected = assets.length > 0 && assets.every(a => a.result !== null);
  const hasSignature     = !!signature?.signature_url;
  const readyToGenerate  = isFullyInspected && hasSignature;
  const isCompleted      = job.status === 'completed';
  // Derived directly from the hook's live status every render — not from
  // job.report_url alone, which depends on a separate effect having already
  // mirrored it into local state. This way the bottom bar can never show a
  // report as missing when the hook already knows it's done.
  const hasReport        = genStatus === 'completed' || !!job.report_url;

  // F5: Technician Info (for top banner)
  // Retrieve the technician's name from SQLite `users` table instead of hardcoding
  const techRecord = getRecord<{ full_name: string }>('users', job.assigned_to);
  const techName   = techRecord?.full_name ?? 'Site Technician';
  const reportDate = new Date().toLocaleDateString('en-AU', {
    day: 'numeric', month: 'long', year: 'numeric'
  });

  return (
    <View style={[s.screen, { backgroundColor: C.background }]}>
      <ScreenHeader
        eyebrow={`JOB #${job.id.substring(0, 8).toUpperCase()}`}
        title="Report Summary"
        showBack
      />

      <ScrollView
        contentContainerStyle={s.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={C.primary} />}
      >
        {/* ── Top Hero Card: Property Info ── */}
        <Animated.View entering={noMotion ? undefined : FadeInDown.delay(40).duration(340)}>
          <Card variant="default" style={{ marginBottom: 20, position: 'relative', overflow: 'hidden' }} padding={16}>
            <View style={[s.heroDecor, { backgroundColor: C.primary + '10' }]} />
            <View style={s.heroInner}>
              <View style={s.heroTopRow}>
                <View style={[s.heroIconWrap, { backgroundColor: C.primary + '15' }]}>
                  <MaterialCommunityIcons name="office-building-marker" size={20} color={C.primary} />
                </View>
                <View style={[s.heroBadge, { backgroundColor: C.backgroundTertiary }]}>
                  <Text style={[s.heroBadgeTxt, { color: C.textSecondary }]}>
                    {isCompleted ? 'COMPLETED' : readyToGenerate ? 'READY TO GENERATE' : isFullyInspected ? 'AWAITING SIGNATURE' : 'IN PROGRESS'}
                  </Text>
                </View>
              </View>
              <Text style={[s.heroTitle, { color: C.text }]}>{job.property_name || 'Property Report'}</Text>
              <Text style={[s.heroSub, { color: C.textSecondary }]}>
                {[job.property_address, job.property_suburb].filter(Boolean).join(', ')}
              </Text>

              <View style={[s.heroDivider, { backgroundColor: C.border }]} />

              <View style={s.heroMetaRow}>
                <View style={s.heroMetaItem}>
                  <MaterialCommunityIcons name="calendar-check" size={14} color={C.textSecondary} />
                  <Text style={[s.heroMetaTxt, { color: C.text }]}>{reportDate}</Text>
                </View>
                <View style={s.heroMetaItem}>
                  <MaterialCommunityIcons name="account-hard-hat" size={14} color={C.textSecondary} />
                  <Text style={[s.heroMetaTxt, { color: C.text }]}>{techName}</Text>
                </View>
              </View>
            </View>
          </Card>
        </Animated.View>

        {/* ── Pending Data Changes Warning Banner ── */}
        {hasPendingSync && (
          <Animated.View entering={noMotion ? undefined : FadeInDown.delay(60).duration(340)}>
            <View style={[s.warningBanner, { backgroundColor: C.warningLight, borderColor: C.warning + '40' }]}>
              <MaterialCommunityIcons name="cloud-sync-outline" size={24} color={C.warningDark} />
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 13, fontWeight: '700', color: C.warningDark, marginBottom: 2 }}>
                  Inspection Data Not Yet in PDF
                </Text>
                <Text style={{ fontSize: 12, color: C.warningDark, lineHeight: 16 }}>
                  Results or signatures were recorded after the last PDF was generated. Tap Regenerate to update it.
                </Text>
              </View>
            </View>
          </Animated.View>
        )}

        {/* ── Warning if completed job lacks signature (data corruption edge case) ── */}
        {isCompleted && !hasSignature && (
          <Animated.View entering={noMotion ? undefined : FadeIn.delay(200)}>
            <View style={[s.warningBanner, { backgroundColor: C.errorLight, borderColor: C.error }]}>
              <MaterialCommunityIcons name="alert" size={20} color={C.error} />
              <View style={{ flex: 1 }}>
                <Text style={{ color: C.errorDark, fontWeight: '800', fontSize: 13 }}>Missing Signature</Text>
                <Text style={{ color: C.errorDark, fontSize: 12, marginTop: 2 }}>This report was completed without a client signature.</Text>
              </View>
              <Button
                title="Sign" variant="secondary"
                onPress={() => router.push(`/jobs/${job.id}/signature` as never)}
                style={{ height: 36, paddingHorizontal: 12 }}
              />
            </View>
          </Animated.View>
        )}

        {/* ── Stats Grid (2x2) ── */}
        <Animated.View entering={noMotion ? undefined : FadeInDown.delay(80).duration(340)}>
          <View style={s.statsGrid}>
            <StatCard
              icon="shield-check" iconColor={C.success} iconBg={C.successLight}
              value={totalAssets} label="Total" valueColor={C.text}
              surface={C.surface} border={C.border}
            />
            <StatCard
              icon="check-circle" iconColor={C.success} iconBg={C.successLight}
              value={passedCount} label="Passed" valueColor={C.success}
              surface={C.surface} border={C.border}
            />
            <StatCard
              icon="close-circle" iconColor={C.error} iconBg={C.errorLight}
              value={failedCount} label="Failed" valueColor={failedCount > 0 ? C.error : C.text}
              surface={C.surface} border={C.border}
            />
            <StatCard
              icon="minus-circle" iconColor={C.textSecondary} iconBg={C.backgroundTertiary}
              value={ntCount} label="Not Tested" valueColor={C.textSecondary}
              surface={C.surface} border={C.border}
            />
          </View>
        </Animated.View>

        {/* ── Results Bar ── */}
        <Animated.View entering={noMotion ? undefined : FadeInDown.delay(100).duration(340)}>
          <Card variant="default" style={{ marginBottom: 16 }} padding={16}>
            <View style={s.barHeader}>
              <Text style={[s.barTitle, { color: C.textSecondary, flex: 1, marginRight: 8 }]} numberOfLines={1}>COMPLIANCE BREAKDOWN</Text>
              <Text style={[s.barPct, { color: C.text }]}>{Math.round(progressPct)}% Pass</Text>
            </View>
            <View style={[s.barTrack, { backgroundColor: C.backgroundTertiary }]}>
              {/* Stacked bar segments */}
              <Animated.View style={[s.barSegment, { backgroundColor: C.success, width: `${progressPct}%` as `${number}%` }]} />
              <Animated.View style={[s.barSegment, { backgroundColor: C.error, width: `${failPct}%` as `${number}%` }]} />
              <Animated.View style={[s.barSegment, { backgroundColor: C.textSecondary, width: `${ntPct}%` as `${number}%` }]} />
            </View>
            <View style={s.barLegend}>
              <Text style={[s.barLegendTxt, { color: C.textTertiary }]}>
                {compliantCount} compliant · {totalAssets - compliantCount} non-compliant
              </Text>
            </View>
          </Card>
        </Animated.View>

        {/* ── Documentation Checklist (Status) ── */}
        <Animated.View entering={noMotion ? undefined : FadeInDown.delay(120).duration(340)}>
          <SectionHeader title="Documentation" eyebrow />
          <Card variant="default" noPadding style={{ marginBottom: 16, overflow: 'hidden' }}>
            {/* Inspections Row */}
            <View style={[s.checkRow, { borderBottomColor: C.border }]}>
              <View style={[s.checkIconWrap, { backgroundColor: isFullyInspected ? C.success + '18' : C.warning + '18' }]}>
                <MaterialCommunityIcons
                  name={isFullyInspected ? "clipboard-check-outline" : "clipboard-text-clock-outline"}
                  size={18} color={isFullyInspected ? C.success : C.warning}
                />
              </View>
              <View style={s.checkTextCol}>
                <Text style={[s.checkTitle, { color: C.text }]}>Asset Inspections</Text>
                <Text style={[s.checkSub, { color: C.textSecondary }]}>
                  {isFullyInspected ? 'All assets inspected' : `${ntCount} assets remaining`}
                </Text>
              </View>
              <MaterialCommunityIcons name={isFullyInspected ? 'check-circle' : 'circle-outline'} size={20} color={isFullyInspected ? C.success : C.borderStrong} />
            </View>

            {/* Defects Row */}
            <View style={[s.checkRow, { borderBottomColor: C.border }]}>
              <View style={[s.checkIconWrap, { backgroundColor: C.primary + '18' }]}>
                <MaterialCommunityIcons name="tools" size={18} color={C.primary} />
              </View>
              <View style={s.checkTextCol}>
                <Text style={[s.checkTitle, { color: C.text }]}>Defects & Remediation</Text>
                <Text style={[s.checkSub, { color: C.textSecondary }]}>
                  {defects.length === 0 ? 'No defects logged' : `${defects.length} defect(s) logged`}
                </Text>
              </View>
              <MaterialCommunityIcons name="check-circle" size={20} color={C.success} />
            </View>

            {/* Signature Row */}
            <TouchableOpacity
              style={[s.checkRow, { borderBottomWidth: 0 }]}
              onPress={() => !isCompleted && router.push(`/jobs/${job.id}/signature` as never)}
              activeOpacity={0.7}
              disabled={isCompleted}
            >
              <View style={[s.checkIconWrap, { backgroundColor: hasSignature ? C.success + '18' : C.errorLight }]}>
                <MaterialCommunityIcons name="draw" size={18} color={hasSignature ? C.success : C.error} />
              </View>
              <View style={s.checkTextCol}>
                <Text style={[s.checkTitle, { color: C.text }]}>Client Signature</Text>
                <Text style={[s.checkSub, { color: hasSignature ? C.success : C.error }]}>
                  {hasSignature ? 'Captured and attached' : 'Required for submission'}
                </Text>
              </View>
              {hasSignature ? (
                <MaterialCommunityIcons name="check-circle" size={20} color={C.success} />
              ) : (
                <View style={[s.actionBtn, { backgroundColor: C.error }]}>
                  <Text style={s.actionBtnTxt}>Sign</Text>
                </View>
              )}
            </TouchableOpacity>
          </Card>
        </Animated.View>

        {/* ── Asset Breakdown Table ── */}
        <Animated.View entering={noMotion ? undefined : FadeInDown.delay(140).duration(340)}>
          <SectionHeader title="Asset Breakdown" eyebrow />
          <Card variant="default" noPadding style={{ marginBottom: 16, overflow: 'hidden' }}>
            {assets.length === 0 ? (
              <View style={s.emptyTable}>
                <Text style={{ color: C.textTertiary, fontSize: 13 }}>No assets inspected.</Text>
              </View>
            ) : (
              assets.map((a, i) => (
                <AssetRow key={a.id} asset={a} index={i} isLast={i === assets.length - 1} colors={C} />
              ))
            )}
          </Card>
        </Animated.View>

        {/* ── Defect Summary ── */}
        {defects.length > 0 && (
          <Animated.View entering={noMotion ? undefined : FadeInDown.delay(160).duration(340)}>
            <SectionHeader title="Logged Defects" eyebrow />
            <View style={{ gap: 12 }}>
              {defects.map((d, i) => <DefectCard key={d.id} defect={d} index={i} colors={C} />)}
            </View>
          </Animated.View>
        )}

      </ScrollView>

      {/* ── Bottom Action Bar ── */}
      <View style={[s.bottomBar, { backgroundColor: C.surface, borderTopColor: C.border }]}>
        {genStatus === 'generating' ? (
          <Button
            title={`Generating Report… ${genElapsedS}s`}
            icon="cloud-upload-outline"
            variant="secondary"
            onPress={() => router.push(`/jobs/${jobId}/preview` as never)}
          />
        ) : genStatus === 'failed' ? (
          <Button
            title="Retry Generating Report"
            icon="refresh"
            variant="primary"
            onPress={handleGenerateReport}
          />
        ) : isCompleted && hasReport ? (
          // When inspection data changed since last PDF: hide Download, show Regenerate only
          hasPendingSync ? (
            <Button
              title="Regenerate Report"
              icon="refresh"
              variant="primary"
              onPress={handleGenerateReport}
            />
          ) : (
            <View style={s.bottomBtnRow}>
              <Button
                title="Open PDF"
                icon="file-eye-outline"
                variant="primary"
                onPress={() => router.push(`/jobs/${jobId}/preview` as never)}
                style={{ flex: 1 }}
              />
              <Button
                title="Refresh"
                icon="refresh"
                variant="secondary"
                // FIX: Refresh re-checks local sync state without re-generating PDF.
                // Previously this was a duplicate of "Open PDF" — both navigated
                // to /preview, which was confusing and wasted the user's time.
                onPress={onRefresh}
                style={{ flex: 1 }}
              />
            </View>
          )
        ) : (
          <Button
            title={readyToGenerate ? "Generate Report PDF" : "Preview Draft Report"}
            icon={readyToGenerate ? "file-pdf-box" : "file-eye-outline"}
            variant={readyToGenerate ? "primary" : "secondary"}
            onPress={() => {
              if (readyToGenerate) {
                handleGenerateReport();
              } else {
                router.push(`/jobs/${jobId}/preview` as never);
              }
            }}
          />
        )}
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  screen: { flex: 1 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  errorEmoji: { fontSize: 48, marginBottom: 16 },
  scrollContent: { padding: 16, paddingBottom: 100 },

  heroDecor: {
    position: 'absolute', top: -30, right: -20,
    width: 100, height: 100, borderRadius: 50,
  },
  heroInner: { position: 'relative', zIndex: 2 },
  heroTopRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 },
  heroIconWrap: { width: 36, height: 36, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  heroBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 10 },
  heroBadgeTxt: { fontSize: 9, fontWeight: '800', letterSpacing: 0.5, textTransform: 'uppercase' },
  heroTitle: { fontSize: 20, fontWeight: '800', letterSpacing: -0.5, marginBottom: 4 },
  heroSub: { fontSize: 13, fontWeight: '500' },
  heroDivider: { height: 1, marginVertical: 14 },
  heroMetaRow: { flexDirection: 'row', gap: 16 },
  heroMetaItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  heroMetaTxt: { fontSize: 12, fontWeight: '600' },

  warningBanner: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    padding: 14, borderRadius: 16, borderWidth: 1,
    marginBottom: 20,
  },

  // Stats Grid
  statsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 16 },
  statCard: {
    width: '48%', flexGrow: 1,
    alignItems: 'flex-start',
  },
  statIconWrap: { width: 28, height: 28, borderRadius: 8, alignItems: 'center', justifyContent: 'center', marginBottom: 12 },
  statVal: { fontSize: 20, fontWeight: '800', marginBottom: 2, letterSpacing: -0.5 },
  statLabel: { fontSize: 11, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5 },

  // Progress Bar Card
  barHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 14 },
  barTitle: { fontSize: 12, fontWeight: '700', letterSpacing: 0.8, textTransform: 'uppercase' },
  barPct: { fontSize: 14, fontWeight: '800' },
  barTrack: { height: 8, borderRadius: 4, flexDirection: 'row', overflow: 'hidden' },
  barSegment: { height: '100%' },
  barLegend: { flexDirection: 'row', justifyContent: 'center', marginTop: 14, gap: 12 },
  barLegendTxt: { fontSize: 11, fontWeight: '600' },

  // Checklist
  checkRow: { flexDirection: 'row', alignItems: 'center', padding: 14, borderBottomWidth: 1 },
  checkIconWrap: { width: 36, height: 36, borderRadius: 10, alignItems: 'center', justifyContent: 'center', marginRight: 12 },
  checkTextCol: { flex: 1 },
  checkTitle: { fontSize: 14, fontWeight: '700', marginBottom: 2 },
  checkSub: { fontSize: 12, fontWeight: '500' },
  actionBtn: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 10 },
  actionBtnTxt: { fontSize: 11, fontWeight: '800', textTransform: 'uppercase', color: T.textOnPrimary },

  // Table
  emptyTable: { padding: 24, alignItems: 'center' },
  assetRow: { flexDirection: 'row', alignItems: 'center', padding: 12, borderBottomWidth: 1 },
  assetIndexBadge: { width: 24, height: 24, borderRadius: 8, alignItems: 'center', justifyContent: 'center', marginRight: 12 },
  assetIndexText: { fontSize: 11, fontWeight: '800' },
  assetMiddle: { flex: 1, marginRight: 12 },
  assetName: { fontSize: 13, fontWeight: '700', marginBottom: 2 },
  assetLoc: { fontSize: 11, fontStyle: 'italic', fontWeight: '500' },
  defectReasonRow: { flexDirection: 'row', alignItems: 'flex-start', marginTop: 4, gap: 4 },
  defectReasonTxt: { flex: 1, fontSize: 11, fontWeight: '600', lineHeight: 14 },
  resultPill: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8, borderWidth: 1 },
  resultPillTxt: { fontSize: 10, fontWeight: '800', letterSpacing: 0.5 },

  // Defect Card
  defectCard: { flexDirection: 'row' },
  defectStripe: { width: 4 },
  defectContent: { flex: 1, padding: 16 },
  defectHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 10 },
  sevBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 6, paddingVertical: 3, borderRadius: 6, borderWidth: 1 },
  sevBadgeTxt: { fontSize: 9, fontWeight: '800', letterSpacing: 0.5 },
  statusBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 6, paddingVertical: 3, borderRadius: 6, borderWidth: 1 },
  statusDot: { width: 6, height: 6, borderRadius: 3 },
  statusBadgeTxt: { fontSize: 9, fontWeight: '800', letterSpacing: 0.5 },
  defectDesc: { fontSize: 13, fontWeight: '500', lineHeight: 18, marginBottom: 10 },
  defectMetaRow: { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  defectMeta: { fontSize: 11, fontWeight: '600' },
  codeChip: { paddingHorizontal: 6, paddingVertical: 3, borderRadius: 6, borderWidth: 1 },
  codeChipTxt: { fontSize: 9, fontWeight: '800' },
  defectPrice: { fontSize: 11, fontWeight: '700' },

  // Bottom Bar
  bottomBar: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    padding: 20, paddingBottom: Platform.OS === 'ios' ? 44 : 20,
    borderTopWidth: 1,
    shadowOffset: { width: 0, height: -10 }, shadowOpacity: 0.15, shadowRadius: 20, elevation: 20,
  },
  generateBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 10, height: 60, borderRadius: 20, flex: 1
  },
  generateBtnTxt: { fontSize: 16, fontWeight: '900', letterSpacing: 0.5 },
  bottomBtnRow: { flexDirection: 'row', gap: 16 },
});
