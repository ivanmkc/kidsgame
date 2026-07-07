import { Difficulty } from '../../difficulty';
import { Lang } from '../../lang';
import { Rng, randInt, shuffle } from '../../rng';

// Shared critter/treat pool for the math suite (Count/Compare/Sums).
// Kept small on purpose — kids re-see the same familiar friends.
export const CRITTER_ICONS = [
  'dog', 'cat', 'frog', 'rabbit', 'fish',
  'butterfly', 'apple', 'strawberry', 'star', 'balloon',
];

/** Position on the stage, in percent (0..100) of the card's width/height. */
export interface Position { x: number; y: number }

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
export function countSettings(d: Difficulty): { rounds: number; min: number; max: number } {
  if (d === 'hard') return { rounds: 8, min: 1, max: 10 };
  if (d === 'medium') return { rounds: 6, min: 1, max: 8 };
  return { rounds: 5, min: 1, max: 5 };
}

/**
 * Place n items into a 100×100 stage via a jittered grid — guarantees the
 * distance between any two positions stays above `cellDim * 0.5`, so no
 * matter how many critters we ask for they never pile on each other.
 */
export function scatterPositions(rng: Rng, n: number): Position[] {
  if (n <= 0) return [];
  // slight bias toward wider grid so cells stay roughly square-ish
  const cols = Math.max(1, Math.ceil(Math.sqrt(n * 1.4)));
  const rows = Math.max(1, Math.ceil(n / cols));
  const cellW = 100 / cols;
  const cellH = 100 / rows;
  const jitterW = cellW * 0.22;
  const jitterH = cellH * 0.22;
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
export function makeCountChoices(rng: Rng, answer: number, max: number): number[] {
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

// ---------- speech (per-lang prompt + celebration) ----------

export const PROMPTS: Record<Lang, string> = {
  en: 'How many?',
  ja: 'いくつかな？',
  cmn: '有几个？',
  yue: '有幾多個呀？',
};

export const PRAISE: Record<Lang, string> = {
  en: 'Great counting!',
  ja: 'すごい！',
  cmn: '真棒！',
  yue: '好叻呀！',
};

/** Every literal string this game will pass to say/saySequence, across all
 *  four langs — the orchestrator pre-renders TTS clips keyed by exact text.
 *  Number words are shared across the suite and provided by the orchestrator. */
export function speechLines(): string[] {
  const s = new Set<string>();
  (['en', 'ja', 'cmn', 'yue'] as Lang[]).forEach((L) => {
    s.add(PROMPTS[L]);
    s.add(PRAISE[L]);
  });
  return [...s];
}
