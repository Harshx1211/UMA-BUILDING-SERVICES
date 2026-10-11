import { useCallback, useEffect, useRef, useState } from 'react';
import Toast from 'react-native-toast-message';
import NetInfo from '@react-native-community/netinfo';
import { queueReportGeneration, pollReportStatus, getOrRefreshReportUrl } from '@/lib/pdfGenerator';
import { runSync, describeReportWait } from '@/lib/sync';
import { updateRecord } from '@/lib/database';

// Was 5s — with generation itself now down to seconds, a 5s poll could
// add up to 5s of pure waiting after the PDF was already done.
const POLL_MS = 2_500;
// How often to nudge the sync engine while a generation is in flight — see
// the nudgeRef comment below for why this exists.
const SYNC_NUDGE_MS = 20_000;

export type ReportGenStatus = 'idle' | 'generating' | 'completed' | 'failed';

/**
 * Single source of truth for "is this job's report being generated right
 * now", shared by every screen that shows a Generate/Regenerate button or a
 * live status (job detail, report summary, PDF preview). All of them poll
 * the same GET /report-status endpoint, so as long as each one uses this
 * hook they converge on the same state within one poll tick — previously
 * each screen had its own copy-pasted version of this logic and drifted out
 * of sync with each other (one screen's button never updated while another
 * screen showed the real progress).
 */
export function useReportGeneration(
  jobId: string | undefined,
  opts?: { hasExistingReport?: boolean; forceOnMount?: boolean },
) {
  const [status, setStatus] = useState<ReportGenStatus>('idle');
  const [elapsedS, setElapsedS] = useState(0);
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  // What the request is still waiting on before it leaves this device
  // (see describeReportWait) — null once it's been sent.
  const [waitingOn, setWaitingOn] = useState<string | null>(null);

  const startedAtMs  = useRef<number | null>(null);
  const pollRef      = useRef<ReturnType<typeof setInterval> | null>(null);
  const elapsedRef   = useRef<ReturnType<typeof setInterval> | null>(null);
  // FIX (report stuck "generating" far longer than necessary): the server
  // defers actually calling /generate-report until every one of this
  // technician's own pending edits for the job has reached Supabase (see
  // the report_generate blocker check in lib/sync.ts) — correct, since
  // generating straight from stale server data was the "notes I just typed
  // aren't in the PDF" bug. But nothing besides that ONE runSync() call
  // inside generate() below ever retries the push while this screen sits
  // open watching /report-status — the background sync interval is now a
  // 10-minute safety net (constants/Config.ts), not a fast loop. If the
  // edit's first push attempt happened to fail transiently, it can then sit
  // in its own 1-30min retry backoff with nobody nudging it sooner, so the
  // PDF a technician is actively watching for could be stuck deferring for
  // most of that window. Nudging runSync() periodically while a generation
  // is in flight keeps that catch-up fast for exactly the case where
  // someone is actually staring at this screen waiting.
  const nudgeRef     = useRef<ReturnType<typeof setInterval> | null>(null);
  const notifiedRef  = useRef(false);
  const isMounted    = useRef(true);
  // FIX (Generate instantly showing a PREVIOUS run's result — an old
  // "Generation Failed" error, or "marked complete but no file was found"):
  // generate() starts polling the moment it's tapped, but its actual request
  // only reaches the server once the sync queue pushes it, which takes a few
  // seconds. Until then /report-status still returns the last run's result,
  // and the poll used to stop on it — while the new report went on to
  // generate fine in the background. This holds which result was already
  // sitting there when Generate was tapped, so polling ignores exactly that:
  //   undefined — Generate just tapped, not known yet: ignore every
  //               completed/failed until the resume-check below answers
  //   string    — that previous result's updatedAt: ignore only that one
  //   null      — nothing to ignore (normal resume/view polling)
  const staleResultAt = useRef<string | null | undefined>(null);

  const stop = useCallback(() => {
    if (pollRef.current)    clearInterval(pollRef.current);
    if (elapsedRef.current) clearInterval(elapsedRef.current);
    if (nudgeRef.current)   clearInterval(nudgeRef.current);
  }, []);

  useEffect(() => {
    isMounted.current = true;
    return () => {
      isMounted.current = false;
      stop();
    };
  }, [stop]);

  const poll = useCallback((id: string, pollOpts?: { oneShot?: boolean }) => {
    stop();
    elapsedRef.current = setInterval(() => {
      if (isMounted.current && startedAtMs.current != null) {
        setElapsedS(Math.max(0, Math.round((Date.now() - startedAtMs.current) / 1000)));
      }
    }, 1000);
    // Cleared by the same stop() that fires on completed/failed/not_started
    // — see nudgeRef's own comment above for why this exists.
    nudgeRef.current = setInterval(() => { void runSync(); }, SYNC_NUDGE_MS);

    const check = async () => {
      if (!isMounted.current) return;
      setWaitingOn(describeReportWait(id));
      let result;
      try {
        result = await pollReportStatus(id);
      } catch (e) {
        if (__DEV__) console.warn('[useReportGeneration] poll failed, will retry:', e);
        return;
      }
      if (!isMounted.current) return;

      if (result.status === 'completed' || result.status === 'failed') {
        const stale = staleResultAt.current;
        if (stale === undefined) return;
        if (stale !== null && result.updatedAt === stale) return;
      }

      if (result.status === 'not_started') {
        // Nothing queued yet. On an initial resume-check this means the tech
        // hasn't tapped Generate — don't keep polling forever for a job that
        // may never be generated; generate() below starts a fresh interval
        // once they actually tap it.
        if (pollOpts?.oneShot) stop();
        return;
      }

      if (result.status === 'generating') {
        setStatus('generating');
        startedAtMs.current = result.startedAt
          ? new Date(result.startedAt).getTime()
          : (startedAtMs.current ?? Date.now());
        return;
      }

      if (result.status === 'completed') {
        stop();
        setWaitingOn(null);
        setStatus('completed');
        setPdfUrl(result.pdfUrl);
        const now = new Date().toISOString();
        updateRecord('jobs', id, { report_url: result.pdfUrl, updated_at: now });
        if (!notifiedRef.current) {
          notifiedRef.current = true;
          Toast.show({ type: 'success', text1: 'Report Ready', text2: 'Tap View Report to open it.' });
        }
        return;
      }

      if (result.status === 'failed') {
        stop();
        setWaitingOn(null);
        setStatus('failed');
        setError(result.error);
        if (!notifiedRef.current) {
          notifiedRef.current = true;
          Toast.show({ type: 'error', text1: 'Report Generation Failed', text2: result.error });
        }
      }
    };

    pollRef.current = setInterval(() => { void check(); }, POLL_MS);
    void check();
  }, [stop]);

  const generate = useCallback(async () => {
    if (!jobId) return;
    notifiedRef.current = false;
    setError(null);

    // FIX ("Try Again" looking frozen for 10-15s before anything happens):
    // this used to flip to 'generating' only after an awaited NetInfo check
    // AND a resume-check HTTP round trip to the report service (below) both
    // resolved — harmless when that service answers instantly, but exactly
    // the case where a technician taps "Try Again" is the case where that
    // same service was JUST slow or erroring, so the resume-check itself
    // could take many seconds before resolving (or timing out and falling
    // through). The screen kept showing the stale "Generation Failed" state
    // with the tap having produced no visible feedback at all until then.
    // Flipping to 'generating' and starting the poll loop immediately,
    // optimistically, means the tap always visibly does something the
    // instant it happens — the checks below still run in the background and
    // correct course (e.g. adopting a genuinely-already-in-flight
    // generation's real start time) but no longer gate the UI update.
    startedAtMs.current = Date.now();
    setElapsedS(0);
    setStatus('generating');
    staleResultAt.current = undefined;
    poll(jobId);

    // FIX (wrong "Queued — Waiting for Connection" toast while actually
    // online): this used to read `isOnline` from useNetworkStatus(), which
    // starts every mount at a hardcoded `false` "fail-safe" default and only
    // flips to the real value once NetInfo.fetch() resolves — a real native
    // bridge round trip. generate() is called from an effect that fires
    // essentially immediately on mount (forceOnMount, used by every
    // Generate/Regenerate button), which routinely won the race against that
    // fetch — so this almost always saw the stale `false` default regardless
    // of actual connectivity, telling a technician who was genuinely online
    // that their report was "waiting for connection." A fresh, awaited check
    // right here has no such race — it's the same isConnected/
    // isInternetReachable logic runSync() itself uses (lib/sync.ts), so this
    // toast now agrees with what actually determines whether the push goes
    // through.
    const netState = await NetInfo.fetch();
    const isOnline = netState.isConnected === true && netState.isInternetReachable !== false;

    // FIX: resume an already in-flight generation instead of always
    // re-queuing a new one. report_url is null both before ANY generation
    // and DURING one, so this hook previously had no way to tell those
    // apart — navigating away and back (or the app being killed/relaunched
    // mid-generation) always fired a brand new server-side generation for
    // every "Generate/Regenerate" button, contradicting the very "come back
    // later" messaging shown when the first one was queued.
    if (isOnline) {
      try {
        const existing = await pollReportStatus(jobId);
        // Whatever finished result is here now belongs to an EARLIER run —
        // this request hasn't even been queued yet. (No updatedAt = an older
        // server that doesn't send one: fall back to accepting it, as before.)
        staleResultAt.current =
          existing.status === 'completed' || existing.status === 'failed'
            ? existing.updatedAt ?? null
            : null;
        if (existing.status === 'generating') {
          // Genuinely already running (e.g. a previous attempt from
          // another screen/device) — correct the elapsed timer to its real
          // start time. Status/polling were already started optimistically
          // above, so there's nothing else to flip here.
          if (existing.startedAt) startedAtMs.current = new Date(existing.startedAt).getTime();
          Toast.show({
            type: 'info',
            text1: 'Already Generating',
            text2: "We'll let you know as soon as it's ready.",
          });
          return;
        }
        // REVERTED: this used to also adopt an already-'completed' status
        // instead of regenerating, meant for the multi-technician case where
        // a crew-mate already generated a CURRENT report on another device
        // before this device's own pull caught up. Real bug, wrong fix —
        // the server's /report-status has no timestamp, so there was no way
        // to tell "this existing report is still current" apart from "the
        // job has since been edited and this report is now stale." Since
        // `generate()` is the same function behind every explicit Generate/
        // Regenerate tap (not just the passive multi-device case), this
        // silently served a stale PDF after every real edit made following
        // the very first generation — status stays 'completed' forever once
        // set, so regeneration was effectively disabled from that point on
        // for the job's whole lifetime. Confirmed in the field: changing a
        // Pass to Not-Tested and adding a note after an earlier generation
        // never made it into the PDF. A stale compliance report is a much
        // worse failure than an occasional redundant duplicate generation,
        // so this reverts to the original guarantee — an explicit generate
        // request always produces a fresh report — until the server can
        // report a real generatedAt to compare against the job's last edit.
      } catch {
        // Status check itself failed for some other reason — fall through
        // and queue locally same as the offline path below.
      }
    }

    // Offline, or the status check failed: no baseline to compare against —
    // stop ignoring results rather than risk polling past a real one.
    if (staleResultAt.current === undefined) staleResultAt.current = null;

    // Status/elapsed timer/polling were already started optimistically at
    // the top of this function — this is the genuinely-fresh-generation
    // path, so there's nothing left to flip, just the actual queue+push.
    queueReportGeneration(jobId);
    runSync();
    // FIX: this always said "processing on our servers," even when offline
    // — misleading, since queueReportGeneration only writes to the local
    // sync queue and the request hasn't actually reached the server yet.
    // It could sit queued for as long as the technician stays offline with
    // nothing telling them that's what's happening. The poll loop below
    // tolerates being offline fine (pollReportStatus failing is already
    // handled as a transient, retried-every-5s error), so this only changes
    // what the technician is told, not the underlying mechanics.
    Toast.show(isOnline ? {
      type: 'info',
      text1: 'Generating Report',
      text2: "We'll let you know as soon as it's ready — you can keep working.",
    } : {
      type: 'info',
      text1: 'Queued — Waiting for Connection',
      text2: "This will start generating automatically once you're back online.",
    });
  }, [jobId, poll]);

  // FIX: "View Report" (job already has a report_url — that's the only
  // reason the button reads "View Report" rather than "Generate Report")
  // used to fall straight through to poll(), which hits the report-
  // generator service's GET /report-status (then hosted on Render) — a completely
  // unnecessary dependency for a PDF that has already been sitting safely
  // in Supabase Storage since it was generated. If that service happened to be
  // down (or just slow/unreachable), this poll failed every 5s forever
  // (caught and logged, never surfaced), leaving the screen stuck showing
  // "Fetching your existing report…" with no way out — a functional
  // regression entirely disconnected from whether the actual PDF was
  // available. getOrRefreshReportUrl() only ever talks to Supabase (reads
  // the locally-synced path/URL, re-signs it via supabase.storage if the
  // cached signed URL expired) — never the report-generator service — so
  // viewing an existing report no longer depends on the report service being up at
  // all. Exposed as its own callback (not just inline in the mount effect)
  // so the screen's error-state "Try Again" can retry THIS instead of
  // accidentally calling generate() — which would queue a whole new
  // server-side regeneration via the report service, exactly the dependency this is
  // trying to avoid when the technician only wanted to re-view a report
  // that's already sitting in Storage.
  const loadExisting = useCallback(async () => {
    if (!jobId) return;
    setError(null);
    try {
      const url = await getOrRefreshReportUrl(jobId);
      if (url) {
        setPdfUrl(url);
        setStatus('completed');
      } else {
        setStatus('failed');
        setError('This report could not be loaded — it may not have finished generating.');
      }
    } catch (e) {
      console.error('[useReportGeneration] getOrRefreshReportUrl failed:', e);
      setStatus('failed');
      setError('Could not load the report — check your connection and try again.');
    }
  }, [jobId]);

  // On mount: either always start a fresh generation (forceOnMount — used by
  // "Generate"/"Draft Preview"/"Regenerate", which all mean "make me a
  // current PDF"), or just resume-watch an already-in-flight one without
  // re-triggering (used when merely viewing an existing report). Without
  // forceOnMount, tapping "Regenerate" on a job that already has a completed
  // report would just re-show that same old result — the server's status
  // row still says 'completed' from last time, so a passive resume-check
  // never realizes a fresh run was actually being asked for.
  useEffect(() => {
    if (!jobId) return;
    if (opts?.forceOnMount) {
      generate();
      return;
    }
    if (opts?.hasExistingReport) {
      void loadExisting();
      return;
    }
    if (status === 'idle') poll(jobId, { oneShot: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [jobId, opts?.hasExistingReport, opts?.forceOnMount]);

  return { status, elapsedS, pdfUrl, error, waitingOn, generate, loadExisting, stopPolling: stop };
}
