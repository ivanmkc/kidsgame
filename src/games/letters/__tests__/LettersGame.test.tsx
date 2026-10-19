// @vitest-environment happy-dom
import React from 'react';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { LettersGame } from '../LettersGame';
import * as logic from '../logic';
import { sfx } from '../../../sound';

vi.mock('../../../sound', () => ({
  say: vi.fn(),
  sfx: {
    good: vi.fn(),
    wrong: vi.fn(),
  },
}));

describe('LettersGame', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.clearAllMocks();
  });

  afterEach(() => {
    cleanup();
  });

  it('prevents fast-tap hammering from advancing the round and playing sound twice', () => {
    const generatedRounds: logic.LetterRound[] = [];
    const origMakeLetterRound = logic.makeLetterRound;
    const makeRoundSpy = vi.spyOn(logic, 'makeLetterRound').mockImplementation((rng, tier, tileCount, avoidKey) => {
      const res = origMakeLetterRound(rng, tier, tileCount, avoidKey);
      generatedRounds.push(res);
      return res;
    });

    render(<LettersGame onHome={() => {}} difficulty="easy" lang="en" />);

    expect(makeRoundSpy).toHaveBeenCalledTimes(1);
    expect(sfx.good).not.toHaveBeenCalled();

    const round1 = generatedRounds[0];
    const correctLabel = round1.tiles[round1.answerIdx].label;
    const correctBtn = screen.getByLabelText(correctLabel);
    expect(correctBtn).toBeTruthy();

    act(() => {
      fireEvent.click(correctBtn);
      fireEvent.click(correctBtn);
    });

    expect(sfx.good).toHaveBeenCalledTimes(1);
    expect(makeRoundSpy).toHaveBeenCalledTimes(2);
    expect(screen.getByTestId('letters-score').textContent).toContain('1/8');
  });

  it('locks input during wrong-tap feedback and ignores further taps for 450ms', () => {
    vi.useFakeTimers();
    try {
      const generatedRounds: logic.LetterRound[] = [];
      const origMakeLetterRound = logic.makeLetterRound;
      vi.spyOn(logic, 'makeLetterRound').mockImplementation((rng, tier, tileCount, avoidKey) => {
        const res = origMakeLetterRound(rng, tier, tileCount, avoidKey);
        generatedRounds.push(res);
        return res;
      });

      render(<LettersGame onHome={() => {}} difficulty="easy" lang="en" />);

      const round1 = generatedRounds[0];
      const wrongTile = round1.tiles.find((t) => !t.isAnswer)!;
      const wrongBtn = screen.getByLabelText(wrongTile.label);
      const correctTile = round1.tiles[round1.answerIdx];
      const correctBtn = screen.getByLabelText(correctTile.label);

      // Fast-tap the wrong tile multiple times synchronously
      act(() => {
        fireEvent.click(wrongBtn);
        fireEvent.click(wrongBtn);
        fireEvent.click(wrongBtn);
      });

      expect(sfx.wrong).toHaveBeenCalledTimes(1);

      // Attempting to tap the correct tile while wrong feedback is active is ignored
      act(() => {
        fireEvent.click(correctBtn);
      });
      expect(sfx.good).not.toHaveBeenCalled();
      expect(screen.getByTestId('letters-score').textContent).toContain('0/8');

      // Fast-forward past the 450ms timeout
      act(() => {
        vi.advanceTimersByTime(450);
      });

      // Now tapping the correct tile works and advances the round
      act(() => {
        fireEvent.click(correctBtn);
      });
      expect(sfx.good).toHaveBeenCalledTimes(1);
      expect(screen.getByTestId('letters-score').textContent).toContain('1/8');
    } finally {
      vi.useRealTimers();
    }
  });

  it('unlocks input on new round so that the next round is playable', () => {
    const generatedRounds: logic.LetterRound[] = [];
    const origMakeLetterRound = logic.makeLetterRound;
    vi.spyOn(logic, 'makeLetterRound').mockImplementation((rng, tier, tileCount, avoidKey) => {
      const res = origMakeLetterRound(rng, tier, tileCount, avoidKey);
      generatedRounds.push(res);
      return res;
    });

    render(<LettersGame onHome={() => {}} difficulty="easy" lang="en" />);

    // Round 1
    const round1Answer = generatedRounds[0].tiles[generatedRounds[0].answerIdx];
    act(() => {
      fireEvent.click(screen.getByLabelText(round1Answer.label));
    });

    expect(sfx.good).toHaveBeenCalledTimes(1);
    expect(screen.getByTestId('letters-score').textContent).toContain('1/8');
    expect(generatedRounds).toHaveLength(2);

    // Round 2 tile click works
    const round2Answer = generatedRounds[1].tiles[generatedRounds[1].answerIdx];
    act(() => {
      fireEvent.click(screen.getByLabelText(round2Answer.label));
    });

    expect(sfx.good).toHaveBeenCalledTimes(2);
    expect(screen.getByTestId('letters-score').textContent).toContain('2/8');
  });
});
