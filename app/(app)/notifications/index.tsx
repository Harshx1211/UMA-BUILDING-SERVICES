// app/(app)/notifications/index.tsx
import React, { useEffect, useCallback } from 'react';
import {
  FlatList, StyleSheet, TouchableOpacity, View, RefreshControl,
} from 'react-native';
import { ActivityIndicator } from 'react-native-paper';
import { Text } from '@/components/ui/AppText';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { openJob } from '@/utils/navigation';
import * as Haptics from 'expo-haptics';
import { useColors } from '@/hooks/useColors';
import { useResponsive } from '@/hooks/useResponsive';
import { Card } from '@/components/ui/Card';
import { ScreenHeader, EmptyState, showConfirm, Button } from '@/components/ui';
import {
  useNotificationsStore, type AppNotification, type NotificationType,
} from '@/store/notificationsStore';
import { onSyncComplete, offSyncComplete } from '@/lib/sync';

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
    critical_defect: { icon: 'alert-decagram-outline', color: C.error },
    job_completed:   { icon: 'check-decagram-outline', color: C.success },
    quote_submitted: { icon: 'file-send-outline',      color: C.info },
    overdue_service: { icon: 'calendar-alert',         color: C.error },
  };

  const cfg = TYPE_CONFIG[item.type] ?? TYPE_CONFIG.general;

  const handlePress = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (!item.is_read) markAsRead(item.id);
    if (item.job_id) {
      openJob(item.job_id);
    }
  };

  return (
    <Card
      noPadding
      // Approved Batch B: unread = white card with an orange dot; read = quieter grey card.
      style={!item.is_read ? undefined : { backgroundColor: C.backgroundSecondary, borderColor: 'transparent', shadowOpacity: 0, elevation: 0 }}
    >
      <TouchableOpacity
        style={{ padding: 16, paddingRight: 28, flexDirection: 'row', alignItems: 'flex-start', gap: 12, position: 'relative' }}
        onPress={handlePress}
        activeOpacity={0.75}
      >
      {/* Left icon circle */}
      <View style={[s.iconWrap, { backgroundColor: cfg.color + '1A' }]}>
        <MaterialCommunityIcons name={cfg.icon} size={20} color={cfg.color} />
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
  const { contentMaxWidth } = useResponsive();
  const {
    notifications, unreadCount, totalCount, isLoading, error,
    loadNotifications, markAllAsRead, clearAll,
  } = useNotificationsStore();
  const isCapped = totalCount > notifications.length;



  useEffect(() => {
    loadNotifications();
    // FIX: this only ever loaded once, on mount — a new notification
    // arriving (or another device marking one read) while this screen was
    // already open never showed up until you left and came back. Now
    // reloads on the same signal the "my data" live channel and the
    // 10-minute fallback sync both fire (see subscribeToMyDataLive).
    onSyncComplete(loadNotifications);
    return () => offSyncComplete(loadNotifications);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleMarkAll = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    markAllAsRead();
  }, [markAllAsRead]);

  return (
    <View style={[s.screen, { backgroundColor: C.background }]}>
      {/* ── Header ──────────────── */}
      <ScreenHeader 
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
      ) : error ? (
        // FIX: the store already catches and stores load/mark/clear errors —
        // nothing here ever read it, so a genuine failure rendered
        // identically to "you have no notifications" with no retry.
        <View style={[s.centered, { padding: 32, gap: 12 }]}>
          <MaterialCommunityIcons name="cloud-alert-outline" size={40} color={C.error} />
          <Text style={{ color: C.error, textAlign: 'center', fontSize: 14, lineHeight: 21 }}>{error}</Text>
          <Button title="Retry" onPress={loadNotifications} />
        </View>
      ) : (
        <FlatList
          data={notifications}
          keyExtractor={(item) => item.id}
          contentContainerStyle={[
            s.list,
            notifications.length === 0 && s.listEmpty,
            { maxWidth: contentMaxWidth, width: '100%', alignSelf: 'center' },
          ]}
          showsVerticalScrollIndicator={false}
          // FIX: this list had no pull-to-refresh — the only way to force a
          // refresh was leaving and returning to the screen.
          refreshControl={<RefreshControl refreshing={isLoading} onRefresh={loadNotifications} tintColor={C.accent} colors={[C.accent]} />}
          renderItem={({ item }) => <NotifCard item={item} />}
          ListEmptyComponent={
            <EmptyState 
              icon="bell-outline" 
              title="No notifications yet" 
              subtitle="You're all caught up! New job assignments and system alerts will appear here." 
            />
          }
          ListFooterComponent={
            notifications.length > 0 ? (
              <View style={{ paddingBottom: 8 }}>
                {isCapped && (
                  <View style={[s.cappedBanner, { backgroundColor: C.warningLight }]}>
                    <MaterialCommunityIcons name="information-outline" size={14} color={C.warningDark} />
                    <Text style={[s.cappedText, { color: C.warningDark }]}>
                      Showing the {notifications.length} most recent notifications ({totalCount} total). Clear old ones to see more.
                    </Text>
                  </View>
                )}
                <TouchableOpacity
                  style={s.clearBtn}
                  onPress={() =>
                    showConfirm({
                      title: 'Clear all notifications?',
                      message: 'This will permanently remove all notifications. This action cannot be undone.',
                      icon: 'delete-sweep-outline',
                      buttons: [
                        { text: 'Cancel', style: 'cancel' },
                        { text: 'Clear all', style: 'destructive', onPress: clearAll },
                      ],
                    })
                  }
                >
                  <MaterialCommunityIcons name="delete-sweep-outline" size={16} color={C.textTertiary} />
                  <Text style={[s.clearBtnText, { color: C.textTertiary }]}>Clear all notifications</Text>
                </TouchableOpacity>
              </View>
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
  // FIX: paddingVertical 6 made this ~28pt tall, under the ~44pt touch-
  // target guideline for a frequently-tapped control.
  markAllBtn: { paddingHorizontal: 10, paddingVertical: 12, borderRadius: 10 },
  markAllText:{ fontSize: 13, fontWeight: '600' },

  list:      { padding: 16, gap: 10, paddingBottom: 32 },
  listEmpty: { flex: 1, justifyContent: 'center' },

  unreadDot: {
    position: 'absolute', top: 18, right: 14,
    width: 10, height: 10, borderRadius: 5,
  },

  iconWrap: {
    width: 40, height: 40, borderRadius: 20,
    alignItems: 'center', justifyContent: 'center',
  },
  cardBody:   { flex: 1, gap: 2 },
  cardTopRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  cardTitle:  { fontSize: 16, fontWeight: '600', flexShrink: 1 },
  cardTime:   { fontSize: 12, flexShrink: 0 },
  cardMsg:    { fontSize: 14, lineHeight: 20, marginTop: 2 },

  clearBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    marginTop: 8, paddingVertical: 12,
  },
  clearBtnText: { fontSize: 13, fontWeight: '500' },

  cappedBanner: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 8,
    paddingHorizontal: 14, paddingVertical: 10,
    borderRadius: 10, marginHorizontal: 0, marginBottom: 8,
  },
  cappedText: { fontSize: 12, flex: 1, lineHeight: 17 },
});
