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

// One home for how each category is worded to kids — Rule Time's "tap"
// labels and Odd One Out's "which is not" questions must describe the same
// membership, so they live next to it.
export const CATEGORY_TEXT: Record<string, { tap: string; not: string }> = {
  animals: { tap: 'Tap all the ANIMALS! 🐾', not: 'Which one is NOT an animal?' },
  nature: { tap: 'Tap the FLOWERS, RAINBOWS & STARS! 🌸', not: 'Which one is NOT a flower, rainbow or star?' },
  food: { tap: 'Tap all the YUMMY FOOD! 🍎', not: 'Which one is NOT food?' },
  things: { tap: 'Tap the TOYS & VEHICLES! 🚗', not: 'Which one is NOT a toy or vehicle?' },
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
