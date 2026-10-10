// End-to-end render test with synthetic data — no Supabase needed.
// Runs the REAL pipeline render step (both Chromium passes, marker scan,
// page stamping, Ghostscript) and writes the PDF to test-output/.
//
//   npm run render-test -- 1200
//
// Needs CHROMIUM_PATH pointing at a local Chrome when run outside Docker.
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

process.env.SUPABASE_URL ??= 'http://localhost.invalid';
process.env.SUPABASE_SERVICE_ROLE_KEY ??= 'unused-in-this-test';
if (!process.env.CHROMIUM_PATH && process.platform === 'win32') {
  process.env.CHROMIUM_PATH = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
}

async function main() {
  const assetCount = Number.parseInt(process.argv[2] ?? '50', 10);
  const { renderReportPdf } = await import('../src/generation/pipeline');
  const { buildSyntheticReport } = await import('../src/diagnostics/synthetic');
  const { data, byValue, photoCount, defectCount } = await buildSyntheticReport(assetCount);

  console.log(`Rendering synthetic report: ${assetCount} assets, ${photoCount} photos, ${defectCount} defects...`);
  const started = Date.now();
  const { pdf, chunkCount } = await renderReportPdf(data, byValue);
  const tookMs = Date.now() - started;

  const { PDFDocument } = await import('pdf-lib');
  const pages = (await PDFDocument.load(pdf)).getPageCount();

  const outDir = path.join(__dirname, '..', 'test-output');
  await mkdir(outDir, { recursive: true });
  const outPath = path.join(outDir, `report-${assetCount}.pdf`);
  await writeFile(outPath, pdf);

  console.log(`OK: ${pages} pages, ${(pdf.length / 1024 / 1024).toFixed(2)} MB, ${chunkCount} chunk(s), took ${(tookMs / 1000).toFixed(1)}s`);
  console.log(`    Node peak RSS ~${(process.memoryUsage().rss / 1024 / 1024).toFixed(0)} MB (Chromium runs as a separate process)`);
  console.log(`    -> ${outPath}`);
}

main().catch((err) => {
  console.error('FAIL:', err);
  process.exit(1);
});
