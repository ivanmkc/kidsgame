import pw from '/home/ivanmkc/termchart/node_modules/playwright/index.js';
import fs from 'fs';
const { chromium } = pw;
const OUT = '/home/ivanmkc/kidsgame/tools/audit_out/escape-grammar';
fs.mkdirSync(OUT, { recursive: true });
const b = await chromium.launch();
const page = await b.newPage({ viewport: { width: 1024, height: 768 } });
await page.goto('http://localhost:8899/kidsgame/#/escape/toyroom', { waitUntil: 'networkidle' });
await page.waitForTimeout(1800);
const shot = (n) => page.screenshot({ path: `${OUT}/${n}.png` });
await shot('0-fresh');
const tap = async (id, wait) => { await page.getByTestId(`escape-spot-${id}`).click(); await page.waitForTimeout(wait); };
await tap('pillow', 4600); await shot('1-pillow-revealed-key-visible');   // clip ~4s + settle
await tap('pillow', 350);  await shot('2-key-midfly');                    // forgiveness collect; catch flight
await page.waitForTimeout(900); await shot('3-key-taken-in-tray');
await tap('chest', 4600);  await shot('4-chest-revealed-bone-visible');
await tap('chest', 350);   await shot('5-bone-midfly');
await page.waitForTimeout(900); await shot('6-bone-taken');
await tap('pen', 4600);    await shot('7-win-banner');
await b.close();
console.log('WALK DONE');
