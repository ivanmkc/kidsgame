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

export function makeFastSlowRound(
  rng: Rng,
  d: Difficulty,
  history: ('fast' | 'slow')[] = []
): FastSlowRound {
  const [slow, fast] = bpmPair(d);
  let useFast: boolean;
  const len = history.length;
  if (len >= 2 && history[len - 1] === history[len - 2]) {
    useFast = history[len - 1] === 'slow';
  } else {
    useFast = rng() < 0.5;
  }
  
  const bpm = useFast ? fast : slow;
  const transpose = Math.floor(rng() * 13) - 6;
  const notes = MELODY.map((n) => ({ ...n, m: n.m + transpose }));
  
  return { notes, bpm };
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
