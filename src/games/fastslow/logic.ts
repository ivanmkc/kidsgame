import { Rng, randInt } from '../../rng';
import { Difficulty } from '../../difficulty';
import { SeqNote } from '../../music';

const MELODY: SeqNote[] = [
  { m: 60, b: 1 }, { m: 62, b: 1 }, { m: 64, b: 1 },
  { m: 62, b: 1 }, { m: 60, b: 2 },
];

export interface FastSlowRound {
  notes: SeqNote[];
  bpm: number;
  answer: 'fast' | 'slow';
}

function bpmPair(d: Difficulty): [number, number] {
  if (d === 'easy') return [80, 160];
  if (d === 'medium') return [90, 150];
  return [100, 140];
}

export function roundsToWin(d: Difficulty): number {
  if (d === 'easy') return 8;
  if (d === 'medium') return 10;
  return 12;
}

export function makeFastSlowRound(rng: Rng, d: Difficulty): FastSlowRound {
  const [slow, fast] = bpmPair(d);
  const isFast = rng() < 0.5;
  const answer: 'fast' | 'slow' = rng() < 0.5 ? 'fast' : 'slow';
  return {
    notes: MELODY,
    bpm: isFast ? fast : slow,
    answer,
  };
}

export function isCorrect(round: FastSlowRound, picked: 'fast' | 'slow'): boolean {
  const [slow, fast] = [100, 140]; // doesn't matter: use BPM threshold
  const actualSpeed: 'fast' | 'slow' = round.bpm >= 130 ? 'fast' : 'slow';
  return picked === actualSpeed;
}

export function getActualSpeed(round: FastSlowRound): 'fast' | 'slow' {
  return round.bpm >= 130 ? 'fast' : 'slow';
}

export function speechLines(): string[] {
  return [];
}
