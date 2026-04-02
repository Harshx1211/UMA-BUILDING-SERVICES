// JobCard — redesigned: 4px left priority strip + content area with badges
import React from 'react';
import { StyleSheet, TouchableOpacity, View, Linking } from 'react-native';
import { Text } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { JobTypeBadge } from './JobTypeBadge';
import { StatusBadge } from './StatusBadge';
import { JobStatus, JobType, Priority } from '@/constants/Enums';
import Colors from '@/constants/Colors';
import type { JobWithProperty } from '@/store/jobsStore';

interface Props {
  job: JobWithProperty;
  onPress: () => void;
  showNavigate?: boolean;
}

const PRIORITY_STRIP: Record<Priority, string> = {
  [Priority.Urgent]: '#EF4444',
  [Priority.High]:   '#EAB308',
  [Priority.Normal]: '#3B82F6',
  [Priority.Low]:    '#9CA3AF',
};

function parseTime(hhmm: string): string {
  try {
    const [h, m] = hhmm.split(':').map(Number);
    return `${h % 12 || 12}:${String(m).padStart(2, '0')} ${h >= 12 ? 'PM' : 'AM'}`;
  } catch { return hhmm; }
}

export function JobCard({ job, onPress, showNavigate = false }: Props) {
  const stripColor  = PRIORITY_STRIP[job.priority as Priority] ?? Colors.light.info;
  const suburb      = [job.property_suburb, job.property_state].filter(Boolean).join(', ');
  const timeLabel   = job.scheduled_time ? parseTime(job.scheduled_time) : null;

  const handleNavigate = (e: { stopPropagation: () => void }) => {
    e.stopPropagation();
    const addr = [job.property_address, job.property_suburb, job.property_state]
      .filter(Boolean).join(', ');
    Linking.openURL(`https://maps.google.com/?q=${encodeURIComponent(addr)}`);
  };

  return (
    <TouchableOpacity style={s.card} onPress={onPress} activeOpacity={0.75}>
      {/* Priority strip — left edge */}
      <View style={[s.strip, { backgroundColor: stripColor }]} />

      {/* Content */}
      <View style={s.content}>
        {/* Row 1: Property name + Status badge */}
        <View style={s.row1}>
          <Text style={s.propertyName} numberOfLines={1}>{job.property_name ?? 'Unknown Property'}</Text>
          <StatusBadge status={job.status as JobStatus} small />
        </View>

        {/* Row 2: Address */}
        {suburb ? (
          <View style={s.row2}>
            <MaterialCommunityIcons name="map-marker-outline" size={12} color={Colors.light.textSecondary} />
            <Text style={s.address} numberOfLines={1}>
              {[job.property_address, suburb].filter(Boolean).join(', ')}
            </Text>
          </View>
        ) : null}

        {/* Row 3: Type badge + time + navigate */}
        <View style={s.row3}>
          <JobTypeBadge jobType={job.job_type as JobType} />
          {timeLabel ? (
            <View style={s.timeChip}>
              <MaterialCommunityIcons name="clock-outline" size={11} color={Colors.light.textSecondary} />
              <Text style={s.timeText}>{timeLabel}</Text>
            </View>
          ) : null}
          <View style={{ flex: 1 }} />
          {showNavigate && (
            <TouchableOpacity style={s.navBtn} onPress={handleNavigate as never} hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}>
              <MaterialCommunityIcons name="navigation-variant-outline" size={12} color={Colors.light.primary} />
              <Text style={s.navText}>Map</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>

      <MaterialCommunityIcons name="chevron-right" size={18} color={Colors.light.border} style={s.chevron} />
    </TouchableOpacity>
  );
}

const s = StyleSheet.create({
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    flexDirection: 'row',
    alignItems: 'stretch',
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 3,
  },

  // Left priority strip
  strip: {
    width: 4,
    borderRadius: 0,
  },

  // Content area
  content: {
    flex: 1,
    padding: 14,
    gap: 6,
  },

  // Row 1
  row1: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  propertyName: {
    fontSize: 15,
    fontWeight: '600',
    color: Colors.light.text,
    flex: 1,
  },

  // Row 2
  row2: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  address: {
    fontSize: 12,
    color: Colors.light.textSecondary,
    flex: 1,
  },

  // Row 3
  row3: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexWrap: 'wrap',
    marginTop: 2,
  },
  timeChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: Colors.light.background,
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 20,
  },
  timeText: {
    fontSize: 11,
    color: Colors.light.textSecondary,
    fontWeight: '500',
  },
  navBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: '#EEF2F8',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  navText: {
    fontSize: 10,
    fontWeight: '700',
    color: Colors.light.primary,
  },

  chevron: { marginRight: 10, alignSelf: 'center' },
});
