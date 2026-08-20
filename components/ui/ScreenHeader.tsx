// components/ui/ScreenHeader.tsx
// Clean, flat, professional header — matches the home/schedule/profile tab bar style.
// No curves, no decorative circles. Just crisp typography and clean layout.
import React from 'react';
import { StyleSheet, TouchableOpacity, View } from 'react-native';
import { Text } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useColors } from '@/hooks/useColors';

interface Props {
  title: string;
  subtitle?: string;
  rightComponent?: React.ReactNode;
  showBack?: boolean;
  /** @deprecated — kept for API compatibility, no longer renders curves */
  curved?: boolean;
  eyebrow?: string;
}

export function ScreenHeader({
  title,
  subtitle,
  rightComponent,
  showBack = false,
  eyebrow,
}: Props) {
  const C = useColors();
  const insets = useSafeAreaInsets();

  return (
    <View
      style={[
        styles.header,
        {
          backgroundColor: C.surface,
          paddingTop: Math.max(insets.top, 14),
          borderBottomColor: C.border,
        },
      ]}
    >
      <View style={styles.row}>
        {showBack && (
          <TouchableOpacity
            onPress={() =>
              router.canGoBack() ? router.back() : router.replace('/(app)' as never)
            }
            style={[styles.backBtn, { backgroundColor: C.backgroundTertiary }]}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            accessibilityRole="button"
            accessibilityLabel="Go back"
          >
            <MaterialCommunityIcons name="arrow-left" size={20} color={C.text} />
          </TouchableOpacity>
        )}

        <View style={styles.titleBlock}>
          {eyebrow ? (
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
        </View>

        {rightComponent ? (
          <View style={styles.right}>{rightComponent}</View>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    paddingHorizontal: 20,
    paddingBottom: 16,
    borderBottomWidth: 1,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginTop: 8,
  },
  backBtn: {
    width: 44,
    height: 44,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  titleBlock: {
    flex: 1,
    gap: 1,
  },
  eyebrow: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 2,
    textTransform: 'uppercase',
    marginBottom: 2,
  },
  title: {
    fontSize: 22,
    fontWeight: '800',
    letterSpacing: -0.3,
  },
  subtitle: {
    fontSize: 12,
    fontWeight: '400',
    marginTop: 1,
  },
  right: {
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
});
