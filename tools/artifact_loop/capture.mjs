/**
 * Screenshot capture for the artifact-detection loop.
 *
 * Reads surfaces.json, builds the expo export, serves it, and captures a PNG
 * per surface (including interaction states). Output goes to the directory
 * passed as argv[1].
 *
 * Usage: node capture.mjs <outDir> [--filter escape,musicbox,menu]
 */
import pw from '/home/ivanmkc/termchart/node_modules/playwright/index.js';
import fs from 'fs';
import http from 'http';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const KIDSGAME = path.resolve(__dirname, '../..');
const DIST = path.join(KIDSGAME, 'dist');
const SURFACES_PATH = path.join(__dirname, 'surfaces.json');

const outDir = process.argv[2];
if (!outDir) { console.error('usage: node capture.mjs <outDir> [--filter escape,menu]'); process.exit(1); }
fs.mkdirSync(outDir, { recursive: true });

const filterArg = process.argv.indexOf('--filter');
const filters = filterArg >= 0 && process.argv[filterArg + 1]
  ? process.argv[filterArg + 1].split(',').map(f => f.trim())
  : null;

const surfaces = JSON.parse(fs.readFileSync(SURFACES_PATH, 'utf8'));
const vp = surfaces.viewport;

function matchesFilter(id) {
  if (!filters) return true;
  return filters.some(f => id.startsWith(f));
}

const mimeTypes = {
  '.html': 'text/html', '.js': 'application/javascript', '.css': 'text/css',
  '.json': 'application/json', '.png': 'image/png', '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml', '.mp3': 'audio/mpeg', '.wav': 'audio/wav',
  '.ico': 'image/x-icon', '.webm': 'video/webm', '.mp4': 'video/mp4',
};

const PREFIX = '/kidsgame/';
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

const port = await new Promise((resolve) => {
  srv.listen(0, () => resolve(srv.address().port));
});
await new Promise(r => setTimeout(r, 300));
const BASE = `http://localhost:${port}/kidsgame`;

const { chromium } = pw;
const browser = await chromium.launch();
const results = [];

for (const s of surfaces.surfaces) {
  if (!matchesFilter(s.id)) continue;

  const page = await browser.newPage({ viewport: { width: vp.width, height: vp.height } });
  const url = `${BASE}/${s.route}`;
  try {
    await page.goto(url, { waitUntil: 'networkidle', timeout: 15000 });
  } catch (e) {
    console.log(`WARN: networkidle timeout on ${s.id}, continuing...`);
  }
  await page.waitForTimeout(1800);

  if (s.waitFor) {
    try {
      await page.getByTestId(s.waitFor).waitFor({ timeout: 5000 });
    } catch {
      console.log(`WARN: ${s.waitFor} not found on ${s.id}`);
    }
  }

  if (s.scrollTo) {
    try {
      const section = page.getByTestId(s.scrollTo);
      await section.scrollIntoViewIfNeeded({ timeout: 3000 });
      await page.waitForTimeout(600);
    } catch {
      console.log(`WARN: scroll target ${s.scrollTo} not found on ${s.id}`);
    }
  }

  if (s.interact) {
    try {
      await doInteraction(page, s.interact);
    } catch (e) {
      console.log(`WARN: interaction failed on ${s.id}: ${e.message}`);
    }
  }

  const shotPath = path.join(outDir, `${s.id}.png`);
  await page.screenshot({ path: shotPath });
  results.push({ surface: s.id, screenshot: shotPath });
  console.log(`shot: ${s.id}`);
  await page.close();
}

await browser.close();
srv.close();

fs.writeFileSync(path.join(outDir, 'captures.json'), JSON.stringify(results, null, 2));
console.log(`DONE: ${results.length} screenshots -> ${outDir}`);

async function doInteraction(page, interact) {
  if (interact.kind === 'tap-stage') {
    const stage = page.getByTestId(interact.testId);
    await stage.waitFor({ timeout: 5000 });
    const box = await stage.boundingBox();
    if (!box) throw new Error('stage not visible');
    for (let i = 0; i < interact.count; i++) {
      const x = box.x + box.width * (0.15 + Math.random() * 0.7);
      const y = box.y + box.height * (0.1 + Math.random() * 0.8);
      await page.mouse.click(x, y);
      await page.waitForTimeout(250);
    }
    await page.waitForTimeout(800);
  } else if (interact.kind === 'escape-chain') {
    for (const step of interact.steps) {
      try {
        const el = page.getByTestId(step.tap);
        await el.waitFor({ timeout: 4000 });
        await el.click();
      } catch {
        console.log(`  step ${step.tap} not found, skipping`);
      }
      await page.waitForTimeout(step.wait || 900);
    }
    await page.waitForTimeout(600);
  } else if (interact.kind === 'story-choice') {
    // Click a story choice button to navigate to a mid-node
    for (const choice of interact.choices) {
      try {
        const btn = page.getByTestId(`story-choice-${choice}`);
        await btn.waitFor({ timeout: 4000 });
        await btn.click();
        await page.waitForTimeout(1500);
      } catch {
        console.log(`  story choice ${choice} not found, skipping`);
      }
    }
    await page.waitForTimeout(800);
  } else if (interact.kind === 'story-scare') {
    // Navigate to a node then tap the scare spot
    for (const choice of (interact.choices || [])) {
      try {
        const btn = page.getByTestId(`story-choice-${choice}`);
        await btn.waitFor({ timeout: 4000 });
        await btn.click();
        await page.waitForTimeout(1500);
      } catch {
        console.log(`  story choice ${choice} not found, skipping`);
      }
    }
    await page.waitForTimeout(500);
    try {
      const scare = page.getByTestId('story-scare');
      await scare.waitFor({ timeout: 3000 });
      await scare.click();
      await page.waitForTimeout(2000);
    } catch {
      console.log('  scare spot not found');
    }
  } else if (interact.kind === 'open-lockdown') {
    try {
      const gear = page.getByTestId('parental-controls');
      await gear.waitFor({ timeout: 3000 });
      await gear.click();
      await page.waitForTimeout(1500);
    } catch {
      console.log('  parental-controls button not found, trying fallback');
      await page.mouse.click(vp.width - 40, 40, { delay: 2000 });
      await page.waitForTimeout(1500);
    }
  } else if (interact.kind === 'open-adult-gate') {
    try {
      const gear = page.getByTestId('parental-controls');
      await gear.waitFor({ timeout: 3000 });
      await gear.click();
      await page.waitForTimeout(1500);
    } catch {
      console.log('  parental-controls not found');
    }
  }
}
