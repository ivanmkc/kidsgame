import { Rng, randInt, shuffle } from '../../rng';
import { Difficulty } from '../../difficulty';

const PENTATONIC = [60, 62, 64, 67, 69]; // C D E G A (C major pentatonic)
const BELL_COLORS = ['#E8564F', '#FFC24B', '#5FBF6E', '#2FB8AC', '#9B7EDE'];

export interface Bell {
  midi: number;
  color: string;
}

export interface BellsRound {
  bells: Bell[];
  sequence: number[];  // indices into bells[]
}

function bellCount(d: Difficulty): number {
  if (d === 'easy') return 3;
  if (d === 'medium') return 4;
  return 5;
}

export function seqLength(d: Difficulty): number {
  if (d === 'easy') return 2;
  if (d === 'medium') return 3;
  return 5;
}

export function roundsToWin(d: Difficulty): number {
  if (d === 'easy') return 5;
  if (d === 'medium') return 6;
  return 8;
}

export function makeBellsRound(rng: Rng, d: Difficulty): BellsRound {
  const n = bellCount(d);
  const len = seqLength(d);
  const bells: Bell[] = [];
  for (let i = 0; i < n; i++) {
    bells.push({ midi: PENTATONIC[i], color: BELL_COLORS[i] });
  }
  const sequence: number[] = [];
  for (let i = 0; i < len; i++) {
    sequence.push(randInt(rng, n));
  }
  return { bells, sequence };
}

export function checkSequence(round: BellsRound, tapped: number[]): boolean {
  if (tapped.length !== round.sequence.length) return false;
  return tapped.every((v, i) => v === round.sequence[i]);
}

export function speechLines(): string[] {
  return [];
}
