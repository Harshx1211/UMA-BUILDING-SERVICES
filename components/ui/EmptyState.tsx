/**
 * EmptyState — uniform empty state used across every zero-data screen.
 *
 * Rules:
 *  - No emoji. A muted MaterialCommunityIcons icon only.
 *  - Title in Typography.cardTitle (sentence case, not all-caps).
 *  - Subtitle in Typography.body.
 *  - CTA button uses Button variant="primary" if provided.
 *
 * Usage:
 *   <EmptyState
 *     icon="calendar-blank-outline"
 *     title="No jobs scheduled today"
 *     subtitle="Your queue is clear. Pull to refresh."
 *   />
 */
import React from 'react';
import { StyleSheet, View } from 'react-native';
import { Text } from '@/components/ui/AppText';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { T } from '@/constants/Colors';
import { Typography } from '@/constants/Typography';
import { Button } from './Button';

type MCIconName = React.ComponentProps<typeof MaterialCommunityIcons>['name'];

interface EmptyStateProps {
  icon: MCIconName;
  title: string;
  subtitle?: string;
  actionLabel?: string;
  onAction?: () => void;
}

export function EmptyState({ icon, title, subtitle, actionLabel, onAction }: EmptyStateProps) {
  return (
    <View style={styles.wrap}>
      <View style={styles.iconWrap}>
        <MaterialCommunityIcons
          name={icon}
          size={26}
          color={T.textSecondary}
        />
      </View>
      <Text style={styles.title}>{title}</Text>
      {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
      {actionLabel && onAction ? (
        <Button
          title={actionLabel}
          onPress={onAction}
          size="small"
          style={styles.cta}
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: T.space32 + T.space16,
    paddingHorizontal: T.space32,
    gap: T.space8,
  },
  // Approved redesign: icon in a soft round tile, title 16 bold, one line of body.
  iconWrap: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: T.surfaceInput,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: T.space8,
  },
  title: {
    ...Typography.cardTitle,
    fontSize: 16,
    fontWeight: '700',
    color: T.textPrimary,
    textAlign: 'center',
  },
  subtitle: {
    ...Typography.body,
    color: T.textSecondary,
    textAlign: 'center',
    lineHeight: 20,
    paddingHorizontal: T.space8,
  },
  cta: {
    marginTop: T.space16,
  },
});
