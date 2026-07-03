import { Rng, shuffle } from '../../rng';

export const PUZZLE_N = 3; // 3x3

// perm[position] = which piece sits at that position. Solved = identity.
export function makePuzzle(rng: Rng, n = PUZZLE_N): number[] {
  const size = n * n;
  let perm: number[];
  do {
    perm = shuffle(rng, Array.from({ length: size }, (_, i) => i));
  } while (isSolved(perm));
  return perm;
}

export function isSolved(perm: number[]): boolean {
  return perm.every((piece, pos) => piece === pos);
}

export function swap(perm: number[], a: number, b: number): number[] {
  const next = perm.slice();
  [next[a], next[b]] = [next[b], next[a]];
  return next;
}
