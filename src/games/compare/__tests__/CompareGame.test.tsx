// @vitest-environment happy-dom
import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import * as sound from '../../../sound';
import { CompareGame } from '../CompareGame';

describe('CompareGame fast-tap lock', () => {
  let goodSpy: ReturnType<typeof vi.spyOn>;
  let wrongSpy: ReturnType<typeof vi.spyOn>;
  let saySpy: ReturnType<typeof vi.spyOn>;
  let sayThenSpy: ReturnType<typeof vi.spyOn>;
  let sayThenCallback: (() => void) | null = null;

  beforeEach(() => {
    vi.restoreAllMocks();
    sayThenCallback = null;
    goodSpy = vi.spyOn(sound.sfx, 'good').mockImplementation(() => {});
    wrongSpy = vi.spyOn(sound.sfx, 'wrong').mockImplementation(() => {});
    saySpy = vi.spyOn(sound, 'say').mockImplementation(() => {});
    sayThenSpy = vi.spyOn(sound, 'sayThen').mockImplementation((_lines, cb) => {
      sayThenCallback = cb ?? null;
    });
  });

  afterEach(() => {
    cleanup();
    vi.useRealTimers();
  });

  it('hammering the wrong side ignores duplicate taps and queues only one error sound and voice prompt', () => {
    vi.useFakeTimers();
    render(<CompareGame onHome={() => {}} difficulty="easy" lang="en" />);

    saySpy.mockClear();

    const plates = [screen.getByTestId(/^compare-plate-left/), screen.getByTestId(/^compare-plate-right/)];
    const wrongPlate = plates.find((p) => !p.getAttribute('data-testid')?.endsWith('-correct'))!;
    expect(wrongPlate).toBeDefined();

    act(() => {
      fireEvent.click(wrongPlate);
      fireEvent.click(wrongPlate);
      fireEvent.click(wrongPlate);
    });

    expect(wrongSpy).toHaveBeenCalledTimes(1);
    expect(saySpy).not.toHaveBeenCalled();

    act(() => {
      vi.advanceTimersByTime(500);
    });

    expect(saySpy).toHaveBeenCalledTimes(1);

    act(() => {
      fireEvent.click(wrongPlate);
    });
    expect(wrongSpy).toHaveBeenCalledTimes(2);
  });

  it('hammering the correct side ignores duplicate taps, increments score once, and advances round cleanly', () => {
    render(<CompareGame onHome={() => {}} difficulty="easy" lang="en" />);

    expect(screen.getByTestId('compare-score').textContent).toContain('0/6');

    const plates = [screen.getByTestId(/^compare-plate-left/), screen.getByTestId(/^compare-plate-right/)];
    const correctPlate = plates.find((p) => p.getAttribute('data-testid')?.endsWith('-correct'))!;
    expect(correctPlate).toBeDefined();

    fireEvent.click(correctPlate);
    fireEvent.click(correctPlate);
    fireEvent.click(correctPlate);

    expect(goodSpy).toHaveBeenCalledTimes(1);
    expect(sayThenSpy).toHaveBeenCalledTimes(1);
    expect(screen.getByTestId('compare-score').textContent).toContain('1/6');

    expect(sayThenCallback).not.toBeNull();
    act(() => {
      sayThenCallback!();
    });

    expect(screen.getByTestId('compare-score').textContent).toContain('1/6');

    const nextPlates = [screen.getByTestId(/^compare-plate-left/), screen.getByTestId(/^compare-plate-right/)];
    const nextCorrect = nextPlates.find((p) => p.getAttribute('data-testid')?.endsWith('-correct'))!;
    fireEvent.click(nextCorrect);
    expect(goodSpy).toHaveBeenCalledTimes(2);
    expect(screen.getByTestId('compare-score').textContent).toContain('2/6');
  });

  it('ignores taps on correct side while wrong-side feedback is active', () => {
    vi.useFakeTimers();
    render(<CompareGame onHome={() => {}} difficulty="easy" lang="en" />);

    const plates = [screen.getByTestId(/^compare-plate-left/), screen.getByTestId(/^compare-plate-right/)];
    const wrongPlate = plates.find((p) => !p.getAttribute('data-testid')?.endsWith('-correct'))!;
    const correctPlate = plates.find((p) => p.getAttribute('data-testid')?.endsWith('-correct'))!;

    act(() => {
      fireEvent.click(wrongPlate);
    });
    expect(wrongSpy).toHaveBeenCalledTimes(1);

    act(() => {
      fireEvent.click(correctPlate);
    });
    expect(goodSpy).not.toHaveBeenCalled();
    expect(screen.getByTestId('compare-score').textContent).toContain('0/6');

    act(() => {
      vi.advanceTimersByTime(450);
    });

    act(() => {
      fireEvent.click(correctPlate);
    });
    expect(goodSpy).toHaveBeenCalledTimes(1);
    expect(screen.getByTestId('compare-score').textContent).toContain('1/6');
  });

  it('ignores wrong tap while correct side celebration is playing', () => {
    render(<CompareGame onHome={() => {}} difficulty="easy" lang="en" />);

    const plates = [screen.getByTestId(/^compare-plate-left/), screen.getByTestId(/^compare-plate-right/)];
    const wrongPlate = plates.find((p) => !p.getAttribute('data-testid')?.endsWith('-correct'))!;
    const correctPlate = plates.find((p) => p.getAttribute('data-testid')?.endsWith('-correct'))!;

    fireEvent.click(correctPlate);
    expect(goodSpy).toHaveBeenCalledTimes(1);

    fireEvent.click(wrongPlate);
    expect(wrongSpy).not.toHaveBeenCalled();
  });

  it('reset on play again resets score and unlocks input', () => {
    vi.useFakeTimers();
    render(<CompareGame onHome={() => {}} difficulty="easy" lang="en" />);

    for (let r = 0; r < 6; r++) {
      const plates = [screen.getByTestId(/^compare-plate-left/), screen.getByTestId(/^compare-plate-right/)];
      const correctPlate = plates.find((p) => p.getAttribute('data-testid')?.endsWith('-correct'))!;
      act(() => {
        fireEvent.click(correctPlate);
      });
      if (r < 5) {
        expect(sayThenCallback).not.toBeNull();
        act(() => {
          sayThenCallback!();
        });
      }
    }

    expect(screen.getByTestId('compare-score').textContent).toContain('6/6');

    act(() => {
      vi.advanceTimersByTime(600);
    });

    const playAgainBtn = screen.getByTestId('play-again');
    act(() => {
      fireEvent.click(playAgainBtn);
    });

    expect(screen.getByTestId('compare-score').textContent).toContain('0/6');

    const newPlates = [screen.getByTestId(/^compare-plate-left/), screen.getByTestId(/^compare-plate-right/)];
    const newCorrect = newPlates.find((p) => p.getAttribute('data-testid')?.endsWith('-correct'))!;
    act(() => {
      fireEvent.click(newCorrect);
    });
    expect(screen.getByTestId('compare-score').textContent).toContain('1/6');
  });
});
