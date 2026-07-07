// Reproduce the "first round is silent" bug end-to-end.
//
// Runs Chromium with autoplay-policy=user-gesture-required (Playwright's
// default silently allows everything, masking iOS-class autoplay blocks).
// Instruments window.Audio + speechSynthesis before app boot so we can
// observe the ORDER of events (say → stopNarration vs the reverse) and
// the AUDIBLE outcome (a 'playing' event, currentTime > 0), not just
// network fetches.
//
// Two scenarios per game:
//   (a) COLD deep-link: navigate directly to #/<game>, then first tap
//   (b) HOME → CARD: land on menu, tap the game card
//
// Games covered: oddone (grid game), letters (letter hunt), story (narrated).

import pw from '/home/ivanmkc/termchart/node_modules/playwright/index.js';
const { chromium } = pw;

const BASE = process.env.BASE_URL || 'http://localhost:8793/kidsgame/';
const STRICT = process.env.STRICT !== '0'; // default: strict autoplay
const HEADLESS = process.env.HEADED === '1' ? false : true;
const WAIT_AUDIBLE_MS = 3000;

const INSTRUMENT = `
(() => {
  const t0 = performance.now();
  window.__kgbLog = [];
  const log = (...a) => {
    const t = (performance.now() - t0).toFixed(1);
    window.__kgbLog.push({ t: +t, msg: a.map(String).join(' ') });
    // eslint-disable-next-line no-console
    console.log('[' + t + 'ms]', ...a);
  };
  window.__kgbAudioEvents = [];
  // Narration is a SINGLETON <audio> element created lazily inside sound.ts
  // via new window.Audio() with no src (then .src is swapped per line).
  // Intercept the constructor and also patch play/pause on the produced
  // element so we always know current src, currentTime, and playing state.
  const origAudio = window.Audio;
  function currentTag(a) {
    const s = a && a.currentSrc || (a && a.src) || '';
    if (s.includes('sfx/')) return 'sfx:' + s.split('/').pop();
    if (s.includes('voice/')) return 'voice:' + s.split('/').pop();
    if (s.startsWith('data:')) return 'data:silent';
    return s ? s : '?';
  }
  window.Audio = function(src) {
    const a = src == null ? new origAudio() : new origAudio(src);
    log('Audio() created', currentTag(a));
    // Every Audio counts — singleton narration OR sfx clones; we filter by
    // currentSrc at inspection time (see playAudibleWithin).
    (window.__kgbAudioElements = window.__kgbAudioElements || []).push(a);
    const origPlay = a.play.bind(a);
    a.play = function() {
      log('Audio.play()', currentTag(a));
      const p = origPlay();
      if (p && p.then) {
        p.then(() => log('Audio.play() OK', currentTag(a)))
         .catch((e) => log('Audio.play() REJECTED', currentTag(a), e && e.name));
      }
      return p;
    };
    const origPause = a.pause.bind(a);
    a.pause = function() {
      log('Audio.pause()', currentTag(a));
      return origPause();
    };
    ['play', 'playing', 'ended', 'pause'].forEach((ev) => {
      a.addEventListener(ev, () => {
        log('Audio evt <' + ev + '>', currentTag(a), 'ct=' + a.currentTime.toFixed(2));
        window.__kgbAudioEvents.push({ ev, label: currentTag(a), t: performance.now() - t0, ct: a.currentTime });
      });
    });
    return a;
  };
  window.Audio.prototype = origAudio.prototype;

  if (window.speechSynthesis) {
    const orig = window.speechSynthesis.cancel.bind(window.speechSynthesis);
    window.speechSynthesis.cancel = function() {
      log('speechSynthesis.cancel()');
      return orig();
    };
    const origSpeak = window.speechSynthesis.speak.bind(window.speechSynthesis);
    window.speechSynthesis.speak = function(u) {
      log('speechSynthesis.speak()', (u && u.text || '').slice(0, 40));
      return origSpeak(u);
    };
  }

  // React commit boundary: patch history.pushState to log route changes.
  const origPush = history.pushState.bind(history);
  history.pushState = function(...args) {
    log('history.pushState', args[2]);
    return origPush(...args);
  };
})();
`;

// AUDIBLE = narration actually played AT LEAST 500ms of audio, i.e. not
// stopped/faded within its opening fraction. This catches the "first round
// silent" bug where the say() succeeds but App's [route]-effect stopNarration
// interrupts the fresh clip almost immediately (fade-out under 300ms).
async function playAudibleWithin(page, ms) {
  const MIN_CT = 0.5;
  const deadline = Date.now() + ms;
  while (Date.now() < deadline) {
    const state = await page.evaluate(() => {
      const els = (window.__kgbAudioElements || []).filter((a) => (a.currentSrc || '').includes('voice/'));
      const nowPlaying = els.filter((a) => !a.paused && a.currentTime > 0);
      const dbg = window.__kgbAudioDebug || { playing: 0, lastSrc: '' };
      return {
        playing: dbg.playing || 0,
        count: els.length,
        maxCT: Math.max(0, ...els.map((a) => a.currentTime || 0)),
        stillPlayingCount: nowPlaying.length,
        lastSrc: dbg.lastSrc || '',
      };
    });
    // audible = the clip reached MIN_CT; do not require still-playing (short
    // clips can END before the poll — the fade-race kills at ~0.14s regardless)
    if (state.maxCT >= MIN_CT) return { audible: true, ...state };
    await new Promise((r) => setTimeout(r, 60));
  }
  const finalState = await page.evaluate(() => {
    const els = (window.__kgbAudioElements || []).filter((a) => (a.currentSrc || '').includes('voice/'));
    const dbg = window.__kgbAudioDebug || { playing: 0, lastSrc: '' };
    return {
      playing: dbg.playing || 0,
      count: els.length,
      maxCT: Math.max(0, ...els.map((a) => a.currentTime || 0)),
      lastSrc: dbg.lastSrc || '',
      log: window.__kgbLog || [],
    };
  });
  return { audible: false, ...finalState };
}

async function runScenario(browser, { name, deepLinkHash, tapCardSelector, dumpLog }) {
  const context = await browser.newContext();
  await context.addInitScript(INSTRUMENT);
  const page = await context.newPage();
  const consoleLines = [];
  page.on('console', (m) => consoleLines.push('[' + m.type() + '] ' + m.text()));

  const results = [];

  // --- scenario (a) COLD deep-link + first tap to unlock ---
  await page.goto(BASE + '#/' + deepLinkHash, { waitUntil: 'load' });
  await page.waitForTimeout(400);
  // First gesture: press a key. onFirstGesture listens for 'keydown'.
  // Clicking is dangerous because the game's back button lives at the top-left.
  await page.evaluate(() => { window.__kgbNarrationPlaying = 0; window.__kgbLog = []; window.__kgbAudioEvents = []; });
  await page.keyboard.press('Space');
  let s = await playAudibleWithin(page, WAIT_AUDIBLE_MS);
  results.push({ scenario: name + ':cold-deep-link', ...s });

  // --- scenario (b) HOME → CARD (the reported reproduction) ---
  await page.goto(BASE, { waitUntil: 'load' });
  await page.waitForTimeout(700);
  // Unlock audio with a keydown (avoid tripping any nav on the menu).
  await page.keyboard.press('Space');
  await page.waitForTimeout(200);
  // Now tap the game card. Reset counters right BEFORE the tap.
  await page.evaluate(() => { window.__kgbNarrationPlaying = 0; window.__kgbLog = []; window.__kgbAudioEvents = []; });
  const card = page.locator(tapCardSelector).first();
  await card.waitFor({ state: 'visible', timeout: 5000 });
  await card.click();
  // Story tap first lands on the picker; then pick a story.
  if (name === 'story') {
    await page.waitForTimeout(300);
    await page.evaluate(() => { window.__kgbNarrationPlaying = 0; window.__kgbLog = []; window.__kgbAudioEvents = []; });
    // Story picker options use ScenePicker; each option has testid based on id.
    const picked = page.locator('[data-testid="scene-luna"], [data-testid="scene-pick-luna"], [accessibilitylabel="luna"], [aria-label="luna"]').first();
    if (await picked.count()) {
      await picked.click();
    } else {
      // Fallback: click the first story-choice-labeled element within the picker.
      const opts = page.locator('button, [role="button"]');
      const n = await opts.count();
      // Skip header buttons; click one near the middle of the page
      for (let i = 0; i < Math.min(n, 20); i++) {
        const label = await opts.nth(i).getAttribute('aria-label').catch(() => null);
        if (label && /luna/i.test(label)) { await opts.nth(i).click(); break; }
      }
    }
  }
  s = await playAudibleWithin(page, WAIT_AUDIBLE_MS);
  results.push({ scenario: name + ':home-tap', ...s });

  // --- scenario (c) round-2 sanity: pick the odd tile so a NEW round mounts + speaks ---
  if (name === 'oddone') {
    await page.evaluate(() => {
      // Reset a marker so we can detect a NEW narration event.
      const dbg = window.__kgbAudioDebug || (window.__kgbAudioDebug = { playing: 0, lastSrc: '' });
      dbg.playing = 0; dbg.lastSrc = '';
    });
    const odd = page.locator('[data-testid*="-odd"]').first();
    if (await odd.count()) {
      await odd.click();
      const s3 = await playAudibleWithin(page, WAIT_AUDIBLE_MS);
      results.push({ scenario: name + ':round-2', ...s3 });
    }
  }

  // --- scenario (d) navigate-away mid-narration cancels the previous voice ---
  if (name === 'oddone') {
    await page.evaluate(() => { window.__kgbLog = []; window.__kgbAudioEvents = []; });
    // Enter a game so narration starts.
    await page.evaluate(() => { window.location.hash = '#/menu'; });
    await page.waitForTimeout(200);
    await page.evaluate(() => { window.location.hash = '#/oddone'; });
    // Give narration ~120ms to start (well before the ~2s clip ends).
    await page.waitForTimeout(160);
    const wasPlayingBefore = await page.evaluate(() => {
      const els = (window.__kgbAudioElements || []).filter((a) => (a.currentSrc || '').includes('voice/'));
      return els.some((a) => !a.paused && a.currentTime > 0);
    });
    // Navigate away mid-narration — nav.ts stopNarration should fade it.
    await page.evaluate(() => { window.location.hash = '#/menu'; });
    await page.waitForTimeout(500);
    const nowPaused = await page.evaluate(() => {
      const els = (window.__kgbAudioElements || []).filter((a) => (a.currentSrc || '').includes('voice/'));
      return els.length > 0 && els.every((a) => a.paused);
    });
    results.push({
      scenario: name + ':navaway-cancels',
      audible: wasPlayingBefore && nowPaused,
      count: 0, playing: 0, maxCT: 0,
    });
  }

  if (dumpLog) {
    console.log('---- console log (' + name + ') ----');
    consoleLines.slice(-120).forEach((l) => console.log(l));
    console.log('---- end console log ----');
  }
  await context.close();
  return results;
}

(async () => {
  const args = ['--no-sandbox'];
  if (STRICT) args.push('--autoplay-policy=user-gesture-required');
  const browser = await chromium.launch({ headless: HEADLESS, args });
  console.log('# repro-narration.mjs — strict=' + STRICT + ' base=' + BASE);
  const all = [];
  all.push({ scenario: 'oddone:stale-queue-after-backtap', audible: await staleQueueCheck(browser) ? true : false, _stale: true });
  const scenarios = [
    { name: 'oddone', deepLinkHash: 'oddone', tapCardSelector: '[data-testid="menu-oddone"]', dumpLog: true },
    { name: 'letters', deepLinkHash: 'letters', tapCardSelector: '[data-testid="menu-letters"]', dumpLog: false },
    // Story: base path shows the picker; deep-link to a story to trigger narration.
    { name: 'story',   deepLinkHash: 'story/luna', tapCardSelector: '[data-testid="menu-story"]', pickStory: 'luna', dumpLog: false },
  ];
  for (const s of scenarios) {
    try {
      const r = await runScenario(browser, s);
      all.push(...r);
    } catch (e) {
      console.error('!! scenario failed', s.name, e && e.message);
      all.push({ scenario: s.name + ':CRASH', audible: false, error: String(e && e.message) });
    }
  }
  await browser.close();

  console.log('\n===== RESULTS (audible = narration currentTime > 0 within ' + WAIT_AUDIBLE_MS + 'ms) =====');
  let failed = 0;
  for (const r of all) {
    const status = r.audible ? 'PASS' : 'FAIL';
    if (!r.audible) failed++;
    console.log(status.padEnd(4), r.scenario.padEnd(38), 'playing=' + (r.playing || 0), 'ct=' + ((r.maxCT || 0).toFixed(2)), 'audios=' + (r.count || 0));
    if (!r.audible && r.log) {
      console.log('  first 40 log entries:');
      r.log.slice(0, 40).forEach((e) => console.log('   ' + e.t + 'ms ' + e.msg));
    }
  }
  process.exit(failed ? 1 : 0);
})().catch((e) => {
  console.error(e);
  process.exit(2);
});

// Regression lock (reviewer finding #1): cold deep-link, then the kid's
// FIRST gesture is the back/home tap. The stale queued prompt must NOT
// play on the menu screen after navigation.
export async function staleQueueCheck(browser) {
  const context = await browser.newContext({ viewport: { width: 1180, height: 820 } });
  const page = await context.newPage();
  await page.addInitScript(`window.__kgbAudioDebug = { playing: 0, lastSrc: '' };`);
  await page.goto(BASE + '#/oddone');
  await page.waitForTimeout(1800); // pre-gesture: prompt gets queued, not played
  await page.locator('[data-testid="back-button"]').first().click(); // FIRST gesture = leave
  await page.waitForTimeout(1600);
  const dbg = await page.evaluate(() => window.__kgbAudioDebug);
  await context.close();
  const pass = (dbg?.playing ?? 0) === 0;
  console.log(`${pass ? 'PASS' : 'FAIL'} oddone:stale-queue-after-backtap`.padEnd(50) + ` playing=${dbg?.playing}`);
  return pass;
}
