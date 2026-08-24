import { esc } from './helpers';
import { Company } from '../types';

/**
 * Gotenberg passes `headerTemplate`/`footerTemplate` straight through to
 * Chromium's native PDF header/footer support, which recognizes special
 * classes like `pageNumber`/`totalPages` and fills them in automatically —
 * but only relative to that ONE conversion call. This pipeline renders every
 * section (cover, each asset category, each tail section) as its own
 * separate PDF and merges them afterward, so Chromium's own page-number
 * would read "Page 1 of 1" (or "1 of 2"/"2 of 2") on every section instead
 * of the report's true page position. The page-number text is deliberately
 * left out here — pdf/stampPageNumbers.ts draws the correct global "Page X
 * of Y" onto every page after merging, once the real total is known. Font
 * size must be set explicitly here — the browser default for header/footer
 * content is tiny.
 */
export function buildFooterTemplate(company: Company): string {
  return `
    <div style="width:100%;font-size:8px;padding:0 32px;display:flex;justify-content:space-between;align-items:center;color:#94A3B8;-webkit-print-color-adjust:exact">
      <div>${esc(company.name ?? '')}${company.abn ? ` &middot; ABN: ${esc(company.abn)}` : ''}</div>
      <div>${esc(company.phone ?? '')}${company.contact_email ? ` &middot; ${esc(company.contact_email)}` : ''}</div>
    </div>`;
}

export const EMPTY_HEADER_TEMPLATE = '<div></div>';
