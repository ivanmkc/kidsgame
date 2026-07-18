import { Rng, randInt } from '../../rng';
import { Difficulty } from '../../difficulty';

export interface SteadyBeatRound {
  bpm: number;
  beatsPerRound: number;
}

function bpmRange(d: Difficulty): [number, number] {
  if (d === 'easy') return [80, 100];
  if (d === 'medium') return [70, 110];
  return [60, 120];
}

export function windowMs(d: Difficulty): number {
  if (d === 'easy') return 250;
  if (d === 'medium') return 180;
  return 120;
}

export function roundsToWin(d: Difficulty): number {
  if (d === 'easy') return 4;
  if (d === 'medium') return 5;
  return 6;
}

export function makeSteadyBeatRound(rng: Rng, d: Difficulty): SteadyBeatRound {
  const [lo, hi] = bpmRange(d);
  const bpm = lo + randInt(rng, hi - lo + 1);
  return { bpm, beatsPerRound: 8 };
}

export function scoreTaps(
  round: SteadyBeatRound,
  tapTimesMs: number[],
  startMs: number,
  d: Difficulty,
): { hits: number; total: number } {
  const beatMs = 60000 / round.bpm;
  const win = windowMs(d);
  let hits = 0;
  const beatTimes: number[] = [];
  for (let i = 0; i < round.beatsPerRound; i++) {
    beatTimes.push(startMs + i * beatMs);
  }
  const used = new Set<number>();
  for (const tap of tapTimesMs) {
    for (let b = 0; b < beatTimes.length; b++) {
      if (used.has(b)) continue;
      if (Math.abs(tap - beatTimes[b]) <= win) {
        hits++;
        used.add(b);
        break;
      }
    }
  }
  return { hits, total: round.beatsPerRound };
}

export function passThreshold(d: Difficulty): number {
  if (d === 'easy') return 0.5;
  if (d === 'medium') return 0.625;
  return 0.75;
}

export function speechLines(): string[] {
  return [];
}
