import { describe, expect, it } from 'vitest';
import manifest from '../../assets/manifest.json';
import { makeRng } from '../../rng';
import { MEMORY_PAIRS, buildBoard } from '../memory/logic';
import { PUZZLE_N, isSolved, makePuzzle, swap } from '../puzzle/logic';

describe('memory match', () => {
  it('builds a board with each icon appearing exactly twice', () => {
    for (let seed = 1; seed <= 30; seed++) {
      const board = buildBoard(makeRng(seed), manifest.spotit.icons);
      expect(board).toHaveLength(MEMORY_PAIRS * 2);
      const counts = new Map<string, number>();
      for (const c of board) counts.set(c.icon, (counts.get(c.icon) ?? 0) + 1);
      expect(counts.size).toBe(MEMORY_PAIRS);
      for (const n of counts.values()) expect(n).toBe(2);
      expect(new Set(board.map((c) => c.key)).size).toBe(board.length);
    }
  });
});

describe('picture puzzle', () => {
  it('never starts solved and every piece appears once', () => {
    for (let seed = 1; seed <= 50; seed++) {
      const perm = makePuzzle(makeRng(seed));
      expect(perm).toHaveLength(PUZZLE_N * PUZZLE_N);
      expect(isSolved(perm)).toBe(false);
      expect(new Set(perm).size).toBe(perm.length);
    }
  });

  it('swapping toward identity solves it', () => {
    let perm = makePuzzle(makeRng(7));
    let guard = 0;
    while (!isSolved(perm) && guard++ < 20) {
      const pos = perm.findIndex((piece, i) => piece !== i);
      const target = perm.indexOf(pos);
      perm = swap(perm, pos, target);
    }
    expect(isSolved(perm)).toBe(true);
  });
});
