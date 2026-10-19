import { describe, expect, it } from 'vitest';
import { makeRng } from '../../../rng';
import { canTap, judgeTap, makeBellsRound, BellsRound, speechLines } from '../logic';

describe('judgeTap', () => {
  const round: BellsRound = {
    bells: [
      { midi: 60, color: '#E8564F' },
      { midi: 62, color: '#FFC24B' },
      { midi: 64, color: '#5FBF6E' },
      { midi: 67, color: '#2FB8AC' },
    ],
    sequence: [0, 1, 2],
  };

  it('immediately flags a wrong first tap on a 3-note sequence', () => {
    expect(judgeTap(round, [], 3)).toBe('wrong');
    expect(judgeTap(round, [], 1)).toBe('wrong');
  });

  it('returns continue on correct prefix taps', () => {
    expect(judgeTap(round, [], 0)).toBe('continue');
    expect(judgeTap(round, [0], 1)).toBe('continue');
  });

  it('immediately flags a wrong middle tap', () => {
    expect(judgeTap(round, [0], 0)).toBe('wrong');
    expect(judgeTap(round, [0], 3)).toBe('wrong');
  });

  it('returns complete on the final correct tap', () => {
    expect(judgeTap(round, [0, 1], 2)).toBe('complete');
  });

  it('flags a wrong final tap', () => {
    expect(judgeTap(round, [0, 1], 0)).toBe('wrong');
  });

  it('flags taps beyond sequence length as wrong', () => {
    expect(judgeTap(round, [0, 1, 2], 0)).toBe('wrong');
  });

  it('works with generated rounds', () => {
    const rng = makeRng(42);
    const r = makeBellsRound(rng, 'medium');
    expect(r.sequence).toHaveLength(3);
    const firstCorrect = r.sequence[0];
    const firstWrong = (firstCorrect + 1) % r.bells.length;
    expect(judgeTap(r, [], firstWrong)).toBe('wrong');
    expect(judgeTap(r, [], firstCorrect)).toBe('continue');
  });
});

describe('canTap', () => {
  const round: BellsRound = {
    bells: [
      { midi: 60, color: '#E8564F' },
      { midi: 62, color: '#FFC24B' },
      { midi: 64, color: '#5FBF6E' },
    ],
    sequence: [0, 1, 2],
  };

  it('blocks taps when wrongFlash is active', () => {
    expect(canTap(round, [], 'play', false, true)).toBe(false);
    expect(canTap(round, [0], 'play', false, true)).toBe(false);
  });

  it('allows taps during active play when not flashing and incomplete', () => {
    expect(canTap(round, [], 'play', false, false)).toBe(true);
    expect(canTap(round, [0], 'play', false, false)).toBe(true);
  });
});

describe('speechLines', () => {
  it('covers all supported languages with unique subtitle lines', () => {
    const lines = speechLines();
    expect(lines).toHaveLength(4);
    expect(new Set(lines).size).toBe(4);
    expect(lines).toContain('Listen, then play the tune back!');
    expect(lines).toContain('きいて、おなじように ならそう！');
    expect(lines).toContain('听完旋律，按顺序敲响！');
    expect(lines).toContain('聽完旋律，跟住撳返！');
  });
});
