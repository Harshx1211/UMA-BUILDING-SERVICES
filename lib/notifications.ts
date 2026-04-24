/**
 * SiteTrack — Daily Summary Notification Scheduler
 * Schedules a local "Job summary" notification at 6:00 PM each day.
 * Requires expo-notifications (already installed).
 * Only schedules if the user has granted permission.
 */
import * as Notifications from 'expo-notifications';

// ─── Permission request ───────────────────────
export async function requestNotificationPermission(): Promise<boolean> {
  const { status } = await Notifications.requestPermissionsAsync({
    ios: { allowAlert: true, allowBadge: true, allowSound: true },
  });
  return status === 'granted';
}

// ─── Schedule daily 6 PM summary ─────────────
export async function scheduleDailySummaryNotification(
  jobCount: number,
  pendingCount: number
): Promise<void> {
  try {
    const { status } = await Notifications.getPermissionsAsync();
    if (status !== 'granted') return;

    // Cancel existing daily summary notification first
    await cancelDailySummaryNotification();

    if (jobCount === 0) return; // Nothing to notify about

    const content: Notifications.NotificationContentInput = {
      title: '📋 SiteTrack Daily Summary',
      body: jobCount === 1
        ? `You have 1 job scheduled today.${pendingCount > 0 ? ` ${pendingCount} change${pendingCount > 1 ? 's' : ''} pending sync.` : ' All synced ✓'}`
        : `You have ${jobCount} jobs scheduled today.${pendingCount > 0 ? ` ${pendingCount} unsynced change${pendingCount > 1 ? 's' : ''}.` : ' All synced ✓'}`,
      data: { type: 'daily_summary' },
      sound: 'default',
    };

    const trigger: Notifications.DailyTriggerInput = {
      type: Notifications.SchedulableTriggerInputTypes.DAILY,
      hour: 18,
      minute: 0,
    };

    await Notifications.scheduleNotificationAsync({ content, trigger });
    if (__DEV__) console.log('[SiteTrack Notifications] Daily summary scheduled for 18:00');
  } catch (err) {
    console.warn('[SiteTrack Notifications] scheduleDailySummaryNotification error:', err);
  }
}

// ─── Cancel daily summary ────────────────────
export async function cancelDailySummaryNotification(): Promise<void> {
  try {
    const scheduled = await Notifications.getAllScheduledNotificationsAsync();
    const daily = scheduled.filter(n => n.content.data?.type === 'daily_summary');
    await Promise.all(daily.map(n => Notifications.cancelScheduledNotificationAsync(n.identifier)));
  } catch (err) {
    console.warn('[SiteTrack Notifications] cancelDailySummaryNotification error:', err);
  }
}

// ─── Job reminder 30 min before ──────────────
export async function scheduleJobReminder(
  jobId: string,
  propertyName: string,
  scheduledDate: string,
  scheduledTime: string | null
): Promise<void> {
  try {
    if (!scheduledTime) return;
    const { status } = await Notifications.getPermissionsAsync();
    if (status !== 'granted') return;

    const [year, month, day] = scheduledDate.split('-').map(Number);
    const [hour, minute]     = scheduledTime.split(':').map(Number);
    const jobDt       = new Date(year, month - 1, day, hour, minute, 0);
    const reminderDt  = new Date(jobDt.getTime() - 30 * 60 * 1000);

    if (reminderDt < new Date()) return;

    // Cancel old reminder for this job
    const scheduled = await Notifications.getAllScheduledNotificationsAsync();
    const old = scheduled.filter(n => n.content.data?.jobId === jobId && n.content.data?.type === 'job_reminder');
    await Promise.all(old.map(n => Notifications.cancelScheduledNotificationAsync(n.identifier)));

    await Notifications.scheduleNotificationAsync({
      content: {
        title: '🔔 Job Starting Soon',
        body:  `${propertyName || 'Your next job'} starts in 30 minutes.`,
        data:  { jobId, type: 'job_reminder' },
        sound: 'default',
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DATE,
        date: reminderDt,
      },
    });
    if (__DEV__) console.log(`[SiteTrack Notifications] Reminder scheduled for ${jobId}`);
  } catch (err) {
    console.warn('[SiteTrack Notifications] scheduleJobReminder error:', err);
  }
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
