import { Lang } from "../../lang";
import { Rng, shuffle } from "../../rng";

// Spoken prompt for Memory Match across all four languages.
// English preserves the exact pre-rendered clip string; non-English modes
// provide localized instructions so speech fallback does not speak English.
export const MEMORY_PLAY_PROMPTS: Record<Lang, string> = {
  en: "Flip the cards and find the pairs!",
  ja: "カードをめくって おなじペアを さがそう",
  cmn: "翻牌找一样的一对",
  yue: "反牌搵一樣嘅一對",
};

export function memoryPrompt(lang: Lang = "en"): string {
  return MEMORY_PLAY_PROMPTS[lang] ?? MEMORY_PLAY_PROMPTS.en;
}

export interface MemoryCard {
  key: number; // unique per card
  icon: string; // spot-it icon name
}

export const MEMORY_PAIRS = 6;

export function buildBoard(
  rng: Rng,
  iconNames: string[],
  pairs = MEMORY_PAIRS,
): MemoryCard[] {
  const chosen = shuffle(rng, iconNames).slice(0, pairs);
  const cards = chosen.flatMap((icon, i) => [
    { key: i * 2, icon },
    { key: i * 2 + 1, icon },
  ]);
  return shuffle(rng, cards);
}
