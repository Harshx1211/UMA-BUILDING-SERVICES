/**
 * JobCard — the Schedule list card (approved Batch B design, stitch-designs/README.md):
 * status pill + job type, name, address, hazard line, time, a grey footer with
 * compliance status and Map. Priority strip and swipe Start / Cancel unchanged.
 */
import React, { useRef } from 'react';
import { StyleSheet, TouchableOpacity, View, Linking } from 'react-native';
import * as Haptics from 'expo-haptics';
import { Text } from '@/components/ui/AppText';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Swipeable } from 'react-native-gesture-handler';
import { Priority, ComplianceStatus } from '@/constants/Enums';
import { useColors } from '@/hooks/useColors';
import { T } from '@/constants/Colors';
import { Badge, showConfirm } from '@/components/ui';
import { jobTypeLabel } from '@/constants/JobTypeLabels';
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
    return `${h % 12 || 12}:${String(m).padStart(2, '0')} ${h >= 12 ? 'pm' : 'am'}`;
  } catch { return hhmm; }
}

// ─── Swipe action panels ─────────────────────
function StartAction({ onPress, C }: { onPress: () => void, C: ReturnType<typeof useColors> }) {
  return (
    <TouchableOpacity style={[sw.startAction, { backgroundColor: C.success }]} onPress={onPress} activeOpacity={0.85}>
      <MaterialCommunityIcons name="play-circle-outline" size={22} color={T.textOnPrimary} />
      <Text style={sw.actionLabel}>Start</Text>
    </TouchableOpacity>
  );
}
StartAction.displayName = 'StartAction';

function CancelAction({ onPress, C }: { onPress: () => void, C: ReturnType<typeof useColors> }) {
  return (
    <TouchableOpacity style={[sw.cancelAction, { backgroundColor: C.error }]} onPress={onPress} activeOpacity={0.85}>
      <MaterialCommunityIcons name="close-circle-outline" size={22} color={T.textOnPrimary} />
      <Text style={sw.actionLabel}>Cancel</Text>
    </TouchableOpacity>
  );
}
CancelAction.displayName = 'CancelAction';

const sw = StyleSheet.create({
  startAction:  { justifyContent: 'center', alignItems: 'center', width: 78, borderRadius: T.radiusCard, marginLeft: 8, gap: 4 },
  cancelAction: { justifyContent: 'center', alignItems: 'center', width: 78, borderRadius: T.radiusCard, marginRight: 8, gap: 4 },
  actionLabel:  { fontSize: 11, fontWeight: '700', color: T.textOnPrimary },
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
      case Priority.Normal: return 'transparent';
      case Priority.Low:    return 'transparent';
      default:              return 'transparent';
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

  const handleNavigate = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
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
    showConfirm({
      title: 'Cancel job?',
      message: 'Are you sure you want to cancel this job? This action will be synced to the cloud.',
      icon: 'close-circle-outline',
      buttons: [
        { text: 'Keep job', style: 'cancel' },
        {
          text: 'Cancel job',
          style: 'destructive',
          onPress: () => {
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
            onCancel?.();
          },
        },
      ],
    });
  };

  const cardContent = (
    <TouchableOpacity
      style={[s.card, {
        backgroundColor: C.surface,
        borderColor: C.cardBorder,
        shadowColor: C.shadow,
      }]}
      onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); onPress(); }}
      activeOpacity={0.82}
    >
      {/* Priority strip — urgent red, high amber */}
      <View style={[s.strip, { backgroundColor: stripColor }]} />

      <View style={{ flex: 1 }}>
        <View style={s.content}>
          <View style={s.topRow}>
            <View style={{ flex: 1, minWidth: 0, gap: 4 }}>
              <View style={s.statusRow}>
                <Badge status={job.status} dot small />
                <Text style={[s.typeText, { color: C.textTertiary }]} numberOfLines={1}>
                  · {jobTypeLabel(job.job_type) || 'Job'}
                </Text>
              </View>
              <Text style={[s.propertyName, { color: C.text }]} numberOfLines={1}>
                {job.property_name ?? 'Unknown property'}
              </Text>
            </View>
            <MaterialCommunityIcons name="chevron-right" size={22} color={C.textSecondary} style={{ marginTop: 10 }} />
          </View>

          {suburb ? (
            <View style={s.infoRow}>
              <MaterialCommunityIcons name="map-marker-outline" size={16} color={C.textTertiary} />
              <Text style={[s.infoText, { color: C.textSecondary }]} numberOfLines={1}>
                {[job.property_address, suburb].filter(Boolean).join(', ')}
              </Text>
            </View>
          ) : null}

          {timeLabel ? (
            <View style={s.infoRow}>
              <MaterialCommunityIcons name="clock-outline" size={16} color={C.textTertiary} />
              <Text style={[s.infoText, { color: C.textSecondary }]}>{timeLabel}</Text>
            </View>
          ) : null}

          {/* Hazard warning — surfaced here so a technician sees it while
              scanning the day's list, before ever opening the job. */}
          {job.hazard_notes ? (
            <View style={[s.hazardRow, { backgroundColor: C.errorLight }]}>
              <MaterialCommunityIcons name="alert" size={14} color={C.errorDark} />
              <Text style={[s.hazardText, { color: C.errorDark }]} numberOfLines={1}>
                {job.hazard_notes}
              </Text>
            </View>
          ) : null}
        </View>

        {(complianceCfg || showNavigate) ? (
          <View style={[s.footer, { backgroundColor: C.backgroundSecondary }]}>
            {complianceCfg ? (
              <View style={s.complianceRow}>
                <View style={[s.complianceDot, { backgroundColor: complianceCfg.dot }]} />
                <Text style={[s.complianceLabel, { color: C.textSecondary }]}>{complianceCfg.label}</Text>
              </View>
            ) : <View />}
            {showNavigate && (
              <TouchableOpacity
                style={s.navBtn}
                onPress={handleNavigate}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                accessibilityRole="button"
                accessibilityLabel="Directions in maps"
              >
                <MaterialCommunityIcons name="navigation-variant-outline" size={15} color={C.primary} />
                <Text style={[s.navText, { color: C.primary }]}>Map</Text>
              </TouchableOpacity>
            )}
          </View>
        ) : null}
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
    borderRadius: T.radiusCard,
    flexDirection: 'row',
    alignItems: 'stretch',
    overflow: 'hidden',
    borderWidth: 1,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.6,
    shadowRadius: 6,
    elevation: 1,
  },
  strip:   { width: 4 },
  content: { paddingHorizontal: 16, paddingTop: 14, paddingBottom: 12, gap: 8 },

  topRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  statusRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  typeText: { fontSize: 12, flexShrink: 1 },
  propertyName: { fontSize: 16, fontWeight: '600', letterSpacing: -0.1 },

  infoRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  infoText: { fontSize: 13, flex: 1, lineHeight: 18 },

  hazardRow:  { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 8, alignSelf: 'flex-start', maxWidth: '100%' },
  hazardText: { fontSize: 12, fontWeight: '600', flexShrink: 1 },

  footer: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 10, minHeight: 40 },
  complianceRow:   { flexDirection: 'row', alignItems: 'center', gap: 6 },
  complianceDot:   { width: 7, height: 7, borderRadius: 4 },
  complianceLabel: { fontSize: 12, fontWeight: '500' },
  navBtn:    { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 4, paddingVertical: 2 },
  navText:   { fontSize: 13, fontWeight: '600' },
});
