import { useCallback } from 'react';
import { useFocusEffect } from 'expo-router';
import { AppState, AppStateStatus } from 'react-native';
import { subscribeToJobLive, unsubscribeFromJobLive, JobLiveChangeTable } from '@/lib/sync';

/**
 * Keeps a job's Realtime channel open for as long as ANY of its screens is
 * focused, not just whichever one first opened it.
 *
 * subscribeToJobLive/unsubscribeFromJobLive track a single module-level
 * channel keyed by jobId, so every screen that calls this hook for the same
 * job independently subscribes on focus and tears down on blur. Since only
 * one screen in a stack is ever focused at a time, navigating between a
 * job's screens (checklist -> asset detail -> defects -> back) hands the
 * live channel off seamlessly instead of dropping it the moment you leave
 * whichever single screen used to own it — that gap (previously: any screen
 * other than the checklist list had no subscription at all, so a teammate's
 * change during, say, a Save Defect session on Asset Detail just never
 * arrived) is exactly what this fixes. Every (re)subscribe runs a catch-up
 * pull, so the brief handoff between two of this job's screens is covered
 * the same way an offline reconnect already is.
 */
export function useJobLiveSync(jobId: string | undefined, onChange: (table: JobLiveChangeTable) => void): void {
  useFocusEffect(
    useCallback(() => {
      if (!jobId) return;

      subscribeToJobLive(jobId, onChange);

      // OS can freeze JS timers and kill the underlying socket outright while
      // backgrounded — the realtime client's own reconnect logic can't run
      // during that window since it depends on those same frozen timers, so
      // this explicitly tears the channel down on background and reopens it
      // on foreground (whose subscribe callback runs a catch-up pull).
      const appStateSub = AppState.addEventListener('change', (next: AppStateStatus) => {
        if (next === 'background' || next === 'inactive') {
          unsubscribeFromJobLive();
        } else if (next === 'active') {
          subscribeToJobLive(jobId, onChange);
        }
      });

      return () => {
        appStateSub.remove();
        unsubscribeFromJobLive();
      };
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [jobId])
  );
}
