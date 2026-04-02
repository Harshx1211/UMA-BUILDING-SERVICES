// SectionHeader — section title row with optional count badge and right action
import React from 'react';
import { StyleSheet, TouchableOpacity, View } from 'react-native';
import { Text } from 'react-native-paper';
import Colors from '@/constants/Colors';

interface Props {
  title: string;
  count?: number;
  rightLabel?: string;
  onRightPress?: () => void;
}

export function SectionHeader({ title, count, rightLabel, onRightPress }: Props) {
  return (
    <View style={styles.row}>
      <Text style={styles.title}>{title}</Text>
      {count !== undefined && count !== null && (
        <View style={styles.badge}>
          <Text style={styles.badgeText}>{count}</Text>
        </View>
      )}
      <View style={styles.spacer} />
      {rightLabel && onRightPress && (
        <TouchableOpacity onPress={onRightPress} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <Text style={styles.rightLink}>{rightLabel}</Text>
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
    marginTop: 20,
    marginBottom: 8,
    gap: 8,
  },
  title: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.light.text,
    letterSpacing: -0.2,
  },
  badge: {
    backgroundColor: Colors.light.accent,
    borderRadius: 20,
    paddingHorizontal: 9,
    paddingVertical: 3,
  },
  badgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  spacer: { flex: 1 },
  rightLink: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.light.primary,
  },
});
