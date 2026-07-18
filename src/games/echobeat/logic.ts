import { Rng, randInt } from '../../rng';
import { Difficulty } from '../../difficulty';

export interface EchoBeatRound {
  gaps: number[];    // inter-onset intervals in seconds
  hitCount: number;  // gaps.length + 1
}

function hitRange(d: Difficulty): [number, number] {
  if (d === 'easy') return [2, 3];
  if (d === 'medium') return [3, 5];
  return [4, 6];
}

export function tolerancePct(d: Difficulty): number {
  if (d === 'easy') return 1.0;   // count-only: any timing accepted
  if (d === 'medium') return 0.35;
  return 0.25;
}

export function roundsToWin(d: Difficulty): number {
  if (d === 'easy') return 6;
  if (d === 'medium') return 8;
  return 10;
}

export function makeEchoBeatRound(rng: Rng, d: Difficulty): EchoBeatRound {
  const [lo, hi] = hitRange(d);
  const hitCount = lo + randInt(rng, hi - lo + 1);
  const gaps: number[] = [];
  for (let i = 0; i < hitCount - 1; i++) {
    if (d === 'easy') {
      gaps.push(0.4 + rng() * 0.3);
    } else {
      gaps.push(0.25 + rng() * 0.55);
    }
  }
  return { gaps, hitCount };
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
  if (d === 'easy') {
    return { countCorrect, timingCorrect: true };
  }
  if (!countCorrect) return { countCorrect, timingCorrect: false };
  const tol = tolerancePct(d);
  const playerGaps = [];
  for (let i = 1; i < tapTimes.length; i++) {
    playerGaps.push((tapTimes[i] - tapTimes[i - 1]) / 1000);
  }
  let timingCorrect = true;
  for (let i = 0; i < round.gaps.length; i++) {
    const expected = round.gaps[i];
    const actual = playerGaps[i];
    if (Math.abs(actual - expected) / expected > tol) {
      timingCorrect = false;
      break;
    }
  }
  return { countCorrect, timingCorrect };
}

export function speechLines(): string[] {
  return [];
}
