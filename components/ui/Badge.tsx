/**
 * Badge — status pill. Color is driven entirely by semantic status tokens.
 *
 * Status → Color mapping (applied identically everywhere a status appears):
 *   in_progress / inProgress → warning (amber)
 *   scheduled               → info (blue)
 *   completed               → success (green)
 *   cancelled               → muted (slate)
 *   pass                    → success
 *   fail                    → danger
 *   open                    → danger
 *   quoted / monitoring     → warning
 *   repaired                → success
 *   urgent                  → danger
 *   high                    → warning
 *   normal / low            → muted
 *
 * Usage:  <Badge status="in_progress" />  or  <Badge status="completed" />
 */
import React from 'react';
import { StyleSheet, View } from 'react-native';
import { Text } from 'react-native-paper';
import { T } from '@/constants/Colors';

type KnownStatus =
  | 'in_progress' | 'scheduled' | 'completed' | 'cancelled'
  | 'pass' | 'fail' | 'not_tested'
  | 'open' | 'quoted' | 'repaired' | 'monitoring'
  | 'urgent' | 'high' | 'normal' | 'low'
  | 'active' | 'decommissioned'
  | 'compliant' | 'non_compliant' | 'overdue' | 'pending';

const HUMAN_LABEL: Partial<Record<KnownStatus, string>> = {
  in_progress:    'In Progress',
  scheduled:      'Scheduled',
  completed:      'Completed',
  cancelled:      'Cancelled',
  pass:           'Pass',
  fail:           'Fail',
  not_tested:     'Not Tested',
  open:           'Open',
  quoted:         'Quoted',
  repaired:       'Repaired',
  monitoring:     'Monitoring',
  urgent:         'Urgent',
  high:           'High',
  normal:         'Normal',
  low:            'Low',
  active:         'Active',
  decommissioned: 'Decommissioned',
  compliant:      'Compliant',
  non_compliant:  'Non-Compliant',
  overdue:        'Overdue',
  pending:        'Pending',
};

const STATUS_COLORS: Record<KnownStatus, { bg: string; text: string }> = {
  in_progress:    { bg: T.warningBg,  text: T.warning  },
  scheduled:      { bg: T.infoBg,     text: T.info     },
  completed:      { bg: T.successBg,  text: T.success  },
  cancelled:      { bg: T.border,     text: T.textMuted },
  pass:           { bg: T.successBg,  text: T.success  },
  fail:           { bg: T.dangerBg,   text: T.danger   },
  not_tested:     { bg: T.border,     text: T.textMuted },
  open:           { bg: T.dangerBg,   text: T.danger   },
  quoted:         { bg: T.warningBg,  text: T.warning  },
  repaired:       { bg: T.successBg,  text: T.success  },
  monitoring:     { bg: T.warningBg,  text: T.warning  },
  urgent:         { bg: T.dangerBg,   text: T.danger   },
  high:           { bg: T.warningBg,  text: T.warning  },
  normal:         { bg: T.border,     text: T.textMuted },
  low:            { bg: T.border,     text: T.textMuted },
  active:         { bg: T.successBg,  text: T.success  },
  decommissioned: { bg: T.border,     text: T.textMuted },
  compliant:      { bg: T.successBg,  text: T.success  },
  non_compliant:  { bg: T.dangerBg,   text: T.danger   },
  overdue:        { bg: T.dangerBg,   text: T.danger   },
  pending:        { bg: T.warningBg,  text: T.warning  },
};

interface BadgeProps {
  status: KnownStatus | string;
  /** Override the auto-generated label */
  label?: string;
}

export function Badge({ status, label }: BadgeProps) {
  const colors = STATUS_COLORS[status as KnownStatus] ?? {
    bg: T.border,
    text: T.textMuted,
  };
  const displayLabel = label ?? HUMAN_LABEL[status as KnownStatus] ?? status;

  return (
    <View style={[styles.pill, { backgroundColor: colors.bg }]}>
      <Text style={[styles.text, { color: colors.text }]}>{displayLabel}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  pill: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: T.radiusPill,
    alignSelf: 'flex-start',
  },
  text: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.2,
  },
});
