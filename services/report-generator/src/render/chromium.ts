import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import puppeteer, { Browser } from 'puppeteer-core';
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
async function launchBrowser(): Promise<Browser> {
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
    ],
  });
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
export async function convertHtmlToPdf(html: string, label: string, opts: ConvertOptions = {}): Promise<Buffer> {
  return withRetries(`convert(${label})`, config.chunkRetryAttempts, async () => {
    const dir = await mkdtemp(path.join(tmpdir(), 'report-render-'));
    let browser: Browser | null = null;
    try {
      const htmlPath = path.join(dir, 'index.html');
      await writeFile(htmlPath, html, 'utf8');

      browser = await launchBrowser();
      const page = await browser.newPage();
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
        displayHeaderFooter: hasHeaderFooter,
        headerTemplate: opts.headerTemplateHtml ?? '<div></div>',
        footerTemplate: opts.footerTemplateHtml ?? '<div></div>',
        timeout: config.renderTimeoutMs,
      });
      return Buffer.from(pdf);
    } finally {
      if (browser) await browser.close().catch(() => {});
      await rm(dir, { recursive: true, force: true }).catch(() => {});
    }
  });
}
