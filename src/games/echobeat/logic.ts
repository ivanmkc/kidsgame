import { Rng, randInt } from "../../rng";
import { Difficulty } from "../../difficulty";
import { LANGS } from "../../lang";
import { t } from "../../i18n";

export interface EchoBeatRound {
  gaps: number[]; // inter-onset intervals in seconds
  hitCount: number; // gaps.length + 1
  bpm?: number; // metronome tempo in beats per minute
}

interface PatternDef {
  gaps: number[];
  bpm: number;
}

// Quantized musical rhythmic patterns (quarter notes = 0.5s, eighth notes = 0.25s,
// triplets = 1/3s, dotted quarters = 0.75s, half notes = 1.0s at standard 120 BPM).
const RHYTHM_PATTERNS: Record<Difficulty, PatternDef[]> = {
  easy: [
    { gaps: [0.5], bpm: 120 },
    { gaps: [0.6], bpm: 100 },
    { gaps: [0.5, 0.5], bpm: 120 },
    { gaps: [0.6, 0.6], bpm: 100 },
    { gaps: [0.5, 1.0], bpm: 120 },
  ],
  medium: [
    { gaps: [0.5, 0.5], bpm: 120 },
    { gaps: [0.25, 0.5], bpm: 120 },
    { gaps: [0.5, 0.25], bpm: 120 },
    { gaps: [0.25, 0.25], bpm: 120 },
    { gaps: [0.5, 0.5, 0.5], bpm: 120 },
    { gaps: [0.25, 0.25, 0.5], bpm: 120 },
    { gaps: [0.5, 0.25, 0.25], bpm: 120 },
    { gaps: [0.25, 0.5, 0.25], bpm: 120 },
    { gaps: [0.5, 0.5, 0.5, 0.5], bpm: 120 },
    { gaps: [0.25, 0.25, 0.5, 0.5], bpm: 120 },
    { gaps: [0.5, 0.25, 0.25, 0.5], bpm: 120 },
    { gaps: [0.5, 0.5, 0.25, 0.25], bpm: 120 },
  ],
  hard: [
    { gaps: [0.25, 0.25, 0.5], bpm: 120 },
    { gaps: [0.25, 0.5, 0.25], bpm: 120 },
    { gaps: [0.75, 0.25, 0.5], bpm: 120 },
    { gaps: [1 / 3, 1 / 3, 1 / 3], bpm: 120 },
    { gaps: [0.25, 0.25, 0.25, 0.25], bpm: 120 },
    { gaps: [0.25, 0.5, 0.25, 0.5], bpm: 120 },
    { gaps: [0.75, 0.25, 0.5, 0.5], bpm: 120 },
    { gaps: [1 / 3, 1 / 3, 1 / 3, 0.5], bpm: 120 },
    { gaps: [0.5, 1 / 3, 1 / 3, 1 / 3], bpm: 120 },
    { gaps: [0.25, 0.25, 0.5, 0.25, 0.25], bpm: 120 },
    { gaps: [0.5, 0.25, 0.25, 0.5, 0.25], bpm: 120 },
    { gaps: [1 / 3, 1 / 3, 1 / 3, 0.25, 0.25], bpm: 120 },
    { gaps: [0.25, 0.25, 1 / 3, 1 / 3, 1 / 3], bpm: 120 },
  ],
};

export function tolerancePct(d: Difficulty): number {
  if (d === "easy") return 0.5; // generous tolerance for young children
  if (d === "medium") return 0.35;
  return 0.25;
}

export function roundsToWin(d: Difficulty): number {
  if (d === "easy") return 6;
  if (d === "medium") return 8;
  return 10;
}

export function makeEchoBeatRound(rng: Rng, d: Difficulty): EchoBeatRound {
  const pool = RHYTHM_PATTERNS[d];
  const idx = randInt(rng, pool.length);
  const pattern = pool[idx];
  const gaps = [...pattern.gaps];
  return { gaps, hitCount: gaps.length + 1, bpm: pattern.bpm };
}

export interface TapResult {
  countCorrect: boolean;
  timingCorrect: boolean;
}

export function checkEcho(
  round: EchoBeatRound,
  tapTimes: number[],
  d: Difficulty,
): TapResult {
  const countCorrect = tapTimes.length === round.hitCount;
  if (!countCorrect) return { countCorrect, timingCorrect: false };

  const playerGaps: number[] = [];
  for (let i = 1; i < tapTimes.length; i++) {
    playerGaps.push((tapTimes[i] - tapTimes[i - 1]) / 1000);
  }

  // Reject accidental double-taps or sensor bounces (<= 50ms) across all difficulties.
  for (const gap of playerGaps) {
    if (gap <= 0.05) return { countCorrect, timingCorrect: false };
  }

  const tol = tolerancePct(d);
  const minWindow = d === "easy" ? 0.2 : d === "medium" ? 0.12 : 0.08;

  if (round.gaps.length === 1) {
    const err = Math.abs(playerGaps[0] - round.gaps[0]);
    const allowedErr = Math.max(round.gaps[0] * tol, minWindow);
    return { countCorrect, timingCorrect: err <= allowedErr };
  }

  const expectedTotal = round.gaps.reduce((a, b) => a + b, 0);
  const playerTotal = playerGaps.reduce((a, b) => a + b, 0);
  if (expectedTotal <= 0 || playerTotal <= 0) {
    return { countCorrect, timingCorrect: false };
  }

  // Evaluate rhythm using relative beat proportions: normalize player tempo.
  // Tempo scale must fall within a reasonable musical range (0.3x-3.0x on easy, 0.4x-2.5x on med/hard).
  const minScale = d === "easy" ? 0.3 : 0.4;
  const maxScale = d === "easy" ? 3.0 : 2.5;
  const tempoScale = playerTotal / expectedTotal;
  if (tempoScale < minScale || tempoScale > maxScale) {
    return { countCorrect, timingCorrect: false };
  }

  let timingCorrect = true;
  for (let i = 0; i < round.gaps.length; i++) {
    const expected = round.gaps[i];
    const actualNormalized = playerGaps[i] / tempoScale;
    const err = Math.abs(actualNormalized - expected);
    const allowedErr = Math.max(expected * tol, minWindow);
    if (err > allowedErr) {
      timingCorrect = false;
      break;
    }
  }

  return { countCorrect, timingCorrect };
}

export type EchoBeatPhase = "listen" | "tap" | "result";

export function canTap(
  round: EchoBeatRound,
  tapCount: number,
  phase: EchoBeatPhase,
  won = false,
  result: "good" | "bad" | null = null,
): boolean {
  if (won || phase !== "tap" || result !== null) return false;
  return tapCount < round.hitCount;
}

export function evaluationDelayMs(
  round: EchoBeatRound,
  tapCount: number,
): number {
  return tapCount >= round.hitCount ? 0 : 3000;
}

export interface EchoBeatLayout {
  drumSize: number;
  drumEmojiSize: number;
  gap: number;
  isLandscape: boolean;
  shortH: boolean;
}

export function echoBeatLayout(width: number, height: number): EchoBeatLayout {
  const isLandscape = width > height;
  const shortH = isLandscape && height < 500;
  const drumSize = shortH
    ? Math.min(180, Math.max(90, Math.floor(height * 0.38)))
    : 180;
  const gap = shortH ? (height < 360 ? 8 : 12) : 28;
  const drumEmojiSize = Math.round(drumSize * (64 / 180));
  return { drumSize, drumEmojiSize, gap, isLandscape, shortH };
}

/** Voice-clip contract: every spoken line, all langs. */
export function speechLines(): string[] {
  const out: string[] = [];
  for (const l of LANGS) {
    out.push(t(l.id, "shell.echobeat.sub"));
  }
  return [...new Set(out)];
}
