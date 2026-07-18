import { Rng, pick, randInt } from '../../rng';
import { Difficulty } from '../../difficulty';
import { LANGS } from '../../lang';
import { t } from '../../i18n';

export interface HighLowRound {
  noteA: number;  // midi
  noteB: number;  // midi
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

export function makeHighLowRound(rng: Rng, d: Difficulty): HighLowRound {
  const interval = intervalFor(d);
  const base = BASE_MIDI + randInt(rng, 13) - 6;
  const higher = rng() < 0.5;
  const noteA = higher ? base + interval : base;
  const noteB = higher ? base : base + interval;
  const answer: 'high' | 'low' = rng() < 0.5 ? 'high' : 'low';
  return { noteA, noteB, answer };
}

export function isCorrect(round: HighLowRound, picked: 'high' | 'low'): boolean {
  const highNote = Math.max(round.noteA, round.noteB);
  const lowNote = Math.min(round.noteA, round.noteB);
  if (picked === 'high') {
    return round.noteA === highNote || round.noteB === highNote;
  }
  return round.noteA === lowNote || round.noteB === lowNote;
}

export function correctAnswer(round: HighLowRound): 'high' | 'low' {
  return round.answer;
}

export function getHighNote(round: HighLowRound): number {
  return Math.max(round.noteA, round.noteB);
}

export function getLowNote(round: HighLowRound): number {
  return Math.min(round.noteA, round.noteB);
}

export function speechLines(): string[] {
  const out: string[] = [];
  for (const l of LANGS) {
    out.push(t(l.id, 'music.highlow.prompt' as never));
    out.push(t(l.id, 'music.highlow.high' as never));
    out.push(t(l.id, 'music.highlow.low' as never));
  }
  return [...new Set(out.filter(Boolean))];
}
