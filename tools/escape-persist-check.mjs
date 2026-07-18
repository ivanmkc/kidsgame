// Proof for the animate-and-persist requirement: open the toyroom chest,
// then keep playing and verify the chest STAYS open (full-scene state image
// persists — no rectangular seam, lid fully visible with no clipping).
import pw from '/home/ivanmkc/termchart/node_modules/playwright/index.js';
import fs from 'fs';
const { chromium } = pw;
const OUT = '/home/ivanmkc/kidsgame/tools/audit_out/escape-fx';
fs.mkdirSync(OUT, { recursive: true });
const b = await chromium.launch();
const page = await b.newPage({ viewport: { width: 1024, height: 768 } });
await page.goto('http://localhost:8787/kidsgame/#/escape/toyroom', { waitUntil: 'networkidle' });
await page.waitForTimeout(1800);
await page.screenshot({ path: `${OUT}/persist-0-start.png` });
await page.getByTestId('escape-spot-pillow').click();      // find the key
await page.waitForTimeout(900);
await page.getByTestId('escape-item-key').click();          // pick it up (taught flow)
await page.waitForTimeout(300);
await page.getByTestId('escape-spot-chest').click();        // chest animates open
await page.waitForTimeout(900);
await page.screenshot({ path: `${OUT}/persist-1-chest-open.png` });
await page.getByTestId('escape-spot-teddy').click();        // unrelated tap
await page.waitForTimeout(900);
await page.screenshot({ path: `${OUT}/persist-2-chest-still-open.png` });
console.log('DONE');
await b.close();
