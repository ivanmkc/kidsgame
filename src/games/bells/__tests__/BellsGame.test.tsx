// @vitest-environment happy-dom
import React from "react";
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, fireEvent, act } from "@testing-library/react";
import { Animated } from "react-native";
import { sfx } from "../../../sound";
import { BellsGame } from "../BellsGame";
import * as bellsLogic from "../logic";

describe("BellsGame", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("halts animations when won", () => {
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
});
