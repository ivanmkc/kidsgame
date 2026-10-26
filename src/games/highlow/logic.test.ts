import { describe, expect, it } from 'vitest';
import { makeRng } from '../../rng';
import {
  makeHighLowRound,
  roundsToWin,
  correctAnswer,
  isCorrect,
  getInstructionalFeedback,
  nextScoreValue,
  speechLines,
  HighLowRound,
} from './logic';

describe('highlow logic', () => {
  it('generates rounds with distinct notes', () => {
    for (let seed = 1; seed <= 30; seed++) {
      for (const d of ['easy', 'medium', 'hard'] as const) {
        const rng = makeRng(seed);
        const r = makeHighLowRound(rng, d);
        expect(r.noteA).not.toBe(r.noteB);
        expect(Math.abs(r.noteB - r.noteA)).toBeGreaterThan(0);
        expect(['high', 'low']).toContain(correctAnswer(r));
      }
    }
  });

  it('correctAnswer and isCorrect match the direction of noteB relative to noteA', () => {
    const highRound: HighLowRound = { noteA: 60, noteB: 72 };
    const lowRound: HighLowRound = { noteA: 72, noteB: 60 };

    expect(correctAnswer(highRound)).toBe('high');
    expect(isCorrect(highRound, 'high')).toBe(true);
    expect(isCorrect(highRound, 'low')).toBe(false);

    expect(correctAnswer(lowRound)).toBe('low');
    expect(isCorrect(lowRound, 'low')).toBe(true);
    expect(isCorrect(lowRound, 'high')).toBe(false);
  });

  it('roundsToWin scales with difficulty', () => {
    expect(roundsToWin('easy')).toBe(8);
    expect(roundsToWin('medium')).toBe(10);
    expect(roundsToWin('hard')).toBe(12);
  });

  it('nextScoreValue increments only on first try', () => {
    expect(nextScoreValue(0, true)).toBe(1);
    expect(nextScoreValue(3, true)).toBe(4);
    expect(nextScoreValue(0, false)).toBe(0);
    expect(nextScoreValue(3, false)).toBe(3);
  });

  it('provides instructional feedback stating the correct direction and listen prompt across languages', () => {
    const highRound: HighLowRound = { noteA: 60, noteB: 72 };
    const lowRound: HighLowRound = { noteA: 72, noteB: 60 };

    expect(getInstructionalFeedback(highRound, 'en')).toEqual(['Higher', 'Listen...']);
    expect(getInstructionalFeedback(lowRound, 'en')).toEqual(['Lower', 'Listen...']);

    expect(getInstructionalFeedback(highRound, 'ja')).toEqual(['たかくなった', 'きいてね…']);
    expect(getInstructionalFeedback(lowRound, 'ja')).toEqual(['ひくくなった', 'きいてね…']);

    expect(getInstructionalFeedback(highRound, 'cmn')).toEqual(['更高', '听一听…']);
    expect(getInstructionalFeedback(lowRound, 'cmn')).toEqual(['更低', '听一听…']);

    expect(getInstructionalFeedback(highRound, 'yue')).toEqual(['高咗', '聽下…']);
    expect(getInstructionalFeedback(lowRound, 'yue')).toEqual(['低咗', '聽下…']);
  });

  it('correctly scores relative melodic direction for high soprano and low bass rounds', () => {
    // High soprano drop (A4 440Hz -> F#4 370Hz)
    const sopranoDrop: HighLowRound = { noteA: 69, noteB: 66 };
    expect(correctAnswer(sopranoDrop)).toBe('low');
    expect(isCorrect(sopranoDrop, 'low')).toBe(true);
    expect(isCorrect(sopranoDrop, 'high')).toBe(false);
    expect(getInstructionalFeedback(sopranoDrop, 'en')).toEqual(['Lower', 'Listen...']);
    expect(getInstructionalFeedback(sopranoDrop, 'ja')).toEqual(['ひくくなった', 'きいてね…']);

    // Low bass rise (F#3 185Hz -> C#4 277Hz)
    const bassRise: HighLowRound = { noteA: 54, noteB: 61 };
    expect(correctAnswer(bassRise)).toBe('high');
    expect(isCorrect(bassRise, 'high')).toBe(true);
    expect(isCorrect(bassRise, 'low')).toBe(false);
    expect(getInstructionalFeedback(bassRise, 'en')).toEqual(['Higher', 'Listen...']);
    expect(getInstructionalFeedback(bassRise, 'ja')).toEqual(['たかくなった', 'きいてね…']);
  });

  it('speechLines exports unique non-empty phrases spanning all languages', () => {
    const lines = speechLines();
    expect(lines.length).toBeGreaterThan(0);
    expect(new Set(lines).size).toBe(lines.length);
    expect(lines).toContain('Higher');
    expect(lines).toContain('Lower');
    expect(lines).toContain('Listen...');
    expect(lines).toContain('たかくなった');
    expect(lines).toContain('更高');
    expect(lines).toContain('高咗');
    expect(lines).toContain('にばんめの おとは たかくなった？ ひくくなった？');
  });
});
