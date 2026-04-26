/**
 * JobCard — professional enterprise card with priority strip, status badge, and swipe actions.
 * Clean, data-rich layout with strong typography and clear visual hierarchy.
 */
import React, { useRef } from 'react';
import { StyleSheet, TouchableOpacity, View, Linking, Alert } from 'react-native';
import * as Haptics from 'expo-haptics';
import { Text } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Swipeable } from 'react-native-gesture-handler';
import { JobTypeBadge } from './JobTypeBadge';
import { StatusBadge } from './StatusBadge';
import { JobStatus, JobType, Priority, ComplianceStatus } from '@/constants/Enums';
import { useColors } from '@/hooks/useColors';
import type { JobWithProperty } from '@/store/jobsStore';

interface Props {
  job: JobWithProperty;
  onPress: () => void;
  showNavigate?: boolean;
  swipeable?: boolean;
  onStart?: () => void;
  onCancel?: () => void;
}

function parseTime(hhmm: string): string {
  try {
    const [h, m] = hhmm.split(':').map(Number);
    return `${h % 12 || 12}:${String(m).padStart(2, '0')} ${h >= 12 ? 'PM' : 'AM'}`;
  } catch { return hhmm; }
}

// ─── Swipe action panels ─────────────────────
function StartAction({ onPress, C }: { onPress: () => void, C: ReturnType<typeof useColors> }) {
  return (
    <TouchableOpacity style={[sw.startAction, { backgroundColor: C.success }]} onPress={onPress} activeOpacity={0.85}>
      <MaterialCommunityIcons name="play-circle-outline" size={22} color="#FFFFFF" />
      <Text style={sw.actionLabel}>Start</Text>
    </TouchableOpacity>
  );
}
StartAction.displayName = 'StartAction';

function CancelAction({ onPress, C }: { onPress: () => void, C: ReturnType<typeof useColors> }) {
  return (
    <TouchableOpacity style={[sw.cancelAction, { backgroundColor: C.error }]} onPress={onPress} activeOpacity={0.85}>
      <MaterialCommunityIcons name="close-circle-outline" size={22} color="#FFFFFF" />
      <Text style={sw.actionLabel}>Cancel</Text>
    </TouchableOpacity>
  );
}
CancelAction.displayName = 'CancelAction';

const sw = StyleSheet.create({
  startAction:  { justifyContent: 'center', alignItems: 'center', width: 78, borderRadius: 16, marginLeft: 8, gap: 4 },
  cancelAction: { justifyContent: 'center', alignItems: 'center', width: 78, borderRadius: 16, marginRight: 8, gap: 4 },
  actionLabel:  { fontSize: 11, fontWeight: '700', color: '#FFFFFF' },
});

// ─── Main card ───────────────────────────────
export const JobCard = React.memo(function JobCard({
  job, onPress, showNavigate = false, swipeable = false, onStart, onCancel,
}: Props) {
  const C = useColors();
  const swipeRef = useRef<Swipeable>(null);

  const getPriorityColor = (p: Priority): string => {
    switch(p) {
      case Priority.Urgent: return C.error;
      case Priority.High:   return C.warning;
      case Priority.Normal: return C.primary;
      case Priority.Low:    return C.textTertiary;
      default:              return C.info;
    }
  };

  const getComplianceCfg = (status: string) => {
    switch(status) {
      case ComplianceStatus.Compliant:    return { dot: C.success, label: 'Compliant' };
      case ComplianceStatus.NonCompliant: return { dot: C.error, label: 'Non-Compliant' };
      case ComplianceStatus.Overdue:      return { dot: C.warning, label: 'Overdue' };
      case ComplianceStatus.Pending:      return { dot: C.textTertiary, label: 'Pending' };
      default: return null;
    }
  };

  const stripColor    = getPriorityColor(job.priority as Priority);
  const complianceCfg = getComplianceCfg(job.property_compliance_status ?? '');
  const suburb        = [job.property_suburb, job.property_state].filter(Boolean).join(', ');
  const timeLabel     = job.scheduled_time ? parseTime(job.scheduled_time) : null;

  const handleNavigate = (e: { stopPropagation: () => void }) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    e.stopPropagation();
    const addr = [job.property_address, job.property_suburb, job.property_state].filter(Boolean).join(', ');
    Linking.openURL(`https://maps.google.com/?q=${encodeURIComponent(addr)}`);
  };

  const handleStart = () => {
    swipeRef.current?.close();
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    onStart?.();
  };

  const handleCancel = () => {
    swipeRef.current?.close();
    Alert.alert(
      'Cancel Job?',
      'Are you sure you want to cancel this job? This action will be synced to the cloud.',
      [
        { text: 'Keep Job', style: 'cancel' },
        {
          text: 'Cancel Job',
          style: 'destructive',
          onPress: () => {
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
            onCancel?.();
          },
        },
      ]
    );
  };

  const cardContent = (
    <TouchableOpacity
      style={[s.card, {
        backgroundColor: C.surface,
        borderColor: C.cardBorder,
      }]}
      onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); onPress(); }}
      activeOpacity={0.82}
    >
      {/* Priority strip — left edge */}
      <View style={[s.strip, { backgroundColor: stripColor }]} />

      {/* Content */}
      <View style={s.content}>
        {/* Row 1: Property name + Status badge */}
        <View style={s.row1}>
          <Text style={[s.propertyName, { color: C.text }]} numberOfLines={1}>
            {job.property_name ?? 'Unknown Property'}
          </Text>
          <StatusBadge status={job.status as JobStatus} small />
        </View>

        {/* Row 2: Address */}
        {suburb ? (
          <View style={s.row2}>
            <MaterialCommunityIcons name="map-marker-outline" size={13} color={C.textTertiary} />
            <Text style={[s.address, { color: C.textSecondary }]} numberOfLines={1}>
              {[job.property_address, suburb].filter(Boolean).join(', ')}
            </Text>
          </View>
        ) : null}

        {/* Divider */}
        <View style={[s.divider, { backgroundColor: C.border }]} />

        {/* Row 3: Type badge + time + navigate */}
        <View style={s.row3}>
          <JobTypeBadge jobType={job.job_type as JobType} />
          {timeLabel ? (
            <View style={[s.timeChip, { backgroundColor: C.backgroundSecondary }]}>
              <MaterialCommunityIcons name="clock-outline" size={11} color={C.textSecondary} />
              <Text style={[s.timeText, { color: C.textSecondary }]}>{timeLabel}</Text>
            </View>
          ) : null}
          <View style={{ flex: 1 }} />
          {showNavigate && (
            <TouchableOpacity
              style={[s.navBtn, { backgroundColor: C.backgroundSecondary, borderColor: C.border, borderWidth: 1 }]}
              onPress={handleNavigate as never}
              hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
            >
              <MaterialCommunityIcons name="navigation-variant-outline" size={12} color={C.primary} />
              <Text style={[s.navText, { color: C.primary }]}>Map</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Row 4: Compliance dot */}
        {complianceCfg ? (
          <View style={s.complianceRow}>
            <View style={[s.complianceDot, { backgroundColor: complianceCfg.dot }]} />
            <Text style={[s.complianceLabel, { color: C.textTertiary }]}>{complianceCfg.label}</Text>
          </View>
        ) : null}
      </View>

      {/* Right chevron */}
      <View style={s.chevronWrap}>
        <MaterialCommunityIcons name="chevron-right" size={18} color={C.textTertiary} />
      </View>
    </TouchableOpacity>
  );

  if (!swipeable) return cardContent;

  return (
    <Swipeable
      ref={swipeRef}
      renderLeftActions={() => <StartAction onPress={handleStart} C={C} />}
      renderRightActions={() => <CancelAction onPress={handleCancel} C={C} />}
      leftThreshold={60}
      rightThreshold={60}
      overshootLeft={false}
      overshootRight={false}
    >
      {cardContent}
    </Swipeable>
  );
});

const s = StyleSheet.create({
  card: {
    borderRadius: 18,
    flexDirection: 'row',
    alignItems: 'stretch',
    overflow: 'hidden',
    borderWidth: 1,
    shadowColor: '#0D1526',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 14,
    elevation: 4,
  },
  strip:   { width: 6 },
  content: { flex: 1, paddingHorizontal: 16, paddingVertical: 16, gap: 8 },

  row1: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
  propertyName: { fontSize: 15, fontWeight: '700', flex: 1, letterSpacing: -0.2 },

  row2: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  address: { fontSize: 12, flex: 1, lineHeight: 17 },

  divider: { height: StyleSheet.hairlineWidth, marginVertical: 2 },

  row3: { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  timeChip: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  timeText:  { fontSize: 11, fontWeight: '500' },
  navBtn:    { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 8 },
  navText:   { fontSize: 11, fontWeight: '600' },

  complianceRow:   { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 1 },
  complianceDot:   { width: 6, height: 6, borderRadius: 3 },
  complianceLabel: { fontSize: 10, fontWeight: '500', letterSpacing: 0.2 },

  chevronWrap: { justifyContent: 'center', paddingRight: 12 },
});
