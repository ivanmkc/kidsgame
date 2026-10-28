// @vitest-environment happy-dom
import React from "react";
import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";
import { render, screen, fireEvent, act } from "@testing-library/react";
import { Animated } from "react-native";
import * as music from "../../../music";
import { sfx } from "../../../sound";
import { BellsGame } from "../BellsGame";
import * as bellsLogic from "../logic";

describe("BellsGame", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  beforeEach(() => {
    let mockCancel: (() => void) | null = null;
    vi.spyOn(music, "playSequence").mockImplementation(
      (notes, bpm, onNote, onDone) => {
        let time = 0;
        const timers: ReturnType<typeof setTimeout>[] = [];
        for (let i = 0; i < notes.length; i++) {
          timers.push(setTimeout(() => onNote?.(i), time));
          time += ((notes[i].b * 60) / bpm) * 1000;
        }
        timers.push(setTimeout(() => onDone?.(), time));
        mockCancel = () => {
          timers.forEach(clearTimeout);
        };
        return mockCancel;
      },
    );
    vi.spyOn(music, "stopSequence").mockImplementation(() => {
      if (mockCancel) {
        mockCancel();
        mockCancel = null;
      }
    });
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

  it("reserves persistent layout space for status row and tap-dot slot across listen and play phases", () => {
    vi.useFakeTimers();
    vi.spyOn(Math, "random").mockReturnValue(0);
    vi.spyOn(music, "playNote").mockImplementation(() => {});

    const { unmount } = render(
      <BellsGame onHome={() => {}} difficulty="easy" lang="en" />,
    );

    // In listen phase:
    expect(screen.getByText("Listen...")).toBeTruthy();
    expect(screen.queryByTestId("replay-button")).toBeNull();
    expect(screen.queryByTestId("tap-dot-row")).toBeNull();

    const statusRowListen = screen.getByTestId("bells-status-row");
    const tapDotSlotListen = screen.getByTestId("tap-dot-slot");
    expect(window.getComputedStyle(statusRowListen).minHeight).toBe("72px");
    expect(window.getComputedStyle(tapDotSlotListen).height).toBe("28px");

    // Advance to play phase
    act(() => {
      vi.advanceTimersByTime(5000);
    });

    expect(screen.getByText("Your turn!")).toBeTruthy();
    expect(screen.getByTestId("replay-button")).toBeTruthy();
    expect(screen.getByTestId("tap-dot-row")).toBeTruthy();

    const statusRowPlay = screen.getByTestId("bells-status-row");
    const tapDotSlotPlay = screen.getByTestId("tap-dot-slot");
    expect(window.getComputedStyle(statusRowPlay).minHeight).toBe("72px");
    expect(window.getComputedStyle(tapDotSlotPlay).height).toBe("28px");

    // tap-dot-row is contained within tap-dot-slot so total layout space remains constant
    expect(tapDotSlotPlay.contains(screen.getByTestId("tap-dot-row"))).toBe(
      true,
    );

    vi.useRealTimers();
    unmount();
  });
});
