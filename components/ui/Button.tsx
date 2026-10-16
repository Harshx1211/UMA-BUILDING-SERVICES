/**
 * Button — three strict variants, consistent dimensions everywhere.
 *
 * Variants:
 *   primary     — filled orange, white text. CTAs only: "Start Job", "Save", "Complete"
 *   secondary   — ghost/outline style (border + transparent bg). Secondary actions.
 *   destructive — red fill. Destructive actions: "Delete", "Remove", "Discard"
 *
 * Height: 48px always (large). Small = 36px for inline/secondary contexts.
 * Radius: T.radiusButton (10px) always.
 *
 * Do NOT pass a custom `color` to make an orange icon or a navy button.
 * If your use case isn't covered by these three variants, question whether
 * you need a button at all — or open a PR to add a justified new variant.
 */
import React, { useRef } from 'react';
import {
  Pressable, StyleSheet, Animated,
  ActivityIndicator, ViewStyle, TextStyle, View,
} from 'react-native';
import { T } from '@/constants/Colors';
import { Text } from '@/components/ui/AppText';
import * as Haptics from 'expo-haptics';
import { MaterialCommunityIcons } from '@expo/vector-icons';

type MCIconName = React.ComponentProps<typeof MaterialCommunityIcons>['name'];

type Variant = 'primary' | 'secondary' | 'destructive';
type Size    = 'large' | 'small';

interface ButtonProps {
  onPress: () => void;
  title: string;
  variant?: Variant;
  size?: Size;
  loading?: boolean;
  isLoading?: boolean;  // alias for loading
  disabled?: boolean;
  icon?: MCIconName | React.ReactNode;
  /** Icon after the label instead of before it (e.g. a forward arrow). */
  iconRight?: boolean;
  style?: ViewStyle;
  textStyle?: TextStyle;
}

const VARIANT_STYLES: Record<Variant, {
  bg: string; textColor: string; borderWidth: number; borderColor: string;
}> = {
  primary: {
    bg: T.primary, textColor: T.textOnPrimary, borderWidth: 0, borderColor: 'transparent',
  },
  secondary: {
    bg: T.surface, textColor: T.textPrimary, borderWidth: 1, borderColor: T.border,
  },
  destructive: {
    bg: T.danger, textColor: T.textOnPrimary, borderWidth: 0, borderColor: 'transparent',
  },
};

export function Button({
  onPress,
  title,
  variant = 'primary',
  size = 'large',
  loading,
  isLoading,
  disabled,
  icon,
  iconRight,
  style,
  textStyle,
}: ButtonProps) {
  const resolvedLoading = loading || isLoading;
  const scaleAnim = useRef(new Animated.Value(1)).current;
  const v = VARIANT_STYLES[variant];

  // Approved redesign: 52 px main buttons (glove-friendly), 40 px small.
  const height   = size === 'large' ? 52 : 40;
  const fontSize = size === 'large' ? 16 : 13;

  const handlePress = () => {
    if (!disabled && !resolvedLoading) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      onPress();
    }
  };

  return (
    <Animated.View
      style={[
        { transform: [{ scale: scaleAnim }], opacity: disabled || resolvedLoading ? 0.45 : 1 },
        style,
      ]}
    >
      <Pressable
        onPressIn={() =>
          Animated.spring(scaleAnim, { toValue: 0.97, useNativeDriver: true, friction: 10 }).start()
        }
        onPressOut={() =>
          Animated.spring(scaleAnim, { toValue: 1, useNativeDriver: true, friction: 5, tension: 40 }).start()
        }
        onPress={handlePress}
        disabled={disabled || resolvedLoading}
        accessibilityRole="button"
        accessibilityLabel={title}
        accessibilityState={{ disabled: !!(disabled || resolvedLoading), busy: !!resolvedLoading }}
        style={[
          styles.btn,
          {
            height,
            backgroundColor: v.bg,
            borderWidth: v.borderWidth,
            borderColor: v.borderColor,
          },
        ]}
      >
        {resolvedLoading ? (
          <ActivityIndicator color={v.textColor} size="small" />
        ) : icon && !iconRight ? (
          <View style={styles.iconWrap}>
            {typeof icon === 'string' ? (
              <MaterialCommunityIcons name={icon as MCIconName} size={fontSize + 4} color={v.textColor} />
            ) : (
              icon
            )}
          </View>
        ) : null}
        <Text style={[styles.label, { fontSize, color: v.textColor }, textStyle]}>
          {title}
        </Text>
        {!resolvedLoading && icon && iconRight ? (
          <View style={styles.iconWrap}>
            {typeof icon === 'string' ? (
              <MaterialCommunityIcons name={icon as MCIconName} size={fontSize + 2} color={v.textColor} />
            ) : (
              icon
            )}
          </View>
        ) : null}
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  btn: {
    borderRadius: T.radiusButton,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: T.space24,
    gap: T.space8,
  },
  iconWrap: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: {
    fontWeight: '700',
    letterSpacing: 0.1,
  },
});
