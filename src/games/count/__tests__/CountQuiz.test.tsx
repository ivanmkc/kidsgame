// @vitest-environment happy-dom
import React from 'react';
import { render, screen, fireEvent, act, cleanup } from '@testing-library/react';
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import * as sound from '../../../sound';
import { CountGame } from '../CountGame';

describe('CountGame quiz phase', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    cleanup();
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('clears previous timeouts on double tap of wrong answer so audio does not stutter', () => {
    const saySpy = vi.spyOn(sound, 'say').mockReturnValue();
    vi.spyOn(sound, 'sayThen').mockImplementation((_, cb) => {
      if (cb) cb();
    });

    render(<CountGame onHome={() => {}} difficulty="easy" lang="en" />);

    const critters = screen.queryAllByTestId(/count-critter/);
    for (const c of critters) {
      fireEvent.click(c);
    }

    const choices = screen.queryAllByTestId(/count-choice-/);
    const wrongChoice = choices.find((c) => !c.getAttribute('data-testid')?.includes('-answer'));
    expect(wrongChoice).toBeDefined();

    saySpy.mockClear();

    fireEvent.click(wrongChoice!);
    fireEvent.click(wrongChoice!);

    act(() => {
      vi.advanceTimersByTime(500);
    });

    expect(saySpy).toHaveBeenCalledTimes(1);
  });

  it('clears pending wrong-answer timeout when correct answer is tapped immediately', () => {
    const saySpy = vi.spyOn(sound, 'say').mockReturnValue();
    const sayThenSpy = vi.spyOn(sound, 'sayThen').mockImplementation((_, cb) => {
      if (cb) cb();
    });

    render(<CountGame onHome={() => {}} difficulty="easy" lang="en" />);

    const critters = screen.queryAllByTestId(/count-critter/);
    for (const c of critters) {
      fireEvent.click(c);
    }

    const choices = screen.queryAllByTestId(/count-choice-/);
    const wrongChoice = choices.find((c) => !c.getAttribute('data-testid')?.includes('-answer'));
    const correctChoice = choices.find((c) => c.getAttribute('data-testid')?.includes('-answer'));
    expect(wrongChoice).toBeDefined();
    expect(correctChoice).toBeDefined();

    saySpy.mockClear();
    sayThenSpy.mockImplementation(() => {
      // Keep celebration active without running completion callback
    });

    fireEvent.click(wrongChoice!);
    fireEvent.click(correctChoice!);

    act(() => {
      vi.advanceTimersByTime(500);
    });

    expect(saySpy).not.toHaveBeenCalled();
  });

  it('clears pending wrong-answer timeouts on unmount', () => {
    const saySpy = vi.spyOn(sound, 'say').mockReturnValue();
    vi.spyOn(sound, 'sayThen').mockImplementation((_, cb) => {
      if (cb) cb();
    });

    const { unmount } = render(<CountGame onHome={() => {}} difficulty="easy" lang="en" />);

    const critters = screen.queryAllByTestId(/count-critter/);
    for (const c of critters) {
      fireEvent.click(c);
    }

    const choices = screen.queryAllByTestId(/count-choice-/);
    const wrongChoice = choices.find((c) => !c.getAttribute('data-testid')?.includes('-answer'));
    expect(wrongChoice).toBeDefined();

    saySpy.mockClear();

    fireEvent.click(wrongChoice!);
    unmount();

    act(() => {
      vi.advanceTimersByTime(500);
    });

    expect(saySpy).not.toHaveBeenCalled();
  });
});

