import { Rng, shuffle } from '../../rng';

// perm[position] = which piece sits at that position. Solved = identity.
export function makePuzzle(rng: Rng, size: number): number[] {
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
