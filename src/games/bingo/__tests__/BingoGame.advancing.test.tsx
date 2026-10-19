// @vitest-environment happy-dom
import React from 'react';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import * as sound from '../../../sound';
import { sfx } from '../../../sound';
import { BingoGame } from '../BingoGame';

describe('BingoGame advancing state', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('ignores incorrect tile taps and prompt taps while advancing (sayThen is pending)', async () => {
    const sfxGoodSpy = vi.spyOn(sfx, 'good').mockReturnValue();
    const sfxWrongSpy = vi.spyOn(sfx, 'wrong').mockReturnValue();
    const sfxTapSpy = vi.spyOn(sfx, 'tap').mockReturnValue();
    const sayThenSpy = vi.spyOn(sound, 'sayThen').mockImplementation(() => {});
    const saySequenceSpy = vi.spyOn(sound, 'saySequence').mockImplementation(() => {});

    render(<BingoGame onHome={() => {}} difficulty="easy" lang="en" />);

    // Initial sequence is spoken on mount.
    expect(saySequenceSpy).toHaveBeenCalled();
    saySequenceSpy.mockClear();

    // The grid has tiles. We don't know which is the correct one, so let's tap tiles until we hit the correct one.
    // When we hit the correct one, sayThen will be called, but the callback won't be invoked.
    // This simulates the "advancing" state!
    const tiles = screen.getAllByRole('button').filter((b) => b.getAttribute('data-testid')?.startsWith('bingo-cell-'));
    const prompt = screen.getByTestId('bingo-prompt');

    let firstCorrectTile: HTMLElement | null = null;
    for (const tile of tiles) {
      fireEvent.click(tile);
      if (sfxGoodSpy.mock.calls.length > 0) {
        firstCorrectTile = tile;
        break;
      }
      // If wrong, reset spy
      sfxWrongSpy.mockClear();
    }

    expect(firstCorrectTile).not.toBeNull();
    expect(sayThenSpy).toHaveBeenCalled(); // Waiting for next call...

    saySequenceSpy.mockClear();
    sfxTapSpy.mockClear();

    // Now we are in "isAdvancing" state because sayThen callback hasn't fired yet!
    // Let's try tapping another tile. It should NOT trigger wrong/good sfx, nor saySequence!
    for (const tile of tiles) {
      fireEvent.click(tile);
    }
    expect(sfxWrongSpy).not.toHaveBeenCalled();
    // It shouldn't trigger another good sfx either since it's advancing
    expect(sfxGoodSpy).toHaveBeenCalledTimes(1);

    // Try tapping the prompt button. It should NOT trigger saySequence or tap sfx.
    fireEvent.click(prompt);
    expect(sfxTapSpy).not.toHaveBeenCalled();
    expect(saySequenceSpy).not.toHaveBeenCalled();

    // Now manually trigger the sayThen callback to complete the advancement!
    const sayThenCallback = sayThenSpy.mock.calls[0][1];
    act(() => {
      sayThenCallback();
    });

    // After callback, state should no longer be advancing.
    sfxWrongSpy.mockClear();
    saySequenceSpy.mockClear();

    const promptLabel = screen.getByTestId('bingo-prompt').getAttribute('aria-label');
    const round2CorrectTile = tiles.find((tile) => promptLabel === `Find the ${tile.getAttribute('aria-label')}!`);
    const wrongTile = tiles.find((tile) => tile !== firstCorrectTile && tile !== round2CorrectTile);

    expect(wrongTile).toBeDefined();
    expect(round2CorrectTile).toBeDefined();

    // Tap one known-wrong tile (not the new call's answer and not marked).
    fireEvent.click(wrongTile!);
    expect(sfxWrongSpy).toHaveBeenCalledOnce();
    expect(saySequenceSpy).toHaveBeenCalledOnce();

    // Tap the new call's correct tile.
    sfxGoodSpy.mockClear();
    fireEvent.click(round2CorrectTile!);
    expect(sfxGoodSpy).toHaveBeenCalledOnce();
    expect(screen.getByTestId('bingo-score').textContent).toBe('⭐ 2/9');
  });
});
