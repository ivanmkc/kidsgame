import { Lang } from '../../lang';
import { Rng, shuffle } from '../../rng';
import { WORDS, wordFor } from '../../curriculum/words';

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

/** Localized screen-reader label for a memory card icon. */
export function cardLabel(icon: string, lang: Lang): string {
  const entry = WORDS.find((w) => w.icon === icon);
  if (!entry) throw new Error(`Unknown memory icon: ${icon}`);
  return wordFor(entry, lang).text;
}
