// Renders one PDF page to PNG via pdf.js inside headless Chrome (no poppler on Windows).
//   node test/render-page.localtest.js <pdf> <page> <out.png>
const fs = require('fs');
const path = require('path');
const puppeteer = require('puppeteer-core');
(async () => {
  const [pdfPath, pageNo, out] = process.argv.slice(2);
  const browser = await puppeteer.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', args: ['--allow-file-access-from-files'] });
  const page = await browser.newPage();
  await page.setViewport({ width: 1240, height: 1754 });
  const lib = 'file:///' + path.resolve('node_modules/pdfjs-dist/build').split(path.sep).join('/');
  const b64 = fs.readFileSync(pdfPath).toString('base64');
  const htmlFile = path.resolve('test-output', '_render-page.html');
  fs.writeFileSync(htmlFile, `<html><body style="margin:0;background:#fff"><canvas id=c></canvas><script type=module>
    import * as pdfjs from '${lib}/pdf.mjs';
    pdfjs.GlobalWorkerOptions.workerSrc = '${lib}/pdf.worker.mjs';
    const data = Uint8Array.from(atob('${b64}'), c => c.charCodeAt(0));
    const doc = await pdfjs.getDocument({ data }).promise;
    const p = await doc.getPage(${Number(pageNo)});
    const vp = p.getViewport({ scale: 1.5 });
    const c = document.getElementById('c'); c.width = vp.width; c.height = vp.height;
    await p.render({ canvasContext: c.getContext('2d'), viewport: vp }).promise;
    document.title = 'done';
  </script></body></html>`);
  page.on('console', (m) => console.log('[page]', m.text()));
  page.on('pageerror', (e) => console.log('[pageerror]', e.message));
  await page.goto('file:///' + htmlFile.split(path.sep).join('/'));
  await page.waitForFunction(() => document.title === 'done', { timeout: 60000 });
  await (await page.$('#c')).screenshot({ path: out });
  await browser.close();
})().catch((e) => { console.error(e); process.exit(1); });
