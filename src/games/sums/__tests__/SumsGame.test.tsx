// @vitest-environment happy-dom
import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { SumsGame } from '../SumsGame';
import * as sound from '../../../sound';

describe('SumsGame fast-tap', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.spyOn(sound.sfx, 'wrong').mockImplementation(() => {});
    vi.spyOn(sound.sfx, 'good').mockImplementation(() => {});
    vi.spyOn(sound.sfx, 'boing').mockImplementation(() => {});
    vi.spyOn(sound, 'say').mockImplementation(() => {});
    vi.spyOn(sound, 'saySequence').mockImplementation(() => {});
    vi.spyOn(sound, 'sayThen').mockImplementation((texts, done) => {
      if (done) done();
    });
  });

  afterEach(() => {
    vi.runOnlyPendingTimers();
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('queues the wrong-answer voice prompt only once when tapped rapidly', () => {
    render(<SumsGame onHome={() => {}} difficulty="easy" lang="en" />);

    // Clear initial round saySequence calls.
    vi.clearAllMocks();

    const buttons = screen.getAllByRole('button');
    const wrongButtons = buttons.filter((b) => {
      const tid = b.getAttribute('data-testid');
      return tid && tid.startsWith('sums-choice-') && !tid.endsWith('-answer');
    });

    const wrongButton = wrongButtons[0];
    expect(wrongButton).toBeDefined();

    // Tap rapidly 4 times
    fireEvent.click(wrongButton);
    act(() => {
      vi.advanceTimersByTime(100);
    });
    fireEvent.click(wrongButton);
    act(() => {
      vi.advanceTimersByTime(100);
    });
    fireEvent.click(wrongButton);
    act(() => {
      vi.advanceTimersByTime(100);
    });
    fireEvent.click(wrongButton);

    // Fast forward to just before the 500ms timeout of the last tap.
    // The last tap occurred at T=300ms; its 500ms timeout expires at T=800ms.
    act(() => {
      vi.advanceTimersByTime(499);
    });
    expect(sound.say).not.toHaveBeenCalled();

    // Fast forward exactly to the 500ms mark of the last tap.
    act(() => {
      vi.advanceTimersByTime(1);
    });

    expect(sound.say).toHaveBeenCalledTimes(1);
  });
});

describe('SumsGame', () => {
  it('plays through a full game to win, then resets', () => {
    vi.useFakeTimers();
    vi.spyOn(sound, 'say').mockImplementation(() => {});
    vi.spyOn(sound, 'saySequence').mockImplementation(() => {});
    vi.spyOn(sound, 'sayThen').mockImplementation((_, cb) => cb());
    vi.spyOn(sound.sfx, 'good').mockImplementation(() => {});
    vi.spyOn(sound.sfx, 'wrong').mockImplementation(() => {});
    vi.spyOn(sound.sfx, 'boing').mockImplementation(() => {});

    const { unmount } = render(<SumsGame onHome={() => {}} difficulty="easy" lang="en" />);
    act(() => { vi.runAllTimers(); });

    const clickAnswer = (isWrong = false) => {
      const buttons = screen.getAllByRole('button');
      const targetButtons = buttons.filter((b) => {
        const tid = b.getAttribute('data-testid');
        if (!tid || !tid.startsWith('sums-choice-')) return false;
        return isWrong ? !tid.endsWith('-answer') : tid.endsWith('-answer');
      });
      const target = targetButtons[0];
      expect(target).toBeDefined();
      if (!target) throw new Error('Target choice not found');
      fireEvent.click(target);
      act(() => { vi.runAllTimers(); });
    };

    // Click wrong first
    clickAnswer(true);
    expect(sound.sfx.wrong).toHaveBeenCalled();

    // Need 5 correct to win on easy
    for (let i = 0; i < 5; i++) {
      clickAnswer(false);
    }
    expect(sound.sfx.good).toHaveBeenCalledTimes(5);
    expect(screen.getByTestId('win-overlay')).toBeDefined();

    const resetBtn = screen.getByTestId('play-again');
    expect(resetBtn).toBeDefined();
    fireEvent.click(resetBtn);
    act(() => { vi.runAllTimers(); });

    expect(screen.queryByTestId('win-overlay')).toBeNull();
    unmount();
    
    vi.useRealTimers();
    vi.restoreAllMocks();
  });
});
