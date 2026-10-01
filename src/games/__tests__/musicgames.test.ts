import { describe, expect, it } from 'vitest';
import { makeRng } from '../../rng';
import { makeHighLowRound, roundsToWin as hlRounds, getHighNote, getLowNote, correctAnswer as hlAnswer, isCorrect as hlCorrect } from '../highlow/logic';
import { makeBellsRound, checkSequence, roundsToWin as bellRounds, seqLength } from '../bells/logic';
import { makeEchoBeatRound, checkEcho, roundsToWin as echoRounds, tolerancePct } from '../echobeat/logic';
import { makeSteadyBeatRound, scoreTaps, roundsToWin as steadyRounds, passThreshold, windowMs } from '../steadybeat/logic';
import { makeFastSlowRound, getActualSpeed, isCorrect as fsCorrect, roundsToWin as fsRounds } from '../fastslow/logic';
import { makeSameDiffRound, isCorrect, roundsToWin as sdRounds } from '../samediff/logic';

describe('high or low', () => {
  it('generates rounds with distinct notes', () => {
    for (let seed = 1; seed <= 30; seed++) {
      for (const d of ['easy', 'medium', 'hard'] as const) {
        const rng = makeRng(seed);
        const r = makeHighLowRound(rng, d);
        expect(r.noteA).not.toBe(r.noteB);
        expect(getHighNote(r)).toBeGreaterThan(getLowNote(r));
        expect(['high', 'low']).toContain(r.answer);
      }
    }
  });

  it('the answer is what the ears heard, never a coin flip', () => {
    // The kid hears note A then note B and taps HIGH or LOW for where the
    // second one landed — so the answer has to follow the notes. When it
    // was drawn independently the round was pure 50/50 luck.
    const seen = new Set<string>();
    for (let seed = 1; seed <= 200; seed++) {
      for (const d of ['easy', 'medium', 'hard'] as const) {
        const r = makeHighLowRound(makeRng(seed), d);
        const wentUp = r.noteB > r.noteA;
        expect(r.answer).toBe(wentUp ? 'high' : 'low');
        expect(hlAnswer(r)).toBe(r.answer);
        expect(hlCorrect(r, r.answer)).toBe(true);
        expect(hlCorrect(r, r.answer === 'high' ? 'low' : 'high')).toBe(false);
        seen.add(r.answer);
      }
    }
    expect(seen).toEqual(new Set(['high', 'low']));
  });

  it('roundsToWin increases with difficulty', () => {
    expect(hlRounds('easy')).toBeLessThan(hlRounds('medium'));
    expect(hlRounds('medium')).toBeLessThan(hlRounds('hard'));
  });
});

describe('melody bells', () => {
  it('generates valid sequences within bell count', () => {
    for (let seed = 1; seed <= 30; seed++) {
      for (const d of ['easy', 'medium', 'hard'] as const) {
        const rng = makeRng(seed);
        const r = makeBellsRound(rng, d);
        expect(r.sequence).toHaveLength(seqLength(d));
        for (const idx of r.sequence) {
          expect(idx).toBeGreaterThanOrEqual(0);
          expect(idx).toBeLessThan(r.bells.length);
        }
        expect(r.bells.length).toBeGreaterThanOrEqual(3);
      }
    }
  });

  it('checkSequence validates correctly', () => {
    const rng = makeRng(42);
    const r = makeBellsRound(rng, 'easy');
    expect(checkSequence(r, r.sequence)).toBe(true);
    expect(checkSequence(r, [])).toBe(false);
    const wrong = r.sequence.map((v) => (v + 1) % r.bells.length);
    if (wrong.some((v, i) => v !== r.sequence[i])) {
      expect(checkSequence(r, wrong)).toBe(false);
    }
  });

  it('roundsToWin increases with difficulty', () => {
    expect(bellRounds('easy')).toBeLessThan(bellRounds('medium'));
    expect(bellRounds('medium')).toBeLessThan(bellRounds('hard'));
  });
});

describe('echo beat', () => {
  it('generates rounds with correct hitCount', () => {
    for (let seed = 1; seed <= 30; seed++) {
      for (const d of ['easy', 'medium', 'hard'] as const) {
        const rng = makeRng(seed);
        const r = makeEchoBeatRound(rng, d);
        expect(r.hitCount).toBe(r.gaps.length + 1);
        expect(r.hitCount).toBeGreaterThanOrEqual(2);
        expect(r.hitCount).toBeLessThanOrEqual(6);
        for (const g of r.gaps) {
          expect(g).toBeGreaterThan(0);
        }
      }
    }
  });

  it('perfect echo passes on easy (count only)', () => {
    const rng = makeRng(42);
    const r = makeEchoBeatRound(rng, 'easy');
    const taps = Array.from({ length: r.hitCount }, (_, i) => i * 500);
    const result = checkEcho(r, taps, 'easy');
    expect(result.countCorrect).toBe(true);
    expect(result.timingCorrect).toBe(true);
  });

  it('wrong count fails', () => {
    const rng = makeRng(42);
    const r = makeEchoBeatRound(rng, 'medium');
    const taps = Array.from({ length: r.hitCount + 1 }, (_, i) => i * 500);
    const result = checkEcho(r, taps, 'medium');
    expect(result.countCorrect).toBe(false);
  });

  it('matching timing passes on medium', () => {
    const rng = makeRng(42);
    const r = makeEchoBeatRound(rng, 'medium');
    let t = 0;
    const taps = [t];
    for (const g of r.gaps) {
      t += g * 1000;
      taps.push(t);
    }
    const result = checkEcho(r, taps, 'medium');
    expect(result.countCorrect).toBe(true);
    expect(result.timingCorrect).toBe(true);
  });

  it('tolerance tightens with difficulty', () => {
    expect(tolerancePct('easy')).toBeGreaterThan(tolerancePct('medium'));
    expect(tolerancePct('medium')).toBeGreaterThan(tolerancePct('hard'));
  });
});

describe('steady beat', () => {
  it('generates rounds with valid bpm', () => {
    for (let seed = 1; seed <= 30; seed++) {
      for (const d of ['easy', 'medium', 'hard'] as const) {
        const rng = makeRng(seed);
        const r = makeSteadyBeatRound(rng, d);
        expect(r.bpm).toBeGreaterThanOrEqual(60);
        expect(r.bpm).toBeLessThanOrEqual(120);
        expect(r.beatsPerRound).toBe(8);
      }
    }
  });

  it('perfect taps score full marks', () => {
    const rng = makeRng(42);
    const r = makeSteadyBeatRound(rng, 'easy');
    const beatMs = 60000 / r.bpm;
    const start = 1000;
    const taps = Array.from({ length: 8 }, (_, i) => start + i * beatMs);
    const result = scoreTaps(r, taps, start, 'easy');
    expect(result.hits).toBe(8);
    expect(result.total).toBe(8);
  });

  it('no taps score zero', () => {
    const rng = makeRng(42);
    const r = makeSteadyBeatRound(rng, 'easy');
    const result = scoreTaps(r, [], 1000, 'easy');
    expect(result.hits).toBe(0);
  });

  it('window tightens with difficulty', () => {
    expect(windowMs('easy')).toBeGreaterThan(windowMs('medium'));
    expect(windowMs('medium')).toBeGreaterThan(windowMs('hard'));
  });

  it('threshold increases with difficulty', () => {
    expect(passThreshold('easy')).toBeLessThan(passThreshold('medium'));
    expect(passThreshold('medium')).toBeLessThan(passThreshold('hard'));
  });
});

describe('fast or slow', () => {
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

  it('the answer field always agrees with the tempo played', () => {
    const seen = new Set<string>();
    for (let seed = 1; seed <= 200; seed++) {
      for (const d of ['easy', 'medium', 'hard'] as const) {
        const r = makeFastSlowRound(makeRng(seed), d);
        expect(r.answer).toBe(getActualSpeed(r));
        expect(fsCorrect(r, r.answer)).toBe(true);
        expect(fsCorrect(r, r.answer === 'fast' ? 'slow' : 'fast')).toBe(false);
        seen.add(r.answer);
      }
    }
    expect(seen).toEqual(new Set(['fast', 'slow']));
  });

  it('roundsToWin increases with difficulty', () => {
    expect(fsRounds('easy')).toBeLessThan(fsRounds('medium'));
    expect(fsRounds('medium')).toBeLessThan(fsRounds('hard'));
  });
});

describe('same or different', () => {
  it('same rounds have identical phrases', () => {
    let sawSame = false;
    for (let seed = 1; seed <= 50; seed++) {
      const rng = makeRng(seed);
      const r = makeSameDiffRound(rng, 'easy');
      if (r.answer === 'same') {
        sawSame = true;
        expect(r.phraseA.map((n) => n.m)).toEqual(r.phraseB.map((n) => n.m));
        expect(isCorrect(r, 'same')).toBe(true);
        expect(isCorrect(r, 'different')).toBe(false);
      }
    }
    expect(sawSame).toBe(true);
  });

  it('different rounds have at least one changed note', () => {
    let sawDiff = false;
    for (let seed = 1; seed <= 50; seed++) {
      const rng = makeRng(seed);
      const r = makeSameDiffRound(rng, 'hard');
      if (r.answer === 'different') {
        sawDiff = true;
        const aMidi = r.phraseA.map((n) => n.m);
        const bMidi = r.phraseB.map((n) => n.m);
        expect(aMidi).not.toEqual(bMidi);
        expect(isCorrect(r, 'different')).toBe(true);
        expect(isCorrect(r, 'same')).toBe(false);
      }
    }
    expect(sawDiff).toBe(true);
  });

  it('roundsToWin increases with difficulty', () => {
    expect(sdRounds('easy')).toBeLessThan(sdRounds('medium'));
    expect(sdRounds('medium')).toBeLessThan(sdRounds('hard'));
  });
});
