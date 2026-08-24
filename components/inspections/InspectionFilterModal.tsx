import React from 'react';
import { View, StyleSheet, Modal, TouchableOpacity, ScrollView, Platform } from 'react-native';
import { Text } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Button, FilterPills } from '@/components/ui';
import { useColors } from '@/hooks/useColors';
import { T } from '@/constants/Colors';

export type GroupBy = 'routine' | 'asset';
export type SortBy = 'label' | 'location';

interface Props {
  visible: boolean;
  onClose: () => void;

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

function Section({ label, children }: { label: string; children: React.ReactNode }) {
  const C = useColors();
  return (
    <View style={s.section}>
      <Text style={[s.sectionLabel, { color: C.text }]}>{label}</Text>
      {children}
    </View>
  );
}

export default function InspectionFilterModal({
  visible, onClose,
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

  const pillsFor = (options: string[], value: string, onChange: (v: string) => void) => (
    <FilterPills
      options={options.map(o => ({ label: o }))}
      activeIndex={options.findIndex(o => o === value)}
      onSelect={(idx) => onChange(options[idx])}
      variant="dark"
    />
  );

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <View style={[s.container, { backgroundColor: C.background }]}>
        <View style={[s.header, { backgroundColor: C.surface, paddingTop: Math.max(insets.top, 16), borderBottomWidth: 1, borderBottomColor: C.border }]}>
          <TouchableOpacity onPress={onClose} style={[s.headerIconBtn, { backgroundColor: C.backgroundTertiary, borderColor: C.border }]} hitSlop={12}>
            <MaterialCommunityIcons name="close" size={22} color={C.text} />
          </TouchableOpacity>
          <Text style={[s.headerTitle, { color: C.text }]}>Filters</Text>
          <TouchableOpacity onPress={onReset} disabled={activeCount === 0} hitSlop={12} style={{ width: 60, alignItems: 'flex-end' }}>
            <Text style={[s.resetTxt, { color: activeCount === 0 ? C.textTertiary : C.error }]}>Reset</Text>
          </TouchableOpacity>
        </View>

        <ScrollView contentContainerStyle={s.body} showsVerticalScrollIndicator={false}>
          {routineOptions.length > 2 && (
            <Section label="Routines">{pillsFor(routineOptions, routineFilter, onRoutineChange)}</Section>
          )}
          {assetTypeOptions.length > 2 && (
            <Section label="Asset Types">{pillsFor(assetTypeOptions, assetTypeFilter, onAssetTypeChange)}</Section>
          )}
          {tagOptions.length > 2 && (
            <Section label="Asset Tags">{pillsFor(tagOptions, tagFilter, onTagChange)}</Section>
          )}
          {locationOptions.length > 2 && (
            <Section label="Location">{pillsFor(locationOptions, locationFilter, onLocationChange)}</Section>
          )}

          <Section label="Group By">
            <View style={s.segmentRow}>
              {(['asset', 'routine'] as const).map(opt => {
                const active = groupBy === opt;
                return (
                  <TouchableOpacity
                    key={opt}
                    onPress={() => onGroupByChange(opt)}
                    style={[s.segmentBtn, { borderColor: active ? C.primary : C.border, backgroundColor: active ? C.primary : C.backgroundTertiary }]}
                  >
                    <Text style={[s.segmentTxt, { color: active ? '#fff' : C.textSecondary }]}>
                      {opt === 'asset' ? 'Asset' : 'Routine'}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </Section>

          <Section label="Sort By">
            <View style={s.segmentRow}>
              {(['label', 'location'] as const).map(opt => {
                const active = sortBy === opt;
                return (
                  <TouchableOpacity
                    key={opt}
                    onPress={() => onSortByChange(opt)}
                    style={[s.segmentBtn, { borderColor: active ? C.primary : C.border, backgroundColor: active ? C.primary : C.backgroundTertiary }]}
                  >
                    <Text style={[s.segmentTxt, { color: active ? '#fff' : C.textSecondary }]}>
                      {opt === 'label' ? 'Asset Label' : 'Location'}
                    </Text>
                  </TouchableOpacity>
                );
              })}
              <TouchableOpacity
                onPress={onToggleSortDirection}
                style={[s.segmentBtn, { flex: 0, width: 44, borderColor: C.border, backgroundColor: C.backgroundTertiary }]}
              >
                <MaterialCommunityIcons name={sortAsc ? 'sort-ascending' : 'sort-descending'} size={18} color={C.textSecondary} />
              </TouchableOpacity>
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
    paddingHorizontal: 20, paddingBottom: 18,
  },
  headerIconBtn: {
    width: 40, height: 40, borderRadius: 20,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1,
  },
  headerTitle: { fontSize: 20, fontWeight: '900', letterSpacing: -0.4 },
  resetTxt: { fontSize: 14, fontWeight: '700' },
  body: { padding: 16, paddingBottom: 40, gap: 4 },
  section: { marginBottom: 20 },
  sectionLabel: { fontSize: 13, fontWeight: '800', marginBottom: 8, letterSpacing: -0.1 },
  segmentRow: { flexDirection: 'row', gap: 8 },
  segmentBtn: { flex: 1, paddingVertical: 11, borderRadius: 10, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  segmentTxt: { fontSize: 13, fontWeight: '700' },
  bottomBar: {
    paddingHorizontal: 20, paddingTop: 14,
    paddingBottom: Platform.OS === 'ios' ? 36 : 20,
    borderTopWidth: 1,
    shadowColor: T.black, shadowOffset: { width: 0, height: -8 }, shadowOpacity: 0.12, shadowRadius: 16, elevation: 16,
  },
});
