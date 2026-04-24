// components/ui/SectionTitle.tsx
import React from 'react';
import { StyleSheet, TouchableOpacity, View } from 'react-native';
import { Text } from 'react-native-paper';
import { useColors } from '@/hooks/useColors';

export interface SectionTitleProps {
  title: string;
  count?: number;
  rightLabel?: string;
  onRightPress?: () => void;
}

export function SectionTitle({ title, count, rightLabel, onRightPress }: SectionTitleProps) {
  const C = useColors();
  return (
    <View style={styles.row}>
      {/* Left accent bar */}
      <View style={[styles.accentBar, { backgroundColor: C.accent }]} />
      <Text style={[styles.title, { color: C.text }]}>{title}</Text>
      {count !== undefined && count !== null && (
        <View style={[styles.badge, { backgroundColor: C.primary + '18' }]}>
          <Text style={[styles.badgeText, { color: C.primary }]}>{count}</Text>
        </View>
      )}
      <View style={styles.spacer} />
      {rightLabel && (
        <TouchableOpacity onPress={onRightPress} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <Text style={[styles.rightLink, { color: C.accent }]}>{rightLabel}</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 16,
    marginTop: 24,
    marginBottom: 10,
    gap: 8,
  },
  accentBar: {
    width: 3,
    height: 16,
    borderRadius: 2,
  },
  title: {
    fontSize: 13,
    fontWeight: '800',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  badge: {
    borderRadius: 10,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  badgeText: {
    fontSize: 11,
    fontWeight: '700',
  },
  spacer: { flex: 1 },
  rightLink: {
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 0.1,
  },
});
