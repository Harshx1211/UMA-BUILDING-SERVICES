import { useCallback, useEffect, useRef, useState } from 'react';
import Toast from 'react-native-toast-message';
import { queueReportGeneration, pollReportStatus } from '@/lib/pdfGenerator';
import { runSync } from '@/lib/sync';
import { updateRecord } from '@/lib/database';

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
  opts?: { hasExistingReport?: boolean },
) {
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

  const generate = useCallback(() => {
    if (!jobId) return;
    notifiedRef.current = false;
    startedAtMs.current = Date.now();
    setError(null);
    setElapsedS(0);
    setStatus('generating');
    queueReportGeneration(jobId);
    runSync();
    Toast.show({
      type: 'info',
      text1: 'Generating Report',
      text2: "We'll let you know as soon as it's ready — you can keep working.",
    });
    poll(jobId);
  }, [jobId, poll]);

  // Resume-on-mount: if generation was already queued elsewhere (or from an
  // earlier session) pick it up without re-triggering a duplicate run. Skips
  // entirely once a report already exists — nothing to resume.
  useEffect(() => {
    if (!jobId || opts?.hasExistingReport) return;
    if (status === 'idle') poll(jobId, { oneShot: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [jobId, opts?.hasExistingReport]);

  return { status, elapsedS, pdfUrl, error, generate, stopPolling: stop };
}
