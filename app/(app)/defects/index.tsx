/**
 * Global Defects Screen — app/(app)/defects/index.tsx
 * Cross-job view of all defects with filtering, status badges, and navigation to detail.
 */
import React, { useState, useCallback } from 'react';
import {
  View, StyleSheet, ScrollView, TouchableOpacity, FlatList, RefreshControl,
} from 'react-native';
import { Text, ActivityIndicator } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { router, useFocusEffect } from 'expo-router';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { useColors } from '@/hooks/useColors';
import { ScreenHeader } from '@/components/ui';
import { useDefectsStore } from '@/store/defectsStore';
import { DefectSeverity, DefectStatus } from '@/constants/Enums';
import { formatAssetType } from '@/utils/assetHelpers';
import type { Defect } from '@/types';
import { findDefectCode } from '@/constants/DefectCodes';
import * as Haptics from 'expo-haptics';

type ExtendedDefect = Defect & {
  asset_type?: string;
  location_on_site?: string;
  property_name?: string;
  scheduled_date?: string;
  job_type?: string;
};

// ─── Filter types ─────────────────────────────────────────
type SeverityFilter = 'all' | DefectSeverity;
type StatusFilter = 'all' | DefectStatus;

const SEVERITY_COLORS: Record<DefectSeverity, string> = {
  [DefectSeverity.Critical]: '#DC2626',
  [DefectSeverity.Major]:    '#EA580C',
  [DefectSeverity.Minor]:    '#2563EB',
};

const STATUS_COLORS: Record<DefectStatus, string> = {
  [DefectStatus.Open]:       '#DC2626',
  [DefectStatus.Monitoring]: '#D97706',
  [DefectStatus.Quoted]:     '#2563EB',
  [DefectStatus.Repaired]:   '#16A34A',
};

// ─── Defect Row Card ──────────────────────────────────────
function DefectRow({ defect, onPress, C }: { defect: ExtendedDefect; onPress: () => void; C: any }) {
  const sevColor = SEVERITY_COLORS[defect.severity as DefectSeverity] ?? C.textSecondary;
  const statusColor = STATUS_COLORS[defect.status as DefectStatus] ?? C.textSecondary;
  const codeInfo = defect.defect_code ? findDefectCode(defect.defect_code) : null;

  return (
    <TouchableOpacity
      style={[s.defectRow, { backgroundColor: C.surface, borderColor: C.border, borderLeftColor: sevColor }]}
      onPress={onPress}
      activeOpacity={0.78}
    >
      {/* Top row: severity + status */}
      <View style={s.rowTop}>
        <View style={[s.sevBadge, { backgroundColor: sevColor + '18' }]}>
          <Text style={[s.sevBadgeTxt, { color: sevColor }]}>
            {defect.severity.charAt(0).toUpperCase() + defect.severity.slice(1)}
          </Text>
        </View>
        {codeInfo && (
          <View style={[s.codeBadge, { backgroundColor: C.primary + '12', borderColor: C.primary + '30' }]}>
            <Text style={[s.codeBadgeTxt, { color: C.primary }]}>{codeInfo.code.toUpperCase()}</Text>
          </View>
        )}
        <View style={{ flex: 1 }} />
        <View style={[s.statusBadge, { borderColor: statusColor + '60' }]}>
          <Text style={[s.statusBadgeTxt, { color: statusColor }]}>
            {defect.status.charAt(0).toUpperCase() + defect.status.slice(1)}
          </Text>
        </View>
      </View>

      {/* Description */}
      <Text style={[s.description, { color: C.text }]} numberOfLines={2}>{defect.description}</Text>

      {/* Meta */}
      <View style={s.rowMeta}>
        {defect.property_name && (
          <View style={s.metaItem}>
            <MaterialCommunityIcons name="office-building-outline" size={12} color={C.textTertiary} />
            <Text style={[s.metaTxt, { color: C.textTertiary }]} numberOfLines={1}>{defect.property_name}</Text>
          </View>
        )}
        {defect.asset_type && (
          <View style={s.metaItem}>
            <MaterialCommunityIcons name="tools" size={12} color={C.textTertiary} />
            <Text style={[s.metaTxt, { color: C.textTertiary }]}>{formatAssetType(defect.asset_type)}</Text>
          </View>
        )}
        {defect.quote_price && (
          <View style={[s.pricePill, { backgroundColor: '#10B981' + '15' }]}>
            <Text style={s.pricePillTxt}>${defect.quote_price}</Text>
          </View>
        )}
        <Text style={[s.dateTxt, { color: C.textTertiary }]}>
          {new Date(defect.created_at).toLocaleDateString('en-AU', { day: 'numeric', month: 'short' })}
        </Text>
      </View>
    </TouchableOpacity>
  );
}

// ─── Filter pill ──────────────────────────────────────────
function FilterPill({ label, isActive, color, onPress, C }: any) {
  return (
    <TouchableOpacity
      style={[s.filterPill, {
        backgroundColor: isActive ? (color ?? C.primary) : C.backgroundTertiary,
        borderColor: isActive ? (color ?? C.primary) : C.border,
      }]}
      onPress={onPress}
      activeOpacity={0.78}
    >
      <Text style={[s.filterPillTxt, { color: isActive ? '#FFF' : C.textSecondary }]}>{label}</Text>
    </TouchableOpacity>
  );
}

// ─── Main Screen ──────────────────────────────────────────
export default function GlobalDefectsScreen() {
  const C = useColors();
  const { defects, isLoading, loadAllDefects } = useDefectsStore();
  const [severityFilter, setSeverityFilter] = useState<SeverityFilter>('all');
  const [statusFilter,   setStatusFilter]   = useState<StatusFilter>('all');

  const load = useCallback(() => {
    loadAllDefects();
  }, [loadAllDefects]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  // Apply filters
  const filtered = (defects as ExtendedDefect[]).filter(d => {
    if (severityFilter !== 'all' && d.severity !== severityFilter) return false;
    if (statusFilter   !== 'all' && d.status   !== statusFilter)   return false;
    return true;
  });

  const openCount     = defects.filter(d => d.status === DefectStatus.Open).length;
  const criticalCount = defects.filter(d => d.severity === DefectSeverity.Critical).length;

  return (
    <View style={[s.screen, { backgroundColor: C.background }]}>
      <ScreenHeader
        eyebrow="DEFECTS"
        title="All Defects"
        subtitle={`${defects.length} total · ${openCount} open · ${criticalCount} critical`}
        showBack
        curved
        rightComponent={
          openCount > 0 ? (
            <View style={[s.openCountBadge, { backgroundColor: 'rgba(220,38,38,0.2)', borderColor: 'rgba(220,38,38,0.4)' }]}>
              <Text style={s.openCountTxt}>{openCount} OPEN</Text>
            </View>
          ) : (
            <View style={[s.openCountBadge, { backgroundColor: 'rgba(74,222,128,0.2)', borderColor: 'rgba(74,222,128,0.4)' }]}>
              <Text style={[s.openCountTxt, { color: '#4ADE80' }]}>ALL CLEAR</Text>
            </View>
          )
        }
      />

      {/* Severity filters */}
      <Animated.View entering={FadeInDown.delay(40).duration(300)}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={s.filterRow}
        >
          <FilterPill label="All Severity" isActive={severityFilter === 'all'} onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); setSeverityFilter('all'); }} C={C} />
          <FilterPill label="🔴 Critical" isActive={severityFilter === DefectSeverity.Critical} color={SEVERITY_COLORS[DefectSeverity.Critical]} onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); setSeverityFilter(DefectSeverity.Critical); }} C={C} />
          <FilterPill label="🟡 Major" isActive={severityFilter === DefectSeverity.Major} color={SEVERITY_COLORS[DefectSeverity.Major]} onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); setSeverityFilter(DefectSeverity.Major); }} C={C} />
          <FilterPill label="🔵 Minor" isActive={severityFilter === DefectSeverity.Minor} color={SEVERITY_COLORS[DefectSeverity.Minor]} onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); setSeverityFilter(DefectSeverity.Minor); }} C={C} />
        </ScrollView>

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={[s.filterRow, { paddingTop: 0 }]}
        >
          <FilterPill label="All Status" isActive={statusFilter === 'all'} onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); setStatusFilter('all'); }} C={C} />
          <FilterPill label="Open" isActive={statusFilter === DefectStatus.Open} color={STATUS_COLORS[DefectStatus.Open]} onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); setStatusFilter(DefectStatus.Open); }} C={C} />
          <FilterPill label="Monitoring" isActive={statusFilter === DefectStatus.Monitoring} color={STATUS_COLORS[DefectStatus.Monitoring]} onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); setStatusFilter(DefectStatus.Monitoring); }} C={C} />
          <FilterPill label="Quoted" isActive={statusFilter === DefectStatus.Quoted} color={STATUS_COLORS[DefectStatus.Quoted]} onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); setStatusFilter(DefectStatus.Quoted); }} C={C} />
          <FilterPill label="Repaired" isActive={statusFilter === DefectStatus.Repaired} color={STATUS_COLORS[DefectStatus.Repaired]} onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); setStatusFilter(DefectStatus.Repaired); }} C={C} />
        </ScrollView>
      </Animated.View>

      {/* Result count */}
      <View style={[s.resultBar, { backgroundColor: C.backgroundTertiary }]}>
        <Text style={[s.resultTxt, { color: C.textTertiary }]}>
          {filtered.length} of {defects.length} defects
        </Text>
      </View>

      {isLoading ? (
        <View style={s.center}>
          <ActivityIndicator color={C.primary} size="large" />
        </View>
      ) : filtered.length === 0 ? (
        <View style={s.center}>
          <Text style={{ fontSize: 44 }}>{defects.length === 0 ? '🎉' : '🔍'}</Text>
          <Text style={[s.emptyTitle, { color: C.text }]}>
            {defects.length === 0 ? 'No defects on record' : 'No results match filters'}
          </Text>
          <Text style={[s.emptySub, { color: C.textSecondary }]}>
            {defects.length === 0
              ? 'All inspections are currently defect-free'
              : 'Try clearing your filters'}
          </Text>
        </View>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={item => item.id}
          contentContainerStyle={{ padding: 16, paddingBottom: 40 }}
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={isLoading} onRefresh={load} tintColor={C.primary} />}
          renderItem={({ item, index }) => (
            <Animated.View entering={FadeInDown.delay(index * 30).duration(350)}>
              <DefectRow
                defect={item as ExtendedDefect}
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  router.push(`/jobs/${item.job_id}/defects/${item.id}` as never);
                }}
                C={C}
              />
            </Animated.View>
          )}
        />
      )}
    </View>
  );
}

const s = StyleSheet.create({
  screen: { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 10 },

  openCountBadge: {
    paddingHorizontal: 10, paddingVertical: 6,
    borderRadius: 10, borderWidth: 1,
  },
  openCountTxt: { fontSize: 10, fontWeight: '800', color: '#F87171', letterSpacing: 0.5 },

  filterRow: {
    paddingHorizontal: 16, paddingVertical: 10, gap: 8,
  },
  filterPill: {
    paddingHorizontal: 14, paddingVertical: 7,
    borderRadius: 20, borderWidth: 1,
  },
  filterPillTxt: { fontSize: 12, fontWeight: '700' },

  resultBar: {
    paddingHorizontal: 16, paddingVertical: 6,
  },
  resultTxt: { fontSize: 11, fontWeight: '600', letterSpacing: 0.3 },

  defectRow: {
    borderRadius: 16, borderWidth: 1, borderLeftWidth: 4,
    padding: 14, marginBottom: 10,
    shadowColor: '#0D1526',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 2,
  },
  rowTop: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 8 },
  sevBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8 },
  sevBadgeTxt: { fontSize: 10, fontWeight: '800' },
  codeBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8, borderWidth: 1 },
  codeBadgeTxt: { fontSize: 10, fontWeight: '800' },
  statusBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8, borderWidth: 1 },
  statusBadgeTxt: { fontSize: 10, fontWeight: '700' },

  description: { fontSize: 13, lineHeight: 19, marginBottom: 10 },

  rowMeta: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 8 },
  metaItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  metaTxt:  { fontSize: 11, flex: 1, maxWidth: 120 },
  pricePill: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6 },
  pricePillTxt: { fontSize: 10, fontWeight: '800', color: '#10B981' },
  dateTxt: { fontSize: 11, marginLeft: 'auto' },

  emptyTitle: { fontSize: 16, fontWeight: '700', marginTop: 8 },
  emptySub:   { fontSize: 13, textAlign: 'center' },
});
