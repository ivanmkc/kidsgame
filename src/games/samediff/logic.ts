import { Rng, randInt } from '../../rng';
import { Difficulty } from '../../difficulty';
import { SeqNote } from '../../music';

const BASE_PHRASES: SeqNote[][] = [
  [{ m: 60, b: 1 }, { m: 64, b: 1 }, { m: 67, b: 1 }], // C E G
  [{ m: 62, b: 1 }, { m: 65, b: 1 }, { m: 69, b: 1 }], // D F A
  [{ m: 64, b: 1 }, { m: 67, b: 1 }, { m: 72, b: 1 }], // E G C'
  [{ m: 65, b: 1 }, { m: 69, b: 1 }, { m: 72, b: 1 }], // F A C'
  [{ m: 67, b: 1 }, { m: 72, b: 1 }, { m: 76, b: 1 }], // G C' E'
];

export interface SameDiffRound {
  phraseA: SeqNote[];
  phraseB: SeqNote[];
  answer: 'same' | 'different';
}

function stepSize(d: Difficulty): number {
  if (d === 'easy') return 4;
  if (d === 'medium') return 2;
  return 1;
}

export function roundsToWin(d: Difficulty): number {
  if (d === 'easy') return 8;
  if (d === 'medium') return 10;
  return 12;
}

export function makeSameDiffRound(rng: Rng, d: Difficulty): SameDiffRound {
  const phraseIdx = randInt(rng, BASE_PHRASES.length);
  const phraseA = BASE_PHRASES[phraseIdx].map((n) => ({ ...n }));
  const isSame = rng() < 0.5;
  if (isSame) {
    return { phraseA, phraseB: phraseA.map((n) => ({ ...n })), answer: 'same' };
  }
  const phraseB = phraseA.map((n) => ({ ...n }));
  const changeIdx = randInt(rng, phraseB.length);
  const dir = rng() < 0.5 ? 1 : -1;
  phraseB[changeIdx] = { ...phraseB[changeIdx], m: phraseB[changeIdx].m + dir * stepSize(d) };
  return { phraseA, phraseB, answer: 'different' };
}

export function isCorrect(round: SameDiffRound, picked: 'same' | 'different'): boolean {
  return picked === round.answer;
}

export function speechLines(): string[] {
  return [];
}
