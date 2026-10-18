// @vitest-environment happy-dom
import React from 'react';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import * as sound from '../../../sound';
import { CountGame } from '../CountGame';

describe('CountGame quiz phase', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
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
});
