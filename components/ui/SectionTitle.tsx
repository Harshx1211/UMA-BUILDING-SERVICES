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
      {/* Left accent bar — taller and bolder */}
      <View style={[styles.accentBar, { backgroundColor: C.accent }]} />
      <Text style={[styles.title, { color: C.text }]}>{title}</Text>
      {count !== undefined && count !== null && (
        <View style={[styles.badge, { backgroundColor: C.backgroundTertiary }]}>
          <Text style={[styles.badgeText, { color: C.textSecondary }]}>{count}</Text>
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
    marginTop: 28,
    marginBottom: 12,
    gap: 10,
  },
  accentBar: {
    width: 4,
    height: 20,
    borderRadius: 3,
  },
  title: {
    fontSize: 15,
    fontWeight: '700',
    letterSpacing: -0.1,
  },
  badge: {
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 2,
    minWidth: 24,
    alignItems: 'center',
  },
  badgeText: {
    fontSize: 11,
    fontWeight: '700',
  },
  spacer: { flex: 1 },
  rightLink: {
    fontSize: 13,
    fontWeight: '600',
  },
});
