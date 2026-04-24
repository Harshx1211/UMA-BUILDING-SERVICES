/**
 * Shared safe-area top padding for screen headers.
 * Uses the actual status bar height on Android so headers never eat into
 * the status bar area. On iOS the root layout already accounts for the notch.
 */
import { Platform, StatusBar } from 'react-native';

/** Top padding for any custom screen header (not using a native NavigationBar). */
export const HEADER_TOP_PAD =
  Platform.OS === 'android' ? (StatusBar.currentHeight ?? 24) + 10 : 52;
