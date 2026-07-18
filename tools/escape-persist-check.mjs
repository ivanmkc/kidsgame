// Proof for the reveal/collect grammar: walk the full toyroom chain
// pillow → key → chest → bone → pen, screenshotting every phase:
// reveal (container opens, item visible), collect (item flies to tray,
// item gone from scene), and win. Verifies scene persistence across
// unrelated taps and captures one mid-fly frame if timing allows.
import pw from '/home/ivanmkc/termchart/node_modules/playwright/index.js';
import fs from 'fs';
const { chromium } = pw;
const OUT = '/home/ivanmkc/kidsgame/tools/audit_out/escape-fx';
fs.mkdirSync(OUT, { recursive: true });
const b = await chromium.launch();
const page = await b.newPage({ viewport: { width: 1024, height: 768 } });
await page.goto('http://localhost:8787/kidsgame/#/escape/toyroom', { waitUntil: 'networkidle' });
await page.waitForTimeout(1800);

// Phase 0: base scene
await page.screenshot({ path: `${OUT}/0-start.png` });
console.log('0-start');

// Phase 1a: tap pillow → REVEALED (key visible under pillow, Veo clip)
await page.getByTestId('escape-spot-pillow').click();
await page.waitForTimeout(500);
await page.screenshot({ path: `${OUT}/1a-pillow-revealed.png` });
console.log('1a-pillow-revealed');
await page.waitForTimeout(3500);
await page.screenshot({ path: `${OUT}/1b-pillow-reveal-settled.png` });
console.log('1b-pillow-reveal-settled (after clip)');

// Phase 1c: tap pillow again → COLLECTED (key flies to tray)
await page.getByTestId('escape-spot-pillow').click();
await page.waitForTimeout(150);
await page.screenshot({ path: `${OUT}/1c-key-mid-fly.png` });
console.log('1c-key-mid-fly');
await page.waitForTimeout(600);
await page.screenshot({ path: `${OUT}/1d-key-collected.png` });
console.log('1d-key-collected (key in tray, pillow takenScene)');

// Persistence: tap teddy (unrelated) — pillow takenScene must persist
await page.getByTestId('escape-spot-teddy').click();
await page.waitForTimeout(900);
await page.screenshot({ path: `${OUT}/1e-pillow-persists.png` });
console.log('1e-pillow-persists (after unrelated tap)');

// Phase 2a: tap chest → REVEALED (chest opens, bone visible, key consumed)
await page.getByTestId('escape-spot-chest').click();
await page.waitForTimeout(500);
await page.screenshot({ path: `${OUT}/2a-chest-revealed.png` });
console.log('2a-chest-revealed');
await page.waitForTimeout(3500);
await page.screenshot({ path: `${OUT}/2b-chest-reveal-settled.png` });
console.log('2b-chest-reveal-settled (after clip)');

// Phase 2c: tap chest again → COLLECTED (bone flies to tray)
await page.getByTestId('escape-spot-chest').click();
await page.waitForTimeout(150);
await page.screenshot({ path: `${OUT}/2c-bone-mid-fly.png` });
console.log('2c-bone-mid-fly');
await page.waitForTimeout(600);
await page.screenshot({ path: `${OUT}/2d-bone-collected.png` });
console.log('2d-bone-collected (bone in tray, chest takenScene)');

// Phase 3: tap pen → WIN (bone consumed, puppy freed, afterScene + clip)
await page.getByTestId('escape-spot-pen').click();
await page.waitForTimeout(500);
await page.screenshot({ path: `${OUT}/3a-win-mid-clip.png` });
console.log('3a-win-mid-clip');
await page.waitForTimeout(4000);
await page.screenshot({ path: `${OUT}/3b-win-settled.png` });
console.log('3b-win-settled');

console.log('DONE — 12 screenshots in ' + OUT);
await b.close();
