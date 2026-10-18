// @vitest-environment happy-dom
import React from 'react';
import { describe, expect, it, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { HighLowGame } from '../HighLowGame';
import * as music from '../../../music';

describe('HighLowGame', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('runs a full game, showing listen phase, replay, picking, and winning', () => {
    vi.useFakeTimers();

    vi.spyOn(music, 'playSequence').mockImplementation((notes, bpm, onNote, onDone) => {
      if (onDone) {
        setTimeout(onDone, 500);
      }
      return () => {};
    });

    const onHome = vi.fn();
    render(<HighLowGame onHome={onHome} difficulty="easy" lang="en" />);

    for (let i = 0; i < 8; i++) {
      expect(screen.getByText('Listen', { exact: false })).toBeTruthy();

      act(() => {
        vi.advanceTimersByTime(1000);
      });

      expect(screen.queryByText('Listen', { exact: false })).toBeNull();

      if (i === 0) {
        fireEvent.click(screen.getByTestId('highlow-replay'));
        expect(screen.getByText('Listen', { exact: false })).toBeTruthy();
        act(() => {
          vi.advanceTimersByTime(1000);
        });
      }

      const highBtn = screen.getByTestId('highlow-high');
      fireEvent.click(highBtn);

      act(() => {
        vi.advanceTimersByTime(600);
      });

      const nextScore = i + 1;
      const scoreStr = `🎵 ${nextScore}/8`;
      let scoreEl = screen.queryByText(scoreStr, { exact: false });

      if (!scoreEl) {
        const lowBtn = screen.getByTestId('highlow-low');
        fireEvent.click(lowBtn);
        act(() => {
          vi.advanceTimersByTime(600);
        });

        scoreEl = screen.queryByText(scoreStr, { exact: false });
        expect(scoreEl).toBeTruthy();
      }
    }

    const playAgainBtn = screen.getByText('Play Again', { exact: false });
    // Try clicking a pick button after winning
    fireEvent.click(screen.getByTestId('highlow-high'));

    expect(playAgainBtn).toBeTruthy();

    fireEvent.click(playAgainBtn);
    expect(screen.getByText('🎵 0/8', { exact: false })).toBeTruthy();

    act(() => {
      vi.advanceTimersByTime(1000);
    });

    const backBtn = screen.getByTestId('back-button');
    fireEvent.click(backBtn);
    expect(onHome).toHaveBeenCalled();
  });
});
