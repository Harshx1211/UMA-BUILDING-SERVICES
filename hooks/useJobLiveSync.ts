import { useCallback, useRef } from 'react';
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
  // FIX: iOS reliably fires 'inactive' BEFORE 'background' on the way out
  // (control center, a phone call, screen lock) and 'inactive' BEFORE
  // 'active' on the way back in — both previously treated as two
  // independent transitions, so one real lock/unlock cycle fired
  // unsubscribe TWICE going out and subscribe TWICE coming back.
  // subscribeToJobLive's refcount increments unconditionally before its
  // "channel already open" early-return, so the second subscribe call
  // (the 'active' one, right after 'inactive' already recreated the
  // channel) still bumps the count with no real second "wanting" caller
  // behind it — permanently inflating the refcount by 1 per cycle, since
  // this hook's own cleanup only ever decrements once. Tracking the last
  // ACTED-ON bucket and ignoring a same-bucket repeat (background-ish ->
  // background-ish, or foreground-ish -> foreground-ish) collapses each
  // real transition back down to exactly one subscribe/unsubscribe call.
  const lastActedBackgroundish = useRef(false);
  // FIX: the app-backgrounded unsubscribe and this effect's own cleanup
  // unsubscribe are two SEPARATE reasons to give back the same single
  // reference this hook acquired on focus — without tracking whether it's
  // still actually held, a screen unmounted while the app happens to be
  // backgrounded (already unsubscribed once for that) would unsubscribe a
  // SECOND time on cleanup, over-decrementing the shared refcount and
  // potentially closing another screen's still-legitimate reference to
  // the same job's channel.
  const holdsReference = useRef(false);

  useFocusEffect(
    useCallback(() => {
      if (!jobId) return;

      lastActedBackgroundish.current = false;
      subscribeToJobLive(jobId, onChange);
      holdsReference.current = true;

      // OS can freeze JS timers and kill the underlying socket outright while
      // backgrounded — the realtime client's own reconnect logic can't run
      // during that window since it depends on those same frozen timers, so
      // this explicitly tears the channel down on background and reopens it
      // on foreground (whose subscribe callback runs a catch-up pull).
      const appStateSub = AppState.addEventListener('change', (next: AppStateStatus) => {
        const backgroundish = next === 'background' || next === 'inactive';
        if (backgroundish === lastActedBackgroundish.current) return;
        lastActedBackgroundish.current = backgroundish;
        if (backgroundish) {
          unsubscribeFromJobLive();
          holdsReference.current = false;
        } else if (next === 'active') {
          subscribeToJobLive(jobId, onChange);
          holdsReference.current = true;
        }
      });

      return () => {
        appStateSub.remove();
        if (holdsReference.current) {
          unsubscribeFromJobLive();
          holdsReference.current = false;
        }
      };
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [jobId])
  );
}
