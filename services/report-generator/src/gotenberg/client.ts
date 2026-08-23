import { config } from '../config';

export class GotenbergError extends Error {}

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
      console.warn(`[gotenberg] ${label} failed (attempt ${attempt}/${attempts}): ${err instanceof Error ? err.message : err}`);
      // Previously retried with zero delay — back-to-back attempts land within
      // milliseconds of each other, which is useless against a Render free-tier
      // cold start (the container can take 30-60s+ to actually start listening,
      // during which every request just hits Render's own 502 page). A short
      // backoff at least gives a marginal cold-boot time to catch up; the real
      // fix for that specific case is waitForGotenbergReady() below, called
      // once up front before any conversion work starts.
      if (attempt < attempts) await sleep(RETRY_BASE_DELAY_MS * attempt);
    }
  }
  throw new GotenbergError(`${label} failed after ${attempts} attempt(s): ${lastErr instanceof Error ? lastErr.message : lastErr}`);
}

const WARMUP_MAX_WAIT_MS = 90_000;
const WARMUP_POLL_INTERVAL_MS = 3_000;

/**
 * Blocks (with a patient, dedicated retry loop) until Gotenberg responds to
 * its health check, or gives up after WARMUP_MAX_WAIT_MS.
 *
 * Render's free tier spins a web service down after ~15 minutes with no
 * inbound traffic. Gotenberg only gets hit when a report is actually being
 * generated, so on the first generation after a quiet spell it's routinely
 * cold — and the *first* request to a cold Render service gets a 502 from
 * Render's own proxy (not from Gotenberg, which hasn't even started yet),
 * confirmed by the "no logs for the past hour" on the Gotenberg service
 * itself: the container genuinely wasn't running yet when that request hit.
 * Call this once, up front, before any real conversion work — ideally
 * concurrently with the data fetch, so the cold-boot wait overlaps work
 * that's happening anyway instead of adding pure dead time.
 */
export async function waitForGotenbergReady(maxWaitMs = WARMUP_MAX_WAIT_MS): Promise<void> {
  const deadline = Date.now() + maxWaitMs;
  let lastErr: unknown;
  while (Date.now() < deadline) {
    try {
      const res = await fetch(`${config.gotenbergUrl}/health`, { method: 'GET' });
      if (res.ok) return;
      lastErr = new Error(`HTTP ${res.status}`);
    } catch (err) {
      lastErr = err;
    }
    await sleep(WARMUP_POLL_INTERVAL_MS);
  }
  throw new GotenbergError(
    `Gotenberg did not become ready within ${maxWaitMs}ms: ${lastErr instanceof Error ? lastErr.message : lastErr}`,
  );
}

async function postForm(path: string, form: FormData): Promise<Buffer> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), config.gotenbergTimeoutMs);
  try {
    const res = await fetch(`${config.gotenbergUrl}${path}`, {
      method: 'POST',
      body: form,
      signal: controller.signal,
    });
    if (!res.ok) {
      const text = await res.text().catch(() => '');
      throw new Error(`HTTP ${res.status} from ${path}: ${text.slice(0, 500)}`);
    }
    const arrayBuf = await res.arrayBuffer();
    return Buffer.from(arrayBuf);
  } finally {
    clearTimeout(timer);
  }
}

export interface ConvertOptions {
  headerTemplateHtml?: string;
  footerTemplateHtml?: string;
}

/**
 * Renders one HTML document to a PDF buffer via Gotenberg's Chromium module.
 * Retries per config.chunkRetryAttempts on transient failure (timeout, 5xx) —
 * never silently drops a chunk; if every attempt fails, this throws and the
 * whole report generation aborts with a clear error (see generation/pipeline.ts).
 */
export async function convertHtmlToPdf(html: string, label: string, opts: ConvertOptions = {}): Promise<Buffer> {
  return withRetries(`convert(${label})`, config.chunkRetryAttempts, async () => {
    const form = new FormData();
    form.append('files', new Blob([html], { type: 'text/html' }), 'index.html');
    if (opts.headerTemplateHtml) {
      form.append('files', new Blob([opts.headerTemplateHtml], { type: 'text/html' }), 'header.html');
    }
    if (opts.footerTemplateHtml) {
      form.append('files', new Blob([opts.footerTemplateHtml], { type: 'text/html' }), 'footer.html');
    }
    form.append('paperWidth', '8.27');
    form.append('paperHeight', '11.69');
    form.append('marginTop', opts.headerTemplateHtml ? '0.6' : '0.15');
    form.append('marginBottom', opts.footerTemplateHtml ? '0.6' : '0.15');
    form.append('marginLeft', '0');
    form.append('marginRight', '0');
    form.append('printBackground', 'true');
    return postForm('/forms/chromium/convert/html', form);
  });
}

/**
 * Merges an ordered list of PDF buffers into one file via Gotenberg's PDF
 * Engines module. Gotenberg merges files in the lexical order of their
 * filenames, so callers must pass already-zero-padded, correctly-ordered names
 * (e.g. "00_cover.pdf", "01_chunk.pdf", ...).
 */
export async function mergePdfs(files: Array<{ name: string; buffer: Buffer }>): Promise<Buffer> {
  return withRetries('merge', config.chunkRetryAttempts, async () => {
    const form = new FormData();
    for (const f of files) {
      // Buffer's ArrayBufferLike type includes SharedArrayBuffer, which BlobPart
      // rejects — copy into a plain Uint8Array (backed by a real ArrayBuffer) first.
      const bytes = Uint8Array.from(f.buffer);
      form.append('files', new Blob([bytes], { type: 'application/pdf' }), f.name);
    }
    return postForm('/forms/pdfengines/merge', form);
  });
}
