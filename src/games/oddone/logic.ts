import { Rng, shuffle } from '../../rng';
import { CATEGORY_CONFLICTS, ICON_CATEGORIES } from '../iconCategories';

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
  // The intruder must come from a category the kid won't argue with. Rule
  // Time already refuses to use a conflicting category as a non-match
  // filler ("a butterfly is nature too"); the same doubt makes the same
  // pairing a bad intruder here — asked which one is NOT a flower, rainbow
  // or star, a kid who counts the butterfly as nature has nowhere to go.
  const conflicts = new Set(CATEGORY_CONFLICTS[baseCategory] ?? []);
  const eligible = Object.entries(ICON_CATEGORIES)
    .map(([name, members]) => [name, members.filter((m) => icons.includes(m))] as const)
    .filter(([name, members]) => name !== baseCategory && members.length > 0);
  // Defensive: a future conflict table could rule out every other category.
  // A conflicted intruder beats no round at all.
  const unconflicted = eligible.filter(([name]) => !conflicts.has(name));
  const otherCats = unconflicted.length ? unconflicted : eligible;
  const [oddCategory, oddMembers] = otherCats[Math.floor(rng() * otherCats.length)];

  const base = shuffle(rng, [...baseMembers]).slice(0, n - 1);
  const odd = oddMembers[Math.floor(rng() * oddMembers.length)];
  const items = shuffle(rng, [...base, odd]);
  return { baseCategory, oddCategory, odd, items, oddIndex: items.indexOf(odd) };
}
