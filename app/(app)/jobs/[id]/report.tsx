import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  Platform,
  Image,
  TouchableOpacity,
  RefreshControl,
  Linking,
  Alert,
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
} from '@/lib/database';
import { useColors } from '@/hooks/useColors';
import { ScreenHeader, Button, SectionTitle, Card } from '@/components/ui';
import Animated, { FadeInDown, FadeIn, SlideInRight } from 'react-native-reanimated';
import { formatAssetType, getAssetEmoji } from '@/utils/assetHelpers';
import { DefectSeverity } from '@/constants/Enums';
import type { Defect, Signature } from '@/types';
import { getValidLocalUri } from '@/utils/fileHelpers';
import { supabase } from '@/lib/supabase';

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

const SEVERITY_CONFIG: Record<string, { color: string; bg: string; label: string; icon: MCIcon }> = {
  [DefectSeverity.Critical]: { color: '#DC2626', bg: '#FEF2F2', label: 'Critical',      icon: 'alert-circle' },
  [DefectSeverity.Major]:    { color: '#D97706', bg: '#FFFBEB', label: 'Major',          icon: 'alert' },
  [DefectSeverity.Minor]:    { color: '#2563EB', bg: '#EFF6FF', label: 'Non-conformance', icon: 'information' },
};

// ─── Stat card ─────────────────────────────────────────────────────────────────

type StatCardProps = {
  icon: MCIcon; iconColor: string; iconBg: string;
  value: number | string; label: string; valueColor: string;
  surface: string; border: string;
};

function StatCard({ icon, iconColor, iconBg, value, label, valueColor, surface, border }: StatCardProps) {
  return (
    <View style={[s.statCard, { backgroundColor: surface, borderColor: border }]}>
      <View style={[s.statIconWrap, { backgroundColor: iconBg }]}>
        <MaterialCommunityIcons name={icon} size={18} color={iconColor} />
      </View>
      <Text style={[s.statVal, { color: valueColor }]}>{value}</Text>
      <Text style={[s.statLabel, { color: '#94A3B8' }]}>{label}</Text>
    </View>
  );
}

// ─── Asset row ─────────────────────────────────────────────────────────────────

type AssetRowProps = {
  asset: ReportAsset;
  index: number;
  isLast: boolean;
  colors: ReturnType<typeof useColors>;
};

function AssetRow({ asset, index, isLast, colors: C }: AssetRowProps) {
  const isPass   = asset.result === 'pass';
  const isFail   = asset.result === 'fail';
  const isNT     = !isPass && !isFail;

  const pillStyle = isPass
    ? { bg: '#D1FAE5', text: '#065F46', border: '#6EE7B7', label: 'PASS' }
    : isFail
    ? { bg: '#FEE2E2', text: '#991B1B', border: '#FCA5A5', label: 'FAIL' }
    : { bg: '#F1F5F9', text: '#64748B', border: '#CBD5E1', label: 'N/T' };

  return (
    <View style={[
      s.assetRow,
      !isLast && { borderBottomWidth: 1, borderBottomColor: C.border },
      isFail && { backgroundColor: '#FFF8F8' },
    ]}>
      <View style={[s.assetIndexBadge, { backgroundColor: isPass ? '#D1FAE5' : isFail ? '#FEE2E2' : '#F1F5F9' }]}>
        <Text style={[s.assetIndexText, { color: isPass ? '#065F46' : isFail ? '#991B1B' : '#64748B' }]}>
          {String(index + 1).padStart(2, '0')}
        </Text>
      </View>
      <View style={s.assetMiddle}>
        <Text style={[s.assetName, { color: C.text }]}>
          {getAssetEmoji(asset.asset_type)} {formatAssetType(asset.asset_type)}
        </Text>
        {asset.location_on_site ? (
          <Text style={[s.assetLoc, { color: C.textSecondary }]}>
            <MaterialCommunityIcons name="map-marker-outline" size={10} color={C.textSecondary} />{' '}
            {asset.location_on_site}
          </Text>
        ) : null}
        {isFail && asset.defect_reason ? (
          <View style={s.defectReasonRow}>
            <MaterialCommunityIcons name="alert-circle-outline" size={11} color="#DC2626" />
            <Text style={s.defectReasonTxt}>{asset.defect_reason}</Text>
          </View>
        ) : null}
      </View>
      <View style={[s.resultPill, { backgroundColor: pillStyle.bg, borderColor: pillStyle.border }]}>
        <Text style={[s.resultPillTxt, { color: pillStyle.text }]}>{pillStyle.label}</Text>
      </View>
    </View>
  );
}

// ─── Defect card ───────────────────────────────────────────────────────────────

type DefectCardProps = {
  defect: Defect;
  index: number;
  colors: ReturnType<typeof useColors>;
};

function DefectCard({ defect, index, colors: C }: DefectCardProps) {
  const sev = SEVERITY_CONFIG[defect.severity as DefectSeverity] ?? SEVERITY_CONFIG[DefectSeverity.Minor];
  const isOpen = !defect.status || defect.status === 'open';

  return (
    <Animated.View entering={FadeInDown.delay(index * 60).duration(300)}>
      <View style={[s.defectCard, { backgroundColor: C.surface, borderColor: C.border }]}>
        {/* Severity stripe */}
        <View style={[s.defectStripe, { backgroundColor: sev.color }]} />

        <View style={s.defectContent}>
          {/* Header row */}
          <View style={s.defectHeaderRow}>
            <View style={[s.sevBadge, { backgroundColor: sev.bg, borderColor: sev.color + '40' }]}>
              <MaterialCommunityIcons name={sev.icon} size={11} color={sev.color} />
              <Text style={[s.sevBadgeTxt, { color: sev.color }]}>{sev.label.toUpperCase()}</Text>
            </View>
            <View style={[
              s.statusBadge,
              { backgroundColor: isOpen ? '#FFFBEB' : '#F0FDF4', borderColor: isOpen ? '#FDE68A' : '#BBF7D0' },
            ]}>
              <View style={[s.statusDot, { backgroundColor: isOpen ? '#D97706' : '#16A34A' }]} />
              <Text style={[s.statusBadgeTxt, { color: isOpen ? '#D97706' : '#16A34A' }]}>
                {defect.status?.replace('_', ' ').toUpperCase() ?? 'OPEN'}
              </Text>
            </View>
          </View>

          {/* Description */}
          <Text style={[s.defectDesc, { color: C.text }]}>{defect.description}</Text>

          {/* Meta row */}
          <View style={s.defectMetaRow}>
            {(defect as any).asset_type ? (
              <Text style={[s.defectMeta, { color: C.textSecondary }]}>
                {getAssetEmoji((defect as any).asset_type)} {formatAssetType((defect as any).asset_type)}
              </Text>
            ) : null}
            {(defect as any).defect_code ? (
              <View style={[s.codeChip, { backgroundColor: C.primary + '15', borderColor: C.primary + '30' }]}>
                <Text style={[s.codeChipTxt, { color: C.primary }]}>
                  {(defect as any).defect_code.toUpperCase()}
                </Text>
              </View>
            ) : null}
            {(defect as any).quote_price != null ? (
              <Text style={[s.defectPrice, { color: '#10B981' }]}>
                Ref: ${(defect as any).quote_price}
              </Text>
            ) : null}
          </View>
        </View>
      </View>
    </Animated.View>
  );
}

// ─── Main screen ───────────────────────────────────────────────────────────────

export default function ReportScreen() {
  const C = useColors();
  const { id: jobId } = useLocalSearchParams<{ id: string }>();

  const [job, setJob]             = useState<JobWithProperty | null>(null);
  const [assets, setAssets]       = useState<ReportAsset[]>([]);
  const [defects, setDefects]     = useState<Defect[]>([]);
  const [signature, setSignature] = useState<Signature | null>(null);
  const [techName, setTechName]   = useState<string>('Field Technician');
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const loadData = useCallback(() => {
    if (!jobId) return;
    try {
      const j = getJobById<JobWithProperty>(jobId);
      if (j) {
        setJob(j);
        setAssets(getAssetsWithJobResults(jobId, (j as any).property_id as string));
        setDefects(getDefectsForJob(jobId));
        setSignature(getSignatureForJob(jobId));
        const tech = getRecord<{ full_name: string }>('users', (j as any).assigned_to as string);
        if (tech?.full_name) setTechName(tech.full_name);
        setLoadError(null);
      } else {
        setLoadError('Job data not found. It may have been deleted or not yet synced.');
      }
    } catch (e) {
      console.error(e);
      setLoadError('Failed to load job data. Please go back and try again.');
    } finally {
      setIsLoading(false);
      setRefreshing(false);
    }
  }, [jobId]);

  // ── Reload data every time this screen comes into focus ───────────────────
  // This is critical: after navigating to preview → generating → coming back,
  // the job.report_url in local state must reflect the newly uploaded URL.
  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [loadData])
  );

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    loadData();
  }, [loadData]);

  // ── Derived stats ──────────────────────────────────────────────────────────
  const passCount  = assets.filter(a => a.result === 'pass').length;
  const failCount  = assets.filter(a => a.result === 'fail').length;
  const ntCount    = assets.filter(a => a.result === 'not_tested').length;
  const isCompliant = assets.length > 0 && passCount > 0 && failCount === 0;
  const inspectedCount = assets.filter(a => a.result !== null && a.result !== 'not_tested').length;

  // ── Loading ────────────────────────────────────────────────────────────────
  if (isLoading) {
    return (
      <View style={[s.center, { backgroundColor: C.background }]}>
        <ActivityIndicator color={C.primary} size="large" />
        <Text style={[s.loadingText, { color: C.textSecondary }]}>Loading report…</Text>
      </View>
    );
  }

  // ── Error ──────────────────────────────────────────────────────────────────
  if (loadError) {
    return (
      <View style={[s.center, { backgroundColor: C.background }]}>
        <View style={s.errorIcon}>
          <MaterialCommunityIcons name="alert-circle-outline" size={48} color={C.error} />
        </View>
        <Text style={[s.errorTitle, { color: C.text }]}>Unable to Load Report</Text>
        <Text style={[s.errorSub, { color: C.textSecondary }]}>{loadError}</Text>
        <View style={{ marginTop: 20 }}>
          <Button title="Go Back" onPress={() => router.back()} />
        </View>
      </View>
    );
  }

  if (!job) {
    return (
      <View style={[s.center, { backgroundColor: C.background }]}>
        <MaterialCommunityIcons name="file-document-outline" size={52} color={C.textSecondary} />
        <Text style={[s.errorTitle, { color: C.text }]}>Report Not Found</Text>
        <View style={{ marginTop: 16 }}>
          <Button title="Go Back" onPress={() => router.back()} />
        </View>
      </View>
    );
  }

  // ── Compliance badge ───────────────────────────────────────────────────────
  const complianceBadge = (
    <View style={[s.complianceBadge, {
      backgroundColor: isCompliant ? 'rgba(74,222,128,0.15)' : 'rgba(239,68,68,0.15)',
      borderColor: isCompliant ? 'rgba(74,222,128,0.35)' : 'rgba(239,68,68,0.35)',
    }]}>
      <MaterialCommunityIcons
        name={isCompliant ? 'shield-check' : 'shield-alert'}
        size={13}
        color={isCompliant ? '#4ADE80' : '#F87171'}
      />
      <Text style={[s.complianceTxt, { color: isCompliant ? '#4ADE80' : '#F87171' }]}>
        {isCompliant ? 'COMPLIANT' : 'NON-COMPLIANT'}
      </Text>
    </View>
  );

  return (
    <View style={[s.screen, { backgroundColor: C.background }]}>
      <ScreenHeader
        eyebrow="INSPECTION REPORT"
        title={job.property_name ?? 'Inspection Report'}
        subtitle={job.scheduled_date
          ? new Date(job.scheduled_date + 'T00:00:00').toLocaleDateString('en-AU', {
              weekday: 'short', day: 'numeric', month: 'short', year: 'numeric',
            })
          : 'Not scheduled'
        }
        showBack
        curved={false}
        rightComponent={complianceBadge}
      />

      <ScrollView
        contentContainerStyle={s.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={C.primary} />}
      >
        {/* ── Property card ── */}
        <Animated.View entering={FadeInDown.delay(60).duration(350)}>
          <View style={[s.propertyCard, { backgroundColor: C.surface, borderColor: C.border }]}>
            <View style={[s.propertyAccent, { backgroundColor: C.primary }]} />
            <View style={s.propertyBody}>
              <Text style={[s.propertyName, { color: C.text }]}>{job.property_name ?? 'Unknown Site'}</Text>
              {(job.property_address || job.property_suburb) ? (
                <Text style={[s.propertyAddress, { color: C.textSecondary }]}>
                  {[job.property_address, job.property_suburb, job.property_state].filter(Boolean).join(', ')}
                </Text>
              ) : null}
              <View style={[s.propertyDivider, { backgroundColor: C.border }]} />
              <View style={s.propertyMeta}>
                <View style={s.metaItem}>
                  <MaterialCommunityIcons name="account-hard-hat-outline" size={13} color={C.textSecondary} />
                  <Text style={[s.metaText, { color: C.textSecondary }]}>
                    Technician: <Text style={[s.metaValue, { color: C.text }]}>{techName}</Text>
                  </Text>
                </View>
                <View style={s.metaItem}>
                  <MaterialCommunityIcons name="calendar-check-outline" size={13} color={C.textSecondary} />
                  <Text style={[s.metaText, { color: C.textSecondary }]}>
                    Date: <Text style={[s.metaValue, { color: C.text }]}>{job.scheduled_date}</Text>
                  </Text>
                </View>
                {job.site_contact_name ? (
                  <View style={s.metaItem}>
                    <MaterialCommunityIcons name="account-outline" size={13} color={C.textSecondary} />
                    <Text style={[s.metaText, { color: C.textSecondary }]}>
                      Contact: <Text style={[s.metaValue, { color: C.text }]}>{job.site_contact_name}</Text>
                    </Text>
                  </View>
                ) : null}
              </View>
            </View>
          </View>
        </Animated.View>

        {/* ── Stats grid ── */}
        <Animated.View entering={FadeInDown.delay(120).duration(350)}>
          <Text style={[s.sectionLabel, { color: C.textSecondary }]}>INSPECTION OUTCOMES</Text>
          <View style={s.statsRow}>
            <StatCard
              icon="tools" iconColor={C.textSecondary} iconBg={C.backgroundTertiary ?? '#F1F5F9'}
              value={assets.length} label="Total" valueColor={C.text}
              surface={C.surface} border={C.border}
            />
            <StatCard
              icon="check-circle" iconColor="#16A34A" iconBg="#D1FAE5"
              value={passCount} label="Passed" valueColor="#16A34A"
              surface={C.surface} border={C.border}
            />
            <StatCard
              icon="close-circle" iconColor="#DC2626" iconBg="#FEE2E2"
              value={failCount} label="Failed" valueColor="#DC2626"
              surface={C.surface} border={C.border}
            />
            {ntCount > 0 && (
              <StatCard
                icon="minus-circle-outline" iconColor="#64748B" iconBg="#F1F5F9"
                value={ntCount} label="N/T" valueColor="#64748B"
                surface={C.surface} border={C.border}
              />
            )}
          </View>
          {/* Progress bar */}
          {assets.length > 0 && (
            <View style={[s.progressWrap, { backgroundColor: C.surface, borderColor: C.border }]}>
              <View style={s.progressBarTrack}>
                {passCount > 0 && (
                  <View style={[s.progressSegment, { flex: passCount, backgroundColor: '#16A34A' }]} />
                )}
                {failCount > 0 && (
                  <View style={[s.progressSegment, { flex: failCount, backgroundColor: '#DC2626' }]} />
                )}
                {ntCount > 0 && (
                  <View style={[s.progressSegment, { flex: ntCount, backgroundColor: '#CBD5E1' }]} />
                )}
              </View>
              <Text style={[s.progressLabel, { color: C.textSecondary }]}>
                {inspectedCount} of {assets.length} assets inspected
              </Text>
            </View>
          )}
        </Animated.View>

        {/* ── Asset results ── */}
        <Animated.View entering={FadeInDown.delay(180).duration(350)}>
          <View style={s.sectionHeader}>
            <Text style={[s.sectionLabel, { color: C.textSecondary }]}>ASSET INSPECTION RESULTS</Text>
            <View style={[s.countChip, { backgroundColor: C.primary + '18' }]}>
              <Text style={[s.countChipTxt, { color: C.primary }]}>{assets.length}</Text>
            </View>
          </View>
          <View style={[s.tableCard, { backgroundColor: C.surface, borderColor: C.border }]}>
            {assets.length === 0 ? (
              <View style={s.emptyState}>
                <MaterialCommunityIcons name="clipboard-outline" size={32} color={C.textSecondary} />
                <Text style={[s.emptyText, { color: C.textSecondary }]}>No assets tested</Text>
              </View>
            ) : (
              assets.map((asset, i) => (
                <AssetRow
                  key={asset.id}
                  asset={asset}
                  index={i}
                  isLast={i === assets.length - 1}
                  colors={C}
                />
              ))
            )}
          </View>
        </Animated.View>

        {/* ── Defects ── */}
        <Animated.View entering={FadeInDown.delay(240).duration(350)}>
          <View style={s.sectionHeader}>
            <Text style={[s.sectionLabel, { color: C.textSecondary }]}>DEFECTS IDENTIFIED</Text>
            {defects.length > 0 && (
              <View style={[s.countChip, { backgroundColor: '#FEE2E2' }]}>
                <Text style={[s.countChipTxt, { color: '#DC2626' }]}>{defects.length}</Text>
              </View>
            )}
          </View>
          {defects.length === 0 ? (
            <View style={[s.noDefectsCard, { backgroundColor: '#F0FDF4', borderColor: '#BBF7D0' }]}>
              <MaterialCommunityIcons name="shield-check-outline" size={24} color="#16A34A" />
              <Text style={[s.noDefectsText, { color: '#15803D' }]}>No defects recorded — great work!</Text>
            </View>
          ) : (
            <View style={s.defectList}>
              {defects.map((d, i) => (
                <DefectCard key={d.id} defect={d} index={i} colors={C} />
              ))}
            </View>
          )}
        </Animated.View>

        {/* ── Documentation checklist ── */}
        <Animated.View entering={FadeInDown.delay(300).duration(350)}>
          <Text style={[s.sectionLabel, { color: C.textSecondary }]}>DOCUMENTATION CHECKLIST</Text>
          <View style={[s.checklistCard, { backgroundColor: C.surface, borderColor: C.border }]}>
            {/* Assets inspected */}
            <View style={s.checklistRow}>
              <View style={[s.checkDot, { backgroundColor: inspectedCount > 0 ? '#16A34A' : '#D97706' }]} />
              <View style={{ flex: 1 }}>
                <Text style={[s.checklistTitle, { color: C.text }]}>
                  {inspectedCount > 0
                    ? `${inspectedCount} asset${inspectedCount !== 1 ? 's' : ''} inspected`
                    : 'No assets inspected yet'}
                </Text>
              </View>
              <MaterialCommunityIcons
                name={inspectedCount > 0 ? 'check-circle' : 'clock-outline'}
                size={18}
                color={inspectedCount > 0 ? '#16A34A' : '#D97706'}
              />
            </View>

            <View style={[s.checklistDivider, { backgroundColor: C.border }]} />

            {/* Defects */}
            <View style={s.checklistRow}>
              <View style={[s.checkDot, { backgroundColor: defects.length > 0 ? '#D97706' : '#16A34A' }]} />
              <View style={{ flex: 1 }}>
                <Text style={[s.checklistTitle, { color: C.text }]}>
                  {defects.length === 0 ? 'No defects recorded' : `${defects.length} defect${defects.length !== 1 ? 's' : ''} logged`}
                </Text>
              </View>
              <MaterialCommunityIcons
                name={defects.length === 0 ? 'check-circle' : 'alert-circle-outline'}
                size={18}
                color={defects.length === 0 ? '#16A34A' : '#D97706'}
              />
            </View>

            <View style={[s.checklistDivider, { backgroundColor: C.border }]} />

            {/* Signature */}
            <View style={[s.checklistRow, { alignItems: 'flex-start' }]}>
              <View style={[s.checkDot, { backgroundColor: signature ? '#16A34A' : '#DC2626', marginTop: 3 }]} />
              <View style={{ flex: 1 }}>
                <Text style={[s.checklistTitle, { color: C.text }]}>
                  {signature ? 'Client signature captured' : 'Client signature missing'}
                </Text>
                {signature?.signed_by_name ? (
                  <Text style={[s.checklistSub, { color: C.textSecondary }]}>
                    Signed by {signature.signed_by_name}
                  </Text>
                ) : null}
                {signature?.signature_url ? (
                  <View style={[s.sigImageBox, { backgroundColor: C.backgroundTertiary ?? '#F8FAFC', borderColor: C.border }]}>
                    <Image
                      source={{ uri: getValidLocalUri(signature.signature_url) }}
                      style={s.sigImage}
                      resizeMode="contain"
                    />
                  </View>
                ) : null}
              </View>
              <MaterialCommunityIcons
                name={signature ? 'check-circle' : 'close-circle'}
                size={18}
                color={signature ? '#16A34A' : '#DC2626'}
              />
            </View>
          </View>
        </Animated.View>

        {/* ── Signature CTA ── */}
        {!signature && (
          <Animated.View entering={FadeIn.delay(420).duration(300)}>
            <View style={[s.signatureCTA, { borderColor: '#FCA5A5' }]}>
              <MaterialCommunityIcons name="pen-lock" size={22} color="#DC2626" style={{ marginBottom: 8 }} />
              <Text style={[s.ctaTitle, { color: C.text }]}>Signature Required</Text>
              <Text style={[s.ctaSub, { color: C.textSecondary }]}>
                Compliance reports must include a client signature. Please capture it before generating the PDF.
              </Text>
              <View style={{ marginTop: 14 }}>
                <Button
                  title="Capture Signature Now"
                  onPress={() => router.push(`/jobs/${jobId}/signature` as never)}
                  icon={<MaterialCommunityIcons name="draw-pen" size={16} color="#FFFFFF" />}
                  style={{ borderRadius: 22 }}
                />
              </View>
            </View>
          </Animated.View>
        )}

        <View style={{ height: 16 }} />
      </ScrollView>

      {/* ── Bottom action bar ── */}
      <View style={[s.bottomBar, { backgroundColor: C.surface, borderTopColor: C.border }]}>
        {inspectedCount === 0 && !job?.report_url && (
          <View style={[s.warningBanner, { backgroundColor: '#FFFBEB', borderColor: '#FDE68A' }]}>
            <MaterialCommunityIcons name="alert" size={14} color="#D97706" />
            <Text style={s.warningText}>No assets inspected — PDF will be empty</Text>
          </View>
        )}

        {job?.report_url ? (
          // ── Report already uploaded ──────────────────────────────────────────
          <View style={{ gap: 8 }}>
            {/* Notification banner — tells tech the report is live on the server */}
            <View style={[s.uploadedBanner, { backgroundColor: '#F0FDF4', borderColor: '#86EFAC' }]}>
              <View style={[s.uploadedIconWrap, { backgroundColor: '#BBF7D0' }]}>
                <MaterialCommunityIcons name="cloud-check" size={18} color="#15803D" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[s.uploadedTitle, { color: '#15803D' }]}>Report Live on Server ✓</Text>
                <Text style={[s.uploadedSub, { color: '#166534' }]}>
                  Admin can view &amp; download this report.
                </Text>
              </View>
              <TouchableOpacity
                onPress={() => { if (job.report_url) Linking.openURL(job.report_url); }}
                style={[s.uploadedOpenBtn, { backgroundColor: '#16A34A' }]}>
                <MaterialCommunityIcons name="open-in-new" size={14} color="#FFF" />
              </TouchableOpacity>
            </View>

            <View style={{ flexDirection: 'row', gap: 10 }}>
              <Button
                title="Open Report"
                onPress={() => { if (job.report_url) Linking.openURL(job.report_url); }}
                icon={<MaterialCommunityIcons name="open-in-new" size={18} color="#FFF" />}
                style={{ height: 52, borderRadius: 26, flex: 1 }}
              />
              <TouchableOpacity
                style={[s.regenBtn, { borderColor: C.border, backgroundColor: C.surface }]}
                onPress={() =>
                  Alert.alert(
                    'Re-generate Report?',
                    'This creates a new PDF and replaces the current one on the server. Continue?',
                    [
                      { text: 'Cancel', style: 'cancel' },
                      { text: 'Re-generate', style: 'destructive',
                        onPress: () => router.push(`/jobs/${jobId}/preview` as never) },
                    ]
                  )
                }
              >
                <MaterialCommunityIcons name="refresh" size={22} color={C.textSecondary} />
              </TouchableOpacity>
            </View>
          </View>
        ) : (
          // ── No report yet: generate & upload for the first time
          <Button
            title="Generate & Upload PDF"
            onPress={() => router.push(`/jobs/${jobId}/preview` as never)}
            icon={<MaterialCommunityIcons name="cloud-upload-outline" size={20} color="#FFF" />}
            style={{ height: 54, borderRadius: 27 }}
          />
        )}
      </View>
    </View>
  );
}


// ─── Styles ────────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  screen:  { flex: 1 },
  center:  { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24 },

  loadingText: { marginTop: 12, fontSize: 14 },

  // Error
  errorIcon:  { marginBottom: 12 },
  errorTitle: { fontSize: 17, fontWeight: '700', marginBottom: 6, textAlign: 'center' },
  errorSub:   { fontSize: 13, textAlign: 'center', lineHeight: 20 },

  scrollContent: { padding: 16, paddingBottom: 140 },

  // Compliance badge in header
  complianceBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    paddingHorizontal: 10, paddingVertical: 5,
    borderRadius: 10, borderWidth: 1,
  },
  complianceTxt: { fontSize: 9.5, fontWeight: '900', letterSpacing: 0.8 },

  // Property card
  propertyCard: {
    flexDirection: 'row',
    borderRadius: 16, borderWidth: 1,
    overflow: 'hidden', marginBottom: 20,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06, shadowRadius: 8, elevation: 3,
  },
  propertyAccent: { width: 4 },
  propertyBody:   { flex: 1, padding: 14 },
  propertyName:   { fontSize: 16, fontWeight: '800', marginBottom: 3 },
  propertyAddress:{ fontSize: 12, lineHeight: 17 },
  propertyDivider:{ height: 1, marginVertical: 10 },
  propertyMeta:   { gap: 5 },
  metaItem:       { flexDirection: 'row', alignItems: 'center', gap: 6 },
  metaText:       { fontSize: 12 },
  metaValue:      { fontWeight: '700' },

  // Section headings
  sectionLabel: { fontSize: 10, fontWeight: '800', letterSpacing: 0.8, marginBottom: 8 },
  sectionHeader:{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 },
  countChip:    { borderRadius: 10, paddingHorizontal: 8, paddingVertical: 2 },
  countChipTxt: { fontSize: 11, fontWeight: '800' },

  // Stats
  statsRow:     { flexDirection: 'row', gap: 10, marginBottom: 10 },
  statCard:     {
    flex: 1, borderRadius: 14, padding: 12,
    alignItems: 'center', borderWidth: 1,
    shadowColor: '#0D1526', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05, shadowRadius: 8, elevation: 2,
  },
  statIconWrap: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center', marginBottom: 8 },
  statVal:      { fontSize: 22, fontWeight: '900', marginBottom: 1 },
  statLabel:    { fontSize: 10, fontWeight: '700', letterSpacing: 0.3 },

  // Progress bar
  progressWrap: {
    borderRadius: 12, borderWidth: 1,
    padding: 12, marginBottom: 20,
    gap: 8,
  },
  progressBarTrack: {
    flexDirection: 'row', height: 6, borderRadius: 3, overflow: 'hidden', backgroundColor: '#F1F5F9',
  },
  progressSegment:  { borderRadius: 3 },
  progressLabel:    { fontSize: 11, fontWeight: '500' },

  // Asset table
  tableCard: {
    borderRadius: 14, borderWidth: 1, overflow: 'hidden', marginBottom: 20,
  },
  assetRow: {
    flexDirection: 'row', alignItems: 'center',
    paddingVertical: 12, paddingHorizontal: 14, gap: 10,
  },
  assetIndexBadge: {
    width: 28, height: 28, borderRadius: 14,
    alignItems: 'center', justifyContent: 'center',
  },
  assetIndexText: { fontSize: 10, fontWeight: '800' },
  assetMiddle:    { flex: 1 },
  assetName:      { fontSize: 13, fontWeight: '700' },
  assetLoc:       { fontSize: 10.5, marginTop: 2 },
  defectReasonRow:{ flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 4 },
  defectReasonTxt:{ fontSize: 11, fontWeight: '600', color: '#DC2626', flex: 1 },
  resultPill:     { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20, borderWidth: 1 },
  resultPillTxt:  { fontSize: 10, fontWeight: '800', letterSpacing: 0.5 },

  // Empty state
  emptyState: { alignItems: 'center', padding: 28, gap: 8 },
  emptyText:  { fontSize: 13 },

  // Defects
  defectList: { gap: 10, marginBottom: 20 },
  defectCard: {
    borderRadius: 14, borderWidth: 1,
    flexDirection: 'row', overflow: 'hidden',
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04, shadowRadius: 6, elevation: 1,
  },
  defectStripe:  { width: 4 },
  defectContent: { flex: 1, padding: 12 },
  defectHeaderRow: { flexDirection: 'row', gap: 7, marginBottom: 8, alignItems: 'center', flexWrap: 'wrap' },
  sevBadge:     {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: 8, paddingVertical: 3,
    borderRadius: 8, borderWidth: 1,
  },
  sevBadgeTxt:  { fontSize: 9.5, fontWeight: '800' },
  statusBadge:  {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: 8, paddingVertical: 3,
    borderRadius: 8, borderWidth: 1,
  },
  statusDot:     { width: 6, height: 6, borderRadius: 3 },
  statusBadgeTxt:{ fontSize: 9.5, fontWeight: '700' },
  defectDesc:   { fontSize: 13, lineHeight: 18.5, marginBottom: 6 },
  defectMetaRow:{ flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 6 },
  defectMeta:   { fontSize: 11 },
  codeChip:     { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6, borderWidth: 1 },
  codeChipTxt:  { fontSize: 9.5, fontWeight: '800' },
  defectPrice:  { fontSize: 11, fontWeight: '700' },

  // No defects
  noDefectsCard: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    padding: 16, borderRadius: 14, borderWidth: 1, marginBottom: 20,
  },
  noDefectsText: { fontSize: 14, fontWeight: '700', flex: 1 },

  // Checklist
  checklistCard: {
    borderRadius: 14, borderWidth: 1, overflow: 'hidden', marginBottom: 20,
  },
  checklistRow:    { flexDirection: 'row', alignItems: 'center', padding: 14, gap: 12 },
  checklistDivider:{ height: 1 },
  checkDot:        { width: 10, height: 10, borderRadius: 5 },
  checklistTitle:  { fontSize: 13, fontWeight: '600' },
  checklistSub:    { fontSize: 11.5, marginTop: 3 },
  sigImageBox:     { borderRadius: 10, borderWidth: 1.5, overflow: 'hidden', marginTop: 10, height: 80 },
  sigImage:        { width: '100%', height: '100%' },

  // Signature CTA
  signatureCTA: {
    backgroundColor: '#FFF5F5',
    borderRadius: 16, borderWidth: 1.5,
    padding: 18, marginBottom: 20,
    alignItems: 'center',
  },
  ctaTitle: { fontSize: 16, fontWeight: '800', marginBottom: 6, textAlign: 'center' },
  ctaSub:   { fontSize: 13, lineHeight: 19, textAlign: 'center' },

  // Bottom bar
  bottomBar: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    padding: 16,
    paddingBottom: Platform.OS === 'ios' ? 34 : 20,
    borderTopWidth: 1, gap: 8,
    shadowColor: '#000', shadowOffset: { width: 0, height: -3 },
    shadowOpacity: 0.06, shadowRadius: 8, elevation: 8,
  },
  warningBanner: {
    flexDirection: 'row', alignItems: 'center', gap: 7,
    padding: 9, borderRadius: 10, borderWidth: 1,
  },
  warningText: { fontSize: 12, fontWeight: '600', color: '#D97706', flex: 1 },

  // Existing report (small badge, kept for reference styles)
  reportUploadedBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 7,
    padding: 9, borderRadius: 10, borderWidth: 1,
  },
  reportUploadedText: { fontSize: 12, fontWeight: '600', flex: 1 },

  // Prominent uploaded notification banner
  uploadedBanner: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    padding: 12, borderRadius: 14, borderWidth: 1.5,
  },
  uploadedIconWrap: {
    width: 36, height: 36, borderRadius: 18,
    alignItems: 'center', justifyContent: 'center', flexShrink: 0,
  },
  uploadedTitle: { fontSize: 13, fontWeight: '800', marginBottom: 2 },
  uploadedSub:   { fontSize: 11, fontWeight: '500', lineHeight: 15 },
  uploadedOpenBtn: {
    width: 32, height: 32, borderRadius: 16,
    alignItems: 'center', justifyContent: 'center', flexShrink: 0,
  },

  // Re-generate icon button
  regenBtn: {
    width: 52, height: 52, borderRadius: 26, borderWidth: 1,
    alignItems: 'center', justifyContent: 'center',
  },
});
