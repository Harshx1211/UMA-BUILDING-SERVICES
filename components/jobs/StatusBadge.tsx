// StatusBadge — dot + text pill badge for job lifecycle status
import React from 'react';
import { StyleSheet, View } from 'react-native';
import { Text } from 'react-native-paper';
import { JobStatus } from '@/constants/Enums';
import { useColors } from '@/hooks/useColors';

interface Props {
  status: JobStatus;
  small?: boolean;
}

export function StatusBadge({ status, small = false }: Props) {
  const C = useColors();
  const CONFIG: Record<JobStatus, { bg: string; text: string; dot: string; label: string }> = {
    [JobStatus.Scheduled]:  {
      bg:   C.infoLight,
      text: C.infoDark,
      dot:  C.info,
      label: 'Scheduled',
    },
    [JobStatus.InProgress]: {
      bg:   C.warningLight,
      text: C.warningDark,
      dot:  C.warning,
      label: 'In Progress',
    },
    [JobStatus.Completed]:  {
      bg:   C.successLight,
      text: C.successDark,
      dot:  C.success,
      label: 'Completed',
    },
    [JobStatus.Cancelled]:  {
      bg:   C.backgroundTertiary,
      text: C.textSecondary,
      dot:  C.textTertiary,
      label: 'Cancelled',
    },
  };
  const cfg = CONFIG[status] ?? CONFIG[JobStatus.Scheduled];
  return (
    <View style={[styles.pill, { backgroundColor: cfg.bg }, small && styles.small]}>
      <View style={[styles.dot, { backgroundColor: cfg.dot }, small && styles.dotSmall]} />
      <Text style={[styles.label, { color: cfg.text }, small && styles.labelSmall]}>
        {cfg.label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  pill: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 20,
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  small: { paddingHorizontal: 8, paddingVertical: 3 },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  dotSmall: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
  },
  label: { fontSize: 11, fontWeight: '600' },
  labelSmall: { fontSize: 10 },
});
