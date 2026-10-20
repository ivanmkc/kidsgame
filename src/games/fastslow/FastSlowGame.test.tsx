// @vitest-environment happy-dom
import React from "react";
import {
  render,
  fireEvent,
  act,
  screen,
  cleanup,
  within,
} from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { FastSlowGame } from "./FastSlowGame";
import { playSequence } from "../../music";
import { sfx } from "../../sound";

vi.mock("../../sound", () => ({
  sfx: { good: vi.fn(), wrong: vi.fn(), win: vi.fn(), tap: vi.fn() },
  say: vi.fn(),
  saySequence: vi.fn(),
}));

vi.mock("../../music", () => ({
  playSequence: vi.fn((notes, bpm, cb, onEnd) => {
    if (onEnd) onEnd();
  }),
  stopSequence: vi.fn(),
}));

describe("FastSlowGame UI interaction", () => {
  afterEach(() => {
    act(() => { cleanup(); });
    vi.clearAllMocks();
    vi.restoreAllMocks();
  });
  it("tracks history and prevents streaks of 3 identical speeds", () => {
    vi.useFakeTimers();
    const randomSpy = vi.spyOn(Math, "random").mockReturnValue(0.12345);
    render(<FastSlowGame onHome={() => {}} difficulty="hard" lang="en" />);

    act(() => {
      vi.advanceTimersByTime(450);
    });

    const playedSpeeds: ("fast" | "slow")[] = [];

    // Play 12 rounds (hard difficulty win condition) to check for streaks
    for (let i = 0; i < 12; i++) {
      const calls = vi.mocked(playSequence).mock.calls;
      const bpm = calls[calls.length - 1][1] as number;
      const speed = bpm >= 140 ? "fast" : "slow";
      playedSpeeds.push(speed);

      const fastBtn = screen.getByTestId("fastslow-fast");
      const slowBtn = screen.getByTestId("fastslow-slow");
      const btn = speed === "fast" ? fastBtn : slowBtn;
      fireEvent.click(btn);

      // wait for celebrate and next round
      act(() => {
        vi.advanceTimersByTime(1100);
      });
      act(() => {
        vi.advanceTimersByTime(450);
      });
    }

    // Assert that there are no streaks of 3
    for (let i = 2; i < playedSpeeds.length; i++) {
      const streak =
        playedSpeeds[i] === playedSpeeds[i - 1] &&
        playedSpeeds[i] === playedSpeeds[i - 2];
      expect(streak).toBe(false);
    }

    randomSpy.mockRestore();
    vi.useRealTimers();
  });
  it("prevents fast-tap hammering from queueing multiple round transitions", () => {
    vi.useFakeTimers();
    render(<FastSlowGame onHome={() => {}} difficulty="easy" lang="en" />);

    act(() => {
      vi.advanceTimersByTime(450);
    });

    const calls = vi.mocked(playSequence).mock.calls;
    const bpm = calls[calls.length - 1][1] as number;
    const speed = bpm >= 140 ? "fast" : "slow";
    const correctBtn = screen.getByTestId(
      speed === "fast" ? "fastslow-fast" : "fastslow-slow",
    );

    const playSeqCallsBefore = vi.mocked(playSequence).mock.calls.length;
    vi.mocked(sfx.good).mockClear();

    // Rapidly tap the correct button multiple times in the same tick
    act(() => {
      fireEvent.click(correctBtn);
      fireEvent.click(correctBtn);
      fireEvent.click(correctBtn);
    });

    expect(sfx.good).toHaveBeenCalledTimes(1);

    // Advance through the celebration delay and the next round start delay
    act(() => {
      vi.advanceTimersByTime(1000);
    });
    act(() => {
      vi.advanceTimersByTime(450);
    });

    // Only one round transition should occur
    expect(vi.mocked(playSequence).mock.calls.length).toBe(
      playSeqCallsBefore + 1,
    );
    expect(screen.getByTestId("fastslow-score").textContent).toBe("🎵 1/8");

    // Extra time: ensure no trailing timeouts fire to skip rounds
    act(() => {
      vi.advanceTimersByTime(2000);
    });
    expect(vi.mocked(playSequence).mock.calls.length).toBe(
      playSeqCallsBefore + 1,
    );

    vi.useRealTimers();
  });

  it("unlocks picks after resetting the game on win", () => {
    vi.useFakeTimers();
    render(<FastSlowGame onHome={() => {}} difficulty="easy" lang="en" />);

    // Easy difficulty requires 8 rounds
    for (let i = 0; i < 8; i++) {
      act(() => {
        vi.advanceTimersByTime(450);
      });
      const calls = vi.mocked(playSequence).mock.calls;
      const bpm = calls[calls.length - 1][1] as number;
      const speed = bpm >= 140 ? "fast" : "slow";
      const btn = screen.getByTestId(
        speed === "fast" ? "fastslow-fast" : "fastslow-slow",
      );
      fireEvent.click(btn);
      act(() => {
        vi.advanceTimersByTime(1100);
      });
    }

    expect(screen.getByTestId("fastslow-score").textContent).toBe("🎵 8/8");

    // WinOverlay arms after 600ms
    act(() => {
      vi.advanceTimersByTime(650);
    });

    // Click play again
    const playAgainBtn = screen.getByTestId("play-again");
    fireEvent.click(playAgainBtn);

    // Initial listen phase of new game
    act(() => {
      vi.advanceTimersByTime(450);
    });

    expect(screen.getByTestId("fastslow-score").textContent).toBe("🎵 0/8");

    // Can pick in the new game
    const calls = vi.mocked(playSequence).mock.calls;
    const bpm = calls[calls.length - 1][1] as number;
    const speed = bpm >= 140 ? "fast" : "slow";
    const btn = screen.getByTestId(
      speed === "fast" ? "fastslow-fast" : "fastslow-slow",
    );
    fireEvent.click(btn);

    expect(screen.getByTestId("fastslow-score").textContent).toBe("🎵 1/8");

    vi.useRealTimers();
  });

  it("does not show celebration sparkles before a pick or on wrong buttons across rounds", () => {
    vi.useFakeTimers();
    render(<FastSlowGame onHome={() => {}} difficulty="easy" lang="en" />);

    // Advance through the initial listen phase so pick buttons appear
    act(() => {
      vi.advanceTimersByTime(450);
    });

    const fastBtn = screen.getByTestId("fastslow-fast");
    const slowBtn = screen.getByTestId("fastslow-slow");

    // Before any user tap, neither button should contain celebration sparkles
    expect(within(fastBtn).queryAllByText(/✨|⭐/)).toHaveLength(0);
    expect(within(slowBtn).queryAllByText(/✨|⭐/)).toHaveLength(0);

    const calls = vi.mocked(playSequence).mock.calls;
    const bpm = calls[calls.length - 1][1] as number;
    const speed = bpm >= 140 ? "fast" : "slow";
    const correctBtn = speed === "fast" ? fastBtn : slowBtn;
    const wrongBtn = speed === "fast" ? slowBtn : fastBtn;

    // Tap the wrong button first: still no celebration sparkles
    fireEvent.click(wrongBtn);
    expect(within(fastBtn).queryAllByText(/✨|⭐/)).toHaveLength(0);
    expect(within(slowBtn).queryAllByText(/✨|⭐/)).toHaveLength(0);

    // Tap the correct button: only the correct button shows celebration sparkles
    fireEvent.click(correctBtn);
    expect(within(correctBtn).queryAllByText(/✨|⭐/).length).toBeGreaterThan(
      0,
    );
    expect(within(wrongBtn).queryAllByText(/✨|⭐/)).toHaveLength(0);

    // Advance through celebration (1000ms) and next round listen phase (450ms)
    act(() => {
      vi.advanceTimersByTime(1000);
    });
    act(() => {
      vi.advanceTimersByTime(450);
    });

    // In round 2 before any tap, neither button should show celebration sparkles
    const round2FastBtn = screen.getByTestId("fastslow-fast");
    const round2SlowBtn = screen.getByTestId("fastslow-slow");
    expect(within(round2FastBtn).queryAllByText(/✨|⭐/)).toHaveLength(0);
    expect(within(round2SlowBtn).queryAllByText(/✨|⭐/)).toHaveLength(0);

    vi.useRealTimers();
  });

  it("delays WinOverlay mount on final winning round by 1000ms celebration", () => {
    vi.useFakeTimers();
    render(<FastSlowGame onHome={() => {}} difficulty="easy" lang="en" />);

    // Play 7 rounds to reach the final round (easy requires 8 rounds)
    for (let i = 0; i < 7; i++) {
      act(() => {
        vi.advanceTimersByTime(450);
      });
      const calls = vi.mocked(playSequence).mock.calls;
      const bpm = calls[calls.length - 1][1] as number;
      const speed = bpm >= 140 ? "fast" : "slow";
      const btn = screen.getByTestId(
        speed === "fast" ? "fastslow-fast" : "fastslow-slow",
      );
      fireEvent.click(btn);
      act(() => {
        vi.advanceTimersByTime(1100);
      });
    }

    // Round 8: listen phase finishes, buttons ready
    act(() => {
      vi.advanceTimersByTime(450);
    });
    const calls = vi.mocked(playSequence).mock.calls;
    const bpm = calls[calls.length - 1][1] as number;
    const speed = bpm >= 140 ? "fast" : "slow";
    const winningBtn = screen.getByTestId(
      speed === "fast" ? "fastslow-fast" : "fastslow-slow",
    );

    vi.mocked(sfx.good).mockClear();
    vi.mocked(sfx.win).mockClear();

    // Tap winning answer
    fireEvent.click(winningBtn);

    // Immediate tick: sfx.good fires, celebration is active, but WinOverlay is deferred
    expect(sfx.good).toHaveBeenCalledTimes(1);
    expect(sfx.win).not.toHaveBeenCalled();
    expect(screen.queryByTestId("win-overlay")).toBeNull();

    // At 999ms: WinOverlay is still not mounted
    act(() => {
      vi.advanceTimersByTime(999);
    });
    expect(sfx.win).not.toHaveBeenCalled();
    expect(screen.queryByTestId("win-overlay")).toBeNull();

    // At 1000ms: WinOverlay mounts and sfx.win fires
    act(() => {
      vi.advanceTimersByTime(1);
    });
    expect(sfx.win).toHaveBeenCalledTimes(1);
    expect(screen.getByTestId("win-overlay")).toBeTruthy();

    vi.useRealTimers();
  });

  it('fills dots sequentially as notes play and resets them on new round', () => {
    vi.useFakeTimers();
    let onNoteCb: ((index: number) => void) | undefined;
    let onDoneCb: (() => void) | undefined;

    vi.mocked(playSequence).mockImplementation((_notes, _bpm, onNote, onDone) => {
      onNoteCb = onNote;
      onDoneCb = onDone;
      return () => {};
    });

    render(<FastSlowGame onHome={() => {}} difficulty="hard" lang="en" />);

    // Advance past initial 400ms delay to start playback
    act(() => {
      vi.advanceTimersByTime(400);
    });

    const calls = vi.mocked(playSequence).mock.calls;
    const notesCount = calls[calls.length - 1][0].length;

    // dots should be rendered dynamically
    const dots = screen.getAllByTestId(/melody-dot-/);
    expect(dots.length).toBe(notesCount);

    const emptyBg = 'rgba(0, 0, 0, 0.00)';
    const filledBg = 'rgba(255, 194, 75, 1.00)';

    // Before note callback: all dots are empty
    for (let i = 0; i < notesCount; i++) {
      expect(window.getComputedStyle(dots[i]).backgroundColor).toBe(emptyBg);
    }

    // Note 0 begins playing: dot 0 fills
    act(() => {
      onNoteCb?.(0);
    });
    
    expect(window.getComputedStyle(screen.getByTestId('melody-dot-0')).backgroundColor).toBe(filledBg);
    expect(window.getComputedStyle(screen.getByTestId('melody-dot-1')).backgroundColor).toBe(emptyBg);

    // Last note begins playing: all dots are filled
    act(() => {
      onNoteCb?.(notesCount - 1);
    });
    for (let i = 0; i < notesCount; i++) {
      expect(window.getComputedStyle(screen.getByTestId(`melody-dot-${i}`)).backgroundColor).toBe(filledBg);
    }

    // Sequence finishes: transitions to pick phase
    act(() => {
      onDoneCb?.();
    });

    expect(screen.queryByTestId('melody-dot-0')).toBeNull();

    // Replay returns to listen phase and resets melody dots to empty
    fireEvent.click(screen.getByTestId('fastslow-replay'));
    const replayDots = screen.getAllByTestId(/melody-dot-/);
    expect(replayDots.length).toBe(notesCount);
    for (let i = 0; i < notesCount; i++) {
      expect(window.getComputedStyle(screen.getByTestId(`melody-dot-${i}`)).backgroundColor).toBe(emptyBg);
    }

    // Finish sequence again to return to pick phase
    act(() => {
      onNoteCb?.(notesCount - 1); // simulate filling dots again
      onDoneCb?.();
    });

    // Pick the correct answer to transition to a new round
    const lastCalls = vi.mocked(playSequence).mock.calls;
    const bpm = lastCalls[lastCalls.length - 1][1] as number;
    const speed = bpm >= 140 ? 'fast' : 'slow';
    const btn = speed === 'fast' ? screen.getByTestId('fastslow-fast') : screen.getByTestId('fastslow-slow');
    fireEvent.click(btn);

    // Advance through the 1000ms celebration
    act(() => {
      vi.advanceTimersByTime(1000);
    });

    // We are now in the 'listen' phase of the new round, before the 400ms delay finishes.
    // The dots should be visible and immediately empty, not filled from the previous round.
    const nextRoundDots = screen.getAllByTestId(/melody-dot-/);
    for (let i = 0; i < nextRoundDots.length; i++) {
      expect(window.getComputedStyle(nextRoundDots[i]).backgroundColor).toBe(emptyBg);
    }

    vi.useRealTimers();
  });
});
