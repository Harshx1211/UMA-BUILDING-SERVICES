/**
 * JobFilterModal — filter/group/sort for the top-level Jobs list. Mirrors
 * InspectionFilterModal's chrome (page-sheet, category tabs, Reset, bottom
 * bar) but scoped to Job fields that are already loaded client-side —
 * Status, Job Type, Priority, Technician. Asset-type/tag filtering is
 * deliberately NOT included here: jobs aren't tied to specific assets until
 * a technician actions them in the inspect screen, so filtering the job
 * list by asset type would need a new, lower-value join.
 */
import React, { useState } from 'react';
import { View, StyleSheet, Modal, TouchableOpacity, ScrollView, Platform } from 'react-native';
import { Text } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Button, chipsForMulti } from '@/components/ui';
import { useColors } from '@/hooks/useColors';
import { T } from '@/constants/Colors';

export type JobGroupBy = 'none' | 'property' | 'status' | 'technician';
export type JobSortBy = 'date' | 'priority' | 'property';

interface Props {
  visible: boolean;
  onClose: () => void;

  statusOptions: string[]; statusFilter: string[]; onStatusChange: (v: string[]) => void;
  jobTypeOptions: string[]; jobTypeFilter: string[]; onJobTypeChange: (v: string[]) => void;
  priorityOptions: string[]; priorityFilter: string[]; onPriorityChange: (v: string[]) => void;
  technicianOptions: string[]; technicianFilter: string[]; onTechnicianChange: (v: string[]) => void;

  groupBy: JobGroupBy; onGroupByChange: (v: JobGroupBy) => void;
  sortBy: JobSortBy; onSortByChange: (v: JobSortBy) => void;
  sortAsc: boolean; onToggleSortDirection: () => void;

  activeCount: number;
  onReset: () => void;

  /** Optional display-label formatter per category — filtering still happens on the raw value. */
  labelFormatters?: Partial<Record<'status' | 'jobType' | 'priority' | 'technician', (v: string) => string>>;
}

type IconName = React.ComponentProps<typeof MaterialCommunityIcons>['name'];

function Section({ icon, label, children }: { icon: IconName; label: string; children: React.ReactNode }) {
  const C = useColors();
  return (
    <View style={s.section}>
      <View style={s.sectionHeader}>
        <MaterialCommunityIcons name={icon} size={15} color={C.textTertiary} />
        <Text style={[s.sectionLabel, { color: C.textSecondary }]}>{label}</Text>
      </View>
      <View style={s.chipWrap}>{children}</View>
    </View>
  );
}

const CATEGORY_DEFS: { key: 'status' | 'jobType' | 'priority' | 'technician'; icon: IconName; label: string }[] = [
  { key: 'status',     icon: 'progress-clock',      label: 'Status' },
  { key: 'jobType',    icon: 'wrench-outline',      label: 'Job Type' },
  { key: 'priority',   icon: 'lightning-bolt',      label: 'Priority' },
  { key: 'technician', icon: 'account-outline',     label: 'Technician' },
];

export default function JobFilterModal({
  visible, onClose,
  statusOptions, statusFilter, onStatusChange,
  jobTypeOptions, jobTypeFilter, onJobTypeChange,
  priorityOptions, priorityFilter, onPriorityChange,
  technicianOptions, technicianFilter, onTechnicianChange,
  groupBy, onGroupByChange,
  sortBy, onSortByChange, sortAsc, onToggleSortDirection,
  activeCount, onReset,
  labelFormatters,
}: Props) {
  const C = useColors();
  const insets = useSafeAreaInsets();
  const [activeCategory, setActiveCategory] = useState<typeof CATEGORY_DEFS[number]['key']>('status');

  const categoryData: Record<string, { options: string[]; value: string[]; onChange: (v: string[]) => void; formatLabel?: (v: string) => string }> = {
    status:     { options: statusOptions,     value: statusFilter,     onChange: onStatusChange,     formatLabel: labelFormatters?.status },
    jobType:    { options: jobTypeOptions,    value: jobTypeFilter,    onChange: onJobTypeChange,    formatLabel: labelFormatters?.jobType },
    priority:   { options: priorityOptions,   value: priorityFilter,   onChange: onPriorityChange,   formatLabel: labelFormatters?.priority },
    technician: { options: technicianOptions, value: technicianFilter, onChange: onTechnicianChange, formatLabel: labelFormatters?.technician },
  };
  const availableCategories = CATEGORY_DEFS.filter(c => categoryData[c.key].options.length > 2);
  const currentKey = availableCategories.some(c => c.key === activeCategory) ? activeCategory : availableCategories[0]?.key;
  const current = currentKey ? categoryData[currentKey] : null;

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <View style={[s.container, { backgroundColor: C.background }]}>
        <View style={[s.header, { backgroundColor: C.surface, paddingTop: Math.max(insets.top, 16), borderBottomWidth: 1, borderBottomColor: C.border }]}>
          <View style={s.headerLeft}>
            <View style={[s.headerIconCircle, { backgroundColor: C.primary + '1A' }]}>
              <MaterialCommunityIcons name="tune-variant" size={17} color={C.primary} />
            </View>
            <Text style={[s.headerTitle, { color: C.text }]}>Filters</Text>
          </View>
          <View style={s.headerRight}>
            <TouchableOpacity onPress={onReset} disabled={activeCount === 0} hitSlop={12}>
              <Text style={[s.resetTxt, { color: activeCount === 0 ? C.textTertiary : C.error }]}>Reset</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={onClose} style={[s.headerIconBtn, { backgroundColor: C.backgroundTertiary, borderColor: C.border }]} hitSlop={10}>
              <MaterialCommunityIcons name="close" size={20} color={C.text} />
            </TouchableOpacity>
          </View>
        </View>

        <ScrollView contentContainerStyle={s.body} showsVerticalScrollIndicator={false}>
          {availableCategories.length > 0 && current && (
            <View style={s.section}>
              <View style={s.sectionHeader}>
                <MaterialCommunityIcons name="filter-variant" size={15} color={C.textTertiary} />
                <Text style={[s.sectionLabel, { color: C.textSecondary }]}>Filter By</Text>
              </View>
              <View style={[s.categoryTabRow, { borderBottomColor: C.border }]}>
                {availableCategories.map(cat => {
                  const active = cat.key === currentKey;
                  const hasFilter = categoryData[cat.key].value.length > 0;
                  return (
                    <TouchableOpacity
                      key={cat.key}
                      onPress={() => setActiveCategory(cat.key)}
                      style={[s.categoryTab, active && { borderBottomColor: C.primary }]}
                    >
                      <MaterialCommunityIcons name={cat.icon} size={14} color={active ? C.primary : C.textTertiary} />
                      <Text style={[s.categoryTabTxt, { color: active ? C.primary : C.textSecondary, fontWeight: active ? '800' : '600' }]}>{cat.label}</Text>
                      {hasFilter && <View style={[s.categoryDot, { backgroundColor: C.primary }]} />}
                    </TouchableOpacity>
                  );
                })}
              </View>
              <View style={s.chipWrap}>
                {chipsForMulti(current.options, current.value, current.onChange, current.formatLabel)}
              </View>
            </View>
          )}

          <View style={[s.divider, { backgroundColor: C.border }]} />

          <Section icon="format-list-group" label="Group By">
            <View style={s.pillRow}>
              {([
                { key: 'none' as const, icon: 'view-agenda-outline' as IconName, label: 'None' },
                { key: 'property' as const, icon: 'office-building-outline' as IconName, label: 'Property' },
                { key: 'status' as const, icon: 'progress-clock' as IconName, label: 'Status' },
                { key: 'technician' as const, icon: 'account-outline' as IconName, label: 'Technician' },
              ]).map(opt => {
                const active = groupBy === opt.key;
                return (
                  <TouchableOpacity
                    key={opt.key}
                    onPress={() => onGroupByChange(opt.key)}
                    style={[s.pillBtn, { borderColor: active ? C.primary : C.border, backgroundColor: active ? C.primary : C.background }]}
                  >
                    <MaterialCommunityIcons name={opt.icon} size={14} color={active ? '#fff' : C.textTertiary} />
                    <Text style={[s.pillTxt, { color: active ? '#fff' : C.textSecondary }]}>{opt.label}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </Section>

          <Section icon="sort" label="Sort By">
            <View style={s.pillRow}>
              {([
                { key: 'date' as const, icon: 'calendar-outline' as IconName, label: 'Date' },
                { key: 'priority' as const, icon: 'lightning-bolt' as IconName, label: 'Priority' },
                { key: 'property' as const, icon: 'office-building-outline' as IconName, label: 'Property' },
              ]).map(opt => {
                const active = sortBy === opt.key;
                return (
                  <TouchableOpacity
                    key={opt.key}
                    onPress={() => active ? onToggleSortDirection() : onSortByChange(opt.key)}
                    style={[s.pillBtn, { borderColor: active ? C.primary : C.border, backgroundColor: active ? C.primary : C.background }]}
                  >
                    <MaterialCommunityIcons name={opt.icon} size={14} color={active ? '#fff' : C.textTertiary} />
                    <Text style={[s.pillTxt, { color: active ? '#fff' : C.textSecondary }]}>{opt.label}</Text>
                    {active && (
                      <MaterialCommunityIcons name={sortAsc ? 'arrow-up' : 'arrow-down'} size={13} color="#fff" />
                    )}
                  </TouchableOpacity>
                );
              })}
            </View>
          </Section>
        </ScrollView>

        <View style={[s.bottomBar, { backgroundColor: C.surface, borderTopColor: C.border, paddingBottom: 20 + insets.bottom }]}>
          <Button title={activeCount > 0 ? `Show Results (${activeCount} active)` : 'Done'} onPress={onClose} />
        </View>
      </View>
    </Modal>
  );
}

const s = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 20, paddingBottom: 16,
  },
  headerLeft: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  headerRight: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  headerIconCircle: { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center' },
  headerIconBtn: { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center', borderWidth: 1 },
  headerTitle: { fontSize: 18, fontWeight: '900', letterSpacing: -0.4 },
  resetTxt: { fontSize: 13, fontWeight: '700' },
  body: { padding: 20, paddingBottom: 40 },
  section: { marginBottom: 22 },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 10 },
  sectionLabel: { fontSize: 12, fontWeight: '800', letterSpacing: 0.3, textTransform: 'uppercase' },
  chipWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  categoryTabRow: { flexDirection: 'row', flexWrap: 'wrap', borderBottomWidth: 1, marginBottom: 14 },
  categoryTab: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 10, paddingBottom: 10, marginBottom: -1, borderBottomWidth: 2, borderBottomColor: 'transparent' },
  categoryTabTxt: { fontSize: 13 },
  categoryDot: { width: 5, height: 5, borderRadius: 3 },
  divider: { height: 1, marginBottom: 22 },
  pillRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  pillBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 14, paddingVertical: 10, borderRadius: 999, borderWidth: 1 },
  pillTxt: { fontSize: 13, fontWeight: '700' },
  bottomBar: {
    paddingHorizontal: 20, paddingTop: 14,
    paddingBottom: Platform.OS === 'ios' ? 36 : 20,
    borderTopWidth: 1,
    shadowColor: T.black, shadowOffset: { width: 0, height: -8 }, shadowOpacity: 0.12, shadowRadius: 16, elevation: 16,
  },
});
