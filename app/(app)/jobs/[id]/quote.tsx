/**
 * Quote Screen — app/(app)/jobs/[id]/quote.tsx
 *
 * Read-only summary for the technician.
 * Defects are grouped by severity (Critical / Major / Minor).
 * Prices shown if admin has set them — otherwise "Unquoted".
 * Total is summed from quote_price values.
 * No editing on this screen — all quote management is admin-only.
 */
import React, { useEffect, useMemo } from 'react';
import { View, StyleSheet, ScrollView } from 'react-native';
import { Text } from 'react-native-paper';
import { useLocalSearchParams } from 'expo-router';
import { useColors } from '@/hooks/useColors';
import { useReducedMotion } from '@/hooks/useReducedMotion';
import { ScreenHeader, EmptyState } from '@/components/ui';
import { useDefectsStore } from '@/store/defectsStore';
import { DefectSeverity } from '@/constants/Enums';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { SkeletonCard } from '@/components/ui/SkeletonCard';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { onSyncComplete, offSyncComplete } from '@/lib/sync';
import type { Defect } from '@/types';

type ColorsType = ReturnType<typeof useColors>;
type MCIconName = React.ComponentProps<typeof MaterialCommunityIcons>['name'];

// ─── Severity colour palette ──────────────────────────────────────────
const SEV: Record<DefectSeverity, { color: (C: ColorsType) => string; label: string; icon: MCIconName }> = {
  [DefectSeverity.Critical]:       { color: (C) => C.error,   label: 'Critical / Immediate', icon: 'alert-octagon' },
  [DefectSeverity.NonCritical]:    { color: (C) => C.warning, label: 'Non-critical Defects', icon: 'alert' },
  [DefectSeverity.NonConformance]: { color: (C) => C.info,    label: 'Non-conformances',     icon: 'alert-circle-outline' },
};

// ─── Single defect row (read-only) ────────────────────────────────────
const DefectRow = React.memo(function DefectRow({ defect, color, C }: { defect: Defect; color: string; C: ColorsType }) {
  const hasPrice = defect.quote_price != null && Number(defect.quote_price) > 0;
  return (
    <View style={[dr.row, { backgroundColor: C.surface, borderColor: C.border, borderLeftColor: color }]}>
      <View style={{ flex: 1, gap: 3 }}>
        <Text style={[dr.desc, { color: C.text }]} numberOfLines={2}>{defect.description}</Text>
        <Text style={[dr.sub, { color: C.textTertiary }]}>
          {defect.status.charAt(0).toUpperCase() + defect.status.slice(1)}
        </Text>
      </View>
      {hasPrice ? (
        <View style={[dr.pricePill, { backgroundColor: C.successLight }]}>
          <Text style={[dr.priceTxt, { color: C.success }]}>${Number(defect.quote_price).toFixed(2)}</Text>
        </View>
      ) : (
        <View style={[dr.pricePill, { backgroundColor: C.backgroundTertiary }]}>
          <Text style={[dr.priceTxt, { color: C.textTertiary }]}>—</Text>
        </View>
      )}
    </View>
  );
});

const dr = StyleSheet.create({
  row: {
    borderRadius: 16, borderWidth: 1, borderLeftWidth: 4,
    paddingVertical: 16, paddingHorizontal: 16,
    flexDirection: 'row', alignItems: 'center', gap: 10,
    marginBottom: 12,
  },
  desc:     { fontSize: 13, lineHeight: 19, fontWeight: '500' },
  sub:      { fontSize: 11 },
  pricePill: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 },
  priceTxt:  { fontSize: 12, fontWeight: '800' },
});

// ─── Main Screen ──────────────────────────────────────────────────────
export default function QuoteScreen() {
  const C = useColors();
  const noMotion = useReducedMotion();
  const { id: jobId } = useLocalSearchParams<{ id: string }>();
  const store = useDefectsStore();

  useEffect(() => {
    if (!jobId) return;
    store.loadDefects(jobId);

    // A18: Re-load defects whenever a sync cycle completes so admin-updated
    // prices appear immediately without requiring a screen remount.
    const listener = () => store.loadDefects(jobId);
    onSyncComplete(listener);
    return () => offSyncComplete(listener);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [jobId]);

  // Group defects by severity
  const grouped = useMemo(() => ({
    critical:        store.defects.filter(d => d.severity === DefectSeverity.Critical),
    nonCritical:     store.defects.filter(d => d.severity === DefectSeverity.NonCritical),
    nonConformance:  store.defects.filter(d => d.severity === DefectSeverity.NonConformance),
  }), [store.defects]);

  // Running total from admin-set prices
  const total = useMemo(
    () => store.defects.reduce((sum, d) => sum + (Number(d.quote_price) || 0), 0),
    [store.defects],
  );

  const hasDefects = store.defects.length > 0;

  const renderGroup = (key: 'critical' | 'nonCritical' | 'nonConformance', delay: number) => {
    const defects = grouped[key];
    if (defects.length === 0) return null;
    const cfg = SEV[key === 'critical' ? DefectSeverity.Critical : key === 'nonCritical' ? DefectSeverity.NonCritical : DefectSeverity.NonConformance];
    const groupColor = cfg.color(C);
    return (
      <Animated.View key={key} entering={noMotion ? undefined : FadeInDown.delay(delay).duration(340)}>
        <View style={s.groupHeader}>
          <View style={[s.groupDot, { backgroundColor: groupColor }]} />
          <MaterialCommunityIcons name={cfg.icon} size={14} color={groupColor} />
          <Text style={[s.groupTitle, { color: C.textTertiary }]}>
            {cfg.label} ({defects.length})
          </Text>
        </View>
        {defects.map(d => (
          <DefectRow key={d.id} defect={d} color={groupColor} C={C} />
        ))}
      </Animated.View>
    );
  };

  if (store.isLoading) {
    return (
      <View style={[s.screen, { backgroundColor: C.background }]}>
        <ScreenHeader eyebrow="QUOTE SUMMARY" title="Quote" showBack />
        <View style={{ paddingTop: 24, gap: 12 }}>
          <SkeletonCard /><SkeletonCard />
        </View>
      </View>
    );
  }

  return (
    <View style={[s.screen, { backgroundColor: C.background }]}>
      <ScreenHeader
        eyebrow="QUOTE SUMMARY"
        title="Quote"
        subtitle={`${store.defects.length} defect${store.defects.length !== 1 ? 's' : ''} logged`}
        showBack
        rightComponent={
          hasDefects && total > 0 ? (
            <View style={[s.totalBadge, { backgroundColor: C.successLight, borderColor: C.success + '50' }]}>
              <Text style={[s.totalBadgeTxt, { color: C.success }]}>${total.toFixed(2)}</Text>
            </View>
          ) : undefined
        }
      />

      {/* F5: Contextual empty state — explains the expected flow so techs aren't confused */}
      {!hasDefects ? (
        <View style={{ flex: 1, padding: 24, gap: 16 }}>
          <EmptyState
            icon="file-document-outline"
            title="No defects logged yet"
            subtitle="Defects you log during the on-site inspection will appear here, grouped by severity. Admin will then set pricing for each item."
          />
          <View style={[s.infoBanner, { backgroundColor: C.infoLight, borderColor: C.info + '30' }]}>
            <MaterialCommunityIcons name="information-outline" size={16} color={C.info} />
            <Text style={[s.infoBannerTxt, { color: C.infoDark }]}>
              Prices and quote approval are managed by your admin — you only need to log the defects found on site.
            </Text>
          </View>
        </View>
      ) : (
        <ScrollView contentContainerStyle={s.content} showsVerticalScrollIndicator={false}>

          {/* Admin-managed info banner */}
          <Animated.View entering={noMotion ? undefined : FadeInDown.delay(20).duration(300)}>
            <View style={[s.infoBanner, { backgroundColor: C.backgroundTertiary, borderColor: C.border }]}>
              <MaterialCommunityIcons name="shield-account-outline" size={16} color={C.textSecondary} />
              <Text style={[s.infoBannerTxt, { color: C.textSecondary }]}>
                Prices and quote approval are managed by the admin portal
              </Text>
            </View>
          </Animated.View>

          {/* Defect groups */}
          {renderGroup('critical',       60)}
          {renderGroup('nonCritical',    90)}
          {renderGroup('nonConformance', 120)}

          {/* Total footer */}
          <Animated.View entering={noMotion ? undefined : FadeInDown.delay(150).duration(340)}>
            <View style={[s.totalCard, { backgroundColor: C.surface, borderColor: C.border }]}>
              <View style={s.totalRow}>
                <Text style={[s.totalLabel, { color: C.textSecondary }]}>Subtotal (ex-GST)</Text>
                <Text style={[s.totalValue, { color: total > 0 ? C.success : C.textTertiary }]}>
                  {total > 0 ? `$${total.toFixed(2)}` : 'Pending pricing'}
                </Text>
              </View>
              {total === 0 && (
                <Text style={[s.totalNote, { color: C.textTertiary }]}>
                  Prices will be filled by the admin once the quote is reviewed
                </Text>
              )}
            </View>
          </Animated.View>

        </ScrollView>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  screen:  { flex: 1 },
  content: { padding: 16, paddingBottom: 60, gap: 4 },

  totalBadge: {
    paddingHorizontal: 10, paddingVertical: 6,
    borderRadius: 10, borderWidth: 1,
  },
  totalBadgeTxt: { fontSize: 12, fontWeight: '800' },

  infoBanner: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    paddingHorizontal: 12, paddingVertical: 10,
    borderRadius: 10, borderWidth: 1, marginBottom: 16,
  },
  infoBannerTxt: { fontSize: 12, flex: 1, lineHeight: 17 },

  groupHeader: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    marginBottom: 10, marginTop: 8, paddingHorizontal: 2,
  },
  groupDot:   { width: 7, height: 7, borderRadius: 4 },
  groupTitle: { fontSize: 11, fontWeight: '800', letterSpacing: 0.8, textTransform: 'uppercase' },

  totalCard: {
    borderRadius: 16, borderWidth: 1,
    padding: 16, marginTop: 12,
  },
  totalRow:   { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  totalLabel: { fontSize: 13, fontWeight: '600' },
  totalValue: { fontSize: 18, fontWeight: '800' },
  totalNote:  { fontSize: 11, marginTop: 6, lineHeight: 16 },
});
