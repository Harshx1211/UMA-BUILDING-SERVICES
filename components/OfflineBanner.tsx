// OfflineBanner — 3-state state machine (offline / syncing / synced)
// Shows pending count when offline, syncing indicator on reconnect, green success auto-dismiss
import { useEffect, useRef, useState } from 'react';
import { Animated, StyleSheet, TouchableOpacity } from 'react-native';
import { Text } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNetworkStatus } from '@/hooks/useNetworkStatus';
import { getPendingSyncItems } from '@/lib/database';
import { useColors } from '@/hooks/useColors';

const HIDDEN_OFFSET = -80;

type BannerState = 'offline' | 'syncing' | 'synced' | 'hidden';

export function OfflineBanner() {
  const C = useColors();
  const insets = useSafeAreaInsets();
  const { isOnline } = useNetworkStatus();
  const [bannerState, setBannerState] = useState<BannerState>('hidden');
  const [pendingCount, setPendingCount] = useState(0);
  const translateY = useRef(new Animated.Value(HIDDEN_OFFSET)).current;
  const prevOnlineRef = useRef<boolean | null>(null);
  const hideTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── Poll pending count when offline ──────────────────
  useEffect(() => {
    if (!isOnline) {
      const update = () => {
        try { setPendingCount(getPendingSyncItems().length); } catch { /* ignore */ }
      };
      update();
      const interval = setInterval(update, 5000);
      return () => clearInterval(interval);
    }
    return undefined;
  }, [isOnline]);

  // ── State machine ─────────────────────────────────────
  useEffect(() => {
    const wasOnline = prevOnlineRef.current;

    if (!isOnline) {
      // Going offline
      if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
      setBannerState('offline');
    } else if (wasOnline === false) {
      // Reconnected — show "Syncing..." briefly
      if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
      setBannerState('syncing');
      // After 2.5s move to "Synced" state
      hideTimerRef.current = setTimeout(() => {
        setBannerState('synced');
        // Auto-dismiss synced banner after 3s
        hideTimerRef.current = setTimeout(() => {
          setBannerState('hidden');
        }, 3000);
      }, 2500);
    } else if (wasOnline === null) {
      // First mount — online from start
      setBannerState('hidden');
    }

    prevOnlineRef.current = isOnline;
  }, [isOnline]);

  // ── Animate up/down ────────────────────────────────
  useEffect(() => {
    const show = bannerState !== 'hidden';
    Animated.spring(translateY, {
      toValue: show ? 0 : HIDDEN_OFFSET,
      useNativeDriver: true,
      speed: 16,
      bounciness: 6,
    }).start();
  }, [bannerState, translateY]);

  // ── Config per state — soft tinted pill, not a solid saturated stripe,
  // to match the rest of the app's card/badge language ──────────────────
  const stateConfig = {
    offline: {
      bg:     C.warningLight,
      border: C.warning,
      icon:   'wifi-off' as const,
      text: pendingCount > 0
        ? `Offline — ${pendingCount} change${pendingCount > 1 ? 's' : ''} pending sync`
        : 'Offline — changes save locally',
      fg: C.warningDark,
    },
    syncing: {
      bg:     C.primary + '15',
      border: C.primary,
      icon:   'cloud-sync-outline' as const,
      text: 'Syncing with cloud…',
      fg: C.primary,
    },
    synced: {
      bg:     C.successLight,
      border: C.success,
      icon:   'cloud-check-outline' as const,
      text: 'All changes synced',
      fg: C.successDark,
    },
    hidden: {
      bg: 'transparent', border: 'transparent', icon: 'wifi-off' as const, text: '', fg: C.textTertiary,
    },
  };

  const cfg = stateConfig[bannerState] ?? stateConfig.hidden;

  return (
    <Animated.View
      pointerEvents={bannerState === 'hidden' ? 'none' : 'box-none'}
      style={[
        styles.wrap,
        { top: insets.top + 8, transform: [{ translateY }] },
      ]}
    >
      <TouchableOpacity
        activeOpacity={bannerState === 'synced' ? 0.7 : 1}
        onPress={() => { if (bannerState === 'synced') setBannerState('hidden'); }}
        style={[styles.pill, { backgroundColor: cfg.bg, borderColor: cfg.border }]}
      >
        <MaterialCommunityIcons name={cfg.icon} size={15} color={cfg.fg} />
        <Text style={[styles.text, { color: cfg.fg }]} numberOfLines={1}>
          {cfg.text}
        </Text>
        {bannerState === 'synced' && (
          <MaterialCommunityIcons name="close" size={14} color={cfg.fg} style={{ opacity: 0.7 }} />
        )}
      </TouchableOpacity>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: 'absolute',
    left: 16, right: 16,
    alignItems: 'center',
    zIndex: 999,
  },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 9,
    maxWidth: '100%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 6,
    elevation: 3,
  },
  text: {
    fontSize: 12,
    fontWeight: '700',
    flexShrink: 1,
  },
});
