import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';

const ORANGE = rgb(0xe9 / 255, 0x73 / 255, 0x16 / 255);
const FONT_SIZE = 8;
const BASELINE_Y = 16;

/**
 * Draws the correct "Page X of Y" onto every page of the already-merged
 * report — see headerFooter.ts for why Gotenberg's own per-section page
 * counter can't be trusted here (each section is rendered as its own PDF
 * before merging, so it has no idea what its real position in the final
 * document is). This runs after mergePdfs(), where the true total page
 * count is finally knowable.
 */
export async function stampPageNumbers(merged: Buffer): Promise<Buffer> {
  const doc = await PDFDocument.load(merged);
  const font = await doc.embedFont(StandardFonts.HelveticaBold);
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
  });

  const bytes = await doc.save();
  return Buffer.from(bytes);
}
