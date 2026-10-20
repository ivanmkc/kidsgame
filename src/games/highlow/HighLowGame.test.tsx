// @vitest-environment happy-dom
import React from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from "@testing-library/react";
import * as music from "../../music";
import { HighLowGame } from "./HighLowGame";

describe("HighLowGame UI", () => {
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it("renders two melody dots during listen phase", () => {
    render(<HighLowGame onHome={() => {}} difficulty="easy" lang="en" />);
    expect(screen.getByTestId("melody-dot-0")).toBeDefined();
    expect(screen.getByTestId("melody-dot-1")).toBeDefined();
  });

  it("fills dots sequentially as notes play and transitions to pick phase", () => {
    vi.useFakeTimers();
    let onNoteCb: ((index: number) => void) | undefined;
    let onDoneCb: (() => void) | undefined;

    vi.spyOn(music, "playSequence").mockImplementation(
      (_notes, _bpm, onNote, onDone) => {
        onNoteCb = onNote;
        onDoneCb = onDone;
        return () => {};
      },
    );

    render(<HighLowGame onHome={() => {}} difficulty="easy" lang="en" />);

    // Advance past initial 400ms delay to start playback
    act(() => {
      vi.advanceTimersByTime(400);
    });

    const dot0 = screen.getByTestId("melody-dot-0");
    const dot1 = screen.getByTestId("melody-dot-1");

    // Before note callback: neither dot is filled
    const emptyClass = dot0.className;
    expect(dot1.className).toBe(emptyClass);

    // Note 0 begins playing: dot 0 fills, dot 1 remains empty
    act(() => {
      onNoteCb?.(0);
    });
    const dot0AfterNote0 = screen.getByTestId("melody-dot-0");
    const dot1AfterNote0 = screen.getByTestId("melody-dot-1");
    const filledClass = dot0AfterNote0.className;
    expect(filledClass).not.toBe(emptyClass);
    expect(dot1AfterNote0.className).toBe(emptyClass);

    // Note 1 begins playing: both dots are filled
    act(() => {
      onNoteCb?.(1);
    });
    const dot0AfterNote1 = screen.getByTestId("melody-dot-0");
    const dot1AfterNote1 = screen.getByTestId("melody-dot-1");
    expect(dot0AfterNote1.className).toBe(filledClass);
    expect(dot1AfterNote1.className).toBe(filledClass);

    // Sequence finishes: transitions to pick phase
    act(() => {
      onDoneCb?.();
    });

    expect(screen.queryByTestId("melody-dot-0")).toBeNull();
    expect(screen.queryByTestId("melody-dot-1")).toBeNull();
    expect(screen.getByTestId("highlow-high")).toBeDefined();
    expect(screen.getByTestId("highlow-low")).toBeDefined();

    // Replay returns to listen phase and resets melody dots to empty
    fireEvent.click(screen.getByTestId("highlow-replay"));
    const replayedDot0 = screen.getByTestId("melody-dot-0");
    const replayedDot1 = screen.getByTestId("melody-dot-1");
    expect(replayedDot0.className).toBe(emptyClass);
    expect(replayedDot1.className).toBe(emptyClass);

    vi.useRealTimers();
  });

  it("handles player picks and score updates", () => {
    vi.useFakeTimers();
    let onDoneCb: (() => void) | undefined;
    vi.spyOn(music, "playSequence").mockImplementation(
      (_notes, _bpm, _onNote, onDone) => {
        onDoneCb = onDone;
        return () => {};
      },
    );

    render(<HighLowGame onHome={() => {}} difficulty="easy" lang="en" />);

    act(() => {
      vi.advanceTimersByTime(400);
      onDoneCb?.();
    });

    const highBtn = screen.getByTestId("highlow-high");
    const lowBtn = screen.getByTestId("highlow-low");
    expect(highBtn).toBeDefined();
    expect(lowBtn).toBeDefined();

    fireEvent.click(highBtn);

    act(() => {
      vi.advanceTimersByTime(500);
    });

    vi.useRealTimers();
  });

  it("delays transition to listen phase by 1000ms after a correct pick, keeping buttons mounted and locking input", () => {
    vi.useFakeTimers();
    let capturedNotes: { m: number; b: number }[] = [];
    let onDoneCb: (() => void) | undefined;

    const playSpy = vi
      .spyOn(music, "playSequence")
      .mockImplementation((notes, _bpm, _onNote, onDone) => {
        capturedNotes = notes as { m: number; b: number }[];
        onDoneCb = onDone;
        return () => {};
      });

    render(<HighLowGame onHome={() => {}} difficulty="easy" lang="en" />);

    // Advance initial 400ms delay to start playback
    act(() => {
      vi.advanceTimersByTime(400);
      onDoneCb?.();
    });

    expect(playSpy).toHaveBeenCalledTimes(1);

    const isHigh = capturedNotes[1].m > capturedNotes[0].m;
    const correctBtn = screen.getByTestId(
      isHigh ? "highlow-high" : "highlow-low",
    );
    const wrongBtn = screen.getByTestId(
      isHigh ? "highlow-low" : "highlow-high",
    );

    // Tap correct answer
    fireEvent.click(correctBtn);

    // Pick buttons remain mounted immediately and score updates
    expect(screen.queryByTestId("highlow-high")).not.toBeNull();
    expect(screen.queryByTestId("highlow-low")).not.toBeNull();
    expect(screen.queryByTestId("melody-dot-0")).toBeNull();
    expect(screen.getByTestId("highlow-score").textContent).toContain("1/");

    // Halfway through celebration delay (500ms): buttons still mounted
    act(() => {
      vi.advanceTimersByTime(500);
    });
    expect(screen.queryByTestId("highlow-high")).not.toBeNull();
    expect(screen.queryByTestId("highlow-low")).not.toBeNull();
    expect(screen.queryByTestId("melody-dot-0")).toBeNull();

    // Tapping during celebration delay is locked / ignored
    fireEvent.click(wrongBtn);
    fireEvent.click(screen.getByTestId("highlow-replay"));
    expect(screen.getByTestId("highlow-score").textContent).toContain("1/");

    // At 1000ms: celebration ends and transitions back to listen phase
    act(() => {
      vi.advanceTimersByTime(500);
    });
    expect(screen.queryByTestId("highlow-high")).toBeNull();
    expect(screen.queryByTestId("highlow-low")).toBeNull();
    expect(screen.getByTestId("melody-dot-0")).not.toBeNull();

    // Next round audio plays after 400ms delay
    act(() => {
      vi.advanceTimersByTime(400);
    });
    expect(playSpy).toHaveBeenCalledTimes(2);

    vi.useRealTimers();
  });

  it("does not show celebration sparkles before a pick or on wrong buttons across rounds", () => {
    vi.useFakeTimers();
    let onDoneCb: (() => void) | undefined;
    let latestNotes: { m: number; b: number }[] = [];
    vi.spyOn(music, "playSequence").mockImplementation(
      (notes, _bpm, _onNote, onDone) => {
        latestNotes = notes;
        onDoneCb = onDone;
        return () => {};
      },
    );

    render(<HighLowGame onHome={() => {}} difficulty="easy" lang="en" />);

    // Advance through the initial listen phase so pick buttons appear
    act(() => {
      vi.advanceTimersByTime(400);
      onDoneCb?.();
    });

    const highBtn = screen.getByTestId("highlow-high");
    const lowBtn = screen.getByTestId("highlow-low");

    // Before any user tap, neither button should contain celebration sparkles
    expect(within(highBtn).queryAllByText(/✨|⭐/)).toHaveLength(0);
    expect(within(lowBtn).queryAllByText(/✨|⭐/)).toHaveLength(0);

    const isHigh = latestNotes[1].m > latestNotes[0].m;
    const correctBtn = isHigh ? highBtn : lowBtn;
    const wrongBtn = isHigh ? lowBtn : highBtn;

    // Tap the wrong button first: still no celebration sparkles
    fireEvent.click(wrongBtn);
    expect(within(highBtn).queryAllByText(/✨|⭐/)).toHaveLength(0);
    expect(within(lowBtn).queryAllByText(/✨|⭐/)).toHaveLength(0);

    // Tap the correct button: only the correct button shows celebration sparkles
    fireEvent.click(correctBtn);
    expect(within(correctBtn).queryAllByText(/✨|⭐/).length).toBeGreaterThan(
      0,
    );
    expect(within(wrongBtn).queryAllByText(/✨|⭐/)).toHaveLength(0);

    // Advance through celebration (1000ms) and next round listen phase (400ms)
    act(() => {
      vi.advanceTimersByTime(1000);
    });
    act(() => {
      vi.advanceTimersByTime(400);
      onDoneCb?.();
    });

    // In round 2 before any tap, neither button should show celebration sparkles
    const round2HighBtn = screen.getByTestId("highlow-high");
    const round2LowBtn = screen.getByTestId("highlow-low");
    expect(within(round2HighBtn).queryAllByText(/✨|⭐/)).toHaveLength(0);
    expect(within(round2LowBtn).queryAllByText(/✨|⭐/)).toHaveLength(0);

    vi.useRealTimers();
  });

  it("delays WinOverlay mount on final winning round by 1000ms celebration", () => {
    vi.useFakeTimers();
    let capturedNotes: { m: number; b: number }[] = [];
    let onDoneCb: (() => void) | undefined;

    vi.spyOn(music, "playSequence").mockImplementation(
      (notes, _bpm, _onNote, onDone) => {
        capturedNotes = notes as { m: number; b: number }[];
        onDoneCb = onDone;
        return () => {};
      },
    );

    render(<HighLowGame onHome={() => {}} difficulty="easy" lang="en" />);

    // Play 7 rounds (easy requires 8 rounds)
    for (let roundIdx = 0; roundIdx < 7; roundIdx++) {
      act(() => {
        vi.advanceTimersByTime(400);
        onDoneCb?.();
      });
      const isHigh = capturedNotes[1].m > capturedNotes[0].m;
      fireEvent.click(
        screen.getByTestId(isHigh ? "highlow-high" : "highlow-low"),
      );
      act(() => {
        vi.advanceTimersByTime(1000);
      });
    }

    // Round 8: listen finishes and buttons are ready
    act(() => {
      vi.advanceTimersByTime(400);
      onDoneCb?.();
    });

    const isHigh = capturedNotes[1].m > capturedNotes[0].m;
    const winningBtn = screen.getByTestId(
      isHigh ? "highlow-high" : "highlow-low",
    );

    expect(screen.queryByTestId("win-overlay")).toBeNull();

    // Tap winning answer
    fireEvent.click(winningBtn);

    // Immediate tick: celebration is active, pick buttons mounted, WinOverlay deferred
    expect(screen.queryByTestId("highlow-high")).not.toBeNull();
    expect(screen.queryByTestId("highlow-low")).not.toBeNull();
    expect(screen.queryByTestId("win-overlay")).toBeNull();

    // At 500ms: still celebrating, no WinOverlay
    act(() => {
      vi.advanceTimersByTime(500);
    });
    expect(screen.queryByTestId("win-overlay")).toBeNull();

    // At 1000ms: WinOverlay mounts
    act(() => {
      vi.advanceTimersByTime(500);
    });
    expect(screen.getByTestId("win-overlay")).toBeDefined();

    vi.useRealTimers();
  });
});
