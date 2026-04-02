// SkeletonCard — animated grey placeholder for loading states
import React, { useEffect } from 'react';
import { Animated, StyleSheet, View, ViewStyle } from 'react-native';

interface SkeletonBlockProps {
  width: number | string;
  height: number;
  borderRadius?: number;
  style?: ViewStyle;
}

export function SkeletonBlock({ width, height, borderRadius = 8, style }: SkeletonBlockProps) {
  const opacity = React.useRef(new Animated.Value(0.3)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, { toValue: 0.7, duration: 700, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 0.3, duration: 700, useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [opacity]);

  return (
    <Animated.View
      style={[
        {
          width: width as number,
          height,
          borderRadius,
          backgroundColor: '#D1D9E4',
          opacity,
        },
        style,
      ]}
    />
  );
}

// Full job-card-sized skeleton
export function SkeletonCard() {
  return (
    <View style={styles.card}>
      <View style={styles.strip} />
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
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    flexDirection: 'row',
    minHeight: 88,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 3,
    marginHorizontal: 16,
    marginBottom: 10,
  },
  strip: {
    width: 4,
    backgroundColor: '#E2E8F0',
    borderRadius: 4,
  },
  body: {
    flex: 1,
    padding: 14,
    justifyContent: 'center',
    gap: 0,
  },
  rowGap: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 10,
  },
});
