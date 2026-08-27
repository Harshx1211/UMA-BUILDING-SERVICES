import React, { useState } from 'react';
import { View, StyleSheet, Modal, TouchableOpacity, ScrollView, Platform } from 'react-native';
import { Text } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Button } from '@/components/ui';
import { useColors } from '@/hooks/useColors';
import { T } from '@/constants/Colors';
import { formatLocationCode } from '@/utils/assetHelpers';

export type GroupBy = 'routine' | 'asset' | 'location';
export type SortBy = 'label' | 'location';

interface Props {
  visible: boolean;
  onClose: () => void;

  resultOptions: string[];
  resultFilter: string;
  onResultChange: (v: string) => void;

  routineOptions: string[];
  routineFilter: string;
  onRoutineChange: (v: string) => void;

  assetTypeOptions: string[];
  assetTypeFilter: string;
  onAssetTypeChange: (v: string) => void;

  tagOptions: string[];
  tagFilter: string;
  onTagChange: (v: string) => void;

  locationOptions: string[];
  locationFilter: string;
  onLocationChange: (v: string) => void;

  groupBy: GroupBy;
  onGroupByChange: (v: GroupBy) => void;

  sortBy: SortBy;
  onSortByChange: (v: SortBy) => void;
  sortAsc: boolean;
  onToggleSortDirection: () => void;

  activeCount: number;
  onReset: () => void;
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

function Chip({ label, displayLabel, active, onPress }: { label: string; displayLabel?: string; active: boolean; onPress: () => void }) {
  const C = useColors();
  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.75}
      style={[
        s.chip,
        { backgroundColor: active ? C.primary : C.background, borderColor: active ? C.primary : C.border },
      ]}
    >
      {active && <MaterialCommunityIcons name="check" size={13} color="#fff" style={{ marginRight: 4 }} />}
      <Text style={[s.chipText, { color: active ? '#fff' : C.textSecondary }]} numberOfLines={1}>{displayLabel ?? label}</Text>
    </TouchableOpacity>
  );
}

const CATEGORY_DEFS: { key: 'routine' | 'assetType' | 'tag' | 'location'; icon: IconName; label: string }[] = [
  { key: 'routine',   icon: 'clipboard-list-outline', label: 'Routine' },
  { key: 'assetType', icon: 'shape-outline',           label: 'Type' },
  { key: 'tag',       icon: 'tag-multiple-outline',    label: 'Tag' },
  { key: 'location',  icon: 'map-marker-outline',      label: 'Location' },
];

export default function InspectionFilterModal({
  visible, onClose,
  resultOptions, resultFilter, onResultChange,
  routineOptions, routineFilter, onRoutineChange,
  assetTypeOptions, assetTypeFilter, onAssetTypeChange,
  tagOptions, tagFilter, onTagChange,
  locationOptions, locationFilter, onLocationChange,
  groupBy, onGroupByChange,
  sortBy, onSortByChange, sortAsc, onToggleSortDirection,
  activeCount, onReset,
}: Props) {
  const C = useColors();
  const insets = useSafeAreaInsets();
  const [activeCategory, setActiveCategory] = useState<typeof CATEGORY_DEFS[number]['key']>('routine');

  const chipsFor = (options: string[], value: string, onChange: (v: string) => void, formatLabel?: (v: string) => string) =>
    options.map(o => <Chip key={o} label={o} displayLabel={formatLabel?.(o)} active={o === value} onPress={() => onChange(o)} />);

  const categoryData: Record<string, { options: string[]; value: string; onChange: (v: string) => void }> = {
    routine:   { options: routineOptions,   value: routineFilter,   onChange: onRoutineChange },
    assetType: { options: assetTypeOptions, value: assetTypeFilter, onChange: onAssetTypeChange },
    tag:       { options: tagOptions,       value: tagFilter,       onChange: onTagChange },
    location:  { options: locationOptions,  value: locationFilter,  onChange: onLocationChange },
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
          <Section icon="check-decagram-outline" label="Result">{chipsFor(resultOptions, resultFilter, onResultChange)}</Section>

          <View style={[s.divider, { backgroundColor: C.border }]} />

          {availableCategories.length > 0 && current && (
            <View style={s.section}>
              <View style={s.sectionHeader}>
                <MaterialCommunityIcons name="filter-variant" size={15} color={C.textTertiary} />
                <Text style={[s.sectionLabel, { color: C.textSecondary }]}>Filter By</Text>
              </View>
              <View style={[s.categoryTabRow, { borderBottomColor: C.border }]}>
                {availableCategories.map(cat => {
                  const active = cat.key === currentKey;
                  const hasFilter = categoryData[cat.key].value !== categoryData[cat.key].options[0];
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
                {chipsFor(current.options, current.value, current.onChange, currentKey === 'location' ? formatLocationCode : undefined)}
              </View>
            </View>
          )}

          <View style={[s.divider, { backgroundColor: C.border }]} />

          <Section icon="format-list-group" label="Group By">
            <View style={s.pillRow}>
              {(['asset', 'routine', 'location'] as const).map(opt => {
                const active = groupBy === opt;
                const icon = opt === 'asset' ? 'cube-outline' : opt === 'routine' ? 'clipboard-list-outline' : 'map-marker-outline';
                const label = opt === 'asset' ? 'Asset' : opt === 'routine' ? 'Routine' : 'Location';
                return (
                  <TouchableOpacity
                    key={opt}
                    onPress={() => onGroupByChange(opt)}
                    style={[s.pillBtn, { borderColor: active ? C.primary : C.border, backgroundColor: active ? C.primary : C.background }]}
                  >
                    <MaterialCommunityIcons name={icon} size={14} color={active ? '#fff' : C.textTertiary} />
                    <Text style={[s.pillTxt, { color: active ? '#fff' : C.textSecondary }]}>{label}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </Section>

          <Section icon="sort" label="Sort By">
            <View style={s.pillRow}>
              {(['label', 'location'] as const).map(opt => {
                const active = sortBy === opt;
                return (
                  <TouchableOpacity
                    key={opt}
                    onPress={() => active ? onToggleSortDirection() : onSortByChange(opt)}
                    style={[s.pillBtn, { borderColor: active ? C.primary : C.border, backgroundColor: active ? C.primary : C.background }]}
                  >
                    <MaterialCommunityIcons name={opt === 'label' ? 'text' : 'map-marker-outline'} size={14} color={active ? '#fff' : C.textTertiary} />
                    <Text style={[s.pillTxt, { color: active ? '#fff' : C.textSecondary }]}>
                      {opt === 'label' ? 'Label' : 'Location'}
                    </Text>
                    {active && (
                      <MaterialCommunityIcons name={sortAsc ? 'arrow-up' : 'arrow-down'} size={13} color="#fff" />
                    )}
                  </TouchableOpacity>
                );
              })}
            </View>
          </Section>
        </ScrollView>

        <View style={[s.bottomBar, { backgroundColor: C.surface, borderTopColor: C.border }]}>
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
  headerIconCircle: {
    width: 34, height: 34, borderRadius: 17,
    alignItems: 'center', justifyContent: 'center',
  },
  headerIconBtn: {
    width: 34, height: 34, borderRadius: 17,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1,
  },
  headerTitle: { fontSize: 18, fontWeight: '900', letterSpacing: -0.4 },
  resetTxt: { fontSize: 13, fontWeight: '700' },
  body: { padding: 20, paddingBottom: 40 },
  section: { marginBottom: 22 },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 10 },
  sectionLabel: { fontSize: 12, fontWeight: '800', letterSpacing: 0.3, textTransform: 'uppercase' },
  chipWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 14, paddingVertical: 9,
    borderRadius: 999, borderWidth: 1,
  },
  chipText: { fontSize: 13, fontWeight: '600' },
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
