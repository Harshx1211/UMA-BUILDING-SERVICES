// components/ui/Card.tsx
// Professional card — real depth, clean borders, spring press feedback
import React, { useRef } from 'react';
import { Animated, Pressable, StyleSheet, View, ViewStyle } from 'react-native';
import { useColors } from '@/hooks/useColors';

export const cardShadow = {
  shadowColor: '#0D1526',
  shadowOffset: { width: 0, height: 2 },
  shadowOpacity: 0.08,
  shadowRadius: 12,
  elevation: 4,
};

interface Props {
  children: React.ReactNode;
  style?: ViewStyle | ViewStyle[];
  padding?: number;
  noPadding?: boolean;
  color?: string;
  /** If provided, the card becomes pressable with a scale animation */
  onPress?: () => void;
}

export function Card({ children, style, padding = 16, noPadding, color, onPress }: Props) {
  const C = useColors();
  const scaleAnim = useRef(new Animated.Value(1)).current;

  const containerStyle = [
    styles.card,
    {
      padding: noPadding ? 0 : padding,
      backgroundColor: color || C.surface,
      borderColor: (C as any).cardBorder || 'rgba(27,45,79,0.09)',
    },
    style,
  ];

  if (onPress) {
    return (
      <Animated.View style={[{ transform: [{ scale: scaleAnim }] }]}>
        <Pressable
          onPress={onPress}
          onPressIn={() =>
            Animated.spring(scaleAnim, { toValue: 0.975, useNativeDriver: true, friction: 10 }).start()
          }
          onPressOut={() =>
            Animated.spring(scaleAnim, { toValue: 1, useNativeDriver: true, friction: 5, tension: 40 }).start()
          }
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
    borderRadius: 16,
    borderWidth: 1,
    ...cardShadow,
  },
});
