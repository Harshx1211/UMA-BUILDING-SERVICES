import { useEffect, useCallback, useRef, useState } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  Animated, RefreshControl,
} from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '@/hooks/useAuth';
import { useJobsStore } from '@/store/jobsStore';
import { onSyncComplete, offSyncComplete, runSync } from '@/lib/sync';
import { getUnreadNotificationCount } from '@/lib/database';
import { C } from '@/constants/Config';
import { JobStatus } from '@/constants/Enums';
import type { Job } from '@/types';

const PRIORITY_COLOR: Record<string, string> = {
  urgent: C.danger, high: C.warning, normal: C.info, low: C.textMuted,
};
const STATUS_LABEL: Record<string, string> = {
  scheduled: 'Scheduled', in_progress: 'In Progress', completed: 'Done', cancelled: 'Cancelled',
};
const STATUS_BG: Record<string, string> = {
  scheduled: 'rgba(37,99,235,0.15)', in_progress: 'rgba(232,101,10,0.15)',
  completed: 'rgba(22,163,74,0.15)', cancelled: 'rgba(100,116,139,0.1)',
};
const STATUS_TEXT: Record<string, string> = {
  scheduled: C.info, in_progress: C.accent, completed: C.success, cancelled: C.textMuted,
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

export default function HomeScreen() {
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const { jobs, loadJobs } = useJobsStore();
  const [refreshing, setRefreshing] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const pulseAnim = useRef(new Animated.Value(1)).current;

  const today = new Date().toISOString().slice(0, 10);
  const todayJobs  = jobs.filter((j: Job) => j.scheduled_date === today);
  const doneToday  = todayJobs.filter((j: Job) => j.status === JobStatus.Completed).length;
  const inProgress = jobs.find((j: Job) => j.status === JobStatus.InProgress);
  const openCount  = jobs.filter((j: Job) => j.status !== JobStatus.Completed && j.status !== JobStatus.Cancelled).length;

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

    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1.06, duration: 900, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 1, duration: 900, useNativeDriver: true }),
      ])
    ).start();

    return () => offSyncComplete(onSync);
  }, [user]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await runSync();
    setRefreshing(false);
  }, []);

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <View>
          <Text style={styles.greeting}>{greeting()}, {user?.full_name?.split(' ')[0] ?? 'Technician'} 👋</Text>
          <Text style={styles.dateText}>{todayStr()}</Text>
        </View>
        <TouchableOpacity style={styles.bellWrap} onPress={() => router.push('/(app)/notifications')}>
          <Text style={styles.bellIcon}>🔔</Text>
          {unreadCount > 0 && (
            <View style={styles.badge}>
              <Text style={styles.badgeText}>{unreadCount > 9 ? '9+' : unreadCount}</Text>
            </View>
          )}
        </TouchableOpacity>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={C.accent} />}
        contentContainerStyle={styles.scroll}
      >
        {/* Active job pulse card */}
        {inProgress && (
          <Animated.View style={[styles.activeJobCard, { transform: [{ scale: pulseAnim }] }]}>
            <View style={styles.activeJobDot} />
            <View style={{ flex: 1 }}>
              <Text style={styles.activeJobLabel}>ACTIVE JOB</Text>
              <Text style={styles.activeJobName} numberOfLines={1}>
                {(inProgress as Job & { property_name?: string }).property_name ?? 'Unknown Property'}
              </Text>
            </View>
            <TouchableOpacity style={styles.activeJobBtn} onPress={() => router.push(`/(app)/jobs/${inProgress.id}`)}>
              <Text style={styles.activeJobBtnText}>Open →</Text>
            </TouchableOpacity>
          </Animated.View>
        )}

        {/* KPI strip */}
        <View style={styles.kpiRow}>
          <View style={styles.kpiCard}>
            <Text style={styles.kpiVal}>{todayJobs.length}</Text>
            <Text style={styles.kpiLabel}>Today</Text>
          </View>
          <View style={[styles.kpiCard, styles.kpiCardMid]}>
            <Text style={[styles.kpiVal, { color: C.success }]}>{doneToday}</Text>
            <Text style={styles.kpiLabel}>Done</Text>
          </View>
          <View style={styles.kpiCard}>
            <Text style={[styles.kpiVal, { color: C.warning }]}>{openCount}</Text>
            <Text style={styles.kpiLabel}>Open Jobs</Text>
          </View>
        </View>

        {/* Today's jobs */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Today's Jobs</Text>
          {todayJobs.length === 0 ? (
            <View style={styles.emptyState}>
              <Text style={styles.emptyIcon}>🎉</Text>
              <Text style={styles.emptyText}>No jobs scheduled for today</Text>
            </View>
          ) : (
            todayJobs.map((job: Job, idx: number) => <JobCard key={job.id} job={job} index={idx} />)
          )}
        </View>

        {/* Upcoming */}
        {(() => {
          const upcoming = jobs.filter((j: Job) => j.scheduled_date > today).slice(0, 3);
          if (!upcoming.length) return null;
          return (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Upcoming</Text>
              {upcoming.map((job: Job, idx: number) => <JobCard key={job.id} job={job} index={idx} />)}
            </View>
          );
        })()}
      </ScrollView>
    </View>
  );
}

type JobWithJoins = Job & { property_name?: string; address?: string; suburb?: string };

function JobCard({ job, index }: { job: Job; index: number }) {
  const anim = useRef(new Animated.Value(0)).current;
  const j = job as JobWithJoins;

  useEffect(() => {
    Animated.timing(anim, { toValue: 1, duration: 350, delay: index * 60, useNativeDriver: true }).start();
  }, []);

  return (
    <Animated.View style={{
      opacity: anim,
      transform: [{ translateY: anim.interpolate({ inputRange: [0, 1], outputRange: [20, 0] }) }],
    }}>
      <TouchableOpacity
        style={styles.jobCard}
        onPress={() => router.push(`/(app)/jobs/${job.id}`)}
        activeOpacity={0.85}
      >
        <View style={[styles.priorityBar, { backgroundColor: PRIORITY_COLOR[job.priority] }]} />
        <View style={styles.jobCardBody}>
          <View style={styles.jobCardTop}>
            <Text style={styles.jobPropertyName} numberOfLines={1}>{j.property_name ?? 'Unknown Property'}</Text>
            <View style={[styles.statusChip, { backgroundColor: STATUS_BG[job.status] }]}>
              <Text style={[styles.statusText, { color: STATUS_TEXT[job.status] }]}>{STATUS_LABEL[job.status]}</Text>
            </View>
          </View>
          <Text style={styles.jobAddress} numberOfLines={1}>
            {[j.address, j.suburb].filter(Boolean).join(', ')}
          </Text>
          <View style={styles.jobMeta}>
            <Text style={styles.jobMetaText}>📅 {job.scheduled_date}</Text>
            {job.scheduled_time ? <Text style={styles.jobMetaText}>  🕐 {job.scheduled_time}</Text> : null}
          </View>
        </View>
      </TouchableOpacity>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container:       { flex: 1, backgroundColor: C.primary },
  header:          {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 20, paddingVertical: 16, backgroundColor: C.surface,
    borderBottomWidth: 1, borderBottomColor: C.border,
  },
  greeting:        { color: C.textLight, fontSize: 18, fontWeight: '700' },
  dateText:        { color: C.textMuted, fontSize: 12, marginTop: 2 },
  bellWrap:        { padding: 8, position: 'relative' },
  bellIcon:        { fontSize: 22 },
  badge:           {
    position: 'absolute', top: 4, right: 4, backgroundColor: C.danger,
    borderRadius: 8, minWidth: 16, height: 16, alignItems: 'center', justifyContent: 'center',
  },
  badgeText:       { color: '#fff', fontSize: 9, fontWeight: '800' },
  scroll:          { padding: 16, paddingBottom: 32 },
  activeJobCard:   {
    backgroundColor: 'rgba(232,101,10,0.12)', borderRadius: 16, borderWidth: 1,
    borderColor: C.accent, flexDirection: 'row', alignItems: 'center',
    padding: 16, marginBottom: 16,
  },
  activeJobDot:    {
    width: 10, height: 10, borderRadius: 5, backgroundColor: C.accent,
    marginRight: 12, shadowColor: C.accent, shadowRadius: 6, shadowOpacity: 0.8,
  },
  activeJobLabel:  { color: C.accent, fontSize: 10, fontWeight: '700', letterSpacing: 1 },
  activeJobName:   { color: C.textLight, fontSize: 14, fontWeight: '600', marginTop: 2 },
  activeJobBtn:    { backgroundColor: C.accent, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 8 },
  activeJobBtnText:{ color: '#fff', fontWeight: '700', fontSize: 13 },
  kpiRow:          { flexDirection: 'row', gap: 10, marginBottom: 20 },
  kpiCard:         {
    flex: 1, backgroundColor: C.surface, borderRadius: 14, borderWidth: 1,
    borderColor: C.border, paddingVertical: 16, alignItems: 'center',
  },
  kpiCardMid:      { borderColor: C.accent },
  kpiVal:          { color: C.textLight, fontSize: 26, fontWeight: '800' },
  kpiLabel:        { color: C.textMuted, fontSize: 11, marginTop: 2, textAlign: 'center' },
  section:         { marginBottom: 24 },
  sectionTitle:    { color: C.textLight, fontSize: 16, fontWeight: '700', marginBottom: 10 },
  emptyState:      {
    alignItems: 'center', paddingVertical: 32, backgroundColor: C.surface,
    borderRadius: 16, borderWidth: 1, borderColor: C.border,
  },
  emptyIcon:       { fontSize: 32, marginBottom: 8 },
  emptyText:       { color: C.textMuted, fontSize: 14 },
  jobCard:         {
    backgroundColor: C.surface, borderRadius: 16, borderWidth: 1, borderColor: C.border,
    flexDirection: 'row', overflow: 'hidden', marginBottom: 10,
  },
  priorityBar:     { width: 4 },
  jobCardBody:     { flex: 1, padding: 14 },
  jobCardTop:      { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 4 },
  jobPropertyName: { color: C.textLight, fontSize: 15, fontWeight: '700', flex: 1, marginRight: 8 },
  statusChip:      { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 6 },
  statusText:      { fontSize: 10, fontWeight: '800' },
  jobAddress:      { color: C.textBody, fontSize: 13, marginBottom: 10 },
  jobMeta:         { flexDirection: 'row', alignItems: 'center' },
  jobMetaText:     { color: C.textMuted, fontSize: 11, fontWeight: '600' },
});
