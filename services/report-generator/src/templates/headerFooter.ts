import { esc } from './helpers';
import { Company } from '../types';

/**
 * Gotenberg passes `headerTemplate`/`footerTemplate` straight through to
 * Chromium's native PDF header/footer support, which recognizes these special
 * classes and fills them in automatically: `pageNumber`, `totalPages`, `date`,
 * `title`, `url`. Font size must be set explicitly here — the browser default
 * for header/footer content is tiny.
 */
export function buildFooterTemplate(company: Company): string {
  return `
    <div style="width:100%;font-size:8px;padding:0 32px;display:flex;justify-content:space-between;align-items:center;color:#94A3B8;-webkit-print-color-adjust:exact">
      <div>${esc(company.name ?? '')}${company.abn ? ` &middot; ABN: ${esc(company.abn)}` : ''}</div>
      <div style="font-weight:700;color:#E97316">Page <span class="pageNumber"></span> of <span class="totalPages"></span></div>
      <div>${esc(company.phone ?? '')}${company.contact_email ? ` &middot; ${esc(company.contact_email)}` : ''}</div>
    </div>`;
}

export const EMPTY_HEADER_TEMPLATE = '<div></div>';
