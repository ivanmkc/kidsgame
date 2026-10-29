import { describe, expect, it } from 'vitest';
import {
  evaluateRhythm,
  getInstructionalFeedback,
  speechLines,
  makeSteadyBeatRound,
  passThreshold,
  roundsToWin,
  scoreTaps,
  windowMs,
  SteadyBeatRound,
} from './logic';
import { makeRng } from '../../rng';

describe('steadybeat logic', () => {
  const round100: SteadyBeatRound = { bpm: 100, beatsPerRound: 8 }; // beatMs = 600ms

  describe('evaluateRhythm', () => {
    it("returns listen when fewer than half the round's taps are provided (stopped early)", () => {
      expect(evaluateRhythm(round100, [])).toBe('listen');
      expect(evaluateRhythm(round100, [1000])).toBe('listen');
      expect(evaluateRhythm(round100, [1000, 1600])).toBe('listen');
      expect(evaluateRhythm(round100, [1000, 1600, 2200])).toBe('listen');
      expect(evaluateRhythm(round100, [1000, 1400, 1800])).toBe('listen');
    });

    it('returns listen when taps are within 15% tolerance band of beat interval (e.g. 595ms or 605ms at 600ms target)', () => {
      // 595ms interval
      expect(evaluateRhythm(round100, [1000, 1595, 2190, 2785, 3380])).toBe('listen');
      // 605ms interval
      expect(evaluateRhythm(round100, [1000, 1605, 2210, 2815, 3420])).toBe('listen');
      // 600ms exact
      expect(evaluateRhythm(round100, [1000, 1600, 2200, 2800, 3400])).toBe('listen');
    });

    it('returns fast when average tap interval is more than 15% faster than beat interval', () => {
      // 400ms interval < 510ms threshold
      expect(evaluateRhythm(round100, [1000, 1400, 1800, 2200, 2600])).toBe('fast');
    });

    it('returns slow when average tap interval is more than 15% slower than beat interval', () => {
      // 800ms interval > 690ms threshold
      expect(evaluateRhythm(round100, [1000, 1800, 2600, 3400, 4200])).toBe('slow');
    });
  });

  describe('getInstructionalFeedback', () => {
    it('returns localized fast and listen feedback across all languages', () => {
      const fastTaps = [1000, 1400, 1800, 2200, 2600];
      expect(getInstructionalFeedback(round100, 'en', fastTaps)).toEqual(['Fast', 'Listen...']);
      expect(getInstructionalFeedback(round100, 'ja', fastTaps)).toEqual(['はやい', 'きいてね…']);
      expect(getInstructionalFeedback(round100, 'cmn', fastTaps)).toEqual(['快', '听一听…']);
      expect(getInstructionalFeedback(round100, 'yue', fastTaps)).toEqual(['快', '聽下…']);
    });

    it('returns localized slow and listen feedback across all languages', () => {
      const slowTaps = [1000, 1800, 2600, 3400, 4200];
      expect(getInstructionalFeedback(round100, 'en', slowTaps)).toEqual(['Slow', 'Listen...']);
      expect(getInstructionalFeedback(round100, 'ja', slowTaps)).toEqual(['おそい', 'きいてね…']);
      expect(getInstructionalFeedback(round100, 'cmn', slowTaps)).toEqual(['慢', '听一听…']);
      expect(getInstructionalFeedback(round100, 'yue', slowTaps)).toEqual(['慢', '聽下…']);
    });

    it('returns localized listen feedback when taps are omitted, stopped early, or near tempo', () => {
      expect(getInstructionalFeedback(round100, 'en')).toEqual(['Listen...']);
      expect(getInstructionalFeedback(round100, 'en', [])).toEqual(['Listen...']);
      expect(getInstructionalFeedback(round100, 'en', [1000])).toEqual(['Listen...']);
      // Stopped early (steady 3 taps)
      expect(getInstructionalFeedback(round100, 'en', [1000, 1600, 2200])).toEqual(['Listen...']);
      // Within tolerance band (595ms / 605ms)
      expect(getInstructionalFeedback(round100, 'en', [1000, 1595, 2190, 2785, 3380])).toEqual([
        'Listen...',
      ]);
      expect(getInstructionalFeedback(round100, 'en', [1000, 1605, 2210, 2815, 3420])).toEqual([
        'Listen...',
      ]);
      expect(getInstructionalFeedback(round100, 'ja', [])).toEqual(['きいてね…']);
      expect(getInstructionalFeedback(round100, 'cmn', [])).toEqual(['听一听…']);
      expect(getInstructionalFeedback(round100, 'yue', [])).toEqual(['聽下…']);
    });
  });

  describe('speechLines', () => {
    it('contains unique lines spanning all languages and including instructional feedback phrases', () => {
      const lines = speechLines();
      expect(lines.length).toBeGreaterThan(0);
      expect(new Set(lines).size).toBe(lines.length);

      // Check English instructional feedback lines are included
      expect(lines).toContain('Tap along with the beat!');
      expect(lines).toContain('Your turn!');
      expect(lines).toContain('Listen...');
      expect(lines).toContain('Fast');
      expect(lines).toContain('Slow');

      // Check Japanese lines are included
      expect(lines).toContain('ビートに あわせて タップ！');
      expect(lines).toContain('きみの ばん！');
      expect(lines).toContain('きいてね…');
      expect(lines).toContain('はやい');
      expect(lines).toContain('おそい');
    });
  });

  describe('round parameters and scoring', () => {
    it('creates rounds within bpm bounds for difficulty', () => {
      for (const d of ['easy', 'medium', 'hard'] as const) {
        const rng = makeRng(42);
        const r = makeSteadyBeatRound(rng, d);
        expect(r.beatsPerRound).toBe(8);
        if (d === 'easy') {
          expect(r.bpm).toBeGreaterThanOrEqual(80);
          expect(r.bpm).toBeLessThanOrEqual(100);
        } else if (d === 'medium') {
          expect(r.bpm).toBeGreaterThanOrEqual(70);
          expect(r.bpm).toBeLessThanOrEqual(110);
        } else {
          expect(r.bpm).toBeGreaterThanOrEqual(60);
          expect(r.bpm).toBeLessThanOrEqual(120);
        }
      }
    });

    it('returns correct roundsToWin, windowMs, and passThreshold', () => {
      expect(roundsToWin('easy')).toBe(4);
      expect(roundsToWin('medium')).toBe(5);
      expect(roundsToWin('hard')).toBe(6);

      expect(windowMs('easy')).toBe(250);
      expect(windowMs('medium')).toBe(180);
      expect(windowMs('hard')).toBe(120);

      expect(passThreshold('easy')).toBe(0.5);
      expect(passThreshold('medium')).toBe(0.625);
      expect(passThreshold('hard')).toBe(0.75);
    });

    it('scores taps on beat within window', () => {
      const startMs = 1000;
      // Exact taps at 600ms intervals
      const exactTaps = [1000, 1600, 2200, 2800, 3400, 4000, 4600, 5200];
      const result = scoreTaps(round100, exactTaps, startMs, 'easy');
      expect(result.hits).toBe(8);
      expect(result.total).toBe(8);
    });
  });
});
