// Property detail screen — compliance banner, full property info, asset register, job history
import { useCallback, useEffect, useState } from 'react';
import { Linking, ScrollView, StyleSheet, TouchableOpacity, View } from 'react-native';
import { ActivityIndicator, Text } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { router, useLocalSearchParams } from 'expo-router';
import Colors from '@/constants/Colors';
import { ComplianceStatus, AssetStatus, JobStatus, JobType } from '@/constants/Enums';
import { getRecord, getAssetsForProperty, getJobsForProperty } from '@/lib/database';
import type { Property, Asset, Job } from '@/types';
import { StatusBadge } from '@/components/jobs/StatusBadge';
import { JobTypeBadge } from '@/components/jobs/JobTypeBadge';

const NAVY   = '#0E2141';
const ORANGE = '#EA6C00';
const PAGE   = '#F2F5F9';
const WHITE  = '#FFFFFF';

// ─── Compliance banner config ──────────────────
const COMPLIANCE_CONFIG: Record<ComplianceStatus, {
  bg: string; text: string; icon: string; label: string;
}> = {
  [ComplianceStatus.Compliant]:    { bg: '#DCFCE7', text: '#14532D', icon: '✅', label: 'Compliant' },
  [ComplianceStatus.NonCompliant]: { bg: '#FEE2E2', text: '#7F1D1D', icon: '❌', label: 'Non-Compliant' },
  [ComplianceStatus.Overdue]:      { bg: '#991B1B', text: '#FFFFFF', icon: '🚨', label: 'Overdue — Action Required' },
  [ComplianceStatus.Pending]:      { bg: '#F1F5F9', text: '#475569', icon: '⏳', label: 'Compliance Pending' },
};

// ─── Asset type emoji ──────────────────────────
function assetIcon(type: string): string {
  const t = type.toLowerCase();
  if (t.includes('extinguisher'))     return '🧯';
  if (t.includes('sprinkler'))        return '💧';
  if (t.includes('door') || t.includes('exit')) return '🚪';
  if (t.includes('emergency') || t.includes('light')) return '🔋';
  if (t.includes('fire'))             return '🔥';
  if (t.includes('hose'))             return '🔴';
  return '❓';
}

type JobHistory = Job & {
  technician_name: string | null;
  property_name?: string;
};

export default function PropertyDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [property, setProperty] = useState<Property | null>(null);
  const [assets, setAssets] = useState<Asset[]>([]);
  const [jobHistory, setJobHistory] = useState<JobHistory[]>([]);
  const [isLoading, setIsLoading] = useState(true);

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

  useEffect(() => { load(); }, [load]);

  if (isLoading) {
    return (
      <View style={[s.screen, s.centered]}>
        <ActivityIndicator color={NAVY} size="large" />
      </View>
    );
  }

  if (!property) {
    return (
      <View style={[s.screen, s.centered]}>
        <MaterialCommunityIcons name="office-building-outline" size={44} color={ORANGE} />
        <Text style={s.notFound}>Property not found</Text>
        <TouchableOpacity style={s.backBtn} onPress={() => router.back()}>
          <Text style={s.backBtnTxt}>← Go Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const compliance = COMPLIANCE_CONFIG[property.compliance_status as ComplianceStatus]
    ?? COMPLIANCE_CONFIG[ComplianceStatus.Pending];
  const today = new Date().toISOString().slice(0, 10);

  return (
    <View style={s.screen}>
      {/* Header */}
      <View style={s.header}>
        <TouchableOpacity style={s.back} onPress={() => router.back()}>
          <MaterialCommunityIcons name="arrow-left" size={22} color={WHITE} />
        </TouchableOpacity>
        <Text style={s.headerTitle} numberOfLines={1}>{property.name}</Text>
      </View>

      <ScrollView showsVerticalScrollIndicator={false}>
        {/* Compliance banner */}
        <View style={[s.complianceBanner, { backgroundColor: compliance.bg }]}>
          <Text style={s.complianceIcon}>{compliance.icon}</Text>
          <Text style={[s.complianceLabel, { color: compliance.text }]}>{compliance.label}</Text>
        </View>

        {/* Property info card */}
        <Animated.View entering={FadeInDown.delay(60).duration(350)} style={s.section}>
          <Text style={s.sectionTitle}>PROPERTY INFO</Text>
          <View style={s.card}>
            {/* Address */}
            <View style={s.infoRow}>
              <MaterialCommunityIcons name="map-marker-outline" size={18} color={NAVY} />
              <Text style={s.infoText}>
                {[property.address, property.suburb, property.state, property.postcode]
                  .filter(Boolean).join(', ')}
              </Text>
            </View>

            {/* Site contact */}
            {property.site_contact_name ? (
              <View style={s.divRow}>
                <View style={s.infoRow}>
                  <MaterialCommunityIcons name="account-outline" size={18} color={NAVY} />
                  <Text style={s.infoText}>{property.site_contact_name}</Text>
                </View>
                {property.site_contact_phone ? (
                  <TouchableOpacity
                    style={s.infoRow}
                    onPress={() => Linking.openURL(`tel:${property.site_contact_phone}`)}
                  >
                    <MaterialCommunityIcons name="phone-outline" size={18} color={ORANGE} />
                    <Text style={[s.infoText, { color: ORANGE, textDecorationLine: 'underline' }]}>
                      {property.site_contact_phone}
                    </Text>
                  </TouchableOpacity>
                ) : null}
              </View>
            ) : null}

            {/* Access notes */}
            {property.access_notes ? (
              <View style={[s.noteCard, { borderLeftColor: Colors.light.infoDark, backgroundColor: Colors.light.infoLight }]}>
                <Text style={[s.noteTitle, { color: Colors.light.infoDark }]}>🔑 Access Notes</Text>
                <Text style={s.noteBody}>{property.access_notes}</Text>
              </View>
            ) : null}

            {/* Hazard notes */}
            {property.hazard_notes ? (
              <View style={[s.noteCard, { borderLeftColor: Colors.light.errorDark, backgroundColor: Colors.light.errorLight }]}>
                <Text style={[s.noteTitle, { color: Colors.light.errorDark }]}>⚠️ Hazard Warning</Text>
                <Text style={s.noteBody}>{property.hazard_notes}</Text>
              </View>
            ) : null}
          </View>
        </Animated.View>

        {/* Asset register */}
        <Animated.View entering={FadeInDown.delay(120).duration(350)} style={s.section}>
          <Text style={s.sectionTitle}>ASSET REGISTER ({assets.length} ASSETS)</Text>
          <View style={s.card}>
            {assets.length === 0 ? (
              <View style={s.emptyInCard}>
                <MaterialCommunityIcons name="fire-extinguisher" size={32} color="#CBD5E1" />
                <Text style={s.emptyText}>No assets registered</Text>
              </View>
            ) : (
              assets.map((asset, i) => {
                const isOverdue = asset.next_service_date && asset.next_service_date < today;
                return (
                  <TouchableOpacity
                    key={asset.id}
                    style={[s.assetRow, i < assets.length - 1 && s.assetRowBorder]}
                    onPress={() => router.push(`/assets/${asset.id}` as never)}
                  >
                    <Text style={s.assetEmoji}>{assetIcon(asset.asset_type)}</Text>
                    <View style={{ flex: 1 }}>
                      <Text style={s.assetType}>{asset.asset_type}</Text>
                      {asset.location_on_site ? (
                        <Text style={s.assetLoc}>{asset.location_on_site}</Text>
                      ) : null}
                      <View style={s.assetDates}>
                        {asset.last_service_date ? (
                          <Text style={s.dateChip}>Last: {asset.last_service_date}</Text>
                        ) : null}
                        {asset.next_service_date ? (
                          <Text style={[s.dateChip, isOverdue && s.overdueDateChip]}>
                            {isOverdue ? '⚠️ ' : ''}Next: {asset.next_service_date}
                          </Text>
                        ) : null}
                      </View>
                    </View>
                    <View style={[s.statusDot, { backgroundColor: asset.status === AssetStatus.Active ? Colors.light.successDark : Colors.light.textTertiary }]} />
                    <MaterialCommunityIcons name="chevron-right" size={16} color="#CBD5E1" />
                  </TouchableOpacity>
                );
              })
            )}
          </View>
        </Animated.View>

        {/* Job history */}
        <Animated.View entering={FadeInDown.delay(180).duration(350)} style={s.section}>
          <Text style={s.sectionTitle}>RECENT JOBS</Text>
          <View style={s.card}>
            {jobHistory.length === 0 ? (
              <View style={s.emptyInCard}>
                <Text style={s.emptyText}>No previous jobs</Text>
              </View>
            ) : (
              jobHistory.map((job, i) => (
                <View key={job.id} style={[s.historyRow, i < jobHistory.length - 1 && s.historyRowBorder]}>
                  <View>
                    <Text style={s.historyDate}>{job.scheduled_date}</Text>
                    <JobTypeBadge jobType={job.job_type as JobType} />
                  </View>
                  <StatusBadge status={job.status as JobStatus} small />
                </View>
              ))
            )}
          </View>
        </Animated.View>

        <View style={{ height: 32 }} />
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  screen:  { flex: 1, backgroundColor: PAGE },
  centered:{ flex: 1, alignItems: 'center', justifyContent: 'center' },

  header:      { backgroundColor: NAVY, paddingTop: 52, paddingBottom: 16, paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center', gap: 12 },
  back:        { padding: 4 },
  headerTitle: { flex: 1, fontSize: 18, fontWeight: '700', color: WHITE },

  complianceBanner: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 20, paddingVertical: 14 },
  complianceIcon:   { fontSize: 20 },
  complianceLabel:  { fontSize: 15, fontWeight: '700' },

  section:      { paddingHorizontal: 16, paddingTop: 16 },
  sectionTitle: { fontSize: 11, fontWeight: '800', color: '#8896A8', letterSpacing: 1.2, textTransform: 'uppercase', marginBottom: 8 },

  card: { backgroundColor: WHITE, borderRadius: 14, padding: 14, gap: 12, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 6, elevation: 3 },

  infoRow:  { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  infoText: { fontSize: 14, color: Colors.light.text, flex: 1, lineHeight: 20 },
  divRow:   { gap: 8 },

  noteCard:  { borderLeftWidth: 3, borderRadius: 8, padding: 10, gap: 4 },
  noteTitle: { fontSize: 12, fontWeight: '700' },
  noteBody:  { fontSize: 12, color: Colors.light.textSecondary, lineHeight: 18 },

  assetRow:       { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 10 },
  assetRowBorder: { borderBottomWidth: 1, borderBottomColor: '#F3F5F8' },
  assetEmoji:     { fontSize: 22, width: 30, textAlign: 'center' },
  assetType:      { fontSize: 14, fontWeight: '600', color: Colors.light.text },
  assetLoc:       { fontSize: 12, color: Colors.light.textSecondary, marginTop: 1 },
  assetDates:     { flexDirection: 'row', gap: 8, marginTop: 4 },
  dateChip:       { fontSize: 10, color: Colors.light.textTertiary, backgroundColor: '#F3F5F8', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 },
  overdueDateChip:{ color: Colors.light.errorDark, backgroundColor: Colors.light.errorLight },
  statusDot:      { width: 8, height: 8, borderRadius: 4 },

  historyRow:       { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 10 },
  historyRowBorder: { borderBottomWidth: 1, borderBottomColor: '#F3F5F8' },
  historyDate:      { fontSize: 13, fontWeight: '600', color: Colors.light.text, marginBottom: 4 },

  emptyInCard: { alignItems: 'center', gap: 8, paddingVertical: 16 },
  emptyText:   { fontSize: 14, color: Colors.light.textTertiary },

  notFound:   { fontSize: 16, color: Colors.light.textSecondary, marginTop: 12 },
  backBtn:    { marginTop: 16, paddingHorizontal: 24, paddingVertical: 12, backgroundColor: NAVY, borderRadius: 10 },
  backBtnTxt: { color: WHITE, fontWeight: '700' },
});
