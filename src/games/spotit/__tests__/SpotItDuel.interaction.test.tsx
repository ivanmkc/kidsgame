// @vitest-environment happy-dom
import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import * as sound from '../../../sound';
import { SpotItDuel } from '../SpotItDuel';

describe('SpotItDuel interaction and spoken lines', () => {
  let saySpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    vi.restoreAllMocks();
    saySpy = vi.spyOn(sound, 'say').mockImplementation(() => {});
    vi.spyOn(sound.sfx, 'tap').mockImplementation(() => {});
    vi.spyOn(sound.sfx, 'good').mockImplementation(() => {});
    vi.spyOn(sound.sfx, 'wrong').mockImplementation(() => {});
  });

  afterEach(() => {
    cleanup();
    vi.useRealTimers();
  });

  it('speaks localized countdown line on mount for Japanese, Mandarin, Cantonese and English', () => {
    const { unmount: uJa } = render(<SpotItDuel onHome={() => {}} difficulty="easy" seed={1} lang="ja" />);
    expect(saySpy).toHaveBeenCalledWith('ようい... いっしょさがし！');
    uJa();

    saySpy.mockClear();
    const { unmount: uCmn } = render(<SpotItDuel onHome={() => {}} difficulty="easy" seed={2} lang="cmn" />);
    expect(saySpy).toHaveBeenCalledWith('准备... 找共同！');
    uCmn();

    saySpy.mockClear();
    const { unmount: uYue } = render(<SpotItDuel onHome={() => {}} difficulty="easy" seed={3} lang="yue" />);
    expect(saySpy).toHaveBeenCalledWith('準備... 搵共通！');
    uYue();

    saySpy.mockClear();
    const { unmount: uEn } = render(<SpotItDuel onHome={() => {}} difficulty="easy" seed={4} lang="en" />);
    expect(saySpy).toHaveBeenCalledWith('Ready... Spot!');
    uEn();
  });

  it('speaks localized match recap announcement when a duel ends in Japanese', () => {
    vi.useFakeTimers();
    render(<SpotItDuel onHome={() => {}} difficulty="easy" seed={42} lang="ja" />);

    // Fast-forward countdown past 3-2-1 into play
    act(() => {
      vi.advanceTimersByTime(2500);
    });

    // Score 3 rounds for Player A to win the match (duelWins = 3 on easy)
    for (let round = 0; round < 3; round++) {
      const sharedButtons = screen.getAllByTestId(/^duel-a-shared-symbol-/);
      const myButtons = screen.getAllByTestId(/^duel-a-my-symbol-/);
      const myIds = new Set(myButtons.map((b) => b.getAttribute('data-testid')?.replace('duel-a-my-symbol-', '')));
      const matchBtn = sharedButtons.find((b) =>
        myIds.has(b.getAttribute('data-testid')?.replace('duel-a-shared-symbol-', '')),
      );
      expect(matchBtn).toBeDefined();

      act(() => {
        fireEvent.click(matchBtn!);
      });

      // Advance through roundEnd delay (900ms) and redeal if not last round
      act(() => {
        vi.advanceTimersByTime(2000);
      });
    }

    // Match ended: say() should have been called with Japanese recap
    expect(saySpy).toHaveBeenCalledWith('Foxyのかち！ Bunnyは ほし0こ。ふたりとも よくみたね！');
  });

  it('speaks localized match recap announcement when a duel ends in Cantonese', () => {
    vi.useFakeTimers();
    render(<SpotItDuel onHome={() => {}} difficulty="easy" seed={42} lang="yue" />);

    act(() => {
      vi.advanceTimersByTime(2500);
    });

    for (let round = 0; round < 3; round++) {
      const sharedButtons = screen.getAllByTestId(/^duel-a-shared-symbol-/);
      const myButtons = screen.getAllByTestId(/^duel-a-my-symbol-/);
      const myIds = new Set(myButtons.map((b) => b.getAttribute('data-testid')?.replace('duel-a-my-symbol-', '')));
      const matchBtn = sharedButtons.find((b) =>
        myIds.has(b.getAttribute('data-testid')?.replace('duel-a-shared-symbol-', '')),
      );
      expect(matchBtn).toBeDefined();

      act(() => {
        fireEvent.click(matchBtn!);
      });

      act(() => {
        vi.advanceTimersByTime(2000);
      });
    }

    expect(saySpy).toHaveBeenCalledWith('Foxy贏咗！Bunny搵到 0 粒星。兩個眼力都好勁！');
  });

  it('counts down 3, 2, 1 visually on mount', () => {
    vi.useFakeTimers();

    render(<SpotItDuel onHome={() => {}} difficulty="easy" seed={42} lang="en" />);
    expect(screen.getByTestId('duel-countdown').textContent).toBe('3');
    act(() => {
      vi.advanceTimersByTime(800);
    });
    expect(screen.getByTestId('duel-countdown').textContent).toBe('2');
    act(() => {
      vi.advanceTimersByTime(800);
    });
    expect(screen.getByTestId('duel-countdown').textContent).toBe('1');
    act(() => {
      vi.advanceTimersByTime(800);
    });
    expect(screen.queryByTestId('duel-countdown')).toBeNull();
  });
});
