// Prices are never shown in the mobile app (owner's rule, 2026-10-15):
// quotes are the office's business and live in the admin portal only. The
// defect-code library's descriptions carry prices inline ("…replace Seal
// $135.00", "…investigation $85.00+GST p/hr"), so code text is cleaned here
// before a technician sees it. Same rules as the PDF report's stripPrices
// (services/report-generator/src/templates/helpers.ts) — keep the two in step.

const GST = String.raw`(?:\s*(?:\+\s*|plus\s+|inc\.?\s*|incl\.?\s*|ex\.?\s*|excl\.?\s*)GST)`;
const RATE = String.raw`(?:\s*(?:\/\s*h(?:r|our)?|p\/\s*h(?:r)?|per\s+hour|per\s+hr|an?\s+hour|ea|each)\b)`;
const NUM = String.raw`\d[\d,]*(?:\.\d{1,2})?`;
const MONEY = String.raw`(?:@?\s*(?:AUD\s?\$?|AU\$|A\$|\$)\s?${NUM}|${NUM}\s?(?:\$|AUD\b|dollars?\b))`;
const AMOUNT = String.raw`${MONEY}${GST}?${RATE}?${GST}?`;
const LEAD_IN = String.raw`(?:\b(?:at\s+(?:an?\s+)?(?:additional|extra)(?:\s+cost)?(?:\s+of)?|at\s+a\s+cost\s+of|costing|for)\s*)?`;
const COMPARED = new RegExp(String.raw`\b(exceeds?|over|above|under|below|up\s+to|more\s+than|less\s+than)\s+${AMOUNT}`, 'gi');
const PRICE = new RegExp(String.raw`\s*${LEAD_IN}${AMOUNT}`, 'gi');
const HAS_PRICE = /\$\s?\d|\d\s?\$|\bAUD\b|\d\s+dollars?\b/i;

export function stripPrices(text: string): string;
export function stripPrices(text: string | null | undefined): string | null | undefined;
export function stripPrices(text: string | null | undefined): string | null | undefined {
  if (!text || !HAS_PRICE.test(text)) return text;
  return text
    .replace(COMPARED, '$1 the agreed limit')
    .replace(PRICE, '')
    .replace(/[ \t]*[—–-][ \t]*(?=[.,;)]|$)/gm, '')
    .replace(/[ \t]*&[ \t]*(?=[.,;)]|$)/gm, '')
    .replace(/[ \t]*&[ \t]*\(/g, ' (')
    .replace(/\([ \t]*(?:add|plus)?[ \t]*\)/gi, '')
    .replace(/\([ \t]*(?:add|plus)[ \t]+for[ \t]+/gi, '(')
    .replace(/\([ \t]+/g, '(')
    .replace(/[ \t]+([.,;:)])/g, '$1')
    .replace(/([.,;:])(?=[.,;:])/g, '')
    .replace(/[ \t]{2,}/g, ' ')
    .replace(/[ \t]*[,;:][ \t]*$/gm, '')
    .replace(/[ \t]+$/gm, '')
    .trim();
}
