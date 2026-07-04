import { Rng, shuffle } from '../../rng';
import { ICON_CATEGORIES } from '../iconCategories';

export interface OddOneRound {
  baseCategory: string;
  oddCategory: string;
  odd: string;
  items: string[]; // n-1 DISTINCT icons from baseCategory + the odd one
  oddIndex: number;
}

// "Which one does not belong?" — items are distinct members of one category
// plus a single intruder from another. Difficulty = more items + the number
// of rounds; the categorical judgement is the game.
export function makeOddOneRound(rng: Rng, icons: string[], n: number): OddOneRound {
  const cats = Object.entries(ICON_CATEGORIES)
    .map(([name, members]) => [name, members.filter((m) => icons.includes(m))] as const)
    .filter(([, members]) => members.length >= n - 1);
  const [baseCategory, baseMembers] = cats[Math.floor(rng() * cats.length)];
  const otherCats = Object.entries(ICON_CATEGORIES)
    .map(([name, members]) => [name, members.filter((m) => icons.includes(m))] as const)
    .filter(([name, members]) => name !== baseCategory && members.length > 0);
  const [oddCategory, oddMembers] = otherCats[Math.floor(rng() * otherCats.length)];

  const base = shuffle(rng, [...baseMembers]).slice(0, n - 1);
  const odd = oddMembers[Math.floor(rng() * oddMembers.length)];
  const items = shuffle(rng, [...base, odd]);
  return { baseCategory, oddCategory, odd, items, oddIndex: items.indexOf(odd) };
}
