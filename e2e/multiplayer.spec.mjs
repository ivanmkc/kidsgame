// Playwright drive of the 2-Player experiment across the exported web build.
// Run: node e2e/multiplayer.spec.mjs   (expects dist served on :8791)
import assert from 'node:assert';
import { mkdirSync } from 'node:fs';
import { createRequire } from 'node:module';

const require = createRequire('/home/ivanmkc/termchart/package.json');
const { chromium } = require('playwright');

const BASE = 'http://localhost:8791/kidsgame/';
const SHOT_DIR = new URL('../.verify/', import.meta.url).pathname;
mkdirSync(SHOT_DIR, { recursive: true });

const tid = (id) => `[data-testid="${id}"]`;
let page;
let shotN = 0;
const shot = async (name) => {
  shotN += 1;
  await page.screenshot({ path: `${SHOT_DIR}${String(shotN).padStart(2, '0')}-${name}.png` });
};
const count = (sel) => page.locator(sel).count();
const gotoFresh = async () => {
  await page.goto(BASE);
  await page.evaluate(() => localStorage.clear());
  await page.goto(BASE + '#/menu');
  await page.reload();
  await page.waitForSelector(tid('mp-toggle'), { timeout: 15000 });
};
const goMenu = async () => {
  await page.goto(BASE + '#/menu');
  await page.waitForSelector(tid('mp-toggle'));
};
const enable2P = async () => { await page.click(tid('mp-toggle')); };

const symsOf = async (prefix) => {
  const els = await page.locator(`[data-testid^="${prefix}"]`).all();
  const out = [];
  for (const el of els) {
    const t = await el.getAttribute('data-testid');
    out.push(Number(t.slice(prefix.length)));
  }
  return out;
};
const intersect = (a, b) => a.filter((x) => b.includes(x));

async function test1_toggleOffZeroChange() {
  await gotoFresh();
  assert.equal(await count(tid('mp-toggle')), 1, 'mp-toggle chip on menu');
  await shot('menu-toggle-off');

  // spotit
  await page.click(tid('menu-spotit'));
  await page.waitForSelector(tid('spotit-score'));
  assert.equal(await count(tid('mp-choose-1p')), 0, 'spotit: no chooser');
  assert.equal(await count(tid('mp-choose-2p')), 0);
  assert.ok((await symsOf('top-symbol-')).length === 6, 'spotit solo top card intact');
  assert.ok((await symsOf('bottom-symbol-')).length === 6, 'spotit solo bottom card intact');
  await shot('spotit-solo-unchanged');

  // hidden
  await goMenu();
  await page.click(tid('menu-hidden'));
  await page.waitForSelector(tid('scene-surprise'));
  assert.equal(await count(tid('mp-choose-2p')), 0, 'hidden picker: no chooser');
  const firstScene = page.locator('[data-testid^="scene-pick-"]').first();
  await firstScene.click();
  await page.waitForSelector(tid('hidden-checklist'));
  assert.equal(await count(tid('hidden-timer')), 1, 'hidden solo: timer shown (medium)');
  assert.equal(await count(tid('hidden-turn-banner')), 0, 'hidden solo: no turn banner');
  assert.equal(await count(tid('hidden-player-chip-0')), 0, 'hidden solo: no player chips');
  await shot('hidden-solo-unchanged');

  // memory
  await goMenu();
  await page.click(tid('menu-memory'));
  await page.waitForSelector(tid('memory-score'));
  assert.equal(await count(tid('mp-choose-2p')), 0, 'memory: no chooser');
  assert.equal(await count(tid('memory-moves')), 1, 'memory solo: Moves line');
  assert.equal(await count(tid('memory-timer')), 1, 'memory solo: timer');
  assert.equal(await count(tid('memory-turn-halo')), 0, 'memory solo: no halo');
  assert.equal(await count(tid('memory-duel-chip-0')), 0, 'memory solo: no duel chips');
  await shot('memory-solo-unchanged');

  // persistence: reload keeps the toggle off
  await goMenu();
  await page.reload();
  await page.waitForSelector(tid('mp-toggle'));
  const stored = await page.evaluate(() => localStorage.getItem('kgb.twoPlayer.v1'));
  assert.ok(stored === null || stored === 'off', 'default persists OFF');
  await page.click(tid('menu-spotit'));
  await page.waitForSelector(tid('spotit-score'));
  assert.equal(await count(tid('mp-choose-2p')), 0, 'still solo after reload');
  console.log('PASS test 1 — toggle OFF is zero UI change');
}

async function test2_spotitDuel() {
  await gotoFresh();
  await enable2P();
  assert.equal(await page.evaluate(() => localStorage.getItem('kgb.twoPlayer.v1')), 'on');
  await page.reload();
  await page.waitForSelector(tid('mp-toggle'));
  assert.equal(await page.evaluate(() => localStorage.getItem('kgb.twoPlayer.v1')), 'on', 'toggle survives reload');
  await shot('menu-toggle-on');

  await page.click(tid('menu-spotit'));
  await page.waitForSelector(tid('mp-choose-2p'));
  await shot('spotit-mode-picker');
  await page.click(tid('mp-choose-2p'));
  await page.waitForSelector(tid('duel-countdown'));
  await shot('spotit-duel-countdown');

  // taps during the countdown must do nothing
  const early = page.locator('[data-testid^="duel-a-my-symbol-"]').first();
  await early.click({ force: true });
  await page.waitForSelector(tid('duel-countdown'), { state: 'detached', timeout: 6000 });
  let labA = await page.locator(tid('duel-score-a')).getAttribute('aria-label');
  assert.equal(labA, 'Foxy has 0 stars', 'countdown tap ignored');

  // derive zone A's answer with no seed knowledge: own ∩ shared must be exactly one
  const aMy = await symsOf('duel-a-my-symbol-');
  const aShared = await symsOf('duel-a-shared-symbol-');
  assert.equal(aMy.length, 6); assert.equal(aShared.length, 6);
  const aAns = intersect(aMy, aShared);
  assert.equal(aAns.length, 1, 'deck invariant: exactly one shared symbol in zone A');
  const bMy = await symsOf('duel-b-my-symbol-');
  const bShared = await symsOf('duel-b-shared-symbol-');
  const bAns = intersect(bMy, bShared);
  assert.equal(bAns.length, 1, 'deck invariant: exactly one shared symbol in zone B');
  assert.notEqual(aAns[0], bAns[0], 'answerA !== answerB (no copy-sniping)');

  // wrong tap: zone A freezes ~700ms, zone B stays live, score unchanged
  const wrongSym = aMy.find((s) => s !== aAns[0]);
  await page.click(tid(`duel-a-my-symbol-${wrongSym}`));
  await shot('spotit-duel-wrong-freeze');
  await page.click(tid(`duel-a-my-symbol-${aAns[0]}`), { force: true }); // frozen: must be ignored
  labA = await page.locator(tid('duel-score-a')).getAttribute('aria-label');
  assert.equal(labA, 'Foxy has 0 stars', 'frozen zone cannot score');
  const zoneBLive = await page.locator(tid(`duel-b-my-symbol-${bMy[0]}`)).isEnabled();
  assert.ok(zoneBLive, 'zone B still tappable during A freeze');

  await page.waitForTimeout(800); // freeze over
  await page.click(tid(`duel-a-my-symbol-${aAns[0]}`));
  await page.waitForFunction(
    () => document.querySelector('[data-testid="duel-score-a"]')?.getAttribute('aria-label') === 'Foxy has 1 stars',
    null, { timeout: 3000 }
  );
  const labB = await page.locator(tid('duel-score-b')).getAttribute('aria-label');
  assert.equal(labB, 'Bunny has 0 stars', 'only the scorer is credited');
  await shot('spotit-duel-scored');

  // round redeals: a fresh zone-A card set appears
  await page.waitForTimeout(1400);
  const aMy2 = await symsOf('duel-a-my-symbol-');
  assert.equal(aMy2.length, 6, 'redealt');
  assert.notDeepEqual([...aMy2].sort(), [...aMy].sort(), 'new round cards differ');
  await shot('spotit-duel-redealt');
  console.log('PASS test 2 — spotit 2P duel round');
}

async function test3_hiddenCoop() {
  await goMenu();
  await page.click(tid('menu-hidden'));
  await page.waitForSelector(tid('mp-choose-2p'));
  await shot('hidden-mode-picker');
  await page.click(tid('mp-choose-2p'));
  await page.waitForSelector(tid('scene-surprise'));
  await page.locator('[data-testid^="scene-pick-"]').first().click();
  await page.waitForSelector(tid('hidden-turn-banner'));

  let banner = await page.locator(tid('hidden-turn-banner')).getAttribute('aria-label');
  assert.ok(banner.includes('Foxy'), `first scene starter is Foxy (got ${banner})`);
  assert.equal(await count(tid('hidden-timer')), 0, 'timer hidden in co-op');
  const chips = await page.locator('[data-testid^="checklist-"]:not([data-testid$="-finder"])').count();
  assert.equal(chips % 2, 0, `co-op draw is even (got ${chips})`);
  await shot('hidden-coop-start');

  // miss never passes the turn
  await page.click(tid('hidden-backdrop'), { position: { x: 4, y: 4 } });
  banner = await page.locator(tid('hidden-turn-banner')).getAttribute('aria-label');
  assert.ok(banner.includes('Foxy'), 'miss keeps the turn');

  // hit: credited to the turn holder, turn flips
  const targets = await page.locator('[data-testid^="hidden-target-"]').all();
  const targetIds = [];
  for (const t of targets) targetIds.push((await t.getAttribute('data-testid')).replace('hidden-target-', ''));

  await page.click(tid(`hidden-target-${targetIds[0]}`));
  await page.waitForSelector(tid(`checklist-${targetIds[0]}-finder`));
  const badge = await page.locator(tid(`checklist-${targetIds[0]}-finder`)).innerText();
  assert.ok(badge.includes('🦊'), 'finder badge is the fox');
  banner = await page.locator(tid('hidden-turn-banner')).getAttribute('aria-label');
  assert.ok(banner.includes('Bunny'), 'turn flipped to Bunny');
  let chip0 = await page.locator(tid('hidden-player-chip-0')).getAttribute('aria-label');
  assert.equal(chip0, 'Foxy has 1');
  await shot('hidden-coop-first-find');

  await page.click(tid(`hidden-target-${targetIds[1]}`));
  await page.waitForSelector(tid(`checklist-${targetIds[1]}-finder`));
  const badge2 = await page.locator(tid(`checklist-${targetIds[1]}-finder`)).innerText();
  assert.ok(badge2.includes('🐰'), 'second find credited to the bunny');
  banner = await page.locator(tid('hidden-turn-banner')).getAttribute('aria-label');
  assert.ok(banner.includes('Foxy'), 'turn back to Foxy');

  // finish the scene
  for (const id of targetIds.slice(2)) {
    await page.click(tid(`hidden-target-${id}`));
    await page.waitForTimeout(150);
  }
  await page.waitForSelector(tid('win-overlay'));
  const overlayText = await page.locator(tid('win-overlay')).innerText();
  assert.ok(overlayText.includes('teamwork'), 'co-op win message is about teamwork');
  assert.ok(!/Foxy wins|Bunny wins/.test(overlayText), 'no winner on the co-op overlay');
  chip0 = await page.locator(tid('hidden-player-chip-0')).getAttribute('aria-label');
  const chip1 = await page.locator(tid('hidden-player-chip-1')).getAttribute('aria-label');
  const n0 = Number(chip0.replace(/\D/g, ''));
  const n1 = Number(chip1.replace(/\D/g, ''));
  assert.equal(Math.abs(n0 - n1), 0, `completed even scene splits evenly (${n0} vs ${n1})`);
  await shot('hidden-coop-win');
  console.log('PASS test 3 — hidden co-op turn alternation');
}

async function test4_memoryDuel() {
  await goMenu();
  await page.click(tid('menu-memory'));
  await page.waitForSelector(tid('mp-choose-2p'));
  await page.click(tid('mp-choose-2p'));
  await page.waitForSelector(tid('memory-turn-halo'));
  await shot('memory-duel-start');

  const names = { Foxy: 0, Bunny: 1 };
  const haloName = async () =>
    (await page.locator(tid('memory-turn-halo')).getAttribute('aria-label')).split("'")[0];
  const chipCount = async (ix) =>
    Number((await page.locator(tid(`memory-duel-chip-${ix}`)).getAttribute('aria-label')).replace(/\D/g, ''));

  // group cards by icon from the DOM
  const cards = await page.locator('[data-testid^="memory-card-"]').all();
  const byIcon = {};
  for (const c of cards) {
    const t = await c.getAttribute('data-testid'); // memory-card-<key>-<icon>
    const m = t.match(/^memory-card-(\d+)-(.+)$/);
    (byIcon[m[2]] ??= []).push(t);
  }
  const icons = Object.keys(byIcon);
  assert.ok(icons.every((i) => byIcon[i].length === 2), 'every icon appears exactly twice');

  // MATCH: same player scores AND keeps the turn (extra-turn rule)
  const p0 = await haloName();
  const ix0 = names[p0];
  const before = await chipCount(ix0);
  await page.click(tid(byIcon[icons[0]][0]));
  await page.click(tid(byIcon[icons[0]][1]));
  await page.waitForTimeout(400);
  assert.equal(await chipCount(ix0), before + 1, 'scorer credited');
  assert.equal(await haloName(), p0, 'halo UNCHANGED after a match (extra turn)');
  await shot('memory-duel-match-extraturn');

  // MISS: after the 750ms flip-back the halo flips, nobody credited
  const beforeMiss = [await chipCount(0), await chipCount(1)];
  await page.click(tid(byIcon[icons[1]][0]));
  await page.click(tid(byIcon[icons[2]][0]));
  // hammer-tap a third card while two are face-up → must stay face-down
  await page.click(tid(byIcon[icons[3]][0]), { force: true });
  const third = await page.locator(tid(byIcon[icons[3]][0])).getAttribute('aria-label');
  assert.equal(third, 'face-down card', 'third tap ignored while two are up');
  await page.waitForTimeout(1100);
  assert.notEqual(await haloName(), p0, 'halo flipped after a miss');
  assert.deepEqual([await chipCount(0), await chipCount(1)], beforeMiss, 'miss credits nobody');
  await shot('memory-duel-miss-flip');

  // play out the remaining pairs with icon knowledge
  for (const icon of icons.slice(1)) {
    await page.click(tid(byIcon[icon][0]));
    await page.click(tid(byIcon[icon][1]));
    await page.waitForTimeout(350);
  }
  await page.waitForSelector(tid('memory-win-stats'));
  const c0 = await chipCount(0);
  const c1 = await chipCount(1);
  const winIx = c0 === c1 ? 'tie' : c0 > c1 ? 0 : 1;
  const stats = page.locator(tid('memory-win-stats'));
  const statsText = await stats.innerText();
  assert.ok(statsText.includes('👑'), 'crown shown on the win stats');
  if (winIx !== 'tie') {
    const winCol = stats.locator('> *').nth(winIx);
    assert.ok((await winCol.innerText()).includes('👑'), 'crown sits above the higher count');
    const loseCol = stats.locator('> *').nth(1 - winIx);
    assert.ok(!(await loseCol.innerText()).includes('👑'), 'no crown for the runner-up');
  }
  const overlayText = await page.locator(tid('win-overlay')).innerText();
  assert.ok(!overlayText.toLowerCase().includes('lose'), 'the word "lose" never appears');
  await shot('memory-duel-win');

  // rematch: 0-0 and the non-winner starts
  await page.waitForTimeout(700); // tap-shield arms
  await page.click(tid('play-again'));
  await page.waitForSelector(tid('memory-turn-halo'));
  assert.deepEqual([await chipCount(0), await chipCount(1)], [0, 0], 'rematch resets scores');
  if (winIx !== 'tie') {
    const starter = await haloName();
    assert.equal(names[starter], 1 - winIx, 'non-winner starts the rematch');
  }
  await shot('memory-duel-rematch');
  console.log('PASS test 4 — memory duel extra-turn rule');
}

async function test5_toggleBackOff() {
  await goMenu();
  await page.click(tid('mp-toggle')); // OFF again
  for (const game of ['spotit', 'hidden', 'memory']) {
    await goMenu();
    await page.click(tid(`menu-${game}`));
    await page.waitForTimeout(600);
    assert.equal(await count(tid('mp-choose-2p')), 0, `${game}: no chooser after toggling off`);
  }
  await page.waitForSelector(tid('memory-moves'));
  await shot('toggle-off-again-memory-solo');
  console.log('PASS test 5 — live toggle respected on re-entry');
}

const browser = await chromium.launch();
try {
  const ctx = await browser.newContext({ viewport: { width: 768, height: 1024 } }); // iPad portrait
  page = ctx.newPage ? await ctx.newPage() : null;
  await test1_toggleOffZeroChange();
  await test2_spotitDuel();
  await test3_hiddenCoop();
  await test4_memoryDuel();
  await test5_toggleBackOff();
  console.log('ALL E2E TESTS PASSED');
} finally {
  await browser.close();
}
