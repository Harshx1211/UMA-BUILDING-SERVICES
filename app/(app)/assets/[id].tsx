// Asset detail screen — asset info, service history, defect history
import { useCallback, useEffect, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { ActivityIndicator, Text } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { router, useLocalSearchParams } from 'expo-router';
import { useColors } from '@/hooks/useColors';
import { T } from '@/constants/Colors';
import { AssetStatus, InspectionResult, DefectSeverity } from '@/constants/Enums';
import { getRecord, getServiceHistoryForAsset, getDefectsForAsset } from '@/lib/database';
import { ScreenHeader, EmptyState, SectionHeader, Card } from '@/components/ui';
import type { Asset, Defect } from '@/types';
import { formatAssetType } from '@/utils/assetHelpers';
import { localDateString } from '@/utils/dateHelpers';

type MCIconName = React.ComponentProps<typeof MaterialCommunityIcons>['name'];

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

// ── Result config — vectors only, no emoji ──────────────────────────────────
const RESULT_CONFIG: Record<InspectionResult, { icon: MCIconName; color: (C: any) => string; label: string }> = {
  [InspectionResult.Pass]:      { icon: 'check-circle',          color: (C) => C.successDark || C.success, label: 'Pass' },
  [InspectionResult.Fail]:      { icon: 'close-circle',          color: (C) => C.errorDark  || C.error,   label: 'Fail' },
  [InspectionResult.NotTested]: { icon: 'checkbox-blank-outline', color: (C) => C.textTertiary,            label: 'Not Tested' },
};

const getSeverityConfig = (C: any): Record<DefectSeverity, { color: string }> => ({
  [DefectSeverity.Critical]: { color: C.error },
  [DefectSeverity.Major]:    { color: C.warning },
  [DefectSeverity.Minor]:    { color: C.info },
});

// ── InfoRow — uses MaterialCommunityIcons, no emoji ──────────────────────────
function InfoRow({
  icon, label, value, mono = false, C,
}: {
  icon: MCIconName;
  label: string;
  value: string;
  mono?: boolean;
  C: any;
}) {
  return (
    <View style={s.infoRow}>
      <MaterialCommunityIcons name={icon} size={16} color={C.textTertiary} style={s.infoIcon} />
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
        <ScreenHeader title="Not Found" showBack={true} />
        <EmptyState
          icon="alert"
          title="Asset not found"
          subtitle="We couldn't locate the asset record you're looking for."
          actionLabel="Go Back"
          onAction={() => router.back()}
        />
      </View>
    );
  }

  // ── Fix: use localDateString() to avoid UTC midnight date-shifting ──────────
  const today     = localDateString();
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
            <View style={[s.statusBadge, { backgroundColor: isActive ? C.success + '26' : C.backgroundTertiary }]}>
              <Text style={[s.statusBadgeText, { color: isActive ? C.success : C.textSecondary }]}>
                {isActive ? 'ACTIVE' : 'INACTIVE'}
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
          <SectionHeader title="Asset information" eyebrow />
          <Card style={{ marginHorizontal: 16 }}>
            {asset.variant ? (
              <InfoRow icon="format-list-bulleted" label="Variant" value={asset.variant} C={C} />
            ) : null}
            {asset.asset_ref ? (
              <InfoRow icon="tag-outline" label="Ref" value={asset.asset_ref} mono C={C} />
            ) : null}
            {asset.description ? (
              <InfoRow icon="clipboard-text-outline" label="Description" value={asset.description} C={C} />
            ) : null}
            {asset.serial_number ? (
              <InfoRow icon="identifier" label="Serial Number" value={asset.serial_number} mono C={C} />
            ) : null}
            {asset.barcode_id ? (
              <InfoRow icon="qrcode" label="Barcode / QR ID" value={asset.barcode_id} mono C={C} />
            ) : null}
            {asset.location_on_site ? (
              <InfoRow icon="map-marker-outline" label="Location on Site" value={asset.location_on_site} C={C} />
            ) : null}
            {asset.install_date ? (
              <InfoRow icon="wrench-outline" label="Install Date" value={asset.install_date} C={C} />
            ) : null}
            {asset.last_service_date ? (
              <InfoRow icon="check-circle-outline" label="Last Service" value={asset.last_service_date} C={C} />
            ) : null}
            {asset.next_service_date ? (
              <InfoRow
                icon={isOverdue ? 'alert-circle-outline' : 'calendar-clock'}
                label="Next Service"
                value={asset.next_service_date}
                C={C}
              />
            ) : null}
          </Card>
        </Animated.View>

        {/* Service history */}
        <Animated.View entering={FadeInDown.delay(120).duration(350)}>
          <SectionHeader title="Service history" eyebrow />
          <Card noPadding style={{ marginHorizontal: 16 }}>
            {serviceHistory.length === 0 ? (
              <View style={s.emptyInCard}>
                <Text style={[s.emptyText, { color: C.textTertiary }]}>No service history recorded</Text>
              </View>
            ) : (
              serviceHistory.map((rec, i) => {
                const rc = rec.result ? RESULT_CONFIG[rec.result] : null;
                return (
                  <View key={rec.id} style={[s.histRow, i < serviceHistory.length - 1 && [s.histRowBorder, { borderBottomColor: C.border }]]}>
                    <View style={{ flex: 1 }}>
                      <Text style={[s.histDate, { color: C.text }]}>
                        {rec.scheduled_date ?? '—'}
                        {rec.actioned_at ? ` → ${rec.actioned_at.substring(0, 10)}` : ''}
                      </Text>
                      {rec.technician_name ? (
                        <Text style={[s.histTech, { color: C.textSecondary }]}>{rec.technician_name}</Text>
                      ) : null}
                      {rec.technician_notes ? (
                        <Text style={[s.histNotes, { color: C.textTertiary }]} numberOfLines={2}>{rec.technician_notes}</Text>
                      ) : null}
                    </View>
                    {rc ? (
                      <View style={s.resultPill}>
                        <MaterialCommunityIcons
                          name={rc.icon}
                          size={16}
                          color={rc.color(C)}
                        />
                        <Text style={[s.resultLabel, { color: rc.color(C) }]}>{rc.label}</Text>
                      </View>
                    ) : (
                      <View style={s.resultPill}>
                        <MaterialCommunityIcons name="checkbox-blank-outline" size={14} color={C.textTertiary} />
                        <Text style={[s.noResult, { color: C.textTertiary }]}>Not Tested</Text>
                      </View>
                    )}
                  </View>
                );
              })
            )}
          </Card>
        </Animated.View>

        {/* Defect history */}
        <Animated.View entering={FadeInDown.delay(180).duration(350)}>
          <SectionHeader title="Defect history" eyebrow />
          <Card noPadding style={{ marginHorizontal: 16 }}>
            {defects.length === 0 ? (
              <View style={s.emptyInCard}>
                <MaterialCommunityIcons name="shield-check-outline" size={32} color={C.successDark || C.success} />
                <Text style={[s.emptyText, { color: C.successDark || C.success }]}>No defects recorded</Text>
              </View>
            ) : (
              defects.map((d, i) => {
                const sc = getSeverityConfig(C)[d.severity as DefectSeverity];
                return (
                  <View key={d.id} style={[s.defectRow, i < defects.length - 1 && [s.histRowBorder, { borderBottomColor: C.border }]]}>
                    <View style={[s.severityBar, { backgroundColor: sc?.color ?? C.border }]} />
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

  statusBadge:     { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 12, flexDirection: 'row', alignItems: 'center' },
  statusBadgeText: { fontSize: 11, fontWeight: '800', letterSpacing: 0.5 },

  overdueBar:  { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 16, paddingVertical: 10, marginHorizontal: 16, borderRadius: 12, marginBottom: 16 },
  overdueText: { fontSize: 12, fontWeight: '600', flex: 1 },

  // InfoRow
  infoRow:   { flexDirection: 'row', alignItems: 'flex-start', gap: 10, paddingVertical: 5 },
  infoIcon:  { marginTop: 2, width: 20 },
  infoLabel: { fontSize: 11, fontWeight: '600', letterSpacing: 0.3, marginBottom: 2 },
  infoValue: { fontSize: 14, fontWeight: '500' },
  mono:      { fontFamily: 'monospace', fontSize: 13 },

  // Service history
  histRow:       { paddingHorizontal: 14, paddingVertical: 12, flexDirection: 'row', alignItems: 'flex-start' },
  histRowBorder: { borderBottomWidth: 1 },
  histDate:      { fontSize: 13, fontWeight: '700' },
  histTech:      { fontSize: 12, marginTop: 2 },
  histNotes:     { fontSize: 12, fontStyle: 'italic', marginTop: 2 },
  resultPill:    { flexDirection: 'row', alignItems: 'center', gap: 4, paddingLeft: 8 },
  resultLabel:   { fontSize: 12, fontWeight: '700' },
  noResult:      { fontSize: 12 },

  // Defect history
  defectRow:   { paddingHorizontal: 14, paddingVertical: 12, flexDirection: 'row', alignItems: 'center', gap: 10 },
  severityBar: { width: 4, height: 40, borderRadius: 2 },
  defectDesc:  { fontSize: 13, fontWeight: '600' },
  defectMeta:  { fontSize: 11, marginTop: 3 },

  emptyInCard: { alignItems: 'center', gap: 8, paddingVertical: 16 },
  emptyText:   { fontSize: 14 },
  notFound:    { fontSize: 16, marginTop: 12 },
});
