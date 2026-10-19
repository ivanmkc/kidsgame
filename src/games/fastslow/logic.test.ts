import { describe, expect, it } from 'vitest';
import { makeRng } from '../../rng';
import { makeFastSlowRound, getActualSpeed, isCorrect as fsCorrect, roundsToWin as fsRounds } from './logic';
import { renderToString } from 'react-dom/server';
import React from 'react';
import { FastSlowGame } from './FastSlowGame';

describe('fast or slow', () => {
  it('prevents streaks of more than 2 of the same speed', () => {
    for (let seed = 1; seed <= 50; seed++) {
      const rng1 = makeRng(seed);
      const r1 = makeFastSlowRound(rng1, 'easy', ['fast', 'fast']);
      expect(getActualSpeed(r1)).toBe('slow');

      const rng2 = makeRng(seed);
      const r2 = makeFastSlowRound(rng2, 'easy', ['slow', 'slow']);
      expect(getActualSpeed(r2)).toBe('fast');
    }
  });

  it('transposes melody pitches', () => {
    let transposed = false;
    for (let i = 0; i < 20; i++) {
      const rng = makeRng(i);
      const r = makeFastSlowRound(rng, 'easy');
      if (r.notes[0].m !== 60) transposed = true;
    }
    expect(transposed).toBe(true);
  });

  it('generates rounds with valid speed', () => {
    for (let seed = 1; seed <= 50; seed++) {
      for (const d of ['easy', 'medium', 'hard'] as const) {
        const rng = makeRng(seed);
        const r = makeFastSlowRound(rng, d);
        expect(r.bpm).toBeGreaterThanOrEqual(60);
        expect(r.bpm).toBeLessThanOrEqual(200);
        expect(r.notes.length).toBeGreaterThan(0);
        const speed = getActualSpeed(r);
        expect(['fast', 'slow']).toContain(speed);
      }
    }
  });

  it('isCorrect agrees with the tempo played, and rounds do not store answer', () => {
    const seen = new Set<string>();
    for (let seed = 1; seed <= 200; seed++) {
      for (const d of ['easy', 'medium', 'hard'] as const) {
        const r = makeFastSlowRound(makeRng(seed), d);
        expect('answer' in r).toBe(false);
        const speed = getActualSpeed(r);
        expect(fsCorrect(r, speed)).toBe(true);
        expect(fsCorrect(r, speed === 'fast' ? 'slow' : 'fast')).toBe(false);
        seen.add(speed);
      }
    }
    expect(seen).toEqual(new Set(['fast', 'slow']));
  });

  it('roundsToWin increases with difficulty', () => {
    expect(fsRounds('easy')).toBeLessThan(fsRounds('medium'));
    expect(fsRounds('medium')).toBeLessThan(fsRounds('hard'));
  });

  it('renders FastSlowGame and displays localized strings', () => {
    const html = renderToString(
      React.createElement(FastSlowGame, {
        onHome: () => {},
        difficulty: 'easy',
        lang: 'en',
      }),
    );
    expect(html).toContain('Fast or Slow');
    expect(html).toContain('Listen');
  });
});
