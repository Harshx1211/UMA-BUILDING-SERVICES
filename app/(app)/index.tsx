/**
 * Home Screen — SiteTrack
 *
 * Design rules enforced here:
 *  - All colors from T.* tokens only — zero hardcoded hex values
 *  - KPI stat numbers are neutral (T.textPrimary) — not semantic colors
 *  - No emoji anywhere in UI copy
 *  - Status badges use the shared <Badge> component
 *  - Empty state uses <EmptyState> with a vector icon, not an emoji
 *  - Section labels are sentence-case via <SectionHeader>
 *  - Notification bell uses MaterialCommunityIcons, not an emoji
 */
import { useEffect, useCallback, useMemo, useRef, useState } from 'react';
import {
  View, ScrollView, TouchableOpacity, StyleSheet, Animated, RefreshControl,
} from 'react-native';
import { Text } from '@/components/ui/AppText';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { router, useFocusEffect } from 'expo-router';
import { useAuth } from '@/hooks/useAuth';
import { useJobsStore } from '@/store/jobsStore';
import { onSyncComplete, offSyncComplete, runSync } from '@/lib/sync';
import { getUnreadNotificationCount, getOverdueCompliancePropertyCount, getOverdueComplianceProperties } from '@/lib/database';
import { OverdueSheet, type OverdueProperty } from '@/components/home/OverdueSheet';
import { jobTypeLabel } from '@/constants/JobTypeLabels';
import { T } from '@/constants/Colors';
import { JobStatus } from '@/constants/Enums';
import type { Job } from '@/types';
import { ScreenHeader, Badge, EmptyState, Card, cardShadow, SkeletonBlock } from '@/components/ui';
import { SyncStatusBar } from '@/components/SyncStatusBar';
import { localDateString } from '@/utils/dateHelpers';
import { useResponsive } from '@/hooks/useResponsive';
import { openJob } from '@/utils/navigation';

// ─── Priority left-bar color (semantic, matches the rule: urgent=danger, high=warning) ──
const PRIORITY_BAR: Record<string, string> = {
  urgent: T.danger,
  high:   T.warning,
  normal: T.border,
  low:    T.border,
};

function greeting(): string {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  return 'Good evening';
}

function todayStr(): string {
  return new Date().toLocaleDateString('en-AU', { weekday: 'long', day: 'numeric', month: 'long' });
}

// ─── Job Card ─────────────────────────────────────────────────────────────────
type JobWithJoins = Job & { property_name?: string; address?: string; suburb?: string };

function JobCard({ job, index }: { job: Job; index: number }) {
  const anim = useRef(new Animated.Value(0)).current;
  const j = job as JobWithJoins;

  useEffect(() => {
    // FIX: uncapped index*50 delay meant a busy day (10-15 jobs across
    // Today + Upcoming) took up to ~1s for the last card to finish
    // appearing — a genuinely fast local-SQLite load was made to FEEL
    // slow by the animation itself. Capped so the stagger is still visible
    // for the first few cards but the whole list settles quickly either way.
    Animated.timing(anim, {
      toValue: 1, duration: 300, delay: Math.min(index * 50, 200), useNativeDriver: true,
    }).start();
  }, [anim, index]);

  const metaDate = job.scheduled_date
    ? new Date(job.scheduled_date + 'T00:00:00').toLocaleDateString('en-AU', {
        weekday: 'short', day: 'numeric', month: 'short',
      })
    : null;

  const updDate = job.updated_at
    ? new Date(job.updated_at).toLocaleDateString('en-AU', {
        weekday: 'short', day: 'numeric', month: 'short',
      })
    : null;

  const address = [j.address, j.suburb].filter(Boolean).join(', ');
  const time = job.scheduled_time ? fmtTime(job.scheduled_time) : null;
  const activity = (job.status === JobStatus.InProgress || job.status === JobStatus.Completed) && updDate
    ? `${job.status === JobStatus.Completed ? 'Done' : 'Started'} ${updDate}`
    : null;

  return (
    <Animated.View
      style={{
        opacity: anim,
        transform: [{ translateY: anim.interpolate({ inputRange: [0, 1], outputRange: [12, 0] }) }],
        marginBottom: T.space12,
      }}
    >
      <TouchableOpacity
        style={styles.jobCard}
        onPress={() => openJob(job.id)}
        activeOpacity={0.82}
        accessibilityRole="button"
        accessibilityLabel={`${j.property_name ?? 'Job'}, ${job.status}`}
      >
        {/* Priority bar (urgent red, high amber) */}
        <View style={[styles.priorityBar, { backgroundColor: PRIORITY_BAR[job.priority] ?? 'transparent' }]} />

        <View style={styles.jobBody}>
          <View style={styles.jobTop}>
            <View style={{ flex: 1, minWidth: 0, gap: 4 }}>
              <View style={styles.statusRow}>
                <Badge status={job.status} />
                {time ? <Text style={styles.timeText}>{time}</Text> : null}
              </View>
              <Text style={styles.jobName} numberOfLines={1}>
                {j.property_name ?? 'Unknown Property'}
              </Text>
              {address ? (
                <View style={styles.addrRow}>
                  <MaterialCommunityIcons name="map-marker-outline" size={15} color={T.textMuted} />
                  <Text style={styles.jobAddress} numberOfLines={1}>{address}</Text>
                </View>
              ) : null}
            </View>
            <View style={styles.chevronTile}>
              <MaterialCommunityIcons name="chevron-right" size={20} color={T.textPrimary} />
            </View>
          </View>

          <View style={styles.jobFooter}>
            <View style={styles.metaItem}>
              <MaterialCommunityIcons name="clipboard-text-outline" size={15} color={T.textMuted} />
              <Text style={styles.metaText} numberOfLines={1}>{jobTypeLabel(job.job_type) || 'Job'}</Text>
            </View>
            {activity ? (
              <View style={styles.metaItem}>
                <MaterialCommunityIcons
                  name={job.status === JobStatus.Completed ? 'check-circle-outline' : 'play-circle-outline'}
                  size={15}
                  color={job.status === JobStatus.Completed ? T.success : T.primary}
                />
                <Text style={[styles.metaText, { color: job.status === JobStatus.Completed ? T.success : T.primary, fontWeight: '600' }]}>
                  {activity}
                </Text>
              </View>
            ) : metaDate ? (
              <View style={styles.metaItem}>
                <MaterialCommunityIcons name="calendar-outline" size={15} color={T.textMuted} />
                <Text style={styles.metaText}>{metaDate}</Text>
              </View>
            ) : null}
          </View>
        </View>
      </TouchableOpacity>
    </Animated.View>
  );
}

/** "14:30:00" -> "2:30 pm" */
function fmtTime(t: string): string {
  const [h, m] = t.split(':').map(Number);
  if (!Number.isFinite(h)) return t;
  const hh = h % 12 === 0 ? 12 : h % 12;
  return `${hh}:${String(m || 0).padStart(2, '0')} ${h < 12 ? 'am' : 'pm'}`;
}

// ─── Main Screen ──────────────────────────────────────────────────────────────
export default function HomeScreen() {
  const { user }               = useAuth();
  const { contentMaxWidth, isTablet } = useResponsive();
  const { jobs, isLoading } = useJobsStore();
  const [refreshing, setRefreshing]   = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [overdueCount, setOverdueCount] = useState(0);
  const [overdueList, setOverdueList] = useState<OverdueProperty[] | null>(null);
  // Drives the ring pulsing out of the active job's dot (0 → 1, repeating).
  const pulseAnim = useRef(new Animated.Value(0)).current;

  // FIX: Use localDateString() instead of toISOString().slice(0,10).
  // toISOString() is UTC — before ~10am AEST the UTC date is already "yesterday".
  // This caused "Today's Jobs" to show 0 jobs all morning in Australian timezones.
  const today      = localDateString();
  // FIX: a job actually started/completed today but scheduled for a
  // different day used to fall out of "Today's jobs" entirely (strict
  // scheduled_date === today), undercounting "Done today" and hiding jobs
  // worked on today under Upcoming/nothing instead. updateJobStatus()
  // (jobsStore.ts) stamps updated_at with the exact status-change moment,
  // so an in_progress/completed job counts as "today's" if either its
  // schedule or its actual activity falls today — matches the same fix
  // applied to the Schedule tab's Today/Week filters.
  // FIX: these used to re-filter/re-scan the full `jobs` array inline in
  // the render body on EVERY render of this screen — including renders
  // triggered by unrelated state (unreadCount, overdueCount, refreshing),
  // not just when `jobs` itself actually changed. Memoized so this work
  // only re-runs when the jobs list or the current date actually changes.
  const todayJobs = useMemo(() => jobs.filter((j: Job) =>
    j.scheduled_date === today ||
    ((j.status === JobStatus.InProgress || j.status === JobStatus.Completed) && j.updated_at?.substring(0, 10) === today)
  ), [jobs, today]);
  const doneToday  = useMemo(() => todayJobs.filter((j: Job) => j.status === JobStatus.Completed).length, [todayJobs]);
  const inProgress = useMemo(() => jobs.find((j: Job) => j.status === JobStatus.InProgress), [jobs]);
  const openCount  = useMemo(() => jobs.filter((j: Job) =>
    j.status !== JobStatus.Completed && j.status !== JobStatus.Cancelled
  ).length, [jobs]);
  // Exclude anything already shown in Today's Jobs — a job scheduled ahead
  // but started early now qualifies for todayJobs via updated_at too, and
  // without this it would render twice (once per section).
  const upcoming = useMemo(() => {
    const todayJobIds = new Set(todayJobs.map((j: Job) => j.id));
    return jobs
      .filter((j: Job) => j.scheduled_date > today && !todayJobIds.has(j.id))
      .slice(0, 5);
  }, [jobs, todayJobs, today]);

  // FIX: this used to call loadJobs(user.id) itself, both here and inside
  // onSync below — but app/(app)/_layout.tsx (this screen's own parent)
  // already does an eager loadJobs() the moment the user session is ready,
  // AND subscribes the jobs store to auto-reload on every future sync
  // completion (subscribeToSync). Since `jobs`/`isLoading` come from that
  // same shared Zustand store, this screen already re-renders correctly
  // whenever either of those fires — calling loadJobs() a second time here
  // just re-ran the exact same synchronous SQLite query for no benefit,
  // stacking right on top of the layout's own load at the single moment
  // (login -> home transition) most likely to produce a visible stutter.
  useEffect(() => {
    if (user) {
      setUnreadCount(getUnreadNotificationCount(user.id));
      setOverdueCount(getOverdueCompliancePropertyCount(user.id, today));
    }

    const onSync = () => {
      if (user) {
        setUnreadCount(getUnreadNotificationCount(user.id));
        setOverdueCount(getOverdueCompliancePropertyCount(user.id, today));
      }
    };
    onSyncComplete(onSync);

    // Active job pulse animation — store reference so we can stop it on unmount
    // FIX (look): the whole Active job card used to grow and shrink
    // non-stop. Now the card stays still and only the dot gives off a soft
    // ring, the usual "live" signal.
    const pulseAnimation = Animated.loop(
      Animated.timing(pulseAnim, { toValue: 1, duration: 1600, useNativeDriver: true }),
    );
    pulseAnimation.start();

    return () => {
      offSyncComplete(onSync);
      // FIX: Stop the pulse animation on unmount to prevent the
      // "Can't perform a React state update on an unmounted component" warning.
      pulseAnimation.stop();
    };
  }, [user, pulseAnim, today]);

  // FIX: the bell badge only refreshed on mount or on a full sync cycle —
  // now up to 10 minutes apart (constants/Config.ts) — so marking
  // notifications read and coming straight back here left a stale count
  // showing for a long time. Notifications are purely local-DB reads with
  // no realtime channel of their own, so refetching on every return to this
  // screen is the simplest correct fix.
  useFocusEffect(
    useCallback(() => {
      if (user) setUnreadCount(getUnreadNotificationCount(user.id));
    }, [user])
  );

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await runSync();
    setRefreshing(false);
  }, []);

  return (
    <View style={styles.screen}>
      {/* ── Header ── */}
      <ScreenHeader
        title={`${greeting()}, ${user?.full_name?.split(' ')[0] ?? 'Technician'}`}
        subtitle={todayStr()}
        extra={<SyncStatusBar />}
        rightComponent={
          <TouchableOpacity
            style={styles.bellBtn}
            // FIX: every other interactive control on this screen/the login
            // screen fires a haptic on press (Button component, biometric
            // button, etc.) — this frequently-tapped nav target didn't,
            // breaking the tap-buzz pattern the rest of the app trains the
            // user to expect.
            onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); router.push('/(app)/notifications'); }}
            accessibilityRole="button"
            accessibilityLabel={unreadCount > 0 ? `Notifications, ${unreadCount} unread` : 'Notifications'}
          >
            <MaterialCommunityIcons
              name={unreadCount > 0 ? 'bell-badge-outline' : 'bell-outline'}
              size={22}
              color={unreadCount > 0 ? T.primary : T.textMuted}
            />
            {unreadCount > 0 && (
              <View style={styles.bellBadge}>
                <Text style={styles.bellBadgeText}>{unreadCount > 9 ? '9+' : unreadCount}</Text>
              </View>
            )}
          </TouchableOpacity>
        }
      />

      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={T.primary} colors={[T.primary]} />
        }
        contentContainerStyle={[styles.scroll, { maxWidth: contentMaxWidth, width: '100%', alignSelf: 'center' }]}
      >
        {/* ── Active job (approved Batch B card) ── */}
        {inProgress && (
          <View style={styles.activeCard}>
            <View style={styles.activeTopBar} />
            <View style={styles.activeHead}>
              <View style={styles.activePill}>
                <View style={styles.activeDotWrap}>
                  <Animated.View
                    style={[styles.activeDotRing, {
                      opacity: pulseAnim.interpolate({ inputRange: [0, 1], outputRange: [0.45, 0] }),
                      transform: [{ scale: pulseAnim.interpolate({ inputRange: [0, 1], outputRange: [1, 2.6] }) }],
                    }]}
                  />
                  <View style={styles.activeDot} />
                </View>
                <Text style={styles.activeEyebrow}>ACTIVE JOB</Text>
              </View>
            </View>
            <Text style={styles.activeName} numberOfLines={1}>
              {(inProgress as JobWithJoins).property_name ?? 'Unknown Property'}
            </Text>
            {((inProgress as JobWithJoins).address || (inProgress as JobWithJoins).suburb) ? (
              <View style={styles.addrRow}>
                <MaterialCommunityIcons name="map-marker-outline" size={16} color={T.textMuted} />
                <Text style={styles.activeMeta} numberOfLines={1}>
                  {[(inProgress as JobWithJoins).address, (inProgress as JobWithJoins).suburb].filter(Boolean).join(', ')}
                </Text>
              </View>
            ) : null}
            <View style={styles.addrRow}>
              <MaterialCommunityIcons name="clipboard-text-outline" size={16} color={T.textMuted} />
              <Text style={styles.activeMeta}>{jobTypeLabel(inProgress.job_type) || 'Job'}</Text>
            </View>
            <TouchableOpacity
              style={styles.activeOpenBtn}
              onPress={() => openJob(inProgress.id)}
              activeOpacity={0.85}
              accessibilityRole="button"
              accessibilityLabel="Open active job"
            >
              <Text style={styles.activeOpenBtnText}>Open job</Text>
              <MaterialCommunityIcons name="arrow-right" size={18} color={T.textOnPrimary} />
            </TouchableOpacity>
          </View>
        )}

        {/* ── Overdue properties: tap to see which ── */}
        {overdueCount > 0 && (
          <TouchableOpacity
            style={styles.overdueBanner}
            activeOpacity={0.8}
            accessibilityRole="button"
            accessibilityLabel={`${overdueCount} overdue. Show properties`}
            onPress={() => {
              if (!user) return;
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              const list = getOverdueComplianceProperties(user.id, today);
              if (list.length === 1) router.push(`/(app)/properties/${list[0].id}` as never);
              else if (list.length > 1) setOverdueList(list);
            }}
          >
            <View style={styles.overdueIcon}>
              <MaterialCommunityIcons name="alert-outline" size={18} color={T.danger} />
            </View>
            <Text style={styles.overdueText} numberOfLines={2}>
              {overdueCount} propert{overdueCount === 1 ? 'y is' : 'ies are'} overdue for inspection
            </Text>
            <MaterialCommunityIcons name="chevron-right" size={20} color={T.danger} />
          </TouchableOpacity>
        )}

        {/* ── KPI Stat Tiles ── */}
        {/* FIX: kpiRow/kpiCard used to be pure flex:1, so on a tablet
            (contentMaxWidth capped at 720 but nothing constraining these
            individual tiles) the three cards stretched to fill the full
            width — three very wide, mostly-empty cards with a small
            centered number. Capped to a fixed max width and the row
            centered (instead of stretched) on tablet, same fix pattern
            useResponsive's own doc comment describes for phone-sized
            elements otherwise stretching edge-to-edge. */}
        <View style={[styles.kpiRow, isTablet && styles.kpiRowTablet]}>
          {isLoading
            ? (["Today's jobs", 'Open jobs', 'Done today'] as const).map((label) => (
                <View key={label} style={[styles.kpiCard, isTablet && styles.kpiCardTablet]}>
                  <SkeletonBlock width={32} height={26} borderRadius={6} />
                  <SkeletonBlock width={48} height={10} borderRadius={4} style={{ marginTop: 6 }} />
                </View>
              ))
            : [
                // Overview → what's still outstanding → what's done — reads
                // left to right as the state of today's work, completed last.
                { value: todayJobs.length, label: "Today's jobs"   },
                { value: openCount,        label: 'Open jobs'      },
                { value: doneToday,        label: 'Done today' },
              ].map(({ value, label }) => (
                <View key={label} style={[styles.kpiCard, isTablet && styles.kpiCardTablet]}>
                  <Text style={styles.kpiLabel} numberOfLines={1}>{label}</Text>
                  <Text style={styles.kpiValue}>{value}</Text>
                </View>
              ))
          }
        </View>

        {/* ── Today's Jobs ── */}
        <View style={styles.section}>
          <View style={styles.sectionRow}>
            <Text style={styles.sectionTitle}>Today&apos;s jobs</Text>
            {todayJobs.length > 0 ? (
              <Text style={styles.sectionCount}>
                {todayJobs.length - doneToday > 0 ? `${todayJobs.length - doneToday} remaining` : 'All done'}
              </Text>
            ) : null}
          </View>
          {todayJobs.length === 0 ? (
            <Card>
              <EmptyState
                icon="calendar-blank-outline"
                title="No jobs scheduled today"
                subtitle="Your queue is clear. Pull down to refresh."
              />
            </Card>
          ) : (
            todayJobs.map((job: Job, idx: number) => (
              <JobCard key={job.id} job={job} index={idx} />
            ))
          )}
        </View>

        {/* ── Upcoming ── */}
        {upcoming.length > 0 && (
          <View style={styles.section}>
            <View style={styles.sectionRow}>
              <Text style={styles.sectionTitle}>Upcoming</Text>
              <Text style={styles.sectionCount}>{upcoming.length}</Text>
            </View>
            {upcoming.map((job: Job, idx: number) => (
              <JobCard key={job.id} job={job} index={idx} />
            ))}
          </View>
        )}
      </ScrollView>

      <OverdueSheet
        visible={!!overdueList}
        properties={overdueList ?? []}
        onClose={() => setOverdueList(null)}
        onOpen={(id) => { setOverdueList(null); router.push(`/(app)/properties/${id}` as never); }}
      />
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
// Zero hardcoded colors — everything from T.*
const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: T.background,
  },

  // Notification bell
  bellBtn: {
    width: 44,
    height: 44,
    borderRadius: T.radiusButton,
    backgroundColor: T.iconBg(T.textMuted),
    alignItems: 'center',
    justifyContent: 'center',
  },
  // FIX (look): the count was 8 pt in a 14 pt circle — unreadable at arm's
  // length. Standard badge size, with a ring in the button's colour so it
  // reads as sitting on top of the bell.
  bellBadge: {
    position: 'absolute',
    top: 2,
    right: 2,
    backgroundColor: T.danger,
    borderRadius: T.radiusPill,
    minWidth: 18,
    height: 18,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
    borderWidth: 2,
    borderColor: T.surface,
  },
  bellBadgeText: {
    color: T.textOnPrimary,
    fontSize: 10,
    fontWeight: '700',
    lineHeight: 12,
    fontVariant: ['tabular-nums'],
  },

  scroll: {
    padding: T.space16,
    paddingBottom: T.space32,
  },

  // Active job card
  activeCard: {
    backgroundColor: T.surface,
    borderRadius: T.radiusCard,
    borderWidth: 1,
    borderColor: T.border,
    padding: T.space16,
    paddingTop: T.space16 + 4,
    marginBottom: T.space16,
    gap: 6,
    overflow: 'hidden',
    ...cardShadow,
  },
  activeTopBar: { position: 'absolute', top: 0, left: 0, right: 0, height: 4, backgroundColor: T.primary },
  activeHead: { flexDirection: 'row', alignItems: 'center', marginBottom: 4 },
  activePill: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: T.successBg, borderRadius: T.radiusPill, paddingLeft: 6, paddingRight: 10, paddingVertical: 3,
  },
  activeDotWrap: { width: 14, height: 14, alignItems: 'center', justifyContent: 'center' },
  activeDotRing: { position: 'absolute', width: 7, height: 7, borderRadius: T.radiusPill, backgroundColor: T.success },
  activeDot: { width: 7, height: 7, borderRadius: T.radiusPill, backgroundColor: T.success },
  activeEyebrow: { fontSize: 10, fontWeight: '700', letterSpacing: 0.8, color: T.success },
  activeName: { fontSize: 16, fontWeight: '700', color: T.textPrimary },
  activeMeta: { fontSize: 14, color: T.textSecondary, flexShrink: 1 },
  activeOpenBtn: {
    marginTop: 10, height: 48, borderRadius: T.radiusButton, backgroundColor: T.primary,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
  },
  activeOpenBtnText: { fontSize: 15, fontWeight: '600', color: T.textOnPrimary },

  // Overdue banner (tappable)
  overdueBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: T.space12,
    backgroundColor: T.dangerBg,
    borderRadius: T.radiusButton,
    borderWidth: 1,
    borderColor: T.tintBorder(T.danger),
    padding: 14,
    marginBottom: T.space16,
  },
  overdueIcon: { width: 32, height: 32, borderRadius: 8, backgroundColor: T.tintBg(T.danger), alignItems: 'center', justifyContent: 'center' },
  overdueText: { color: T.danger, fontSize: 14, fontWeight: '600', flex: 1 },

  // KPI strip
  kpiRow: {
    flexDirection: 'row',
    gap: T.space12,
    marginBottom: T.space24,
  },
  // Tablet: don't stretch to fill the full capped content width — center a
  // row of fixed-width tiles instead (see the FIX comment at the JSX).
  kpiRowTablet: {
    justifyContent: 'center',
  },
  kpiCard: {
    flex: 1,
    backgroundColor: T.surface,
    borderRadius: T.radiusCard,
    borderWidth: 1,
    borderColor: T.border,
    paddingVertical: T.space12,
    paddingHorizontal: T.space8,
    alignItems: 'center',
    gap: 2,
    ...cardShadow,
  },
  kpiCardTablet: {
    flex: 0,
    width: 180,
  },
  kpiValue: {
    // Neutral — not semantic colors (confirmed with user)
    fontSize: 24,
    fontWeight: '700',
    letterSpacing: -0.5,
    color: T.textPrimary,
  },
  kpiLabel: {
    fontSize: 11,
    fontWeight: '500',
    color: T.textSecondary,
    textAlign: 'center',
  },

  // Sections
  section: {
    marginBottom: T.space24,
  },
  sectionRow: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: T.space12 },
  sectionTitle: { fontSize: 16, fontWeight: '600', color: T.textPrimary },
  sectionCount: { fontSize: 12, fontWeight: '600', color: T.textMuted },

  // Job card
  jobCard: {
    backgroundColor: T.surface,
    borderRadius: T.radiusCard,
    borderWidth: 1,
    borderColor: T.border,
    flexDirection: 'row',
    overflow: 'hidden',
    ...cardShadow,
  },
  priorityBar: {
    width: 4,
  },
  jobBody: {
    flex: 1,
  },
  jobTop: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: T.space12,
    padding: T.space16,
    paddingBottom: T.space12,
  },
  statusRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  timeText: { fontSize: 12, color: T.textMuted },
  jobName: { fontSize: 16, fontWeight: '600', color: T.textPrimary },
  addrRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  jobAddress: { fontSize: 13, color: T.textSecondary, flexShrink: 1 },
  chevronTile: {
    width: 40, height: 40, borderRadius: T.radiusButton, backgroundColor: T.surfaceInput,
    alignItems: 'center', justifyContent: 'center',
  },
  jobFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: T.space12,
    paddingHorizontal: T.space16,
    paddingVertical: 10,
    backgroundColor: T.surfaceInput,
  },
  metaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flexShrink: 1,
  },
  metaText: {
    fontSize: 12,
    color: T.textSecondary,
  },
});
