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

export function categoryOf(icon: string): string {
  for (const [cat, members] of Object.entries(ICON_CATEGORIES)) {
    if (members.includes(icon)) return cat;
  }
  return 'things';
}

export function sameCategory(icon: string): string[] {
  return ICON_CATEGORIES[categoryOf(icon)] ?? [];
}
