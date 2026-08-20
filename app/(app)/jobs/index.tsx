import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View, Text, FlatList, TouchableOpacity, StyleSheet,
  TextInput, RefreshControl,
} from 'react-native';
import { router } from 'expo-router';
import { useAuth } from '@/hooks/useAuth';
import { useJobsStore } from '@/store/jobsStore';
import { onSyncComplete, offSyncComplete, runSync } from '@/lib/sync';
import { T } from '@/constants/Colors';
import type { Job } from '@/types';
import { ScreenHeader, Badge } from '@/components/ui';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { cardShadow } from '@/components/ui/Card';

type FilterTab = 'today' | 'week' | 'all';

type JobWithJoins = Job & { property_name?: string; address?: string; suburb?: string; state?: string };

const PRIORITY_COLOR: Record<string, string> = {
  urgent: T.danger,
  high:   T.warning,
  normal: T.info,
  low:    T.textMuted,
};

export default function ScheduleScreen() {
  const { user } = useAuth();
  const { jobs, loadJobs } = useJobsStore();
  const [filter, setFilter]     = useState<FilterTab>('today');
  const [search, setSearch]     = useState('');
  const [refreshing, setRefreshing] = useState(false);

  // Use local timezone dates
  const getLocalDate = (d: Date = new Date()) =>
    new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10);

  const today = getLocalDate();

  // Calculate Monday and Sunday of current week
  const now       = new Date();
  const dayOfWeek = now.getDay() || 7; // 1 (Mon) to 7 (Sun)

  const monday = new Date(now);
  monday.setDate(now.getDate() - dayOfWeek + 1);
  const weekStart = getLocalDate(monday);

  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  const weekEnd = getLocalDate(sunday);

  useEffect(() => {
    if (user) loadJobs(user.id);
    const fn = () => { if (user) loadJobs(user.id); };
    onSyncComplete(fn);
    return () => offSyncComplete(fn);
  }, [user, loadJobs]);

  const filtered = useMemo(() => jobs.filter((j: Job) => {
    const effectiveDateStr = j.status === 'completed' ? (j.updated_at || j.scheduled_date) : j.scheduled_date;
    const filterDate = effectiveDateStr.substring(0, 10);
    const scheduledOnlyDate = j.scheduled_date.substring(0, 10);
    const isOverdue = scheduledOnlyDate < today && j.status !== 'completed' && j.status !== 'cancelled';

    if (filter === 'today' && filterDate !== today && !isOverdue) return false;
    if (filter === 'week') {
      const inThisWeek = filterDate >= weekStart && filterDate <= weekEnd;
      if (!isOverdue && !inThisWeek) return false;
    }
    if (search.trim()) {
      const q  = search.toLowerCase();
      const jj = j as JobWithJoins;
      if (!(jj.property_name ?? '').toLowerCase().includes(q) &&
          !(jj.address ?? '').toLowerCase().includes(q)) return false;
    }
    return true;
  }).sort((a: Job, b: Job) => {
    const statusOrder = (s: string) =>
      s === 'in_progress' ? 0 : s === 'scheduled' ? 1 : s === 'completed' ? 2 : 3;
    const so = statusOrder(a.status) - statusOrder(b.status);
    if (so !== 0) return so;
    const dateA = a.status === 'completed' ? (a.updated_at || a.scheduled_date) : a.scheduled_date;
    const dateB = b.status === 'completed' ? (b.updated_at || b.scheduled_date) : b.scheduled_date;
    return dateA.localeCompare(dateB);
  }), [jobs, filter, search, today, weekStart, weekEnd]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await runSync();
    setRefreshing(false);
  }, []);

  return (
    <View style={styles.container}>
      <ScreenHeader
        title="Schedule"
        subtitle={`${filtered.length} job${filtered.length !== 1 ? 's' : ''} found`}
      />

      {/* ── Filter Tabs ── */}
      <View style={styles.filterRow}>
        {(['today', 'week', 'all'] as FilterTab[]).map(f => (
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

      {/* ── Search ── */}
      <View style={styles.searchWrap}>
        <MaterialCommunityIcons name="magnify" size={16} color={T.textMuted} style={{ marginRight: 6 }} />
        <TextInput
          style={styles.searchInput}
          placeholder="Search property or address…"
          placeholderTextColor={T.textMuted}
          value={search}
          onChangeText={setSearch}
          maxLength={80}
          autoCorrect={false}
        />
        {search.length > 0 && (
          <TouchableOpacity onPress={() => setSearch('')}>
            <MaterialCommunityIcons name="close-circle" size={16} color={T.textMuted} />
          </TouchableOpacity>
        )}
      </View>

      <FlatList
        data={filtered}
        keyExtractor={(job) => job.id}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scroll}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={T.primary} />}
        renderItem={({ item }) => <ScheduleJobCard key={item.id} job={item} />}
        initialNumToRender={10}
        maxToRenderPerBatch={10}
        windowSize={8}
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <MaterialCommunityIcons name="briefcase-search-outline" size={40} color={T.textMuted} />
            <Text style={styles.emptyTitle}>No jobs found</Text>
            <Text style={styles.emptyText}>
              {search ? 'Try a different search term.' : 'No jobs scheduled for this period.'}
            </Text>
          </View>
        }
      />
    </View>
  );
}

function ScheduleJobCard({ job }: { job: Job }) {
  const j = job as JobWithJoins;
  return (
    <TouchableOpacity
      style={styles.card}
      onPress={() => router.push(`/(app)/jobs/${job.id}/`)}
      activeOpacity={0.85}
    >
      <View style={[styles.priorityBar, { backgroundColor: PRIORITY_COLOR[job.priority] ?? T.border }]} />
      <View style={styles.cardBody}>
        <View style={styles.cardRow}>
          <Text style={styles.propName} numberOfLines={1}>
            {j.property_name ?? 'Unknown Property'}
          </Text>
          <Badge status={job.status} />
        </View>
        <Text style={styles.address} numberOfLines={1}>
          {[j.address, j.suburb, j.state].filter(Boolean).join(', ')}
        </Text>
        <View style={styles.metaRow}>
          {job.status === 'completed' ? (
            <>
              <MaterialCommunityIcons name="calendar-outline" size={11} color={T.textMuted} />
              <Text style={styles.metaText}>{job.scheduled_date}</Text>
              <MaterialCommunityIcons name="arrow-right" size={11} color={T.textMuted} style={{ marginLeft: 4 }} />
              <MaterialCommunityIcons name="check-circle-outline" size={12} color={T.success} style={{ marginLeft: 4 }} />
              <Text style={[styles.metaText, { color: T.success }]}>
                {job.updated_at?.substring(0, 10) || job.scheduled_date}
              </Text>
            </>
          ) : job.status === 'in_progress' ? (
            <>
              <MaterialCommunityIcons name="calendar-outline" size={11} color={T.textMuted} />
              <Text style={styles.metaText}>{job.scheduled_date}</Text>
              <MaterialCommunityIcons name="arrow-right" size={11} color={T.textMuted} style={{ marginLeft: 4 }} />
              <MaterialCommunityIcons name="play-circle-outline" size={12} color={T.primary} style={{ marginLeft: 4 }} />
              <Text style={[styles.metaText, { color: T.primary }]}>
                Started {job.updated_at?.substring(0, 10)}
              </Text>
            </>
          ) : (
            <>
              <MaterialCommunityIcons name="calendar-outline" size={11} color={T.textMuted} />
              <Text style={styles.metaText}>{job.scheduled_date}</Text>
              {job.scheduled_time && (
                <>
                  <MaterialCommunityIcons name="clock-outline" size={11} color={T.textMuted} style={{ marginLeft: 4 }} />
                  <Text style={styles.metaText}>{job.scheduled_time.substring(0, 5)}</Text>
                </>
              )}
            </>
          )}
        </View>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container:            { flex: 1, backgroundColor: T.background },
  filterRow:            { flexDirection: 'row', paddingHorizontal: 16, paddingTop: 12, paddingBottom: 4, gap: 8 },
  filterTab:            { flex: 1, paddingVertical: 8, borderRadius: 10, alignItems: 'center', backgroundColor: T.surface, borderWidth: 1, borderColor: T.border },
  filterTabActive:      { backgroundColor: T.primary, borderColor: T.primary },
  filterTabText:        { color: T.textMuted, fontSize: 12, fontWeight: '600' },
  filterTabTextActive:  { color: T.textPrimary },
  searchWrap:           { flexDirection: 'row', alignItems: 'center', backgroundColor: T.surface, marginHorizontal: 16, marginTop: 10, borderRadius: 12, borderWidth: 1, borderColor: T.border, paddingHorizontal: 12, paddingVertical: 10 },
  searchInput:          { flex: 1, color: T.textPrimary, fontSize: 14 },
  scroll:               { padding: 16, paddingBottom: 32 },
  emptyState:           { alignItems: 'center', paddingVertical: 60, backgroundColor: T.surface, borderRadius: 16, borderWidth: 1, borderColor: T.border, gap: 8, ...cardShadow },
  emptyTitle:           { color: T.textPrimary, fontSize: 16, fontWeight: '700' },
  emptyText:            { color: T.textMuted, fontSize: 13 },
  card:                 { backgroundColor: T.surface, borderRadius: 16, borderWidth: 1, borderColor: T.border, flexDirection: 'row', overflow: 'hidden', marginBottom: 10, ...cardShadow },
  priorityBar:          { width: 4 },
  cardBody:             { flex: 1, padding: 14 },
  cardRow:              { flexDirection: 'row', alignItems: 'center', marginBottom: 4 },
  propName:             { color: T.textPrimary, fontSize: 15, fontWeight: '700', flex: 1 },
  address:              { color: T.textMuted, fontSize: 12, marginBottom: 8 },
  metaRow:              { flexDirection: 'row', alignItems: 'center' },
  metaText:             { color: T.textMuted, fontSize: 11, paddingLeft: 4, paddingRight: 8 },
});
