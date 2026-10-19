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
