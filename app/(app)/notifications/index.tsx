// app/(app)/notifications/index.tsx
import React, { useEffect, useCallback } from 'react';
import {
  Alert, FlatList, StyleSheet, TouchableOpacity, View,
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
      style={[
        { backgroundColor: !item.is_read ? C.warningLight : C.surface },
        !item.is_read ? { borderLeftWidth: 3, borderLeftColor: C.accent } : {}
      ]}
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
    notifications, unreadCount, totalCount, isLoading,
    loadNotifications, markAllAsRead, clearAll,
  } = useNotificationsStore();
  const isCapped = totalCount > notifications.length;



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
                    Alert.alert(
                      'Clear all notifications?',
                      'This will permanently remove all notifications. This action cannot be undone.',
                      [
                        { text: 'Cancel', style: 'cancel' },
                        { text: 'Clear All', style: 'destructive', onPress: clearAll },
                      ]
                    )
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
  markAllBtn: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 10 },
  markAllText:{ fontSize: 12, fontWeight: '700' },

  list:      { padding: 16, gap: 12, paddingBottom: 32 },
  listEmpty: { flex: 1, justifyContent: 'center' },

  unreadDot: {
    position: 'absolute', top: 12, right: 12,
    width: 8, height: 8, borderRadius: 4,
  },

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
