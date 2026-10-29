import { Difficulty } from "../../difficulty";
import { Lang } from "../../lang";
import { Rng, randInt, shuffle } from "../../rng";
import {
  Position,
  gridFor,
  scatterPositions,
} from "../count/logic";
import { spriteLT } from "../quizround/logic";
import { WORDS, wordFor } from '../../curriculum/words';
import { CURRICULUM } from "../../curriculum/content";

export interface Side {
  icon: string;
  count: number;
  positions: Position[];
}

export interface CompareRound {
  left: Side;
  right: Side;
  /** 'more' most rounds; hard mode flips 30% to 'fewer'. */
  ask: "more" | "fewer";
  correctSide: "left" | "right";
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
export function compareSettings(d: Difficulty): {
  rounds: number;
  range: [number, number];
  minGap: number;
  minRatio: number;
  fewerFraction: number;
} {
  return CURRICULUM.numbers.compare[d];
}

/** Both halves of the pair rule: far enough apart in absolute terms AND in
 *  proportion. Exported so the round builder and its tests share one
 *  definition of "a fair pair". */
export function isFairPair(
  a: number,
  b: number,
  minGap: number,
  minRatio: number,
): boolean {
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
  const left: Side = {
    icon: iconA,
    count: a,
    positions: scatterPositions(rng, a, PLATE_JITTER),
  };
  const right: Side = {
    icon: iconB,
    count: b,
    positions: scatterPositions(rng, b, PLATE_JITTER),
  };
  const ask: "more" | "fewer" = rng() < fewerFraction ? "fewer" : "more";
  const correctSide: "left" | "right" =
    ask === "more" ? (a > b ? "left" : "right") : a < b ? "left" : "right";
  return { left, right, ask, correctSide };
}

function pickTwoIcons(rng: Rng): [string, string] {
  const pool = shuffle(rng, CURRICULUM.critters);
  return [pool[0], pool[1]];
}

export const PLATE_PADDING = 12;
export const PLATE_JITTER = 0.1;

/**
 * Critter size for a plate of `count` items: scales to fit within the usable
 * cell dimensions (inner width / cols, inner height / rows) after inward padding.
 * Uses 0.79× cell dimension to ensure non-overlap under PLATE_JITTER (0.1) jitter
 * (min center distance is 0.8× cell), capped at 58px.
 */
export function plateCritterSize(
  count: number,
  width: number,
  height: number,
  padding = PLATE_PADDING,
): number {
  const innerW = Math.max(0, width - padding * 2);
  const innerH = Math.max(0, height - padding * 2);
  const { cols, rows } = gridFor(count);
  return Math.min(58, (innerW / cols) * 0.79, (innerH / rows) * 0.79);
}

/** Position a critter sprite on the plate, padded away from borders and corners. */
export function plateCritterPos(
  pos: Position,
  critterSize: number,
  width: number,
  height: number,
  padding = PLATE_PADDING,
): { left: number; top: number } {
  return spriteLT(pos.x, pos.y, critterSize, width, height, padding);
}

// ---------- speech ----------

export const MORE_PROMPT: Record<Lang, string> = {
  en: "Tap the side with MORE!",
  ja: "おおい ほうは どっち？",
  cmn: "哪边比较多？",
  yue: "邊邊多啲呀？",
};

export const FEWER_PROMPT: Record<Lang, string> = {
  en: "Tap the side with FEWER!",
  ja: "すくない ほうは どっち？",
  cmn: "哪边比较少？",
  yue: "邊邊少啲呀？",
};

export const PRAISE: Record<Lang, string> = {
  en: "That's right!",
  ja: "せいかい！",
  cmn: "答对了！",
  yue: "啱晒！",
};

/** Comparative feedback when a round is completed. */
export function comparisonPhrase(
  lang: Lang,
  ask: 'more' | 'fewer',
  winningCount: number,
  otherCount: number,
): string {
  switch (lang) {
    case 'ja':
      return ask === 'more'
        ? `${winningCount} は ${otherCount} より おおい`
        : `${winningCount} は ${otherCount} より すくない`;
    case 'cmn':
      return ask === 'more'
        ? `${winningCount}比${otherCount}多`
        : `${winningCount}比${otherCount}少`;
    case 'yue':
      return ask === 'more'
        ? `${winningCount}多過${otherCount}`
        : `${winningCount}少過${otherCount}`;
    case 'en':
    default:
      return ask === 'more'
        ? `${winningCount} is more than ${otherCount}`
        : `${winningCount} is fewer than ${otherCount}`;
  }
}

export function roundComparisonPhrase(lang: Lang, round: CompareRound): string {
  const winningSide = round.correctSide === 'left' ? round.left : round.right;
  const otherSide = round.correctSide === 'left' ? round.right : round.left;
  return comparisonPhrase(lang, round.ask, winningSide.count, otherSide.count);
}

/** Localized screen-reader label for a plate of items (e.g. "5 dog", "5 いぬ"). */
export function plateAccessibilityLabel(
  count: number,
  icon: string,
  lang: Lang,
): string {
  const entry = WORDS.find((w) => w.icon === icon);
  if (!entry) throw new Error(`Unknown compare icon: ${icon}`);
  return `${count} ${wordFor(entry, lang).text}`;
}

/** Prompt/celebration lines for all four langs, plus all comparative feedback
 *  phrases across shipped count ranges (1..10) so the offline TTS pipeline
 *  pre-renders Gemini clips for instant playback. */
export function speechLines(): string[] {
  const s = new Set<string>();
  (["en", "ja", "cmn", "yue"] as Lang[]).forEach((L) => {
    s.add(MORE_PROMPT[L]);
    s.add(FEWER_PROMPT[L]);
    s.add(PRAISE[L]);
    for (let a = 1; a <= 10; a++) {
      for (let b = 1; b <= 10; b++) {
        if (a > b) s.add(comparisonPhrase(L, 'more', a, b));
        if (a < b) s.add(comparisonPhrase(L, 'fewer', a, b));
      }
    }
  });
  return [...s];
}
