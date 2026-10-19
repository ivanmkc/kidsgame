// @vitest-environment happy-dom
import React from 'react';
import { render, fireEvent, act, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { FastSlowGame } from './FastSlowGame';
import { playSequence } from '../../music';

vi.mock('../../sound', () => ({
  sfx: { good: vi.fn(), wrong: vi.fn(), win: vi.fn() },
  say: vi.fn(),
}));

vi.mock('../../music', () => ({
  playSequence: vi.fn((notes, bpm, cb, onEnd) => {
    if (onEnd) onEnd();
  }),
  stopSequence: vi.fn(),
}));

describe('FastSlowGame UI interaction', () => {
  it('tracks history and prevents streaks of 3 identical speeds', () => {
    vi.useFakeTimers();
    const randomSpy = vi.spyOn(Math, 'random').mockReturnValue(0.12345);
    render(<FastSlowGame onHome={() => {}} difficulty="hard" lang="en" />);

    act(() => {
      vi.advanceTimersByTime(450);
    });

    const playedSpeeds: ('fast' | 'slow')[] = [];

    // Play 12 rounds (hard difficulty win condition) to check for streaks
    for (let i = 0; i < 12; i++) {
      const calls = vi.mocked(playSequence).mock.calls;
      const bpm = calls[calls.length - 1][1] as number;
      const speed = bpm >= 140 ? 'fast' : 'slow';
      playedSpeeds.push(speed);

      const fastBtn = screen.getByTestId('fastslow-fast');
      const slowBtn = screen.getByTestId('fastslow-slow');
      const btn = speed === 'fast' ? fastBtn : slowBtn;
      fireEvent.click(btn);

      // wait for celebrate and next round
      act(() => {
        vi.advanceTimersByTime(1100);
      });
      act(() => {
        vi.advanceTimersByTime(450);
      });
    }

    // Assert that there are no streaks of 3
    for (let i = 2; i < playedSpeeds.length; i++) {
      const streak = playedSpeeds[i] === playedSpeeds[i - 1] && playedSpeeds[i] === playedSpeeds[i - 2];
      expect(streak).toBe(false);
    }

    randomSpy.mockRestore();
    vi.useRealTimers();
  });
});
