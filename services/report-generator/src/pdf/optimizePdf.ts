import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { mkdtemp, readFile, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

const execFileAsync = promisify(execFile);

/**
 * Rebuilds the final merged PDF through Ghostscript, purely to shrink it.
 *
 * Why this exists: the report is assembled from many SEPARATELY rendered
 * Chromium documents (cover, each asset-log chunk, each tail section — see
 * generation/pipeline.ts's own comment on why), then merged with a plain
 * byte-level concatenation (Gotenberg's /forms/pdfengines/merge). Nothing
 * about that merge deduplicates shared resources across the inputs — and it
 * turns out every one of those ~10-15 separate documents independently
 * embeds its own font subset, because the CSS's `Helvetica, Arial,
 * sans-serif` stack resolves to a REAL, embeddable substitute font on
 * whatever Linux base image Gotenberg's Chromium runs on (Docker images
 * essentially never ship the actual proprietary Helvetica/Arial), so it
 * can't take Chromium's no-embedding standard-font shortcut. Measured on a
 * real 11-asset/14-page report: 57 separate embedded font objects, 381KB —
 * 61% of the entire file, dwarfing the actual photos (106KB).
 *
 * Ghostscript's pdfwrite device fully reconstructs a PDF from scratch,
 * which deduplicates identical resources (fonts, and — as a free bonus —
 * -dDetectDuplicateImages catches any photo embedded more than once, e.g.
 * a repaired defect's photo currently shown in both the Asset Log and the
 * Repairs section) as an inherent part of how it rebuilds the file. This
 * runs as a self-contained post-process on the already-finished PDF, so it
 * needs no change to the render/merge architecture that the page-accurate
 * Table of Contents actually depends on.
 *
 * Fails open: if ghostscript isn't installed or the pass fails for any
 * reason, this returns the ORIGINAL buffer unchanged and logs a warning —
 * a bigger-than-ideal report is a much smaller problem than a report that
 * fails to generate at all.
 */
export async function optimizePdf(input: Buffer): Promise<Buffer> {
  let dir: string | null = null;
  try {
    dir = await mkdtemp(path.join(tmpdir(), 'report-optimize-'));
    const inPath = path.join(dir, 'in.pdf');
    const outPath = path.join(dir, 'out.pdf');
    await writeFile(inPath, input);

    await execFileAsync('gs', [
      '-sDEVICE=pdfwrite',
      '-dCompatibilityLevel=1.4',
      '-dNOPAUSE',
      '-dBATCH',
      '-dQUIET',
      '-dDetectDuplicateImages=true',
      '-dPDFSETTINGS=/printer',
      `-sOutputFile=${outPath}`,
      inPath,
    ]);

    const optimized = await readFile(outPath);
    // Sanity check — a Ghostscript pass that somehow produced something
    // LARGER or empty is a sign something went wrong, not an improvement.
    if (optimized.length === 0 || optimized.length >= input.length) {
      return input;
    }
    return optimized;
  } catch (err) {
    console.warn('[optimizePdf] Ghostscript pass failed, using unoptimized PDF:', err instanceof Error ? err.message : err);
    return input;
  } finally {
    if (dir) await rm(dir, { recursive: true, force: true }).catch(() => {});
  }
}
