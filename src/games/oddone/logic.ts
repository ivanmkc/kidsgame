import { Rng, shuffle } from '../../rng';

export interface OddOneRound {
  odd: string; // the different icon
  items: string[]; // n-1 copies of the common icon + 1 odd, shuffled
  oddIndex: number;
}

export function makeOddOneRound(rng: Rng, icons: string[], n: number): OddOneRound {
  const [common, odd] = shuffle(rng, icons).slice(0, 2);
  const items = shuffle(rng, [...Array(n - 1).fill(common), odd]);
  return { odd, items, oddIndex: items.indexOf(odd) };
}
