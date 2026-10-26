// @vitest-environment happy-dom
import React from 'react';
import { cleanup, fireEvent, render, screen, act } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import * as sound from '../../../sound';
import { NumbersGame } from '../NumbersGame';

describe('NumbersGame coverage', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.spyOn(sound.sfx, 'tap').mockImplementation(() => {});
    vi.spyOn(sound.sfx, 'good').mockImplementation(() => {});
    vi.spyOn(sound.sfx, 'wrong').mockImplementation(() => {});
    vi.spyOn(sound, 'saySequence').mockImplementation(() => {});
    vi.useFakeTimers();
  });

  afterEach(() => {
    act(() => {
      vi.runOnlyPendingTimers();
    });
    vi.useRealTimers();
    cleanup();
  });

  it('plays a full game, handling correct/wrong taps and reset', () => {
    const onHome = vi.fn();
    render(<NumbersGame onHome={onHome} difficulty="easy" lang="en" />);

    // Easy mode has 8 rounds to win.
    for (let round = 0; round < 8; round++) {
      // Find the target number from the prompt's testID.
      const promptEl = screen.getByTestId(/^numbers-prompt-/);
      const promptId = promptEl.getAttribute('data-testid')!;
      const targetN = promptId.replace('numbers-prompt-n-', '');

      // Find the correct tile and a wrong tile.
      let correctTile: HTMLElement | null = null;
      let wrongTile: HTMLElement | null = null;
      for (let i = 0; i < 5; i++) {
        const tile = screen.getByTestId(`numbers-tile-${i}`);
        if (tile.getAttribute('aria-label') === targetN) {
          correctTile = tile;
        } else {
          wrongTile = tile;
        }
      }

      expect(correctTile).not.toBeNull();
      expect(wrongTile).not.toBeNull();

      if (round === 0) {
        // Tap a wrong tile first to cover the wrong branch.
        vi.mocked(sound.saySequence).mockClear();
        fireEvent.click(wrongTile!);
        expect(sound.sfx.wrong).toHaveBeenCalled();
        expect(sound.saySequence).toHaveBeenCalledTimes(1);

        // Advance timers to clear wrongIdx.
        act(() => {
          vi.advanceTimersByTime(500);
        });
      }

      // Tap the correct tile.
      fireEvent.click(correctTile!);
      expect(sound.sfx.good).toHaveBeenCalledTimes(round + 1);

      // Advance timers past celebration lock between rounds.
      act(() => {
        vi.advanceTimersByTime(300);
      });
    }

    // Now won should be true, so tapping a tile does nothing.
    const someTile = screen.getByTestId('numbers-tile-0');
    vi.mocked(sound.sfx.good).mockClear();
    vi.mocked(sound.sfx.wrong).mockClear();
    fireEvent.click(someTile);
    expect(sound.sfx.good).not.toHaveBeenCalled();
    expect(sound.sfx.wrong).not.toHaveBeenCalled();

    // The WinOverlay should be visible, find the "Play Again ▶️" button and click it to reset.
    // In English, nextLabel is t('en', 'overlay.playAgain') -> "Play Again ▶️"
    act(() => {
      vi.advanceTimersByTime(1000);
    });
    const playAgainBtn = screen.getByTestId('play-again');
    vi.mocked(sound.saySequence).mockClear();
    fireEvent.click(playAgainBtn);

    // Verify saySequence was called (which means round was reset)
    expect(sound.saySequence).toHaveBeenCalledTimes(1);

    // After reset, we should be on round 0 again.
    // Tap a tile to ensure the game is interactive.
    const promptEl2 = screen.getByTestId(/^numbers-prompt-/);
    const promptId2 = promptEl2.getAttribute('data-testid')!;
    const targetN2 = promptId2.replace('numbers-prompt-n-', '');
    let correctTile2: HTMLElement | null = null;
    for (let i = 0; i < 5; i++) {
      const tile = screen.getByTestId(`numbers-tile-${i}`);
      if (tile.getAttribute('aria-label') === targetN2) {
        correctTile2 = tile;
      }
    }
    expect(correctTile2).not.toBeNull();
    fireEvent.click(correctTile2!);
    expect(sound.sfx.good).toHaveBeenCalled();
  });
});
