// components/jobs/RouteMapView.tsx — Phase 11: Map view of jobs with color-coded markers
import React, { useEffect, useRef, useState } from 'react';
import {
  View, StyleSheet, TouchableOpacity, Platform,
} from 'react-native';
import { Text, ActivityIndicator } from 'react-native-paper';
import MapView, { Marker, Region, PROVIDER_DEFAULT } from 'react-native-maps';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import Animated, { FadeInDown, FadeOutDown } from 'react-native-reanimated';
import { useColors } from '@/hooks/useColors';
import { Priority } from '@/constants/Enums';
import type { JobWithProperty } from '@/store/jobsStore';

interface Props {
  jobs: JobWithProperty[];
  onJobSelect: (job: JobWithProperty) => void;
}



// ── Priority → marker color  ──────────────────────────
const PRIORITY_COLOR: Record<string, string> = {
  [Priority.Urgent]: '#EF4444',
  [Priority.High]:   '#EAB308',
  [Priority.Normal]: '#1B2D4F',
  [Priority.Low]:    '#94A3B8',
};

// ── Address → coords cache ────────────────────────────
const coordCache = new Map<string, { latitude: number; longitude: number }>();

async function geocodeAddress(address: string) {
  if (coordCache.has(address)) return coordCache.get(address)!;
  try {
    const encoded = encodeURIComponent(address);
    const res = await fetch(
      `https://nominatim.openstreetmap.org/search?q=${encoded}&format=json&limit=1`,
      { headers: { 'User-Agent': 'SiteTrack/1.0' } }
    );
    const json = await res.json() as { lat: string; lon: string }[];
    if (json.length > 0) {
      const coords = {
        latitude: parseFloat(json[0].lat),
        longitude: parseFloat(json[0].lon),
      };
      coordCache.set(address, coords);
      return coords;
    }
  } catch { /* ignore */ }
  return null;
}

function getJobAddress(job: JobWithProperty): string {
  return [
    (job as any).property_address,
    (job as any).property_suburb,
    (job as any).property_state,
  ].filter(Boolean).join(', ');
}

type JobMarker = {
  job: JobWithProperty;
  coordinate: { latitude: number; longitude: number };
};

export default function RouteMapView({ jobs, onJobSelect }: Props) {
  const C = useColors();
  const mapRef = useRef<MapView>(null);
  const [markers, setMarkers] = useState<JobMarker[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedJob, setSelectedJob] = useState<JobWithProperty | null>(null);

  // ── Geocode all jobs ────────────────────────────────
  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      setIsLoading(true);
      const resolved: JobMarker[] = [];
      for (const job of jobs) {
        const address = getJobAddress(job);
        if (!address) continue;
        const coords = await geocodeAddress(address);
        if (coords && !cancelled) {
          resolved.push({ job, coordinate: coords });
        }
      }
      if (!cancelled) {
        setMarkers(resolved);
        setIsLoading(false);
        // Fit map to show all markers
        if (resolved.length > 0) {
          setTimeout(() => {
            mapRef.current?.fitToCoordinates(
              resolved.map((m) => m.coordinate),
              {
                edgePadding: { top: 60, right: 40, bottom: 160, left: 40 },
                animated: true,
              }
            );
          }, 500);
        }
      }
    };
    void load();
    return () => { cancelled = true; };
  }, [jobs]);

  const handleMarkerPress = (job: JobWithProperty) => {
    setSelectedJob(job);
  };

  const initialRegion: Region = {
    latitude: -33.8688,   // Sydney default
    longitude: 151.2093,
    latitudeDelta: 0.3,
    longitudeDelta: 0.3,
  };

  return (
    <View style={s.container}>
      {isLoading && (
        <View style={s.loadingOverlay}>
          <ActivityIndicator color={C.accent} size="large" />
          <Text style={[s.loadingText, { color: C.textSecondary }]}>Locating jobs on map...</Text>
        </View>
      )}

      <MapView
        ref={mapRef}
        style={s.map}
        provider={PROVIDER_DEFAULT}
        initialRegion={initialRegion}
        showsUserLocation
        showsMyLocationButton={Platform.OS === 'android'}
      >
        {markers.map(({ job, coordinate }) => (
          <Marker
            key={job.id}
            coordinate={coordinate}
            onPress={() => handleMarkerPress(job)}
          >
            {/* Custom marker pin */}
            <View style={[s.markerPin, { borderColor: PRIORITY_COLOR[job.priority] ?? C.primary }]}>
              <View style={[s.markerDot, { backgroundColor: PRIORITY_COLOR[job.priority] ?? C.primary }]} />
            </View>
          </Marker>
        ))}
      </MapView>

      {/* Empty state */}
      {!isLoading && markers.length === 0 && (
        <View style={s.emptyOverlay}>
          <MaterialCommunityIcons name="map-marker-off-outline" size={40} color={C.textSecondary} />
          <Text style={[s.emptyText, { color: C.textSecondary }]}>No jobs with mappable addresses</Text>
        </View>
      )}

      {/* Marker count badge */}
      {!isLoading && markers.length > 0 && (
        <View style={[s.countBadge, { backgroundColor: C.primary }]}>
          <MaterialCommunityIcons name="map-marker-multiple" size={14} color="#FFFFFF" />
          <Text style={s.countText}>{markers.length} jobs</Text>
        </View>
      )}

      {/* Selected job card */}
      {selectedJob && (
        <Animated.View
          entering={FadeInDown.duration(250)}
          exiting={FadeOutDown.duration(200)}
          style={[s.jobCard, { backgroundColor: C.surface }]}
        >
          <View style={[s.jobCardPriority, { backgroundColor: PRIORITY_COLOR[selectedJob.priority] ?? C.primary }]} />
          <View style={s.jobCardContent}>
            <Text style={[s.jobCardProperty, { color: C.text }]} numberOfLines={1}>
              {(selectedJob as any).property_name ?? 'Unknown Property'}
            </Text>
            <Text style={[s.jobCardAddress, { color: C.textSecondary }]} numberOfLines={1}>
              {getJobAddress(selectedJob) || 'No address'}
            </Text>
            <Text style={[s.jobCardDate, { color: C.textTertiary }]}>📅 {selectedJob.scheduled_date}</Text>
          </View>
          <View style={s.jobCardActions}>
            <TouchableOpacity style={[s.closeBtn, { backgroundColor: C.backgroundTertiary }]} onPress={() => setSelectedJob(null)}>
              <MaterialCommunityIcons name="close" size={16} color={C.textSecondary} />
            </TouchableOpacity>
            <TouchableOpacity style={[s.openBtn, { backgroundColor: C.accent }]} onPress={() => { setSelectedJob(null); onJobSelect(selectedJob); }}>
              <Text style={s.openBtnText}>Open Job</Text>
              <MaterialCommunityIcons name="chevron-right" size={16} color="#FFFFFF" />
            </TouchableOpacity>
          </View>
        </Animated.View>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, position: 'relative' },
  map:       { ...StyleSheet.absoluteFillObject },

  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(244,246,249,0.9)',
    alignItems: 'center', justifyContent: 'center', gap: 12, zIndex: 10,
  },
  loadingText: { fontSize: 14 },

  emptyOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(244,246,249,0.85)',
    alignItems: 'center', justifyContent: 'center', gap: 12,
  },
  emptyText: { fontSize: 14 },

  markerPin: {
    width: 28, height: 28, borderRadius: 14,
    backgroundColor: '#FFFFFF',
    borderWidth: 2.5,
    alignItems: 'center', justifyContent: 'center',
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25, shadowRadius: 4, elevation: 5,
  },
  markerDot: { width: 12, height: 12, borderRadius: 6 },

  countBadge: {
    position: 'absolute', top: 12, right: 12,
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: 10, paddingVertical: 5,
    borderRadius: 20,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15, shadowRadius: 4, elevation: 4,
  },
  countText: { fontSize: 12, fontWeight: '700', color: '#FFFFFF' },

  jobCard: {
    position: 'absolute', bottom: 16, left: 16, right: 16,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    flexDirection: 'row',
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15, shadowRadius: 12, elevation: 8,
  },
  jobCardPriority: { width: 4 },
  jobCardContent:  { flex: 1, padding: 14, gap: 3 },
  jobCardProperty: { fontSize: 15, fontWeight: '700' },
  jobCardAddress:  { fontSize: 12 },
  jobCardDate:     { fontSize: 12, marginTop: 2 },

  jobCardActions: { padding: 12, alignItems: 'flex-end', justifyContent: 'space-between' },
  closeBtn: {
    width: 28, height: 28, borderRadius: 14,
    alignItems: 'center', justifyContent: 'center',
  },
  openBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 2,
    paddingHorizontal: 10, paddingVertical: 7,
    borderRadius: 10,
  },
  openBtnText: { fontSize: 12, fontWeight: '700', color: '#FFFFFF' },
});
