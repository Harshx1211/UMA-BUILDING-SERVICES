import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View, FlatList, TouchableOpacity, StyleSheet,
  RefreshControl,
} from 'react-native';
import { TextInput } from '@/components/ui/AppTextInput';
import { Text } from '@/components/ui/AppText';
import { fontFor } from '@/constants/Fonts';
import { router } from 'expo-router';
import { useAuth } from '@/hooks/useAuth';
import { useJobsStore, JobWithProperty } from '@/store/jobsStore';
import { onSyncComplete, offSyncComplete, runSync } from '@/lib/sync';
import { T } from '@/constants/Colors';
import type { Job } from '@/types';
import { ScreenHeader, Badge, FilterPills } from '@/components/ui';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { cardShadow } from '@/components/ui/Card';
import { ToleranceLabel } from '@/components/jobs/ToleranceLabel';
import { getToleranceWindow } from '@/utils/toleranceWindow';
import JobFilterModal, { JobGroupBy, JobSortBy } from '@/components/jobs/JobFilterModal';
import { useResponsive } from '@/hooks/useResponsive';

type FilterTab = 'today' | 'week' | 'all';
const FILTER_TABS: FilterTab[] = ['today', 'week', 'all'];
const FILTER_TAB_OPTIONS = [{ label: 'Today' }, { label: 'This week' }, { label: 'All jobs' }];

type JobWithJoins = Job & { property_name?: string; address?: string; suburb?: string; state?: string };

// FIX: every card on this screen showed raw "YYYY-MM-DD" strings — the one
// place in the app still doing that; Home's own JobCard already formats the
// same fields as "Mon, 13 Sep". Matches that exactly for consistency.
// Appending 'T00:00:00' to a bare date (no time component) forces it to
// parse as local midnight rather than UTC midnight — same defensive parse
// Home's metaDate already uses, avoiding a timezone-driven day rollover.
function fmtJobDate(dateStr: string | null | undefined): string {
  if (!dateStr) return '';
  const d = new Date(dateStr.length <= 10 ? `${dateStr}T00:00:00` : dateStr);
  if (Number.isNaN(d.getTime())) return dateStr;
  return d.toLocaleDateString('en-AU', { weekday: 'short', day: 'numeric', month: 'short' });
}

/** "today" when it happened today, otherwise the same short date as above. */
function fmtActivityDate(dateStr: string | null | undefined): string {
  if (!dateStr) return '';
  const d = new Date(dateStr.length <= 10 ? `${dateStr}T00:00:00` : dateStr);
  return !Number.isNaN(d.getTime()) && d.toDateString() === new Date().toDateString() ? 'today' : fmtJobDate(dateStr);
}

// Left accent: urgent red, high amber; normal/low jobs show none.
const PRIORITY_COLOR: Record<string, string> = {
  urgent: T.danger,
  high:   T.warning,
  normal: 'transparent',
  low:    'transparent',
};

/** "14:30" -> "2:30 pm" */
function fmtTime(t: string): string {
  const [h, m] = t.split(':').map(Number);
  if (!Number.isFinite(h)) return t;
  return `${h % 12 || 12}:${String(m || 0).padStart(2, '0')} ${h < 12 ? 'am' : 'pm'}`;
}

const ALL = 'All';

// Real Supabase job_type CHECK-constraint values, matched directly rather
// than importing constants/Enums.ts's JobType — kept local so this list
// can never drift out of sync with the DB regardless of that enum's own
// membership.
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
  scheduled: 'Scheduled', in_progress: 'In progress', completed: 'Completed', cancelled: 'Cancelled',
};
const PRIORITY_LABEL: Record<string, string> = {
  urgent: 'Urgent', high: 'High', normal: 'Normal', low: 'Low',
};

type ListRow = { kind: 'header'; key: string; label: string } | { kind: 'job'; job: Job };

export default function ScheduleScreen() {
  const { user } = useAuth();
  const { contentMaxWidth } = useResponsive();
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
    // FIX: an in_progress job used to be bucketed by scheduled_date alone,
    // same as a still-scheduled job — so a job started today but scheduled
    // for some other day (ahead of schedule, or simply re-dated) vanished
    // from Today/This Week the moment it was started, only findable in All
    // Jobs looking like unrelated old work. updateJobStatus() (jobsStore.ts)
    // already stamps updated_at with the exact start moment, and the card
    // below already displays it as "Started {updated_at}" — this just makes
    // the Today/Week filters agree with what the card itself is showing,
    // the same way completed jobs already use updated_at as their effective
    // date.
    const effectiveDateStr = (j.status === 'completed' || j.status === 'in_progress')
      ? (j.updated_at || j.scheduled_date)
      : j.scheduled_date;
    // A full timestamp (updated_at) is UTC — read it as the LOCAL day, or a
    // job finished before ~10-11 am in Australia lands on yesterday.
    const filterDate = effectiveDateStr.length > 10
      ? getLocalDate(new Date(effectiveDateStr))
      : effectiveDateStr;
    // FIX: this used to be a raw `scheduled_date < today` check with zero
    // slack — but the very same card renders <ToleranceLabel>, which shows
    // a job-type-aware tolerance window (e.g. an annual service has 30
    // days' grace either side). A job well within its own tolerance window
    // was still swept into "Today"/overdue here, directly contradicting the
    // neutral, not-yet-due label sitting on the same card. Using the same
    // getToleranceWindow() the label itself reads from keeps both signals
    // in agreement.
    const isOverdue = j.status !== 'completed' && j.status !== 'cancelled'
      && getToleranceWindow(j.scheduled_date, j.job_type, today).isLate;

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
      if (groupBy === 'property') return jj.property_name ?? 'Unknown property';
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
        // Names the tab ("2 jobs today") instead of reading like a search result.
        subtitle={`${filtered.length} job${filtered.length !== 1 ? 's' : ''}${search ? ' found'
          : filter === 'today' ? ' today' : filter === 'week' ? ' this week' : ''}`}
      />

      {/* FIX: the FlatList below is correctly capped to contentMaxWidth and
          centered on a tablet, but the filter row + search bar were
          separate siblings with only horizontal padding — on a tablet they
          stretched edge-to-edge across the full width while the job cards
          right underneath sat centered at 720px, a visibly inconsistent
          layout (a search bar dramatically wider than the list below it).
          Same max-width/centered treatment, applied here too. */}
      <View style={{ maxWidth: contentMaxWidth, width: '100%', alignSelf: 'center' }}>
        {/* ── Filter Tabs — shared FilterPills, matching the same tab-row
            pattern already used by the job Defects screen and Site Inspect
            (was a bespoke 3-box row here, its own distinct look) ── */}
        <View style={styles.filterRow}>
          <FilterPills
            options={FILTER_TAB_OPTIONS}
            activeIndex={FILTER_TABS.indexOf(filter)}
            onSelect={(idx) => setFilter(FILTER_TABS[idx])}
            variant="dark"
            style={{ flex: 1 }}
          />
          <TouchableOpacity
            style={[styles.filterIconBtn, activeFilterCount > 0 && styles.filterIconBtnActive]}
            onPress={() => setFilterModalVisible(true)}
          >
            <MaterialCommunityIcons name="tune-variant" size={20} color={activeFilterCount > 0 ? T.textOnPrimary : T.textSecondary} />
            {activeFilterCount > 0 && (
              <View style={styles.filterCountBadge}>
                <Text style={styles.filterCountBadgeTxt}>{activeFilterCount}</Text>
              </View>
            )}
          </TouchableOpacity>
        </View>

        {/* ── Search ── */}
        <View style={styles.searchWrap}>
          <MaterialCommunityIcons name="magnify" size={20} color={T.textMuted} style={{ marginRight: 8 }} />
          <TextInput
            style={[styles.searchInput, fontFor(styles.searchInput)]}
            placeholder="Search property or address"
            placeholderTextColor={T.textMuted}
            value={search}
            onChangeText={setSearch}
            maxLength={80}
            autoCorrect={false}
          />
          {search.length > 0 && (
            <TouchableOpacity onPress={() => setSearch('')} hitSlop={10} accessibilityLabel="Clear search">
              <MaterialCommunityIcons name="close-circle" size={18} color={T.textMuted} />
            </TouchableOpacity>
          )}
        </View>
      </View>

      <FlatList
        data={listData}
        keyExtractor={(row) => row.kind === 'header' ? row.key : row.job.id}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[styles.scroll, { maxWidth: contentMaxWidth, width: '100%', alignSelf: 'center' }]}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={T.primary} colors={[T.primary]} />}
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
            <View style={styles.emptyIcon}>
              <MaterialCommunityIcons name="briefcase-search-outline" size={26} color={T.textSecondary} />
            </View>
            <Text style={styles.emptyTitle}>{search ? 'No jobs found' : filter === 'today' ? 'No jobs today' : filter === 'week' ? 'No jobs this week' : 'No jobs yet'}</Text>
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
  const address = [j.address, j.suburb, j.state].filter(Boolean).join(', ');
  const when = job.status === 'completed'
    ? { icon: 'check-circle-outline' as const, color: T.success, text: `Done ${fmtActivityDate(job.updated_at || job.scheduled_date)}` }
    : job.status === 'in_progress'
      ? { icon: 'play-circle-outline' as const, color: T.primary, text: `Started ${fmtActivityDate(job.updated_at)}` }
      : null;
  return (
    <TouchableOpacity
      style={[styles.card, job.status === 'completed' && { opacity: 0.92 }]}
      // FIX: bare /jobs/{id} push from inside the Jobs tab's own stack — see
      // openJob's comment for why the /(app)/ prefix must not be used here.
      onPress={() => router.push(`/jobs/${job.id}` as never)}
      activeOpacity={0.85}
      accessibilityRole="button"
      accessibilityLabel={`${j.property_name ?? 'Job'}, ${STATUS_LABEL[job.status] ?? job.status}`}
    >
      <View style={[styles.priorityBar, { backgroundColor: job.status === 'in_progress' && job.priority !== 'urgent' && job.priority !== 'high' ? T.primary : (PRIORITY_COLOR[job.priority] ?? 'transparent') }]} />
      <View style={{ flex: 1 }}>
        <View style={styles.cardBody}>
          <View style={styles.cardTop}>
            <View style={{ flex: 1, minWidth: 0, gap: 4 }}>
              <View style={styles.statusRow}>
                <Badge status={job.status} />
                <Text style={styles.typeText} numberOfLines={1}>· {JOB_TYPE_LABEL[job.job_type] ?? job.job_type}</Text>
              </View>
              <Text style={styles.propName} numberOfLines={1}>{j.property_name ?? 'Unknown property'}</Text>
            </View>
            <MaterialCommunityIcons name="chevron-right" size={22} color={T.textSecondary} style={{ marginTop: 10 }} />
          </View>
          {address ? (
            <View style={styles.infoRow}>
              <MaterialCommunityIcons name="map-marker-outline" size={16} color={T.textMuted} />
              <Text style={styles.infoText} numberOfLines={1}>{address}</Text>
            </View>
          ) : null}
          <View style={styles.infoRow}>
            <MaterialCommunityIcons name="clock-outline" size={16} color={T.textMuted} />
            <Text style={styles.infoText}>
              {fmtJobDate(job.scheduled_date)}{job.scheduled_time && job.status === 'scheduled' ? ` · ${fmtTime(job.scheduled_time)}` : ''}
            </Text>
          </View>
        </View>
        {(when || job.status === 'scheduled') ? (
          <View style={styles.cardFooter}>
            {when ? (
              <View style={styles.footerItem}>
                <MaterialCommunityIcons name={when.icon} size={15} color={when.color} />
                <Text style={[styles.footerText, { color: when.color }]}>{when.text}</Text>
              </View>
            ) : (
              <ToleranceLabel scheduledDate={job.scheduled_date} jobType={job.job_type} />
            )}
          </View>
        ) : null}
      </View>
    </TouchableOpacity>
  );
}

// Approved Batch B design (stitch-designs/README.md).
const styles = StyleSheet.create({
  container:            { flex: 1, backgroundColor: T.background },
  filterRow:            { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingTop: 12, paddingBottom: 4, gap: 8 },
  filterIconBtn:        { width: 44, height: 44, borderRadius: T.radiusButton, alignItems: 'center', justifyContent: 'center', backgroundColor: T.surface, borderWidth: 1, borderColor: T.border },
  filterIconBtnActive:  { backgroundColor: T.primary, borderColor: T.primary },
  filterCountBadge:     { position: 'absolute', top: -4, right: -4, minWidth: 18, height: 18, borderRadius: 9, backgroundColor: T.danger, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 4, borderWidth: 2, borderColor: T.background },
  filterCountBadgeTxt:  { color: T.textOnPrimary, fontSize: 11, fontWeight: '700' },
  groupHeader:          { color: T.textMuted, fontSize: 11, fontWeight: '700', letterSpacing: 0.8, textTransform: 'uppercase', marginTop: 12, marginBottom: 8 },
  searchWrap:           { flexDirection: 'row', alignItems: 'center', backgroundColor: T.surface, marginHorizontal: 16, marginTop: 10, borderRadius: T.radiusButton, borderWidth: 1, borderColor: T.border, paddingHorizontal: 14, height: 48 },
  searchInput:          { flex: 1, color: T.textPrimary, fontSize: 14, paddingVertical: 0 },
  // padding around list + ensure list always grows to fill screen height
  scroll: { padding: 16, paddingBottom: 40, flexGrow: 1 },
  emptyState:           { alignItems: 'center', paddingVertical: 48, paddingHorizontal: 24, backgroundColor: T.surface, borderRadius: T.radiusCard, borderWidth: 1, borderColor: T.border, gap: 8, ...cardShadow },
  emptyIcon:            { width: 52, height: 52, borderRadius: 26, backgroundColor: T.surfaceInput, alignItems: 'center', justifyContent: 'center', marginBottom: 4 },
  emptyTitle:           { color: T.textPrimary, fontSize: 16, fontWeight: '700' },
  emptyText:            { color: T.textSecondary, fontSize: 14, textAlign: 'center' },
  card:                 { backgroundColor: T.surface, borderRadius: T.radiusCard, borderWidth: 1, borderColor: T.border, flexDirection: 'row', overflow: 'hidden', marginBottom: 12, ...cardShadow },
  priorityBar:          { width: 4 },
  cardBody:             { paddingHorizontal: 16, paddingTop: 14, paddingBottom: 12, gap: 8 },
  cardTop:              { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  statusRow:            { flexDirection: 'row', alignItems: 'center', gap: 6 },
  typeText:             { color: T.textMuted, fontSize: 12, flexShrink: 1 },
  propName:             { color: T.textPrimary, fontSize: 16, fontWeight: '600' },
  infoRow:              { flexDirection: 'row', alignItems: 'center', gap: 8 },
  infoText:             { color: T.textSecondary, fontSize: 13, flex: 1 },
  cardFooter:           { backgroundColor: T.surfaceInput, paddingHorizontal: 16, paddingVertical: 10, minHeight: 40, justifyContent: 'center' },
  footerItem:           { flexDirection: 'row', alignItems: 'center', gap: 6 },
  footerText:           { fontSize: 12, fontWeight: '600' },
});
