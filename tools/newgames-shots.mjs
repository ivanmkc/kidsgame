import pw from '/home/ivanmkc/termchart/node_modules/playwright/index.js';
const { chromium } = pw;
import fs from 'fs';
const OUT = '/home/ivanmkc/kidsgame/tools/audit_out/newgames';
fs.mkdirSync(OUT, { recursive: true });
const b = await chromium.launch();
const page = await b.newPage({ viewport: { width: 1024, height: 768 } });
const shots = [
  ['menu', 'http://localhost:8787/kidsgame/#/menu', null],
  ['musicbox-picker', 'http://localhost:8787/kidsgame/#/musicbox', null],
  ['musicbox-twinkle', 'http://localhost:8787/kidsgame/#/musicbox/twinkle', 'musicbox-stage'],
  ['bingo', 'http://localhost:8787/kidsgame/#/bingo', null],
  ['escape-picker', 'http://localhost:8787/kidsgame/#/escape', null],
  ['escape-toyroom', 'http://localhost:8787/kidsgame/#/escape/toyroom', 'escape-tray'],
  ['escape-rocketpad', 'http://localhost:8787/kidsgame/#/escape/rocketpad', 'escape-tray'],
];
for (const [name, url, waitFor] of shots) {
  await page.goto(url, { waitUntil: 'networkidle' });
  await page.waitForTimeout(1500);
  if (waitFor) await page.getByTestId(waitFor).waitFor({ timeout: 5000 }).catch(() => console.log(`warn: ${waitFor} not found on ${name}`));
  await page.screenshot({ path: `${OUT}/${name}.png` });
  console.log(`shot: ${name}`);
}
// Interact: tap the musicbox stage 5 times, expect floating glyphs + star progress
await page.goto('http://localhost:8787/kidsgame/#/musicbox/twinkle', { waitUntil: 'networkidle' });
await page.waitForTimeout(1200);
const stage = page.getByTestId('musicbox-stage');
for (let i = 0; i < 5; i++) { await stage.click({ position: { x: 300 + i * 60, y: 300 } }); await page.waitForTimeout(180); }
await page.screenshot({ path: `${OUT}/musicbox-after-5-taps.png` });
console.log('shot: musicbox-after-5-taps');
// Bingo: tap the called tile? Just screenshot the board state.
await b.close();
console.log('DONE');
