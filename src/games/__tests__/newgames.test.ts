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
