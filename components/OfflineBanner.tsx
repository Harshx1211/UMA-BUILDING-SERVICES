// OfflineBanner — Phase 12: 3-state state machine (offline / syncing / synced)
// Shows pending count when offline, syncing indicator on reconnect, green success auto-dismiss
import { useEffect, useRef, useState } from 'react';
import { Animated, StyleSheet, TouchableOpacity } from 'react-native';
import { Text } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useNetworkStatus } from '@/hooks/useNetworkStatus';
import { getPendingSyncItems } from '@/lib/database';
import { useColors } from '@/hooks/useColors';

const BANNER_HEIGHT = 40;

type BannerState = 'offline' | 'syncing' | 'synced' | 'hidden';

export function OfflineBanner() {
  const C = useColors();
  const { isOnline } = useNetworkStatus();
  const [bannerState, setBannerState] = useState<BannerState>('hidden');
  const [pendingCount, setPendingCount] = useState(0);
  const translateY = useRef(new Animated.Value(-BANNER_HEIGHT)).current;
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
    Animated.timing(translateY, {
      toValue: show ? 0 : -BANNER_HEIGHT,
      duration: 320,
      useNativeDriver: true,
    }).start();
  }, [bannerState, translateY]);

  // ── Config per state ──────────────────────────────────
  const stateConfig = {
    offline: {
      bg:   '#FBBF24',
      icon: 'wifi-off' as const,
      text: pendingCount > 0
        ? `⚠️  Offline — ${pendingCount} change${pendingCount > 1 ? 's' : ''} pending sync`
        : '⚠️  Offline Mode — changes save locally',
      textColor: '#78350F',
    },
    syncing: {
      bg:   C.primary,
      icon: 'sync' as const,
      text: '🔄  Syncing changes with cloud...',
      textColor: '#FFFFFF',
    },
    synced: {
      bg:   C.success,
      icon: 'cloud-check-outline' as const,
      text: '✅  All changes synced successfully',
      textColor: '#FFFFFF',
    },
    hidden: {
      bg:   'transparent',
      icon: 'wifi-off' as const,
      text: '',
      textColor: '#000',
    },
  };

  const cfg = stateConfig[bannerState] ?? stateConfig.hidden;

  return (
    <Animated.View
      style={[
        styles.banner,
        { backgroundColor: cfg.bg, transform: [{ translateY }] },
      ]}
    >
      <MaterialCommunityIcons name={cfg.icon} size={14} color={cfg.textColor} />
      <Text style={[styles.text, { color: cfg.textColor }]} numberOfLines={1}>
        {cfg.text}
      </Text>
      {bannerState === 'synced' && (
        <TouchableOpacity onPress={() => setBannerState('hidden')} hitSlop={10}>
          <MaterialCommunityIcons name="close" size={14} color={cfg.textColor} />
        </TouchableOpacity>
      )}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  banner: {
    height: BANNER_HEIGHT,
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
    position: 'absolute',
    top: 0, left: 0, right: 0,
    zIndex: 999,
    paddingHorizontal: 16,
  },
  text: {
    fontSize: 12,
    fontWeight: '600',
    textAlign: 'center',
    flex: 1,
  },
});
