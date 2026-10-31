// @vitest-environment happy-dom
import React from "react";
import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";
import {
  render,
  screen,
  fireEvent,
  act,
  cleanup,
} from "@testing-library/react";
import { Animated } from "react-native";
import * as music from "../../../music";
import { sfx } from "../../../sound";
import { BellsGame } from "../BellsGame";
import * as bellsLogic from "../logic";

describe("BellsGame", () => {
  afterEach(() => {
    cleanup();
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
    vi.useFakeTimers();
    vi.spyOn(Math, "random").mockReturnValue(0);
    const roundsSpy = vi.spyOn(bellsLogic, "roundsToWin").mockReturnValue(1);
    const loopSpy = vi.spyOn(Animated, "loop");
    const stopSpy = vi.spyOn(Animated.Value.prototype, "stopAnimation");

    const { unmount } = render(
      <BellsGame onHome={() => {}} difficulty="easy" lang="en" />,
    );

    act(() => {
      vi.advanceTimersByTime(5000);
    });

    loopSpy.mockClear();
    stopSpy.mockClear();

    fireEvent.click(screen.getByTestId("bell-0"));
    fireEvent.click(screen.getByTestId("bell-1"));

    act(() => {
      vi.advanceTimersByTime(600);
    });

    expect(stopSpy).toHaveBeenCalled();
    expect(loopSpy).not.toHaveBeenCalled();

    loopSpy.mockRestore();
    stopSpy.mockRestore();
    roundsSpy.mockRestore();
    unmount();
    vi.useRealTimers();
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
    const bell1 = screen.getByTestId("bell-1");
    fireEvent.click(bell1);

    // Immediate tick: sfx.good fires, score counter increments immediately, but WinOverlay is deferred
    expect(goodSpy).toHaveBeenCalledTimes(1);
    expect(winSpy).not.toHaveBeenCalled();
    expect(screen.getByTestId("bells-score").textContent).toContain("1/1");
    expect(screen.queryByTestId("win-overlay")).toBeNull();

    // At 599ms: WinOverlay has not mounted yet, score chip reflects target
    act(() => {
      vi.advanceTimersByTime(599);
    });
    expect(winSpy).not.toHaveBeenCalled();
    expect(screen.getByTestId("bells-score").textContent).toContain("1/1");
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
    expect(screen.queryByTestId("replay-button")).toBeNull(); // it might not be null actually if tests changed
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

  it("stops active Animated.loop on phase transition and unmount", () => {
    vi.useFakeTimers();
    vi.spyOn(Math, "random").mockReturnValue(0);
    const stopSpies: ReturnType<typeof vi.fn>[] = [];
    vi.spyOn(Animated, "loop").mockImplementation(() => {
      const stop = vi.fn();
      stopSpies.push(stop);
      return {
        start: vi.fn(),
        stop,
        reset: vi.fn(),
      } as unknown as Animated.CompositeAnimation;
    });

    const { unmount } = render(
      <BellsGame onHome={() => {}} difficulty="easy" lang="en" />,
    );

    expect(stopSpies).toHaveLength(1);
    expect(stopSpies[0]).not.toHaveBeenCalled();

    // Advance demo to transition from "listen" to "play" phase
    act(() => {
      vi.advanceTimersByTime(5000);
    });

    expect(stopSpies[0]).toHaveBeenCalledTimes(1);
    expect(stopSpies).toHaveLength(2);
    expect(stopSpies[1]).not.toHaveBeenCalled();

    // Unmount stops active "play" loop
    unmount();
    expect(stopSpies[1]).toHaveBeenCalledTimes(1);

    vi.useRealTimers();
  });

  it("hides replay button during completion transition", () => {
    vi.useFakeTimers();
    vi.spyOn(Math, "random").mockReturnValue(0);
    vi.spyOn(music, "playNote").mockImplementation(() => {});

    const { unmount } = render(
      <BellsGame onHome={() => {}} difficulty="easy" lang="en" />,
    );

    // Initial listen phase: replay button hidden
    expect(screen.queryByTestId("replay-button")).toBeNull();

    // Advance through demo into play phase
    act(() => {
      vi.advanceTimersByTime(5000);
    });

    // In play phase before completion: replay button is visible
    expect(screen.getByTestId("replay-button")).toBeTruthy();

    // Tap first bell of sequence [0, 1]
    const bell0 = screen.getByTestId("bell-0");
    fireEvent.click(bell0);
    expect(screen.getByTestId("replay-button")).toBeTruthy();

    // Tap second and final bell in sequence: round completes
    const bell1 = screen.getByTestId("bell-1");
    fireEvent.click(bell1);

    // Immediately upon sequence completion, replay button is hidden
    expect(screen.queryByTestId("replay-button")).toBeNull();

    // During the 600ms completion delay, replay button remains hidden
    act(() => {
      vi.advanceTimersByTime(599);
    });
    expect(screen.queryByTestId("replay-button")).toBeNull();

    // After 600ms, new round starts in listen phase: still hidden
    act(() => {
      vi.advanceTimersByTime(1);
    });
    expect(screen.queryByTestId("replay-button")).toBeNull();

    // After demo completes, replay button returns for the new round
    act(() => {
      vi.advanceTimersByTime(5000);
    });
    expect(screen.getByTestId("replay-button")).toBeTruthy();

    unmount();
    vi.useRealTimers();
  });

  it("increments score chip immediately to final target during sequence completion on winning round", () => {
    vi.useFakeTimers();
    vi.spyOn(Math, "random").mockReturnValue(0);
    vi.spyOn(music, "playNote").mockImplementation(() => {});
    vi.spyOn(sfx, "good").mockImplementation(() => {});

    render(<BellsGame onHome={() => {}} difficulty="easy" lang="en" />);

    const midiToBellIndex: Record<number, number> = {
      60: 0,
      62: 1,
      64: 2,
      67: 3,
      69: 4,
    };

    // Play through rounds 1 to 4 (total is 5 for easy)
    for (let round = 0; round < 4; round++) {
      act(() => {
        vi.advanceTimersByTime(5000);
      });
      const playSeqCalls = vi.mocked(music.playSequence).mock.calls;
      const lastSeq = playSeqCalls[playSeqCalls.length - 1][0];
      const seq = lastSeq.map((n) => midiToBellIndex[n.m]);
      act(() => {
        for (const idx of seq) {
          fireEvent.click(screen.getByTestId(`bell-${idx}`));
        }
      });
      expect(screen.getByTestId("bells-score").textContent).toContain(
        `${round + 1}/5`,
      );
      act(() => {
        vi.advanceTimersByTime(600);
      });
    }

    // Now on round 5 (winning round): advance through demo to play phase
    act(() => {
      vi.advanceTimersByTime(5000);
    });
    expect(screen.getByTestId("bells-score").textContent).toContain("4/5");

    const playSeqCalls = vi.mocked(music.playSequence).mock.calls;
    const winningSeq = playSeqCalls[playSeqCalls.length - 1][0].map(
      (n) => midiToBellIndex[n.m],
    );

    // Tap the final sequence up to the last note
    for (let i = 0; i < winningSeq.length - 1; i++) {
      act(() => {
        fireEvent.click(screen.getByTestId(`bell-${winningSeq[i]}`));
      });
      expect(screen.getByTestId("bells-score").textContent).toContain("4/5");
    }

    // Tap final note of winning round
    act(() => {
      fireEvent.click(
        screen.getByTestId(`bell-${winningSeq[winningSeq.length - 1]}`),
      );
    });

    // Score chip immediately increments to 5/5 before WinOverlay mounts
    expect(screen.getByTestId("bells-score").textContent).toContain("5/5");
    expect(screen.queryByTestId("win-overlay")).toBeNull();

    // At 599ms into celebration, score chip is still 5/5 and WinOverlay has not mounted
    act(() => {
      vi.advanceTimersByTime(599);
    });
    expect(screen.getByTestId("bells-score").textContent).toContain("5/5");
    expect(screen.queryByTestId("win-overlay")).toBeNull();

    // At 600ms, WinOverlay mounts
    act(() => {
      vi.advanceTimersByTime(1);
    });
    expect(screen.getByTestId("win-overlay")).toBeTruthy();

    vi.useRealTimers();
  });
});
