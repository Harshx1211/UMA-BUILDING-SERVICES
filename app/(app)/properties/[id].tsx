// Property detail screen — professional inspection-officer view inspired by Uptick
import { useCallback, useState } from 'react';
import {
  Linking, ScrollView, StyleSheet, TouchableOpacity, View,
} from 'react-native';
import { ActivityIndicator, Text } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { router, useLocalSearchParams, useFocusEffect } from 'expo-router';
import { useColors } from '@/hooks/useColors';
import { ComplianceStatus, AssetStatus, JobStatus, JobType } from '@/constants/Enums';
import { getRecord, getAssetsForProperty, getJobsForProperty } from '@/lib/database';
import type { Property, Asset, Job } from '@/types';
import { StatusBadge } from '@/components/jobs/StatusBadge';
import { JobTypeBadge } from '@/components/jobs/JobTypeBadge';
import { ScreenHeader, EmptyState } from '@/components/ui';

// ─── Compliance config ──────────────────────────────────────
const getComplianceConfig = (C: any): Record<ComplianceStatus, {
  bg: string; border: string; text: string; subtext: string; icon: string; label: string; badge: string;
}> => ({
  [ComplianceStatus.Compliant]:    { bg: C.successLight, border: C.success, text: C.successDark, subtext: C.success, icon: 'check-decagram', label: 'Compliant', badge: '#15803D' },
  [ComplianceStatus.NonCompliant]: { bg: C.errorLight,   border: C.error,   text: C.errorDark,   subtext: C.error,   icon: 'close-circle',  label: 'Non-Compliant', badge: '#B91C1C' },
  [ComplianceStatus.Overdue]:      { bg: '#FFF3CD',      border: '#F59E0B', text: '#92400E',      subtext: '#D97706', icon: 'alert-decagram', label: 'Overdue', badge: '#92400E' },
  [ComplianceStatus.Pending]:      { bg: C.backgroundTertiary, border: C.border, text: C.textSecondary, subtext: C.textTertiary, icon: 'clock-outline', label: 'Pending Review', badge: C.textSecondary },
});


type JobHistory = Job & {
  technician_name: string | null;
  property_name?: string;
};

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
  wrap:  { flex: 1, alignItems: 'center', paddingVertical: 14, borderRadius: 14, gap: 4 },
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
  const { id } = useLocalSearchParams<{ id: string }>();
  const [property, setProperty] = useState<Property | null>(null);
  const [assets, setAssets]     = useState<Asset[]>([]);
  const [jobHistory, setJobHistory] = useState<JobHistory[]>([]);
  const [isLoading, setIsLoading]   = useState(true);



  const load = useCallback(() => {
    if (!id) return;
    setIsLoading(true);
    try {
      const p = getRecord<Property>('properties', id);
      setProperty(p);
      if (p) {
        setAssets(getAssetsForProperty<Asset>(id));
        setJobHistory(getJobsForProperty<JobHistory>(id, 5));
      }
    } catch (err) {
      console.error('[PropertyDetail] load error:', err);
    } finally {
      setIsLoading(false);
    }
  }, [id]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

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
        <ScreenHeader curved={false} title="Not Found" showBack={true} />
        <EmptyState
          emoji="🏢"
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

  const today         = new Date().toISOString().slice(0, 10);
  const activeAssets  = assets.filter(a => a.status === AssetStatus.Active).length;
  const isOverdue     = property.next_inspection_date && property.next_inspection_date < today;
  const passedJobs    = jobHistory.filter(j => j.status === JobStatus.Completed).length;

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
              <MaterialCommunityIcons name={compliance.icon as any} size={12} color={compliance.badge} />
              <Text style={[s.compliancePillTxt, { color: compliance.badge }]}>
                {compliance.label.toUpperCase()}
              </Text>
            </View>
          }
        />

        {/* ── COMPLIANCE BANNER ──────────────────────────── */}
        <Animated.View entering={FadeInDown.delay(40).duration(400)}>
          <View style={[s.complianceBanner, { backgroundColor: compliance.bg, borderColor: compliance.border, marginHorizontal: 16, marginTop: 16 }]}>
            <View style={[s.complianceBannerIcon, { backgroundColor: compliance.border + '25' }]}>
              <MaterialCommunityIcons name={compliance.icon as any} size={26} color={compliance.text} />
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
        <Animated.View entering={FadeInDown.delay(80).duration(400)} style={s.statsRow}>
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

        {/* ── BEGIN INSPECTION CTA ────────────────────────── */}
        <Animated.View entering={FadeInDown.delay(110).duration(400)} style={{ marginHorizontal: 16, marginTop: 16 }}>
          <TouchableOpacity
            style={[s.inspectCta, { backgroundColor: C.primary, shadowColor: C.primary }]}
            onPress={() => router.push(`/properties/site-inspect/${id}` as never)}
            activeOpacity={0.88}
          >
            <View style={[s.inspectCtaLeft, { backgroundColor: 'rgba(255,255,255,0.18)' }]}>
              <MaterialCommunityIcons name="clipboard-check-outline" size={26} color="#FFF" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={s.inspectCtaTitle}>Begin Inspection Form</Text>
              <Text style={s.inspectCtaSub}>
                {activeAssets} asset{activeAssets !== 1 ? 's' : ''} · Tap to start on-site inspection
              </Text>
            </View>
            <MaterialCommunityIcons name="arrow-right-circle" size={26} color="rgba(255,255,255,0.85)" />
          </TouchableOpacity>
        </Animated.View>

        {/* ── QUICK ACTIONS ──────────────────────────────── */}
        <Animated.View entering={FadeInDown.delay(130).duration(400)} style={s.actionRowWrap}>
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
        {(property.hazard_notes || property.access_notes) && (
          <Animated.View entering={FadeInDown.delay(160).duration(400)} style={{ marginHorizontal: 16, gap: 10, marginTop: 8 }}>
            {property.hazard_notes && (
              <View style={[s.alertCard, { backgroundColor: C.errorLight, borderColor: C.error }]}>
                <View style={[s.alertIconWrap, { backgroundColor: C.error }]}>
                  <MaterialCommunityIcons name="alert" size={16} color="#FFF" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[s.alertTitle, { color: C.errorDark }]}>⚠️ Site Hazard Warning</Text>
                  <Text style={[s.alertBody, { color: C.error }]}>{property.hazard_notes}</Text>
                </View>
              </View>
            )}
            {property.access_notes && (
              <View style={[s.alertCard, { backgroundColor: C.infoLight, borderColor: C.infoDark }]}>
                <View style={[s.alertIconWrap, { backgroundColor: C.infoDark }]}>
                  <MaterialCommunityIcons name="key-variant" size={16} color="#FFF" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[s.alertTitle, { color: C.infoDark }]}>🔑 Access Instructions</Text>
                  <Text style={[s.alertBody, { color: C.infoDark }]}>{property.access_notes}</Text>
                </View>
              </View>
            )}
          </Animated.View>
        )}

        {/* ── PROPERTY INFO CARD ──────────────────────────── */}
        <Animated.View entering={FadeInDown.delay(200).duration(400)}>
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
        <Animated.View entering={FadeInDown.delay(240).duration(400)}>
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
        <Animated.View entering={FadeInDown.delay(280).duration(400)}>
          <SectionHeader
            icon="clipboard-list-outline"
            title="Job History"
            count={jobHistory.length}
          />
          <View style={[s.card, { backgroundColor: C.surface, borderColor: C.border, marginHorizontal: 16, padding: 0 }]}>
            {jobHistory.length === 0 ? (
              <View style={s.emptyInCard}>
                <MaterialCommunityIcons name="clipboard-text-outline" size={36} color={C.border} />
                <Text style={[s.emptyTitle, { color: C.textTertiary }]}>No previous jobs</Text>
                <Text style={[s.emptySub, { color: C.textTertiary }]}>This property has no job history yet.</Text>
              </View>
            ) : (
              jobHistory.map((job, i) => (
                <TouchableOpacity
                  key={job.id}
                  style={[
                    s.historyRow,
                    i < jobHistory.length - 1 && { borderBottomWidth: 1, borderBottomColor: C.border },
                  ]}
                  onPress={() => router.push(`/jobs/${job.id}` as never)}
                  activeOpacity={0.7}
                >
                  <View style={[s.historyIconWrap, { backgroundColor: C.backgroundTertiary }]}>
                    <MaterialCommunityIcons name="clipboard-check-outline" size={18} color={C.textSecondary} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[s.historyDate, { color: C.text }]}>{job.scheduled_date}</Text>
                    <JobTypeBadge jobType={job.job_type as JobType} />
                  </View>
                  <View style={{ alignItems: 'flex-end', gap: 4 }}>
                    <StatusBadge status={job.status as JobStatus} small />
                    <MaterialCommunityIcons name="chevron-right" size={16} color={C.border} />
                  </View>
                </TouchableOpacity>
              ))
            )}
          </View>
        </Animated.View>

      </ScrollView>

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
    borderRadius: 18, padding: 18,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.28, shadowRadius: 12, elevation: 8,
  },
  inspectCtaLeft: { width: 52, height: 52, borderRadius: 15, alignItems: 'center', justifyContent: 'center' },
  inspectCtaTitle: { color: '#FFF', fontSize: 16, fontWeight: '800', letterSpacing: 0.1, marginBottom: 3 },
  inspectCtaSub:   { color: 'rgba(255,255,255,0.75)', fontSize: 12, lineHeight: 17 },

  // Quick action buttons
  actionRowWrap: { flexDirection: 'row', marginHorizontal: 16, marginTop: 14, gap: 10 },
  actionBtn:     { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 13, paddingHorizontal: 14, borderRadius: 14, borderWidth: 1 },
  actionBtnIcon: { width: 34, height: 34, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  actionBtnLabel:{ fontSize: 13, fontWeight: '700' },

  // Alert cards
  alertCard:    { flexDirection: 'row', alignItems: 'flex-start', gap: 12, padding: 14, borderRadius: 14, borderWidth: 1.5 },
  alertIconWrap:{ width: 32, height: 32, borderRadius: 10, alignItems: 'center', justifyContent: 'center', marginTop: 1 },
  alertTitle:   { fontSize: 13, fontWeight: '700', marginBottom: 3 },
  alertBody:    { fontSize: 12, lineHeight: 18 },

  // Cards
  card: { borderRadius: 16, borderWidth: 1, overflow: 'hidden',
          shadowColor: '#0D1526', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.08, shadowRadius: 12, elevation: 4 },
  divider: { height: 1, marginHorizontal: -16 },

  // Asset rows
  assetRow:      { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14 },
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
  historyRow:     { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14 },
  historyIconWrap:{ width: 38, height: 38, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  historyDate:    { fontSize: 13, fontWeight: '700', marginBottom: 4 },

  // Empty states
  emptyInCard: { alignItems: 'center', gap: 8, paddingVertical: 32 },
  emptyTitle:  { fontSize: 15, fontWeight: '600' },
  emptySub:    { fontSize: 12, textAlign: 'center' },
});
