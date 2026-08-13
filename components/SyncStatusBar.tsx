// SyncStatusBar — shows last sync time, pending count, manual sync trigger,
// and a user-visible alert when data permanently fails to reach the server.
// Accepts a `light` prop when rendered on dark (navy) backgrounds.
import { useEffect, useState, useCallback } from 'react';
import { Alert, StyleSheet, TouchableOpacity, View } from 'react-native';
import { Text } from 'react-native-paper';
import {
  getSyncStatus,
  runSync,
  onSyncFailure,
  offSyncFailure,
  retryAllFailedSyncItems,
  type SyncFailureAlert,
} from '@/lib/sync';
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
  const [failureAlert, setFailureAlert] = useState<SyncFailureAlert | null>(null);

  const refresh = async () => {
    try { setStatus(await getSyncStatus()); } catch { /* silent */ }
  };

  // ── Sync-failure alert subscription ─────────────────────────
  // When sync permanently fails, surface an Alert so the user is never
  // left wondering why their data didn't reach the server (Decision #3).
  const handleFailure = useCallback((alert: SyncFailureAlert) => {
    setFailureAlert(alert);
    void refresh(); // refresh status counts immediately
  }, []);

  useEffect(() => {
    onSyncFailure(handleFailure);
    return () => offSyncFailure(handleFailure);
  }, [handleFailure]);

  // Show the user-facing alert whenever a failure is detected.
  // Offers "Retry Now" and "Dismiss" options.
  useEffect(() => {
    if (!failureAlert) return;
    const { failedCount, tables, lastError } = failureAlert;
    Alert.alert(
      '⚠️ Sync Failed',
      `${failedCount} item${failedCount > 1 ? 's' : ''} could not be saved to the server.\n\n` +
      `Affected: ${tables.join(', ')}\n` +
      `Reason: ${lastError}\n\n` +
      'Your data is safe on this device. Tap "Retry Now" to try again.',
      [
        {
          text: 'Retry Now',
          onPress: () => {
            // Reset retry counters then trigger an immediate sync
            retryAllFailedSyncItems();
            void runSync().then(refresh);
            setFailureAlert(null);
          },
        },
        {
          text: 'Dismiss',
          style: 'cancel',
          onPress: () => setFailureAlert(null),
        },
      ],
      { cancelable: false },
    );
  }, [failureAlert]);

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
  const hasFailures = (status?.failedCount ?? 0) > 0;
  const dotColor = !isOnline
    ? (light ? 'rgba(255,255,255,0.4)' : '#94A3B8')
    : hasFailures
      ? (light ? '#FCA5A5' : '#DC2626')   // red — permanent failures
      : (status?.pendingCount ?? 0) > 0
        ? (light ? '#FCD34D' : '#D97706') // amber — pending
        : (light ? '#6EE7B7' : '#059669'); // green — all good

  // ── Label ────────────────────────────────────────────────
  let label = 'Never synced';
  if (isSyncing) {
    label = 'Syncing...';
  } else if (!isOnline) {
    label = 'Offline';
  } else if (hasFailures) {
    label = `${status!.failedCount} failed — tap to retry`;
  } else if (status?.lastSynced) {
    const syncDate = new Date(status.lastSynced);
    // Guard against epoch (bad stored value — must be after year 2020)
    if (syncDate.getFullYear() >= 2020) {
      const diffMs = Date.now() - syncDate.getTime();
      const mins  = Math.floor(diffMs / 60_000);
      const hours = Math.floor(diffMs / 3_600_000);
      if (mins < 2)         label = 'Just now';
      else if (mins < 60)   label = `${mins} min ago`;
      else if (hours < 24)  label = `${hours} hr ago`;
      else                  label = syncDate.toLocaleDateString('en-AU', { day: 'numeric', month: 'short' });
    }
    if ((status.pendingCount ?? 0) > 0) label += ` · ${status.pendingCount} pending`;
  }

  const textColor = hasFailures
    ? (light ? '#FCA5A5' : '#DC2626')
    : light ? 'rgba(255,255,255,0.7)' : '#8896A8';

  return (
    <TouchableOpacity
      onPress={hasFailures ? () => {
        // Tapping while in failed state: reset retries and re-sync immediately
        retryAllFailedSyncItems();
        void runSync().then(refresh);
      } : handleSync}
      style={styles.container}
      activeOpacity={0.7}
    >
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
