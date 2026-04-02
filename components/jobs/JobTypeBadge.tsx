// JobTypeBadge — pill badge for job category
import React from 'react';
import { StyleSheet, View } from 'react-native';
import { Text } from 'react-native-paper';
import { JobType } from '@/constants/Enums';
import Colors from '@/constants/Colors';

interface Props {
  jobType: JobType;
}

const CONFIG: Record<JobType, { bg: string; text: string; label: string; bold?: boolean }> = {
  [JobType.RoutineService]: { bg: Colors.light.infoLight,    text: Colors.light.infoDark,    label: 'Routine Service' },
  [JobType.DefectRepair]:   { bg: Colors.light.errorLight,   text: Colors.light.errorDark,   label: 'Defect Repair' },
  [JobType.Installation]:   { bg: '#F3E8FF',                 text: '#6D28D9',                label: 'Installation' },
  [JobType.Emergency]:      { bg: Colors.light.errorLight,   text: Colors.light.error,       label: 'EMERGENCY', bold: true },
  [JobType.Quote]:          { bg: Colors.light.backgroundSecondary, text: Colors.light.textSecondary, label: 'Quote' },
};

export function JobTypeBadge({ jobType }: Props) {
  const cfg = CONFIG[jobType] ?? CONFIG[JobType.RoutineService];
  return (
    <View style={[styles.pill, { backgroundColor: cfg.bg }]}>
      <Text style={[styles.label, { color: cfg.text }, cfg.bold ? styles.bold : null]}>
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
  label: { fontSize: 11, fontWeight: '600' },
  bold:  { fontWeight: '800', fontSize: 11 },
});
