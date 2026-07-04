import { describe, expect, it } from 'vitest';
import { DIFFICULTIES } from '../../difficulty';
import { manifest } from '../../manifest';
import { makeRng } from '../../rng';
import { buildBoard } from '../memory/logic';
import { isSolved, makePuzzle, swap } from '../puzzle/logic';

describe('memory match', () => {
  it.each([4, 6, 8])('builds a %i-pair board with each icon exactly twice', (pairs) => {
    for (let seed = 1; seed <= 20; seed++) {
      const board = buildBoard(makeRng(seed), manifest.spotit.icons, pairs);
      expect(board).toHaveLength(pairs * 2);
      const counts = new Map<string, number>();
      for (const c of board) counts.set(c.icon, (counts.get(c.icon) ?? 0) + 1);
      expect(counts.size).toBe(pairs);
      for (const n of counts.values()) expect(n).toBe(2);
      expect(new Set(board.map((c) => c.key)).size).toBe(board.length);
    }
  });
});

describe('picture puzzle', () => {
  it.each([6, 9, 12])('size %i: never starts solved, every piece once', (size) => {
    for (let seed = 1; seed <= 30; seed++) {
      const perm = makePuzzle(makeRng(seed), size);
      expect(perm).toHaveLength(size);
      expect(isSolved(perm)).toBe(false);
      expect(new Set(perm).size).toBe(size);
    }
  });

  it('swapping toward identity solves it', () => {
    let perm = makePuzzle(makeRng(7), 12);
    let guard = 0;
    while (!isSolved(perm) && guard++ < 30) {
      const pos = perm.findIndex((piece, i) => piece !== i);
      const target = perm.indexOf(pos);
      perm = swap(perm, pos, target);
    }
    expect(isSolved(perm)).toBe(true);
  });
});

describe('difficulty table', () => {
  it('is monotonic: harder means more rounds, pairs, tiles', () => {
    const { easy, medium, hard } = DIFFICULTIES;
    expect(easy.spotitRounds).toBeLessThan(medium.spotitRounds);
    expect(medium.spotitRounds).toBeLessThan(hard.spotitRounds);
    expect(easy.memoryPairs).toBeLessThan(medium.memoryPairs);
    expect(medium.memoryPairs).toBeLessThan(hard.memoryPairs);
    expect(easy.puzzleCols * easy.puzzleRows).toBeLessThan(medium.puzzleCols * medium.puzzleRows);
    expect(medium.puzzleCols * medium.puzzleRows).toBeLessThan(hard.puzzleCols * hard.puzzleRows);
    expect(easy.diffHint).toBe(true);
    expect(hard.hiddenSilhouette).toBe(true);
  });

  it('memory pairs never exceed available icons', () => {
    for (const d of Object.values(DIFFICULTIES)) {
      expect(d.memoryPairs).toBeLessThanOrEqual(manifest.spotit.icons.length);
    }
  });
});

describe('shadow match', () => {
  it('answer among options; options unique; transforms only when enabled', async () => {
    const { makeShadowRound } = await import('../shadow/logic');
    const diffs = [
      { choices: 3, categoryDistractors: false, transform: false },
      { choices: 4, categoryDistractors: true, transform: true },
      { choices: 5, categoryDistractors: true, transform: true },
    ];
    for (let seed = 1; seed <= 40; seed++) {
      for (const d of diffs) {
        const r = makeShadowRound(makeRng(seed * d.choices), manifest.spotit.icons, d);
        expect(r.options).toHaveLength(d.choices);
        expect(new Set(r.options).size).toBe(d.choices);
        expect(r.options).toContain(r.answer);
        if (!d.transform) {
          expect(r.rotation).toBe(0);
          expect(r.mirrored).toBe(false);
        }
      }
    }
  });
});

describe('odd one out (which does not belong)', () => {
  it('n-1 distinct same-category items + one intruder at oddIndex', async () => {
    const { makeOddOneRound } = await import('../oddone/logic');
    const { categoryOf } = await import('../iconCategories');
    for (let seed = 1; seed <= 40; seed++) {
      for (const n of [4, 6, 9]) {
        const r = makeOddOneRound(makeRng(seed * n), manifest.spotit.icons, n);
        expect(r.items).toHaveLength(n);
        expect(new Set(r.items).size).toBe(n); // all distinct
        expect(r.items[r.oddIndex]).toBe(r.odd);
        expect(categoryOf(r.odd)).toBe(r.oddCategory);
        expect(r.oddCategory).not.toBe(r.baseCategory);
        for (let i = 0; i < n; i++) {
          if (i !== r.oddIndex) expect(categoryOf(r.items[i])).toBe(r.baseCategory);
        }
      }
    }
  });
});

describe('rule time', () => {
  it('rounds have the right matches and recall flag', async () => {
    const { makeRules, makeRulesRound } = await import('../rules/logic');
    const { ICON_CATEGORIES } = await import('../iconCategories');
    for (let seed = 1; seed <= 30; seed++) {
      const rng = makeRng(seed);
      const rules = makeRules(rng, 5);
      expect(rules).toHaveLength(5);
      for (let idx = 0; idx < 5; idx++) {
        const round = makeRulesRound(rng, manifest.spotit.icons, rules, idx, 8, idx === 3);
        expect(round.tiles).toHaveLength(8);
        const matches = round.tiles.filter((t) => t.isMatch);
        expect(matches.length).toBe(round.matchCount);
        expect(matches.length).toBeGreaterThanOrEqual(2);
        for (const t of round.tiles) {
          const inCat = ICON_CATEGORIES[round.rule.category].includes(t.icon);
          expect(t.isMatch).toBe(inCat);
        }
        expect(round.isRecall).toBe(idx === 3);
      }
    }
  });
});
