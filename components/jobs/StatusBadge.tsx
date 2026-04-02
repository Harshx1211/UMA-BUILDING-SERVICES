// StatusBadge — full-pill badge for job lifecycle status
import React from 'react';
import { StyleSheet, View } from 'react-native';
import { Text } from 'react-native-paper';
import { JobStatus } from '@/constants/Enums';
import Colors from '@/constants/Colors';

interface Props {
  status: JobStatus;
  small?: boolean;
}

const CONFIG: Record<JobStatus, { bg: string; text: string; label: string }> = {
  [JobStatus.Scheduled]:  { bg: Colors.light.infoLight,    text: Colors.light.infoDark,    label: 'Scheduled' },
  [JobStatus.InProgress]: { bg: '#FFF7ED',                 text: '#C2410C',                label: 'In Progress' },
  [JobStatus.Completed]:  { bg: Colors.light.successLight, text: Colors.light.successDark, label: 'Completed' },
  [JobStatus.Cancelled]:  { bg: Colors.light.backgroundSecondary, text: Colors.light.textSecondary, label: 'Cancelled' },
};

export function StatusBadge({ status, small = false }: Props) {
  const cfg = CONFIG[status] ?? CONFIG[JobStatus.Scheduled];
  return (
    <View style={[styles.pill, { backgroundColor: cfg.bg }, small && styles.small]}>
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
  },
  small: { paddingHorizontal: 8, paddingVertical: 3 },
  label: { fontSize: 11, fontWeight: '600' },
  labelSmall: { fontSize: 10 },
});
