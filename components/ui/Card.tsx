/**
 * Card — the single container used for every info block in SiteTrack.
 *
 * Variants:
 *   default  — standard surface card (nav, job details, stat tiles)
 *   warning  — amber-tinted for pending / attention states
 *   danger   — red-tinted for hazards, failed inspections, destructive banners
 *   info     — blue-tinted for access notes, navigation hints
 *   success  — green-tinted for completed / passed states
 *
 * Do NOT hand-style background/border on any container.
 * Pick the right variant and let this component handle it.
 */
import React, { useRef } from 'react';
import { Animated, Pressable, StyleSheet, View, ViewStyle } from 'react-native';
import { T } from '@/constants/Colors';

// ─── Shadow token (exported so screens can spread it on non-Card views if needed) ──
// We use a very subtle shadow and 0 elevation to prevent Android's Material Design
// from automatically adding a white "elevation overlay" tint to our dark cards.
export const cardShadow = {
  shadowColor: T.black,
  shadowOffset: { width: 0, height: 2 },
  shadowOpacity: 0.1,
  shadowRadius: 8,
  elevation: 0,
} as const;

type Variant = 'default' | 'warning' | 'danger' | 'info' | 'success';

interface CardProps {
  children: React.ReactNode;
  variant?: Variant;
  style?: ViewStyle | ViewStyle[];
  /** Override default 16px internal padding */
  padding?: number;
  noPadding?: boolean;
  /** If provided, renders as a pressable with spring scale feedback */
  onPress?: () => void;
}

const VARIANT_STYLES: Record<Variant, { bg: string; border: string }> = {
  default: { bg: T.surface,    border: T.border              },
  warning: { bg: T.warningBg,  border: T.warning + '60'      },
  danger:  { bg: T.dangerBg,   border: T.danger  + '60'      },
  info:    { bg: T.infoBg,     border: T.info    + '60'      },
  success: { bg: T.successBg,  border: T.success + '60'      },
};

export function Card({
  children,
  variant = 'default',
  style,
  padding = T.space16,
  noPadding,
  onPress,
}: CardProps) {
  const scaleAnim = useRef(new Animated.Value(1)).current;
  const { bg, border } = VARIANT_STYLES[variant];

  const containerStyle = [
    styles.card,
    {
      padding: noPadding ? 0 : padding,
      backgroundColor: bg,
      borderColor: border,
    },
    style,
  ];

  const flatStyle = StyleSheet.flatten(style) || {};
  const wrapperStyle = flatStyle.flex !== undefined ? { flex: flatStyle.flex } : undefined;

  if (onPress) {
    return (
      <Animated.View style={[wrapperStyle, { transform: [{ scale: scaleAnim }] }]}>
        <Pressable
          onPress={onPress}
          onPressIn={() =>
            Animated.spring(scaleAnim, { toValue: 0.975, useNativeDriver: true, friction: 10 }).start()
          }
          onPressOut={() =>
            Animated.spring(scaleAnim, { toValue: 1, useNativeDriver: true, friction: 5, tension: 40 }).start()
          }
          accessibilityRole="button"
          style={containerStyle}
        >
          {children}
        </Pressable>
      </Animated.View>
    );
  }

  return <View style={containerStyle}>{children}</View>;
}

const styles = StyleSheet.create({
  card: {
    borderRadius: T.radiusCard,
    borderWidth: 1,
    ...cardShadow,
  },
});
