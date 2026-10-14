// useNetworkStatus — wraps NetInfo to provide reactive online/offline state
// Phase 12: Tracks false→true transition to auto-trigger sync and show toast
import { useEffect, useRef, useState } from 'react';
import NetInfo, { NetInfoState } from '@react-native-community/netinfo';
import { runSync, getCachedUserId } from '@/lib/sync';

// FIX (2026-10-14): "online" used to mean only "connected to a network".
// Wi-Fi or mobile data often connects a moment before the internet is
// actually reachable; the sync fired then, found no internet (runSync's own
// check) and gave up — and the later "now reachable" event didn't count as
// coming back online, so offline work sat until some other screen pushed
// it. Same test as runSync: connected, and not known to be unreachable.
function isOnlineState(state: NetInfoState): boolean {
  return state.isConnected === true && state.isInternetReachable !== false;
}

interface NetworkStatus {
  isOnline: boolean;
  connectionType: string | null;
  isInternetReachable: boolean | null;
}

export function useNetworkStatus(): NetworkStatus {
  const [status, setStatus] = useState<NetworkStatus>({
    isOnline: false,          // fail-safe: assume offline until NetInfo confirms
    connectionType: null,
    isInternetReachable: null,
  });

  // Track previous online state to detect false → true transition
  const prevOnlineRef = useRef<boolean | null>(null);

  useEffect(() => {
    // Get initial state (don't show toast on first mount)
    NetInfo.fetch().then((state: NetInfoState) => {
      const online = isOnlineState(state);
      prevOnlineRef.current = online;
      setStatus({
        isOnline: online,
        connectionType: state.type,
        isInternetReachable: state.isInternetReachable,
      });
    });

    // Subscribe to changes
    const unsubscribe = NetInfo.addEventListener((state: NetInfoState) => {
      const online = isOnlineState(state);
      const wasOffline = prevOnlineRef.current === false;

      setStatus({
        isOnline: online,
        connectionType: state.type,
        isInternetReachable: state.isInternetReachable,
      });

      // Reconnection detected → trigger sync + show toast
      if (wasOffline && online) {
        // The strip under the header (SyncStrip) already shows the
        // catch-up upload with real progress — no second pop-up on top of it.
        // Pass cached userId — avoids a Supabase auth round-trip on reconnect
        void runSync(getCachedUserId() ?? undefined);
      }

      prevOnlineRef.current = online;
    });

    return () => unsubscribe();
  }, []);

  return status;
}
