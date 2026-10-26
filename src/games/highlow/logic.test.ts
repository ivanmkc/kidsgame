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

    expect(getInstructionalFeedback(highRound, 'en')).toEqual(['High', 'Listen...']);
    expect(getInstructionalFeedback(lowRound, 'en')).toEqual(['Low', 'Listen...']);

    expect(getInstructionalFeedback(highRound, 'ja')).toEqual(['たかい', 'きいてね…']);
    expect(getInstructionalFeedback(lowRound, 'ja')).toEqual(['ひくい', 'きいてね…']);

    expect(getInstructionalFeedback(highRound, 'cmn')).toEqual(['高', '听一听…']);
    expect(getInstructionalFeedback(lowRound, 'cmn')).toEqual(['低', '听一听…']);

    expect(getInstructionalFeedback(highRound, 'yue')).toEqual(['高', '聽下…']);
    expect(getInstructionalFeedback(lowRound, 'yue')).toEqual(['低', '聽下…']);
  });

  it('speechLines exports unique non-empty phrases spanning all languages', () => {
    const lines = speechLines();
    expect(lines.length).toBeGreaterThan(0);
    expect(new Set(lines).size).toBe(lines.length);
    expect(lines).toContain('High');
    expect(lines).toContain('Low');
    expect(lines).toContain('Listen...');
    expect(lines).toContain('たかい');
    expect(lines).toContain('高');
  });
});
