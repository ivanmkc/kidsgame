// @vitest-environment happy-dom
import React from 'react';
import { render, fireEvent, act, screen, cleanup } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { FastSlowGame } from './FastSlowGame';
import { playSequence } from '../../music';
import { sfx } from '../../sound';

vi.mock('../../sound', () => ({
  sfx: { good: vi.fn(), wrong: vi.fn(), win: vi.fn(), tap: vi.fn() },
  say: vi.fn(),
}));

vi.mock('../../music', () => ({
  playSequence: vi.fn((notes, bpm, cb, onEnd) => {
    if (onEnd) onEnd();
  }),
  stopSequence: vi.fn(),
}));

describe('FastSlowGame UI interaction', () => {
  afterEach(() => {
    cleanup();
  });
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

  it('prevents fast-tap hammering from queueing multiple round transitions', () => {
    vi.useFakeTimers();
    render(<FastSlowGame onHome={() => {}} difficulty="easy" lang="en" />);

    act(() => {
      vi.advanceTimersByTime(450);
    });

    const calls = vi.mocked(playSequence).mock.calls;
    const bpm = calls[calls.length - 1][1] as number;
    const speed = bpm >= 140 ? 'fast' : 'slow';
    const correctBtn = screen.getByTestId(speed === 'fast' ? 'fastslow-fast' : 'fastslow-slow');

    const playSeqCallsBefore = vi.mocked(playSequence).mock.calls.length;
    vi.mocked(sfx.good).mockClear();

    // Rapidly tap the correct button multiple times in the same tick
    act(() => {
      fireEvent.click(correctBtn);
      fireEvent.click(correctBtn);
      fireEvent.click(correctBtn);
    });

    expect(sfx.good).toHaveBeenCalledTimes(1);

    // Advance through the celebration delay and the next round start delay
    act(() => {
      vi.advanceTimersByTime(1000);
    });
    act(() => {
      vi.advanceTimersByTime(450);
    });

    // Only one round transition should occur
    expect(vi.mocked(playSequence).mock.calls.length).toBe(playSeqCallsBefore + 1);
    expect(screen.getByTestId('fastslow-score').textContent).toBe('🎵 1/8');

    // Extra time: ensure no trailing timeouts fire to skip rounds
    act(() => {
      vi.advanceTimersByTime(2000);
    });
    expect(vi.mocked(playSequence).mock.calls.length).toBe(playSeqCallsBefore + 1);

    vi.useRealTimers();
  });

  it('unlocks picks after resetting the game on win', () => {
    vi.useFakeTimers();
    render(<FastSlowGame onHome={() => {}} difficulty="easy" lang="en" />);

    // Easy difficulty requires 8 rounds
    for (let i = 0; i < 8; i++) {
      act(() => {
        vi.advanceTimersByTime(450);
      });
      const calls = vi.mocked(playSequence).mock.calls;
      const bpm = calls[calls.length - 1][1] as number;
      const speed = bpm >= 140 ? 'fast' : 'slow';
      const btn = screen.getByTestId(speed === 'fast' ? 'fastslow-fast' : 'fastslow-slow');
      fireEvent.click(btn);
      act(() => {
        vi.advanceTimersByTime(1100);
      });
    }

    expect(screen.getByTestId('fastslow-score').textContent).toBe('🎵 8/8');

    // WinOverlay arms after 600ms
    act(() => {
      vi.advanceTimersByTime(650);
    });

    // Click play again
    const playAgainBtn = screen.getByTestId('play-again');
    fireEvent.click(playAgainBtn);

    // Initial listen phase of new game
    act(() => {
      vi.advanceTimersByTime(450);
    });

    expect(screen.getByTestId('fastslow-score').textContent).toBe('🎵 0/8');

    // Can pick in the new game
    const calls = vi.mocked(playSequence).mock.calls;
    const bpm = calls[calls.length - 1][1] as number;
    const speed = bpm >= 140 ? 'fast' : 'slow';
    const btn = screen.getByTestId(speed === 'fast' ? 'fastslow-fast' : 'fastslow-slow');
    fireEvent.click(btn);

    expect(screen.getByTestId('fastslow-score').textContent).toBe('🎵 1/8');

    vi.useRealTimers();
  });
});
