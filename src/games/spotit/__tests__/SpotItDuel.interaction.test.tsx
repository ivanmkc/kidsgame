// @vitest-environment happy-dom
import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { SpotItDuel } from '../SpotItDuel';
import * as spotitLogic from '../logic';
import { say } from '../../../sound';

vi.mock('../../../sound', () => ({
  say: vi.fn(),
  sfx: {
    good: vi.fn(),
    wrong: vi.fn(),
    tap: vi.fn(),
    win: vi.fn(),
  },
}));

describe('SpotItDuel interaction and speech', () => {
  const noop = () => {};

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    cleanup();
  });

  it('speaks localized countdown prompt on mount in Japanese', () => {
    render(<SpotItDuel onHome={noop} difficulty="easy" lang="ja" />);
    expect(say).toHaveBeenCalledWith('ようい… スタート！');
  });

  it('speaks localized countdown prompt on mount in Mandarin, Cantonese, and English', () => {
    const { unmount: uCmn } = render(<SpotItDuel onHome={noop} difficulty="easy" lang="cmn" />);
    expect(say).toHaveBeenCalledWith('准备… 开始！');
    uCmn();

    vi.mocked(say).mockClear();
    const { unmount: uYue } = render(<SpotItDuel onHome={noop} difficulty="easy" lang="yue" />);
    expect(say).toHaveBeenCalledWith('預備… 開始！');
    uYue();

    vi.mocked(say).mockClear();
    render(<SpotItDuel onHome={noop} difficulty="easy" lang="en" />);
    expect(say).toHaveBeenCalledWith('Ready... Spot!');
  });

  it('speaks localized match-end narration when match is won', () => {
    vi.useFakeTimers();
    try {
      const fixedRound = {
        center: [0, 1, 2, 3, 4, 5],
        a: [0, 6, 7, 8, 9, 10],
        b: [1, 11, 12, 13, 14, 15],
        answerA: 0,
        answerB: 1,
      };
      vi.spyOn(spotitLogic, 'dealDuelRound').mockReturnValue(fixedRound);

      render(<SpotItDuel onHome={noop} difficulty="easy" lang="ja" />);

      // Countdown: 3 -> 2 -> 1 -> 0 -> phase becomes 'play'
      for (let i = 0; i < 4; i++) {
        act(() => {
          vi.advanceTimersByTime(800);
        });
      }

      // Easy requires 3 wins. Player A taps winning symbol 0 three times:
      for (let i = 0; i < 3; i++) {
        act(() => {
          const symbolBtn = screen.getByTestId('duel-a-my-symbol-0');
          fireEvent.click(symbolBtn);
        });
        act(() => {
          vi.advanceTimersByTime(2000);
        });
      }

      expect(say).toHaveBeenLastCalledWith('🏆 きつねのかち！  うさぎは ⭐️0こ！ よくみたね！');
      expect(screen.getByTestId('duel-score-a').getAttribute('aria-label')).toBe('きつねは ⭐️3こ');
      expect(screen.getByTestId('duel-score-b').getAttribute('aria-label')).toBe('うさぎは ⭐️0こ');
    } finally {
      vi.useRealTimers();
    }
  });

  it('speaks English match-end narration when match is won in en mode', () => {
    vi.useFakeTimers();
    try {
      const fixedRound = {
        center: [0, 1, 2, 3, 4, 5],
        a: [0, 6, 7, 8, 9, 10],
        b: [1, 11, 12, 13, 14, 15],
        answerA: 0,
        answerB: 1,
      };
      vi.spyOn(spotitLogic, 'dealDuelRound').mockReturnValue(fixedRound);

      render(<SpotItDuel onHome={noop} difficulty="easy" lang="en" />);

      for (let i = 0; i < 4; i++) {
        act(() => {
          vi.advanceTimersByTime(800);
        });
      }

      // Player B scores 1 star, then Player A scores 3 stars to win:
      act(() => {
        const symbolBtnB = screen.getByTestId('duel-b-my-symbol-1');
        fireEvent.click(symbolBtnB);
      });
      act(() => {
        vi.advanceTimersByTime(2000);
      });

      for (let i = 0; i < 3; i++) {
        act(() => {
          const symbolBtnA = screen.getByTestId('duel-a-my-symbol-0');
          fireEvent.click(symbolBtnA);
        });
        act(() => {
          vi.advanceTimersByTime(2000);
        });
      }

      expect(say).toHaveBeenLastCalledWith('🏆 Foxy wins!  Bunny spotted 1 star — great eyes!');
      expect(screen.getByTestId('duel-score-a').getAttribute('aria-label')).toBe('Foxy has 3 stars');
      expect(screen.getByTestId('duel-score-b').getAttribute('aria-label')).toBe('Bunny has 1 stars');
    } finally {
      vi.useRealTimers();
    }
  });
});
