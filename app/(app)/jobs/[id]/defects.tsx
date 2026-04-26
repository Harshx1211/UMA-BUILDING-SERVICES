import React, { useEffect, useRef, useState, useMemo } from 'react';
import { View, StyleSheet, TouchableOpacity, FlatList, Platform } from 'react-native';
import { Text } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { useColors } from '@/hooks/useColors';
import { cardShadow } from '@/components/ui/Card';
import { DefectSeverity, DefectStatus } from '@/constants/Enums';
import { useDefectsStore } from '@/store/defectsStore';
import DefectCard from '@/components/defects/DefectCard';
import AddDefectSheet, { AddDefectSheetRef } from '@/components/defects/AddDefectSheet';
import { getJobById } from '@/lib/database';
import { SkeletonCard } from '@/components/ui/SkeletonCard';
import { ScreenHeader, EmptyState, FilterPills } from '@/components/ui';
import * as Haptics from 'expo-haptics';



export default function DefectsScreen() {
  const C = useColors();
  const { id: jobId } = useLocalSearchParams<{ id: string }>();
  const store = useDefectsStore();
  const [filter, setFilter] = useState<string>('All');
  const sheetRef = useRef<AddDefectSheetRef>(null);



  const [propertyId, setPropertyId] = useState<string>('');

  useEffect(() => {
    if (jobId) {
      store.loadDefects(jobId);
      const job = getJobById<{ property_id: string }>(jobId);
      if (job) setPropertyId(job.property_id);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [jobId]);

  const filteredDefects = useMemo(() => {
    let list = store.defects;
    if (filter === 'Critical')   list = list.filter(d => d.severity === DefectSeverity.Critical);
    if (filter === 'Major')      list = list.filter(d => d.severity === DefectSeverity.Major);
    if (filter === 'Minor')      list = list.filter(d => d.severity === DefectSeverity.Minor);
    if (filter === 'Open')       list = list.filter(d => d.status === DefectStatus.Open);
    if (filter === 'Quoted')     list = list.filter(d => d.status === DefectStatus.Quoted);
    if (filter === 'Monitoring') list = list.filter(d => d.status === DefectStatus.Monitoring);
    if (filter === 'Resolved')   list = list.filter(d => d.status === DefectStatus.Repaired);
    return list;
  }, [store.defects, filter]);

  if (store.isLoading) {
    return (
      <View style={[s.screen, { backgroundColor: C.background }]}>
        <ScreenHeader curved={true} title="Defects" showBack={true} />
        <View style={{ paddingTop: 24, gap: 12 }}>
          <SkeletonCard />
          <SkeletonCard />
          <SkeletonCard />
        </View>
      </View>
    );
  }

  // BUG 30 FIX: added Monitoring + Quoted so all DefectStatus values are filterable
  const filterOpts = ['All', 'Critical', 'Major', 'Minor', 'Open', 'Quoted', 'Monitoring', 'Resolved'];

  return (
    <View style={[s.screen, { backgroundColor: C.background }]}>
      <ScreenHeader
        curved={true}
        title="Defects"
        showBack={true}
        rightComponent={
          store.defects.length > 0 ? (
            <View style={[s.countBadge, { backgroundColor: 'rgba(255,255,255,0.2)' }]}>
              <Text style={s.countText}>{store.defects.length} defect{store.defects.length !== 1 ? 's' : ''}</Text>
            </View>
          ) : null
        }
      />

      <View style={s.filterRow}>
        <FilterPills
          options={filterOpts.map(t => ({ label: t }))}
          activeIndex={filterOpts.indexOf(filter)}
          onSelect={(idx) => setFilter(filterOpts[idx])}
          variant="dark"
        />
      </View>

      {/* BUG 15 FIX: check filteredDefects.length so empty state also shows when a filter matches nothing */}
      {filteredDefects.length === 0 ? (
        <EmptyState
          emoji={store.defects.length === 0 ? '🎉' : '🔍'}
          title={store.defects.length === 0 ? 'No defects found' : 'No matches'}
          subtitle={
            store.defects.length === 0
              ? 'Great work! No issues were raised for this job.'
              : `No defects match the "${filter}" filter.`
          }
        />
      ) : (
        <FlatList
          data={filteredDefects}
          keyExtractor={i => i.id}
          contentContainerStyle={{ paddingTop: 8, paddingBottom: 100 }}
          showsVerticalScrollIndicator={false}
          renderItem={({ item }) => (
            <DefectCard
              defect={item as any}
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                router.push(`/jobs/${jobId}/defects/${item.id}` as never);
              }}
            />
          )}
        />
      )}

      <TouchableOpacity style={[s.fab, { backgroundColor: C.accent }, cardShadow]} activeOpacity={0.9} onPress={() => sheetRef.current?.open()}>
        <MaterialCommunityIcons name="plus" size={28} color="#FFFFFF" />
      </TouchableOpacity>

      <AddDefectSheet ref={sheetRef} jobId={jobId as string} propertyId={propertyId} onSaved={() => store.loadDefects(jobId as string)} />
    </View>
  );
}

const s = StyleSheet.create({
  screen: { flex: 1 },
  countBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20 },
  countText:  { fontSize: 11, fontWeight: '700', color: '#FFFFFF' },
  filterRow:  { marginVertical: 8, paddingHorizontal: 16 },
  fab: {
    position: 'absolute',
    bottom: Platform.OS === 'ios' ? 40 : 28,
    right: 20,
    width: 56,
    height: 56,
    borderRadius: 28,
    justifyContent: 'center',
    alignItems: 'center',
  },
});

