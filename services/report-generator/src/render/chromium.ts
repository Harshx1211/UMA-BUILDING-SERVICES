import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import puppeteer, { Browser, Page } from 'puppeteer-core';
import { config } from '../config';

export class RenderError extends Error {}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

const RETRY_BASE_DELAY_MS = 4_000;

async function withRetries<T>(label: string, attempts: number, fn: () => Promise<T>): Promise<T> {
  let lastErr: unknown;
  for (let attempt = 1; attempt <= attempts; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastErr = err;
      // eslint-disable-next-line no-console
      console.warn(`[chromium] ${label} failed (attempt ${attempt}/${attempts}): ${err instanceof Error ? err.message : err}`);
      if (attempt < attempts) await sleep(RETRY_BASE_DELAY_MS * attempt);
    }
  }
  throw new RenderError(`${label} failed after ${attempts} attempt(s): ${lastErr instanceof Error ? lastErr.message : lastErr}`);
}

/**
 * A fresh browser per conversion rather than one long-lived instance: a
 * report is rare (tens per month) and huge (up to ~1200 assets rendered as
 * one document), so the ~1s launch cost is nothing next to the guarantee
 * that every render starts from a clean process and all of Chromium's memory
 * is handed back the moment it finishes — which matters on a scale-to-zero
 * instance sized for exactly one big report at a time.
 */
export async function launchBrowser(): Promise<Browser> {
  return puppeteer.launch({
    executablePath: config.chromiumPath,
    headless: true,
    args: [
      // Cloud Run already sandboxes the container (gVisor); Chromium's own
      // sandbox needs kernel features that aren't available there.
      '--no-sandbox',
      '--disable-setuid-sandbox',
      // /dev/shm is small in containers — let Chromium use /tmp instead of
      // crashing mid-render on a large document.
      '--disable-dev-shm-usage',
      '--disable-gpu',
      '--disable-extensions',
      '--hide-scrollbars',
      '--mute-audio',
      // PERF: nothing here ever needs a profile, updates, sync or network
      // services of its own — skip that start-up work. --no-zygote drops the
      // extra pre-fork helper process (only valid with --no-sandbox, above).
      '--no-first-run',
      '--no-zygote',
      '--disable-background-networking',
      '--disable-component-update',
      '--disable-default-apps',
      '--disable-sync',
    ],
  });
}

// ── Spare browser ───────────────────────────────────────────────────────
// PERF: launching Chromium was the slowest single step of a report on Cloud
// Run (~3.5s of an ~8s report, measured), so one is launched AHEAD of the
// next report — while /prepare warms a job's photos, and after each report
// finishes — and the next report takes it ready-made. Each
// browser still renders exactly ONE report and is then closed, so the
// "clean process, all memory handed back" guarantee above still holds; the
// only cost is one idle Chromium (no pages, well under 100MB) on the instance.
let spare: Promise<Browser | undefined> | null = null;

/**
 * Makes sure a spare browser is launched or launching. Resolves when it's
 * ready (or its launch failed). Never rejects. Callers await it inside a
 * request that's still open, so Cloud Run keeps the CPU allocated while
 * Chromium starts.
 */
export function prepareSpareBrowser(): Promise<void> {
  if (!spare) {
    const launching: Promise<Browser | undefined> = launchBrowser().catch((err) => {
      // eslint-disable-next-line no-console
      console.warn(`[chromium] spare browser launch failed: ${err instanceof Error ? err.message : err}`);
      if (spare === launching) spare = null;
      return undefined;
    });
    spare = launching;
  }
  return spare.then(() => undefined);
}

/**
 * The spare browser (waiting for it if it's still launching), otherwise a
 * fresh launch. The caller owns it and must close it. Never rejects —
 * undefined means the launch failed, and each render pass then launches its
 * own (see convertHtmlToPdf).
 */
export async function takeBrowser(): Promise<Browser | undefined> {
  const pending = spare;
  spare = null;
  const ready = pending ? await pending : undefined;
  if (ready?.connected) return ready;
  if (ready) await ready.close().catch(() => {});
  return launchBrowser().catch(() => undefined);
}

/** Closes the spare, if any (shutdown). */
export async function closeSpareBrowser(): Promise<void> {
  const pending = spare;
  spare = null;
  const ready = pending ? await pending : undefined;
  await ready?.close().catch(() => {});
}

export interface ConvertOptions {
  headerTemplateHtml?: string;
  footerTemplateHtml?: string;
}

/**
 * Renders one HTML document to a PDF buffer with headless Chromium —
 * replaces the old Gotenberg service, which was itself just Chromium behind
 * an HTTP API. Every page setting below is copied 1:1 from the old Gotenberg
 * form fields so output stays identical: A4 (8.27x11.69in), zero side
 * margins, backgrounds printed, native Chromium header/footer templates.
 *
 * The HTML is written to a temp file and opened via file:// (exactly what
 * Gotenberg did with its uploaded index.html) instead of page.setContent():
 * a large site's document carries thousands of inline base64 photos and can
 * run to tens of MB, which is far happier as a file load than pushed through
 * the DevTools protocol as one string.
 *
 * Retries per config.chunkRetryAttempts on transient failure — never
 * silently drops content; if every attempt fails, this throws and the whole
 * report generation aborts with a clear error (see generation/pipeline.ts).
 */
export async function convertHtmlToPdf(
  html: string,
  label: string,
  opts: ConvertOptions = {},
  // PERF: a browser to render in, shared across the pipeline's two passes —
  // each launch costs seconds inside Cloud Run's sandbox, and paying it once
  // per report instead of once per pass is the cheap half of that. Still
  // fresh per REPORT (see launchBrowser's comment). A retry after a failure
  // never trusts the shared one again — it launches its own clean browser.
  sharedBrowser?: Browser,
): Promise<Buffer> {
  let attempt = 0;
  return withRetries(`convert(${label})`, config.chunkRetryAttempts, async () => {
    attempt++;
    const dir = await mkdtemp(path.join(tmpdir(), 'report-render-'));
    const useShared = attempt === 1 && !!sharedBrowser && sharedBrowser.connected;
    let browser: Browser | null = null;
    let page: Page | null = null;
    try {
      const htmlPath = path.join(dir, 'index.html');
      await writeFile(htmlPath, html, 'utf8');

      browser = useShared ? sharedBrowser! : await launchBrowser();
      page = await browser.newPage();
      page.setDefaultTimeout(config.renderTimeoutMs);
      await page.emulateMediaType('print');
      // 'load' waits for every <img> — inline photos plus the few remote
      // ones (company logo, signatures) — before printing.
      await page.goto(pathToFileURL(htmlPath).href, { waitUntil: 'load', timeout: config.renderTimeoutMs });

      const hasHeaderFooter = !!(opts.headerTemplateHtml || opts.footerTemplateHtml);
      const pdf = await page.pdf({
        width: '8.27in',
        height: '11.69in',
        margin: {
          top: opts.headerTemplateHtml ? '0.6in' : '0.15in',
          // 0.75in, not 0.6 — leaves room between content and the footer
          // band / the "Page X of Y" stamp (see stampPageNumbers.ts).
          bottom: opts.footerTemplateHtml ? '0.75in' : '0.15in',
          left: '0in',
          right: '0in',
        },
        printBackground: true,
        // SIZE: Chromium tags the PDF for screen readers by default — a
        // structure element for every text run (1,243 objects on a 16-page
        // report) plus a marked-content wrapper around each run in every
        // page's drawing stream. Measured as the largest single block of
        // the file; nothing visible depends on it.
        tagged: false,
        displayHeaderFooter: hasHeaderFooter,
        headerTemplate: opts.headerTemplateHtml ?? '<div></div>',
        footerTemplate: opts.footerTemplateHtml ?? '<div></div>',
        timeout: config.renderTimeoutMs,
      });
      return Buffer.from(pdf);
    } finally {
      // A shared browser belongs to the caller — only close our own page.
      if (useShared) await page?.close().catch(() => {});
      else if (browser) await browser.close().catch(() => {});
      await rm(dir, { recursive: true, force: true }).catch(() => {});
    }
  });
}
