// components/ui/Button.tsx
// Professional, premium Button — aligns with SiteTrack visual identity
import React, { useRef } from 'react';
import { Pressable, Text, StyleSheet, Animated, ActivityIndicator, ViewStyle, TextStyle, View } from 'react-native';
import { useColors } from '@/hooks/useColors';
import * as Haptics from 'expo-haptics';

interface Props {
  onPress: () => void;
  title: string;
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger';
  size?: 'large' | 'small';
  isLoading?: boolean;
  /** Alias for isLoading — both are accepted */
  loading?: boolean;
  disabled?: boolean;
  icon?: React.ReactNode;
  style?: ViewStyle;
  textStyle?: TextStyle;
  /** Custom background colour override — takes precedence over variant */
  color?: string;
}

export function Button({
  onPress,
  title,
  variant = 'primary',
  size = 'large',
  isLoading,
  loading,
  disabled,
  icon,
  style,
  textStyle,
  color,
}: Props) {
  const resolvedLoading = isLoading || loading;
  const C = useColors();
  const scaleAnim = useRef(new Animated.Value(1)).current;

  const handlePressIn = () => {
    Animated.spring(scaleAnim, { toValue: 0.965, useNativeDriver: true, friction: 8 }).start();
  };

  const handlePressOut = () => {
    Animated.spring(scaleAnim, { toValue: 1, useNativeDriver: true, friction: 5, tension: 40 }).start();
  };

  const handlePress = () => {
    if (!disabled && !resolvedLoading) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      onPress();
    }
  };

  const height = size === 'large' ? 52 : 44;

  let bgColor = C.accent;
  let textColor = '#FFFFFF';
  let borderWidth = 0;
  let borderColor = 'transparent';
  let fontSize = size === 'large' ? 16 : 14;

  switch (variant) {
    case 'primary':
      bgColor = C.accent;
      textColor = '#FFFFFF';
      break;
    case 'secondary':
      bgColor = C.primary;
      textColor = '#FFFFFF';
      break;
    case 'outline':
      bgColor = 'transparent';
      borderWidth = 1.5;
      borderColor = C.borderStrong;
      textColor = C.text;
      break;
    case 'danger':
      bgColor = C.error;
      textColor = '#FFFFFF';
      break;
    case 'ghost':
      bgColor = 'transparent';
      textColor = C.accent;
      break;
  }

  if (color) bgColor = color;
  const opacity = disabled || resolvedLoading ? 0.55 : 1;

  return (
    <Animated.View style={[{ transform: [{ scale: scaleAnim }], opacity }, style]}>
      <Pressable
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        onPress={handlePress}
        disabled={disabled || resolvedLoading}
        style={[
          styles.button,
          { height, backgroundColor: bgColor, borderWidth, borderColor },
        ]}
      >
        {resolvedLoading ? (
          <ActivityIndicator color={textColor} size="small" style={{ marginRight: 6 }} />
        ) : icon ? (
          <View style={styles.iconWrap}>{icon}</View>
        ) : null}
        <Text style={[styles.text, { color: textColor, fontSize }, textStyle]}>{title}</Text>
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  button: {
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 48,
    paddingHorizontal: 20,
    gap: 8,
  },
  iconWrap: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  text: {
    fontWeight: '700',
    letterSpacing: 0.1,
  },
});
