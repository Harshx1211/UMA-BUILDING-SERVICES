// SyncStatusBar — shows last sync time, pending count, and manual sync trigger
// Accepts a `light` prop when rendered on dark (navy) backgrounds
import { useEffect, useState } from 'react';
import { StyleSheet, TouchableOpacity, View } from 'react-native';
import { Text } from 'react-native-paper';
import { getSyncStatus, runSync } from '@/lib/sync';
import { useNetworkStatus } from '@/hooks/useNetworkStatus';
import type { SyncStatus } from '@/types';

const POLL_MS = 30_000;

interface Props {
  /** Pass true when the bar sits on a dark/navy background */
  light?: boolean;
}

export function SyncStatusBar({ light = false }: Props) {
  const { isOnline } = useNetworkStatus();
  const [status, setStatus] = useState<SyncStatus | null>(null);
  const [isSyncing, setIsSyncing] = useState(false);

  const refresh = async () => {
    try { setStatus(await getSyncStatus()); } catch { /* silent */ }
  };

  useEffect(() => {
    void refresh();
    const t = setInterval(refresh, POLL_MS);
    return () => clearInterval(t);
  }, []);

  const handleSync = async () => {
    if (isSyncing || !isOnline) return;
    setIsSyncing(true);
    try { await runSync(); await refresh(); }
    finally { setIsSyncing(false); }
  };

  // ── Dot colour ──────────────────────────────────────────
  // On light mode: use semantic colours from theme
  // On dark (navy) header: use white-compatible variants
  const dotColor = !isOnline
    ? (light ? 'rgba(255,255,255,0.4)' : '#94A3B8')
    : (status?.pendingCount ?? 0) > 0
      ? (light ? '#FCD34D' : '#D97706')   // amber
      : (light ? '#6EE7B7' : '#059669');  // green

  // ── Label ────────────────────────────────────────────────
  let label = 'Never synced';
  if (isSyncing) {
    label = 'Syncing...';
  } else if (!isOnline) {
    label = 'Offline';
  } else if (status?.lastSynced) {
    const mins = Math.floor((Date.now() - new Date(status.lastSynced).getTime()) / 60_000);
    label = mins < 1 ? 'Just synced' : mins === 1 ? '1 min ago' : `${mins} min ago`;
    if ((status.pendingCount ?? 0) > 0) label += ` · ${status.pendingCount} pending`;
  }

  const textColor = light ? 'rgba(255,255,255,0.7)' : '#8896A8';

  return (
    <TouchableOpacity onPress={handleSync} style={styles.container} activeOpacity={0.7}>
      <View style={[styles.dot, { backgroundColor: dotColor }]} />
      <Text style={[styles.label, { color: textColor }]}>{label}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 4, paddingVertical: 4 },
  dot:       { width: 7, height: 7, borderRadius: 4 },
  label:     { fontSize: 11, fontWeight: '500' },
});
