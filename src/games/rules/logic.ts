import { Rng, shuffle } from '../../rng';
import { ICON_CATEGORIES } from '../iconCategories';

export interface Rule {
  category: string;
  label: string; // "Tap all the ANIMALS!"
}

export interface RulesRound {
  ruleNumber: number; // 1-based
  rule: Rule;
  isRecall: boolean; // hard mode: the rule text is hidden ("Do Rule #N!")
  tiles: { icon: string; isMatch: boolean }[];
  matchCount: number;
}

const CATEGORY_LABELS: Record<string, string> = {
  animals: 'Tap all the ANIMALS! 🐾',
  nature: 'Tap the FLOWERS, RAINBOWS & STARS! 🌸',
  food: 'Tap all the YUMMY FOOD! 🍎',
  things: 'Tap the TOYS & VEHICLES! 🚗',
};

export function makeRules(rng: Rng, count: number): Rule[] {
  const cats = shuffle(rng, Object.keys(CATEGORY_LABELS));
  return Array.from({ length: count }, (_, i) => {
    const category = cats[i % cats.length];
    return { category, label: CATEGORY_LABELS[category] };
  });
}

export function makeRulesRound(
  rng: Rng,
  icons: string[],
  rules: Rule[],
  ruleIndex: number,
  tileCount: number,
  isRecall: boolean,
): RulesRound {
  const rule = rules[ruleIndex];
  const inCat = ICON_CATEGORIES[rule.category].filter((m) => icons.includes(m));
  let outCat = icons.filter((i) => !ICON_CATEGORIES[rule.category].includes(i));
  if (rule.category === 'nature') {
    // animals are arguably "nature" too — keep them out of nature rounds
    outCat = outCat.filter((i) => !ICON_CATEGORIES.animals.includes(i));
  }
  const matchCount = Math.min(2 + Math.floor(rng() * 2), inCat.length); // 2-3 matches
  const matches = shuffle(rng, inCat).slice(0, matchCount);
  const fillers = shuffle(rng, outCat).slice(0, tileCount - matchCount);
  const tiles = shuffle(rng, [
    ...matches.map((icon) => ({ icon, isMatch: true })),
    ...fillers.map((icon) => ({ icon, isMatch: false })),
  ]);
  return { ruleNumber: ruleIndex + 1, rule, isRecall, tiles, matchCount };
}
