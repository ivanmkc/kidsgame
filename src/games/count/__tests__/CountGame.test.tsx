import React from 'react';
import { renderToString } from 'react-dom/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import * as sound from '../../../sound';
import { sfx } from '../../../sound';
import { CountGame } from '../CountGame';
import * as countLogic from '../logic';

let capturedWinOverlayProps: { onNext?: () => void } | null = null;
vi.mock('../../../components/WinOverlay', () => ({
  WinOverlay: (props: { onNext?: () => void }) => {
    capturedWinOverlayProps = props;
    return null;
  },
}));

let capturedPressables: Record<string, { onPress?: () => void }> = {};
vi.mock('react-native', async (importOriginal) => {
  const actual = await importOriginal<Record<string, unknown>>();
  const ActualPressable = actual.Pressable as React.ComponentType<Record<string, unknown>>;
  return {
    ...actual,
    Pressable: (props: Record<string, unknown>) => {
      if (typeof props.testID === 'string') {
        capturedPressables[props.testID] = props as { onPress?: () => void };
      }
      return React.createElement(ActualPressable, props);
    },
  };
});

describe('CountGame', () => {
  const noop = () => {};

  beforeEach(() => {
    for (const key of Object.keys(capturedPressables)) {
      delete capturedPressables[key];
    }
    vi.restoreAllMocks();
  });

  it('ignores duplicate taps on the same critter and accumulates concurrent taps across different critters', () => {
    const sfxSpy = vi.spyOn(sound.sfx, 'tap').mockReturnValue();
    const saySpy = vi.spyOn(sound, 'say').mockReturnValue();

    renderToString(<CountGame onHome={noop} difficulty="medium" lang="en" />);

    const critter0 = capturedPressables['count-critter-0'];
    const critter1 = capturedPressables['count-critter-1'];
    expect(critter0).toBeDefined();
    expect(critter1).toBeDefined();

    // First tap on critter 0: registers "one"
    critter0.onPress?.();
    expect(sfxSpy).toHaveBeenCalledTimes(1);
    expect(saySpy).toHaveBeenCalledTimes(1);
    expect(saySpy).toHaveBeenNthCalledWith(1, 'one');

    // Duplicate tap on critter 0 before re-rendering: ignored
    critter0.onPress?.();
    expect(sfxSpy).toHaveBeenCalledTimes(1);
    expect(saySpy).toHaveBeenCalledTimes(1);

    // Rapid concurrent tap on critter 1 before re-rendering: registers "two"
    critter1.onPress?.();
    expect(sfxSpy).toHaveBeenCalledTimes(2);
    expect(saySpy).toHaveBeenCalledTimes(2);
    expect(saySpy).toHaveBeenNthCalledWith(2, 'two');
  });

  it('triggers quiz phase transition on the final concurrent tap', () => {
    vi.spyOn(sound.sfx, 'tap').mockReturnValue();
    vi.spyOn(sound, 'say').mockReturnValue();
    const sayThenSpy = vi.spyOn(sound, 'sayThen').mockReturnValue();

    renderToString(<CountGame onHome={noop} difficulty="easy" lang="en" />);

    const critterKeys = Object.keys(capturedPressables).filter((k) => /^count-critter-\d+$/.test(k));
    expect(critterKeys.length).toBeGreaterThan(0);

    // Tap all critters rapidly without re-rendering
    for (const key of critterKeys) {
      capturedPressables[key].onPress?.();
    }

    // The final tap completes the count round and calls sayThen to switch to quiz
    expect(sayThenSpy).toHaveBeenCalledOnce();
  });

  it('renders CountGame and displays initial game elements', () => {
    const html = renderToString(<CountGame onHome={noop} difficulty="easy" lang="en" />);
    expect(html).toContain('Count With Me');
    expect(html).toContain('0/5');
  });

  it('renders in medium and hard difficulties with respective target scores', () => {
    const htmlMed = renderToString(<CountGame onHome={noop} difficulty="medium" lang="en" />);
    expect(htmlMed).toContain('0/6');

    const htmlHard = renderToString(<CountGame onHome={noop} difficulty="hard" lang="en" />);
    expect(htmlHard).toContain('0/8');
  });

  it('renders count progress hint in count phase', () => {
    const html = renderToString(<CountGame onHome={noop} difficulty="easy" lang="en" />);
    expect(html).toContain('count-progress');
  });

  it('taps critters with sfx and speech and resets game via WinOverlay onNext', () => {
    const sfxTapSpy = vi.spyOn(sfx, 'tap').mockReturnValue();
    const sayThenSpy = vi.spyOn(sound, 'sayThen').mockImplementation((_texts, done) => {
      done?.();
    });
    const makeRoundSpy = vi.spyOn(countLogic, 'makeCountRound').mockReturnValue({
      icon: 'star',
      n: 1,
      positions: [{ x: 50, y: 50 }],
      choices: [1, 2, 3],
      answer: 1,
    });

    renderToString(<CountGame onHome={noop} difficulty="easy" lang="en" />);

    capturedPressables['count-critter-0']?.onPress?.();
    expect(sfxTapSpy).toHaveBeenCalledOnce();
    expect(sayThenSpy).toHaveBeenCalledWith(['one'], expect.any(Function));

    makeRoundSpy.mockClear();
    capturedWinOverlayProps?.onNext?.();
    expect(makeRoundSpy).toHaveBeenCalledWith(expect.any(Function), 'easy');
  });

  it('picks correct answer in quiz phase and advances round via sayThen callback', () => {
    const sfxGoodSpy = vi.spyOn(sfx, 'good').mockReturnValue();
    const makeRoundSpy = vi.spyOn(countLogic, 'makeCountRound').mockReturnValue({
      icon: 'star',
      n: 1,
      positions: [{ x: 50, y: 50 }],
      choices: [1, 2, 3],
      answer: 1,
    });
    vi.spyOn(countLogic, 'initCountState').mockReturnValue({
      score: 0,
      roundsToWin: 5,
      phase: 'quiz',
    });
    let sayThenDone: (() => void) | null = null;
    const sayThenSpy = vi.spyOn(sound, 'sayThen').mockImplementation((_texts, done) => {
      sayThenDone = done ?? null;
    });

    renderToString(<CountGame onHome={noop} difficulty="easy" lang="en" />);

    expect(capturedPressables['count-choice-1-answer']).toBeDefined();
    makeRoundSpy.mockClear();

    capturedPressables['count-choice-1-answer']?.onPress?.();
    expect(sfxGoodSpy).toHaveBeenCalledOnce();
    expect(sayThenSpy).toHaveBeenCalledWith(['one', 'Great counting!'], expect.any(Function));
    expect(makeRoundSpy).not.toHaveBeenCalled();

    expect(sayThenDone).not.toBeNull();
    sayThenDone!();
    expect(makeRoundSpy).toHaveBeenCalledWith(expect.any(Function), 'easy');
  });

  it('completes the winning round when score reaches roundsToWin without generating new round', () => {
    const sfxGoodSpy = vi.spyOn(sfx, 'good').mockReturnValue();
    const makeRoundSpy = vi.spyOn(countLogic, 'makeCountRound').mockReturnValue({
      icon: 'star',
      n: 1,
      positions: [{ x: 50, y: 50 }],
      choices: [1, 2, 3],
      answer: 1,
    });
    vi.spyOn(countLogic, 'initCountState').mockReturnValue({
      score: 4,
      roundsToWin: 5,
      phase: 'quiz',
    });
    let sayThenDone: (() => void) | null = null;
    vi.spyOn(sound, 'sayThen').mockImplementation((_texts, done) => {
      sayThenDone = done ?? null;
    });

    renderToString(<CountGame onHome={noop} difficulty="easy" lang="en" />);

    makeRoundSpy.mockClear();
    capturedPressables['count-choice-1-answer']?.onPress?.();
    expect(sfxGoodSpy).toHaveBeenCalledOnce();

    expect(sayThenDone).not.toBeNull();
    sayThenDone!();
    expect(makeRoundSpy).not.toHaveBeenCalled();
  });

  it('handles wrong pick in quiz phase with wrong sfx and prompt repeat', () => {
    vi.useFakeTimers();
    const sfxWrongSpy = vi.spyOn(sfx, 'wrong').mockReturnValue();
    const saySpy = vi.spyOn(sound, 'say').mockImplementation(() => {});
    vi.spyOn(countLogic, 'initCountState').mockReturnValue({
      score: 0,
      roundsToWin: 5,
      phase: 'quiz',
    });
    vi.spyOn(countLogic, 'makeCountRound').mockReturnValue({
      icon: 'star',
      n: 1,
      positions: [{ x: 50, y: 50 }],
      choices: [1, 2, 3],
      answer: 1,
    });

    renderToString(<CountGame onHome={noop} difficulty="easy" lang="en" />);

    expect(capturedPressables['count-choice-2']).toBeDefined();
    capturedPressables['count-choice-2']?.onPress?.();
    expect(sfxWrongSpy).toHaveBeenCalledOnce();

    vi.advanceTimersByTime(500);
    expect(saySpy).toHaveBeenCalledWith('How many?');
    vi.useRealTimers();
  });

  it('keeps choices visible under WinOverlay when game is won', () => {
    vi.spyOn(countLogic, 'initCountState').mockReturnValue({
      score: 5,
      roundsToWin: 5,
      phase: 'won',
    });
    vi.spyOn(countLogic, 'makeCountRound').mockReturnValue({
      icon: 'star',
      n: 1,
      positions: [{ x: 50, y: 50 }],
      choices: [1, 2, 3],
      answer: 1,
    });

    const html = renderToString(<CountGame onHome={noop} difficulty="easy" lang="en" />);

    expect(html).toContain('count-prompt');
    expect(html).toContain('count-choice-1-answer');
    expect(html).not.toContain('count-progress');
  });
});
