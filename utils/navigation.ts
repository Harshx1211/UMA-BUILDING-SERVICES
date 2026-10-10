/**
 * Opens a job (or a job-scoped sub-screen) always through the Jobs
 * (Schedule) tab's own list first.
 *
 * The Jobs tab is its own nested Stack (app/(app)/jobs/_layout.tsx), separate
 * from Home/Profile's stacks. Pushing straight to `/jobs/{id}` from outside
 * that stack — a Home dashboard card, a notification tap, a property's job
 * history row, a document's "Other visit" badge, the global Defects list —
 * puts the job detail screen on top of an otherwise-empty Jobs-tab stack,
 * with no jobs list underneath it. Seeding `/jobs` first fixes that: the
 * Schedule tab always has its list at the bottom of its stack, so both back
 * navigation and the Schedule tab itself behave the way a user expects.
 *
 * FIX (reported: "back from a job takes me to Home instead of Schedule"):
 * the two pushes below used to fire synchronously back-to-back. The first
 * one (`/jobs`) is a much heavier transition than a same-tab push when it's
 * issued from a DIFFERENT tab — it has to switch the active tab AND mount
 * that tab's stack, not just push a screen onto an already-focused one. If
 * the second push fired before that tab switch had actually committed,
 * React Navigation could resolve "where do I push this?" against the
 * previous state and land the job screen on the WRONG stack (e.g. still on
 * Home's), one level shallower than intended — which makes the header back
 * button, or the canGoBack()-is-false fallback, dead-end at Home instead of
 * the jobs list beneath it. Deferring the second push by a tick lets the
 * first navigation's state update fully commit before the next one fires —
 * the standard, low-risk fix for this exact "push twice across a tab
 * switch" race.
 *
 * `alreadyInJobsTab` opts out of both the reseed AND the deferred second
 * push for a caller that's structurally guaranteed to already be inside the
 * Jobs tab's own stack (currently only DocumentCard's "Other visit" badge,
 * which only ever renders from jobs/[id]/documents.tsx) — without it,
 * tapping that badge pushed a SECOND, redundant jobs-list screen on top of
 * the job already being viewed.
 */
import { router } from 'expo-router';

function seedJobsTabThenPush(finalPath: string, alreadyInJobsTab?: boolean): void {
  if (alreadyInJobsTab) {
    router.push(finalPath as never);
    return;
  }
  router.push('/jobs' as never);
  setTimeout(() => router.push(finalPath as never), 0);
}

export function openJob(jobId: string, opts?: { alreadyInJobsTab?: boolean }): void {
  seedJobsTabThenPush(`/jobs/${jobId}`, opts?.alreadyInJobsTab);
}

/** Same seeding, for deep-linking straight to a job-scoped sub-screen (e.g.
 * the global Defects list opening a specific job's specific defect). */
export function openJobRoute(path: string, opts?: { alreadyInJobsTab?: boolean }): void {
  seedJobsTabThenPush(path, opts?.alreadyInJobsTab);
}
