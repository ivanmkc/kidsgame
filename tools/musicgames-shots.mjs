import pw from '/home/ivanmkc/termchart/node_modules/playwright/index.js';
const { chromium } = pw;
import fs from 'fs';
const OUT = '/home/ivanmkc/kidsgame/tools/audit_out/musicgames';
fs.mkdirSync(OUT, { recursive: true });
const b = await chromium.launch();
const page = await b.newPage({ viewport: { width: 1024, height: 768 } });
const shots = [
  ['menu-music', 'http://localhost:8787/kidsgame/#/menu'],
  ['highlow', 'http://localhost:8787/kidsgame/#/highlow'],
  ['bells', 'http://localhost:8787/kidsgame/#/bells'],
  ['echobeat', 'http://localhost:8787/kidsgame/#/echobeat'],
  ['steadybeat', 'http://localhost:8787/kidsgame/#/steadybeat'],
  ['fastslow', 'http://localhost:8787/kidsgame/#/fastslow'],
  ['samediff', 'http://localhost:8787/kidsgame/#/samediff'],
];
for (const [name, url] of shots) {
  await page.goto(url, { waitUntil: 'networkidle' });
  await page.waitForTimeout(1500);
  await page.screenshot({ path: `${OUT}/${name}.png` });
  console.log(`shot: ${name}`);
}
await b.close();
console.log('DONE');
