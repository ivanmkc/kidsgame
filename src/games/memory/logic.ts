import { Rng, shuffle } from '../../rng';

export interface MemoryCard {
  key: number; // unique per card
  icon: string; // spot-it icon name
}

export const MEMORY_PAIRS = 6;

export function buildBoard(rng: Rng, iconNames: string[], pairs = MEMORY_PAIRS): MemoryCard[] {
  const chosen = shuffle(rng, iconNames).slice(0, pairs);
  const cards = chosen.flatMap((icon, i) => [
    { key: i * 2, icon },
    { key: i * 2 + 1, icon },
  ]);
  return shuffle(rng, cards);
}
