// app/(app)/notifications/index.tsx
import React, { useEffect, useCallback } from 'react';
import {
  FlatList, StyleSheet, TouchableOpacity, View,
} from 'react-native';
import { Text, ActivityIndicator } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { router } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { useColors } from '@/hooks/useColors';
import { Card } from '@/components/ui/Card';
import { ScreenHeader, EmptyState } from '@/components/ui';
import {
  useNotificationsStore, type AppNotification, type NotificationType,
} from '@/store/notificationsStore';

type MCIcon = React.ComponentProps<typeof MaterialCommunityIcons>['name'];

function timeAgo(iso: string): string {
  try {
    const diff = Date.now() - new Date(iso).getTime();
    const mins  = Math.floor(diff / 60000);
    const hours = Math.floor(mins / 60);
    const days  = Math.floor(hours / 24);
    if (days  > 0) return `${days}d ago`;
    if (hours > 0) return `${hours}h ago`;
    if (mins  > 0) return `${mins}m ago`;
    return 'Just now';
  } catch { return ''; }
}

// ── Individual notification card ─────────────────────────
function NotifCard({ item }: { item: AppNotification }) {
  const C = useColors();
  const { markAsRead } = useNotificationsStore();
  
  const TYPE_CONFIG: Record<NotificationType, { icon: MCIcon; color: string }> = {
    new_job:       { icon: 'briefcase-outline',       color: C.info },
    urgent_job:    { icon: 'flash',                    color: C.error },
    sync_complete: { icon: 'cloud-check-outline',      color: C.success },
    defect_flagged:{ icon: 'alert-circle-outline',     color: C.accent },
    general:       { icon: 'information-outline',      color: C.textSecondary },
  };

  const cfg = TYPE_CONFIG[item.type] ?? TYPE_CONFIG.general;

  const handlePress = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (!item.is_read) markAsRead(item.id);
    if (item.job_id) {
      router.push(`/jobs/${item.job_id}` as never);
    }
  };

  return (
    <Card
      noPadding
      color={!item.is_read ? C.warningLight : C.surface}
      style={!item.is_read ? { borderLeftWidth: 3, borderLeftColor: C.accent } : undefined}
    >
      <TouchableOpacity
        style={{ padding: 16, flexDirection: 'row', alignItems: 'flex-start', gap: 12, position: 'relative' }}
        onPress={handlePress}
        activeOpacity={0.75}
      >
      {/* Left icon circle */}
      <View style={[s.iconWrap, { backgroundColor: cfg.color + '22' }]}>
        <MaterialCommunityIcons name={cfg.icon} size={22} color={cfg.color} />
      </View>

      {/* Body */}
      <View style={s.cardBody}>
        <View style={s.cardTopRow}>
          <Text
            style={[s.cardTitle, { color: C.text }, item.is_read && { fontWeight: '500', color: C.textSecondary }]}
            numberOfLines={1}
          >
            {item.title}
          </Text>
          <Text style={[s.cardTime, { color: C.textTertiary }]}>{timeAgo(item.created_at)}</Text>
        </View>
        <Text style={[s.cardMsg, { color: C.textSecondary }]} numberOfLines={2}>{item.message}</Text>
      </View>

      {/* Unread dot */}
      {!item.is_read && <View style={[s.unreadDot, { backgroundColor: C.accent }]} />}
      </TouchableOpacity>
    </Card>
  );
}

// ── Main Screen ───────────────────────────────────────────
export default function NotificationsScreen() {
  const C = useColors();
  const {
    notifications, unreadCount, isLoading,
    loadNotifications, markAllAsRead, clearAll,
  } = useNotificationsStore();



  useEffect(() => {
    loadNotifications();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleMarkAll = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    markAllAsRead();
  }, [markAllAsRead]);

  return (
    <View style={[s.screen, { backgroundColor: C.background }]}>
      {/* ── Navy curved header ──────────────── */}
      <ScreenHeader 
        curved={true} 
        title="Notifications" 
        showBack={true} 
        subtitle={unreadCount > 0 ? `${unreadCount} unread` : undefined}
        rightComponent={
          unreadCount > 0 ? (
            <TouchableOpacity onPress={handleMarkAll} style={s.markAllBtn}>
              <Text style={[s.markAllText, { color: C.accent }]}>Mark all read</Text>
            </TouchableOpacity>
          ) : undefined
        }
      />

      {/* ── Content ─────────────────────────── */}
      {isLoading ? (
        <View style={s.centered}>
          <ActivityIndicator color={C.accent} size="large" />
        </View>
      ) : (
        <FlatList
          data={notifications}
          keyExtractor={(item) => item.id}
          contentContainerStyle={[
            s.list,
            notifications.length === 0 && s.listEmpty,
          ]}
          showsVerticalScrollIndicator={false}
          renderItem={({ item }) => <NotifCard item={item} />}
          ListEmptyComponent={
            <EmptyState 
              emoji="🔔" 
              title="No notifications yet" 
              subtitle="You're all caught up! New job assignments and system alerts will appear here." 
            />
          }
          ListFooterComponent={
            notifications.length > 0 ? (
              <TouchableOpacity style={s.clearBtn} onPress={clearAll}>
                <MaterialCommunityIcons name="delete-sweep-outline" size={16} color={C.textSecondary} />
                <Text style={[s.clearBtnText, { color: C.textSecondary }]}>Clear all notifications</Text>
              </TouchableOpacity>
            ) : null
          }
        />
      )}
    </View>
  );
}

const s = StyleSheet.create({
  screen: { flex: 1 },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  backBtn:    { minHeight: 48, justifyContent: 'center' },
  headerTitle:{ fontSize: 20, fontWeight: '700', color: '#FFFFFF' },
  headerSub:  { fontSize: 12, color: 'rgba(255,255,255,0.65)', marginTop: 2 },
  markAllBtn: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 10, backgroundColor: 'rgba(255,255,255,0.15)' },
  markAllText:{ fontSize: 12, fontWeight: '700' },

  list:      { padding: 16, gap: 12, paddingBottom: 32 },
  listEmpty: { flex: 1, justifyContent: 'center' },

  card: {
    borderRadius: 16,
    padding: 16,
    flexDirection: 'row', alignItems: 'flex-start', gap: 12,
    position: 'relative',
  },
  iconWrap: {
    width: 44, height: 44, borderRadius: 12,
    alignItems: 'center', justifyContent: 'center', flexShrink: 0,
  },
  cardBody:    { flex: 1 },
  cardTopRow:  { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4, gap: 8 },
  cardTitle:   { fontSize: 14, fontWeight: '700', flex: 1 },
  cardTime:    { fontSize: 11, flexShrink: 0 },
  cardMsg:     { fontSize: 13, lineHeight: 19 },

  unreadDot: {
    position: 'absolute', top: 12, right: 12,
    width: 8, height: 8, borderRadius: 4,
  },

  emptyWrap:  { alignItems: 'center', paddingHorizontal: 32, paddingVertical: 48, gap: 12 },
  emptyTitle: { fontSize: 18, fontWeight: '700' },
  emptySub:   { fontSize: 14, textAlign: 'center', lineHeight: 22 },

  clearBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    marginTop: 20, paddingVertical: 12,
  },
  clearBtnText: { fontSize: 13, fontWeight: '500' },
});
