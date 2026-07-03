import { describe, expect, it } from 'vitest';
import { makeRng } from '../../rng';
import { GRID_COLS, GRID_ROWS, NUM_DIFFS, THEMES, buildPuzzle } from '../diff/logic';
import { HIDDEN_COLS, HIDDEN_ROWS, SCENE_POOLS, buildHiddenPuzzle } from '../hidden/logic';
import { SYMBOLS, buildDeck, dealRound, sharedSymbol } from '../spotit/logic';

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

  it('uses 31 distinct emoji symbols', () => {
    expect(new Set(SYMBOLS).size).toBe(31);
  });
});

describe('find the difference', () => {
  it('generates exactly NUM_DIFFS differing cells and identical elsewhere', () => {
    for (let seed = 1; seed <= 50; seed++) {
      const p = buildPuzzle(makeRng(seed));
      expect(p.diffs).toHaveLength(NUM_DIFFS);
      const total = GRID_COLS * GRID_ROWS;
      for (let i = 0; i < total; i++) {
        if (p.diffs.includes(i)) {
          expect(p.left[i].emoji).not.toBe(p.right[i].emoji);
        } else {
          expect(p.left[i].emoji).toBe(p.right[i].emoji);
        }
      }
    }
  });

  it('left scene has no empty cells (differences only remove/swap on the right)', () => {
    for (let seed = 1; seed <= 20; seed++) {
      const p = buildPuzzle(makeRng(seed));
      for (const cell of p.left) expect(cell.emoji).not.toBe('');
    }
  });

  it('produces both swap and removal difference types across seeds', () => {
    let swaps = 0;
    let removals = 0;
    for (let seed = 1; seed <= 50; seed++) {
      const p = buildPuzzle(makeRng(seed));
      for (const idx of p.diffs) {
        if (p.right[idx].emoji === '') removals++;
        else swaps++;
      }
    }
    expect(swaps).toBeGreaterThan(0);
    expect(removals).toBeGreaterThan(0);
  });

  it('theme pools have no duplicate emoji', () => {
    for (const t of THEMES) {
      expect(new Set(t.pool).size).toBe(t.pool.length);
    }
  });
});

describe('hidden objects', () => {
  it('places each target exactly once and never as a filler', () => {
    for (let seed = 1; seed <= 50; seed++) {
      const p = buildHiddenPuzzle(makeRng(seed));
      expect(p.cells).toHaveLength(HIDDEN_COLS * HIDDEN_ROWS);
      for (const target of p.targets) {
        const matches = p.cells.filter((c) => c.emoji === target);
        expect(matches).toHaveLength(1);
        expect(matches[0].isTarget).toBe(true);
      }
      const targetCells = p.cells.filter((c) => c.isTarget);
      expect(targetCells).toHaveLength(p.targets.length);
    }
  });

  it('scene pools never overlap targets with fillers', () => {
    for (const pool of SCENE_POOLS) {
      for (const t of pool.targets) {
        expect(pool.fillers).not.toContain(t);
      }
      expect(new Set(pool.targets).size).toBe(pool.targets.length);
    }
  });
});
