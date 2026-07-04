/**
 * lib/pdfConstants.ts
 *
 * Shared constants between pdfGenerator.ts and reportTemplate.ts.
 * Pulled into its own module because pdfGenerator.ts imports buildReportHtml
 * from reportTemplate.ts — if reportTemplate.ts tried to import FALLBACK_IMG
 * back from pdfGenerator.ts, that would be a circular import. Keeping shared
 * constants here avoids the cycle entirely.
 */

/** 1x1 transparent PNG used whenever a photo fails to download or encode. */
export const FALLBACK_IMG =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=';
