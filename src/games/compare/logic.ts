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

/** Rounds/range/gap per difficulty — hardcoded per the task spec.
 *
 *  `minRatio` is the Weber-law half of the pair rule: how hard two counts
 *  are to tell apart depends on their RATIO, not their difference. 3 vs 4
 *  is one apart and obvious; 9 vs 10 is also one apart and a four-year-old
 *  cannot see it — they have to count both sides perfectly and will lose a
 *  question they understood. Requiring the larger side to be at least a
 *  quarter bigger keeps small numbers as tight as they were while pulling
 *  the big ones apart. It never binds on easy/medium (their gaps of 3 and 2
 *  over smaller ranges already clear it); it is what makes the hard tier
 *  fair. */
export function compareSettings(
  d: Difficulty,
): { rounds: number; range: [number, number]; minGap: number; minRatio: number; fewerFraction: number } {
  if (d === 'hard') return { rounds: 10, range: [3, 10], minGap: 1, minRatio: 1.25, fewerFraction: 0.3 };
  if (d === 'medium') return { rounds: 8, range: [1, 9], minGap: 2, minRatio: 1.25, fewerFraction: 0 };
  return { rounds: 6, range: [1, 7], minGap: 3, minRatio: 1.25, fewerFraction: 0 };
}

/** Both halves of the pair rule: far enough apart in absolute terms AND in
 *  proportion. Exported so the round builder and its tests share one
 *  definition of "a fair pair". */
export function isFairPair(a: number, b: number, minGap: number, minRatio: number): boolean {
  if (a === b) return false;
  if (Math.abs(a - b) < minGap) return false;
  return Math.max(a, b) >= Math.min(a, b) * minRatio;
}

export function makeCompareRound(rng: Rng, d: Difficulty): CompareRound {
  const {
    range: [lo, hi],
    minGap,
    minRatio,
    fewerFraction,
  } = compareSettings(d);
  // pick two counts a kid can actually tell apart; guard is a defensive cap
  let a = lo;
  let b = lo;
  for (let guard = 0; guard < 200; guard++) {
    a = lo + randInt(rng, hi - lo + 1);
    b = lo + randInt(rng, hi - lo + 1);
    if (isFairPair(a, b, minGap, minRatio)) break;
  }
  // final safety: force a valid pair if the RNG somehow starved. The bottom
  // of the range is where the ratio rule is loosest, so this always clears
  // it for the shipped settings.
  if (!isFairPair(a, b, minGap, minRatio)) {
    a = lo;
    b = Math.min(hi, Math.max(lo + minGap, Math.ceil(lo * minRatio)));
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
