import { Difficulty } from '../../difficulty';
import { Lang } from '../../lang';
import { Rng, randInt, shuffle } from '../../rng';
import { CRITTER_ICONS, Position, scatterPositions } from '../count/logic';

export interface SumsRound {
  icon: string;
  a: number;
  b: number;
  sum: number;
  /** positions for the initial `a` critters. */
  aPositions: Position[];
  /** positions for the incoming `b` critters (animate in after 250ms stagger). */
  bPositions: Position[];
  /** three unique integers — one is `sum`. */
  choices: number[];
}

export function sumsSettings(d: Difficulty): { rounds: number; maxSum: number } {
  if (d === 'hard') return { rounds: 8, maxSum: 10 };
  if (d === 'medium') return { rounds: 6, maxSum: 7 };
  return { rounds: 5, maxSum: 5 };
}

/** Three unique choices in [1..upper], answer always included. */
export function makeSumChoices(rng: Rng, answer: number, maxSum: number): number[] {
  const upper = Math.max(maxSum + 2, answer + 2, 6);
  const others = new Set<number>();
  let guard = 0;
  while (others.size < 2 && guard++ < 200) {
    const cand = 1 + randInt(rng, upper);
    if (cand !== answer) others.add(cand);
  }
  // extreme corner: fill with sequential values if the loop couldn't
  let fallback = 1;
  while (others.size < 2) {
    if (fallback !== answer) others.add(fallback);
    fallback++;
  }
  return shuffle(rng, [answer, ...others]);
}

export function makeSumsRound(rng: Rng, d: Difficulty): SumsRound {
  const { maxSum } = sumsSettings(d);
  // sum in [2..maxSum]; a,b >= 1 with a + b = sum
  const sum = 2 + randInt(rng, maxSum - 1);
  const a = 1 + randInt(rng, sum - 1);
  const b = sum - a;
  const icon = CRITTER_ICONS[randInt(rng, CRITTER_ICONS.length)];
  // one scatter for all sum critters then split — keeps them from stacking
  const all = scatterPositions(rng, sum);
  const aPositions = all.slice(0, a);
  const bPositions = all.slice(a);
  const choices = makeSumChoices(rng, sum, maxSum);
  return { icon, a, b, sum, aPositions, bPositions, choices };
}

// ---------- speech ----------

export const PLUS: Record<Lang, string> = {
  en: 'plus',
  ja: 'たす',
  cmn: '加',
  yue: '加',
};

export const QUESTION: Record<Lang, string> = {
  en: 'How many now?',
  ja: 'ぜんぶで いくつ？',
  cmn: '一共有几个？',
  yue: '一共有幾多個呀？',
};

export const PRAISE: Record<Lang, string> = {
  en: "That's right!",
  ja: 'せいかい！',
  cmn: '答对了！',
  yue: '啱晒！',
};

/** Every game-specific literal this game will speak, across all four langs.
 *  Number words are shared across the suite (orchestrator's pool). */
export function speechLines(): string[] {
  const s = new Set<string>();
  (['en', 'ja', 'cmn', 'yue'] as Lang[]).forEach((L) => {
    s.add(PLUS[L]);
    s.add(QUESTION[L]);
    s.add(PRAISE[L]);
  });
  return [...s];
}
