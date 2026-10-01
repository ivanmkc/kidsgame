import { Rng } from '../../rng';
import { Difficulty } from '../../difficulty';
import { SeqNote } from '../../music';

const MELODY: SeqNote[] = [
  { m: 60, b: 1 }, { m: 62, b: 1 }, { m: 64, b: 1 },
  { m: 62, b: 1 }, { m: 60, b: 2 },
];

export interface FastSlowRound {
  notes: SeqNote[];
  bpm: number;
  /** Derived from `bpm` — the kid answers from what the melody sounded
   *  like, so the field must never be able to disagree with it. */
  answer: 'fast' | 'slow';
}

/** Every bpm a round can carry sits clearly on one side of this line
 *  (slow tempos top out at 100, fast ones start at 140). */
const FAST_BPM_MIN = 140;

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
  const bpm = rng() < 0.5 ? fast : slow;
  return { notes: MELODY, bpm, answer: speedOf(bpm) };
}

function speedOf(bpm: number): 'fast' | 'slow' {
  return bpm >= FAST_BPM_MIN ? 'fast' : 'slow';
}

export function isCorrect(round: FastSlowRound, picked: 'fast' | 'slow'): boolean {
  return picked === getActualSpeed(round);
}

export function getActualSpeed(round: FastSlowRound): 'fast' | 'slow' {
  return speedOf(round.bpm);
}

export function speechLines(): string[] {
  return [];
}
