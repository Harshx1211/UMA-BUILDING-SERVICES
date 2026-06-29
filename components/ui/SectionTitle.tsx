// components/ui/SectionTitle.tsx
import React from 'react';
import { StyleSheet, TouchableOpacity, View } from 'react-native';
import { Text } from 'react-native-paper';
import { useColors } from '@/hooks/useColors';

interface Props {
  title: string;
  count?: number;
  rightLabel?: string;
  onRightPress?: () => void;
}

export function SectionTitle({ title, count, rightLabel, onRightPress }: Props) {
  const C = useColors();
  return (
    <View style={styles.wrap}>
      {/* Left orange accent bar */}
      <View style={[styles.bar, { backgroundColor: C.accent }]} />
      <Text style={[styles.title, { color: C.text }]}>{title}</Text>
      {count !== undefined && count > 0 ? (
        <View style={[styles.countBadge, { backgroundColor: C.accent + '18' }]}>
          <Text style={[styles.countText, { color: C.accentDark }]}>{count}</Text>
        </View>
      ) : null}
      <View style={{ flex: 1 }} />
      {rightLabel && onRightPress ? (
        <TouchableOpacity onPress={onRightPress} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <Text style={[styles.rightLabel, { color: C.accent }]}>{rightLabel}</Text>
        </TouchableOpacity>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 22,
    paddingBottom: 10,
    gap: 8,
  },
  bar: {
    width: 3,
    height: 16,
    borderRadius: 2,
  },
  title: {
    fontSize: 13,
    fontWeight: '800',
    letterSpacing: 0.1,
  },
  countBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 20,
  },
  countText: {
    fontSize: 11,
    fontWeight: '800',
  },
  rightLabel: {
    fontSize: 13,
    fontWeight: '600',
  },
});
