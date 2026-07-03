/**
 * SectionHeader — eyebrow-style label used above every section group.
 *
 * This is a DISPLAY component, not a full page header.
 * For page-level headers use ScreenHeader.
 *
 * Usage:
 *   <SectionHeader title="Today's Jobs" />
 *   <SectionHeader title="Quick Actions" rightLabel="See all" onRightPress={...} />
 *
 * Renders as sentence-case with a muted color — NOT all-caps (that's eyebrow style).
 * If you want the eyebrow variant pass eyebrow={true}.
 */
import React from 'react';
import { StyleSheet, TouchableOpacity, View, ViewStyle } from 'react-native';
import { Text } from 'react-native-paper';
import { T } from '@/constants/Colors';
import { Typography } from '@/constants/Typography';

interface SectionHeaderProps {
  title: string;
  /** If true, renders in eyebrow style (uppercase, very small) */
  eyebrow?: boolean;
  rightLabel?: string;
  onRightPress?: () => void;
  style?: ViewStyle;
}

export function SectionHeader({
  title,
  eyebrow = false,
  rightLabel,
  onRightPress,
  style,
}: SectionHeaderProps) {
  return (
    <View style={[styles.wrap, style]}>
      <Text
        style={eyebrow ? styles.eyebrowText : styles.sectionText}
        numberOfLines={1}
      >
        {title}
      </Text>
      <View style={{ flex: 1 }} />
      {rightLabel && onRightPress ? (
        <TouchableOpacity
          onPress={onRightPress}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Text style={styles.rightLabel}>{rightLabel}</Text>
        </TouchableOpacity>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: T.space8,
  },
  sectionText: {
    ...Typography.sectionHeader,
    color: T.textSecondary,
  },
  eyebrowText: {
    ...Typography.eyebrow,
    color: T.textMuted,
  },
  rightLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: T.primary,
  },
});
