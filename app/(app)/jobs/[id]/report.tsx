import React, { useEffect, useState } from 'react';
import { View, StyleSheet, ScrollView, Alert, Platform, Image, TouchableOpacity } from 'react-native';
import { Text, ActivityIndicator } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import * as Sharing from 'expo-sharing';
import { getJobById, getAssetsWithJobResults, getDefectsForJob, getSignatureForJob, getRecord } from '@/lib/database';
import { generateJobReport } from '@/lib/pdfGenerator';
import { useColors } from '@/hooks/useColors';
import { ScreenHeader, Button, SectionTitle, Card } from '@/components/ui';
import Animated, { FadeInDown, FadeIn } from 'react-native-reanimated';
import Toast from 'react-native-toast-message';
import { formatAssetType, getAssetEmoji } from '@/utils/assetHelpers';
import { DefectSeverity } from '@/constants/Enums';
import type { Defect, Signature } from '@/types';
import { getValidLocalUri } from '@/utils/fileHelpers';

type MCIcon = React.ComponentProps<typeof MaterialCommunityIcons>['name'];

// Flat job+property type returned by getJobById JOIN query
type JobWithProperty = {
  id: string; property_id: string; assigned_to: string;
  job_type: string; status: string; scheduled_date: string;
  scheduled_time: string | null; priority: string; notes: string | null;
  property_name: string | null; property_address: string | null;
  property_suburb: string | null; property_state: string | null;
  site_contact_name: string | null;
};

// Asset with its inspection result for this job (returned by getAssetsWithJobResults JOIN)
type ReportAsset = {
  id: string; asset_type: string; location_on_site: string | null;
  result: string | null; defect_reason: string | null;
  technician_notes: string | null; is_compliant: number | boolean;
};

const SEVERITY_CONFIG: Record<string, { color: string; label: string; icon: MCIcon }> = {
  [DefectSeverity.Critical]: { color: '#DC2626', label: 'Critical', icon: 'alert-circle' },
  [DefectSeverity.Major]:    { color: '#EA580C', label: 'Major',    icon: 'alert' },
  [DefectSeverity.Minor]:    { color: '#2563EB', label: 'Minor',    icon: 'information' },
};

export default function ReportScreen() {
  const C = useColors();
  const { id: jobId } = useLocalSearchParams<{ id: string }>();

  const [job, setJob]             = useState<JobWithProperty | null>(null);
  const [assets, setAssets]       = useState<ReportAsset[]>([]);
  const [defects, setDefects]     = useState<Defect[]>([]);
  const [signature, setSignature] = useState<Signature | null>(null);
  const [techName, setTechName]   = useState<string>('Field Technician');
  const [isLoading, setIsLoading]         = useState(true);
  const [loadError, setLoadError]         = useState<string | null>(null);
  const [isGenerating, setIsGenerating]   = useState(false);
  const [progressStage, setProgressStage] = useState<string>('');
  // Cache the generated PDF URI — avoids re-generating on every tap
  const [generatedPdfUri, setGeneratedPdfUri] = useState<string | null>(null);



  useEffect(() => {
    if (!jobId) return;
    try {
      const j = getJobById<JobWithProperty>(jobId);
      if (j) {
        setJob(j);
        // BUG 25: getDefectsForJob already JOINs assets and returns asset_type
        setAssets(getAssetsWithJobResults(jobId, (j as any).property_id as string));
        setDefects(getDefectsForJob(jobId));
        setSignature(getSignatureForJob(jobId));
        // Fetch technician full name from local users table
        const tech = getRecord<{ full_name: string }>('users', (j as any).assigned_to as string);
        if (tech?.full_name) setTechName(tech.full_name);
      } else {
        // BUG 35 FIX: explicit error state when job is not found
        setLoadError('Job data not found. It may have been deleted or not yet synced.');
      }
    } catch (e) {
      console.error(e);
      // BUG 35 FIX: set loadError so we render an error state, not silently empty UI
      setLoadError('Failed to load job data. Please go back and try again.');
    } finally {
      setIsLoading(false);
    }
  }, [jobId]);

  const STAGE_LABELS: Record<string, string> = {
    fetching_data:     'Loading job data…',
    processing_photos: 'Encoding photos…',
    building_html:     'Building report…',
    generating_pdf:    'Generating PDF…',
    sharing:           'Opening share sheet…',
  };

  const handleGenerate = async () => {
    // If already generated this session, just re-share — no need to rebuild
    if (generatedPdfUri) {
      try {
        if (await Sharing.isAvailableAsync()) {
          await Sharing.shareAsync(generatedPdfUri, { mimeType: 'application/pdf', dialogTitle: 'Share Inspection Report', UTI: 'com.adobe.pdf' });
        }
      } catch { /* ignore */ }
      return;
    }
    setIsGenerating(true);
    setProgressStage('Starting…');
    try {
      const uri = await generateJobReport(jobId, (stage) => {
        setProgressStage(STAGE_LABELS[stage] ?? stage);
      });
      setGeneratedPdfUri(uri);
      Toast.show({ type: 'success', text1: '✅ PDF Exported Successfully!' });
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Unknown error';
      console.error('Failed to generate PDF:', e);
      Alert.alert('Export Failed', 'There was a problem generating the PDF.\n\n' + msg);
    } finally {
      setIsGenerating(false);
      setProgressStage('');
    }
  };

  if (isLoading) {
    return <View style={[s.center, { backgroundColor: C.background }]}><ActivityIndicator color={C.primary} size="large" /></View>;
  }

  // BUG 35 FIX: show explicit error state instead of silently empty screen
  if (loadError) {
    return (
      <View style={[s.center, { backgroundColor: C.background }]}>
        <Text style={{ fontSize: 40 }}>⚠️</Text>
        <Text style={{ marginTop: 10, color: C.error, textAlign: 'center', paddingHorizontal: 32 }}>{loadError}</Text>
        <View style={{ marginTop: 16 }}><Button title="Go Back" onPress={() => router.back()} /></View>
      </View>
    );
  }

  if (!job) {
    return (
      <View style={[s.center, { backgroundColor: C.background }]}>
        <Text style={{ fontSize: 40 }}>📄</Text>
        <Text style={{ marginTop: 10, color: C.textSecondary }}>Report data not found</Text>
        <View style={{ marginTop: 16 }}><Button title="Go Back" onPress={() => router.back()} /></View>
      </View>
    );
  }

  const passCount  = assets.filter((a: any) => a.result === 'pass').length;
  const failCount  = assets.filter((a: any) => a.result === 'fail').length;
  const ntCount    = assets.filter((a: any) => a.result === 'not_tested').length;
  // Compliant only when at least one asset was inspected and none failed
  const isCompliant = assets.length > 0 && passCount > 0 && failCount === 0;

  return (
    <View style={[s.screen, { backgroundColor: C.background }]}>

      {/* ── REPORT HEADER ──── */}
      <ScreenHeader
        eyebrow="INSPECTION REPORT"
        title={job.property_name ?? 'Inspection Report'}
        subtitle={job.scheduled_date
          ? new Date(job.scheduled_date + 'T00:00:00').toLocaleDateString('en-AU', {
              weekday: 'short', day: 'numeric', month: 'short', year: 'numeric',
            })
          : 'Not scheduled'
        }
        showBack={true}
        curved={false}
        rightComponent={
          <View style={[s.complianceBanner, {
            backgroundColor: isCompliant ? 'rgba(74,222,128,0.2)' : 'rgba(239,68,68,0.2)',
            borderColor: isCompliant ? 'rgba(74,222,128,0.4)' : 'rgba(239,68,68,0.4)',
          }]}>
            <MaterialCommunityIcons name={isCompliant ? 'shield-check' : 'shield-alert'} size={14} color={isCompliant ? '#4ADE80' : '#FCA5A5'} />
            <Text style={[s.heroStatus, { color: isCompliant ? '#4ADE80' : '#FCA5A5' }]}>
              {isCompliant ? 'COMPLIANT' : 'NON-COMPLIANT'}
            </Text>
          </View>
        }
      />

      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 130 }} showsVerticalScrollIndicator={false}>

        {/* Meta card — property info + Fix 5B technician name */}
        <Animated.View entering={FadeInDown.delay(80).duration(380)}>
          <Card style={s.metaCard}>
            <Text style={[s.metaTitle, { color: C.text }]}>{job.property_name ?? 'Unknown Site'}</Text>
            <Text style={[s.metaSub, { color: C.textSecondary }]}>
              {job.property_address
                ? [job.property_address, job.property_suburb, job.property_state].filter(Boolean).join(', ')
                : 'Address not listed'}
            </Text>
            <View style={[s.divider, { backgroundColor: C.border }]} />
            <View style={s.metaRow}>
              <MaterialCommunityIcons name="account-hard-hat-outline" size={15} color={C.textSecondary} />
              <Text style={[s.metaRowTxt, { color: C.textSecondary }]}>
                Technician: <Text style={{ color: C.text, fontWeight: '700' }}>{techName}</Text>
              </Text>
            </View>
            <View style={s.metaRow}>
              <MaterialCommunityIcons name="calendar-check-outline" size={15} color={C.textSecondary} />
              <Text style={[s.metaRowTxt, { color: C.textSecondary }]}>
                Date: <Text style={{ color: C.text, fontWeight: '700' }}>{job.scheduled_date}</Text>
              </Text>
            </View>
          </Card>
        </Animated.View>

        {/* Stat grid */}
        <Animated.View entering={FadeInDown.delay(140).duration(380)}>
          <SectionTitle title="Inspection Outcomes" />
          <View style={s.statsGrid}>
            <View style={[s.statCard, { backgroundColor: C.surface, borderColor: C.border }]}>
              <View style={[s.statIconWrap, { backgroundColor: C.textTertiary + '20' }]}>
                <MaterialCommunityIcons name="tools" size={20} color={C.textSecondary} />
              </View>
              <Text style={[s.statVal, { color: C.text }]}>{assets.length}</Text>
              <Text style={[s.statLabel, { color: C.textSecondary }]}>Total</Text>
            </View>
            <View style={[s.statCard, { backgroundColor: C.surface, borderColor: C.border }]}>
              <View style={[s.statIconWrap, { backgroundColor: C.success + '20' }]}>
                <MaterialCommunityIcons name="check-circle" size={20} color={C.success} />
              </View>
              <Text style={[s.statVal, { color: C.success }]}>{passCount}</Text>
              <Text style={[s.statLabel, { color: C.textSecondary }]}>Passed</Text>
            </View>
            <View style={[s.statCard, { backgroundColor: C.surface, borderColor: C.border }]}>
              <View style={[s.statIconWrap, { backgroundColor: C.error + '20' }]}>
                <MaterialCommunityIcons name="close-circle" size={20} color={C.error} />
              </View>
              <Text style={[s.statVal, { color: C.error }]}>{failCount}</Text>
              <Text style={[s.statLabel, { color: C.textSecondary }]}>Failed</Text>
            </View>
            {ntCount > 0 && (
              <View style={[s.statCard, { backgroundColor: C.surface, borderColor: C.border }]}>
                <View style={[s.statIconWrap, { backgroundColor: C.backgroundTertiary }]}>
                  <MaterialCommunityIcons name="minus-circle-outline" size={20} color={C.textTertiary} />
                </View>
                <Text style={[s.statVal, { color: C.textTertiary }]}>{ntCount}</Text>
                <Text style={[s.statLabel, { color: C.textSecondary }]}>N/T</Text>
              </View>
            )}
          </View>
        </Animated.View>

        {/* Fix 5C — Per-asset results table */}
        <Animated.View entering={FadeInDown.delay(200).duration(380)}>
          <SectionTitle title="Asset Inspection Results" count={assets.length} />
          <Card noPadding style={{ marginBottom: 24 }}>
            {assets.length === 0 ? (
              <View style={s.emptyInCard}>
                <Text style={[s.emptyText, { color: C.textTertiary }]}>No assets tested</Text>
              </View>
            ) : (
              assets.map((asset: any, i: number) => {
                const isPass = asset.result === 'pass';
                const isFail = asset.result === 'fail';
                const resultColor = isPass ? C.success : isFail ? C.error : '#64748B';
                const resultBg    = isPass ? (C.successLight ?? C.success + '18') : isFail ? (C.errorLight ?? C.error + '18') : '#F1F5F9';
                const resultLabel = isPass ? '✅ Pass' : isFail ? '❌ Fail' : '⬜ N/T';
                return (
                  <View
                    key={asset.id}
                    style={[
                      s.assetRow,
                      i < assets.length - 1 && [s.assetRowBorder, { borderBottomColor: C.border }],
                      isFail && { backgroundColor: C.errorLight ?? (C.error + '0A') },
                    ]}
                  >
                    <Text style={s.assetEmoji}>{getAssetEmoji(asset.asset_type)}</Text>
                    <View style={{ flex: 1 }}>
                      <Text style={[s.assetName, { color: C.text }]}>{formatAssetType(asset.asset_type)}</Text>
                      {asset.location_on_site ? <Text style={[s.assetLoc, { color: C.textSecondary }]}>{asset.location_on_site}</Text> : null}
                      {isFail && asset.defect_reason ? <Text style={[s.defectReasonTxt, { color: C.error }]}>⚠️ {asset.defect_reason}</Text> : null}
                    </View>
                    <View style={[s.resultPill, { backgroundColor: resultBg }]}>
                      <Text style={[s.resultPillTxt, { color: resultColor }]}>{resultLabel}</Text>
                    </View>
                  </View>
                );
              })
            )}
          </Card>
        </Animated.View>

        {/* Fix 5D — Defects list section */}
        <Animated.View entering={FadeInDown.delay(260).duration(380)}>
          <SectionTitle title="Defects Identified" count={defects.length} />
          {defects.length === 0 ? (
            <Card style={[s.noDefCard, { backgroundColor: C.successLight ?? (C.success + '15'), borderColor: C.success + '30', borderWidth: 1 }]}>
              <MaterialCommunityIcons name="shield-check-outline" size={22} color={C.success} />
              <Text style={[s.noDefTxt, { color: C.successDark ?? C.success }]}>No defects recorded — great work!</Text>
            </Card>
          ) : (
            <Card noPadding style={{ marginBottom: 24 }}>
              {defects.map((defect: any, i: number) => {
                const sev = SEVERITY_CONFIG[defect.severity as DefectSeverity] ?? SEVERITY_CONFIG[DefectSeverity.Minor];
                return (
                  <View
                    key={defect.id}
                    style={[s.defectRow, i < defects.length - 1 && [s.defectRowBorder, { borderBottomColor: C.border }]]}
                  >
                    <View style={[s.defectBar, { backgroundColor: sev.color }]} />
                    <View style={{ flex: 1, paddingHorizontal: 12 }}>
                      <View style={s.defectTopRow}>
                        <View style={[s.sevBadge, { backgroundColor: sev.color + '18' }]}>
                          <MaterialCommunityIcons name={sev.icon} size={12} color={sev.color} />
                          <Text style={[s.sevBadgeTxt, { color: sev.color }]}>{sev.label.toUpperCase()}</Text>
                        </View>
                        <View style={[s.statusPill, { backgroundColor: defect.status === 'open' ? C.warning + '20' : C.success + '20' }]}>
                          <Text style={[s.statusPillTxt, { color: defect.status === 'open' ? C.warning : C.success }]}>
                            {defect.status?.toUpperCase().replace('_', ' ') ?? 'OPEN'}
                          </Text>
                        </View>
                      </View>
                      <Text style={[s.defectDesc, { color: C.text }]}>{defect.description}</Text>
                      {defect.asset_type || defect.defect_code ? (
                        <View style={{ flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 6, marginTop: 4 }}>
                          {defect.asset_type && (
                            <Text style={[s.defectAsset, { color: C.textSecondary, marginTop: 0 }]}>
                              {getAssetEmoji(defect.asset_type)} {formatAssetType(defect.asset_type)}
                            </Text>
                          )}
                          {defect.defect_code && (
                            <View style={[s.reportCodeBadge, { backgroundColor: C.primary + '15', borderColor: C.primary + '30' }]}>
                              <Text style={[s.reportCodeTxt, { color: C.primary }]}>{defect.defect_code.toUpperCase()}</Text>
                            </View>
                          )}
                          {defect.quote_price != null && (
                            <Text style={[s.reportPriceTxt, { color: '#10B981' }]}>
                              • Ref: ${defect.quote_price}
                            </Text>
                          )}
                        </View>
                      ) : null}
                    </View>
                  </View>
                );
              })}
            </Card>
          )}
        </Animated.View>

        {/* Documentation checklist */}
        <Animated.View entering={FadeInDown.delay(320).duration(380)}>
          <SectionTitle title="Documentation Checklist" />
          <Card noPadding style={{ marginBottom: 24 }}>
            <View style={s.checklistItem}>
              <View style={[s.checkDot, { backgroundColor: defects.length > 0 ? C.warning : C.success }]} />
              <Text style={[s.checklistTxt, { color: C.text }]}>
                {defects.length === 0 ? 'No defects recorded' : `${defects.length} defect(s) logged on site`}
              </Text>
            </View>
            <View style={[s.dividerLine, { backgroundColor: C.border }]} />
            <View style={[s.checklistItem, { alignItems: 'flex-start' }]}>
              <View style={[s.checkDot, { backgroundColor: signature ? C.success : C.error, marginTop: 4 }]} />
              <View style={{ flex: 1 }}>
                <Text style={[s.checklistTxt, { color: C.text }]}>
                  {signature ? 'Client Signature captured' : 'Missing Client Signature'}
                </Text>
                {signature && (
                  <Text style={[s.checklistSub, { color: C.textSecondary }]}>Signed by: {signature.signed_by_name}</Text>
                )}
                {signature?.signature_url && (
                  <View style={[s.sigImageBox, { backgroundColor: C.backgroundTertiary, borderColor: C.border }]}>
                    <Image
                      source={{ uri: getValidLocalUri(signature.signature_url) }}
                      style={s.sigImage}
                      resizeMode="contain"
                    />
                  </View>
                )}
              </View>
            </View>
          </Card>
        </Animated.View>

        {!signature && (
          <Animated.View entering={FadeIn.delay(500)}>
            <View style={[s.signatureCTA, { backgroundColor: C.error + '10', borderColor: C.error + '40', borderWidth: 1 }]}>
              <View style={s.sigCopy}>
                <Text style={[s.sigCTATitle, { color: C.text }]}>Action Required</Text>
                <Text style={[s.sigCTASub, { color: C.textSecondary }]}>
                  Generating compliance reports without a signature violates industry standards.
                </Text>
              </View>
              <Button
                title="Capture Signature"
                onPress={() => router.push(`/jobs/${jobId}/signature` as never)}
                icon={<MaterialCommunityIcons name="pen" size={16} color="#FFFFFF" />}
                style={{ borderRadius: 20 }}
              />
            </View>
          </Animated.View>
        )}

      </ScrollView>

      <View style={[s.bottomBar, { backgroundColor: C.surface, borderTopColor: C.border }]}>
        {assets.filter((a: any) => a.result !== null).length === 0 && (
          <Text style={[s.exportWarning, { color: C.warning }]}>
            ⚠️  No assets have been inspected. The PDF will be empty.
          </Text>
        )}
        {isGenerating && progressStage ? (
          <Text style={[s.progressLabel, { color: C.textSecondary }]}>{progressStage}</Text>
        ) : null}
        {generatedPdfUri ? (
          <View style={{ gap: 8 }}>
            <Button
              title="Share PDF"
              onPress={handleGenerate}
              icon={<MaterialCommunityIcons name="share-variant" size={20} color="#FFF" />}
              style={{ height: 56, borderRadius: 28 }}
            />
            <TouchableOpacity
              style={s.regenBtn}
              onPress={() => { setGeneratedPdfUri(null); }}
              activeOpacity={0.7}
            >
              <MaterialCommunityIcons name="refresh" size={14} color={C.textSecondary} />
              <Text style={[s.regenTxt, { color: C.textSecondary }]}>Re-generate PDF</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <Button
            title={isGenerating ? 'Generating PDF…' : 'Compile & Export PDF'}
            onPress={handleGenerate}
            disabled={isGenerating}
            isLoading={isGenerating}
            icon={!isGenerating ? <MaterialCommunityIcons name="export-variant" size={20} color="#FFF" /> : undefined}
            style={{ height: 56, borderRadius: 28 }}
          />
        )}
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  screen: { flex: 1 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },

  // Hero
  heroStatus:       { fontSize: 10, fontWeight: '900', letterSpacing: 1 },
  complianceBanner: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 10, borderWidth: 1 },

  // Meta card
  metaCard:    { marginBottom: 20, gap: 8 },
  metaTitle:   { fontSize: 18, fontWeight: '800' },
  metaSub:     { fontSize: 13 },
  metaRow:     { flexDirection: 'row', alignItems: 'center', gap: 8 },
  metaRowTxt:  { fontSize: 13 },
  divider:     { height: 1, marginVertical: 8 },

  // Stat grid
  statsGrid:   { flexDirection: 'row', gap: 12, marginBottom: 26, flexWrap: 'wrap' },
  statCard:    { flex: 1, minWidth: 70, borderRadius: 16, padding: 16, alignItems: 'center', borderWidth: 1, shadowColor: '#0D1526', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.08, shadowRadius: 12, elevation: 4 },
  statIconWrap:{ width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', marginBottom: 10 },
  statVal:     { fontSize: 24, fontWeight: '800', marginBottom: 2 },
  statLabel:   { fontSize: 11, fontWeight: '700', letterSpacing: 0.2 },

  // Asset table (5C)
  assetRow:       { flexDirection: 'row', alignItems: 'center', paddingVertical: 14, paddingHorizontal: 16, gap: 10 },
  assetRowBorder: { borderBottomWidth: 1 },
  assetEmoji:     { fontSize: 20, width: 28, textAlign: 'center' },
  assetName:      { fontSize: 13, fontWeight: '700' },
  assetLoc:       { fontSize: 11, marginTop: 2 },
  defectReasonTxt:{ fontSize: 11, marginTop: 3, fontWeight: '600' },
  resultPill:     { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12 },
  resultPillTxt:  { fontSize: 11, fontWeight: '700' },
  emptyInCard:    { alignItems: 'center', paddingVertical: 24 },
  emptyText:      { fontSize: 14 },

  // Defect list (5D)
  defectRow:      { flexDirection: 'row', alignItems: 'stretch', paddingVertical: 12 },
  defectRowBorder:{ borderBottomWidth: 1 },
  defectBar:      { width: 4 },
  defectTopRow:   { flexDirection: 'row', gap: 8, marginBottom: 8, alignItems: 'center' },
  sevBadge:       { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8 },
  sevBadgeTxt:    { fontSize: 10, fontWeight: '700' },
  statusPill:     { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8 },
  statusPillTxt:  { fontSize: 10, fontWeight: '700' },
  defectDesc:     { fontSize: 13, lineHeight: 18, marginBottom: 4 },
  defectAsset:    { fontSize: 11 },
  reportCodeBadge: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6, borderWidth: 1 },
  reportCodeTxt: { fontSize: 10, fontWeight: '800' },
  reportPriceTxt: { fontSize: 11, fontWeight: '700' },

  // No-defect card
  noDefCard: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 26, padding: 18, borderRadius: 16 },
  noDefTxt:  { fontSize: 15, fontWeight: '800', flex: 1 },

  // Checklist
  checklistItem: { flexDirection: 'row', alignItems: 'center', padding: 16, gap: 12 },
  checkDot:      { width: 12, height: 12, borderRadius: 6, marginTop: 3 },
  checklistTxt:  { fontSize: 14, fontWeight: '600', flex: 1 },
  checklistSub:  { fontSize: 12, marginTop: 4 },
  dividerLine:   { height: 1 },

  // Signature CTA
  signatureCTA: { padding: 18, borderRadius: 16, marginBottom: 26, shadowColor: '#0D1526', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.08, shadowRadius: 12, elevation: 4 },
  sigCopy:      { marginBottom: 18 },
  sigCTATitle:  { fontSize: 18, fontWeight: '800', marginBottom: 6 },
  sigCTASub:    { fontSize: 14, lineHeight: 20 },

  // Signature image inside checklist
  sigImageBox: { borderRadius: 14, borderWidth: 1.5, overflow: 'hidden', marginTop: 12, height: 96 },
  sigImage:    { width: '100%', height: '100%' },

  bottomBar:     { position: 'absolute', bottom: 0, left: 0, right: 0, padding: 16, paddingBottom: Platform.OS === 'ios' ? 36 : 24, borderTopWidth: 1, gap: 8, shadowColor: '#000', shadowOffset: { width: 0, height: -4 }, shadowOpacity: 0.05, shadowRadius: 10, elevation: 10 },
  exportWarning: { fontSize: 12, textAlign: 'center', fontWeight: '600' },
  progressLabel: { fontSize: 12, textAlign: 'center', fontWeight: '500', letterSpacing: 0.2 },
  regenBtn:      { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 6 },
  regenTxt:      { fontSize: 12, fontWeight: '600' },
});
