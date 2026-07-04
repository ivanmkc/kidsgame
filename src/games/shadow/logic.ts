import { Rng, shuffle } from '../../rng';

export interface ShadowRound {
  answer: string; // icon name shown as silhouette
  options: string[]; // includes answer, shuffled
}

export function makeShadowRound(rng: Rng, icons: string[], choices: number): ShadowRound {
  const picked = shuffle(rng, icons).slice(0, choices);
  return { answer: picked[Math.floor(rng() * picked.length)], options: picked };
}
