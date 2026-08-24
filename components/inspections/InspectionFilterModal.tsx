import React from 'react';
import { View, StyleSheet, Modal, TouchableOpacity, ScrollView, Platform } from 'react-native';
import { Text } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Button } from '@/components/ui';
import { useColors } from '@/hooks/useColors';
import { T } from '@/constants/Colors';

export type GroupBy = 'routine' | 'asset';
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

function Chip({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
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
      <Text style={[s.chipText, { color: active ? '#fff' : C.textSecondary }]} numberOfLines={1}>{label}</Text>
    </TouchableOpacity>
  );
}

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

  const chipsFor = (options: string[], value: string, onChange: (v: string) => void) =>
    options.map(o => <Chip key={o} label={o} active={o === value} onPress={() => onChange(o)} />);

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

          {routineOptions.length > 2 && (
            <Section icon="clipboard-list-outline" label="Routines">{chipsFor(routineOptions, routineFilter, onRoutineChange)}</Section>
          )}
          {assetTypeOptions.length > 2 && (
            <Section icon="shape-outline" label="Asset Types">{chipsFor(assetTypeOptions, assetTypeFilter, onAssetTypeChange)}</Section>
          )}
          {tagOptions.length > 2 && (
            <Section icon="tag-multiple-outline" label="Asset Tags">{chipsFor(tagOptions, tagFilter, onTagChange)}</Section>
          )}
          {locationOptions.length > 2 && (
            <Section icon="map-marker-outline" label="Location">{chipsFor(locationOptions, locationFilter, onLocationChange)}</Section>
          )}

          <View style={[s.divider, { backgroundColor: C.border }]} />

          <Section icon="format-list-group" label="Group By">
            <View style={s.segmentRow}>
              {(['asset', 'routine'] as const).map(opt => {
                const active = groupBy === opt;
                return (
                  <TouchableOpacity
                    key={opt}
                    onPress={() => onGroupByChange(opt)}
                    style={[s.segmentBtn, { borderColor: active ? C.primary : C.border, backgroundColor: active ? C.primary : C.background }]}
                  >
                    <MaterialCommunityIcons name={opt === 'asset' ? 'cube-outline' : 'clipboard-list-outline'} size={14} color={active ? '#fff' : C.textTertiary} />
                    <Text style={[s.segmentTxt, { color: active ? '#fff' : C.textSecondary }]}>
                      {opt === 'asset' ? 'Asset' : 'Routine'}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </Section>

          <Section icon="sort" label="Sort By">
            <View style={s.segmentRow}>
              {(['label', 'location'] as const).map(opt => {
                const active = sortBy === opt;
                return (
                  <TouchableOpacity
                    key={opt}
                    onPress={() => onSortByChange(opt)}
                    style={[s.segmentBtn, { borderColor: active ? C.primary : C.border, backgroundColor: active ? C.primary : C.background }]}
                  >
                    <MaterialCommunityIcons name={opt === 'label' ? 'text' : 'map-marker-outline'} size={14} color={active ? '#fff' : C.textTertiary} />
                    <Text style={[s.segmentTxt, { color: active ? '#fff' : C.textSecondary }]}>
                      {opt === 'label' ? 'Asset Label' : 'Location'}
                    </Text>
                  </TouchableOpacity>
                );
              })}
              <TouchableOpacity
                onPress={onToggleSortDirection}
                style={[s.segmentBtn, { flex: 0, width: 44, borderColor: C.border, backgroundColor: C.background }]}
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
  divider: { height: 1, marginBottom: 22 },
  segmentRow: { flexDirection: 'row', gap: 8 },
  segmentBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 11, borderRadius: 10, borderWidth: 1 },
  segmentTxt: { fontSize: 13, fontWeight: '700' },
  bottomBar: {
    paddingHorizontal: 20, paddingTop: 14,
    paddingBottom: Platform.OS === 'ios' ? 36 : 20,
    borderTopWidth: 1,
    shadowColor: T.black, shadowOffset: { width: 0, height: -8 }, shadowOpacity: 0.12, shadowRadius: 16, elevation: 16,
  },
});
