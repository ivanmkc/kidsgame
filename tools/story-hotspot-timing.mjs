// Story Path: prove the choices stay hidden until the page has been read.
//
// Covers both kinds of page — the in-scene hotspots and the button row
// below the picture. The gate is UI timing, so the vitest suite (pure
// logic, node env) can't see it. This drives the real exported app and
// compares two page-time numbers: when the last narration clip ends, and
// when the first story-choice target of any kind enters the DOM.
//
//   npx expo export --platform web --clear
//   mkdir -p /tmp/serve && ln -sfn "$PWD/dist" /tmp/serve/kidsgame
//   (cd /tmp/serve && python3 -m http.server 8735 &)
//   node tools/story-hotspot-timing.mjs [baseUrl] [story...]
//
// Exits non-zero if any story shows its choices while the voice is still
// going. playwright is not a dependency of this app, so point PLAYWRIGHT_PATH
// at an install that has it; PLAYWRIGHT_CHROMIUM picks the browser binary
// when it isn't where playwright expects.
const pw = await import(process.env.PLAYWRIGHT_PATH || 'playwright');
const { chromium } = pw.default ?? pw;   // the package is CJS: import() nests it under .default

const BASE = process.argv[2]?.startsWith('http')
  ? process.argv[2]
  : 'http://localhost:8735/kidsgame/';
const STORIES = process.argv.slice(process.argv[2]?.startsWith('http') ? 3 : 2);
// luna/pip/doors open on in-scene hotspots (every choice carries a `hot`
// box); whisper opens on the button row — both paths are gated, so both
// are covered here.
const DEFAULT_STORIES = ['luna', 'pip', 'doors', 'whisper'];
const WATCH_MS = 45000;

const instrument = () => {
  window.__clips = [];
  window.__hotAt = null;
  const play = HTMLMediaElement.prototype.play;
  HTMLMediaElement.prototype.play = function (...args) {
    if (String(this.src).includes('/voice/')) {
      const rec = { start: performance.now(), end: null };
      window.__clips.push(rec);
      const stop = () => { if (rec.end === null) rec.end = performance.now(); };
      this.addEventListener('ended', stop, { once: true });
      this.addEventListener('pause', stop, { once: true });
    }
    return play.apply(this, args);
  };
  // Poll rather than observe: react-native-web commits the node before the
  // styles that lay it out, so a MutationObserver reads it too early.
  setInterval(() => {
    if (window.__hotAt === null && document.querySelector('[data-testid^="story-choice-"]')) {
      window.__hotAt = performance.now();
    }
  }, 100);
};

const secs = (ms) => (ms === null || ms === undefined ? 'n/a' : `${(ms / 1000).toFixed(1)}s`);

const browser = await chromium.launch({
  executablePath: process.env.PLAYWRIGHT_CHROMIUM || undefined,
  // the narration has to actually play for the timing to mean anything
  args: ['--autoplay-policy=no-user-gesture-required'],
});
let failures = 0;
for (const story of (STORIES.length ? STORIES : DEFAULT_STORIES)) {
  const page = await browser.newPage();
  await page.addInitScript(instrument);
  await page.goto(`${BASE}#/story/${story}`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(WATCH_MS);
  const { clips, hotAt } = await page.evaluate(() => ({ clips: window.__clips, hotAt: window.__hotAt }));
  await page.close();

  const narrationEnd = clips.length ? clips[clips.length - 1].end : null;
  const ok = hotAt !== null && narrationEnd !== null && hotAt >= narrationEnd - 300;
  if (!ok) failures++;
  console.log(`${story}: ${clips.length} clip(s), narration ends ${secs(narrationEnd)}, `
    + `choices appear ${secs(hotAt)} — ${ok ? 'after the voice' : 'DURING THE VOICE'}`);
}
await browser.close();

console.log(failures ? `\n${failures} story/stories reveal their choices too early`
  : '\nevery story holds its choices until the page has been read');
process.exit(failures ? 1 : 0);
