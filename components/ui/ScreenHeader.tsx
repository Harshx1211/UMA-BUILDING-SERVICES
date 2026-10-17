// components/ui/ScreenHeader.tsx
// Clean, flat, professional header — matches the home/schedule/profile tab bar style.
// No curves, no decorative circles. Just crisp typography and clean layout.
import React from 'react';
import { StyleSheet, TouchableOpacity, View } from 'react-native';
import { Text } from '@/components/ui/AppText';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useColors } from '@/hooks/useColors';
import { SyncStrip } from '@/components/SyncStrip';

interface Props {
  title: string;
  subtitle?: string;
  rightComponent?: React.ReactNode;
  showBack?: boolean;
  /** @deprecated — kept for API compatibility, no longer renders curves */
  curved?: boolean;
  eyebrow?: string;
  /** Small element (e.g. a status pill) on the eyebrow line, so the title
   * below keeps the full width instead of being cut off beside it. */
  eyebrowRight?: React.ReactNode;
  /** Optional extra row under the subtitle — e.g. a sync status readout */
  extra?: React.ReactNode;
  /**
   * Where to land when there's no navigation history to go back to
   * (router.canGoBack() is false — e.g. this screen became the root of its
   * stack for any reason). Defaults to Home, which is correct for most
   * screens. FIX: every screen inside the Jobs tab's own flow (job detail
   * and everything under it) used to fall back to Home unconditionally —
   * for a screen that conceptually lives under Schedule, landing on Home
   * instead reads as "back is broken" even though it's really just a
   * fallback path most users never should have hit in the first place.
   * Pass '/jobs' from job-related screens so the fallback is at least as
   * sensible as the normal case, regardless of why canGoBack() was false.
   */
  fallbackHref?: string;
  /** Hide the offline/uploading strip — for a screen that shows its own
   * upload progress (the report screen), so the same upload isn't counted twice. */
  hideSyncStrip?: boolean;
}

export function ScreenHeader({
  title,
  subtitle,
  rightComponent,
  showBack = false,
  eyebrow,
  eyebrowRight,
  extra,
  fallbackHref = '/(app)',
  hideSyncStrip = false,
}: Props) {
  const C = useColors();
  const insets = useSafeAreaInsets();

  return (
    <View>
    <View
      style={[
        styles.header,
        {
          backgroundColor: C.surface,
          paddingTop: Math.max(insets.top, 10),
          borderBottomColor: C.border,
          shadowColor: C.shadow,
        },
      ]}
    >
      <View style={styles.row}>
        {showBack && (
          <TouchableOpacity
            onPress={() =>
              router.canGoBack() ? router.back() : router.replace(fallbackHref as never)
            }
            style={styles.backBtn}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            accessibilityRole="button"
            accessibilityLabel="Go back"
          >
            <MaterialCommunityIcons name="arrow-left" size={24} color={C.text} />
          </TouchableOpacity>
        )}

        <View style={styles.titleBlock}>
          {eyebrow && eyebrowRight ? (
            <View style={styles.eyebrowRow}>
              <Text style={[styles.eyebrow, { color: C.textTertiary, marginBottom: 0 }]}>{eyebrow}</Text>
              {eyebrowRight}
            </View>
          ) : eyebrow ? (
            <Text style={[styles.eyebrow, { color: C.textTertiary }]}>{eyebrow}</Text>
          ) : null}
          <Text style={[styles.title, { color: C.text }]} numberOfLines={1}>
            {title}
          </Text>
          {subtitle ? (
            <Text style={[styles.subtitle, { color: C.textSecondary }]} numberOfLines={1}>
              {subtitle}
            </Text>
          ) : null}
          {extra ? <View style={styles.extra}>{extra}</View> : null}
        </View>

        {rightComponent ? (
          <View style={styles.right}>{rightComponent}</View>
        ) : null}
      </View>
    </View>
    {/* Offline / uploading status — attached under the header so it never
        covers the title or back button (see SyncStrip). */}
    {hideSyncStrip ? null : <SyncStrip />}
    </View>
  );
}

const styles = StyleSheet.create({
  // Approved redesign (stitch-designs/README.md): white bar, 56 px row, a
  // hairline plus a very soft shadow instead of a heavy border.
  header: {
    paddingHorizontal: 16,
    paddingBottom: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.5,
    shadowRadius: 8,
    elevation: 2,
    zIndex: 1,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    minHeight: 48,
  },
  backBtn: {
    width: 44,
    height: 44,
    marginLeft: -8,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  titleBlock: {
    flex: 1,
    gap: 1,
  },
  eyebrowRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4 },
  eyebrow: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    marginBottom: 2,
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    letterSpacing: -0.2,
  },
  subtitle: {
    fontSize: 12,
    fontWeight: '400',
    marginTop: 1,
  },
  extra: {
    marginTop: 4,
  },
  right: {
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
});
