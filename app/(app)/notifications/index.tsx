// Notifications/Alerts screen — navy curved header + styled alert cards
import { ScrollView, StyleSheet, TouchableOpacity, View } from 'react-native';
import { Text } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { ScreenHeader } from '@/components/ui/ScreenHeader';
import { EmptyState } from '@/components/ui/EmptyState';
import Colors from '@/constants/Colors';

type MCIcon = React.ComponentProps<typeof MaterialCommunityIcons>['name'];

type AlertItem = {
  id: string;
  icon: MCIcon;
  iconColor: string;
  title: string;
  body: string;
  time: string;
  unread: boolean;
};

const MOCK_ALERTS: AlertItem[] = [
  {
    id: '1',
    icon: 'sync-circle',
    iconColor: Colors.light.success,
    title: 'Sync Complete',
    body: 'All data synced to cloud successfully. 0 items pending.',
    time: 'Just now',
    unread: false,
  },
  {
    id: '2',
    icon: 'briefcase-clock-outline',
    iconColor: Colors.light.accent,
    title: 'Job scheduled for today',
    body: 'Westfield Sydney CBD — Routine Service at 09:00 AM',
    time: '2h ago',
    unread: true,
  },
  {
    id: '3',
    icon: 'alert-circle-outline',
    iconColor: Colors.light.error,
    title: 'Defect requires attention',
    body: 'Crown Melbourne — Sprinkler head defect status is still Open.',
    time: 'Yesterday',
    unread: true,
  },
];

export default function NotificationsScreen() {
  const unreadCount = MOCK_ALERTS.filter((a) => a.unread).length;

  return (
    <View style={s.screen}>
      {/* ── Navy curved header ──────────────── */}
      <ScreenHeader
        title="Alerts"
        subtitle={unreadCount > 0 ? `${unreadCount} unread notification${unreadCount > 1 ? 's' : ''}` : 'All caught up'}
        showBack={true}
        rightComponent={
          unreadCount > 0 ? (
            <View style={s.unreadBadge}>
              <Text style={s.unreadBadgeText}>{unreadCount}</Text>
            </View>
          ) : undefined
        }
      />

      <ScrollView
        contentContainerStyle={s.list}
        showsVerticalScrollIndicator={false}
      >
        {/* ── Alert cards ─────────────────── */}
        {MOCK_ALERTS.map((item) => (
          <TouchableOpacity
            key={item.id}
            style={[s.card, item.unread && s.cardUnread]}
            activeOpacity={0.75}
          >
            {/* Unread orange dot */}
            {item.unread && <View style={s.unreadDot} />}

            {/* Icon circle */}
            <View style={[s.iconWrap, { backgroundColor: item.iconColor + '20' }]}>
              <MaterialCommunityIcons name={item.icon} size={22} color={item.iconColor} />
            </View>

            {/* Body */}
            <View style={s.cardBody}>
              <View style={s.cardTopRow}>
                <Text style={s.cardTitle} numberOfLines={1}>{item.title}</Text>
                <Text style={s.cardTime}>{item.time}</Text>
              </View>
              <Text style={s.cardBodyText} numberOfLines={2}>{item.body}</Text>
            </View>
          </TouchableOpacity>
        ))}

        {/* ── Phase hint ─────────────────── */}
        <View style={s.hintCard}>
          <EmptyState
            emoji="🔔"
            title="Real-time alerts coming soon"
            subtitle="Push notifications for job changes, sync status, and defects will be available in Phase 6"
          />
        </View>
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: Colors.light.background },

  // Unread badge in header
  unreadBadge: {
    backgroundColor: Colors.light.accent,
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  unreadBadgeText: { color: '#FFFFFF', fontSize: 13, fontWeight: '800' },

  // List
  list: { padding: 16, gap: 10, paddingBottom: 32 },

  // Alert card
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 14,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 3,
    position: 'relative',
  },
  cardUnread: {
    borderLeftWidth: 3,
    borderLeftColor: Colors.light.accent,
  },

  // Unread indicator dot (top-right)
  unreadDot: {
    position: 'absolute',
    top: 12,
    right: 12,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: Colors.light.accent,
  },

  // Icon
  iconWrap: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },

  // Card content
  cardBody:    { flex: 1 },
  cardTopRow:  { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 5, gap: 8 },
  cardTitle:   { fontSize: 14, fontWeight: '700', color: Colors.light.text, flex: 1 },
  cardTime:    { fontSize: 11, color: Colors.light.textSecondary, flexShrink: 0 },
  cardBodyText:{ fontSize: 13, color: Colors.light.textSecondary, lineHeight: 19 },

  // Hint section
  hintCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 3,
    marginTop: 8,
  },
});
