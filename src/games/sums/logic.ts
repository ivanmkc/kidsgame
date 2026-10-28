import { Difficulty } from "../../difficulty";
import { Lang } from "../../lang";
import { Rng, randInt, shuffle } from "../../rng";
import { Position, scatterPositions } from "../count/logic";
import { CURRICULUM } from "../../curriculum/content";

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

export interface SumsLayout {
  isLandscape: boolean;
  stageW: number;
  stageH: number;
  critterSize: number;
}

export const MIN_STAGE_H = 160;

/**
 * Computes responsive dimensions and orientation for SumsGame.
 * On mobile landscape viewports (height < 500), places the stage side-by-side
 * with the controls so the stage does not collapse. Guarantees minimum stage height
 * and sizes critters so rows never collide or overlap.
 */
export function sumsLayout(
  width: number,
  height: number,
  total = 2,
): SumsLayout {
  const isLandscape = width > height && height < 500;
  const rows = total >= 9 ? 3 : total >= 4 ? 2 : 1;
  const colsFactor = total <= 4 ? 5 : total <= 7 ? 6 : 7;

  if (isLandscape) {
    const availH = height - 84 - 16;
    const stageH = Math.round(Math.max(MIN_STAGE_H, Math.min(availH, 360)));
    const maxStageW = (width - 48) * 0.52;
    const stageW = Math.round(Math.min(maxStageW, stageH * 1.3));
    const critterSize = Math.round(
      Math.min(
        Math.max(38, Math.min(68, stageW / colsFactor)),
        Math.max(30, stageH * (rows >= 3 ? 0.28 : 0.45)),
      ),
    );
    return { isLandscape, stageW, stageH, critterSize };
  }

  const stageW = Math.min(width - 32, 560);
  const stageH = Math.round(
    Math.max(MIN_STAGE_H, Math.min(height - 84 - 200, stageW * 0.72)),
  );
  const critterSize = Math.round(
    Math.min(
      Math.max(40, Math.min(70, stageW / colsFactor)),
      Math.max(30, stageH * (rows >= 3 ? 0.28 : 0.45)),
    ),
  );
  return { isLandscape, stageW, stageH, critterSize };
}

export function sumsSettings(d: Difficulty): {
  rounds: number;
  maxSum: number;
} {
  return CURRICULUM.numbers.sums[d];
}

/** Three unique choices in [1..upper], answer always included. */
export function makeSumChoices(
  rng: Rng,
  answer: number,
  maxSum: number,
): number[] {
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
  const icon = CURRICULUM.critters[randInt(rng, CURRICULUM.critters.length)];
  // one scatter for all sum critters then split — keeps them from stacking
  const all = scatterPositions(rng, sum);
  const aPositions = all.slice(0, a);
  const bPositions = all.slice(a);
  const choices = makeSumChoices(rng, sum, maxSum);
  return { icon, a, b, sum, aPositions, bPositions, choices };
}

// ---------- speech ----------

export const PLUS: Record<Lang, string> = {
  en: "plus",
  ja: "たす",
  cmn: "加",
  yue: "加",
};

export const QUESTION: Record<Lang, string> = {
  en: "How many now?",
  ja: "ぜんぶで いくつ？",
  cmn: "一共有几个？",
  yue: "一共有幾多個呀？",
};

export const PRAISE: Record<Lang, string> = {
  en: "That's right!",
  ja: "せいかい！",
  cmn: "答对了！",
  yue: "啱晒！",
};

/** Every game-specific literal this game will speak, across all four langs.
 *  Number words are shared across the suite (orchestrator's pool). */
export function speechLines(): string[] {
  const s = new Set<string>();
  (["en", "ja", "cmn", "yue"] as Lang[]).forEach((L) => {
    s.add(PLUS[L]);
    s.add(QUESTION[L]);
    s.add(PRAISE[L]);
  });
  return [...s];
}
