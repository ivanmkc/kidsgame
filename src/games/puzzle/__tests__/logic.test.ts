import { describe, expect, it } from 'vitest';
import { makeRng } from '../../../rng';
import { isSolved, makePuzzle, swap } from '../logic';

describe('makePuzzle', () => {
  it('returns empty array immediately for size 0 without looping infinitely', () => {
    const rng = makeRng(42);
    expect(makePuzzle(rng, 0)).toEqual([]);
  });

  it('returns [0] immediately for size 1 without looping infinitely', () => {
    const rng = makeRng(42);
    expect(makePuzzle(rng, 1)).toEqual([0]);
  });

  it('generates an unsolved permutation for size >= 2', () => {
    const rng = makeRng(42);
    const puzzle2 = makePuzzle(rng, 2);
    expect(puzzle2).toEqual([1, 0]);
    expect(isSolved(puzzle2)).toBe(false);

    const puzzle6 = makePuzzle(rng, 6);
    expect(puzzle6).toHaveLength(6);
    expect(isSolved(puzzle6)).toBe(false);
    expect([...puzzle6].sort((a, b) => a - b)).toEqual([0, 1, 2, 3, 4, 5]);
  });
});

describe('isSolved', () => {
  it('identifies solved and unsolved permutations', () => {
    expect(isSolved([])).toBe(true);
    expect(isSolved([0])).toBe(true);
    expect(isSolved([0, 1, 2])).toBe(true);
    expect(isSolved([1, 0])).toBe(false);
    expect(isSolved([0, 2, 1])).toBe(false);
  });
});

describe('swap', () => {
  it('swaps elements at two positions without mutating original array', () => {
    const original = [0, 1, 2, 3];
    const swapped = swap(original, 1, 3);
    expect(swapped).toEqual([0, 3, 2, 1]);
    expect(original).toEqual([0, 1, 2, 3]);
  });
});
