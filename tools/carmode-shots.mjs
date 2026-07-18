import pw from '/home/ivanmkc/termchart/node_modules/playwright/index.js';
const { chromium } = pw;
import fs from 'fs';
import http from 'http';
import path from 'path';

const OUT = '/home/ivanmkc/kidsgame/tools/audit_out/carmode';
fs.mkdirSync(OUT, { recursive: true });

const DIST = '/home/ivanmkc/kidsgame/dist';
const PREFIX = '/kidsgame/';

function findFreePort() {
  return new Promise((resolve) => {
    const srv = http.createServer();
    srv.listen(0, () => { const port = srv.address().port; srv.close(() => resolve(port)); });
  });
}

const port = await findFreePort();

const mimeTypes = {
  '.html': 'text/html', '.js': 'application/javascript', '.css': 'text/css',
  '.json': 'application/json', '.png': 'image/png', '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml', '.mp3': 'audio/mpeg', '.wav': 'audio/wav',
  '.ico': 'image/x-icon',
};

const srv = http.createServer((req, res) => {
  let url = req.url.split('?')[0].split('#')[0];
  if (url.startsWith(PREFIX)) url = url.slice(PREFIX.length - 1);
  if (url === '/' || url === '') url = '/index.html';
  const fp = path.join(DIST, url);
  if (fs.existsSync(fp) && fs.statSync(fp).isFile()) {
    const ext = path.extname(fp);
    res.writeHead(200, { 'Content-Type': mimeTypes[ext] || 'application/octet-stream' });
    fs.createReadStream(fp).pipe(res);
  } else {
    // SPA fallback
    const idx = path.join(DIST, 'index.html');
    if (fs.existsSync(idx)) {
      res.writeHead(200, { 'Content-Type': 'text/html' });
      fs.createReadStream(idx).pipe(res);
    } else {
      res.writeHead(404);
      res.end('Not found');
    }
  }
});
srv.listen(port);
await new Promise((r) => setTimeout(r, 500));

const BASE = `http://localhost:${port}/kidsgame`;
const b = await chromium.launch();
const page = await b.newPage({ viewport: { width: 1024, height: 768 } });

const shots = [
  ['carmode-menu', `${BASE}/#/menu`, null],
  ['carmode-playing', `${BASE}/#/carmode`, 'carmode-surface'],
];

for (const [name, url, waitFor] of shots) {
  await page.goto(url, { waitUntil: 'networkidle' });
  await page.waitForTimeout(2000);
  if (waitFor) {
    await page.getByTestId(waitFor).waitFor({ timeout: 5000 }).catch(() =>
      console.log(`warn: ${waitFor} not found on ${name}`)
    );
  }
  await page.screenshot({ path: `${OUT}/${name}.png` });
  console.log(`shot: ${name}`);
}

// Interact: tap the surface 3 times
await page.goto(`${BASE}/#/carmode`, { waitUntil: 'networkidle' });
await page.waitForTimeout(3000);
const tap = page.getByTestId('carmode-tap');
for (let i = 0; i < 3; i++) {
  await tap.click().catch(() => console.log('tap click missed'));
  await page.waitForTimeout(800);
}
await page.screenshot({ path: `${OUT}/carmode-after-taps.png` });
console.log('shot: carmode-after-taps');

await b.close();
srv.close();
console.log('DONE');
