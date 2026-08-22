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
import { useEffect, useCallback, useRef, useState } from 'react';
import {
  View, ScrollView, TouchableOpacity, StyleSheet, Animated, RefreshControl,
} from 'react-native';
import { Text } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useAuth } from '@/hooks/useAuth';
import { useJobsStore } from '@/store/jobsStore';
import { onSyncComplete, offSyncComplete, runSync } from '@/lib/sync';
import { getUnreadNotificationCount } from '@/lib/database';
import { T } from '@/constants/Colors';
import { Typography } from '@/constants/Typography';
import { JobStatus } from '@/constants/Enums';
import type { Job } from '@/types';
import { ScreenHeader, Badge, EmptyState, SectionHeader, Card, cardShadow, SkeletonBlock } from '@/components/ui';
import { SyncStatusBar } from '@/components/SyncStatusBar';
import { localDateString } from '@/utils/dateHelpers';

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
    Animated.timing(anim, {
      toValue: 1, duration: 300, delay: index * 50, useNativeDriver: true,
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
        onPress={() => router.push(`/(app)/jobs/${job.id}`)}
        activeOpacity={0.82}
      >
        {/* Priority left bar */}
        <View style={[styles.priorityBar, { backgroundColor: PRIORITY_BAR[job.priority] ?? T.border }]} />

        <View style={styles.jobBody}>
          {/* Top row: property name + status badge */}
          <View style={styles.jobTop}>
            <Text style={styles.jobName} numberOfLines={1}>
              {j.property_name ?? 'Unknown Property'}
            </Text>
            <Badge status={job.status} />
          </View>

          {/* Address */}
          {(j.address || j.suburb) ? (
            <Text style={styles.jobAddress} numberOfLines={1}>
              {[j.address, j.suburb].filter(Boolean).join(', ')}
            </Text>
          ) : null}

          <View style={styles.jobMeta}>
            {metaDate ? (
              <View style={styles.metaItem}>
                <MaterialCommunityIcons name="calendar-outline" size={12} color={T.textMuted} />
                <Text style={styles.metaText}>{metaDate}</Text>
              </View>
            ) : null}
            
            {(job.status === JobStatus.InProgress || job.status === JobStatus.Completed) && updDate ? (
              <>
                <MaterialCommunityIcons name="arrow-right" size={11} color={T.textMuted} />
                <View style={styles.metaItem}>
                  <MaterialCommunityIcons 
                    name={job.status === JobStatus.Completed ? "check-circle-outline" : "play-circle-outline"} 
                    size={12} 
                    color={job.status === JobStatus.Completed ? T.success : T.primary} 
                  />
                  <Text style={[styles.metaText, { color: job.status === JobStatus.Completed ? T.success : T.primary, fontWeight: '700' }]}>
                    {job.status === JobStatus.Completed ? 'Done ' : 'Started '}{updDate}
                  </Text>
                </View>
              </>
            ) : job.scheduled_time ? (
              <View style={styles.metaItem}>
                <MaterialCommunityIcons name="clock-outline" size={12} color={T.textMuted} />
                <Text style={styles.metaText}>{job.scheduled_time.substring(0, 5)}</Text>
              </View>
            ) : null}
          </View>
        </View>
      </TouchableOpacity>
    </Animated.View>
  );
}

// ─── Main Screen ──────────────────────────────────────────────────────────────
export default function HomeScreen() {
  const { user }               = useAuth();
  const { jobs, loadJobs, isLoading } = useJobsStore();
  const [refreshing, setRefreshing]   = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const pulseAnim = useRef(new Animated.Value(1)).current;

  // FIX: Use localDateString() instead of toISOString().slice(0,10).
  // toISOString() is UTC — before ~10am AEST the UTC date is already "yesterday".
  // This caused "Today's Jobs" to show 0 jobs all morning in Australian timezones.
  const today      = localDateString();
  const todayJobs  = jobs.filter((j: Job) => j.scheduled_date === today);
  const doneToday  = todayJobs.filter((j: Job) => j.status === JobStatus.Completed).length;
  const inProgress = jobs.find((j: Job) => j.status === JobStatus.InProgress);
  const openCount  = jobs.filter((j: Job) =>
    j.status !== JobStatus.Completed && j.status !== JobStatus.Cancelled
  ).length;

  useEffect(() => {
    if (user) {
      loadJobs(user.id);
      setUnreadCount(getUnreadNotificationCount(user.id));
    }

    const onSync = () => {
      if (user) {
        loadJobs(user.id);
        setUnreadCount(getUnreadNotificationCount(user.id));
      }
    };
    onSyncComplete(onSync);

    // Active job pulse animation — store reference so we can stop it on unmount
    const pulseAnimation = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1.025, duration: 1000, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 1,     duration: 1000, useNativeDriver: true }),
      ])
    );
    pulseAnimation.start();

    return () => {
      offSyncComplete(onSync);
      // FIX: Stop the pulse animation on unmount to prevent the
      // "Can't perform a React state update on an unmounted component" warning.
      pulseAnimation.stop();
    };
  }, [user, loadJobs, pulseAnim]);

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
            onPress={() => router.push('/(app)/notifications')}
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
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={T.primary} />
        }
        contentContainerStyle={styles.scroll}
      >
        {/* ── Active Job Banner ── */}
        {inProgress && (
          <Animated.View style={{ transform: [{ scale: pulseAnim }], marginBottom: T.space16 }}>
            <Card
              variant="default"
              noPadding
              onPress={() => router.push(`/(app)/jobs/${inProgress.id}`)}
            >
              <View style={styles.activeJobInner}>
                {/* Pulsing orange dot */}
                <View style={styles.activeDot} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.activeEyebrow}>Active job</Text>
                  <Text style={styles.activeName} numberOfLines={1}>
                    {(inProgress as JobWithJoins).property_name ?? 'Unknown Property'}
                  </Text>
                </View>
                <View style={styles.activeOpenBtn}>
                  <Text style={styles.activeOpenBtnText}>Open</Text>
                  <MaterialCommunityIcons name="arrow-right" size={14} color={T.primary} />
                </View>
              </View>
            </Card>
          </Animated.View>
        )}

        {/* ── KPI Stat Tiles ── */}
        <View style={styles.kpiRow}>
          {isLoading
            ? (['Today', 'Done today', 'Open jobs'] as const).map((label) => (
                <View key={label} style={styles.kpiCard}>
                  <SkeletonBlock width={32} height={26} borderRadius={6} />
                  <SkeletonBlock width={48} height={10} borderRadius={4} style={{ marginTop: 6 }} />
                </View>
              ))
            : [
                { value: todayJobs.length, label: 'Today'     },
                { value: doneToday,        label: 'Done today' },
                { value: openCount,        label: 'Open jobs'  },
              ].map(({ value, label }) => (
                <View key={label} style={styles.kpiCard}>
                  <Text style={styles.kpiValue}>{value}</Text>
                  <Text style={styles.kpiLabel}>{label}</Text>
                </View>
              ))
          }
        </View>

        {/* ── Today's Jobs ── */}
        <View style={styles.section}>
          <SectionHeader title="Today's jobs" style={styles.sectionHeader} />
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
        {(() => {
          const upcoming = jobs.filter((j: Job) => j.scheduled_date > today).slice(0, 5);
          if (!upcoming.length) return null;
          return (
            <View style={styles.section}>
              <SectionHeader title="Upcoming" style={styles.sectionHeader} />
              {upcoming.map((job: Job, idx: number) => (
                <JobCard key={job.id} job={job} index={idx} />
              ))}
            </View>
          );
        })()}
      </ScrollView>
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
  bellBadge: {
    position: 'absolute',
    top: 4,
    right: 4,
    backgroundColor: T.danger,
    borderRadius: T.radiusPill,
    minWidth: 14,
    height: 14,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 3,
  },
  bellBadgeText: {
    color: T.textOnPrimary,
    fontSize: 8,
    fontWeight: '800',
  },

  scroll: {
    padding: T.space16,
    paddingBottom: T.space32,
  },

  // Active job banner
  activeJobInner: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: T.space16,
    gap: T.space12,
  },
  activeDot: {
    width: 8,
    height: 8,
    borderRadius: T.radiusPill,
    backgroundColor: T.primary,
    shadowColor: T.primary,
    shadowRadius: 6,
    shadowOpacity: 0.7,
    elevation: 3,
  },
  activeEyebrow: {
    ...Typography.eyebrow,
    color: T.primary,
    marginBottom: 2,
  },
  activeName: {
    ...Typography.cardTitle,
    color: T.textPrimary,
  },
  activeOpenBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: T.iconBg(T.primary),
    paddingHorizontal: T.space12,
    paddingVertical: T.space8,
    borderRadius: T.radiusButton,
  },
  activeOpenBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: T.primary,
  },

  // KPI strip
  kpiRow: {
    flexDirection: 'row',
    gap: T.space12,
    marginBottom: T.space24,
  },
  kpiCard: {
    flex: 1,
    backgroundColor: T.surface,
    borderRadius: T.radiusCard,
    borderWidth: 1,
    borderColor: T.border,
    paddingVertical: T.space16,
    paddingHorizontal: T.space16,
    alignItems: 'center',
    ...cardShadow,
  },
  kpiValue: {
    // Neutral — not semantic colors (confirmed with user)
    fontSize: 26,
    fontWeight: '800',
    letterSpacing: -0.5,
    color: T.textPrimary,
  },
  kpiLabel: {
    ...Typography.label,
    color: T.textMuted,
    marginTop: T.space4,
    textAlign: 'center',
  },

  // Sections
  section: {
    marginBottom: T.space24,
  },
  sectionHeader: {
    marginBottom: T.space12,
  },

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
    width: 3,
  },
  jobBody: {
    flex: 1,
    padding: T.space16,
    gap: T.space4,
  },
  jobTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: T.space4,
  },
  jobName: {
    ...Typography.cardTitle,
    color: T.textPrimary,
    flex: 1,
    marginRight: T.space8,
  },
  jobAddress: {
    ...Typography.body,
    color: T.textSecondary,
    fontSize: 13,
  },
  jobMeta: {
    flexDirection: 'row',
    gap: T.space12,
    marginTop: T.space4,
  },
  metaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: T.space4,
  },
  metaText: {
    ...Typography.eyebrow,
    color: T.textMuted,
    textTransform: 'none',
    letterSpacing: 0,
  },
});
