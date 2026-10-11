import { esc } from './helpers';
import { Company } from '../types';

/**
 * Gotenberg passes `headerTemplate`/`footerTemplate` straight through to
 * Chromium's native PDF header/footer support, which recognizes special
 * classes like `pageNumber`/`totalPages` and fills them in automatically —
 * but the report renders in two full passes (a placeholder Index, then the
 * real one, once its true page range is known — see generation/pipeline.ts),
 * and Chromium's own page-number in the FIRST pass would reflect that
 * draft's page count, not the final one. The page-number text is
 * deliberately left out here — pdf/stampPageNumbers.ts draws the correct
 * "Page X of Y" onto every page after the final pass, once the real total is
 * known. Font size must be set explicitly here — the browser default for
 * header/footer content is tiny. So must the font: left to the default, the
 * footer drew in a different font (DejaVu Sans on the server) that was
 * embedded in every report just for these two lines.
 */
export function buildFooterTemplate(company: Company): string {
  return `
    <div style="width:100%;font-family:Helvetica, Arial, sans-serif;font-size:8px;padding:0 32px;-webkit-print-color-adjust:exact">
      <div style="display:flex;justify-content:space-between;align-items:center;border-top:1px solid #E2E8F0;padding-top:7px;color:#64748B">
        <div>${[company.name ? esc(company.name) : '', company.abn ? `ABN ${esc(company.abn)}` : ''].filter(Boolean).join(' &middot; ')}</div>
        <div>${[company.phone ? esc(company.phone) : '', company.contact_email ? esc(company.contact_email) : ''].filter(Boolean).join(' &middot; ')}</div>
      </div>
    </div>`;
}

export const EMPTY_HEADER_TEMPLATE = '<div></div>';
