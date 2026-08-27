import { Rng, randInt } from '../../rng';
import { Difficulty } from '../../difficulty';

export interface HighLowRound {
  noteA: number;  // midi — played first
  noteB: number;  // midi — played second
  /** 'high' when noteB is above noteA, 'low' when it is below. */
  answer: 'high' | 'low';
}

const BASE_MIDI = 60; // middle C

function intervalFor(d: Difficulty): number {
  if (d === 'easy') return 12;
  if (d === 'medium') return 7;
  return 3;
}

export function roundsToWin(d: Difficulty): number {
  if (d === 'easy') return 8;
  if (d === 'medium') return 10;
  return 12;
}

/** The kid hears note A then note B and taps 🐦 HIGH or 🐻 LOW for where
 *  the SECOND note landed. The answer must therefore fall out of the two
 *  notes — never a coin flip, or the round is unwinnable by listening. */
export function makeHighLowRound(rng: Rng, d: Difficulty): HighLowRound {
  const interval = intervalFor(d);
  const base = BASE_MIDI + randInt(rng, 13) - 6;
  const secondIsHigher = rng() < 0.5;
  const noteA = secondIsHigher ? base : base + interval;
  const noteB = secondIsHigher ? base + interval : base;
  return { noteA, noteB, answer: secondIsHigher ? 'high' : 'low' };
}

/** Derived from the notes, so a hand-built round can't disagree with what
 *  the ears heard. */
export function correctAnswer(round: HighLowRound): 'high' | 'low' {
  return round.noteB > round.noteA ? 'high' : 'low';
}

export function isCorrect(round: HighLowRound, picked: 'high' | 'low'): boolean {
  return picked === correctAnswer(round);
}

export function getHighNote(round: HighLowRound): number {
  return Math.max(round.noteA, round.noteB);
}

export function getLowNote(round: HighLowRound): number {
  return Math.min(round.noteA, round.noteB);
}

export function speechLines(): string[] {
  return [];
}
