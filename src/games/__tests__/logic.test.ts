import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { manifest } from '../../manifest';
import { makeRng } from '../../rng';
import { SYMBOLS, buildDeck, dealDuelRound, dealRound, hintAfterMs, leaderDealDelayMs, sharedSymbol } from '../spotit/logic';

const ASSETS = join(__dirname, '../../../assets/game');

describe('spot it deck', () => {
  const deck = buildDeck();

  it('has 31 cards of 6 symbols each, all symbol indices valid', () => {
    expect(deck).toHaveLength(31);
    for (const card of deck) {
      expect(card).toHaveLength(6);
      expect(new Set(card).size).toBe(6);
      for (const s of card) {
        expect(s).toBeGreaterThanOrEqual(0);
        expect(s).toBeLessThan(SYMBOLS.length);
      }
    }
  });

  it('every pair of cards shares exactly one symbol', () => {
    for (let i = 0; i < deck.length; i++) {
      for (let j = i + 1; j < deck.length; j++) {
        expect(() => sharedSymbol(deck[i], deck[j])).not.toThrow();
      }
    }
  });

  it('deals rounds whose answer is on both cards', () => {
    const rng = makeRng(42);
    for (let r = 0; r < 200; r++) {
      const round = dealRound(rng, deck);
      expect(round.top).toContain(round.answer);
      expect(round.bottom).toContain(round.answer);
    }
  });
});

describe('spot it duel', () => {
  const deck = buildDeck();
  const key = (c: number[]) => [...c].sort((x, y) => x - y).join(',');

  it('deals 3 distinct cards; answers validate via sharedSymbol; answerA !== answerB', () => {
    const rng = makeRng(7);
    for (let r = 0; r < 300; r++) {
      const d = dealDuelRound(rng, deck);
      expect(new Set([key(d.center), key(d.a), key(d.b)]).size).toBe(3);
      expect(sharedSymbol(d.a, d.center)).toBe(d.answerA);
      expect(sharedSymbol(d.b, d.center)).toBe(d.answerB);
      expect(d.center).toContain(d.answerA);
      expect(d.center).toContain(d.answerB);
      expect(d.answerA).not.toBe(d.answerB);
    }
  });

  it('is deterministic for a given seed', () => {
    const rng1 = makeRng(1234);
    const rng2 = makeRng(1234);
    for (let r = 0; r < 20; r++) {
      expect(dealDuelRound(rng1, deck)).toEqual(dealDuelRound(rng2, deck));
    }
  });

  it('leaderDealDelayMs: 0 below a 2-lead, then 400·(lead−1) capped at 1200ms', () => {
    expect(leaderDealDelayMs(0, 0)).toBe(0);
    expect(leaderDealDelayMs(1, 0)).toBe(0);
    expect(leaderDealDelayMs(0, 3)).toBe(0); // trailing kid never waits
    expect(leaderDealDelayMs(2, 0)).toBe(400);
    expect(leaderDealDelayMs(3, 0)).toBe(800);
    expect(leaderDealDelayMs(4, 0)).toBe(1200);
    expect(leaderDealDelayMs(9, 0)).toBe(1200); // cap
  });

  it('hintAfterMs: no hint unless trailing by ≥2, then baseSecs·1000', () => {
    expect(hintAfterMs(0, 0, 3)).toBe(Infinity);
    expect(hintAfterMs(0, 1, 3)).toBe(Infinity);
    expect(hintAfterMs(3, 1, 3)).toBe(Infinity); // leader gets no hint
    expect(hintAfterMs(0, 2, 3)).toBe(3000);
    expect(hintAfterMs(1, 4, 5)).toBe(5000);
  });
});

describe('asset manifest: spot it icons', () => {
  it('has 31 unique icons matching the deck symbol space', () => {
    expect(manifest.spotit.icons).toHaveLength(SYMBOLS.length);
    expect(new Set(manifest.spotit.icons).size).toBe(SYMBOLS.length);
  });

  it('every icon sprite exists on disk', () => {
    for (const name of manifest.spotit.icons) {
      expect(existsSync(join(ASSETS, 'spotit', `${name}.png`)), name).toBe(true);
    }
  });
});

function overlaps(a: { x: number; y: number; w: number; h: number }, b: typeof a): boolean {
  return a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;
}

describe('asset manifest: find the difference', () => {
  it('has at least 3 scenes', () => {
    expect(manifest.diff.length).toBeGreaterThanOrEqual(3);
  });

  it.each(manifest.diff.map((s) => [s.id, s] as const))('%s: valid diffs and files', (_id, scene) => {
    // pooled schema: one base + composable patches; legacy: flat A/B pair
    const regions = scene.pool ?? scene.diffs ?? [];
    if (scene.pool && scene.image) {
      expect(existsSync(join(ASSETS, '..', 'game', scene.image))).toBe(true);
      for (const e of scene.pool) {
        expect(existsSync(join(ASSETS, '..', 'game', e.patch)), e.patch).toBe(true);
      }
    } else {
      expect(existsSync(join(ASSETS, '..', 'game', scene.imageA!))).toBe(true);
      expect(existsSync(join(ASSETS, '..', 'game', scene.imageB!))).toBe(true);
    }
    expect(regions.length).toBeGreaterThanOrEqual(4);
    for (const d of regions) {
      expect(d.x).toBeGreaterThanOrEqual(0);
      expect(d.y).toBeGreaterThanOrEqual(0);
      expect(d.x + d.w).toBeLessThanOrEqual(scene.w);
      expect(d.y + d.h).toBeLessThanOrEqual(scene.h);
    }
    for (let i = 0; i < regions.length; i++) {
      for (let j = i + 1; j < regions.length; j++) {
        expect(overlaps(regions[i], regions[j]), `diffs ${i},${j} overlap`).toBe(false);
      }
    }
  });
});

describe('asset manifest: hidden objects', () => {
  it('has at least 2 scenes', () => {
    expect(manifest.hidden.length).toBeGreaterThanOrEqual(2);
  });

  it.each(manifest.hidden.map((s) => [s.id, s] as const))('%s: valid targets and files', (_id, scene) => {
    expect(existsSync(join(ASSETS, '..', 'game', scene.image))).toBe(true);
    expect(scene.targets.length).toBeGreaterThanOrEqual(4);
    expect(new Set(scene.targets.map((t) => t.id)).size).toBe(scene.targets.length);
    for (const t of scene.targets) {
      expect(existsSync(join(ASSETS, '..', 'game', t.thumb)), t.thumb).toBe(true);
      expect(t.x).toBeGreaterThanOrEqual(0);
      expect(t.y).toBeGreaterThanOrEqual(0);
      expect(t.x + t.w).toBeLessThanOrEqual(scene.w);
      expect(t.y + t.h).toBeLessThanOrEqual(scene.h);
    }
    for (let i = 0; i < scene.targets.length; i++) {
      for (let j = i + 1; j < scene.targets.length; j++) {
        expect(overlaps(scene.targets[i], scene.targets[j]), `targets ${i},${j} overlap`).toBe(false);
      }
    }
  });
});
