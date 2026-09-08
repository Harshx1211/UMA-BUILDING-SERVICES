/**
 * Opens a job's detail screen, always through the Jobs (Schedule) tab's own
 * list first.
 *
 * The Jobs tab is its own nested Stack (app/(app)/jobs/_layout.tsx), separate
 * from Home/Profile's stacks. Pushing straight to `/jobs/{id}` from outside
 * that stack — a Home dashboard card, a notification tap, a property's job
 * history row, a document's "Other visit" badge — puts the job detail screen
 * on top of an otherwise-empty Jobs-tab stack, with no jobs list underneath
 * it. The header back button still correctly falls through to wherever you
 * actually came from (e.g. Home), but switching to the Schedule tab
 * afterwards shows that same still-empty stack's only screen (the job) —
 * not the jobs list — with no way to reach the list at all. Seeding `/jobs`
 * first fixes that: the Schedule tab always has its list at the bottom of
 * its stack, so both back navigation and the Schedule tab itself behave the
 * way a user actually expects.
 *
 * FIX: `alreadyInJobsTab` opts out of that re-seed for a caller that's
 * structurally guaranteed to already be inside the Jobs tab's own stack
 * (currently only DocumentCard's "Other visit" badge, which only ever
 * renders from jobs/[id]/documents.tsx) — without it, tapping that badge
 * pushed a SECOND, redundant jobs-list screen on top of the job already
 * being viewed, so the back button from the new job landed on that
 * duplicate list instead of back on the documents screen the technician
 * actually came from.
 */
import { router } from 'expo-router';

export function openJob(jobId: string, opts?: { alreadyInJobsTab?: boolean }): void {
  if (!opts?.alreadyInJobsTab) {
    router.push('/jobs' as never);
  }
  router.push(`/jobs/${jobId}` as never);
}
