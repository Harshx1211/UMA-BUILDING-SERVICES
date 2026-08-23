/**
 * lib/notifications.ts
 *
 * Local push-notification permission + display setup (expo-notifications).
 * This app only ever shows notifications the OS itself generates from local
 * scheduling — there's no remote/push server involved. Only two things are
 * actually wired up app-wide: requesting permission once, and telling the OS
 * how a notification should present itself while the app is foregrounded.
 */
import * as Notifications from 'expo-notifications';

// ─── Permission request ───────────────────────
export async function requestNotificationPermission(): Promise<boolean> {
  const { status } = await Notifications.requestPermissionsAsync({
    ios: { allowAlert: true, allowBadge: true, allowSound: true },
  });
  return status === 'granted';
}

// ─── Notification handler setup ───────────────
export function configureNotificationHandler(): void {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowAlert: true,
      shouldPlaySound: true,
      shouldSetBadge: true,
      shouldShowBanner: true,
      shouldShowList: true,
    }),
  });
}
