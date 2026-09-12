// Visual categories for the 31 sticker icons — used to pick distractors
// that are genuinely confusable (an animal among animals, not among cars).
export const ICON_CATEGORIES: Record<string, string[]> = {
  animals: [
    'dog', 'cat', 'lion', 'frog', 'panda', 'fox', 'monkey', 'pig',
    'rabbit', 'koala', 'unicorn', 'octopus', 'crab', 'fish', 'butterfly', 'ladybug',
  ],
  nature: ['blossom', 'sunflower', 'rainbow', 'star'],
  food: ['apple', 'banana', 'strawberry', 'pizza', 'icecream'],
  things: ['balloon', 'car', 'plane', 'rocket', 'soccer', 'gift'],
};

import { Lang } from '../lang';

// One home for how each category is worded to kids — Rule Time's "tap"
// labels and Odd One Out's "which is not" questions must describe the same
// membership, so they live next to it.
// `tap` stays English (Rule Time is an English-phonics game by design).
// `not` is a per-lang Record so Odd One Out renders in the active UI language.
export const CATEGORY_TEXT: Record<string, { tap: string; not: Record<Lang, string> }> = {
  animals: {
    tap: 'Tap all the ANIMALS! 🐾',
    not: { en: 'Which one is NOT an animal?', ja: 'どうぶつじゃないのは？', cmn: '哪一个不是动物？', yue: '邊個唔係動物？' },
  },
  nature: {
    tap: 'Tap the FLOWERS, RAINBOWS & STARS! 🌸',
    not: { en: 'Which one is NOT a flower, rainbow or star?', ja: 'おはな・にじ・ほしじゃないのは？', cmn: '哪一个不是花、彩虹或星星？', yue: '邊個唔係花、彩虹或星星？' },
  },
  food: {
    tap: 'Tap all the YUMMY FOOD! 🍎',
    not: { en: 'Which one is NOT food?', ja: 'たべものじゃないのは？', cmn: '哪一个不是食物？', yue: '邊個唔係食物？' },
  },
  things: {
    // The present is a member too, so both wordings name it — "NOT a toy
    // or vehicle" made the gift a second right answer in Odd One Out, and
    // an untappable match in Rule Time.
    tap: 'Tap the TOYS, VEHICLES & PRESENTS! 🚗',
    not: { en: 'Which one is NOT a toy, vehicle or present?', ja: 'おもちゃ・のりもの・プレゼントじゃないのは？', cmn: '哪一个不是玩具、车辆或礼物？', yue: '邊個唔係玩具、車或者禮物？' },
  },
};

// Categories a kid could reasonably confuse — icons from these must not be
// used as "does not match" fillers against the key (animals are nature too).
export const CATEGORY_CONFLICTS: Record<string, string[]> = {
  nature: ['animals'],
};

export function categoryOf(icon: string): string {
  for (const [cat, members] of Object.entries(ICON_CATEGORIES)) {
    if (members.includes(icon)) return cat;
  }
  return 'things';
}

export function sameCategory(icon: string): string[] {
  return ICON_CATEGORIES[categoryOf(icon)] ?? [];
}
