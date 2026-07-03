import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { manifest } from '../../manifest';
import { makeRng } from '../../rng';
import { SYMBOLS, buildDeck, dealRound, sharedSymbol } from '../spotit/logic';

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
    expect(existsSync(join(ASSETS, '..', 'game', scene.imageA))).toBe(true);
    expect(existsSync(join(ASSETS, '..', 'game', scene.imageB))).toBe(true);
    expect(scene.diffs.length).toBeGreaterThanOrEqual(4);
    for (const d of scene.diffs) {
      expect(d.x).toBeGreaterThanOrEqual(0);
      expect(d.y).toBeGreaterThanOrEqual(0);
      expect(d.x + d.w).toBeLessThanOrEqual(scene.w);
      expect(d.y + d.h).toBeLessThanOrEqual(scene.h);
    }
    for (let i = 0; i < scene.diffs.length; i++) {
      for (let j = i + 1; j < scene.diffs.length; j++) {
        expect(overlaps(scene.diffs[i], scene.diffs[j]), `diffs ${i},${j} overlap`).toBe(false);
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
    expect(scene.targets.length).toBeGreaterThanOrEqual(5);
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
