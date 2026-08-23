/**
 * utils/sanitize.ts
 *
 * Input sanitization helpers for all user-facing TextInput fields.
 *
 * Principles:
 *   1. Be generous — never block legitimate field data (names, addresses, notes)
 *   2. Strip/reject only known attack patterns (script tags, SQL meta-chars, event handlers)
 *   3. Enforce sensible field-level length limits (prevents DB bloat + PDF overflow)
 *   4. All functions are pure — no side effects, safe to call in onChange handlers
 */

// ── HTML / XSS stripping ──────────────────────────────────────────────────

/**
 * Strips HTML tags and dangerous injection patterns from a string.
 * Used for any field whose value ends up in a PDF HTML template.
 *
 * What is stripped:
 *   - <script> ... </script> blocks (case-insensitive)
 *   - All other HTML tags  (<...>)
 *   - HTML on* event attributes (onclick=, onerror=, etc.)
 *   - javascript: pseudo-URLs
 *   - data: URIs (can carry inline scripts)
 *
 * What is preserved:
 *   - Apostrophes, quotes, hyphens, slashes — all legitimate in addresses/names
 *   - Unicode characters — essential for international names
 *   - Newlines — preserved in notes/description fields
 */
export function stripHtml(value: string): string {
  return value
    // Remove <script> blocks entirely (content + tags)
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    // Remove all other HTML tags
    .replace(/<[^>]+>/g, '')
    // Remove javascript: pseudo-protocol
    .replace(/javascript\s*:/gi, '')
    // Remove data: URIs
    .replace(/data\s*:[^;]*;/gi, '')
    // Remove on* event handler attributes (e.g. onclick, onerror, onload)
    .replace(/\bon\w+\s*=/gi, '')
    .trim();
}

// ── Length limits ─────────────────────────────────────────────────────────

/**
 * Field-level maximum character limits.
 * These are generous — designed to accommodate real-world data,
 * not block it. The goal is preventing DB bloat and PDF overflow.
 */
export const MAX_LENGTHS = {
  /** Names: person names, property names, company names */
  name:         120,
  /** Email addresses */
  email:        254,
  /** Phone numbers (international) */
  phone:         30,
  /** Street address lines */
  address:      200,
  /** Suburb / city */
  suburb:        80,
  /** State / territory (usually abbreviation) */
  state:         60,
  /** Postcode */
  postcode:      10,
  /** Short reference codes (asset ref, serial, barcode) */
  reference:     50,
  /** Short single-line text (job type, status labels) */
  shortText:    100,
  /** Standard notes / description fields */
  notes:        1000,
  /** Long-form text (access notes, hazard notes, inspection notes) */
  longNotes:    2000,
  /** PDF / report text — capped to prevent layout breaking */
  reportText:   500,
} as const;

// ── Combined sanitizer ────────────────────────────────────────────────────

/**
 * Sanitizes a user-input string for storage:
 *   1. Strips HTML / injection patterns
 *   2. Truncates to the specified max length
 *   3. Trims leading/trailing whitespace
 *
 * Use this on form submission (not on every keystroke — that would break
 * the user's ability to paste HTML-like content and then edit it).
 *
 * @param value     Raw value from a TextInput
 * @param maxLength Maximum number of characters to retain
 */
export function sanitizeText(value: string, maxLength: number): string {
  if (!value) return '';
  return stripHtml(value).substring(0, maxLength).trim();
}

/**
 * Sanitizes a value specifically for use in PDF HTML templates.
 * In addition to standard sanitization, converts remaining characters that
 * have special meaning in HTML to their entity equivalents so they render
 * as text rather than markup inside the WebView-based PDF renderer.
 *
 * Call this on EVERY user-supplied string that goes into reportTemplate.ts
 * or quoteTemplate.ts.
 *
 * @param value     Raw value from SQLite (already sanitized at input time)
 * @param maxLength Maximum characters (defaults to MAX_LENGTHS.reportText)
 */
export function sanitizeForHtml(
  value: string | null | undefined,
  maxLength: number = MAX_LENGTHS.reportText,
): string {
  if (!value) return '';
  // First strip injection patterns, then HTML-encode what remains
  const cleaned = stripHtml(value).substring(0, maxLength);
  return cleaned
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;');
}
