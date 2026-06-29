import { useState, useEffect, useCallback } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  TextInput, RefreshControl,
} from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '@/hooks/useAuth';
import { useJobsStore } from '@/store/jobsStore';
import { onSyncComplete, offSyncComplete, runSync } from '@/lib/sync';
import { C } from '@/constants/Config';
import { JobStatus, Priority } from '@/constants/Enums';
import type { Job } from '@/types';

type FilterTab = 'today' | 'week' | 'all';

const PRIORITY_COLOR: Record<string, string> = {
  urgent: C.danger, high: C.warning, normal: C.info, low: C.textMuted,
};
const STATUS_LABEL: Record<string, string> = {
  scheduled: 'Scheduled', in_progress: 'In Progress', completed: 'Done', cancelled: 'Cancelled',
};
const STATUS_COLOR: Record<string, string> = {
  scheduled: C.info, in_progress: C.accent, completed: C.success, cancelled: C.textMuted,
};

export default function ScheduleScreen() {
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const { jobs, loadJobs } = useJobsStore();
  const [filter, setFilter] = useState<FilterTab>('today');
  const [search, setSearch]  = useState('');
  const [refreshing, setRefreshing] = useState(false);

  const today = new Date().toISOString().slice(0, 10);
  const weekEnd = new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10);

  useEffect(() => {
    if (user) loadJobs(user.id);
    const fn = () => { if (user) loadJobs(user.id); };
    onSyncComplete(fn);
    return () => offSyncComplete(fn);
  }, [user]);

  type JobWithJoins = Job & { property_name?: string; address?: string };

  const filtered = jobs.filter((j: Job) => {
    if (filter === 'today' && j.scheduled_date !== today) return false;
    if (filter === 'week' && (j.scheduled_date < today || j.scheduled_date > weekEnd)) return false;
    if (search.trim()) {
      const q = search.toLowerCase();
      const jj = j as JobWithJoins;
      const name = (jj.property_name ?? '').toLowerCase();
      const addr = (jj.address ?? '').toLowerCase();
      if (!name.includes(q) && !addr.includes(q)) return false;
    }
    return true;
  }).sort((a: Job, b: Job) => {
    const statusOrder = (s: string) =>
      s === 'in_progress' ? 0 : s === 'scheduled' ? 1 : s === 'completed' ? 2 : 3;
    const so = statusOrder(a.status) - statusOrder(b.status);
    if (so !== 0) return so;
    return a.scheduled_date.localeCompare(b.scheduled_date);
  });

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await runSync();
    setRefreshing(false);
  }, []);

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>Schedule</Text>
        <Text style={styles.count}>{filtered.length} job{filtered.length !== 1 ? 's' : ''}</Text>
      </View>

      {/* Filter tabs */}
      <View style={styles.filterRow}>
        {(['today','week','all'] as FilterTab[]).map(f => (
          <TouchableOpacity
            key={f}
            style={[styles.filterTab, filter === f && styles.filterTabActive]}
            onPress={() => setFilter(f)}
          >
            <Text style={[styles.filterTabText, filter === f && styles.filterTabTextActive]}>
              {f === 'today' ? 'Today' : f === 'week' ? 'This Week' : 'All Jobs'}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Search */}
      <View style={styles.searchWrap}>
        <Text style={styles.searchIcon}>🔍</Text>
        <TextInput
          style={styles.searchInput}
          placeholder="Search property or address…"
          placeholderTextColor={C.textMuted}
          value={search}
          onChangeText={setSearch}
        />
        {search.length > 0 && (
          <TouchableOpacity onPress={() => setSearch('')}>
            <Text style={styles.clearBtn}>✕</Text>
          </TouchableOpacity>
        )}
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={C.accent} />}
        contentContainerStyle={styles.scroll}
      >
        {filtered.length === 0 ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyIcon}>📋</Text>
            <Text style={styles.emptyTitle}>No jobs found</Text>
            <Text style={styles.emptyText}>
              {search ? 'Try a different search term.' : 'No jobs scheduled for this period.'}
            </Text>
          </View>
        ) : (
          filtered.map(job => <ScheduleJobCard key={job.id} job={job} />)
        )}
      </ScrollView>
    </View>
  );
}

type JobWithJoins2 = Job & { property_name?: string; address?: string; suburb?: string; state?: string };

function ScheduleJobCard({ job }: { job: Job }) {
  const j = job as JobWithJoins2;
  return (
    <TouchableOpacity
      style={styles.card}
      onPress={() => router.push(`/(app)/jobs/${job.id}/`)}
      activeOpacity={0.85}
    >
      <View style={[styles.priorityBar, { backgroundColor: PRIORITY_COLOR[job.priority] }]} />
      <View style={styles.cardBody}>
        <View style={styles.cardRow}>
          <Text style={styles.propName} numberOfLines={1}>
            {j.property_name ?? 'Unknown Property'}
          </Text>
          <Text style={[styles.statusDot, { color: STATUS_COLOR[job.status] }]}>●</Text>
          <Text style={[styles.statusLabel, { color: STATUS_COLOR[job.status] }]}>
            {STATUS_LABEL[job.status]}
          </Text>
        </View>
        <Text style={styles.address} numberOfLines={1}>
          {[j.address, j.suburb, j.state].filter(Boolean).join(', ')}
        </Text>
        <View style={styles.metaRow}>
          <Text style={styles.metaText}>📅 {job.scheduled_date}</Text>
          {job.scheduled_time && <Text style={styles.metaText}>  🕐 {job.scheduled_time}</Text>}
          <View style={[styles.priorityChip, { borderColor: PRIORITY_COLOR[job.priority] }]}>
            <Text style={[styles.priorityText, { color: PRIORITY_COLOR[job.priority] }]}>
              {job.priority.toUpperCase()}
            </Text>
          </View>
        </View>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container:         { flex: 1, backgroundColor: C.primary },
  header:            {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 20, paddingVertical: 14, backgroundColor: C.surface,
    borderBottomWidth: 1, borderBottomColor: C.border,
  },
  title:             { color: C.textLight, fontSize: 22, fontWeight: '800' },
  count:             { color: C.textMuted, fontSize: 13 },
  filterRow:         {
    flexDirection: 'row', paddingHorizontal: 16, paddingTop: 12, paddingBottom: 4, gap: 8,
  },
  filterTab:         {
    flex: 1, paddingVertical: 8, borderRadius: 10, alignItems: 'center',
    backgroundColor: C.surface, borderWidth: 1, borderColor: C.border,
  },
  filterTabActive:   { backgroundColor: C.accent, borderColor: C.accent },
  filterTabText:     { color: C.textMuted, fontSize: 12, fontWeight: '600' },
  filterTabTextActive: { color: '#fff' },
  searchWrap:        {
    flexDirection: 'row', alignItems: 'center', backgroundColor: C.surface,
    marginHorizontal: 16, marginTop: 10, borderRadius: 12, borderWidth: 1,
    borderColor: C.border, paddingHorizontal: 12, paddingVertical: 10,
  },
  searchIcon:        { fontSize: 14, marginRight: 8 },
  searchInput:       { flex: 1, color: C.textLight, fontSize: 14 },
  clearBtn:          { color: C.textMuted, fontSize: 16, paddingLeft: 8 },
  scroll:            { padding: 16, paddingBottom: 32 },
  emptyState:        {
    alignItems: 'center', paddingVertical: 60,
    backgroundColor: C.surface, borderRadius: 16,
    borderWidth: 1, borderColor: C.border,
  },
  emptyIcon:         { fontSize: 40, marginBottom: 12 },
  emptyTitle:        { color: C.textLight, fontSize: 16, fontWeight: '700', marginBottom: 4 },
  emptyText:         { color: C.textMuted, fontSize: 13 },
  card:              {
    backgroundColor: C.surface, borderRadius: 16, borderWidth: 1,
    borderColor: C.border, flexDirection: 'row', overflow: 'hidden', marginBottom: 10,
  },
  priorityBar:       { width: 4 },
  cardBody:          { flex: 1, padding: 14 },
  cardRow:           { flexDirection: 'row', alignItems: 'center', marginBottom: 4 },
  propName:          { color: C.textLight, fontSize: 15, fontWeight: '700', flex: 1 },
  statusDot:         { fontSize: 8, marginRight: 4 },
  statusLabel:       { fontSize: 11, fontWeight: '600' },
  address:           { color: C.textMuted, fontSize: 12, marginBottom: 8 },
  metaRow:           { flexDirection: 'row', alignItems: 'center' },
  metaText:          { color: C.textMuted, fontSize: 11 },
  priorityChip:      {
    marginLeft: 'auto' as any, borderRadius: 6, borderWidth: 1,
    paddingHorizontal: 6, paddingVertical: 2,
  },
  priorityText:      { fontSize: 9, fontWeight: '700' },
});
