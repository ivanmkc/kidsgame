import { Difficulty } from "../../difficulty";
import { t } from "../../i18n";
import { Lang, numberWord } from "../../lang";
import { Rng, randInt, shuffle } from "../../rng";
import { WORDS, wordFor } from "../../words";

// Shared critter/treat pool for the math suite (Count/Compare/Sums).
// Kept small on purpose — kids re-see the same familiar friends.
export const CRITTER_ICONS = [
  "dog",
  "cat",
  "frog",
  "rabbit",
  "fish",
  "butterfly",
  "apple",
  "strawberry",
  "star",
  "balloon",
];

/** Localized screen-reader label for a count critter. */
export function critterLabel(icon: string, lang: Lang): string {
  const entry = WORDS.find((w) => w.icon === icon);
  if (!entry) throw new Error(`Unknown critter icon: ${icon}`);
  return wordFor(entry, lang).text;
}

/** Position on the stage, in percent (0..100) of the card's width/height. */
export interface Position {
  x: number;
  y: number;
}
export const STAGE_PADDING = 16;

/**
 * Critter size for n items on a stage of width x height: scales to fit within
 * usable dimensions after STAGE_PADDING, so two rows never vertically overlap.
 */
export function stageCritterSize(
  n: number,
  stageW: number,
  stageH: number,
  padding = STAGE_PADDING,
): number {
  const innerW = Math.max(0, stageW - padding * 2);
  const innerH = Math.max(0, stageH - padding * 2);
  const colsFactor = n <= 4 ? 5 : n <= 7 ? 6 : 7;
  return Math.min(
    Math.max(38, Math.min(72, innerW / colsFactor)),
    Math.max(30, innerH * 0.45),
  );
}

export interface CountRound {
  icon: string;
  n: number;
  /** length n, guaranteed non-overlapping by grid-with-jitter placement. */
  positions: Position[];
  /** three unique integers — one is `n`. */
  choices: number[];
  answer: number;
}

/** Rounds/count-range per difficulty — hardcoded per the task spec. */
export function countSettings(d: Difficulty): {
  rounds: number;
  min: number;
  max: number;
} {
  if (d === "hard") return { rounds: 8, min: 6, max: 10 };
  if (d === "medium") return { rounds: 6, min: 4, max: 8 };
  return { rounds: 5, min: 1, max: 5 };
}

/**
 * Stage grid dimensions for n items (slight bias toward wider grid so cells
 * stay roughly square-ish).
 */
export function gridFor(n: number): { cols: number; rows: number } {
  const count = Math.max(1, n);
  const cols = Math.max(1, Math.ceil(Math.sqrt(count * 1.4)));
  const rows = Math.max(1, Math.ceil(count / cols));
  return { cols, rows };
}

/**
 * Place n items into a 100×100 stage via a jittered grid — guarantees the
 * distance between any two positions stays above `cellDim * 0.5`, so no
 * matter how many critters we ask for they never pile on each other.
 */
export function scatterPositions(
  rng: Rng,
  n: number,
  jitterFraction = 0.22,
): Position[] {
  if (n <= 0) return [];
  const { cols, rows } = gridFor(n);
  const cellW = 100 / cols;
  const cellH = 100 / rows;
  const jitterW = cellW * jitterFraction;
  const jitterH = cellH * jitterFraction;
  const cells: Position[] = [];
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      cells.push({
        x: cellW * (c + 0.5) + (rng() - 0.5) * 2 * jitterW,
        y: cellH * (r + 0.5) + (rng() - 0.5) * 2 * jitterH,
      });
    }
  }
  return shuffle(rng, cells).slice(0, n);
}

/** Three unique choices in [1..upper], answer always included. */
export function makeCountChoices(
  rng: Rng,
  answer: number,
  max: number,
): number[] {
  const upper = Math.max(max + 1, answer + 2, 4);
  const others = new Set<number>();
  let guard = 0;
  while (others.size < 2 && guard++ < 200) {
    const cand = 1 + randInt(rng, upper);
    if (cand !== answer) others.add(cand);
  }
  // extreme corner (max=1 with answer=1): pad with sequential fallbacks
  let fallback = 2;
  while (others.size < 2) {
    if (fallback !== answer) others.add(fallback);
    fallback++;
  }
  return shuffle(rng, [answer, ...others]);
}

export function makeCountRound(rng: Rng, d: Difficulty): CountRound {
  const { min, max } = countSettings(d);
  const icon = CRITTER_ICONS[randInt(rng, CRITTER_ICONS.length)];
  const n = min + randInt(rng, max - min + 1);
  const positions = scatterPositions(rng, n);
  const choices = makeCountChoices(rng, n, max);
  return { icon, n, positions, choices, answer: n };
}

/**
 * Mark a critter as tapped. Returns the original array untouched if the critter
 * is already tapped or index is out of bounds, so React can skip re-rendering.
 */
export function applyTap(tapped: boolean[], index: number): boolean[] {
  if (index < 0 || index >= tapped.length || tapped[index]) {
    return tapped;
  }
  const next = tapped.slice();
  next[index] = true;
  return next;
}

export interface PickState {
  won: boolean;
  phase: string;
  locked: boolean;
  score: number;
  round: CountRound;
  roundsToWin: number;
  lang: Lang;
}

export interface PickDeps {
  sfx: { good: () => void; wrong: () => void; tap?: () => void };
  say: (text: string) => void;
  sayThen: (lines: string[], cb: () => void) => void;
  setTimeout: (fn: () => void, ms: number) => ReturnType<typeof setTimeout>;
  clearTimeouts: () => void;
  makeNextRound: () => CountRound;
  setScore: (s: number) => void;
  setLocked: (l: boolean) => void;
  setRound: (r: CountRound) => void;
  setRoundNo: (updater: (prev: number) => number) => void;
  setTapped: (t: boolean[]) => void;
  setPhase: (p: "count" | "quiz") => void;
  setWrongPick: (
    w: number | null | ((prev: number | null) => number | null),
  ) => void;
  setWon: (w: boolean) => void;
}

export function applyPickAnswer(v: number, state: PickState, deps: PickDeps) {
  if (state.won || state.phase !== "quiz" || state.locked) return;

  if (v === state.round.answer) {
    deps.setLocked(true);
    deps.clearTimeouts();
    deps.setWrongPick(null);
    deps.sfx.good();
    const nextScore = state.score + 1;
    deps.setScore(nextScore);
    const nw = numberWord(state.lang, state.round.answer).t;
    deps.sayThen([nw, PRAISE[state.lang]], () => {
      deps.setLocked(false);
      if (nextScore < state.roundsToWin) {
        const nr = deps.makeNextRound();
        deps.setRound(nr);
        deps.setRoundNo((r) => r + 1);
        deps.setTapped(Array.from({ length: nr.n }, () => false));
        deps.setPhase("count");
        deps.setWrongPick(null);
      } else {
        deps.setWon(true);
      }
    });
  } else {
    deps.sfx.wrong();
    deps.setWrongPick(v);
    deps.clearTimeouts();
    deps.setTimeout(() => deps.setWrongPick((w) => (w === v ? null : w)), 450);
    deps.setTimeout(() => deps.say(PROMPTS[state.lang]), 500);
  }
}

// ---------- speech (per-lang prompt + celebration) ----------

export const PROMPTS: Record<Lang, string> = {
  en: "How many?",
  ja: "いくつかな？",
  cmn: "有几个？",
  yue: "有幾多個呀？",
};

export const PRAISE: Record<Lang, string> = {
  en: "Great counting!",
  ja: "すごい！",
  cmn: "真棒！",
  yue: "好叻呀！",
};

/** Every literal string this game will pass to say/saySequence, across all
 *  four langs — the orchestrator pre-renders TTS clips keyed by exact text.
 *  Number words are shared across the suite and provided by the orchestrator. */
export function speechLines(): string[] {
  const s = new Set<string>();
  (["en", "ja", "cmn", "yue"] as Lang[]).forEach((L) => {
    s.add(t(L, "shell.count.sub"));
    s.add(PROMPTS[L]);
    s.add(PRAISE[L]);
  });
  return [...s];
}
