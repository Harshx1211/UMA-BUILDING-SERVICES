import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View, Text, FlatList, TouchableOpacity, StyleSheet,
  TextInput, RefreshControl,
} from 'react-native';
import { router } from 'expo-router';
import { useAuth } from '@/hooks/useAuth';
import { useJobsStore, JobWithProperty } from '@/store/jobsStore';
import { onSyncComplete, offSyncComplete, runSync } from '@/lib/sync';
import { T } from '@/constants/Colors';
import type { Job } from '@/types';
import { ScreenHeader, Badge } from '@/components/ui';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { cardShadow } from '@/components/ui/Card';
import { ToleranceLabel } from '@/components/jobs/ToleranceLabel';
import JobFilterModal, { JobGroupBy, JobSortBy } from '@/components/jobs/JobFilterModal';

type FilterTab = 'today' | 'week' | 'all';

type JobWithJoins = Job & { property_name?: string; address?: string; suburb?: string; state?: string };

const PRIORITY_COLOR: Record<string, string> = {
  urgent: T.danger,
  high:   T.warning,
  normal: T.info,
  low:    T.textMuted,
};

const ALL = 'All';

// Real Supabase job_type CHECK-constraint values — NOT the stale JobType
// enum (which only has 5 of the real 10 values). Keep this local; do not
// import JobType here.
const JOB_TYPE_LABEL: Record<string, string> = {
  routine_service_monthly:   'Monthly Service',
  routine_service_3_monthly: '3-Monthly Service',
  routine_service_6_monthly: '6-Monthly Service',
  routine_service_annual:    'Annual Service',
  routine_service_5_yearly:  '5-Yearly Service',
  defect_repair_quote:       'Defect Repair Quote',
  defect_repair:             'Defect Repair',
  quote:                     'Quote',
  installation:              'Installation',
  emergency:                 'Emergency',
};
const STATUS_LABEL: Record<string, string> = {
  scheduled: 'Scheduled', in_progress: 'In Progress', completed: 'Completed', cancelled: 'Cancelled',
};
const PRIORITY_LABEL: Record<string, string> = {
  urgent: 'Urgent', high: 'High', normal: 'Normal', low: 'Low',
};

type ListRow = { kind: 'header'; key: string; label: string } | { kind: 'job'; job: Job };

export default function ScheduleScreen() {
  const { user } = useAuth();
  const { jobs, loadJobs } = useJobsStore();
  const [filter, setFilter]     = useState<FilterTab>('today');
  const [search, setSearch]     = useState('');
  const [refreshing, setRefreshing] = useState(false);

  const [statusFilter, setStatusFilter]         = useState<string[]>([]);
  const [jobTypeFilter, setJobTypeFilter]       = useState<string[]>([]);
  const [priorityFilter, setPriorityFilter]     = useState<string[]>([]);
  const [technicianFilter, setTechnicianFilter] = useState<string[]>([]);
  const [groupBy, setGroupBy] = useState<JobGroupBy>('none');
  const [sortBy, setSortBy]   = useState<JobSortBy>('date');
  const [sortAsc, setSortAsc] = useState(true);
  const [filterModalVisible, setFilterModalVisible] = useState(false);

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
    if (statusFilter.length > 0 && !statusFilter.includes(j.status)) return false;
    if (jobTypeFilter.length > 0 && !jobTypeFilter.includes(j.job_type)) return false;
    if (priorityFilter.length > 0 && !priorityFilter.includes(j.priority)) return false;
    if (technicianFilter.length > 0 && !technicianFilter.includes((j as JobWithProperty).assigned_to_name ?? '')) return false;
    return true;
  }).sort((a: Job, b: Job) => {
    if (sortBy === 'priority') {
      const rank = (p: string): number => ({ urgent: 0, high: 1, normal: 2, low: 3 }[p] ?? 4);
      const r = rank(a.priority) - rank(b.priority);
      return sortAsc ? r : -r;
    }
    if (sortBy === 'property') {
      const an = (a as JobWithProperty).property_name ?? '';
      const bn = (b as JobWithProperty).property_name ?? '';
      return sortAsc ? an.localeCompare(bn) : bn.localeCompare(an);
    }
    // sortBy === 'date' — matches the screen's original default behavior
    // exactly when sortAsc is true (status priority first, then date asc).
    const statusOrder = (s: string) =>
      s === 'in_progress' ? 0 : s === 'scheduled' ? 1 : s === 'completed' ? 2 : 3;
    const so = statusOrder(a.status) - statusOrder(b.status);
    if (so !== 0) return so;
    const dateA = a.status === 'completed' ? (a.updated_at || a.scheduled_date) : a.scheduled_date;
    const dateB = b.status === 'completed' ? (b.updated_at || b.scheduled_date) : b.scheduled_date;
    return sortAsc ? dateA.localeCompare(dateB) : dateB.localeCompare(dateA);
  }), [jobs, filter, search, today, weekStart, weekEnd, statusFilter, jobTypeFilter, priorityFilter, technicianFilter, sortBy, sortAsc]);

  // Filter option lists — [ALL, ...distinct values] matching the same
  // convention InspectionFilterModal already uses for its own categories.
  const statusOptions = useMemo(() => [ALL, ...Array.from(new Set(jobs.map(j => j.status))).sort()], [jobs]);
  const jobTypeOptions = useMemo(() => [ALL, ...Array.from(new Set(jobs.map(j => j.job_type))).sort()], [jobs]);
  const priorityOptions = useMemo(() => [ALL, ...Array.from(new Set(jobs.map(j => j.priority))).sort()], [jobs]);
  const technicianOptions = useMemo(() => [
    ALL,
    ...Array.from(new Set(jobs.map(j => (j as JobWithProperty).assigned_to_name).filter((n): n is string => !!n))).sort(),
  ], [jobs]);

  const activeFilterCount = [statusFilter, jobTypeFilter, priorityFilter, technicianFilter].filter(a => a.length > 0).length;
  const resetJobFilters = useCallback(() => {
    setStatusFilter([]); setJobTypeFilter([]); setPriorityFilter([]); setTechnicianFilter([]);
  }, []);

  const listData = useMemo((): ListRow[] => {
    if (groupBy === 'none') return filtered.map(job => ({ kind: 'job', job }));
    const keyFor = (j: Job): string => {
      const jj = j as JobWithProperty;
      if (groupBy === 'property') return jj.property_name ?? 'Unknown Property';
      if (groupBy === 'status') return STATUS_LABEL[j.status] ?? j.status;
      return jj.assigned_to_name ?? 'Unassigned';
    };
    const buckets = new Map<string, Job[]>();
    for (const job of filtered) {
      const k = keyFor(job);
      if (!buckets.has(k)) buckets.set(k, []);
      buckets.get(k)!.push(job);
    }
    const rows: ListRow[] = [];
    for (const k of Array.from(buckets.keys()).sort()) {
      rows.push({ kind: 'header', key: `h-${k}`, label: k });
      for (const job of buckets.get(k)!) rows.push({ kind: 'job', job });
    }
    return rows;
  }, [filtered, groupBy]);

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
        <TouchableOpacity
          style={[styles.filterIconBtn, activeFilterCount > 0 && styles.filterIconBtnActive]}
          onPress={() => setFilterModalVisible(true)}
        >
          <MaterialCommunityIcons name="tune-variant" size={16} color={activeFilterCount > 0 ? T.textOnPrimary : T.textMuted} />
          {activeFilterCount > 0 && (
            <View style={styles.filterCountBadge}>
              <Text style={styles.filterCountBadgeTxt}>{activeFilterCount}</Text>
            </View>
          )}
        </TouchableOpacity>
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
        data={listData}
        keyExtractor={(row) => row.kind === 'header' ? row.key : row.job.id}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scroll}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={T.primary} />}
        renderItem={({ item }) =>
          item.kind === 'header'
            ? <Text style={styles.groupHeader}>{item.label}</Text>
            : <ScheduleJobCard key={item.job.id} job={item.job} />
        }
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

      <JobFilterModal
        visible={filterModalVisible}
        onClose={() => setFilterModalVisible(false)}
        statusOptions={statusOptions} statusFilter={statusFilter} onStatusChange={setStatusFilter}
        jobTypeOptions={jobTypeOptions} jobTypeFilter={jobTypeFilter} onJobTypeChange={setJobTypeFilter}
        priorityOptions={priorityOptions} priorityFilter={priorityFilter} onPriorityChange={setPriorityFilter}
        technicianOptions={technicianOptions} technicianFilter={technicianFilter} onTechnicianChange={setTechnicianFilter}
        groupBy={groupBy} onGroupByChange={setGroupBy}
        sortBy={sortBy} onSortByChange={setSortBy} sortAsc={sortAsc} onToggleSortDirection={() => setSortAsc(v => !v)}
        activeCount={activeFilterCount}
        onReset={resetJobFilters}
        labelFormatters={{
          status: (v) => STATUS_LABEL[v] ?? v,
          jobType: (v) => JOB_TYPE_LABEL[v] ?? v,
          priority: (v) => PRIORITY_LABEL[v] ?? v,
        }}
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
        {job.status === 'scheduled' && (
          <ToleranceLabel scheduledDate={job.scheduled_date} jobType={job.job_type} style={{ marginTop: 4 }} />
        )}
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
  filterTabTextActive:  { color: T.textOnPrimary },
  filterIconBtn:        { width: 38, height: 38, borderRadius: 10, alignItems: 'center', justifyContent: 'center', backgroundColor: T.surface, borderWidth: 1, borderColor: T.border },
  filterIconBtnActive:  { backgroundColor: T.primary, borderColor: T.primary },
  filterCountBadge:     { position: 'absolute', top: -4, right: -4, minWidth: 16, height: 16, borderRadius: 8, backgroundColor: T.danger, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 3 },
  filterCountBadgeTxt:  { color: T.textOnPrimary, fontSize: 9.5, fontWeight: '800' },
  groupHeader:          { color: T.textMuted, fontSize: 11.5, fontWeight: '800', letterSpacing: 0.4, textTransform: 'uppercase', marginTop: 12, marginBottom: 8 },
  searchWrap:           { flexDirection: 'row', alignItems: 'center', backgroundColor: T.surface, marginHorizontal: 16, marginTop: 10, borderRadius: 12, borderWidth: 1, borderColor: T.border, paddingHorizontal: 12, paddingVertical: 10 },
  searchInput:          { flex: 1, color: T.textPrimary, fontSize: 14 },
  // padding around list + ensure list always grows to fill screen height
  // (prevents empty dark area below last card when few jobs are visible)
  scroll: { padding: 16, paddingBottom: 40, flexGrow: 1 },
  emptyState:           { alignItems: 'center', paddingVertical: 60, backgroundColor: T.surface, borderRadius: 16, borderWidth: 1, borderColor: T.border, gap: 8, ...cardShadow },
  emptyTitle:           { color: T.textPrimary, fontSize: 16, fontWeight: '700' },
  emptyText:            { color: T.textMuted, fontSize: 13 },
  card:                 { backgroundColor: T.surface, borderRadius: 16, borderWidth: 1, borderColor: T.border, flexDirection: 'row', overflow: 'hidden', marginBottom: 12, ...cardShadow },
  priorityBar:          { width: 4 },
  cardBody:             { flex: 1, padding: 16 },
  cardRow:              { flexDirection: 'row', alignItems: 'center', marginBottom: 4 },
  propName:             { color: T.textPrimary, fontSize: 15, fontWeight: '700', flex: 1 },
  address:              { color: T.textMuted, fontSize: 12, marginBottom: 8 },
  metaRow:              { flexDirection: 'row', alignItems: 'center' },
  metaText:             { color: T.textMuted, fontSize: 11, paddingLeft: 4, paddingRight: 8 },
});
