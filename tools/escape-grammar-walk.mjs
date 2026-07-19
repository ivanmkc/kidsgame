// Walk all escape rooms through their full reveal/collect grammar, taking
// screenshots at each phase.  Extends the original toyroom-only harness to
// cover all 4 rooms.  Run with: node tools/escape-grammar-walk.mjs
//
// Requires a dev server on port 8899 (npx expo start --web --port 8899).
import pw from '/home/ivanmkc/termchart/node_modules/playwright/index.js';
import fs from 'fs';

const { chromium } = pw;
const OUT = '/home/ivanmkc/kidsgame/tools/audit_out/escape-grammar';
fs.mkdirSync(OUT, { recursive: true });
const b = await chromium.launch();

const ROOMS = [
  {
    id: 'toyroom',
    steps: [
      // pillow reveals key, then forgiveness-collect
      { tap: 'pillow', wait: 4600, shot: 'pillow-revealed-key-visible' },
      { tap: 'pillow', wait: 350,  shot: 'key-midfly' },
      { settle: 900,               shot: 'key-taken-in-tray' },
      // chest reveals bone, then forgiveness-collect
      { tap: 'chest',  wait: 4600, shot: 'chest-revealed-bone-visible' },
      { tap: 'chest',  wait: 350,  shot: 'bone-midfly' },
      { settle: 900,               shot: 'bone-taken' },
      // pen is the win hotspot (needs bone)
      { tap: 'pen',    wait: 4600, shot: 'win-banner' },
    ],
  },
  {
    id: 'dragoncave',
    steps: [
      // haystack reveals egg
      { tap: 'haystack', wait: 4600, shot: 'haystack-revealed-egg-visible' },
      { tap: 'haystack', wait: 350,  shot: 'egg-midfly' },
      { settle: 900,                 shot: 'egg-taken-in-tray' },
      // stove reveals pancake (needs egg)
      { tap: 'stove',   wait: 4600, shot: 'stove-revealed-pancake-visible' },
      { tap: 'stove',   wait: 350,  shot: 'pancake-midfly' },
      { settle: 900,                 shot: 'pancake-taken' },
      // dragon is the win hotspot (needs pancake)
      { tap: 'dragon',  wait: 4600, shot: 'win-banner' },
    ],
  },
  {
    id: 'piratecove',
    steps: [
      // net reveals fish
      { tap: 'net',     wait: 4600, shot: 'net-revealed-fish-visible' },
      { tap: 'net',     wait: 350,  shot: 'fish-midfly' },
      { settle: 900,                shot: 'fish-taken-in-tray' },
      // pelican reveals shell (needs fish)
      { tap: 'pelican', wait: 4600, shot: 'pelican-revealed-shell-visible' },
      { tap: 'pelican', wait: 350,  shot: 'shell-midfly' },
      { settle: 900,                shot: 'shell-taken' },
      // chest is the win hotspot (needs shell)
      { tap: 'chest',   wait: 4600, shot: 'win-banner' },
    ],
  },
  {
    id: 'rocketpad',
    steps: [
      // toolbox reveals wrench (no visual change — reveal=None copies base)
      { tap: 'toolbox', wait: 4600, shot: 'toolbox-revealed-wrench-visible' },
      { tap: 'toolbox', wait: 350,  shot: 'wrench-midfly' },
      { settle: 900,                shot: 'wrench-taken-in-tray' },
      // crate reveals battery
      { tap: 'crate',   wait: 4600, shot: 'crate-revealed-battery-visible' },
      { tap: 'crate',   wait: 350,  shot: 'battery-midfly' },
      { settle: 900,                shot: 'battery-taken' },
      // panel unlocks with wrench (no-gives lock)
      { tap: 'panel',   wait: 4600, shot: 'panel-unlocked' },
      // slot unlocks with battery → win
      { tap: 'slot',    wait: 4600, shot: 'win-banner' },
    ],
  },
];

for (const room of ROOMS) {
  console.log(`--- ${room.id} ---`);
  const page = await b.newPage({ viewport: { width: 1024, height: 768 } });
  await page.goto(`http://localhost:8899/kidsgame/#/escape/${room.id}`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(1800);

  const shot = (n) => page.screenshot({ path: `${OUT}/${room.id}_${n}.png` });
  await shot('0-fresh');

  let stepNum = 1;
  for (const s of room.steps) {
    if (s.tap) {
      await page.getByTestId(`escape-spot-${s.tap}`).click({ force: true });
      await page.waitForTimeout(s.wait);
    } else if (s.settle) {
      await page.waitForTimeout(s.settle);
    }
    await shot(`${stepNum}-${s.shot}`);
    stepNum++;
  }
  await page.close();
  console.log(`  ${stepNum - 1} screenshots`);
}

// ── Boundary proof: for one reveal per room, screenshot near the end
// of the video clip (~3.8s after tap) and again when the scene is shown
// (~5.0s), then compute pixel diff between the pair.
// With seamless clip endings, the diff should be near-zero.
console.log('\n--- BOUNDARY PROOF ---');
const BOUNDARY_ROOMS = [
  { id: 'toyroom',     spot: 'pillow', name: 'pillow-reveal' },
  { id: 'dragoncave',  spot: 'haystack', name: 'haystack-reveal' },
  { id: 'piratecove',  spot: 'net', name: 'net-reveal' },
  { id: 'rocketpad',   spot: 'crate', name: 'crate-reveal' },
];

for (const br of BOUNDARY_ROOMS) {
  const page = await b.newPage({ viewport: { width: 1024, height: 768 } });
  await page.goto(`http://localhost:8899/kidsgame/#/escape/${br.id}`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(1800);

  // Tap the spot to trigger the video
  await page.getByTestId(`escape-spot-${br.spot}`).click({ force: true });

  // Screenshot near end of video (~3.8s after tap)
  await page.waitForTimeout(3800);
  const shotA = `${OUT}/${br.id}_boundary_${br.name}_3.8s.png`;
  await page.screenshot({ path: shotA });

  // Screenshot after video ends + scene shown (~5.0s after tap)
  await page.waitForTimeout(1200);
  const shotB = `${OUT}/${br.id}_boundary_${br.name}_5.0s.png`;
  await page.screenshot({ path: shotB });

  // Compare the two screenshots pixel-by-pixel
  const { execSync } = await import('child_process');
  try {
    const result = execSync(
      `python3 -c "
import numpy as np
from PIL import Image
a = np.array(Image.open('${shotA}').convert('RGB'), dtype=np.int16)
b = np.array(Image.open('${shotB}').convert('RGB'), dtype=np.int16)
delta = np.abs(a - b).sum(axis=-1)
print(f'mean={delta.mean():.2f} frac30={float((delta > 30).mean()):.4f}')
"`,
      { encoding: 'utf-8' }
    ).trim();
    console.log(`  ${br.id}/${br.name}: boundary diff ${result}`);
  } catch (e) {
    console.log(`  ${br.id}/${br.name}: could not compute diff: ${e.message}`);
  }

  await page.close();
}

await b.close();
console.log('ALL WALKS DONE');
