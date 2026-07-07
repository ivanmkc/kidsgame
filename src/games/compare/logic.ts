import { Difficulty } from '../../difficulty';
import { Lang } from '../../lang';
import { Rng, randInt, shuffle } from '../../rng';
import { CRITTER_ICONS, Position, scatterPositions } from '../count/logic';

export interface Side {
  icon: string;
  count: number;
  positions: Position[];
}

export interface CompareRound {
  left: Side;
  right: Side;
  /** 'more' most rounds; hard mode flips 30% to 'fewer'. */
  ask: 'more' | 'fewer';
  correctSide: 'left' | 'right';
}

/** Rounds/range/gap per difficulty — hardcoded per the task spec. */
export function compareSettings(
  d: Difficulty,
): { rounds: number; range: [number, number]; minGap: number; fewerFraction: number } {
  if (d === 'hard') return { rounds: 10, range: [3, 10], minGap: 1, fewerFraction: 0.3 };
  if (d === 'medium') return { rounds: 8, range: [1, 9], minGap: 2, fewerFraction: 0 };
  return { rounds: 6, range: [1, 7], minGap: 3, fewerFraction: 0 };
}

export function makeCompareRound(rng: Rng, d: Difficulty): CompareRound {
  const {
    range: [lo, hi],
    minGap,
    fewerFraction,
  } = compareSettings(d);
  // pick two distinct counts with |a-b| >= minGap; guard is a defensive cap
  let a = lo;
  let b = lo;
  for (let guard = 0; guard < 200; guard++) {
    a = lo + randInt(rng, hi - lo + 1);
    b = lo + randInt(rng, hi - lo + 1);
    if (a !== b && Math.abs(a - b) >= minGap) break;
  }
  // final safety: force a valid pair if the RNG somehow starved
  if (a === b || Math.abs(a - b) < minGap) {
    a = lo;
    b = Math.min(hi, lo + Math.max(minGap, 1));
  }
  const [iconA, iconB] = pickTwoIcons(rng);
  const left: Side = { icon: iconA, count: a, positions: scatterPositions(rng, a) };
  const right: Side = { icon: iconB, count: b, positions: scatterPositions(rng, b) };
  const ask: 'more' | 'fewer' = rng() < fewerFraction ? 'fewer' : 'more';
  const correctSide: 'left' | 'right' =
    ask === 'more' ? (a > b ? 'left' : 'right') : a < b ? 'left' : 'right';
  return { left, right, ask, correctSide };
}

function pickTwoIcons(rng: Rng): [string, string] {
  const pool = shuffle(rng, CRITTER_ICONS);
  return [pool[0], pool[1]];
}

// ---------- speech ----------

export const MORE_PROMPT: Record<Lang, string> = {
  en: 'Tap the side with MORE!',
  ja: 'おおい ほうは どっち？',
  cmn: '哪边比较多？',
  yue: '邊邊多啲呀？',
};

export const FEWER_PROMPT: Record<Lang, string> = {
  en: 'Tap the side with FEWER!',
  ja: 'すくない ほうは どっち？',
  cmn: '哪边比较少？',
  yue: '邊邊少啲呀？',
};

export const PRAISE: Record<Lang, string> = {
  en: "That's right!",
  ja: 'せいかい！',
  cmn: '答对了！',
  yue: '啱晒！',
};

/** Prompt/celebration lines for all four langs (number words come from the
 *  shared orchestrator pool). */
export function speechLines(): string[] {
  const s = new Set<string>();
  (['en', 'ja', 'cmn', 'yue'] as Lang[]).forEach((L) => {
    s.add(MORE_PROMPT[L]);
    s.add(FEWER_PROMPT[L]);
    s.add(PRAISE[L]);
  });
  return [...s];
}
