// @vitest-environment happy-dom
import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { Animated } from 'react-native';
import { BellsGame } from '../BellsGame';
import * as bellsLogic from '../logic';
import * as music from '../../../music';
import * as sound from '../../../sound';
import { sfx } from '../../../sound';

describe('BellsGame', () => {
  beforeEach(() => {
    vi.spyOn(sound, 'sayThen').mockImplementation((_texts, done) => {
      done();
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('halts animations when won', () => {
    let rounds = 5;
    const roundsSpy = vi
      .spyOn(bellsLogic, "roundsToWin")
      .mockImplementation(() => rounds);
    const loopSpy = vi.spyOn(Animated, "loop");
    const stopSpy = vi.spyOn(Animated.Value.prototype, "stopAnimation");

    const { rerender, unmount } = render(
      <BellsGame onHome={() => {}} difficulty="hard" lang="en" />,
    );

    loopSpy.mockClear();

    rounds = 0;
    rerender(<BellsGame onHome={() => {}} difficulty="hard" lang="en" />);

    expect(stopSpy).toHaveBeenCalled();
    expect(loopSpy).not.toHaveBeenCalled();

    loopSpy.mockRestore();
    stopSpy.mockRestore();
    roundsSpy.mockRestore();
    unmount();
  });

  it("delays WinOverlay mount on final winning round by 600ms", () => {
    vi.useFakeTimers();
    vi.spyOn(Math, "random").mockReturnValue(0);
    vi.spyOn(bellsLogic, "roundsToWin").mockReturnValue(1);
    const goodSpy = vi.spyOn(sfx, "good");
    const winSpy = vi.spyOn(sfx, "win");

    render(<BellsGame onHome={() => {}} difficulty="easy" lang="en" />);

    act(() => {
      vi.advanceTimersByTime(5000);
    });

    const bell0 = screen.getByTestId("bell-0");

    // Tap first bell
    fireEvent.click(bell0);
    expect(goodSpy).not.toHaveBeenCalled();
    expect(winSpy).not.toHaveBeenCalled();
    expect(screen.queryByTestId("win-overlay")).toBeNull();

    // Tap second and final bell
    fireEvent.click(bell0);

    // Immediate tick: sfx.good fires, but WinOverlay is deferred
    expect(goodSpy).toHaveBeenCalledTimes(1);
    expect(winSpy).not.toHaveBeenCalled();
    expect(screen.queryByTestId("win-overlay")).toBeNull();

    // At 599ms: WinOverlay has not mounted yet
    act(() => {
      vi.advanceTimersByTime(599);
    });
    expect(winSpy).not.toHaveBeenCalled();
    expect(screen.queryByTestId("win-overlay")).toBeNull();

    // At 600ms: WinOverlay mounts and sfx.win fires
    act(() => {
      vi.advanceTimersByTime(1);
    });
    expect(winSpy).toHaveBeenCalledTimes(1);
    expect(screen.getByTestId("win-overlay")).toBeTruthy();

    vi.useRealTimers();
  });

  it('speaks instructions on game start', () => {
    const sayThenSpy = vi.spyOn(sound, 'sayThen').mockImplementation((_texts, done) => done && done());
    const { unmount } = render(<BellsGame onHome={() => {}} difficulty="easy" lang="en" />);
    expect(sayThenSpy).toHaveBeenCalledWith(['Listen, then play the tune back!'], expect.any(Function));
    sayThenSpy.mockRestore();
    unmount();
  });

  it('speaks instructions in selected language on start', () => {
    const sayThenSpy = vi.spyOn(sound, 'sayThen').mockImplementation((_texts, done) => done && done());
    const { unmount } = render(<BellsGame onHome={() => {}} difficulty="easy" lang="ja" />);
    expect(sayThenSpy).toHaveBeenCalledWith(['きいて、おなじように ならそう！'], expect.any(Function));
    sayThenSpy.mockRestore();
    unmount();
  });

  it('delays melody demo until spoken instruction completes', () => {
    vi.useFakeTimers();
    let demoDone: (() => void) | null = null;
    const sayThenSpy = vi.spyOn(sound, 'sayThen').mockImplementation((_texts, done) => {
      demoDone = done;
    });
    const playNoteSpy = vi.spyOn(music, 'playNote').mockImplementation(() => {});

    const { unmount } = render(<BellsGame onHome={() => {}} difficulty="easy" lang="en" />);
    expect(sayThenSpy).toHaveBeenCalledTimes(1);
    expect(playNoteSpy).not.toHaveBeenCalled();

    act(() => {
      demoDone?.();
    });

    act(() => {
      vi.advanceTimersByTime(5000);
    });
    expect(playNoteSpy).toHaveBeenCalled();

    sayThenSpy.mockRestore();
    playNoteSpy.mockRestore();
    vi.useRealTimers();
    unmount();
  });
});
