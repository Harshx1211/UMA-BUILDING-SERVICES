// Asset detail screen — asset info, service history, defect history
import { useCallback, useEffect, useState } from 'react';
import { ScrollView, StyleSheet, TouchableOpacity, View } from 'react-native';
import { ActivityIndicator, Text } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { router, useLocalSearchParams } from 'expo-router';
import Colors from '@/constants/Colors';
import { AssetStatus, InspectionResult, DefectSeverity } from '@/constants/Enums';
import { getRecord, getServiceHistoryForAsset, getDefectsForAsset } from '@/lib/database';
import type { Asset, Defect } from '@/types';

const NAVY   = '#0E2141';
const ORANGE = '#EA6C00';
const PAGE   = '#F2F5F9';
const WHITE  = '#FFFFFF';

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

const RESULT_CONFIG: Record<InspectionResult, { icon: string; color: string; label: string }> = {
  [InspectionResult.Pass]:      { icon: '✅', color: Colors.light.successDark, label: 'Pass' },
  [InspectionResult.Fail]:      { icon: '❌', color: Colors.light.errorDark,   label: 'Fail' },
  [InspectionResult.NotTested]: { icon: '⬜', color: Colors.light.textTertiary, label: 'Not Tested' },
};

const SEVERITY_CONFIG: Record<DefectSeverity, { color: string }> = {
  [DefectSeverity.Critical]: { color: Colors.light.error },
  [DefectSeverity.Major]:    { color: Colors.light.warning },
  [DefectSeverity.Minor]:    { color: Colors.light.info },
};

function InfoRow({ icon, label, value, mono = false }: { icon: string; label: string; value: string; mono?: boolean }) {
  return (
    <View style={s.infoRow}>
      <Text style={s.infoIcon}>{icon}</Text>
      <View style={{ flex: 1 }}>
        <Text style={s.infoLabel}>{label}</Text>
        <Text style={[s.infoValue, mono && s.mono]}>{value}</Text>
      </View>
    </View>
  );
}

export default function AssetDetailScreen() {
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
      <View style={[s.screen, s.centered]}>
        <ActivityIndicator color={NAVY} size="large" />
      </View>
    );
  }

  if (!asset) {
    return (
      <View style={[s.screen, s.centered]}>
        <MaterialCommunityIcons name="alert-circle-outline" size={44} color={ORANGE} />
        <Text style={s.notFound}>Asset not found</Text>
        <TouchableOpacity style={s.backBtn} onPress={() => router.back()}>
          <Text style={s.backBtnTxt}>← Go Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const today = new Date().toISOString().slice(0, 10);
  const isOverdue = asset.next_service_date && asset.next_service_date < today;
  const isActive  = asset.status === AssetStatus.Active;

  return (
    <View style={s.screen}>
      {/* Header */}
      <View style={s.header}>
        <TouchableOpacity style={s.back} onPress={() => router.back()}>
          <MaterialCommunityIcons name="arrow-left" size={22} color={WHITE} />
        </TouchableOpacity>
        <Text style={s.headerTitle} numberOfLines={1}>{asset.asset_type}</Text>
        <View style={[s.statusBadge, { backgroundColor: isActive ? Colors.light.successLight : Colors.light.backgroundTertiary }]}>
          <Text style={[s.statusBadgeText, { color: isActive ? Colors.light.successDark : Colors.light.textSecondary }]}>
            {isActive ? 'Active' : 'Decommissioned'}
          </Text>
        </View>
      </View>

      <ScrollView showsVerticalScrollIndicator={false}>
        {/* Overdue warning */}
        {isOverdue ? (
          <View style={s.overdueBar}>
            <MaterialCommunityIcons name="alert" size={18} color="#7F1D1D" />
            <Text style={s.overdueText}>Service overdue — next service was {asset.next_service_date}</Text>
          </View>
        ) : null}

        {/* Asset info */}
        <Animated.View entering={FadeInDown.delay(60).duration(350)} style={s.section}>
          <Text style={s.sectionTitle}>ASSET INFORMATION</Text>
          <View style={s.card}>
            {asset.description ? (
              <InfoRow icon="📋" label="Description" value={asset.description} />
            ) : null}
            {asset.serial_number ? (
              <InfoRow icon="🔢" label="Serial Number" value={asset.serial_number} mono />
            ) : null}
            {asset.barcode_id ? (
              <InfoRow icon="📱" label="Barcode / QR ID" value={asset.barcode_id} mono />
            ) : null}
            {asset.location_on_site ? (
              <InfoRow icon="📍" label="Location on Site" value={asset.location_on_site} />
            ) : null}
            {asset.install_date ? (
              <InfoRow icon="🔧" label="Install Date" value={asset.install_date} />
            ) : null}
            {asset.last_service_date ? (
              <InfoRow icon="✅" label="Last Service" value={asset.last_service_date} />
            ) : null}
            {asset.next_service_date ? (
              <InfoRow
                icon={isOverdue ? '⚠️' : '📅'}
                label="Next Service"
                value={asset.next_service_date}
              />
            ) : null}
          </View>
        </Animated.View>

        {/* Service history */}
        <Animated.View entering={FadeInDown.delay(120).duration(350)} style={s.section}>
          <Text style={s.sectionTitle}>SERVICE HISTORY</Text>
          <View style={s.card}>
            {serviceHistory.length === 0 ? (
              <View style={s.emptyInCard}>
                <Text style={s.emptyText}>No service history recorded</Text>
              </View>
            ) : (
              serviceHistory.map((rec, i) => {
                const rc = rec.result ? RESULT_CONFIG[rec.result] : null;
                return (
                  <View key={rec.id} style={[s.histRow, i < serviceHistory.length - 1 && s.histRowBorder]}>
                    <View style={{ flex: 1 }}>
                      <Text style={s.histDate}>{rec.scheduled_date ?? '—'}</Text>
                      {rec.technician_name ? (
                        <Text style={s.histTech}>{rec.technician_name}</Text>
                      ) : null}
                      {rec.technician_notes ? (
                        <Text style={s.histNotes} numberOfLines={2}>{rec.technician_notes}</Text>
                      ) : null}
                    </View>
                    {rc ? (
                      <View style={s.resultPill}>
                        <Text style={s.resultIcon}>{rc.icon}</Text>
                        <Text style={[s.resultLabel, { color: rc.color }]}>{rc.label}</Text>
                      </View>
                    ) : (
                      <Text style={s.noResult}>⬜ Not Tested</Text>
                    )}
                  </View>
                );
              })
            )}
          </View>
        </Animated.View>

        {/* Defect history */}
        <Animated.View entering={FadeInDown.delay(180).duration(350)} style={s.section}>
          <Text style={s.sectionTitle}>DEFECT HISTORY</Text>
          <View style={s.card}>
            {defects.length === 0 ? (
              <View style={s.emptyInCard}>
                <MaterialCommunityIcons name="shield-check-outline" size={32} color={Colors.light.successDark} />
                <Text style={[s.emptyText, { color: Colors.light.successDark }]}>No defects recorded ✓</Text>
              </View>
            ) : (
              defects.map((d, i) => {
                const sc = SEVERITY_CONFIG[d.severity as DefectSeverity];
                return (
                  <View key={d.id} style={[s.defectRow, i < defects.length - 1 && s.histRowBorder]}>
                    <View style={[s.severityBar, { backgroundColor: sc?.color ?? '#ccc' }]} />
                    <View style={{ flex: 1 }}>
                      <Text style={s.defectDesc}>{d.description}</Text>
                      <Text style={s.defectMeta}>
                        {d.severity.toUpperCase()} · {d.status.toUpperCase().replace('_', ' ')}
                      </Text>
                    </View>
                  </View>
                );
              })
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

  header:          { backgroundColor: NAVY, paddingTop: 52, paddingBottom: 16, paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center', gap: 12 },
  back:            { padding: 4 },
  headerTitle:     { flex: 1, fontSize: 18, fontWeight: '700', color: WHITE },
  statusBadge:     { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 16 },
  statusBadgeText: { fontSize: 12, fontWeight: '700' },

  overdueBar:  { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#FEE2E2', paddingHorizontal: 16, paddingVertical: 10 },
  overdueText: { fontSize: 12, color: '#7F1D1D', fontWeight: '600', flex: 1 },

  section:      { paddingHorizontal: 16, paddingTop: 16 },
  sectionTitle: { fontSize: 11, fontWeight: '800', color: '#8896A8', letterSpacing: 1.2, textTransform: 'uppercase', marginBottom: 8 },

  card: { backgroundColor: WHITE, borderRadius: 14, padding: 14, gap: 10, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 6, elevation: 3 },

  infoRow:   { flexDirection: 'row', alignItems: 'flex-start', gap: 10, paddingVertical: 4 },
  infoIcon:  { fontSize: 16, width: 24, textAlign: 'center', marginTop: 2 },
  infoLabel: { fontSize: 11, color: Colors.light.textTertiary, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.4, marginBottom: 2 },
  infoValue: { fontSize: 14, color: Colors.light.text, fontWeight: '500' },
  mono:      { fontFamily: 'monospace', fontSize: 13 },

  histRow:       { paddingVertical: 10, flexDirection: 'row', alignItems: 'flex-start' },
  histRowBorder: { borderBottomWidth: 1, borderBottomColor: '#F3F5F8' },
  histDate:      { fontSize: 13, fontWeight: '700', color: Colors.light.text },
  histTech:      { fontSize: 12, color: Colors.light.textSecondary, marginTop: 2 },
  histNotes:     { fontSize: 12, color: Colors.light.textTertiary, fontStyle: 'italic', marginTop: 2 },
  resultPill:    { flexDirection: 'row', alignItems: 'center', gap: 4 },
  resultIcon:    { fontSize: 14 },
  resultLabel:   { fontSize: 12, fontWeight: '700' },
  noResult:      { fontSize: 12, color: Colors.light.textTertiary },

  defectRow:   { paddingVertical: 10, flexDirection: 'row', alignItems: 'center', gap: 10 },
  severityBar: { width: 4, height: 40, borderRadius: 2 },
  defectDesc:  { fontSize: 13, fontWeight: '600', color: Colors.light.text },
  defectMeta:  { fontSize: 11, color: Colors.light.textTertiary, marginTop: 3 },

  emptyInCard: { alignItems: 'center', gap: 8, paddingVertical: 16 },
  emptyText:   { fontSize: 14, color: Colors.light.textTertiary },

  notFound:   { fontSize: 16, color: Colors.light.textSecondary, marginTop: 12 },
  backBtn:    { marginTop: 16, paddingHorizontal: 24, paddingVertical: 12, backgroundColor: NAVY, borderRadius: 10 },
  backBtnTxt: { color: WHITE, fontWeight: '700' },
});
