// Property detail screen — professional inspection-officer view inspired by Uptick
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Linking, ScrollView, StyleSheet, TouchableOpacity, View,
} from 'react-native';
import { ActivityIndicator, Text } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { router, useLocalSearchParams, useFocusEffect } from 'expo-router';
import { useColors } from '@/hooks/useColors';
import { useReducedMotion } from '@/hooks/useReducedMotion';
import { ComplianceStatus, AssetStatus, JobStatus } from '@/constants/Enums';
import { getRecord, getAssetsForProperty, getJobsForProperty, getDocumentsForProperty, getNotebookItemsForProperty } from '@/lib/database';
import { openJob } from '@/utils/navigation';
import type { Property, Asset, Job, SiteDocument } from '@/types';
import { ScreenHeader, EmptyState, Badge } from '@/components/ui';
import DocumentCard from '@/components/documents/DocumentCard';
import { PropertyNotebookSheet, PropertyNotebookSheetRef } from '@/components/notebook/PropertyNotebookSheet';
import { localDateString } from '@/utils/dateHelpers';
import { onSyncComplete, offSyncComplete } from '@/lib/sync';

type ColorsType = ReturnType<typeof useColors>;
type MCIconName = React.ComponentProps<typeof MaterialCommunityIcons>['name'];

// ─── Compliance config ──────────────────────────────────────
const getComplianceConfig = (C: ColorsType): Record<ComplianceStatus, {
  bg: string; border: string; text: string; subtext: string; icon: MCIconName; label: string; badge: string;
}> => ({
  [ComplianceStatus.Compliant]:    { bg: C.successLight, border: C.success, text: C.successDark, subtext: C.success, icon: 'check-decagram', label: 'Compliant', badge: C.success },
  [ComplianceStatus.NonCompliant]: { bg: C.errorLight,   border: C.error,   text: C.errorDark,   subtext: C.error,   icon: 'close-circle',  label: 'Non-Compliant', badge: C.errorDark },
  [ComplianceStatus.Overdue]:      { bg: C.warningLight, border: C.warning, text: C.warningDark, subtext: C.warning, icon: 'alert-decagram', label: 'Overdue', badge: C.warningDark },
  [ComplianceStatus.Pending]:      { bg: C.backgroundTertiary, border: C.border, text: C.textSecondary, subtext: C.textTertiary, icon: 'clock-outline', label: 'Pending Review', badge: C.textSecondary },
});


type JobHistory = Job & {
  technician_name: string | null;
  property_name?: string;
};

// Jobs shown by default before the technician has to explicitly ask for
// more — see loadMoreJobHistory's own comment.
const JOB_HISTORY_PAGE_SIZE = 5;

// ─── Quick-stat pill ─────────────────────────────────────────
function StatPill({ icon, value, label, color, bg }: {
  icon: React.ComponentProps<typeof MaterialCommunityIcons>['name'];
  value: string | number; label: string; color: string; bg: string;
}) {
  return (
    <View style={[statPill.wrap, { backgroundColor: bg }]}>
      <MaterialCommunityIcons name={icon} size={20} color={color} />
      <Text style={[statPill.value, { color }]}>{value}</Text>
      <Text style={[statPill.label, { color }]}>{label}</Text>
    </View>
  );
}
const statPill = StyleSheet.create({
  wrap:  { flex: 1, alignItems: 'center', paddingVertical: 14, borderRadius: 16, gap: 4 },
  value: { fontSize: 20, fontWeight: '800' },
  label: { fontSize: 10, fontWeight: '600', letterSpacing: 0.3, opacity: 0.75 },
});

// ─── Section header ──────────────────────────────────────────
function SectionHeader({ icon, title, count, actionLabel, onAction }: {
  icon: React.ComponentProps<typeof MaterialCommunityIcons>['name'];
  title: string; count?: number;
  actionLabel?: string; onAction?: () => void;
}) {
  const C = useColors();
  return (
    <View style={[sh.row, { marginHorizontal: 16, marginBottom: 12, marginTop: 24 }]}>
      <View style={sh.left}>
        <View style={[sh.iconWrap, { backgroundColor: C.primary + '15' }]}>
          <MaterialCommunityIcons name={icon} size={16} color={C.primary} />
        </View>
        <Text style={[sh.title, { color: C.text }]}>{title}</Text>
        {count !== undefined && (
          <View style={[sh.badge, { backgroundColor: C.backgroundTertiary }]}>
            <Text style={[sh.badgeTxt, { color: C.textSecondary }]}>{count}</Text>
          </View>
        )}
      </View>
      {actionLabel && onAction && (
        <TouchableOpacity onPress={onAction}>
          <Text style={[sh.action, { color: C.accent }]}>{actionLabel} →</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}
const sh = StyleSheet.create({
  row:      { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  left:     { flexDirection: 'row', alignItems: 'center', gap: 8 },
  iconWrap: { width: 30, height: 30, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  title:    { fontSize: 15, fontWeight: '700', letterSpacing: -0.1 },
  badge:    { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 8 },
  badgeTxt: { fontSize: 11, fontWeight: '700' },
  action:   { fontSize: 13, fontWeight: '600' },
});

// ─── Info row inside card ─────────────────────────────────────
function InfoRow({ icon, label, value, onPress, valueColor }: {
  icon: React.ComponentProps<typeof MaterialCommunityIcons>['name'];
  label: string; value: string;
  onPress?: () => void; valueColor?: string;
}) {
  const C = useColors();
  const Comp = onPress ? TouchableOpacity : View;
  return (
    <Comp style={infoRow.wrap} onPress={onPress} activeOpacity={0.7}>
      <View style={[infoRow.iconBox, { backgroundColor: C.backgroundTertiary }]}>
        <MaterialCommunityIcons name={icon} size={14} color={C.textSecondary} />
      </View>
      <View style={infoRow.right}>
        <Text style={[infoRow.label, { color: C.textTertiary }]}>{label}</Text>
        <Text style={[infoRow.value, { color: valueColor || C.text }, onPress && { textDecorationLine: 'underline' }]}>
          {value}
        </Text>
      </View>
      {onPress && <MaterialCommunityIcons name="chevron-right" size={16} color={C.textTertiary} />}
    </Comp>
  );
}
const infoRow = StyleSheet.create({
  wrap:    { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10 },
  iconBox: { width: 32, height: 32, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  right:   { flex: 1 },
  label:   { fontSize: 10, fontWeight: '600', letterSpacing: 0.3, textTransform: 'uppercase', marginBottom: 1 },
  value:   { fontSize: 14, fontWeight: '500' },
});

// ═══════════════════════════════════════════════════════════════
// MAIN SCREEN
// ═══════════════════════════════════════════════════════════════
export default function PropertyDetailScreen() {
  const C = useColors();
  const noMotion = useReducedMotion();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [property, setProperty] = useState<Property | null>(null);
  const [assets, setAssets]     = useState<Asset[]>([]);
  const [jobHistory, setJobHistory] = useState<JobHistory[]>([]);
  const [jobHistoryTotal, setJobHistoryTotal] = useState(0);
  const [jobHistoryCompleted, setJobHistoryCompleted] = useState(0);
  const [jobHistoryLoadingMore, setJobHistoryLoadingMore] = useState(false);
  const [documents, setDocuments]   = useState<SiteDocument[]>([]);
  const [notebookCount, setNotebookCount] = useState(0);
  const [isLoading, setIsLoading]   = useState(true);
  const notebookSheetRef = useRef<PropertyNotebookSheetRef>(null);

  // Tracks how many job-history rows are currently on screen, kept in sync
  // SYNCHRONOUSLY at every point jobHistory itself is set (load,
  // refreshKeepingHistorySize, loadMoreJobHistory below) — not via a
  // separate effect watching jobHistory.length, which would still leave a
  // window (React defers a passive effect to run after commit) where a
  // sync event landing in between could read a stale length and collapse
  // an expanded list. See refreshKeepingHistorySize's own comment for why
  // this ref exists at all.
  const jobHistoryLengthRef = useRef(0);

  const load = useCallback(() => {
    if (!id) return;
    setIsLoading(true);
    try {
      const p = getRecord<Property>('properties', id);
      setProperty(p);
      if (p) {
        setAssets(getAssetsForProperty<Asset>(id));
        // FIX: this used to fetch the property's ENTIRE job history
        // unbounded (SQLite LIMIT -1) on every screen open — a property
        // visited monthly for years builds up a genuinely large list, but
        // only the first 5 were ever shown; the rest was fetched purely to
        // .length it for the count badge/footer and .filter().length it for
        // the JOBS DONE stat. Same fix as getAssetHistory's own pagination:
        // load a small page up front, get the stats from lightweight COUNT
        // queries, and only fetch more if explicitly asked for.
        const { jobs, totalCount, completedCount } = getJobsForProperty<JobHistory>(id, { limit: JOB_HISTORY_PAGE_SIZE });
        setJobHistory(jobs);
        jobHistoryLengthRef.current = jobs.length;
        setJobHistoryTotal(totalCount);
        setJobHistoryCompleted(completedCount);
        setDocuments(getDocumentsForProperty<SiteDocument>(id));
        setNotebookCount(getNotebookItemsForProperty(id).length);
      }
    } catch (err) {
      console.error('[PropertyDetail] load error:', err);
    } finally {
      setIsLoading(false);
    }
  }, [id]);

  // Used by the live/fallback sync refresher below — a plain load() would
  // reset an already-expanded job history (via the "+5"/"+10"/"Show all"
  // chips) back down to JOB_HISTORY_PAGE_SIZE every time anything synced,
  // discarding progress the technician already asked for. Re-fetches
  // however many are currently showing (jobHistoryLengthRef, kept
  // synchronously current — see its own comment) instead of the default
  // page size. Has a stable identity (only depends on `id`), so
  // onSyncComplete below never needs to resubscribe when the history size
  // changes.
  const refreshKeepingHistorySize = useCallback(() => {
    if (!id) return;
    const p = getRecord<Property>('properties', id);
    setProperty(p);
    if (!p) return;
    setAssets(getAssetsForProperty<Asset>(id));
    const keep = Math.max(JOB_HISTORY_PAGE_SIZE, jobHistoryLengthRef.current);
    const { jobs, totalCount, completedCount } = getJobsForProperty<JobHistory>(id, { limit: keep });
    setJobHistory(jobs);
    jobHistoryLengthRef.current = jobs.length;
    setJobHistoryTotal(totalCount);
    setJobHistoryCompleted(completedCount);
    setDocuments(getDocumentsForProperty<SiteDocument>(id));
    setNotebookCount(getNotebookItemsForProperty(id).length);
  }, [id]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  // FIX: the focus-effect above only refreshes on returning to this screen
  // — a job/asset/document changing on this property while the screen was
  // already open (and staying open) never showed up. Now also reloads on
  // the same signal the "my data" live channel and the 10-minute fallback
  // sync both fire (see subscribeToMyDataLive in lib/sync.ts).
  useEffect(() => {
    onSyncComplete(refreshKeepingHistorySize);
    return () => offSyncComplete(refreshKeepingHistorySize);
  }, [refreshKeepingHistorySize]);

  // `count` is however many MORE jobs the technician asked for (see the
  // "+5"/"+10"/"Show all" chips below) — always starts reading right after
  // whatever's already loaded, never refetches jobs already on screen.
  const loadMoreJobHistory = useCallback((count: number) => {
    if (!id || jobHistoryLoadingMore) return;
    setJobHistoryLoadingMore(true);
    try {
      const { jobs } = getJobsForProperty<JobHistory>(id, { limit: count, offset: jobHistory.length });
      // FIX: this was the one call site refreshKeepingHistorySize's ref fix
      // missed — jobHistoryLengthRef was only updated inside load() and
      // refreshKeepingHistorySize itself, not here, so tapping "+5"/"+10"
      // grew the visible list without the ref ever reflecting it. The very
      // next sync event (the 10-minute interval, or the my-data-live
      // channel's own reconnect catch-up) then re-derived `keep` from the
      // stale, pre-expansion ref value and silently truncated the list
      // right back down — the exact regression this ref exists to prevent.
      // Using the functional updater's own callback to set the ref keeps it
      // synchronous with the real, current array, not a value captured in
      // this closure.
      setJobHistory((prev) => {
        const next = [...prev, ...jobs];
        jobHistoryLengthRef.current = next.length;
        return next;
      });
    } finally {
      setJobHistoryLoadingMore(false);
    }
  }, [id, jobHistory.length, jobHistoryLoadingMore]);

  if (isLoading) {
    return (
      <View style={[s.screen, s.centered, { backgroundColor: C.background }]}>
        <ActivityIndicator color={C.primary} size="large" />
      </View>
    );
  }

  if (!property) {
    return (
      <View style={[s.screen, { backgroundColor: C.background }]}>
        <ScreenHeader title="Not Found" showBack={true} />
        <EmptyState
          icon="office-building-marker-outline"
          title="Property not found"
          subtitle="We couldn't locate the property record."
          actionLabel="Go Back"
          onAction={() => router.back()}
        />
      </View>
    );
  }

  const COMPLIANCE_CONFIG = getComplianceConfig(C);
  const compliance = COMPLIANCE_CONFIG[property.compliance_status as ComplianceStatus]
    ?? COMPLIANCE_CONFIG[ComplianceStatus.Pending];

  const today         = localDateString();
  const activeAssets  = assets.filter(a => a.status === AssetStatus.Active).length;
  const isOverdue     = property.next_inspection_date && property.next_inspection_date < today;
  // FIX: derived from a dedicated COUNT query (jobHistoryCompleted) rather
  // than .filter().length over `jobHistory` — that array is now only a
  // page of the property's jobs (see loadMoreJobHistory), so filtering it
  // directly would undercount once the history goes back further than
  // whatever's currently loaded on screen.
  const passedJobs    = jobHistoryCompleted;

  const fullAddress = [property.address, property.suburb, property.state, property.postcode]
    .filter(Boolean).join(', ');

  return (
    <View style={[s.screen, { backgroundColor: C.background }]}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 40 }}
      >
        {/* ── HERO HEADER ────────────────────────────────── */}
        <ScreenHeader
          eyebrow="PROPERTY RECORD"
          title={property.name}
          subtitle={fullAddress || 'No address on file'}
          showBack={true}
          rightComponent={
            <View style={[s.compliancePill, { backgroundColor: compliance.badge + '30', borderColor: compliance.badge, borderWidth: 1 }]}>
              <MaterialCommunityIcons name={compliance.icon} size={12} color={compliance.badge} />
              <Text style={[s.compliancePillTxt, { color: compliance.badge }]}>
                {compliance.label.toUpperCase()}
              </Text>
            </View>
          }
        />

        {/* ── COMPLIANCE BANNER ──────────────────────────── */}
        <Animated.View entering={noMotion ? undefined : FadeInDown.delay(40).duration(400)}>
          <View style={[s.complianceBanner, { backgroundColor: compliance.bg, borderColor: compliance.border, marginHorizontal: 16, marginTop: 16 }]}>
            <View style={[s.complianceBannerIcon, { backgroundColor: compliance.border + '25' }]}>
              <MaterialCommunityIcons name={compliance.icon} size={26} color={compliance.text} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[s.complianceBannerTitle, { color: compliance.text }]}>
                {compliance.label}
              </Text>
              <Text style={[s.complianceBannerSub, { color: compliance.subtext }]}>
                {property.compliance_status === ComplianceStatus.Compliant
                  ? 'All assets are within service schedule.'
                  : property.compliance_status === ComplianceStatus.Overdue
                  ? `Inspection is overdue. Next inspection was due ${property.next_inspection_date}.`
                  : property.compliance_status === ComplianceStatus.NonCompliant
                  ? 'Outstanding defects or failed inspections on file.'
                  : 'Awaiting initial inspection or compliance review.'}
              </Text>
            </View>
          </View>
        </Animated.View>

        {/* ── QUICK STATS ROW ────────────────────────────── */}
        <Animated.View entering={noMotion ? undefined : FadeInDown.delay(80).duration(400)} style={s.statsRow}>
          <StatPill
            icon="shield-check"
            value={activeAssets}
            label="ASSETS"
            color={C.primary}
            bg={C.primary + '12'}
          />
          <StatPill
            icon="calendar-clock"
            value={isOverdue ? 'YES' : 'NO'}
            label="OVERDUE"
            color={isOverdue ? C.error : C.textTertiary}
            bg={isOverdue ? C.errorLight : C.backgroundTertiary}
          />
          <StatPill
            icon="check-circle"
            value={passedJobs}
            label="JOBS DONE"
            color={C.success}
            bg={C.successLight}
          />
        </Animated.View>

        {/* ── BEGIN INSPECTION CTA removed — inspection is always job-scoped.
             Technicians start inspections from /jobs/[id]/inspect. */}


        {/* ── QUICK ACTIONS ──────────────────────────────── */}
        <Animated.View entering={noMotion ? undefined : FadeInDown.delay(130).duration(400)} style={s.actionRowWrap}>
          {property.site_contact_phone && (
            <TouchableOpacity
              style={[s.actionBtn, { backgroundColor: C.surface, borderColor: C.border }]}
              onPress={() => Linking.openURL(`tel:${property.site_contact_phone}`)}
              activeOpacity={0.75}
            >
              <View style={[s.actionBtnIcon, { backgroundColor: C.primary + '15' }]}>
                <MaterialCommunityIcons name="phone" size={18} color={C.primary} />
              </View>
              <Text style={[s.actionBtnLabel, { color: C.text }]}>Call Contact</Text>
            </TouchableOpacity>
          )}
          {property.address && (
            <TouchableOpacity
              style={[s.actionBtn, { backgroundColor: C.surface, borderColor: C.border }]}
              onPress={() => Linking.openURL(`https://maps.google.com/?q=${encodeURIComponent(fullAddress)}`)}
              activeOpacity={0.75}
            >
              <View style={[s.actionBtnIcon, { backgroundColor: C.accent + '15' }]}>
                <MaterialCommunityIcons name="directions" size={18} color={C.accent} />
              </View>
              <Text style={[s.actionBtnLabel, { color: C.text }]}>Navigate</Text>
            </TouchableOpacity>
          )}
        </Animated.View>

        {/* ── SAFETY ALERTS ──────────────────────────────── */}
        {(property.hazard_notes || property.access_notes || property.site_note) && (
          <Animated.View entering={noMotion ? undefined : FadeInDown.delay(160).duration(400)} style={{ marginHorizontal: 16, gap: 10, marginTop: 8 }}>
            {property.hazard_notes && (
              <View style={[s.alertCard, { backgroundColor: C.errorLight, borderColor: C.error }]}>
                <View style={[s.alertIconWrap, { backgroundColor: C.error }]}>
                  <MaterialCommunityIcons name="alert" size={16} color={C.textOnPrimary} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[s.alertTitle, { color: C.errorDark }]}>Site Hazard Warning</Text>
                  <Text style={[s.alertBody, { color: C.error }]}>{property.hazard_notes}</Text>
                </View>
              </View>
            )}
            {property.access_notes && (
              <View style={[s.alertCard, { backgroundColor: C.infoLight, borderColor: C.infoDark }]}>
                <View style={[s.alertIconWrap, { backgroundColor: C.infoDark }]}>
                  <MaterialCommunityIcons name="key-variant" size={16} color={C.textOnPrimary} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[s.alertTitle, { color: C.infoDark }]}>Access Instructions</Text>
                  <Text style={[s.alertBody, { color: C.infoDark }]}>{property.access_notes}</Text>
                </View>
              </View>
            )}
            {property.site_note && (
              <View style={[s.alertCard, { backgroundColor: C.successLight, borderColor: C.success }]}>
                <View style={[s.alertIconWrap, { backgroundColor: C.success }]}>
                  <MaterialCommunityIcons name="note-text-outline" size={16} color={C.textOnPrimary} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[s.alertTitle, { color: C.successDark }]}>Site Note</Text>
                  <Text style={[s.alertBody, { color: C.successDark }]}>{property.site_note}</Text>
                </View>
              </View>
            )}
          </Animated.View>
        )}

        {/* ── PROPERTY INFO CARD ──────────────────────────── */}
        <Animated.View entering={noMotion ? undefined : FadeInDown.delay(200).duration(400)}>
          <SectionHeader icon="information-outline" title="Site Details" />
          <View style={[s.card, { backgroundColor: C.surface, borderColor: C.border, marginHorizontal: 16 }]}>
            <InfoRow
              icon="map-marker-outline"
              label="Address"
              value={fullAddress || 'Not specified'}
            />
            {property.site_contact_name && (
              <>
                <View style={[s.divider, { backgroundColor: C.border }]} />
                <InfoRow
                  icon="account-tie-outline"
                  label="Site Contact"
                  value={property.site_contact_name}
                />
              </>
            )}
            {property.site_contact_phone && (
              <>
                <View style={[s.divider, { backgroundColor: C.border }]} />
                <InfoRow
                  icon="phone-outline"
                  label="Phone"
                  value={property.site_contact_phone}
                  valueColor={C.primary}
                  onPress={() => Linking.openURL(`tel:${property.site_contact_phone}`)}
                />
              </>
            )}
          </View>
        </Animated.View>

        {/* ── ASSET SUMMARY ──────────────────────────────── */}
        <Animated.View entering={noMotion ? undefined : FadeInDown.delay(240).duration(400)}>
          <SectionHeader
            icon="shield-outline"
            title="Asset Register"
            count={assets.length}
            actionLabel="View All →"
            onAction={() => router.push(`/properties/assets/${id}` as never)}
          />
          <View style={[s.card, { backgroundColor: C.surface, borderColor: C.border, marginHorizontal: 16 }]}>
            <InfoRow
              icon="shield-check-outline"
              label="Total Assets"
              value={assets.length.toString()}
              onPress={() => router.push(`/properties/assets/${id}` as never)}
            />
            {property.next_inspection_date && (
              <>
                <View style={[s.divider, { backgroundColor: C.border }]} />
                <InfoRow
                  icon="calendar-clock-outline"
                  label="Next Inspection"
                  value={property.next_inspection_date}
                  valueColor={isOverdue ? C.error : C.text}
                />
              </>
            )}
            {activeAssets > 0 && !isOverdue && (
              <>
                <View style={[s.divider, { backgroundColor: C.border }]} />
                <View style={[s.assetRow, { justifyContent: 'center' }]}>
                  <MaterialCommunityIcons name="check-decagram" size={16} color={C.success} />
                  <Text style={{ fontSize: 13, fontWeight: '700', color: C.success, marginLeft: 6 }}>Site is up to date</Text>
                </View>
              </>
            )}
          </View>
        </Animated.View>

        {/* ── JOB HISTORY ─────────────────────────────────── */}
        <Animated.View entering={noMotion ? undefined : FadeInDown.delay(280).duration(400)}>
          <SectionHeader
            icon="clipboard-list-outline"
            title="Job History"
            count={jobHistoryTotal}
          />
          <View style={[s.card, { backgroundColor: C.surface, borderColor: C.border, marginHorizontal: 16, padding: 0 }]}>
            {jobHistory.length === 0 ? (
              <View style={s.emptyInCard}>
                <MaterialCommunityIcons name="clipboard-text-outline" size={36} color={C.border} />
                <Text style={[s.emptyTitle, { color: C.textTertiary }]}>No previous jobs</Text>
                <Text style={[s.emptySub, { color: C.textTertiary }]}>This property has no job history yet.</Text>
              </View>
            ) : (
              // FIX: `jobHistory` is now only the loaded page itself (see
              // loadMoreJobHistory) rather than the property's whole history
              // — no more .slice(0, 5) needed, every loaded job renders.
              <>
                {jobHistory.map((job, i) => (
                  <TouchableOpacity
                    key={job.id}
                    style={[
                      s.historyRow,
                      i < jobHistory.length - 1 && { borderBottomWidth: 1, borderBottomColor: C.border },
                    ]}
                    onPress={() => openJob(job.id)}
                    activeOpacity={0.7}
                  >
                    <View style={[s.historyIconWrap, { backgroundColor: C.backgroundTertiary }]}>
                      <MaterialCommunityIcons name="clipboard-check-outline" size={18} color={C.textSecondary} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={[s.historyDate, { color: C.text }]}>
                        {job.scheduled_date}
                        {(job.status === JobStatus.Completed || job.status === JobStatus.InProgress) && job.updated_at
                          ? ` → ${job.updated_at.substring(0, 10)}`
                          : ''}
                      </Text>
                      <Badge status={job.job_type} />
                    </View>
                    <View style={{ alignItems: 'flex-end', gap: 4 }}>
                      <Badge status={job.status} dot small />
                      <MaterialCommunityIcons name="chevron-right" size={16} color={C.border} />
                    </View>
                  </TouchableOpacity>
                ))}
                {/* Only ever fetches more when explicitly asked — see
                    loadMoreJobHistory's own comment. Same pattern as the
                    asset screen's History section. */}
                {jobHistory.length < jobHistoryTotal && (
                  <View style={[s.historyRow, { borderTopWidth: 1, borderTopColor: C.border, flexDirection: 'column', alignItems: 'stretch', gap: 8 }]}>
                    {jobHistoryLoadingMore ? (
                      <ActivityIndicator size="small" color={C.textTertiary} />
                    ) : (
                      <>
                        <Text style={[s.historyDate, { color: C.textTertiary, fontSize: 12, fontWeight: '600', textAlign: 'center' }]}>
                          {jobHistoryTotal - jobHistory.length} more job{jobHistoryTotal - jobHistory.length !== 1 ? 's' : ''} on record
                        </Text>
                        <View style={{ flexDirection: 'row', gap: 8, justifyContent: 'center' }}>
                          {[5, 10].filter((n) => n < jobHistoryTotal - jobHistory.length).map((n) => (
                            <TouchableOpacity
                              key={n}
                              style={[s.jobHistoryLoadMoreChip, { borderColor: C.border }]}
                              onPress={() => loadMoreJobHistory(n)}
                            >
                              <Text style={[s.jobHistoryLoadMoreChipTxt, { color: C.text }]}>+{n}</Text>
                            </TouchableOpacity>
                          ))}
                          <TouchableOpacity
                            style={[s.jobHistoryLoadMoreChip, { borderColor: C.border }]}
                            onPress={() => loadMoreJobHistory(jobHistoryTotal - jobHistory.length)}
                          >
                            <Text style={[s.jobHistoryLoadMoreChipTxt, { color: C.text }]}>Show all</Text>
                          </TouchableOpacity>
                        </View>
                      </>
                    )}
                  </View>
                )}
              </>
            )}
          </View>
        </Animated.View>

        {/* ── DOCUMENTS ────────────────────────────────────── */}
        <Animated.View entering={noMotion ? undefined : FadeInDown.delay(320).duration(400)}>
          <SectionHeader
            icon="file-document-outline"
            title="Documents"
            count={documents.length}
          />
          <View style={{ marginHorizontal: 16 }}>
            {documents.length === 0 ? (
              <View style={[s.card, { backgroundColor: C.surface, borderColor: C.border }]}>
                <View style={s.emptyInCard}>
                  <MaterialCommunityIcons name="file-document-outline" size={36} color={C.border} />
                  <Text style={[s.emptyTitle, { color: C.textTertiary }]}>No documents yet</Text>
                  <Text style={[s.emptySub, { color: C.textTertiary }]}>Scanned certificates and sign-off sheets from any visit will appear here.</Text>
                </View>
              </View>
            ) : (
              documents.map((doc) => <DocumentCard key={doc.id} document={doc} />)
            )}
          </View>
        </Animated.View>

        {/* ── SITE NOTEBOOK — view-only here. Items can only be added or
            deleted from within an actual inspection ("Photos & remarks"
            flow on jobs/[id]/inspect.tsx and the quick site-inspect
            screen) — this section is for browsing what's already there. */}
        <Animated.View entering={noMotion ? undefined : FadeInDown.delay(360).duration(400)}>
          <SectionHeader
            icon="notebook-outline"
            title="Site Notebook"
            count={notebookCount}
            actionLabel="View →"
            onAction={() => notebookSheetRef.current?.open()}
          />
          <TouchableOpacity
            activeOpacity={0.7}
            onPress={() => notebookSheetRef.current?.open()}
            style={[s.card, { backgroundColor: C.surface, borderColor: C.border, marginHorizontal: 16, padding: 14 }]}
          >
            <Text style={{ fontSize: 13, color: C.textSecondary }}>
              {notebookCount === 0
                ? 'No notes yet for this site.'
                : `${notebookCount} thing${notebookCount === 1 ? '' : 's'} to remember about this site.`}
            </Text>
          </TouchableOpacity>
        </Animated.View>

      </ScrollView>

      <PropertyNotebookSheet ref={notebookSheetRef} propertyId={id ?? ''} editable={false} />

      {/* Add Asset Modal has been moved to the dedicated assets sub-page */}
    </View>
  );
}

const s = StyleSheet.create({
  screen:   { flex: 1 },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center' },

  // Compliance pill (in header)
  compliancePill:    { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 20 },
  compliancePillTxt: { fontSize: 10, fontWeight: '800', letterSpacing: 0.5 },

  // Compliance banner
  complianceBanner:     { flexDirection: 'row', alignItems: 'center', gap: 14, borderRadius: 16, borderWidth: 1, padding: 16 },
  complianceBannerIcon: { width: 48, height: 48, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  complianceBannerTitle: { fontSize: 16, fontWeight: '800', marginBottom: 2 },
  complianceBannerSub:   { fontSize: 12, lineHeight: 17 },

  // Stats row
  statsRow: { flexDirection: 'row', marginHorizontal: 16, marginTop: 14, gap: 10 },

  // Inspect CTA
  inspectCta: {
    flexDirection: 'row', alignItems: 'center', gap: 14,
    borderRadius: 16, padding: 16,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.28, shadowRadius: 12, elevation: 8,
  },
  inspectCtaLeft: { width: 52, height: 52, borderRadius: 15, alignItems: 'center', justifyContent: 'center' },
  inspectCtaTitle: { fontSize: 16, fontWeight: '800', letterSpacing: 0.1, marginBottom: 3 },
  inspectCtaSub:   { fontSize: 12, lineHeight: 17 },

  // Quick action buttons
  actionRowWrap: { flexDirection: 'row', marginHorizontal: 16, marginTop: 14, gap: 10 },
  actionBtn:     { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 13, paddingHorizontal: 14, borderRadius: 14, borderWidth: 1 },
  actionBtnIcon: { width: 34, height: 34, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  actionBtnLabel:{ fontSize: 13, fontWeight: '700' },

  // Alert cards
  alertCard:    { flexDirection: 'row', alignItems: 'flex-start', gap: 12, padding: 16, borderRadius: 16, borderWidth: 1.5 },
  alertIconWrap:{ width: 32, height: 32, borderRadius: 10, alignItems: 'center', justifyContent: 'center', marginTop: 1 },
  alertTitle:   { fontSize: 13, fontWeight: '700', marginBottom: 3 },
  alertBody:    { fontSize: 12, lineHeight: 18 },

  // Cards
  card: { borderRadius: 16, borderWidth: 1, overflow: 'hidden',
          shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.08, shadowRadius: 12, elevation: 4 },
  divider: { height: 1, marginHorizontal: -16 },

  // Asset rows
  assetRow:      { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 16 },
  assetIconWrap: { width: 42, height: 42, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  assetType:     { fontSize: 14, fontWeight: '700', marginBottom: 1 },
  assetLocation: { fontSize: 12, marginTop: 1 },
  assetSerial:   { fontSize: 11, fontFamily: 'monospace', marginTop: 1 },
  dateChipsRow:  { flexDirection: 'row', gap: 6, marginTop: 6, flexWrap: 'wrap' },
  dateChip:      { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 7, paddingVertical: 3, borderRadius: 6 },
  dateChipTxt:   { fontSize: 10, fontWeight: '600' },
  assetRight:    { alignItems: 'center', gap: 2 },
  statusDot:     { width: 6, height: 6, borderRadius: 3 },

  // Job history rows
  historyRow:     { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 16 },
  historyIconWrap:{ width: 38, height: 38, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  historyDate:    { fontSize: 13, fontWeight: '700', marginBottom: 4 },
  jobHistoryLoadMoreChip: { paddingHorizontal: 14, paddingVertical: 7, borderRadius: 999, borderWidth: 1 },
  jobHistoryLoadMoreChipTxt: { fontSize: 12.5, fontWeight: '700' },

  // Empty states
  emptyInCard: { alignItems: 'center', gap: 8, paddingVertical: 32 },
  emptyTitle:  { fontSize: 15, fontWeight: '600' },
  emptySub:    { fontSize: 12, textAlign: 'center' },
});
