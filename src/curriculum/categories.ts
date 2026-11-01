import { UIKey } from '../i18n';

// Visual categories for the 31 sticker icons — used to pick distractors
// that are genuinely confusable (an animal among animals, not among cars).
export const ICON_CATEGORIES: Record<string, string[]> = {
  animals: [
    'dog',
    'cat',
    'lion',
    'frog',
    'panda',
    'fox',
    'monkey',
    'pig',
    'rabbit',
    'koala',
    'unicorn',
    'octopus',
    'crab',
    'fish',
    'butterfly',
    'ladybug',
  ],
  nature: ['blossom', 'sunflower', 'rainbow', 'star'],
  food: ['apple', 'banana', 'strawberry', 'pizza', 'icecream'],
  things: ['balloon', 'car', 'plane', 'rocket', 'soccer', 'gift'],
};

// One home for how each category is worded to kids — Rule Time's "tap"
// labels and Odd One Out's "which is not" questions must describe the same
// membership, so they live next to it.
// `tap` stays English (Rule Time is an English-phonics game by design).
// `not` stores the i18n key so Odd One Out renders via t(lang, key).
export const CATEGORY_TEXT: Record<string, { tap: string; not: UIKey }> = {
  animals: {
    tap: 'Tap all the ANIMALS! 🐾',
    not: 'oddone.not.animals',
  },
  nature: {
    tap: 'Tap the FLOWERS, RAINBOWS & STARS! 🌸',
    not: 'oddone.not.nature',
  },
  food: {
    tap: 'Tap all the YUMMY FOOD! 🍎',
    not: 'oddone.not.food',
  },
  things: {
    // The present is a member too, so both wordings name it — "NOT a toy
    // or vehicle" made the gift a second right answer in Odd One Out, and
    // an untappable match in Rule Time.
    tap: 'Tap the TOYS, VEHICLES & PRESENTS! 🚗',
    not: 'oddone.not.things',
  },
};

// Categories a kid could reasonably confuse — icons from these must not be
// used as "does not match" fillers against the key (animals are nature too,
// and edible animals like fish/crab/octopus read as food).
export const CATEGORY_CONFLICTS: Record<string, string[]> = {
  nature: ['animals'],
  food: ['animals'],
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
