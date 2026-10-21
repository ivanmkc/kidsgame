// @vitest-environment happy-dom
import React from 'react';
import { render, screen, act, cleanup, fireEvent, within } from '@testing-library/react';
import { describe, expect, it, vi, afterEach } from 'vitest';
import * as sound from '../../../sound';
import * as logic from '../logic';
import { CarModeGame } from '../CarModeGame';

const noop = () => {};

describe('CarModeGame interactions', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
    cleanup();
  });

  it('calls startRound on mount and advances to gap on audio completion', () => {
    vi.useFakeTimers();
    vi.spyOn(sound, 'sayThen').mockImplementation((_text, cb) => {
      setTimeout(cb, 100);
    });

    render(<CarModeGame onHome={noop} lang="en" />);

    expect(screen.getByText('Listen...')).toBeDefined();

    act(() => {
      vi.advanceTimersByTime(10000);
    });

    expect(screen.getByText('Your turn!')).toBeDefined();
  });

  it('handles standard packs without boops delay', () => {
    vi.useFakeTimers();
    vi.spyOn(sound, 'sayThen').mockImplementation((_text, cb) => {
      setTimeout(cb, 100);
    });

    const actual = logic.startState('silly', 42);
    vi.spyOn(logic, 'startState').mockReturnValue(actual);

    render(<CarModeGame onHome={noop} lang="en" />);

    expect(screen.getByText('Listen...')).toBeDefined();

    act(() => {
      vi.advanceTimersByTime(1000);
    });

    expect(screen.getByText('Your turn!')).toBeDefined();
  });

  it('allows user taps during prompt phase to advance directly to gap', () => {
    render(<CarModeGame onHome={noop} lang="en" />);

    expect(screen.getByText('Listen...')).toBeDefined();

    const tapBtn = screen.getByTestId('carmode-tap');
    fireEvent.click(tapBtn);

    expect(screen.getByText('Your turn!')).toBeDefined();
  });

  it('advances round immediately on single tap during reveal phase for twoTapAnswer pack', () => {
    vi.spyOn(sound, 'saySequence').mockReturnValue();
    vi.spyOn(sound, 'sayThen').mockReturnValue();
    vi.spyOn(sound, 'stopNarration').mockReturnValue();

    const actual = logic.startState('silly', 42);
    vi.spyOn(logic, 'startState').mockReturnValue({
      ...actual,
      phase: 'reveal',
      pendingTaps: 0,
    });

    render(<CarModeGame onHome={noop} lang="en" />);

    expect(screen.getByText('Tap!')).toBeDefined();
    expect(screen.getByTestId('carmode-score').textContent).toContain('1/24');

    const tapBtn = screen.getByTestId('carmode-tap');
    fireEvent.click(tapBtn);

    expect(screen.getByText('Listen...')).toBeDefined();
    expect(screen.getByTestId('carmode-score').textContent).toContain('2/24');
  });

  it('resets celebratory confetti when switching packs after completion', () => {
    const initial = logic.startState('boops', 42);
    const lastRoundState: logic.CarModeState = {
      ...initial,
      roundIdx: initial.rounds.length - 1,
      phase: 'reveal',
    };
    vi.spyOn(logic, 'startState').mockReturnValueOnce(lastRoundState);

    render(<CarModeGame onHome={noop} lang="en" />);

    expect(screen.queryAllByText('🎉')).toHaveLength(0);

    const tapBtn = screen.getByTestId('carmode-tap');
    fireEvent.click(tapBtn);

    expect(screen.getByText('All done!')).toBeDefined();
    expect(screen.queryAllByText('🎉').length).toBeGreaterThan(0);

    const rhymeBtn = screen.getByTestId('carmode-pack-rhyme');
    fireEvent.click(rhymeBtn);

    expect(screen.queryByText('All done!')).toBeNull();
    expect(screen.queryAllByText('🎉')).toHaveLength(0);
  });

  it('displays localized phase text in Japanese when advancing from prompt to gap', () => {
    render(<CarModeGame onHome={noop} lang="ja" />);

    expect(screen.getByText('きいてね…')).toBeDefined();

    const tapBtn = screen.getByTestId('carmode-tap');
    fireEvent.click(tapBtn);

    expect(screen.getByText('きみの ばん！')).toBeDefined();
  });

  it.each([
    { lang: 'ja', expected: 'タップ！' },
    { lang: 'cmn', expected: '点一点！' },
    { lang: 'yue', expected: '撳一撳！' },
  ] as const)('localizes reveal button text for $lang', ({ lang, expected }) => {
    const actual = logic.startState('silly', 42);
    vi.spyOn(logic, 'startState').mockReturnValue({
      ...actual,
      phase: 'reveal',
      pendingTaps: 0,
    });

    render(<CarModeGame onHome={noop} lang={lang} />);
    const tapBtn = screen.getByTestId('carmode-tap');
    expect(within(tapBtn).getByText(expected)).toBeDefined();
    expect(within(tapBtn).queryByText('Tap!')).toBeNull();
  });

  it.each([
    { lang: 'ja', expected: 'おしまい！' },
    { lang: 'cmn', expected: '全部完成！' },
    { lang: 'yue', expected: '全部搞掂！' },
  ] as const)('localizes completion screen text for $lang', ({ lang, expected }) => {
    const actual = logic.startState('boops', 42);
    vi.spyOn(logic, 'startState').mockReturnValue({
      ...actual,
      phase: 'done',
    });

    render(<CarModeGame onHome={noop} lang={lang} />);
    expect(screen.getByText(expected)).toBeDefined();
    expect(screen.queryByText('All done!')).toBeNull();
  });
});
