import { PDFDocument } from 'pdf-lib';

/** Reads the page count of an already-rendered PDF buffer — the only reliable
 * way to know how many pages a section actually took after Chromium laid it
 * out, since that can't be predicted from the source HTML alone. */
export async function getPdfPageCount(buffer: Buffer): Promise<number> {
  const doc = await PDFDocument.load(buffer);
  return doc.getPageCount();
}
