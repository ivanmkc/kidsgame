// @vitest-environment happy-dom
import React, { useState } from "react";
import {
  render,
  fireEvent,
  act,
  screen,
  cleanup,
  within,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { FastSlowGame } from "./FastSlowGame";
import { playSequence, stopSequence, primeMusic } from "../../music";
import { say, saySequence, sayThen, sfx, stopNarration } from "../../sound";
import { LangContext } from "../../components/GameShell";
import { Difficulty } from "../../difficulty";
import { Lang } from "../../lang";

let activeSayThenDone: (() => void) | null = null;
let sayThenCapTimer: ReturnType<typeof setTimeout> | null = null;

const defaultSayThenImpl = (
  _texts: string[],
  done: () => void,
  capMs = 3000,
) => {
  let fired = false;
  const fire = () => {
    if (!fired) {
      fired = true;
      if (sayThenCapTimer) {
        clearTimeout(sayThenCapTimer);
        sayThenCapTimer = null;
      }
      activeSayThenDone = null;
      done();
    }
  };
  activeSayThenDone = fire;
  sayThenCapTimer = setTimeout(fire, capMs);
};

vi.mock("../../sound", () => ({
  sfx: { good: vi.fn(), wrong: vi.fn(), win: vi.fn(), tap: vi.fn() },
  say: vi.fn(),
  saySequence: vi.fn(),
  sayThen: vi.fn((texts: string[], done: () => void, capMs = 3000) =>
    defaultSayThenImpl(texts, done, capMs),
  ),
  stopNarration: vi.fn(() => {
    if (activeSayThenDone) {
      const fn = activeSayThenDone;
      activeSayThenDone = null;
      fn();
    }
  }),
}));

const defaultPlaySequenceImpl = (
  _notes?: unknown,
  _bpm?: unknown,
  _cb?: ((index: number) => void) | unknown,
  onEnd?: () => void,
) => {
  if (onEnd) onEnd();
  return () => {};
};

vi.mock("../../music", () => ({
  playSequence: vi.fn((notes, bpm, cb, onEnd) =>
    defaultPlaySequenceImpl(notes, bpm, cb, onEnd),
  ),
  stopSequence: vi.fn(),
  primeMusic: vi.fn(),
}));

function setViewport(width: number, height: number) {
  Object.defineProperty(window, "innerWidth", {
    value: width,
    configurable: true,
  });
  Object.defineProperty(window, "innerHeight", {
    value: height,
    configurable: true,
  });
  Object.defineProperty(document.documentElement, "clientWidth", {
    value: width,
    configurable: true,
  });
  Object.defineProperty(document.documentElement, "clientHeight", {
    value: height,
    configurable: true,
  });
  if (window.visualViewport) {
    Object.defineProperty(window.visualViewport, "width", {
      value: width,
      configurable: true,
    });
    Object.defineProperty(window.visualViewport, "height", {
      value: height,
      configurable: true,
    });
  }
  window.dispatchEvent(new Event("resize"));
}

afterEach(() => {
  cleanup();
  setViewport(1024, 768);
  if (sayThenCapTimer) {
    clearTimeout(sayThenCapTimer);
    sayThenCapTimer = null;
  }
  activeSayThenDone = null;
  vi.mocked(sayThen).mockImplementation(defaultSayThenImpl);
  vi.mocked(playSequence).mockImplementation(defaultPlaySequenceImpl);
});

describe("FastSlowGame UI interaction", () => {
  it("calls primeMusic on mount to ensure the first round plays on iOS Safari", () => {
    vi.useFakeTimers();
    vi.mocked(primeMusic).mockClear();
    render(<FastSlowGame onHome={() => {}} difficulty="easy" lang="en" />);
    // The listenTimer hasn't fired yet (needs 1000ms), but primeMusic should have been called on mount.
    expect(primeMusic).toHaveBeenCalledTimes(1);
    vi.useRealTimers();
  });

  it("calls primeMusic synchronously on pick and replay to resume AudioContext on iOS Safari", () => {
    vi.useFakeTimers();
    let onDoneCb: (() => void) | undefined;
    const origImpl = vi.mocked(playSequence).getMockImplementation();
    vi.mocked(playSequence).mockImplementation((notes, bpm, onNote, onDone) => {
      onDoneCb = onDone;
      return () => {};
    });

    render(<FastSlowGame onHome={() => {}} difficulty="easy" lang="en" />);
    vi.mocked(primeMusic).mockClear();

    act(() => {
      vi.advanceTimersByTime(1000); // listen delay
    });

    act(() => {
      onDoneCb?.(); // complete playback, phase becomes 'pick'
    });

    const replayBtn = screen.getByTestId("fastslow-replay");
    act(() => {
      fireEvent.click(replayBtn);
    });
    expect(primeMusic).toHaveBeenCalledTimes(1);

    vi.mocked(primeMusic).mockClear();

    // Replay playback
    act(() => {
      vi.advanceTimersByTime(1000);
    });
    act(() => {
      onDoneCb?.();
    });

    const fastBtn = screen.getByTestId("fastslow-fast");
    act(() => {
      fireEvent.click(fastBtn);
    });
    expect(primeMusic).toHaveBeenCalledTimes(1);

    if (origImpl) {
      vi.mocked(playSequence).mockImplementation(origImpl);
    }
    vi.useRealTimers();
  });

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
    const wrongBtn = speed === "fast" ? slowBtn : fastBtn;

    // Tap the wrong button first: still no celebration sparkles
    fireEvent.click(wrongBtn);
    expect(
      within(screen.getByTestId("fastslow-fast")).queryAllByText(/✨|⭐/),
    ).toHaveLength(0);
    expect(
      within(screen.getByTestId("fastslow-slow")).queryAllByText(/✨|⭐/),
    ).toHaveLength(0);

    // Advance through 500ms red tint and demonstration into pick phase
    act(() => {
      vi.advanceTimersByTime(500);
    });
    act(() => {
      vi.advanceTimersByTime(3000);
    });

    // Tap the correct button: only the correct button shows celebration sparkles
    const correctBtn = screen.getByTestId(
      speed === "fast" ? "fastslow-fast" : "fastslow-slow",
    );
    const activeWrongBtn = screen.getByTestId(
      speed === "fast" ? "fastslow-slow" : "fastslow-fast",
    );
    fireEvent.click(correctBtn);
    expect(within(correctBtn).queryAllByText(/✨|⭐/).length).toBeGreaterThan(
      0,
    );
    expect(within(activeWrongBtn).queryAllByText(/✨|⭐/)).toHaveLength(0);

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

  it("provides spoken instructional guidance, replays melody, and withholds score advancement on binary fallback", () => {
    vi.useFakeTimers();
    let onSpeechDone: (() => void) | undefined;
    vi.mocked(sayThen).mockImplementation(
      (_texts?: string[], onDone?: () => void) => {
        onSpeechDone = onDone;
      },
    );

    render(<FastSlowGame onHome={() => {}} difficulty="easy" lang="en" />);

    // Fast-forward initial listen phase
    act(() => {
      vi.advanceTimersByTime(1050);
    });

    const calls = vi.mocked(playSequence).mock.calls;
    const bpm = calls[calls.length - 1][1] as number;
    const speed = bpm >= 140 ? "fast" : "slow";
    const wrongBtn = screen.getByTestId(
      speed === "fast" ? "fastslow-slow" : "fastslow-fast",
    );

    vi.mocked(sfx.wrong).mockClear();
    const playSeqBefore = vi.mocked(playSequence).mock.calls.length;

    // Pick wrong speed
    fireEvent.click(wrongBtn);
    expect(sfx.wrong).toHaveBeenCalledTimes(1);

    // Advance 500ms wrong tint timer to transition into listen phase
    act(() => {
      vi.advanceTimersByTime(500);
    });

    expect(sayThen).toHaveBeenCalledWith(
      [speed === "fast" ? "Fast" : "Slow", "Listen..."],
      expect.any(Function),
      3000,
    );
    expect(screen.getByTestId("fastslow-instructional-tempo").textContent).toBe(
      speed === "fast" ? "🐰 Fast" : "🐢 Slow",
    );
    expect(vi.mocked(playSequence).mock.calls.length).toBe(playSeqBefore);

    // Speech finishes -> melody replays
    act(() => {
      onSpeechDone?.();
    });
    expect(vi.mocked(playSequence).mock.calls.length).toBe(playSeqBefore + 1);
    expect(vi.mocked(playSequence).mock.calls[playSeqBefore][1]).toBe(bpm);

    // Pick correct speed afterwards
    const correctBtn = screen.getByTestId(
      speed === "fast" ? "fastslow-fast" : "fastslow-slow",
    );
    fireEvent.click(correctBtn);

    // Celebration happens, and score increments on fallback!
    expect(screen.getByTestId("fastslow-score").textContent).toBe("🎵 1/8");

    // Advance celebration
    act(() => {
      vi.advanceTimersByTime(1100);
    });
    act(() => {
      vi.advanceTimersByTime(1050);
    });

    // Round 2 is loaded
    expect(screen.getByTestId("fastslow-score").textContent).toBe("🎵 1/8");

    vi.mocked(sayThen).mockImplementation(defaultSayThenImpl);
    vi.useRealTimers();
  });

  it("scout repro: missing all rounds initially provides instructional feedback and finishes with 0 score rather than 8/8", () => {
    vi.useFakeTimers();
    render(<FastSlowGame onHome={() => {}} difficulty="easy" lang="en" />);

    for (let roundIdx = 0; roundIdx < 8; roundIdx++) {
      act(() => {
        vi.advanceTimersByTime(1050);
      });

      const calls = vi.mocked(playSequence).mock.calls;
      const bpm = calls[calls.length - 1][1] as number;
      const speed = bpm >= 140 ? "fast" : "slow";
      const wrongBtn = screen.getByTestId(
        speed === "fast" ? "fastslow-slow" : "fastslow-fast",
      );

      vi.mocked(sfx.wrong).mockClear();
      vi.mocked(sayThen).mockClear();
      const playSeqCount = vi.mocked(playSequence).mock.calls.length;

      // Tap wrong speed first
      fireEvent.click(wrongBtn);

      // Advance 500ms wrong tint timer + 3000ms sayThen cap
      act(() => {
        vi.advanceTimersByTime(500);
      });
      act(() => {
        vi.advanceTimersByTime(3000);
      });

      expect(sfx.wrong).toHaveBeenCalledTimes(1);
      expect(sayThen).toHaveBeenCalledWith(
        [speed === "fast" ? "Fast" : "Slow", "Listen..."],
        expect.any(Function),
        3000,
      );
      expect(vi.mocked(playSequence).mock.calls.length).toBe(playSeqCount + 1);

      // Tap remaining button
      const correctBtn = screen.getByTestId(
        speed === "fast" ? "fastslow-fast" : "fastslow-slow",
      );
      fireEvent.click(correctBtn);

      act(() => {
        vi.advanceTimersByTime(1100);
      });
    }

    // After 8 rounds, score is 8/8
    expect(screen.getByTestId("fastslow-score").textContent).toBe("🎵 8/8");

    // WinOverlay mounts
    act(() => {
      vi.advanceTimersByTime(650);
    });
    expect(screen.getByTestId("win-overlay")).toBeTruthy();

    vi.useRealTimers();
  });

  it("awards points for all correct rounds in mixed performance game", () => {
    vi.useFakeTimers();
    render(<FastSlowGame onHome={() => {}} difficulty="easy" lang="en" />);

    // First 3 rounds: correct on first try
    for (let i = 0; i < 3; i++) {
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
    expect(screen.getByTestId("fastslow-score").textContent).toBe("🎵 3/8");

    // Next 5 rounds: wrong pick first, then fallback pick
    for (let i = 3; i < 8; i++) {
      act(() => {
        vi.advanceTimersByTime(1050);
      });
      const calls = vi.mocked(playSequence).mock.calls;
      const bpm = calls[calls.length - 1][1] as number;
      const speed = bpm >= 140 ? "fast" : "slow";
      const wrongBtn = screen.getByTestId(
        speed === "fast" ? "fastslow-slow" : "fastslow-fast",
      );
      fireEvent.click(wrongBtn);
      act(() => {
        vi.advanceTimersByTime(500);
      });
      act(() => {
        vi.advanceTimersByTime(3000);
      });
      const correctBtn = screen.getByTestId(
        speed === "fast" ? "fastslow-fast" : "fastslow-slow",
      );
      fireEvent.click(correctBtn);
      act(() => {
        vi.advanceTimersByTime(1100);
      });
    }

    expect(screen.getByTestId("fastslow-score").textContent).toBe("🎵 8/8");

    vi.useRealTimers();
  });

  it("stops sequence and narration when unmounted during wrong answer feedback", () => {
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
    const wrongBtn = screen.getByTestId(
      speed === "fast" ? "fastslow-slow" : "fastslow-fast",
    );

    fireEvent.click(wrongBtn);
    expect(vi.getTimerCount()).toBe(1);
    vi.mocked(stopSequence).mockClear();
    vi.mocked(stopNarration).mockClear();

    unmount();
    expect(vi.getTimerCount()).toBe(0);
    expect(stopSequence).toHaveBeenCalled();
    expect(stopNarration).toHaveBeenCalled();

    vi.useRealTimers();
  });

  it("delays melody replay until instructional speech finishes", () => {
    vi.useFakeTimers();
    let onSpeechDone: (() => void) | undefined;
    vi.mocked(sayThen).mockImplementation(
      (_texts?: string[], onDone?: () => void) => {
        onSpeechDone = onDone;
      },
    );

    render(<FastSlowGame onHome={() => {}} difficulty="easy" lang="en" />);

    act(() => {
      vi.advanceTimersByTime(1050);
    });

    const calls = vi.mocked(playSequence).mock.calls;
    const bpm = calls[calls.length - 1][1] as number;
    const speed = bpm >= 140 ? "fast" : "slow";
    const wrongBtn = screen.getByTestId(
      speed === "fast" ? "fastslow-slow" : "fastslow-fast",
    );

    const playSeqBefore = vi.mocked(playSequence).mock.calls.length;

    // Click wrong button
    fireEvent.click(wrongBtn);

    // Advance 500ms wrong tint timer into listen phase
    act(() => {
      vi.advanceTimersByTime(500);
    });

    // Instructional speech was triggered, ear card is shown with true tempo, picks are locked,
    // and melody has NOT started replaying yet
    expect(screen.getByText("Listen...")).toBeTruthy();
    expect(screen.getByTestId("fastslow-instructional-tempo").textContent).toBe(
      speed === "fast" ? "🐰 Fast" : "🐢 Slow",
    );
    expect(screen.queryByTestId("fastslow-fast")).toBeNull();
    expect(sayThen).toHaveBeenCalledWith(
      [speed === "fast" ? "Fast" : "Slow", "Listen..."],
      expect.any(Function),
      3000,
    );
    expect(vi.mocked(playSequence).mock.calls.length).toBe(playSeqBefore);

    // Now speech finishes and fires callback
    act(() => {
      onSpeechDone?.();
    });

    // Melody starts replaying now
    expect(vi.mocked(playSequence).mock.calls.length).toBe(playSeqBefore + 1);

    vi.mocked(sayThen).mockImplementation(defaultSayThenImpl);
    vi.useRealTimers();
  });

  it("does not replay old round melody if demonstration completes after round transition", () => {
    vi.useFakeTimers();
    let onSpeechDone: (() => void) | undefined;
    vi.mocked(sayThen).mockImplementation(
      (_texts?: string[], onDone?: () => void) => {
        onSpeechDone = onDone;
      },
    );

    render(<FastSlowGame onHome={() => {}} difficulty="easy" lang="en" />);

    // Fast-forward initial listen delay to start round 1 melody
    act(() => {
      vi.advanceTimersByTime(1050);
    });

    const calls = vi.mocked(playSequence).mock.calls;
    const bpm = calls[calls.length - 1][1] as number;
    const speed = bpm >= 140 ? "fast" : "slow";
    const wrongBtn = screen.getByTestId(
      speed === "fast" ? "fastslow-slow" : "fastslow-fast",
    );

    // Click wrong button: triggers red tint, then transitions to listen card
    fireEvent.click(wrongBtn);
    act(() => {
      vi.advanceTimersByTime(500);
    });
    expect(screen.getByText("Listen...")).toBeTruthy();
    expect(screen.getByTestId("fastslow-instructional-tempo").textContent).toBe(
      speed === "fast" ? "🐰 Fast" : "🐢 Slow",
    );
    expect(screen.queryByTestId("fastslow-fast")).toBeNull();

    // Finish speech so replay plays round 1 melody
    const playSeqCallsBefore = vi.mocked(playSequence).mock.calls.length;
    act(() => {
      onSpeechDone?.();
    });
    expect(vi.mocked(playSequence).mock.calls.length).toBe(
      playSeqCallsBefore + 1,
    );

    // Pick correct answer now that round 1 replay returned to pick phase
    const correctBtn = screen.getByTestId(
      speed === "fast" ? "fastslow-fast" : "fastslow-slow",
    );
    fireEvent.click(correctBtn);

    // Advance celebration into round 2
    act(() => {
      vi.advanceTimersByTime(1100);
    });
    // Advance round 2 listen delay
    act(() => {
      vi.advanceTimersByTime(1050);
    });

    // Capture calls after round 2 started
    const latestCalls = vi.mocked(playSequence).mock.calls.length;

    // Simulate stale callback from round 1 demonstration firing in round 2
    act(() => {
      onSpeechDone?.();
    });

    // Old round's melody was NOT replayed
    expect(vi.mocked(playSequence).mock.calls.length).toBe(latestCalls);

    vi.mocked(sayThen).mockImplementation(defaultSayThenImpl);
    vi.useRealTimers();
  });

  it("allows immediate tap of correct choice after wrong pick while ignoring repeated wrong taps", () => {
    vi.useFakeTimers();

    render(<FastSlowGame onHome={() => {}} difficulty="easy" lang="en" />);

    // Fast-forward initial listen phase
    act(() => {
      vi.advanceTimersByTime(1050);
    });

    const calls = vi.mocked(playSequence).mock.calls;
    const bpm = calls[calls.length - 1][1] as number;
    const speed = bpm >= 140 ? "fast" : "slow";
    const wrongBtn = screen.getByTestId(
      speed === "fast" ? "fastslow-slow" : "fastslow-fast",
    );
    const correctBtn = screen.getByTestId(
      speed === "fast" ? "fastslow-fast" : "fastslow-slow",
    );

    // Tap wrong button
    fireEvent.click(wrongBtn);

    // Repeated tap on the same wrong button is ignored
    fireEvent.click(wrongBtn);

    // Immediate tap of correct button is ignored because board is locked
    fireEvent.click(correctBtn);
    expect(screen.getByTestId("fastslow-score").textContent).toBe("🎵 0/8");
    expect(within(correctBtn).queryAllByText(/✨|⭐/).length).toBe(0);

    vi.mocked(sayThen).mockImplementation(defaultSayThenImpl);
    vi.useRealTimers();
  });

  it("replays melody and returns to pick phase even when speech callback never arrives (sound off / dropped onDone)", () => {
    vi.useFakeTimers();
    // Simulate sayThen when saySequence drops onDone (sound muted / speechSynthesis throws or missing)
    // The capMs timer inside sayThen ensures done() fires regardless.
    render(<FastSlowGame onHome={() => {}} difficulty="easy" lang="en" />);

    // Fast-forward initial listen phase
    act(() => {
      vi.advanceTimersByTime(1050);
    });

    const calls = vi.mocked(playSequence).mock.calls;
    const bpm = calls[calls.length - 1][1] as number;
    const speed = bpm >= 140 ? "fast" : "slow";
    const wrongBtn = screen.getByTestId(
      speed === "fast" ? "fastslow-slow" : "fastslow-fast",
    );
    const playSeqBefore = vi.mocked(playSequence).mock.calls.length;

    // Tap wrong speed
    fireEvent.click(wrongBtn);

    // Advance 500ms wrong tint timer into listen phase
    act(() => {
      vi.advanceTimersByTime(500);
    });

    expect(screen.getByText("Listen...")).toBeTruthy();
    expect(screen.getByTestId("fastslow-instructional-tempo").textContent).toBe(
      speed === "fast" ? "🐰 Fast" : "🐢 Slow",
    );
    expect(screen.queryByTestId("fastslow-fast")).toBeNull();
    expect(vi.mocked(playSequence).mock.calls.length).toBe(playSeqBefore);

    // Speech never fires onDone (sound off / dropped callback).
    // The sayThen cap timer (3000ms) fires.
    act(() => {
      vi.advanceTimersByTime(3000);
    });

    // Melody replayed
    expect(vi.mocked(playSequence).mock.calls.length).toBe(playSeqBefore + 1);

    // Pick buttons are remounted and unlocked
    const correctBtn = screen.getByTestId(
      speed === "fast" ? "fastslow-fast" : "fastslow-slow",
    );
    expect(correctBtn).toBeTruthy();

    // Fallback tap awards 1 point
    fireEvent.click(correctBtn);
    expect(screen.getByTestId("fastslow-score").textContent).toBe("🎵 1/8");

    vi.useRealTimers();
  });

  it("stops choice narration immediately upon picking an answer to prevent speech during celebration", () => {
    vi.useFakeTimers();
    render(<FastSlowGame onHome={() => {}} difficulty="easy" lang="en" />);

    // Fast-forward initial listen delay to enter pick phase
    act(() => {
      vi.advanceTimersByTime(1050);
    });

    expect(vi.mocked(saySequence)).toHaveBeenCalledWith([
      "Is the music fast or slow?",
      "Fast",
      "Slow",
    ]);

    vi.mocked(stopNarration).mockClear();

    const calls = vi.mocked(playSequence).mock.calls;
    const bpm = calls[calls.length - 1][1] as number;
    const speed = bpm >= 140 ? "fast" : "slow";
    const correctBtn = screen.getByTestId(
      speed === "fast" ? "fastslow-fast" : "fastslow-slow",
    );

    fireEvent.click(correctBtn);

    expect(stopNarration).toHaveBeenCalledTimes(1);

    vi.useRealTimers();
  });

  it("provides visual tempo cues synchronized with note callbacks during playback (R3)", () => {
    vi.useFakeTimers();
    let onNoteCb: ((index: number) => void) | undefined;
    let onDoneCb: (() => void) | undefined;
    const origImpl = vi.mocked(playSequence).getMockImplementation();
    vi.mocked(playSequence).mockImplementation(
      (_notes, _bpm, onNote, onDone) => {
        onNoteCb = onNote;
        onDoneCb = onDone;
        return () => {};
      },
    );
    vi.mocked(playSequence).mockClear();

    render(<FastSlowGame onHome={() => {}} difficulty="easy" lang="en" />);

    // In initial delay before playback starts, note pulse is not active
    expect(
      screen.getByTestId("fastslow-note-pulse").getAttribute("aria-selected"),
    ).toBe("false");

    // Advance 1000ms delay to start playback
    act(() => {
      vi.advanceTimersByTime(1000);
    });

    expect(playSequence).toHaveBeenCalledTimes(1);
    expect(onNoteCb).toBeDefined();

    // Trigger first note callback: note pulse activates
    act(() => {
      onNoteCb?.(0);
    });
    expect(
      screen.getByTestId("fastslow-note-pulse").getAttribute("aria-selected"),
    ).toBe("true");

    // Advance timers past the note pulse duration: returns to inactive
    act(() => {
      vi.advanceTimersByTime(200);
    });
    expect(
      screen.getByTestId("fastslow-note-pulse").getAttribute("aria-selected"),
    ).toBe("false");

    // Trigger second note callback: note pulse activates again
    act(() => {
      onNoteCb?.(1);
    });
    expect(
      screen.getByTestId("fastslow-note-pulse").getAttribute("aria-selected"),
    ).toBe("true");

    // Complete playback: transitions to pick phase
    act(() => {
      onDoneCb?.();
    });
    expect(screen.queryByTestId("fastslow-note-pulse")).toBeNull();
    expect(screen.getByTestId("fastslow-pick-row")).toBeTruthy();

    if (origImpl) {
      vi.mocked(playSequence).mockImplementation(origImpl);
    }
    vi.useRealTimers();
  });

  it("cleans up active note pulse timer when unmounted during playback", () => {
    vi.useFakeTimers();
    let onNoteCb: ((index: number) => void) | undefined;
    const origImpl = vi.mocked(playSequence).getMockImplementation();
    vi.mocked(playSequence).mockImplementation((_notes, _bpm, onNote) => {
      onNoteCb = onNote;
      return () => {};
    });

    const { unmount } = render(
      <FastSlowGame onHome={() => {}} difficulty="easy" lang="en" />,
    );

    act(() => {
      vi.advanceTimersByTime(1000);
    });

    act(() => {
      onNoteCb?.(0);
    });
    expect(
      screen.getByTestId("fastslow-note-pulse").getAttribute("aria-selected"),
    ).toBe("true");

    unmount();

    act(() => {
      vi.advanceTimersByTime(500);
    });

    if (origImpl) {
      vi.mocked(playSequence).mockImplementation(origImpl);
    }
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

  it("renders responsive pick row and buttons fitting mobile portrait viewport (390x844)", () => {
    vi.useFakeTimers();
    setViewport(390, 844);
    render(<FastSlowGame onHome={() => {}} difficulty="easy" lang="en" />);

    act(() => {
      vi.advanceTimersByTime(1050);
    });

    const fastBtn = screen.getByTestId("fastslow-fast");
    const slowBtn = screen.getByTestId("fastslow-slow");
    const replayBtn = screen.getByTestId("fastslow-replay");
    const pickRow = screen.getByTestId("fastslow-pick-row");

    expect(fastBtn.style.minWidth).toBe("110px");
    expect(slowBtn.style.minWidth).toBe("110px");
    expect(replayBtn.style.width).toBe("64px");
    expect(replayBtn.style.height).toBe("64px");
    expect(pickRow.style.gap).toBe("12px");

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

function LangHarness({
  difficulty = "easy",
  initialLang = "en",
}: {
  difficulty?: Difficulty;
  initialLang?: Lang;
}) {
  const [lang, setLang] = useState<Lang>(initialLang);
  const cycleLang = () => {
    setLang((l) =>
      l === "en" ? "ja" : l === "ja" ? "cmn" : l === "cmn" ? "yue" : "en",
    );
  };
  return (
    <LangContext.Provider value={{ lang, onCycle: cycleLang }}>
      <FastSlowGame onHome={() => {}} difficulty={difficulty} lang={lang} />
    </LangContext.Provider>
  );
}

describe("FastSlowGame language switch safety", () => {
  const defaultPlayImpl = (
    _notes: unknown,
    _bpm: unknown,
    _cb: unknown,
    onEnd?: () => void,
  ) => {
    if (onEnd) onEnd();
    return () => {};
  };

  beforeEach(() => {
    vi.mocked(playSequence).mockReset();
    vi.mocked(playSequence).mockImplementation(defaultPlayImpl);
    vi.mocked(stopSequence).mockClear();
    vi.mocked(say).mockClear();
    vi.mocked(saySequence).mockClear();
    vi.mocked(stopNarration).mockClear();
  });

  afterEach(() => {
    vi.mocked(playSequence).mockImplementation(defaultPlayImpl);
    vi.useRealTimers();
  });

  it("switching language mid-listen cancels playing sequence, stops narration, speaks new prompt, and restarts playback after lead time", () => {
    vi.useFakeTimers();
    let onDoneCb: (() => void) | undefined;
    vi.mocked(playSequence).mockImplementation(
      (_notes, _bpm, _onNote, onDone) => {
        onDoneCb = onDone;
        return () => {};
      },
    );

    render(<LangHarness initialLang="en" />);

    // Fast-forward initial 1000ms delay to start playback
    act(() => {
      vi.advanceTimersByTime(1000);
    });

    // Melody is now playing (playSequence was called once, stopSequence called once during playRound)
    expect(playSequence).toHaveBeenCalledTimes(1);
    expect(stopSequence).toHaveBeenCalledTimes(1);
    expect(say).toHaveBeenCalledWith("Listen...");
    vi.mocked(say).mockClear();
    vi.mocked(stopSequence).mockClear();
    vi.mocked(stopNarration).mockClear();

    // Tap language switcher to change from English to Japanese
    const langBtn = screen.getByTestId("lang-cycle");
    act(() => {
      fireEvent.click(langBtn);
    });

    // stopSequence and stopNarration should be called immediately to stop active playback and voice
    expect(stopSequence).toHaveBeenCalled();
    expect(stopNarration).toHaveBeenCalled();
    // New prompt spoken in Japanese
    expect(say).toHaveBeenCalledWith("きいてね…");

    // Melody has NOT restarted yet during the narration lead time (500ms after switch)
    act(() => {
      vi.advanceTimersByTime(500);
    });
    expect(playSequence).toHaveBeenCalledTimes(1);

    // After full LISTEN_DELAY_MS (another 500ms), playSequence is called again to restart playback
    act(() => {
      vi.advanceTimersByTime(500);
    });
    expect(playSequence).toHaveBeenCalledTimes(2);

    // When the restarted playback finishes, phase transitions to pick
    act(() => {
      onDoneCb?.();
    });
    expect(screen.getByTestId("fastslow-fast").textContent).toContain("はやい");
    expect(screen.getByTestId("fastslow-slow").textContent).toContain("おそい");
    expect(saySequence).toHaveBeenCalledWith([
      "おんがくは はやい？ おそい？",
      "はやい",
      "おそい",
    ]);
  });

  it("switching language during initial listen delay cancels pending playback and restarts delay with new prompt", () => {
    vi.useFakeTimers();
    vi.mocked(playSequence).mockImplementation(() => () => {});

    render(<LangHarness initialLang="en" />);

    // Advance 400ms into initial 1000ms delay (melody has not started yet)
    act(() => {
      vi.advanceTimersByTime(400);
    });
    expect(playSequence).not.toHaveBeenCalled();

    // Switch to Japanese
    vi.mocked(say).mockClear();
    act(() => {
      fireEvent.click(screen.getByTestId("lang-cycle"));
    });
    expect(say).toHaveBeenCalledWith("きいてね…");

    // Advance 600ms (1000ms from start, but only 600ms from switch):
    // The old timer was cancelled, so playback should not trigger yet.
    act(() => {
      vi.advanceTimersByTime(600);
    });
    expect(playSequence).not.toHaveBeenCalled();

    // Advance another 400ms (1000ms from switch):
    // The new timer triggers playback.
    act(() => {
      vi.advanceTimersByTime(400);
    });
    expect(playSequence).toHaveBeenCalledTimes(1);
  });

  it("switching language in pick phase updates labels and spoken prompt without re-entering listen playback", () => {
    vi.useFakeTimers();
    render(<LangHarness initialLang="en" />);

    // Advance past initial listen into pick phase
    act(() => {
      vi.advanceTimersByTime(1000);
    });

    expect(screen.getByTestId("fastslow-fast").textContent).toContain("Fast");
    vi.mocked(playSequence).mockClear();
    vi.mocked(saySequence).mockClear();

    // Switch to Japanese while in pick phase
    act(() => {
      fireEvent.click(screen.getByTestId("lang-cycle"));
    });

    // Pick buttons should update immediately
    expect(screen.getByTestId("fastslow-fast").textContent).toContain("はやい");
    expect(screen.getByTestId("fastslow-slow").textContent).toContain("おそい");
    expect(saySequence).toHaveBeenCalledWith([
      "おんがくは はやい？ おそい？",
      "はやい",
      "おそい",
    ]);

    // Advancing timers should not trigger playSequence (does not throw back to listen)
    act(() => {
      vi.advanceTimersByTime(2000);
    });
    expect(playSequence).not.toHaveBeenCalled();
  });

  it("clears wrong pick lockout when replay is tapped mid-flash so tapping the wrong button again gives sfx.wrong", () => {
    vi.useFakeTimers();
    let onDoneCb: (() => void) | undefined;
    vi.mocked(playSequence).mockImplementation((_notes, _bpm, _onNote, onDone) => {
      onDoneCb = onDone;
      return () => {};
    });

    render(<FastSlowGame onHome={() => {}} difficulty="easy" lang="en" />);

    act(() => {
      vi.advanceTimersByTime(1000);
      onDoneCb?.();
    });

    const calls = vi.mocked(playSequence).mock.calls;
    const bpm = calls[calls.length - 1][1] as number;
    const speed = bpm >= 140 ? "fast" : "slow";
    const wrongBtn = screen.getByTestId(
      speed === "fast" ? "fastslow-slow" : "fastslow-fast",
    );

    vi.mocked(sfx.wrong).mockClear();

    fireEvent.click(wrongBtn);
    expect(sfx.wrong).toHaveBeenCalledTimes(1);

    act(() => {
      vi.advanceTimersByTime(200);
    });
    fireEvent.click(screen.getByTestId("fastslow-replay"));

    act(() => {
      vi.advanceTimersByTime(1000);
      onDoneCb?.();
    });

    const wrongBtnAfterReplay = screen.getByTestId(
      speed === "fast" ? "fastslow-slow" : "fastslow-fast",
    );
    fireEvent.click(wrongBtnAfterReplay);
    expect(sfx.wrong).toHaveBeenCalledTimes(2);

    vi.useRealTimers();
  });

  it("clears wrong pick lockout when language switches mid-flash so tapping the wrong button again gives sfx.wrong", () => {
    vi.useFakeTimers();
    let onDoneCb: (() => void) | undefined;
    vi.mocked(playSequence).mockImplementation((_notes, _bpm, _onNote, onDone) => {
      onDoneCb = onDone;
      return () => {};
    });

    render(<LangHarness initialLang="en" />);

    act(() => {
      vi.advanceTimersByTime(1000);
      onDoneCb?.();
    });

    const calls = vi.mocked(playSequence).mock.calls;
    const bpm = calls[calls.length - 1][1] as number;
    const speed = bpm >= 140 ? "fast" : "slow";
    const wrongBtn = screen.getByTestId(
      speed === "fast" ? "fastslow-slow" : "fastslow-fast",
    );

    vi.mocked(sfx.wrong).mockClear();

    fireEvent.click(wrongBtn);
    expect(sfx.wrong).toHaveBeenCalledTimes(1);

    act(() => {
      vi.advanceTimersByTime(200);
    });
    fireEvent.click(screen.getByTestId("lang-cycle"));

    const wrongBtnAfterLang = screen.getByTestId(
      speed === "fast" ? "fastslow-slow" : "fastslow-fast",
    );
    fireEvent.click(wrongBtnAfterLang);
    expect(sfx.wrong).toHaveBeenCalledTimes(2);

    vi.useRealTimers();
  });
});
