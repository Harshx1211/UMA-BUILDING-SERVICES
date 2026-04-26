// components/ui/SkeletonCard.tsx
import React, { useEffect } from 'react';
import { StyleSheet, View, ViewStyle } from 'react-native';
import Animated, { useSharedValue, useAnimatedStyle, withRepeat, withSequence, withTiming } from 'react-native-reanimated';
import { useColors } from '@/hooks/useColors';
import { cardShadow } from './Card';

interface SkeletonBlockProps {
  width: number | string;
  height: number;
  borderRadius?: number;
  style?: ViewStyle;
}

export function SkeletonBlock({ width, height, borderRadius = 8, style }: SkeletonBlockProps) {
  const C = useColors();
  const opacity = useSharedValue(0.3);

  useEffect(() => {
    opacity.value = withRepeat(
      withSequence(
        withTiming(0.7, { duration: 800 }),
        withTiming(0.3, { duration: 800 })
      ),
      -1,
      false
    );
  }, [opacity]);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
  }));

  return (
    <Animated.View
      style={[
        {
          width: width as any,
          height,
          borderRadius,
          backgroundColor: C.border,
        },
        animatedStyle,
        style,
      ]}
    />
  );
}

// Full job-card-sized skeleton
export function SkeletonCard() {
  const C = useColors();
  return (
    <View style={[styles.card, { backgroundColor: C.surface }, cardShadow]}>
      <View style={[styles.strip, { backgroundColor: C.border }]} />
      <View style={styles.body}>
        <SkeletonBlock width="65%" height={14} borderRadius={6} />
        <SkeletonBlock width="45%" height={11} borderRadius={5} style={{ marginTop: 8 }} />
        <View style={styles.rowGap}>
          <SkeletonBlock width={72} height={22} borderRadius={11} />
          <SkeletonBlock width={52} height={22} borderRadius={11} />
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 16,
    flexDirection: 'row',
    minHeight: 92,
    overflow: 'hidden',
    marginHorizontal: 16,
    marginBottom: 12,
    shadowColor: '#0D1526',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.07,
    shadowRadius: 10,
    elevation: 3,
  },
  strip: {
    width: 4,
  },
  body: {
    flex: 1,
    padding: 16,
    justifyContent: 'center',
    gap: 0,
  },
  rowGap: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 10,
  },
});
