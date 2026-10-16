import { describe, expect, it } from 'vitest';
import { makeRng, randInt, shuffle, sample } from '../rng';

describe('rng', () => {
  it('makeRng produces the same sequence for the same seed', () => {
    const r1 = makeRng(12345);
    const seq1 = [r1(), r1(), r1(), r1()];

    const r2 = makeRng(12345);
    const seq2 = [r2(), r2(), r2(), r2()];

    expect(seq1).toEqual(seq2);
    
    const r3 = makeRng(54321);
    const seq3 = [r3(), r3(), r3(), r3()];
    expect(seq1).not.toEqual(seq3);
  });

  it('randInt generates integers up to maxExclusive', () => {
    const rng = makeRng(123);
    const maxExclusive = 5;
    for (let i = 0; i < 50; i++) {
      const v = randInt(rng, maxExclusive);
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(maxExclusive);
      expect(Number.isInteger(v)).toBe(true);
    }
  });

  it('shuffle returns a permutation and leaves input untouched', () => {
    const rng = makeRng(42);
    const input = [1, 2, 3, 4, 5];
    const inputCopy = [...input];

    const result = shuffle(rng, input);

    // Leaves input untouched
    expect(input).toEqual(inputCopy);

    // Returns a permutation
    expect(result).not.toBe(input);
    expect([...result].sort()).toEqual([...input].sort());
  });

  it('sample returns up to k items and caps at array length', () => {
    const rng1 = makeRng(42);
    const rng2 = makeRng(42);
    const input = [1, 2, 3, 4, 5];

    const result1 = sample(rng1, input, 3);
    expect(result1.length).toBe(3);
    
    // Sample is based on shuffle
    const expectedShuffle = shuffle(rng2, input);
    expect(result1).toEqual(expectedShuffle.slice(0, 3));

    // Caps at array length
    const rng3 = makeRng(42);
    const result2 = sample(rng3, input, 10);
    expect(result2.length).toBe(5);
    expect([...result2].sort()).toEqual([...input].sort());
  });
});
