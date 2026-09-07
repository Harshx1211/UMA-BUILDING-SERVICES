import { useCallback, useEffect, useRef, useState } from 'react';
import Toast from 'react-native-toast-message';
import { queueReportGeneration, pollReportStatus } from '@/lib/pdfGenerator';
import { runSync } from '@/lib/sync';
import { updateRecord } from '@/lib/database';
import { useNetworkStatus } from '@/hooks/useNetworkStatus';

const POLL_MS = 5_000;

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
  const { isOnline } = useNetworkStatus();
  const [status, setStatus] = useState<ReportGenStatus>('idle');
  const [elapsedS, setElapsedS] = useState(0);
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const startedAtMs  = useRef<number | null>(null);
  const pollRef      = useRef<ReturnType<typeof setInterval> | null>(null);
  const elapsedRef   = useRef<ReturnType<typeof setInterval> | null>(null);
  const notifiedRef  = useRef(false);
  const isMounted    = useRef(true);

  const stop = useCallback(() => {
    if (pollRef.current)    clearInterval(pollRef.current);
    if (elapsedRef.current) clearInterval(elapsedRef.current);
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

    const check = async () => {
      if (!isMounted.current) return;
      let result;
      try {
        result = await pollReportStatus(id);
      } catch (e) {
        if (__DEV__) console.warn('[useReportGeneration] poll failed, will retry:', e);
        return;
      }
      if (!isMounted.current) return;

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
        if (existing.status === 'generating') {
          startedAtMs.current = existing.startedAt ? new Date(existing.startedAt).getTime() : Date.now();
          setElapsedS(0);
          setStatus('generating');
          Toast.show({
            type: 'info',
            text1: 'Already Generating',
            text2: "We'll let you know as soon as it's ready.",
          });
          poll(jobId);
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

    startedAtMs.current = Date.now();
    setElapsedS(0);
    setStatus('generating');
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
    poll(jobId);
  }, [jobId, poll, isOnline]);

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
    if (opts?.hasExistingReport) return;
    if (status === 'idle') poll(jobId, { oneShot: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [jobId, opts?.hasExistingReport, opts?.forceOnMount]);

  return { status, elapsedS, pdfUrl, error, generate, stopPolling: stop };
}
