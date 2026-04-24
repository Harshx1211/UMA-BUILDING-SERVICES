// JobTypeBadge — pill badge for job category
import React from 'react';
import { StyleSheet, View } from 'react-native';
import { Text } from 'react-native-paper';
import { JobType } from '@/constants/Enums';
import { useColors } from '@/hooks/useColors';

interface Props {
  jobType: JobType;
}

export function JobTypeBadge({ jobType }: Props) {
  const C = useColors();
  const CONFIG: Record<JobType, { bg: string; text: string; label: string; bold?: boolean }> = {
    [JobType.RoutineService]: { bg: C.infoLight || C.info + '20',    text: C.infoDark || C.info,    label: 'Routine Service' },
    [JobType.DefectRepair]:   { bg: C.errorLight || C.error + '20',   text: C.errorDark || C.error,   label: 'Defect Repair' },
    [JobType.Installation]:   { bg: '#F3E8FF',                 text: '#6D28D9',                label: 'Installation' },
    [JobType.Emergency]:      { bg: C.errorLight || C.error + '20',   text: C.error,                 label: 'EMERGENCY', bold: true },
    [JobType.Quote]:          { bg: C.backgroundSecondary || C.surface, text: C.textSecondary, label: 'Quote' },
  };
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
