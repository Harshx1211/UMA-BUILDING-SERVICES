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
import { ScreenHeader, EmptyState } from '@/components/ui';
import { useDefectsStore } from '@/store/defectsStore';
import { DefectSeverity } from '@/constants/Enums';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { SkeletonCard } from '@/components/ui/SkeletonCard';
import Animated, { FadeInDown } from 'react-native-reanimated';
import type { Defect } from '@/types';

// ─── Severity colour palette ──────────────────────────────────
const SEV: Record<DefectSeverity, { color: string; label: string; icon: string }> = {
  [DefectSeverity.Critical]: { color: '#ef4444', label: 'Critical / Immediate',  icon: 'alert-octagon' },
  [DefectSeverity.Major]:    { color: '#f97316', label: 'Major Defects',          icon: 'alert' },
  [DefectSeverity.Minor]:    { color: '#eab308', label: 'Minor Defects',          icon: 'alert-circle-outline' },
};

// ─── Single defect row (read-only) ───────────────────────────
function DefectRow({ defect, color, C }: { defect: Defect; color: string; C: any }) {
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
        <View style={[dr.pricePill, { backgroundColor: '#10B981' + '15' }]}>
          <Text style={dr.priceTxt}>${Number(defect.quote_price).toFixed(2)}</Text>
        </View>
      ) : (
        <View style={[dr.pricePill, { backgroundColor: C.backgroundTertiary }]}>
          <Text style={[dr.priceTxt, { color: C.textTertiary }]}>—</Text>
        </View>
      )}
    </View>
  );
}

const dr = StyleSheet.create({
  row: {
    borderRadius: 12, borderWidth: 1, borderLeftWidth: 4,
    paddingVertical: 12, paddingHorizontal: 14,
    flexDirection: 'row', alignItems: 'center', gap: 10,
    marginBottom: 8,
  },
  desc:     { fontSize: 13, lineHeight: 19, fontWeight: '500' },
  sub:      { fontSize: 11 },
  pricePill: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 },
  priceTxt:  { fontSize: 12, fontWeight: '800', color: '#10B981' },
});

// ─── Main Screen ─────────────────────────────────────────────
export default function QuoteScreen() {
  const C = useColors();
  const { id: jobId } = useLocalSearchParams<{ id: string }>();
  const store = useDefectsStore();

  useEffect(() => {
    if (jobId) store.loadDefects(jobId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [jobId]);

  // Group defects by severity
  const grouped = useMemo(() => ({
    critical: store.defects.filter(d => d.severity === DefectSeverity.Critical),
    major:    store.defects.filter(d => d.severity === DefectSeverity.Major),
    minor:    store.defects.filter(d => d.severity === DefectSeverity.Minor),
  }), [store.defects]);

  // Running total from admin-set prices
  const total = useMemo(
    () => store.defects.reduce((sum, d) => sum + (Number(d.quote_price) || 0), 0),
    [store.defects],
  );

  const hasDefects = store.defects.length > 0;

  const renderGroup = (key: 'critical' | 'major' | 'minor', delay: number) => {
    const defects = grouped[key];
    if (defects.length === 0) return null;
    const cfg = SEV[key === 'critical' ? DefectSeverity.Critical : key === 'major' ? DefectSeverity.Major : DefectSeverity.Minor];
    return (
      <Animated.View key={key} entering={FadeInDown.delay(delay).duration(340)}>
        <View style={s.groupHeader}>
          <View style={[s.groupDot, { backgroundColor: cfg.color }]} />
          <MaterialCommunityIcons name={cfg.icon as any} size={14} color={cfg.color} />
          <Text style={[s.groupTitle, { color: C.textTertiary }]}>
            {cfg.label} ({defects.length})
          </Text>
        </View>
        {defects.map(d => (
          <DefectRow key={d.id} defect={d} color={cfg.color} C={C} />
        ))}
      </Animated.View>
    );
  };

  if (store.isLoading) {
    return (
      <View style={[s.screen, { backgroundColor: C.background }]}>
        <ScreenHeader eyebrow="QUOTE SUMMARY" title="Quote" showBack curved />
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
        curved
        rightComponent={
          hasDefects && total > 0 ? (
            <View style={[s.totalBadge, { backgroundColor: '#10B981' + '18', borderColor: '#10B981' + '40' }]}>
              <Text style={s.totalBadgeTxt}>${total.toFixed(2)}</Text>
            </View>
          ) : undefined
        }
      />

      {!hasDefects ? (
        <EmptyState
          emoji="🎉"
          title="No defects logged"
          subtitle="All clear! Any defects you log during the inspection will appear here, grouped by severity."
        />
      ) : (
        <ScrollView contentContainerStyle={s.content} showsVerticalScrollIndicator={false}>

          {/* Admin-managed info banner */}
          <Animated.View entering={FadeInDown.delay(20).duration(300)}>
            <View style={[s.infoBanner, { backgroundColor: C.backgroundTertiary, borderColor: C.border }]}>
              <MaterialCommunityIcons name="shield-account-outline" size={16} color={C.textSecondary} />
              <Text style={[s.infoBannerTxt, { color: C.textSecondary }]}>
                Prices and quote approval are managed by the admin portal
              </Text>
            </View>
          </Animated.View>

          {/* Defect groups */}
          {renderGroup('critical', 60)}
          {renderGroup('major',    90)}
          {renderGroup('minor',    120)}

          {/* Total footer */}
          <Animated.View entering={FadeInDown.delay(150).duration(340)}>
            <View style={[s.totalCard, { backgroundColor: C.surface, borderColor: C.border }]}>
              <View style={s.totalRow}>
                <Text style={[s.totalLabel, { color: C.textSecondary }]}>Subtotal (ex-GST)</Text>
                <Text style={[s.totalValue, { color: total > 0 ? '#10B981' : C.textTertiary }]}>
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
  totalBadgeTxt: { fontSize: 12, fontWeight: '800', color: '#10B981' },

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
    borderRadius: 14, borderWidth: 1,
    padding: 16, marginTop: 12,
  },
  totalRow:   { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  totalLabel: { fontSize: 13, fontWeight: '600' },
  totalValue: { fontSize: 18, fontWeight: '800' },
  totalNote:  { fontSize: 11, marginTop: 6, lineHeight: 16 },
});
