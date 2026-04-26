// Jobs Schedule screen — navy curved header + pill filter tabs + search bar + sectioned list
import { useCallback, useEffect, useMemo, useState } from 'react'; // useMemo still needed for sections
import {
  SectionList,
  RefreshControl,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { Text, ActivityIndicator } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { useAuth } from '@/hooks/useAuth';
import { useJobsStore, type JobFilter, type JobWithProperty } from '@/store/jobsStore';
import { runSync } from '@/lib/sync';
import { getPendingSyncItems } from '@/lib/database';
import Toast from 'react-native-toast-message';
import { JobCard } from '@/components/jobs/JobCard';
import { SkeletonCard } from '@/components/ui/SkeletonCard';
import { EmptyState } from '@/components/ui/EmptyState';
import { FilterPills } from '@/components/ui/FilterPills';
import { useColors } from '@/hooks/useColors';
import RouteMapView from '@/components/jobs/RouteMapView';
import { JobStatus } from '@/constants/Enums';
import { useSafeAreaInsets } from 'react-native-safe-area-context';


// Computed as functions so the date stays fresh even if the app runs past midnight
const getToday    = () => new Date().toISOString().slice(0, 10);
const getTomorrow = () => new Date(Date.now() + 86_400_000).toISOString().slice(0, 10);

function dateLabel(iso: string): string {
  if (iso === getToday())    return 'Today';
  if (iso === getTomorrow()) return 'Tomorrow';
  try {
    return new Date(iso + 'T00:00:00').toLocaleDateString('en-AU', {
      weekday: 'short', day: 'numeric', month: 'short',
    });
  } catch { return iso; }
}

// ─── Section header ───
function DateSectionHeader({ title, count, bgColor, textColor, accentColor }: { title: string; count: number; bgColor: string; textColor: string; accentColor: string; }) {
  const isToday = title === 'Today';
  return (
    <View style={[sh.row, { backgroundColor: bgColor }]}>
      <View style={[sh.leftBar, { backgroundColor: isToday ? accentColor : 'transparent' }]} />
      <Text style={[sh.label, { color: isToday ? accentColor : textColor }]}>{title.toUpperCase()}</Text>
      <View style={[sh.badge, { backgroundColor: isToday ? accentColor + '15' : 'rgba(150,150,150,0.12)' }]}>
        <Text style={[sh.badgeText, { color: isToday ? accentColor : textColor }]}>{count}</Text>
      </View>
      <View style={{ flex: 1 }} />
    </View>
  );
}
const sh = StyleSheet.create({
  row:       { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 16, paddingVertical: 12 },
  leftBar:   { width: 4, height: 16, borderRadius: 2 },
  label:     { fontSize: 11, fontWeight: '800', letterSpacing: 1.4 },
  badge:     { paddingHorizontal: 10, paddingVertical: 3, borderRadius: 20 },
  badgeText: { fontSize: 11, fontWeight: '800' },
});

const TABS: { key: JobFilter; label: string }[] = [
  { key: 'today', label: 'Today' },
  { key: 'week',  label: 'This Week' },
  { key: 'all',   label: 'All Jobs' },
];

export default function JobsScreen() {
  const C = useColors();
  const { user } = useAuth();
  const {
    jobs, isLoading, error, activeFilter, searchQuery,
    loadJobs, getFilteredJobs, setFilter, setSearchQuery, clearError, updateJobStatus,
  } = useJobsStore();
  const [search, setSearch]   = useState(searchQuery);
  const [viewMode, setViewMode] = useState<'list' | 'map'>('list');
  const insets = useSafeAreaInsets();

  // Computed fresh each render so date stays correct if app runs past midnight
  const TODAY    = getToday();

  const load = useCallback(() => { if (user?.id) loadJobs(user.id); }, [user?.id, loadJobs]);
  useEffect(() => { load(); }, [load]);
  
  const [isSyncing, setIsSyncing] = useState(false);
  const handleRefresh = useCallback(async () => {
    setIsSyncing(true);
    try {
      await runSync();
      load();
      Toast.show({ type: 'success', text1: 'Sync complete' });
    } catch {
      Toast.show({ type: 'error', text1: 'Sync failed' });
    } finally {
      setIsSyncing(false);
    }
  }, [load]);
  const [pendingCount, setPendingCount] = useState(0);

  useEffect(() => {
    const updatePending = () => { try { setPendingCount(getPendingSyncItems().length); } catch {} };
    updatePending();
    const interval = setInterval(updatePending, 5000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const t = setTimeout(() => setSearchQuery(search), 250);
    return () => clearTimeout(t);
  }, [search, setSearchQuery]);

  const filtered = getFilteredJobs();

  const mon = (() => { const d = new Date(); d.setDate(d.getDate() - (d.getDay() === 0 ? 6 : d.getDay() - 1)); return d.toISOString().slice(0, 10); })();
  const sun = (() => { const d = new Date(mon); d.setDate(d.getDate() + 6); return d.toISOString().slice(0, 10); })();
  const counts: Record<JobFilter, number> = {
    today: jobs.filter(j => j.scheduled_date === TODAY).length,
    week:  jobs.filter(j => j.scheduled_date >= mon && j.scheduled_date <= sun).length,
    all:   jobs.length,
  };

  const sections = useMemo(() => {
    const map = new Map<string, JobWithProperty[]>();
    for (const job of filtered) {
      const key = job.scheduled_date ?? 'unknown';
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(job);
    }
    return [...map.entries()]
      .sort(([a], [b]) => b.localeCompare(a))
      .map(([date, data]) => ({
        date, title: dateLabel(date),
        data: data.sort((a, b) =>
          (a.scheduled_time ?? '99:99').localeCompare(b.scheduled_time ?? '99:99')
        ),
      }));
  }, [filtered]);

  return (
    <View style={[s.screen, { backgroundColor: C.background }]}>
      {/* ── Navy Header ────────────────────────────────────── */}
      <View style={[s.header, { backgroundColor: C.primary, paddingTop: Math.max(insets.top, 14) + 10 }]}>
        <View style={[s.heroDot1, { backgroundColor: 'rgba(255,255,255,0.06)' }]} />
        <View style={[s.heroDot2, { backgroundColor: 'rgba(255,255,255,0.04)' }]} />
        <View style={s.headerContent}>
          <View style={s.headerLeft}>
            <Text style={s.headerEyebrow}>SITETRACK</Text>
            <Text style={s.headerTitle}>Schedule</Text>
            <Text style={s.headerSub}>
              {new Date().toLocaleDateString('en-AU', { weekday: 'long', day: 'numeric', month: 'long' })}
            </Text>
          </View>
          <View style={s.headerRight}>
            {(isLoading || isSyncing) && (
              <ActivityIndicator color="rgba(255,255,255,0.7)" size="small" />
            )}
            {pendingCount > 0 && (
              <View style={s.pendingChip}>
                <MaterialCommunityIcons name="cloud-upload" size={13} color="#FFF" />
                <Text style={s.pendingChipTxt}>{pendingCount}</Text>
              </View>
            )}
            <TouchableOpacity
              style={s.headerIconBtn}
              onPress={() => setViewMode(v => v === 'list' ? 'map' : 'list')}
              activeOpacity={0.8}
            >
              <MaterialCommunityIcons
                name={viewMode === 'list' ? 'map-outline' : 'format-list-bulleted'}
                size={20}
                color="#FFFFFF"
              />
            </TouchableOpacity>
          </View>
        </View>
      </View>

      {/* Filter pills + search — white card below navy header */}
      <View style={[s.headerBottom, { backgroundColor: C.surface }]}>
        {/* Filter Pills */}
        <FilterPills
          options={TABS.map(f => ({ label: f.label + (counts[f.key] > 0 ? ` (${counts[f.key]})` : '') }))}
          activeIndex={TABS.findIndex(f => f.key === activeFilter)}
          onSelect={(idx) => setFilter(TABS[idx].key)}
          variant="dark"
          style={{ marginBottom: 12 }}
        />

        {/* Search Bar */}
        <View style={[s.searchRow, { backgroundColor: C.backgroundSecondary, borderColor: C.border }]}>
          <MaterialCommunityIcons name="magnify" size={19} color={C.textSecondary} />
          <TextInput
            style={[s.searchInput, { color: C.text }]}
            placeholder="Search address, type..."
            placeholderTextColor={C.textTertiary}
            value={search}
            onChangeText={setSearch}
            returnKeyType="search"
          />
          {search.length > 0 && (
            <TouchableOpacity onPress={() => setSearch('')}>
              <MaterialCommunityIcons name="close-circle" size={17} color={C.textSecondary} />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* ── Error bar ── */}
      {error ? (
        <View style={[s.errorBar, { backgroundColor: C.errorLight, borderColor: C.error, borderWidth: 1 }]}>
          <MaterialCommunityIcons name="wifi-off" size={15} color={C.error} />
          <Text style={[s.errorText, { color: C.error }]}>{error}</Text>
          <TouchableOpacity onPress={() => { clearError(); load(); }}>
            <Text style={[s.errorRetry, { color: C.error }]}>Retry</Text>
          </TouchableOpacity>
        </View>
      ) : null}

      {/* ── Map or List view ── */}
      {viewMode === 'map' ? (
        <View style={{ flex: 1 }}>
          <RouteMapView
            jobs={filtered}
            onJobSelect={(job) => router.push(`/jobs/${job.id}` as never)}
          />
        </View>
      ) : isLoading && jobs.length === 0 ? (
        <View style={{ paddingTop: 8 }}>
          {[1, 2, 3, 4].map(i => <SkeletonCard key={i} />)}
        </View>
      ) : (
        <GestureHandlerRootView style={{ flex: 1 }}>
          <SectionList
            sections={sections}
            keyExtractor={item => item.id}
            contentContainerStyle={[s.list, sections.length === 0 && { flex: 1 }]}
            showsVerticalScrollIndicator={false}
            stickySectionHeadersEnabled
            removeClippedSubviews={false}
            initialNumToRender={10}
            maxToRenderPerBatch={10}
            windowSize={10}
            renderSectionHeader={({ section }) =>
              <DateSectionHeader title={section.title} count={section.data.length} bgColor={C.background} textColor={C.textSecondary} accentColor={C.primary} />
            }
            renderItem={({ item }) => (
              <View style={s.cardWrap}>
                <JobCard
                  job={item}
                  showNavigate
                  swipeable
                  onPress={() => router.push(`/jobs/${item.id}` as never)}
                  onStart={() => {
                    // FLOW-1 FIX: Navigate to detail only — clock-in must happen there
                    // so a time_log record + GPS is properly created. Changing status
                    // here without a time_log would leave the job with no on-site time data.
                    router.push(`/jobs/${item.id}` as never);
                  }}
                  onCancel={
                    // FLOW-4 FIX: Only allow cancel on Scheduled jobs. Completed/In-Progress
                    // jobs cannot be cancelled via a swipe — they must be managed intentionally.
                    item.status === JobStatus.Scheduled
                      ? () => {
                          updateJobStatus(item.id, JobStatus.Cancelled);
                          Toast.show({ type: 'info', text1: 'Job cancelled', text2: 'Sync will update the cloud' });
                        }
                      : undefined
                  }
                />
              </View>
            )}
            refreshControl={
              <RefreshControl
                refreshing={isLoading || isSyncing}
                onRefresh={handleRefresh}
                colors={[C.accent]}
                tintColor={C.accent}
              />
            }
            ListEmptyComponent={
              <EmptyState
                emoji={search.length > 0 ? '🔍' : activeFilter === 'today' ? '🎉' : activeFilter === 'week' ? '📅' : '📋'}
                title={search.length > 0 ? 'No results found' : activeFilter === 'today' ? 'No jobs today' : activeFilter === 'week' ? 'No jobs this week' : 'No jobs assigned'}
                subtitle={search.length > 0 ? 'Try a different property or address' : activeFilter === 'today' ? 'Nothing scheduled for today' : activeFilter === 'week' ? 'Check after next sync' : 'Contact your office'}
              />
            }
          />
        </GestureHandlerRootView>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  screen: { flex: 1 },

  // Header
  header: {
    paddingBottom: 20,
    borderBottomLeftRadius: 28,
    borderBottomRightRadius: 28,
    overflow: 'hidden',
    position: 'relative',
    shadowColor: '#0D1526',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.18,
    shadowRadius: 14,
    elevation: 10,
  },
  heroDot1: {
    position: 'absolute',
    width: 280, height: 280, borderRadius: 140,
    top: -110, right: -100,
  },
  heroDot2: {
    position: 'absolute',
    width: 180, height: 180, borderRadius: 90,
    bottom: -70, left: -50,
  },
  headerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
  },
  headerLeft: { gap: 3, flex: 1 },
  headerRight: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  headerEyebrow: { fontSize: 10, color: 'rgba(255,255,255,0.5)', fontWeight: '700', letterSpacing: 2.5, marginBottom: 2 },
  headerTitle: { fontSize: 28, fontWeight: '800', color: '#FFFFFF', letterSpacing: -0.5 },
  headerSub:   { fontSize: 13, color: 'rgba(255,255,255,0.55)', marginTop: 3, fontWeight: '400' },

  headerIconBtn: {
    width: 44, height: 44, borderRadius: 22,
    backgroundColor: 'rgba(255,255,255,0.15)',
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
  },
  pendingChip: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.18)',
    paddingHorizontal: 10, paddingVertical: 5,
    borderRadius: 10, gap: 4,
  },
  pendingChipTxt: { color: '#FFF', fontSize: 11, fontWeight: '700' },

  // Header bottom (pills & search)
  headerBottom: {
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 16,
    shadowColor: '#0D1526',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 3,
    zIndex: 9,
    gap: 12,
  },

  searchRow: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    borderRadius: 16,
    paddingHorizontal: 16, height: 50,
    borderWidth: 1.5,
  },
  searchInput: { flex: 1, fontSize: 15, paddingVertical: 0, fontWeight: '500' },

  // Error bar
  errorBar:    { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 10, marginHorizontal: 16, borderRadius: 10, marginBottom: 8, marginTop: 8 },
  errorText:   { fontSize: 13, flex: 1 },
  errorRetry:  { fontSize: 13, fontWeight: '700' },

  // List
  list:     { flexGrow: 1, paddingBottom: 20, paddingTop: 8 },
  cardWrap: { paddingHorizontal: 16, marginBottom: 12 },
});
