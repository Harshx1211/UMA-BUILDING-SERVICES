/**
 * ToleranceLabel — "8/1 – 8/5 (3d late)" style due-date window, shown next
 * to a job's scheduled date. One shared component so this format string
 * exists once (job list row + job detail chip row both use it).
 */
import React from 'react';
import { Text, StyleSheet } from 'react-native';
import { T } from '@/constants/Colors';
import { getToleranceWindow } from '@/utils/toleranceWindow';

interface Props {
  scheduledDate: string;
  jobType: string;
  style?: object;
}

function formatShort(dateStr: string): string {
  const [, m, d] = dateStr.slice(0, 10).split('-').map(Number);
  return `${m}/${d}`;
}

export function ToleranceLabel({ scheduledDate, jobType, style }: Props) {
  if (!scheduledDate) return null;
  const { windowStart, windowEnd, daysLateOrLeft, isLate } = getToleranceWindow(scheduledDate, jobType);

  const suffix = isLate
    ? ` (${daysLateOrLeft}d late)`
    : daysLateOrLeft < 0
      ? ` (${Math.abs(daysLateOrLeft)}d until due)`
      : '';

  return (
    <Text style={[styles.label, { color: isLate ? T.danger : T.textMuted }, style]}>
      {formatShort(windowStart)} – {formatShort(windowEnd)}{suffix}
    </Text>
  );
}

const styles = StyleSheet.create({
  label: { fontSize: 11.5, fontWeight: '600' },
});
