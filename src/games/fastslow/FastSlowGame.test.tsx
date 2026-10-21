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

afterEach(() => {
  cleanup();
});

describe("FastSlowGame UI interaction", () => {
  it("tracks history and prevents streaks of 3 identical speeds", () => {
    vi.useFakeTimers();
    const randomSpy = vi.spyOn(Math, "random").mockReturnValue(0.12345);
    render(<FastSlowGame onHome={() => {}} difficulty="hard" lang="en" />);

    act(() => {
      vi.advanceTimersByTime(1050);
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
        vi.advanceTimersByTime(1050);
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
      vi.advanceTimersByTime(1050);
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
      vi.advanceTimersByTime(1050);
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
        vi.advanceTimersByTime(1050);
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
      vi.advanceTimersByTime(1050);
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
      vi.advanceTimersByTime(1050);
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

    // Advance through celebration (1000ms) and next round listen phase (1050ms)
    act(() => {
      vi.advanceTimersByTime(1000);
    });
    act(() => {
      vi.advanceTimersByTime(1050);
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
        vi.advanceTimersByTime(1050);
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
      vi.advanceTimersByTime(1050);
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

  it("clears celebration transition timer when unmounted during celebration", () => {
    vi.useFakeTimers();

    const { unmount } = render(
      <FastSlowGame onHome={() => {}} difficulty="easy" lang="en" />,
    );

    act(() => {
      vi.advanceTimersByTime(1050);
    });

    const calls = vi.mocked(playSequence).mock.calls;
    const bpm = calls[calls.length - 1][1] as number;
    const speed = bpm >= 140 ? "fast" : "slow";
    const correctBtn = screen.getByTestId(
      speed === "fast" ? "fastslow-fast" : "fastslow-slow",
    );

    fireEvent.click(correctBtn);

    expect(vi.getTimerCount()).toBe(1);

    unmount();

    expect(vi.getTimerCount()).toBe(0);

    vi.useRealTimers();
  });

  it("clears celebration transition timer when unmounted during final round celebration", () => {
    vi.useFakeTimers();

    const { unmount } = render(
      <FastSlowGame onHome={() => {}} difficulty="easy" lang="en" />,
    );

    // Play 7 rounds to reach the final round (easy requires 8 rounds)
    for (let i = 0; i < 7; i++) {
      act(() => {
        vi.advanceTimersByTime(1050);
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
      vi.advanceTimersByTime(1050);
    });
    const calls = vi.mocked(playSequence).mock.calls;
    const bpm = calls[calls.length - 1][1] as number;
    const speed = bpm >= 140 ? "fast" : "slow";
    const winningBtn = screen.getByTestId(
      speed === "fast" ? "fastslow-fast" : "fastslow-slow",
    );

    fireEvent.click(winningBtn);

    expect(vi.getTimerCount()).toBe(1);

    unmount();

    expect(vi.getTimerCount()).toBe(0);

    vi.useRealTimers();
  });
});

describe("FastSlowGame accessibility", () => {
  it('renders fast, slow, and replay buttons with accessibilityRole="button" and localized labels in English', () => {
    vi.useFakeTimers();
    render(<FastSlowGame onHome={() => {}} difficulty="easy" lang="en" />);

    // Fast-forward through the initial 1000ms listen phase timer into the pick phase
    act(() => {
      vi.advanceTimersByTime(1050);
    });

    const fastBtn = screen.getByTestId("fastslow-fast");
    expect(fastBtn.getAttribute("role")).toBe("button");
    expect(fastBtn.getAttribute("aria-label")).toBe("Fast");

    const slowBtn = screen.getByTestId("fastslow-slow");
    expect(slowBtn.getAttribute("role")).toBe("button");
    expect(slowBtn.getAttribute("aria-label")).toBe("Slow");

    const replayBtn = screen.getByTestId("fastslow-replay");
    expect(replayBtn.getAttribute("role")).toBe("button");
    expect(replayBtn.getAttribute("aria-label")).toBe("Replay");

    vi.useRealTimers();
  });

  it("renders localized accessibility labels in Japanese", () => {
    vi.useFakeTimers();
    render(<FastSlowGame onHome={() => {}} difficulty="easy" lang="ja" />);

    act(() => {
      vi.advanceTimersByTime(1050);
    });

    const fastBtn = screen.getByTestId("fastslow-fast");
    expect(fastBtn.getAttribute("role")).toBe("button");
    expect(fastBtn.getAttribute("aria-label")).toBe("はやい");

    const slowBtn = screen.getByTestId("fastslow-slow");
    expect(slowBtn.getAttribute("role")).toBe("button");
    expect(slowBtn.getAttribute("aria-label")).toBe("おそい");

    const replayBtn = screen.getByTestId("fastslow-replay");
    expect(replayBtn.getAttribute("role")).toBe("button");
    expect(replayBtn.getAttribute("aria-label")).toBe("もういちどきく");

    vi.useRealTimers();
  });

  it("tapping replay returns to listen phase until playback finishes", () => {
    vi.useFakeTimers();
    let onDoneCb: (() => void) | undefined;
    const origImpl = vi.mocked(playSequence).getMockImplementation();
    vi.mocked(playSequence).mockImplementation((notes, bpm, onNote, onDone) => {
      onDoneCb = onDone;
      return () => {};
    });

    render(<FastSlowGame onHome={() => {}} difficulty="easy" lang="en" />);

    // Initial 1000ms delay triggers playRound
    act(() => {
      vi.advanceTimersByTime(1000);
    });

    // Complete playback so phase becomes 'pick'
    act(() => {
      onDoneCb?.();
    });

    const replayBtn = screen.getByTestId("fastslow-replay");
    act(() => {
      fireEvent.click(replayBtn);
    });

    // Now it should be back in listen phase
    expect(screen.queryByTestId("fastslow-fast")).toBeNull();
    expect(screen.getByText("Listen...")).toBeTruthy();

    if (origImpl) {
      vi.mocked(playSequence).mockImplementation(origImpl);
    }
    vi.useRealTimers();
  });

  it("clears listen timer and stops sequence when unmounted during listen phase", () => {
    vi.useFakeTimers();

    const { unmount } = render(
      <FastSlowGame onHome={() => {}} difficulty="easy" lang="en" />,
    );

    expect(vi.getTimerCount()).toBe(1);

    unmount();

    expect(vi.getTimerCount()).toBe(0);

    vi.useRealTimers();
  });
});
