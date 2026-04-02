// Jobs Schedule screen — navy curved header + pill filter tabs + search bar + sectioned list
import { useCallback, useEffect, useMemo, useState } from 'react';
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
import { useAuth } from '@/hooks/useAuth';
import { useJobsStore, type JobFilter, type JobWithProperty } from '@/store/jobsStore';
import { JobCard } from '@/components/jobs/JobCard';
import { SkeletonCard } from '@/components/ui/SkeletonCard';
import { EmptyState } from '@/components/ui/EmptyState';
import Colors from '@/constants/Colors';

const TODAY    = new Date().toISOString().slice(0, 10);
const TOMORROW = new Date(Date.now() + 86400000).toISOString().slice(0, 10);

function dateLabel(iso: string): string {
  if (iso === TODAY)    return 'Today';
  if (iso === TOMORROW) return 'Tomorrow';
  try {
    return new Date(iso + 'T00:00:00').toLocaleDateString('en-AU', {
      weekday: 'short', day: 'numeric', month: 'short',
    });
  } catch { return iso; }
}

// ─── Section header ──────────────────────────
function SectionHeader({ title, count }: { title: string; count: number }) {
  const isToday = title === 'Today';
  return (
    <View style={[sh.row, { backgroundColor: Colors.light.background }]}>
      <Text style={[sh.label, isToday && sh.labelToday]}>{title.toUpperCase()}</Text>
      <View style={[sh.badge, isToday && sh.badgeToday]}>
        <Text style={[sh.badgeText, isToday && sh.badgeTextToday]}>{count}</Text>
      </View>
    </View>
  );
}
const sh = StyleSheet.create({
  row:          { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 16, paddingVertical: 10, backgroundColor: Colors.light.background },
  label:        { fontSize: 11, fontWeight: '800', color: Colors.light.textSecondary, letterSpacing: 1.3, flex: 1 },
  labelToday:   { color: Colors.light.primary },
  badge:        { backgroundColor: Colors.light.backgroundTertiary, paddingHorizontal: 8, paddingVertical: 2, borderRadius: 20 },
  badgeToday:   { backgroundColor: Colors.light.primary },
  badgeText:    { fontSize: 11, fontWeight: '700', color: Colors.light.textSecondary },
  badgeTextToday: { color: '#FFFFFF' },
});

const TABS: { key: JobFilter; label: string }[] = [
  { key: 'today', label: 'Today' },
  { key: 'week',  label: 'This Week' },
  { key: 'all',   label: 'All Jobs' },
];

export default function JobsScreen() {
  const { user } = useAuth();
  const {
    jobs, isLoading, error, activeFilter, searchQuery,
    loadJobs, getFilteredJobs, setFilter, setSearchQuery, clearError,
  } = useJobsStore();
  const [search, setSearch] = useState(searchQuery);

  const load = useCallback(() => { if (user?.id) loadJobs(user.id); }, [user?.id, loadJobs]);
  useEffect(() => { load(); }, [load]);
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
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, data]) => ({
        date, title: dateLabel(date),
        data: data.sort((a, b) =>
          (a.scheduled_time ?? '99:99').localeCompare(b.scheduled_time ?? '99:99')
        ),
      }));
  }, [filtered]);

  return (
    <View style={s.screen}>

      {/* ── Navy curved header ─────────────────── */}
      <View style={s.header}>
        <View style={s.headerInner}>
          <View>
            <Text style={s.headerTitle}>My Jobs</Text>
            <Text style={s.headerSub}>
              {new Date().toLocaleDateString('en-AU', { weekday: 'long', day: 'numeric', month: 'long' })}
            </Text>
          </View>
          {isLoading && <ActivityIndicator color="rgba(255,255,255,0.7)" size="small" />}
        </View>
      </View>

      {/* ── Pill filter tabs — overlaps header ──── */}
      <View style={s.tabsCard}>
        {TABS.map(f => (
          <TouchableOpacity
            key={f.key}
            style={[s.tab, activeFilter === f.key && s.tabActive]}
            onPress={() => setFilter(f.key)}
            activeOpacity={0.8}
          >
            <Text style={[s.tabText, activeFilter === f.key && s.tabTextActive]}>
              {f.label}{counts[f.key] > 0 ? ` (${counts[f.key]})` : ''}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* ── Search bar ─────────────────────────── */}
      <View style={s.searchCard}>
        <MaterialCommunityIcons name="magnify" size={18} color={Colors.light.textSecondary} />
        <TextInput
          style={s.searchInput}
          placeholder="Search property or address..."
          placeholderTextColor={Colors.light.textTertiary}
          value={search}
          onChangeText={setSearch}
          returnKeyType="search"
        />
        {search.length > 0 && (
          <TouchableOpacity onPress={() => setSearch('')} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <MaterialCommunityIcons name="close-circle" size={17} color={Colors.light.border} />
          </TouchableOpacity>
        )}
      </View>

      {/* ── Error bar ─────────────────────────── */}
      {error ? (
        <View style={s.errorBar}>
          <Text style={s.errorText}>{error}</Text>
          <TouchableOpacity onPress={() => { clearError(); load(); }}>
            <Text style={s.errorRetry}>Retry</Text>
          </TouchableOpacity>
        </View>
      ) : null}

      {/* ── List ──────────────────────────────── */}
      {isLoading && jobs.length === 0 ? (
        <View style={{ paddingTop: 8 }}>
          {[1, 2, 3, 4].map(i => <SkeletonCard key={i} />)}
        </View>
      ) : (
        <SectionList
          sections={sections}
          keyExtractor={item => item.id}
          contentContainerStyle={[s.list, sections.length === 0 && { flex: 1 }]}
          showsVerticalScrollIndicator={false}
          stickySectionHeadersEnabled
          renderSectionHeader={({ section }) =>
            <SectionHeader title={section.title} count={section.data.length} />
          }
          renderItem={({ item }) => (
            <View style={s.cardWrap}>
              <JobCard
                job={item}
                showNavigate
                onPress={() => router.push(`/jobs/${item.id}` as never)}
              />
            </View>
          )}
          refreshControl={
            <RefreshControl
              refreshing={isLoading}
              onRefresh={load}
              colors={[Colors.light.accent]}
              tintColor={Colors.light.accent}
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
      )}
    </View>
  );
}

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: Colors.light.background },

  // Header
  header: {
    backgroundColor: Colors.light.primary,
    borderBottomLeftRadius: 28,
    borderBottomRightRadius: 28,
    shadowColor: Colors.light.primary,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.25,
    shadowRadius: 12,
    elevation: 8,
    paddingTop: 52,
    paddingBottom: 36,
  },
  headerInner: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
  },
  headerTitle: { fontSize: 22, fontWeight: '700', color: '#FFFFFF', letterSpacing: -0.3 },
  headerSub:   { fontSize: 12, color: 'rgba(255,255,255,0.55)', marginTop: 3 },

  // Filter tabs — floating pill card overlapping header
  tabsCard: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    borderRadius: 25,
    marginHorizontal: 16,
    marginTop: -20,
    padding: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 10,
    elevation: 4,
    marginBottom: 10,
  },
  tab:              { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5, paddingVertical: 8, borderRadius: 20 },
  tabActive:        { backgroundColor: Colors.light.primary },
  tabText:          { fontSize: 13, fontWeight: '500', color: Colors.light.textSecondary },
  tabTextActive:    { color: '#FFFFFF', fontWeight: '600' },
  tabBadge:         { backgroundColor: Colors.light.backgroundTertiary, paddingHorizontal: 6, paddingVertical: 1, borderRadius: 10 },
  tabBadgeActive:   { backgroundColor: Colors.light.accent },
  tabBadgeText:     { fontSize: 10, fontWeight: '700', color: Colors.light.textSecondary },
  tabBadgeTextActive: { color: '#FFFFFF' },

  // Search
  searchCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#FFFFFF',
    marginHorizontal: 16,
    marginBottom: 8,
    borderRadius: 12,
    paddingHorizontal: 12,
    height: 44,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    color: Colors.light.text,
    paddingVertical: 0,
  },

  // Error bar
  errorBar:    { backgroundColor: Colors.light.errorLight, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 10, marginHorizontal: 16, borderRadius: 10, marginBottom: 8 },
  errorText:   { fontSize: 13, color: Colors.light.errorDark, flex: 1 },
  errorRetry:  { fontSize: 13, fontWeight: '700', color: Colors.light.errorDark },

  // List
  list:     { flexGrow: 1, paddingBottom: 16 },
  cardWrap: { paddingHorizontal: 16, marginBottom: 10 },
});
