// components/ui/Card.tsx
import React, { useRef } from 'react';
import { Animated, Pressable, StyleSheet, View, ViewStyle } from 'react-native';
import { useColors } from '@/hooks/useColors';

export const cardShadow = {
  shadowColor: '#0F1E3C', // Using standard shadow color string but opacity via style below, actually using 0.06
  shadowOffset: { width: 0, height: 3 },
  shadowOpacity: 0.06,
  shadowRadius: 10,
  elevation: 3,
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
      borderColor: (C as any).cardBorder || 'rgba(30,50,90,0.06)',
    },
    style,
  ];

  if (onPress) {
    return (
      <Animated.View style={[{ transform: [{ scale: scaleAnim }] }]}>
        <Pressable
          onPress={onPress}
          onPressIn={() =>
            Animated.spring(scaleAnim, { toValue: 0.97, useNativeDriver: true }).start()
          }
          onPressOut={() =>
            Animated.spring(scaleAnim, { toValue: 1, useNativeDriver: true, friction: 4, tension: 40 }).start()
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
