import { Rng, randInt } from '../../rng';
import { Difficulty } from '../../difficulty';

export interface RhythmStep {
  duration: number; // duration in beats (quarter note = 1)
  rest?: boolean;
}

export interface EchoBeatRound {
  bpm: number;
  pattern: RhythmStep[];
  onsets: number[];    // onset positions in beats from start of bar
  gaps: number[];      // inter-onset intervals in seconds
  hitCount: number;    // onsets.length
  totalBeats: number;  // total duration in beats (whole bars of 4/4)
}

export const RHYTHM_PATTERNS: Record<Difficulty, RhythmStep[][]> = {
  // Easy: quarters only on one bar (4 beats of 4/4, onsets on integer beats)
  easy: [
    [{ duration: 1 }, { duration: 1 }, { duration: 1 }, { duration: 1 }],
    [{ duration: 2 }, { duration: 2 }],
    [{ duration: 1 }, { duration: 1 }, { duration: 2 }],
    [{ duration: 2 }, { duration: 1 }, { duration: 1 }],
    [{ duration: 1 }, { duration: 2 }, { duration: 1 }],
  ],
  // Medium: adds eighths (0.5 beats), no sixteenths or rests
  medium: [
    [{ duration: 1 }, { duration: 1 }, { duration: 0.5 }, { duration: 0.5 }, { duration: 1 }],
    [{ duration: 0.5 }, { duration: 0.5 }, { duration: 1 }, { duration: 1 }, { duration: 1 }],
    [{ duration: 1 }, { duration: 0.5 }, { duration: 0.5 }, { duration: 1 }, { duration: 1 }],
    [{ duration: 1 }, { duration: 1 }, { duration: 1 }, { duration: 0.5 }, { duration: 0.5 }],
    [{ duration: 0.5 }, { duration: 0.5 }, { duration: 0.5 }, { duration: 0.5 }, { duration: 1 }, { duration: 1 }],
    [{ duration: 1 }, { duration: 0.5 }, { duration: 0.5 }, { duration: 0.5 }, { duration: 0.5 }, { duration: 1 }],
    [{ duration: 0.5 }, { duration: 0.5 }, { duration: 2 }, { duration: 1 }],
    [{ duration: 1 }, { duration: 2 }, { duration: 0.5 }, { duration: 0.5 }],
  ],
  // Hard: adds sixteenths (0.25), dotted notes, and rests
  hard: [
    [{ duration: 0.25 }, { duration: 0.25 }, { duration: 0.5 }, { duration: 1 }, { duration: 2 }],
    [{ duration: 1 }, { duration: 1 }, { duration: 0.5 }, { duration: 0.25 }, { duration: 0.25 }, { duration: 1 }],
    [{ duration: 1.5 }, { duration: 0.5 }, { duration: 1 }, { duration: 1 }],
    [{ duration: 0.75 }, { duration: 0.25 }, { duration: 1 }, { duration: 2 }],
    [{ duration: 1.5 }, { duration: 0.5 }, { duration: 0.25 }, { duration: 0.25 }, { duration: 0.5 }, { duration: 1 }],
    [{ duration: 1 }, { duration: 1, rest: true }, { duration: 1 }, { duration: 1 }],
    [{ duration: 1 }, { duration: 0.5, rest: true }, { duration: 0.5 }, { duration: 2 }],
    [{ duration: 1 }, { duration: 0.5 }, { duration: 0.5, rest: true }, { duration: 1 }, { duration: 1 }],
    [{ duration: 1 }, { duration: 0.5, rest: true }, { duration: 0.25 }, { duration: 0.25 }, { duration: 1 }, { duration: 1 }],
    [{ duration: 1 }, { duration: 0.25 }, { duration: 0.25 }, { duration: 0.5 }, { duration: 1, rest: true }, { duration: 1 }],
  ],
};

export function bpmForDifficulty(d: Difficulty): number {
  if (d === 'easy') return 80;
  if (d === 'medium') return 90;
  return 100;
}

export function tolerancePct(d: Difficulty): number {
  if (d === 'easy') return 0.4;
  if (d === 'medium') return 0.3;
  return 0.2;
}

export function roundsToWin(d: Difficulty): number {
  if (d === 'easy') return 6;
  if (d === 'medium') return 8;
  return 10;
}

export function buildRoundFromPattern(pattern: RhythmStep[], bpm: number): EchoBeatRound {
  const beatSec = 60 / bpm;
  const onsets: number[] = [];
  let currentBeat = 0;
  for (const step of pattern) {
    if (!step.rest) {
      onsets.push(currentBeat);
    }
    currentBeat += step.duration;
  }
  const gaps: number[] = [];
  for (let i = 0; i < onsets.length - 1; i++) {
    gaps.push((onsets[i + 1] - onsets[i]) * beatSec);
  }
  return {
    bpm,
    pattern,
    onsets,
    gaps,
    hitCount: onsets.length,
    totalBeats: currentBeat,
  };
}

export function makeEchoBeatRound(rng: Rng, d: Difficulty): EchoBeatRound {
  const patterns = RHYTHM_PATTERNS[d];
  const idx = randInt(rng, patterns.length);
  const pattern = patterns[idx];
  const bpm = bpmForDifficulty(d);
  return buildRoundFromPattern(pattern, bpm);
}

export interface TapResult {
  countCorrect: boolean;
  timingCorrect: boolean;
}

export function checkEcho(
  round: EchoBeatRound,
  tapTimes: number[],
  d: Difficulty,
  expectedGridStartMs = 0,
): TapResult {
  const countCorrect = tapTimes.length === round.hitCount;
  if (!countCorrect) return { countCorrect: false, timingCorrect: false };
  if (round.hitCount <= 0) return { countCorrect: true, timingCorrect: true };

  const tol = tolerancePct(d);
  const bpm = round.bpm ?? bpmForDifficulty(d);
  const beatMs = 60000 / bpm;
  const tolMs = tol * beatMs;

  let timingCorrect = true;
  for (let i = 0; i < round.hitCount; i++) {
    const expected = expectedGridStartMs + round.onsets[i] * beatMs;
    const actual = tapTimes[i];
    if (Math.abs(actual - expected) > tolMs) {
      timingCorrect = false;
      break;
    }
  }

  return { countCorrect, timingCorrect };
}

export function speechLines(): string[] {
  return [];
}
