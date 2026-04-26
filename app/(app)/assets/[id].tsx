// Asset detail screen — asset info, service history, defect history
import { useCallback, useEffect, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { ActivityIndicator, Text } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { router, useLocalSearchParams } from 'expo-router';
import { useColors } from '@/hooks/useColors';
import { AssetStatus, InspectionResult, DefectSeverity } from '@/constants/Enums';
import { getRecord, getServiceHistoryForAsset, getDefectsForAsset } from '@/lib/database';
import { ScreenHeader, EmptyState, SectionTitle, Card } from '@/components/ui';
import type { Asset, Defect } from '@/types';
import { formatAssetType } from '@/utils/assetHelpers';

type ServiceRecord = {
  id: string;
  job_id: string;
  asset_id: string;
  result: InspectionResult | null;
  technician_notes: string | null;
  actioned_at: string | null;
  scheduled_date: string | null;
  job_type: string | null;
  job_status: string | null;
  technician_name: string | null;
};

const getResultConfig = (C: any): Record<InspectionResult, { icon: string; color: string; label: string }> => ({
  [InspectionResult.Pass]:      { icon: '✅', color: C.successDark || C.success, label: 'Pass' },
  [InspectionResult.Fail]:      { icon: '❌', color: C.errorDark || C.error,   label: 'Fail' },
  [InspectionResult.NotTested]: { icon: '⬜', color: C.textTertiary, label: 'Not Tested' },
});

const getSeverityConfig = (C: any): Record<DefectSeverity, { color: string }> => ({
  [DefectSeverity.Critical]: { color: C.error },
  [DefectSeverity.Major]:    { color: C.warning },
  [DefectSeverity.Minor]:    { color: C.info },
});

function InfoRow({ icon, label, value, mono = false, C }: { icon: string; label: string; value: string; mono?: boolean, C: any }) {
  return (
    <View style={s.infoRow}>
      <Text style={s.infoIcon}>{icon}</Text>
      <View style={{ flex: 1 }}>
        <Text style={[s.infoLabel, { color: C.textTertiary }]}>{label}</Text>
        <Text style={[s.infoValue, { color: C.text }, mono && s.mono]}>{value}</Text>
      </View>
    </View>
  );
}

export default function AssetDetailScreen() {
  const C = useColors();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [asset, setAsset] = useState<Asset | null>(null);
  const [serviceHistory, setServiceHistory] = useState<ServiceRecord[]>([]);
  const [defects, setDefects] = useState<Defect[]>([]);
  const [isLoading, setIsLoading] = useState(true);



  const load = useCallback(() => {
    if (!id) return;
    setIsLoading(true);
    try {
      const a = getRecord<Asset>('assets', id);
      setAsset(a);
      if (a) {
        setServiceHistory(getServiceHistoryForAsset<ServiceRecord>(id, 5));
        setDefects(getDefectsForAsset<Defect>(id));
      }
    } catch (err) {
      console.error('[AssetDetail] load error:', err);
    } finally {
      setIsLoading(false);
    }
  }, [id]);

  useEffect(() => { load(); }, [load]);

  if (isLoading) {
    return (
      <View style={[s.screen, s.centered, { backgroundColor: C.background }]}>
        <ActivityIndicator color={C.primary} size="large" />
      </View>
    );
  }

  if (!asset) {
    return (
      <View style={[s.screen, { backgroundColor: C.background }]}>
        <ScreenHeader curved={false} title="Not Found" showBack={true} />
        <EmptyState 
          emoji="⚠️" 
          title="Asset not found" 
          subtitle="We couldn't locate the asset record you're looking for." 
          actionLabel="Go Back" 
          onAction={() => router.back()} 
        />
      </View>
    );
  }

  const today = new Date().toISOString().slice(0, 10);
  const isOverdue = asset.next_service_date && asset.next_service_date < today;
  const isActive  = asset.status === AssetStatus.Active;

  return (
    <View style={[s.screen, { backgroundColor: C.background }]}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 32 }}>
        {/* ── ASSET HEADER ─────────────── */}
        <ScreenHeader
          eyebrow="ASSET RECORD"
          title={formatAssetType(asset.asset_type)}
          subtitle={asset.barcode_id ? `ID: ${asset.barcode_id}` : 'No barcode'}
          showBack={true}
          rightComponent={
            <View style={[s.statusBadge, { backgroundColor: isActive ? 'rgba(110,231,183,0.15)' : 'rgba(255,255,255,0.1)' }]}>
              <Text style={[s.statusBadgeText, { color: isActive ? '#6EE7B7' : 'rgba(255,255,255,0.6)' }]}>
                {isActive ? '✅ ACTIVE' : '❌ INACTIVE'}
              </Text>
            </View>
          }
        />

        {isOverdue ? (
          <View style={[s.overdueBar, { backgroundColor: C.errorLight, marginTop: 16 }]}>
            <MaterialCommunityIcons name="alert" size={18} color={C.errorDark} />
            <Text style={[s.overdueText, { color: C.errorDark }]}>Service overdue — next service was {asset.next_service_date}</Text>
          </View>
        ) : null}

        {/* Asset info */}
        <Animated.View entering={FadeInDown.delay(60).duration(350)} style={{ marginTop: !isOverdue ? 16 : 0 }}>
          <SectionTitle title="ASSET INFORMATION" />
          <Card style={{ marginHorizontal: 16 }}>
            {asset.variant ? (
              <InfoRow icon="format-list-bulleted" label="Variant" value={asset.variant} C={C} />
            ) : null}
            {asset.asset_ref ? (
              <InfoRow icon="tag-outline" label="Ref" value={asset.asset_ref} mono C={C} />
            ) : null}
            {asset.description ? (
              <InfoRow icon="📋" label="Description" value={asset.description} C={C} />
            ) : null}
            {asset.serial_number ? (
              <InfoRow icon="🔢" label="Serial Number" value={asset.serial_number} mono C={C} />
            ) : null}
            {asset.barcode_id ? (
              <InfoRow icon="📱" label="Barcode / QR ID" value={asset.barcode_id} mono C={C} />
            ) : null}
            {asset.location_on_site ? (
              <InfoRow icon="📍" label="Location on Site" value={asset.location_on_site} C={C} />
            ) : null}
            {asset.install_date ? (
              <InfoRow icon="🔧" label="Install Date" value={asset.install_date} C={C} />
            ) : null}
            {asset.last_service_date ? (
              <InfoRow icon="✅" label="Last Service" value={asset.last_service_date} C={C} />
            ) : null}
            {asset.next_service_date ? (
              <InfoRow
                icon={isOverdue ? '⚠️' : '📅'}
                label="Next Service"
                value={asset.next_service_date}
                C={C}
              />
            ) : null}
          </Card>

        </Animated.View>

        {/* Service history */}
        <Animated.View entering={FadeInDown.delay(120).duration(350)}>
          <SectionTitle title="SERVICE HISTORY" />
          <Card noPadding style={{ marginHorizontal: 16 }}>
            {serviceHistory.length === 0 ? (
              <View style={s.emptyInCard}>
                <Text style={[s.emptyText, { color: C.textTertiary }]}>No service history recorded</Text>
              </View>
            ) : (
              serviceHistory.map((rec, i) => {
                const rc = rec.result ? getResultConfig(C)[rec.result] : null;
                return (
                  <View key={rec.id} style={[s.histRow, i < serviceHistory.length - 1 && [s.histRowBorder, { borderBottomColor: C.border }]]}>
                    <View style={{ flex: 1 }}>
                      <Text style={[s.histDate, { color: C.text }]}>{rec.scheduled_date ?? '—'}</Text>
                      {rec.technician_name ? (
                        <Text style={[s.histTech, { color: C.textSecondary }]}>{rec.technician_name}</Text>
                      ) : null}
                      {rec.technician_notes ? (
                        <Text style={[s.histNotes, { color: C.textTertiary }]} numberOfLines={2}>{rec.technician_notes}</Text>
                      ) : null}
                    </View>
                    {rc ? (
                      <View style={s.resultPill}>
                        <Text style={s.resultIcon}>{rc.icon}</Text>
                        <Text style={[s.resultLabel, { color: rc.color }]}>{rc.label}</Text>
                      </View>
                    ) : (
                      <Text style={[s.noResult, { color: C.textTertiary }]}>⬜ Not Tested</Text>
                    )}
                  </View>
                );
              })
            )}
          </Card>
        </Animated.View>

        {/* Defect history */}
        <Animated.View entering={FadeInDown.delay(180).duration(350)}>
          <SectionTitle title="DEFECT HISTORY" />
          <Card noPadding style={{ marginHorizontal: 16 }}>
            {defects.length === 0 ? (
              <View style={s.emptyInCard}>
                <MaterialCommunityIcons name="shield-check-outline" size={32} color={C.successDark || C.success} />
                <Text style={[s.emptyText, { color: C.successDark || C.success }]}>No defects recorded ✓</Text>
              </View>
            ) : (
              defects.map((d, i) => {
                const sc = getSeverityConfig(C)[d.severity as DefectSeverity];
                return (
                  <View key={d.id} style={[s.defectRow, i < defects.length - 1 && [s.histRowBorder, { borderBottomColor: C.border }]]}>
                    <View style={[s.severityBar, { backgroundColor: sc?.color ?? '#ccc' }]} />
                    <View style={{ flex: 1 }}>
                      <Text style={[s.defectDesc, { color: C.text }]}>{d.description}</Text>
                      <Text style={[s.defectMeta, { color: C.textTertiary }]}>
                        {d.severity.toUpperCase()} · {d.status.toUpperCase().replace('_', ' ')}
                      </Text>
                    </View>
                  </View>
                );
              })
            )}
          </Card>
        </Animated.View>

      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  screen:  { flex: 1 },
  centered:{ flex: 1, alignItems: 'center', justifyContent: 'center' },

  // Header
  statusBadge: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 12, flexDirection: 'row', alignItems: 'center' },
  statusBadgeText: { fontSize: 11, fontWeight: '800', letterSpacing: 0.5 },

  overdueBar:  { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 16, paddingVertical: 10, marginHorizontal: 16, borderRadius: 12, marginBottom: 16 },
  overdueText: { fontSize: 12, fontWeight: '600', flex: 1 },

  section:      { paddingHorizontal: 16, paddingTop: 16 },
  sectionTitle: { fontSize: 11, fontWeight: '800', color: '#8896A8', letterSpacing: 1.2, textTransform: 'uppercase', marginBottom: 8 },

  card: { borderRadius: 16, padding: 16, gap: 12, shadowColor: '#0F1E3C', shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.06, shadowRadius: 10, elevation: 3 },

  infoRow:   { flexDirection: 'row', alignItems: 'flex-start', gap: 10, paddingVertical: 4 },
  infoIcon:  { fontSize: 16, width: 24, textAlign: 'center', marginTop: 2 },
  infoLabel: { fontSize: 11, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.4, marginBottom: 2 },
  infoValue: { fontSize: 14, fontWeight: '500' },
  mono:      { fontFamily: 'monospace', fontSize: 13 },

  histRow:       { paddingVertical: 10, flexDirection: 'row', alignItems: 'flex-start' },
  histRowBorder: { borderBottomWidth: 1 },
  histDate:      { fontSize: 13, fontWeight: '700' },
  histTech:      { fontSize: 12, marginTop: 2 },
  histNotes:     { fontSize: 12, fontStyle: 'italic', marginTop: 2 },
  resultPill:    { flexDirection: 'row', alignItems: 'center', gap: 4 },
  resultIcon:    { fontSize: 14 },
  resultLabel:   { fontSize: 12, fontWeight: '700' },
  noResult:      { fontSize: 12 },

  defectRow:   { paddingVertical: 10, flexDirection: 'row', alignItems: 'center', gap: 10 },
  severityBar: { width: 4, height: 40, borderRadius: 2 },
  defectDesc:  { fontSize: 13, fontWeight: '600' },
  defectMeta:  { fontSize: 11, marginTop: 3 },

  emptyInCard: { alignItems: 'center', gap: 8, paddingVertical: 16 },
  emptyText:   { fontSize: 14 },

  notFound:   { fontSize: 16, marginTop: 12 },
});
