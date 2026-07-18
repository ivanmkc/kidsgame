import pw from '/home/ivanmkc/termchart/node_modules/playwright/index.js';
const { chromium } = pw;
import fs from 'fs';
import http from 'http';
import path from 'path';

const OUT = '/home/ivanmkc/kidsgame/tools/audit_out/musicbox-v2';
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

// 1. Picker screen
await page.goto(`${BASE}/#/musicbox`, { waitUntil: 'networkidle' });
await page.waitForTimeout(2000);
await page.screenshot({ path: `${OUT}/01-picker.png` });
console.log('shot: 01-picker');

// 2. Pick Twinkle scene
const twinkleBtn = page.getByTestId('scene-pick-twinkle');
await twinkleBtn.waitFor({ timeout: 5000 }).catch(() => console.log('warn: twinkle btn not found'));
await twinkleBtn.click();
await page.waitForTimeout(1500);
await page.screenshot({ path: `${OUT}/02-journey-start.png` });
console.log('shot: 02-journey-start');

// 3. Tap a few times to show spawned objects and scrolling
const stage = page.getByTestId('musicbox-stage');
await stage.waitFor({ timeout: 5000 }).catch(() => console.log('warn: stage not found'));

// Tap in different zones
for (let i = 0; i < 4; i++) {
  const box = await stage.boundingBox();
  if (box) {
    const x = box.x + box.width * (0.3 + i * 0.15);
    const y = box.y + box.height * (0.15 + i * 0.2);
    await page.mouse.click(x, y);
  }
  await page.waitForTimeout(400);
}
await page.screenshot({ path: `${OUT}/03-after-4-taps.png` });
console.log('shot: 03-after-4-taps');

// 4. Tap to spawn objects — "before scroll-away"
for (let i = 0; i < 5; i++) {
  const box = await stage.boundingBox();
  if (box) {
    const x = box.x + box.width * 0.5;
    const y = box.y + box.height * (0.3 + i * 0.1);
    await page.mouse.click(x, y);
  }
  await page.waitForTimeout(300);
}
await page.waitForTimeout(600);
await page.screenshot({ path: `${OUT}/04-spawns-before.png` });
console.log('shot: 04-spawns-before');

// 5. Tap more to show scroll-away
for (let i = 0; i < 20; i++) {
  const box = await stage.boundingBox();
  if (box) {
    const x = box.x + box.width * (0.6 + Math.random() * 0.3);
    const y = box.y + box.height * (0.1 + Math.random() * 0.8);
    await page.mouse.click(x, y);
  }
  await page.waitForTimeout(120);
}
await page.waitForTimeout(600);
await page.screenshot({ path: `${OUT}/05-spawns-scrolled.png` });
console.log('shot: 05-spawns-scrolled');

// 6. Go back to picker, show 3-scene picker
await page.goBack();
await page.waitForTimeout(1500);
await page.screenshot({ path: `${OUT}/06-picker-3scenes.png` });
console.log('shot: 06-picker-3scenes');

// 7. Pick Row scene
const rowBtn = page.getByTestId('scene-pick-row');
await rowBtn.waitFor({ timeout: 5000 }).catch(() => console.log('warn: row btn not found'));
await rowBtn.click();
await page.waitForTimeout(1500);
for (let i = 0; i < 8; i++) {
  const box = await stage.boundingBox();
  if (box) {
    const x = box.x + box.width * (0.3 + Math.random() * 0.4);
    const y = box.y + box.height * (0.1 + Math.random() * 0.8);
    await page.mouse.click(x, y);
  }
  await page.waitForTimeout(200);
}
await page.waitForTimeout(600);
await page.screenshot({ path: `${OUT}/07-row-scene.png` });
console.log('shot: 07-row-scene');

// 8. Pick Jingle scene
await page.goBack();
await page.waitForTimeout(1000);
const jingleBtn = page.getByTestId('scene-pick-jingle');
await jingleBtn.waitFor({ timeout: 5000 }).catch(() => console.log('warn: jingle btn not found'));
await jingleBtn.click();
await page.waitForTimeout(1500);
for (let i = 0; i < 8; i++) {
  const box = await stage.boundingBox();
  if (box) {
    const x = box.x + box.width * (0.3 + Math.random() * 0.4);
    const y = box.y + box.height * (0.1 + Math.random() * 0.8);
    await page.mouse.click(x, y);
  }
  await page.waitForTimeout(200);
}
await page.waitForTimeout(600);
await page.screenshot({ path: `${OUT}/08-jingle-scene.png` });
console.log('shot: 08-jingle-scene');

await b.close();
srv.close();
console.log('DONE');
