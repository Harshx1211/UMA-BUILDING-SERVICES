/**
 * SiteTrack — Home Dashboard
 * Premium redesign: navy hero header → 2x2 stat grid → quick actions → today's jobs
 */
import { useCallback, useEffect, useMemo } from 'react';
import {
  Dimensions,
  RefreshControl,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  View,
  Linking,
} from 'react-native';
import Animated, { FadeInDown, useSharedValue, useAnimatedStyle, withTiming } from 'react-native-reanimated';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { ActivityIndicator, Text } from 'react-native-paper';
import { router } from 'expo-router';
import { useAuth } from '@/hooks/useAuth';
import { useDashboardStore } from '@/store/dashboardStore';
import { OfflineBanner } from '@/components/OfflineBanner';
import { SyncStatusBar } from '@/components/SyncStatusBar';
import { JobCard } from '@/components/jobs/JobCard';
import { EmptyState } from '@/components/ui/EmptyState';
import { SectionHeader } from '@/components/ui/SectionHeader';
import { JobStatus } from '@/constants/Enums';
import Colors from '@/constants/Colors';
import type { Job } from '@/types';

const { width: SCREEN_W } = Dimensions.get('window');
const CARD_W = (SCREEN_W - 16 * 2 - 12) / 2; // two columns with 12px gap

type MCIcon = React.ComponentProps<typeof MaterialCommunityIcons>['name'];
type JobWithMeta = Job & { property_name?: string; property_address?: string; property_suburb?: string; property_state?: string };

// ─── Helpers ────────────────────────────────
function greeting(): string {
  const h = new Date().getHours();
  return h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening';
}
function todayDisplay(): string {
  return new Date().toLocaleDateString('en-AU', { weekday: 'long', day: 'numeric', month: 'long' });
}
function parseTime(hhmm: string): string {
  try {
    const [h, m] = hhmm.split(':').map(Number);
    const ampm = h >= 12 ? 'PM' : 'AM';
    return `${h % 12 || 12}:${String(m).padStart(2, '0')} ${ampm}`;
  } catch { return hhmm; }
}

// ─── Stat Card ──────────────────────────────
interface StatCardProps {
  label: string;
  value: number;
  icon: MCIcon;
  iconBg: string;
  iconColor: string;
}
function StatCard({ label, value, icon, iconBg, iconColor }: StatCardProps) {
  return (
    <View style={[stat.card, { width: CARD_W }]}>
      <View style={[stat.iconCircle, { backgroundColor: iconBg }]}>
        <MaterialCommunityIcons name={icon} size={18} color={iconColor} />
      </View>
      <Text style={stat.value}>{value}</Text>
      <Text style={stat.label}>{label}</Text>
    </View>
  );
}
const stat = StyleSheet.create({
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 14,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 3,
    gap: 6,
  },
  iconCircle: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  value: {
    fontSize: 28,
    fontWeight: '800',
    color: Colors.light.text,
    letterSpacing: -0.5,
    marginTop: 2,
  },
  label: {
    fontSize: 12,
    color: Colors.light.textSecondary,
    fontWeight: '400',
  },
});

// ─── Quick Action Card ───────────────────────
interface QuickActionProps {
  emoji: string;
  label: string;
  subtitle: string;
  color: string;
  onPress: () => void;
}
function QuickAction({ emoji, label, subtitle, color, onPress }: QuickActionProps) {
  return (
    <TouchableOpacity style={[qa.card, { width: CARD_W }]} onPress={onPress} activeOpacity={0.8}>
      <View style={[qa.iconCircle, { backgroundColor: color + '18' }]}>
        <Text style={qa.emoji}>{emoji}</Text>
      </View>
      <Text style={qa.label}>{label}</Text>
      <Text style={qa.subtitle} numberOfLines={1}>{subtitle}</Text>
    </TouchableOpacity>
  );
}
const qa = StyleSheet.create({
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 14,
    minHeight: 84,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 3,
    gap: 6,
  },
  iconCircle: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emoji: { fontSize: 20 },
  label: { fontSize: 13, fontWeight: '600', color: Colors.light.text },
  subtitle: { fontSize: 11, color: Colors.light.textSecondary },
});

// ─── Next-Up Hero Card ───────────────────────
function NextUpCard({ job }: { job: JobWithMeta }) {
  const address = [job.property_address, job.property_suburb, job.property_state]
    .filter(Boolean).join(', ');
  const time = job.scheduled_time ? parseTime(job.scheduled_time) : null;

  const handleNavigate = () => {
    const q = address || job.property_name || '';
    Linking.openURL(`https://maps.google.com/?q=${encodeURIComponent(q)}`);
  };

  return (
    <View style={nu.card}>
      {/* Badge */}
      <View style={nu.badge}>
        <View style={nu.dot} />
        <Text style={nu.badgeText}>NEXT JOB{time ? ` — ${time}` : ''}</Text>
      </View>
      <Text style={nu.property} numberOfLines={1}>
        {job.property_name ?? 'Unknown Property'}
      </Text>
      {address ? <Text style={nu.address} numberOfLines={1}>📍 {address}</Text> : null}
      <View style={nu.actions}>
        <TouchableOpacity style={nu.navigateBtn} onPress={handleNavigate} activeOpacity={0.85}>
          <MaterialCommunityIcons name="navigation-variant" size={15} color="#FFFFFF" />
          <Text style={nu.navigateTxt}>Navigate</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={nu.openBtn}
          onPress={() => router.push(`/jobs/${job.id}` as never)}
          activeOpacity={0.85}
        >
          <Text style={nu.openTxt}>Open Job →</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}
const nu = StyleSheet.create({
  card: {
    backgroundColor: Colors.light.primary,
    borderRadius: 18,
    padding: 18,
    gap: 8,
    shadowColor: Colors.light.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 12,
    elevation: 8,
    marginHorizontal: 16,
    marginBottom: 4,
  },
  badge:     { flexDirection: 'row', alignItems: 'center', gap: 6 },
  dot:       { width: 8, height: 8, borderRadius: 4, backgroundColor: Colors.light.accent },
  badgeText: { fontSize: 11, fontWeight: '800', color: Colors.light.accent, letterSpacing: 0.8, textTransform: 'uppercase' },
  property:  { fontSize: 20, fontWeight: '800', color: '#FFFFFF', letterSpacing: -0.3 },
  address:   { fontSize: 13, color: 'rgba(255,255,255,0.6)' },
  actions:   { flexDirection: 'row', gap: 10, marginTop: 4 },
  navigateBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: Colors.light.accent, paddingHorizontal: 16, paddingVertical: 10, borderRadius: 10, flex: 1, justifyContent: 'center' },
  navigateTxt: { color: '#FFFFFF', fontWeight: '700', fontSize: 14 },
  openBtn:   { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: 'rgba(255,255,255,0.12)', paddingHorizontal: 16, paddingVertical: 10, borderRadius: 10, flex: 1, justifyContent: 'center' },
  openTxt:   { color: '#FFFFFF', fontWeight: '700', fontSize: 14 },
});

// ─── Weekly Summary ──────────────────────────
function WeeklySummaryCard({ completed, total }: { completed: number; total: number }) {
  const pct = total > 0 ? Math.round((completed / total) * 100) : 0;
  const width = useSharedValue(0);
  const animStyle = useAnimatedStyle(() => ({ width: `${width.value}%` as `${number}%` }));

  useEffect(() => {
    width.value = withTiming(pct, { duration: 900 });
  }, [pct, width]);

  return (
    <View style={ws.card}>
      <View style={ws.row}>
        <Text style={ws.title}>This Week</Text>
        <Text style={ws.pct}>{pct}%</Text>
      </View>
      <Text style={ws.sub}>{completed} of {total} jobs completed</Text>
      <View style={ws.track}>
        <Animated.View style={[ws.fill, animStyle]} />
      </View>
    </View>
  );
}
const ws = StyleSheet.create({
  card: {
    backgroundColor: Colors.light.primary,
    borderRadius: 16,
    padding: 16,
    marginHorizontal: 16,
    marginTop: 4,
    shadowColor: Colors.light.primary,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
  },
  row:   { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  title: { fontSize: 14, fontWeight: '700', color: '#FFFFFF' },
  pct:   { fontSize: 16, fontWeight: '800', color: Colors.light.accent },
  sub:   { fontSize: 12, color: 'rgba(255,255,255,0.65)', marginTop: 4, marginBottom: 12 },
  track: { height: 6, borderRadius: 3, backgroundColor: 'rgba(255,255,255,0.2)', overflow: 'hidden' },
  fill:  { height: 6, borderRadius: 3, backgroundColor: Colors.light.accent },
});

// ─── Main Screen ─────────────────────────────
export default function HomeScreen() {
  const { firstName } = useAuth();
  const { todayJobs, todayStats, isLoading, error, loadDashboard, clearError } = useDashboardStore();
  const { user } = useAuth();

  const load = useCallback(() => {
    if (user?.id) loadDashboard(user.id);
  }, [user?.id, loadDashboard]);

  // Placeholder for open defects count
  const openDefectsCount = 0;

  useEffect(() => { load(); }, [load]);

  const nextJob = useMemo<JobWithMeta | null>(() => {
    const now = new Date();
    const nowMinutes = now.getHours() * 60 + now.getMinutes();
    const upcoming = (todayJobs as JobWithMeta[]).filter(j => {
      if (j.status !== JobStatus.Scheduled) return false;
      if (!j.scheduled_time) return true;
      const [h, m] = j.scheduled_time.split(':').map(Number);
      return h * 60 + m >= nowMinutes;
    });
    upcoming.sort((a, b) => {
      if (!a.scheduled_time) return 1;
      if (!b.scheduled_time) return -1;
      return a.scheduled_time.localeCompare(b.scheduled_time);
    });
    return upcoming[0] ?? null;
  }, [todayJobs]);

  const sortedJobs = useMemo<JobWithMeta[]>(() => {
    return [...(todayJobs as JobWithMeta[])].sort((a, b) => {
      if (a.status === JobStatus.InProgress && b.status !== JobStatus.InProgress) return -1;
      if (b.status === JobStatus.InProgress && a.status !== JobStatus.InProgress) return 1;
      if (!a.scheduled_time) return 1;
      if (!b.scheduled_time) return -1;
      return a.scheduled_time.localeCompare(b.scheduled_time);
    });
  }, [todayJobs]);

  if (isLoading && todayJobs.length === 0) {
    return (
      <View style={[s.screen, s.centered]}>
        <ActivityIndicator size="large" color={Colors.light.primary} />
        <Text style={s.loadingText}>Loading your schedule...</Text>
      </View>
    );
  }

  if (error) {
    return (
      <View style={[s.screen, s.centered]}>
        <MaterialCommunityIcons name="alert-circle-outline" size={44} color={Colors.light.accent} />
        <Text style={s.errorMsg}>{error}</Text>
        <TouchableOpacity style={s.retryBtn} onPress={() => { clearError(); load(); }}>
          <Text style={s.retryTxt}>Try Again</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={s.screen}>
      <OfflineBanner />
      <ScrollView
        contentContainerStyle={s.scroll}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={isLoading}
            onRefresh={load}
            colors={[Colors.light.accent]}
            tintColor={Colors.light.accent}
          />
        }
      >
        {/* ══ SECTION 1 — Hero Header ══════════════════ */}
        <View style={s.header}>
          <View style={s.headerContent}>
            <View style={s.headerLeft}>
              <Text style={s.hGreet}>{greeting()}</Text>
              <Text style={s.hName}>{firstName} 👋</Text>
              <Text style={s.hDate}>{todayDisplay()}</Text>
            </View>
            <View style={s.headerRight}>
              <TouchableOpacity
                style={s.bellBtn}
                onPress={() => router.push('/notifications' as never)}
                activeOpacity={0.8}
              >
                <MaterialCommunityIcons name="bell-outline" size={24} color="#FFFFFF" />
                {/* Optional: Add badge here if requested later */}
              </TouchableOpacity>
              <SyncStatusBar />
            </View>
          </View>
        </View>

        {/* ══ SECTION 2 — 2×2 Stat Grid (overlaps header) ══ */}
        <Animated.View entering={FadeInDown.delay(50).duration(380)} style={s.statsGrid}>
          <View style={s.statsRow}>
            <StatCard label="Total Jobs"   value={todayStats.total}       icon="briefcase-outline"    iconBg="#DBEAFE" iconColor={Colors.light.info} />
            <StatCard label="Completed"    value={todayStats.completed}   icon="check-circle-outline" iconBg="#DCFCE7" iconColor={Colors.light.success} />
          </View>
          <View style={s.statsRow}>
            <StatCard label="In Progress"  value={todayStats.inProgress}  icon="progress-clock"       iconBg="#FFF7ED" iconColor={Colors.light.accent} />
            <StatCard label="Pending"      value={todayStats.total - todayStats.completed - todayStats.inProgress} icon="clock-outline" iconBg="#F1F5F9" iconColor="#94A3B8" />
          </View>
        </Animated.View>

        {/* ══ SECTION 3 — Quick Actions ═══════════════ */}
        <Animated.View entering={FadeInDown.delay(100).duration(380)}>
          <SectionHeader title="Quick Actions" />
          <View style={s.qaGrid}>
            <View style={s.statsRow}>
              <QuickAction emoji="🚀" label="Start Next Job" subtitle="Begin your next scheduled job" color={Colors.light.accent} onPress={() => router.push('/jobs' as never)} />
              <QuickAction emoji="📷" label="Scan Asset QR"  subtitle="Identify asset by QR code"  color={Colors.light.info} onPress={() => { import('react-native-toast-message').then(m => m.default.show({ type: 'info', text1: 'Coming in Phase 4' })); }} />
            </View>
            <View style={s.statsRow}>
              <QuickAction emoji="📆" label="This Week"     subtitle="View weekly job summary"    color={Colors.light.success}  onPress={() => { import('react-native-toast-message').then(m => m.default.show({ type: 'info', text1: `Completed ${todayStats.completed} of ${todayStats.total} jobs` })); }} />
              <QuickAction emoji="⚠️" label="Open Defects"  subtitle={`${openDefectsCount} defects need attention`} color={Colors.light.error} onPress={() => { import('react-native-toast-message').then(m => m.default.show({ type: 'info', text1: openDefectsCount === 0 ? 'All clear ✓' : `${openDefectsCount} defects open` })); }} />
            </View>
          </View>
        </Animated.View>

        {/* ══ SECTION 4 — Next Up Hero Card ══════════ */}
        {nextJob ? (
          <Animated.View entering={FadeInDown.delay(140).duration(380)}>
            <SectionHeader title="Next Up" />
            <NextUpCard job={nextJob} />
          </Animated.View>
        ) : null}

        {/* ══ SECTION 5 — Today's Jobs ═══════════════ */}
        <Animated.View entering={FadeInDown.delay(180).duration(380)}>
          <SectionHeader
            title="Today's Jobs"
            count={todayStats.total}
            rightLabel={todayStats.total > 0 ? 'See all →' : undefined}
            onRightPress={() => router.push('/jobs' as never)}
          />

          {sortedJobs.length === 0 ? (
            <View style={s.emptyWrap}>
              <EmptyState
                emoji="🎉"
                title="No jobs today"
                subtitle="Enjoy your day or check back after sync"
              />
            </View>
          ) : (
            <View style={s.jobList}>
              {sortedJobs.map((job) => (
                <JobCard
                  key={job.id}
                  job={job as never}
                  showNavigate
                  onPress={() => router.push(`/jobs/${job.id}` as never)}
                />
              ))}
            </View>
          )}
        </Animated.View>

        {/* ══ SECTION 6 — Weekly Summary ═════════════ */}
        <Animated.View entering={FadeInDown.delay(220).duration(380)}>
          <SectionHeader title="Weekly Summary" />
          <WeeklySummaryCard completed={todayStats.completed} total={todayStats.total} />
        </Animated.View>

        {/* Active job CTA */}
        {todayStats.inProgress > 0 && (
          <Animated.View entering={FadeInDown.delay(240).duration(380)} style={{ marginHorizontal: 16, marginTop: 12 }}>
            <TouchableOpacity
              style={s.activeBanner}
              onPress={() => router.push('/jobs' as never)}
              activeOpacity={0.85}
            >
              <View style={s.activePulse} />
              <View style={{ flex: 1 }}>
                <Text style={s.activeBannerTitle}>
                  {todayStats.inProgress} job{todayStats.inProgress > 1 ? 's' : ''} currently active
                </Text>
                <Text style={s.activeBannerSub}>Tap to view and clock out</Text>
              </View>
              <MaterialCommunityIcons name="chevron-right" size={20} color={Colors.light.accent} />
            </TouchableOpacity>
          </Animated.View>
        )}

        <View style={{ height: 36 }} />
      </ScrollView>
    </View>
  );
}

// ─── Styles ─────────────────────────────────
const s = StyleSheet.create({
  screen:   { flex: 1, backgroundColor: Colors.light.background },
  scroll:   { flexGrow: 1 },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12, padding: 24 },

  // Hero header
  header: {
    backgroundColor: Colors.light.primary,
    borderBottomLeftRadius: 28,
    borderBottomRightRadius: 28,
    shadowColor: Colors.light.primary,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.25,
    shadowRadius: 16,
    elevation: 10,
    paddingTop: 52,
    paddingBottom: 36,
  },
  headerContent: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
  },
  headerLeft: { gap: 2 },
  headerRight: { alignItems: 'flex-end', gap: 12 },
  bellBtn: {
    backgroundColor: 'rgba(255,255,255,0.15)',
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  hGreet:  { fontSize: 13, color: 'rgba(255,255,255,0.65)', fontWeight: '400' },
  hName:   { fontSize: 24, color: '#FFFFFF', fontWeight: '800', letterSpacing: -0.3 },
  hDate:   { fontSize: 12, color: 'rgba(255,255,255,0.45)', marginTop: 2 },

  // Stat grid — pulls up to overlap the header curve
  statsGrid: {
    marginTop: -20,
    paddingHorizontal: 16,
    gap: 12,
  },
  statsRow: {
    flexDirection: 'row',
    gap: 12,
  },

  // Quick actions
  qaGrid: {
    paddingHorizontal: 16,
    gap: 12,
  },

  // Today's jobs list
  jobList: {
    paddingHorizontal: 16,
    gap: 10,
    marginTop: 4,
  },
  emptyWrap: {
    marginHorizontal: 16,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 3,
  },

  // Active banner
  activeBanner: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 16,
    borderWidth: 1.5,
    borderColor: Colors.light.accent,
    shadowColor: Colors.light.accent,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.12,
    shadowRadius: 6,
    elevation: 3,
  },
  activePulse:     { width: 10, height: 10, borderRadius: 5, backgroundColor: Colors.light.accent },
  activeBannerTitle:  { fontSize: 14, fontWeight: '700', color: Colors.light.text },
  activeBannerSub:    { fontSize: 12, color: Colors.light.textSecondary, marginTop: 1 },

  // Error / loading
  loadingText: { fontSize: 14, color: Colors.light.textSecondary, marginTop: 8 },
  errorMsg:    { fontSize: 14, color: Colors.light.textSecondary, textAlign: 'center', paddingHorizontal: 32 },
  retryBtn:    { backgroundColor: Colors.light.primary, paddingHorizontal: 28, paddingVertical: 12, borderRadius: 10 },
  retryTxt:    { color: '#FFFFFF', fontWeight: '700', fontSize: 14 },
});
