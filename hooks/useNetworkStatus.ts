// useNetworkStatus — wraps NetInfo to provide reactive online/offline state
// Phase 12: Tracks false→true transition to auto-trigger sync and show toast
import { useEffect, useRef, useState } from 'react';
import NetInfo, { NetInfoState } from '@react-native-community/netinfo';
import Toast from 'react-native-toast-message';
import { runSync } from '@/lib/sync';

interface NetworkStatus {
  isOnline: boolean;
  connectionType: string | null;
  isInternetReachable: boolean | null;
}

export function useNetworkStatus(): NetworkStatus {
  const [status, setStatus] = useState<NetworkStatus>({
    isOnline: true,
    connectionType: null,
    isInternetReachable: null,
  });

  // Track previous online state to detect false → true transition
  const prevOnlineRef = useRef<boolean | null>(null);

  useEffect(() => {
    // Get initial state (don't show toast on first mount)
    NetInfo.fetch().then((state: NetInfoState) => {
      const online = state.isConnected === true;
      prevOnlineRef.current = online;
      setStatus({
        isOnline: online,
        connectionType: state.type,
        isInternetReachable: state.isInternetReachable,
      });
    });

    // Subscribe to changes
    const unsubscribe = NetInfo.addEventListener((state: NetInfoState) => {
      const online = state.isConnected === true;
      const wasOffline = prevOnlineRef.current === false;

      setStatus({
        isOnline: online,
        connectionType: state.type,
        isInternetReachable: state.isInternetReachable,
      });

      // Reconnection detected → trigger sync + show toast
      if (wasOffline && online) {
        Toast.show({
          type: 'info',
          text1: '🌐 Back online',
          text2: 'Syncing your offline changes...',
          visibilityTime: 3000,
        });
        // Fire-and-forget background sync
        runSync().catch((err) => console.warn('[useNetworkStatus] sync on reconnect failed:', err));
      }

      prevOnlineRef.current = online;
    });

    return () => unsubscribe();
  }, []);

  return status;
}
