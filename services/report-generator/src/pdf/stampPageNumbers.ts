import { PDFFont, PDFPage, PDFDocument, StandardFonts, rgb } from 'pdf-lib';

const ORANGE = rgb(0xea / 255, 0x58 / 255, 0x0c / 255);
const FONT_SIZE = 8;
const BASELINE_Y = 16;

// Running header (pages 2+): small grey caps above a hairline, inside the
// renderer's 0.6in top margin (render/chromium.ts), so it costs no space.
const HEADER_SIZE = 6.5;
const HEADER_MARGIN_X = 24; // the page's 32px side margin, in points
const HEADER_BASELINE_FROM_TOP = 25;
const HEADER_RULE_FROM_TOP = 31;
const MUTED = rgb(0x64 / 255, 0x74 / 255, 0x8b / 255);
const RULE = rgb(0xe2 / 255, 0xe8 / 255, 0xf0 / 255);

export interface RunningHeader {
  left: string;
  right: string;
}

/**
 * Text the built-in Helvetica can draw: upper-cased, with any character
 * outside its WinAnsi set reduced to its base letter or dropped (a property
 * name in another script would otherwise make pdf-lib throw and fail the
 * whole report), then shortened with an ellipsis to fit `maxWidth`.
 */
function fitText(text: string, font: PDFFont, supported: Set<number>, maxWidth: number): string {
  let out = [...text.toUpperCase()]
    .map((ch) => {
      if (supported.has(ch.codePointAt(0)!)) return ch;
      // An accented letter outside the set keeps its base letter (Ō -> O).
      const base = ch.normalize('NFD')[0];
      return base && supported.has(base.codePointAt(0)!) ? base : '';
    })
    .join('')
    .replace(/\s+/g, ' ')
    .trim();
  if (font.widthOfTextAtSize(out, HEADER_SIZE) <= maxWidth) return out;
  const ellipsis = supported.has(0x2026) ? '…' : '...';
  while (out.length > 1 && font.widthOfTextAtSize(out + ellipsis, HEADER_SIZE) > maxWidth) {
    out = out.slice(0, -1).trimEnd();
  }
  return out + ellipsis;
}

function drawRunningHeader(page: PDFPage, font: PDFFont, supported: Set<number>, header: RunningHeader): void {
  const { width, height } = page.getSize();
  const available = width - 2 * HEADER_MARGIN_X;
  const y = height - HEADER_BASELINE_FROM_TOP;
  const right = fitText(header.right, font, supported, available * 0.4);
  const rightWidth = font.widthOfTextAtSize(right, HEADER_SIZE);
  const left = fitText(header.left, font, supported, available - rightWidth - 16);
  if (left) page.drawText(left, { x: HEADER_MARGIN_X, y, size: HEADER_SIZE, font, color: MUTED });
  if (right) page.drawText(right, { x: width - HEADER_MARGIN_X - rightWidth, y, size: HEADER_SIZE, font, color: MUTED });
  page.drawLine({
    start: { x: HEADER_MARGIN_X, y: height - HEADER_RULE_FROM_TOP },
    end: { x: width - HEADER_MARGIN_X, y: height - HEADER_RULE_FROM_TOP },
    thickness: 0.75,
    color: RULE,
  });
}

/**
 * Draws the correct "Page X of Y" onto every page of the rendered report —
 * see headerFooter.ts for why Gotenberg's own native page-number templating
 * isn't used directly (the report needs two full render passes to get the
 * Index right — see generation/pipeline.ts — so the true total page count
 * isn't knowable until after the final pass finishes).
 */
export async function stampPageNumbers(merged: Buffer, runningHeader?: RunningHeader): Promise<Buffer> {
  const doc = await PDFDocument.load(merged);
  const font = await doc.embedFont(StandardFonts.HelveticaBold);
  const supported = new Set(font.getCharacterSet());
  const pages = doc.getPages();
  const total = pages.length;

  pages.forEach((page, i) => {
    const label = `Page ${i + 1} of ${total}`;
    const textWidth = font.widthOfTextAtSize(label, FONT_SIZE);
    const { width: pageWidth } = page.getSize();
    page.drawText(label, {
      x: (pageWidth - textWidth) / 2,
      y: BASELINE_Y,
      size: FONT_SIZE,
      font,
      color: ORANGE,
    });
    // Not on the cover, which carries the same details as its title.
    if (runningHeader && i > 0) drawRunningHeader(page, font, supported, runningHeader);
  });

  const bytes = await doc.save();
  return Buffer.from(bytes);
}
