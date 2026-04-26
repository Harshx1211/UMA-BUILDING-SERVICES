/**
 * SiteTrack — Home Dashboard
 * Premium design: navy hero → 2×2 stat grid → quick actions → next up → today's jobs → weekly summary
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
import * as Haptics from 'expo-haptics';
import Animated, { FadeInDown, useSharedValue, useAnimatedStyle, withTiming } from 'react-native-reanimated';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { ActivityIndicator, Text } from 'react-native-paper';
import { router } from 'expo-router';
import { useAuth } from '@/hooks/useAuth';
import { useDashboardStore } from '@/store/dashboardStore';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { OfflineBanner } from '@/components/OfflineBanner';
import { JobCard } from '@/components/jobs/JobCard';
import { EmptyState } from '@/components/ui/EmptyState';
import { SectionTitle } from '@/components/ui/SectionTitle';
import { JobStatus } from '@/constants/Enums';
import { useColors } from '@/hooks/useColors';
import type { Job } from '@/types';

import { useNotificationsStore } from '@/store/notificationsStore';


const { width: SCREEN_W } = Dimensions.get('window');
const CARD_W = (SCREEN_W - 16 * 2 - 12) / 2;

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
  accentColor: string;
  bgColor: string;
  textColor: string;
  subColor: string;
}
function StatCard({ label, value, icon, iconBg, iconColor, accentColor, bgColor, textColor, subColor }: StatCardProps) {
  const C = useColors();
  return (
    <View style={[stat.card, {
      backgroundColor: bgColor,
      borderColor: (C as any).cardBorder || 'rgba(27,45,79,0.09)',
    }]}>
      {/* Left accent bar */}
      <View style={[stat.leftBar, { backgroundColor: accentColor }]} />
      <View style={{ flex: 1, padding: 16, gap: 12 }}>
        <View style={[stat.iconCircle, { backgroundColor: iconBg }]}>
          <MaterialCommunityIcons name={icon} size={22} color={iconColor} />
        </View>
        <View>
          <Text style={[stat.value, { color: textColor }]}>{value}</Text>
          <Text style={[stat.label, { color: subColor }]}>{label}</Text>
        </View>
      </View>
    </View>
  );
}
const stat = StyleSheet.create({
  card: {
    width: CARD_W,
    borderRadius: 18,
    flexDirection: 'row',
    overflow: 'hidden',
    borderWidth: 1,
    shadowColor: '#0D1526',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.09,
    shadowRadius: 12,
    elevation: 4,
    minHeight: 130,
  },
  leftBar: {
    width: 4,
  },
  iconCircle: {
    width: 44,
    height: 44,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  value: {
    fontSize: 38,
    fontWeight: '800',
    letterSpacing: -1.5,
    lineHeight: 44,
  },
  label: {
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 0.2,
    marginTop: 2,
  },
});

// ─── Quick Action Card ───────────────────────
interface QuickActionProps {
  icon: MCIcon;
  iconColor: string;
  label: string;
  subtitle: string;
  bgColor: string;
  borderColor: string;
  textColor: string;
  subColor: string;
  onPress: () => void;
}
function QuickAction({ icon, iconColor, label, subtitle, bgColor, borderColor, textColor, subColor, onPress }: QuickActionProps) {
  return (
    <TouchableOpacity
      style={[qa.card, {
        backgroundColor: bgColor,
        borderColor: borderColor,
        borderWidth: 1,
      }]}
      onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); onPress(); }}
      activeOpacity={0.78}
    >
      <View style={[qa.iconCircle, { backgroundColor: iconColor + '18' }]}>
        <MaterialCommunityIcons name={icon} size={22} color={iconColor} />
      </View>
      <Text style={[qa.label, { color: textColor }]}>{label}</Text>
      <Text style={[qa.subtitle, { color: subColor }]} numberOfLines={2}>{subtitle}</Text>
      <View style={[qa.arrowChip, { backgroundColor: iconColor + '12' }]}>
        <MaterialCommunityIcons name="arrow-right" size={13} color={iconColor} />
      </View>
    </TouchableOpacity>
  );
}
const qa = StyleSheet.create({
  card: {
    width: CARD_W,
    borderRadius: 18,
    padding: 16,
    gap: 8,
    shadowColor: '#0D1526',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 4,
    minHeight: 130,
  },
  iconCircle: {
    width: 46,
    height: 46,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  label: { fontSize: 14, fontWeight: '700', letterSpacing: -0.2 },
  subtitle: { fontSize: 12, lineHeight: 17, marginTop: 1 },
  arrowChip: {
    width: 28,
    height: 28,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 6,
    alignSelf: 'flex-start',
  },
});

// ─── Next-Up Hero Card ───────────────────────
function NextUpCard({ job, bgColor, textColor, subColor }: { job: JobWithMeta; bgColor: string; textColor: string; subColor: string }) {
  const address = [job.property_address, job.property_suburb, job.property_state]
    .filter(Boolean).join(', ');
  const time = job.scheduled_time ? parseTime(job.scheduled_time) : null;

  const handleNavigate = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const q = address || job.property_name || '';
    Linking.openURL(`https://maps.google.com/?q=${encodeURIComponent(q)}`);
  };

  return (
    <View style={[nu.card, { backgroundColor: bgColor }]}>
      {/* Decorative circles */}
      <View style={[nu.decor1, { backgroundColor: 'rgba(255,255,255,0.06)' }]} />
      <View style={[nu.decor2, { backgroundColor: 'rgba(255,255,255,0.04)' }]} />

      <View style={nu.inner}>
        <View style={nu.header}>
          <View style={[nu.nextupChip, { backgroundColor: 'rgba(255,255,255,0.15)' }]}>
            <View style={[nu.dot, { backgroundColor: '#4ADE80' }]} />
            <Text style={[nu.nextupTxt, { color: textColor }]}>NEXT UP</Text>
          </View>
          {time && (
            <View style={[nu.timeChip, { backgroundColor: 'rgba(255,255,255,0.12)' }]}>
              <MaterialCommunityIcons name="clock-outline" size={12} color={textColor} />
              <Text style={[nu.timeTxt, { color: textColor }]}>{time}</Text>
            </View>
          )}
        </View>

        <Text style={[nu.property, { color: textColor }]} numberOfLines={1}>
          {job.property_name ?? 'Unknown Property'}
        </Text>
        {address ? (
          <View style={nu.addrRow}>
            <MaterialCommunityIcons name="map-marker-outline" size={13} color={subColor} />
            <Text style={[nu.address, { color: subColor }]} numberOfLines={1}>{address}</Text>
          </View>
        ) : null}

        <View style={nu.actions}>
          <TouchableOpacity
            style={[nu.navigateBtn, { backgroundColor: 'rgba(255,255,255,0.15)' }]}
            onPress={handleNavigate}
            activeOpacity={0.85}
          >
            <MaterialCommunityIcons name="navigation-variant" size={15} color={textColor} />
            <Text style={[nu.navigateTxt, { color: textColor }]}>Navigate</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[nu.openBtn, { backgroundColor: 'rgba(255,255,255,0.22)' }]}
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              router.push(`/jobs/${job.id}` as never);
            }}
            activeOpacity={0.85}
          >
            <Text style={[nu.openTxt, { color: textColor }]}>Open Job</Text>
            <MaterialCommunityIcons name="arrow-right" size={15} color={textColor} />
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}
const nu = StyleSheet.create({
  card: {
    marginHorizontal: 16,
    marginBottom: 8,
    borderRadius: 18,
    overflow: 'hidden',
    position: 'relative',
    shadowColor: '#0F1E3C',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.06,
    shadowRadius: 10,
    elevation: 3,
  },
  decor1: {
    position: 'absolute',
    width: 200,
    height: 200,
    borderRadius: 100,
    top: -80,
    right: -60,
  },
  decor2: {
    position: 'absolute',
    width: 140,
    height: 140,
    borderRadius: 70,
    bottom: -50,
    left: -40,
  },
  inner: { padding: 16, gap: 8 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  nextupChip: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 20 },
  nextupTxt: { fontSize: 10, fontWeight: '800', letterSpacing: 1 },
  dot: { width: 6, height: 6, borderRadius: 3 },
  timeChip: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 20 },
  timeTxt: { fontSize: 11, fontWeight: '600' },
  property: { fontSize: 22, fontWeight: '800', letterSpacing: -0.5, marginTop: 2 },
  addrRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  address: { fontSize: 13, flex: 1 },
  actions: { flexDirection: 'row', gap: 10, marginTop: 8 },
  navigateBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 16, paddingVertical: 11, borderRadius: 14, flex: 1, justifyContent: 'center' },
  navigateTxt: { fontWeight: '600', fontSize: 14 },
  openBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 16, paddingVertical: 11, borderRadius: 14, flex: 1, justifyContent: 'center' },
  openTxt: { fontWeight: '700', fontSize: 14 },
});

// ─── Weekly Summary ──────────────────────────
function WeeklySummaryCard({ completed, total, bgColor, textColor, subColor }: { completed: number; total: number; bgColor: string; textColor: string; subColor: string }) {
  const pct = total > 0 ? Math.round((completed / total) * 100) : 0;
  const width = useSharedValue(0);
  const animStyle = useAnimatedStyle(() => ({ width: `${width.value}%` as `${number}%` }));

  useEffect(() => {
    width.value = withTiming(pct, { duration: 900 });
  }, [pct, width]);

  return (
    <View style={[ws.card, { backgroundColor: bgColor }]}>
      {/* Decorative */}
      <View style={[ws.decor, { backgroundColor: 'rgba(255,255,255,0.05)' }]} />
      <View style={ws.inner}>
        <View style={ws.row}>
          <View>
            <Text style={[ws.title, { color: textColor }]}>Weekly Progress</Text>
            <Text style={[ws.sub, { color: subColor }]}>{completed} of {total} jobs complete</Text>
          </View>
          <Text style={[ws.pct, { color: textColor }]}>{pct}%</Text>
        </View>
        <View style={ws.trackBg}>
          <Animated.View style={[ws.fill, animStyle, { backgroundColor: 'rgba(255,255,255,0.9)' }]} />
        </View>
      </View>
    </View>
  );
}
const ws = StyleSheet.create({
  card: {
    marginHorizontal: 16,
    marginBottom: 8,
    borderRadius: 18,
    overflow: 'hidden',
    position: 'relative',
    shadowColor: '#0D1526',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.12,
    shadowRadius: 12,
    elevation: 5,
  },
  decor: {
    position: 'absolute',
    width: 160,
    height: 160,
    borderRadius: 80,
    top: -60,
    right: -50,
  },
  inner: { padding: 20, gap: 14 },
  row:   { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  title: { fontSize: 16, fontWeight: '700', letterSpacing: -0.2 },
  sub:   { fontSize: 13, marginTop: 3 },
  pct:   { fontSize: 34, fontWeight: '800', letterSpacing: -1 },
  trackBg: { height: 8, borderRadius: 4, backgroundColor: 'rgba(255,255,255,0.2)', overflow: 'hidden' },
  fill:    { height: 8, borderRadius: 4 },
});

// ─── Main Screen ─────────────────────────────
export default function HomeScreen() {
  const C = useColors();
  const { user, firstName } = useAuth();
  const { todayJobs, todayStats, weekStats, openDefectsCount, isLoading, error, loadDashboard, clearError } = useDashboardStore();
  const { unreadCount, loadNotifications } = useNotificationsStore();
  const insets = useSafeAreaInsets();


  const load = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (user?.id) loadDashboard(user.id);
  }, [user?.id, loadDashboard]);

  useEffect(() => { loadNotifications(); }, [loadNotifications]);
  useEffect(() => { load(); }, [load]);

  // openDefectsCount comes from dashboardStore — real SQL count

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
      <View style={[s.screen, s.centered, { backgroundColor: C.background }]}>
        <ActivityIndicator size="large" color={C.primary} />
        <Text style={[s.loadingText, { color: C.textSecondary }]}>Loading your schedule...</Text>
      </View>
    );
  }

  if (error) {
    return (
      <View style={[s.screen, s.centered, { backgroundColor: C.background }]}>
        <MaterialCommunityIcons name="alert-circle-outline" size={44} color={C.error} />
        <Text style={[s.errorMsg, { color: C.textSecondary }]}>{error}</Text>
        <TouchableOpacity style={[s.retryBtn, { backgroundColor: C.primary }]} onPress={() => { clearError(); load(); }}>
          <Text style={s.retryTxt}>Try Again</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={[s.screen, { backgroundColor: C.background }]}>
      <OfflineBanner />
      <ScrollView
        style={s.scroll}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 24 }}
        refreshControl={<RefreshControl refreshing={isLoading} onRefresh={load} tintColor={C.primary} />}
      >
        {/* ── HERO HEADER ──────────────────────────────── */}
        <View style={[s.header, { backgroundColor: C.primary, paddingTop: Math.max(insets.top, 14) + 10 }]}>
          <View style={[s.heroDot1, { backgroundColor: 'rgba(255,255,255,0.06)' }]} />
          <View style={[s.heroDot2, { backgroundColor: 'rgba(255,255,255,0.04)' }]} />

          <View style={s.headerContent}>
            <View style={s.headerLeft}>
              <Text style={s.headerEyebrow}>SITETRACK</Text>
              <Text style={s.headerTitle}>{greeting()}, {firstName}</Text>
              <Text style={s.headerSub}>{todayDisplay()}</Text>
            </View>
            <TouchableOpacity
              style={s.headerIconBtn}
              onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); router.push('/notifications' as never); }}
              activeOpacity={0.8}
            >
              <MaterialCommunityIcons name="bell-outline" size={22} color="#FFFFFF" />
              {unreadCount > 0 && (
                <View style={[s.bellBadge, { backgroundColor: C.accent, borderColor: C.primary }]}>
                  <Text style={s.bellBadgeText}>{unreadCount > 9 ? '9+' : unreadCount}</Text>
                </View>
              )}
            </TouchableOpacity>
          </View>
        </View>

        {/* Job summary pills (Moved out of header) */}
        {todayStats.total > 0 && (
          <View style={s.summaryStripOut}>
            <View style={[s.summaryPillOut, { backgroundColor: C.surface, borderColor: C.cardBorder }]}>
              <Text style={[s.summaryPillTxtOut, { color: C.textSecondary }]}>📋 {todayStats.total} scheduled</Text>
            </View>
            {todayStats.inProgress > 0 && (
              <View style={[s.summaryPillOut, { backgroundColor: 'rgba(249,115,22,0.1)' }]}>
                <View style={[s.pulseDot, { backgroundColor: C.accent }]} />
                <Text style={[s.summaryPillTxtOut, { color: C.accentDark }]}>{todayStats.inProgress} active</Text>
              </View>
            )}
            {todayStats.completed > 0 && (
              <View style={[s.summaryPillOut, { backgroundColor: 'rgba(34,197,94,0.1)' }]}>
                <Text style={[s.summaryPillTxtOut, { color: C.successDark }]}>✅ {todayStats.completed} done</Text>
              </View>
            )}
          </View>
        )}

        {/* ══ SECTION 2 — Today's Stats ════════════════ */}
        <Animated.View entering={FadeInDown.delay(50).duration(380)} style={s.statsGrid}>
          <View style={s.statsRow}>
            <StatCard
              label="Pending Today" value={todayStats.total - todayStats.completed - todayStats.inProgress}
              icon="clock-outline"
              iconBg={C.warningLight} iconColor={C.warning}
              accentColor={C.warning}
              bgColor={C.surface} textColor={C.text} subColor={C.textTertiary}
            />
            <StatCard
              label="Done Today" value={todayStats.completed}
              icon="check-circle-outline"
              iconBg={C.successLight} iconColor={C.success}
              accentColor={C.success}
              bgColor={C.surface} textColor={C.text} subColor={C.textTertiary}
            />
          </View>
        </Animated.View>

        {/* ══ SECTION 3 — Quick Actions ═══════════════ */}
        <Animated.View entering={FadeInDown.delay(100).duration(380)}>
          <SectionTitle title="Quick Actions" />
          <View style={s.qaGrid}>
            <View style={s.statsRow}>
              <QuickAction
                icon="rocket-launch-outline" iconColor={C.accent}
                label="Start Next" subtitle="Begin your next job"
                bgColor={C.surface} borderColor={C.cardBorder}
                textColor={C.text} subColor={C.textSecondary}
                onPress={() => router.push('/jobs' as never)}
              />
              <QuickAction
                icon="calendar-month-outline" iconColor={C.info}
                label="My Schedule" subtitle="View all your jobs"
                bgColor={C.surface} borderColor={C.cardBorder}
                textColor={C.text} subColor={C.textSecondary}
                onPress={() => router.push('/jobs' as never)}
              />
            </View>
            <View style={s.statsRow}>
              <QuickAction
                icon="calendar-week-outline" iconColor={C.success}
                label="This Week" subtitle="View weekly summary"
                bgColor={C.surface} borderColor={C.cardBorder}
                textColor={C.text} subColor={C.textSecondary}
                onPress={() => {
                  const pct = weekStats.total > 0
                    ? Math.round((weekStats.completed / weekStats.total) * 100)
                    : 0;
                  import('react-native-toast-message').then(m => m.default.show({
                    type: pct === 100 ? 'success' : 'info',
                    text1: `This Week: ${weekStats.completed}/${weekStats.total} jobs`,
                    text2: `${pct}% complete`,
                  }));
                }}
              />
              <QuickAction
                icon="alert-circle-outline" iconColor={C.error}
                label="Open Defects"
                subtitle={
                  openDefectsCount === 0
                    ? 'No open defects ✓'
                    : `${openDefectsCount} defect${openDefectsCount > 1 ? 's' : ''} need attention`
                }
                bgColor={C.surface} borderColor={C.cardBorder}
                textColor={C.text} subColor={C.textSecondary}
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  router.push('/defects' as never);
                }}
              />
            </View>
          </View>
        </Animated.View>

        {/* ══ SECTION 4 — Next Up Hero Card ══════════ */}
        {nextJob ? (
          <Animated.View entering={FadeInDown.delay(140).duration(380)}>
            <SectionTitle title="Next Up" />
            <NextUpCard job={nextJob} bgColor={C.primary} textColor="#FFFFFF" subColor="rgba(255,255,255,0.65)" />
          </Animated.View>
        ) : null}

        {/* ══ SECTION 5 — Today's Jobs ═══════════════ */}
        <Animated.View entering={FadeInDown.delay(180).duration(380)}>
          <SectionTitle
            title="Today's Jobs"
            count={todayStats.total}
            rightLabel={todayStats.total > 0 ? 'See all →' : undefined}
            onRightPress={() => router.push('/jobs' as never)}
          />

          {sortedJobs.length === 0 ? (
            <View style={[s.emptyWrap, { backgroundColor: C.surface, borderColor: C.cardBorder }]}>
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
          <SectionTitle title="Weekly Summary" />
          <WeeklySummaryCard
            completed={weekStats.completed}
            total={weekStats.total}
            bgColor={C.primary}
            textColor="#FFFFFF"
            subColor="rgba(255,255,255,0.65)"
          />
        </Animated.View>

        {/* ══ Active job CTA ══════════════════════════ */}
        {todayStats.inProgress > 0 && (
          <Animated.View entering={FadeInDown.delay(240).duration(380)} style={{ marginHorizontal: 16, marginTop: 16 }}>
            <TouchableOpacity
              style={[s.activeBanner, {
                backgroundColor: C.surface,
                borderColor: C.accent + '50',
                shadowColor: C.accent,
              }]}
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                router.push('/jobs' as never);
              }}
              activeOpacity={0.85}
            >
              <View style={[s.activePulseDot, { backgroundColor: C.accent }]} />
              <View style={{ flex: 1 }}>
                <Text style={[s.activeBannerTitle, { color: C.text }]}>
                  {todayStats.inProgress} job{todayStats.inProgress > 1 ? 's' : ''} in progress
                </Text>
                <Text style={[s.activeBannerSub, { color: C.textSecondary }]}>Tap to view and clock out</Text>
              </View>
              <MaterialCommunityIcons name="chevron-right" size={20} color={C.accent} />
            </TouchableOpacity>
          </Animated.View>
        )}

        <View style={{ height: 40 }} />
      </ScrollView>


    </View>
  );
}

// ─── Styles ─────────────────────────────────
const s = StyleSheet.create({
  screen:   { flex: 1 },
  scroll:   { flexGrow: 1 },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12, padding: 24 },

  // Hero header
  header: {
    borderBottomLeftRadius: 28,
    borderBottomRightRadius: 28,
    paddingBottom: 20,
    overflow: 'hidden',
    position: 'relative',
    shadowColor: '#0D1526',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.18,
    shadowRadius: 14,
    elevation: 10,
  },
  heroDot1: {
    position: 'absolute', width: 280, height: 280, borderRadius: 140, top: -110, right: -100,
  },
  heroDot2: {
    position: 'absolute', width: 180, height: 180, borderRadius: 90, bottom: -70, left: -50,
  },
  headerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
  },
  headerLeft: { gap: 3, flex: 1 },
  headerRight: { flexDirection: 'row', alignItems: 'center', gap: 10 },

  headerIconBtn: {
    width: 44, height: 44, borderRadius: 22,
    backgroundColor: 'rgba(255,255,255,0.15)',
    alignItems: 'center', justifyContent: 'center',
    position: 'relative',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
  },
  bellBadge: {
    position: 'absolute', top: -3, right: -3,
    width: 18, height: 18, borderRadius: 9,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 2,
  },
  bellBadgeText: { fontSize: 9, fontWeight: '800', color: '#FFFFFF' },
  headerEyebrow: { fontSize: 10, color: 'rgba(255,255,255,0.5)', fontWeight: '700', letterSpacing: 2.5, marginBottom: 2 },
  headerTitle: { fontSize: 28, color: '#FFFFFF', fontWeight: '800', letterSpacing: -0.5 },
  headerSub:   { fontSize: 13, color: 'rgba(255,255,255,0.55)', marginTop: 3, fontWeight: '400' },

  summaryStripOut: {
    flexDirection: 'row', gap: 8,
    paddingHorizontal: 16, marginTop: 16,
    flexWrap: 'wrap',
  },
  summaryPillOut: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8,
    borderWidth: 1, borderColor: 'transparent',
  },
  summaryPillTxtOut: { fontSize: 12, fontWeight: '600' },
  pulseDot: { width: 6, height: 6, borderRadius: 3 },
  statsGrid: {
    marginTop: 20,
    paddingHorizontal: 16,
    gap: 12,
    marginBottom: 4,
  },
  statsRow: { flexDirection: 'row', gap: 12 },

  qaGrid: {
    paddingHorizontal: 16,
    gap: 12,
    marginBottom: 4,
  },
  jobList: {
    paddingHorizontal: 16,
    gap: 12,
    marginBottom: 4,
  },
  emptyWrap: {
    marginHorizontal: 16,
    borderRadius: 16,
    borderWidth: 1,
    marginBottom: 12,
  },

  activeBanner: {
    borderRadius: 18,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 16,
    borderWidth: 1,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.10,
    shadowRadius: 10,
    elevation: 4,
  },
  activePulseDot: { width: 8, height: 8, borderRadius: 4 },
  activeBannerTitle: { fontSize: 14, fontWeight: '700' },
  activeBannerSub:   { fontSize: 12, marginTop: 1 },

  loadingText: { fontSize: 14, marginTop: 8 },
  errorMsg:    { fontSize: 14, textAlign: 'center', paddingHorizontal: 32 },
  retryBtn:    { paddingHorizontal: 28, paddingVertical: 12, borderRadius: 10, marginTop: 4 },
  retryTxt:    { color: '#FFFFFF', fontWeight: '700', fontSize: 14 },
});
