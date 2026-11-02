// @vitest-environment happy-dom
import React from 'react';
import { render, screen, fireEvent, cleanup, act } from '@testing-library/react';
import { expect, test, vi, afterEach } from 'vitest';
import { BalanceGame } from '../BalanceGame';
import * as subLogic from '../logic';
import * as sound from '../../../sound';
import { t } from '../../../i18n';

vi.mock('expo-font', () => ({
  useFonts: () => [true, null],
}));

vi.mock('../../../sound', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../../sound')>();
  return {
    ...actual,
    say: vi.fn(),
    sayThen: vi.fn((_, cb) => cb && cb()),
    stopNarration: vi.fn(),
    sfx: {
      good: vi.fn(),
      wrong: vi.fn(),
      win: vi.fn(),
      tap: vi.fn(),
    },
  };
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.clearAllMocks();
});

test('BalanceGame handles correct pick, score progression, win overlay, and reset', () => {
  vi.useFakeTimers();
  const onHome = vi.fn();
  vi.spyOn(subLogic, 'balanceSettings').mockReturnValue({ rounds: 2, maxTotal: 10 });
  const round = {
    total: 5,
    leftCount: 3,
    rightCount: 2,
    missingSide: 'left' as const,
    answer: 3,
    choices: [3, 1, 4],
    icon: 'apple',
  };
  vi.spyOn(subLogic, 'makeBalanceRound').mockReturnValue(round);

  render(<BalanceGame onHome={onHome} difficulty="easy" lang="en" />);
  const correctButton = screen.getByTestId('choice-3');

  // First correct tap
  fireEvent.click(correctButton);
  expect(sound.sfx.good).toHaveBeenCalled();
  expect(screen.getByText('1 / 2')).toBeTruthy();

  // Second correct tap (completing roundsToWin = 2)
  fireEvent.click(correctButton);
  expect(screen.getByText(t('en', 'win.balance'))).toBeTruthy();

  // Advance fake timers past the 600ms tap shield arming delay in WinOverlay
  act(() => {
    vi.advanceTimersByTime(700);
  });

  // Press next button on WinOverlay to reset
  const nextButton = screen.getByTestId('play-again');
  fireEvent.click(nextButton);
  expect(screen.getByText((c) => c.includes('0') && c.includes('2'))).toBeTruthy();
  vi.useRealTimers();
});

test('BalanceGame handles incorrect pick with explicit sound assertion', () => {
  const onHome = vi.fn();
  vi.spyOn(subLogic, 'balanceSettings').mockReturnValue({ rounds: 5, maxTotal: 10 });
  const round = {
    total: 5,
    leftCount: 3,
    rightCount: 2,
    missingSide: 'left' as const,
    answer: 3,
    choices: [3, 1, 4],
    icon: 'apple',
  };
  vi.spyOn(subLogic, 'makeBalanceRound').mockReturnValue(round);

  render(<BalanceGame onHome={onHome} difficulty="easy" lang="en" />);
  const wrongButton = screen.getByTestId('choice-1');

  fireEvent.click(wrongButton);
  expect(sound.sfx.wrong).toHaveBeenCalled();
});

test('BalanceGame handles language switch safely mid-round with fake timers and asserts no stale speech', () => {
  vi.useFakeTimers();
  const onHome = vi.fn();
  vi.spyOn(subLogic, 'balanceSettings').mockReturnValue({ rounds: 5, maxTotal: 10 });
  const round = {
    total: 5,
    leftCount: 3,
    rightCount: 2,
    missingSide: 'left' as const,
    answer: 3,
    choices: [3, 1, 4],
    icon: 'apple',
  };
  vi.spyOn(subLogic, 'makeBalanceRound').mockReturnValue(round);

  const { rerender } = render(<BalanceGame onHome={onHome} difficulty="easy" lang="en" />);
  const wrongButton = screen.getByTestId('choice-1');

  // Click wrong choice to trigger pending timeouts
  fireEvent.click(wrongButton);
  expect(sound.sfx.wrong).toHaveBeenCalled();

  // Clear mock calls before language switch
  vi.mocked(sound.say).mockClear();

  // Switch language mid-round before timers fire
  rerender(<BalanceGame onHome={onHome} difficulty="easy" lang="ja" />);

  // Advance timers and assert no old language speech fired
  act(() => {
    vi.advanceTimersByTime(1000);
  });

  expect(screen.getAllByText((c) => c.includes('数のおうち')).length).toBeGreaterThan(0);
  expect(screen.getByText('0 / 5')).toBeTruthy();
  expect(sound.say).not.toHaveBeenCalledWith(t('en', 'shell.balance.sub'));
  vi.useRealTimers();
});
