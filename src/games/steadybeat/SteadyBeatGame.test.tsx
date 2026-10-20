// @vitest-environment happy-dom
import { afterEach, expect, it, vi } from "vitest";
import React from "react";
import {
  render,
  screen,
  fireEvent,
  act,
  cleanup,
} from "@testing-library/react";
import * as sound from "../../sound";
import { SteadyBeatGame } from "./SteadyBeatGame";
import * as logic from "./logic";

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  sound.setMuted(false);
});
it("renders progress dots correctly during the tap phase", () => {
  vi.useFakeTimers();

  render(<SteadyBeatGame onHome={() => {}} difficulty="easy" lang="en" />);

  // Should not have tap progress dots initially in the 'listen' phase
  expect(screen.queryAllByTestId("steadybeat-tap-dot-empty")).toHaveLength(0);
  expect(screen.getAllByTestId("steadybeat-listen-dot-empty")).toHaveLength(3);
  expect(screen.getAllByTestId("steadybeat-listen-dot-filled")).toHaveLength(1);

  // Advance to tap phase
  act(() => {
    vi.advanceTimersByTime(5000);
  });

  // Listen dots should no longer be present in tap phase
  expect(screen.queryAllByTestId("steadybeat-listen-dot-empty")).toHaveLength(
    0,
  );
  expect(screen.queryAllByTestId("steadybeat-listen-dot-filled")).toHaveLength(
    0,
  );

  // Now the game is in 'tap' phase, there should be 8 dots, all empty
  expect(screen.getAllByTestId("steadybeat-tap-dot-empty")).toHaveLength(8);
  expect(screen.queryAllByTestId("steadybeat-tap-dot-filled")).toHaveLength(0);

  const circle = screen.getByTestId("steadybeat-circle");

  act(() => {
    fireEvent.click(circle);
  });

  // After 1 tap, there should be 1 filled dot and 7 empty dots
  expect(screen.getAllByTestId("steadybeat-tap-dot-filled")).toHaveLength(1);
  expect(screen.getAllByTestId("steadybeat-tap-dot-empty")).toHaveLength(7);

  vi.useRealTimers();
});

it("renders sequence-progress dots for listen phase that fill progressively", () => {
  vi.useFakeTimers();
  const roundSpy = vi.spyOn(logic, "makeSteadyBeatRound").mockReturnValue({
    bpm: 100,
    beatsPerRound: 8,
  });

  render(<SteadyBeatGame onHome={() => {}} difficulty="easy" lang="en" />);

  // Initially in listen phase at t = 0 (1st beat plays): 1 filled dot, 3 empty dots
  expect(screen.getAllByTestId("steadybeat-listen-dot-filled")).toHaveLength(1);
  expect(screen.getAllByTestId("steadybeat-listen-dot-empty")).toHaveLength(3);

  // 100 bpm = 600ms per beat.
  // After 2nd beat (600ms): 2 dots filled, 2 empty
  act(() => {
    vi.advanceTimersByTime(600);
  });
  expect(screen.getAllByTestId("steadybeat-listen-dot-filled")).toHaveLength(2);
  expect(screen.getAllByTestId("steadybeat-listen-dot-empty")).toHaveLength(2);

  // After 3rd beat (1200ms total): 3 dots filled, 1 empty
  act(() => {
    vi.advanceTimersByTime(600);
  });
  expect(screen.getAllByTestId("steadybeat-listen-dot-filled")).toHaveLength(3);
  expect(screen.getAllByTestId("steadybeat-listen-dot-empty")).toHaveLength(1);

  // After 4th beat (1800ms total): all 4 dots filled for a full beat!
  act(() => {
    vi.advanceTimersByTime(600);
  });
  expect(screen.getAllByTestId("steadybeat-listen-dot-filled")).toHaveLength(4);
  expect(screen.queryAllByTestId("steadybeat-listen-dot-empty")).toHaveLength(
    0,
  );

  // After 4th beat period completes (2400ms total): transitions to tap phase
  act(() => {
    vi.advanceTimersByTime(600);
  });
  expect(screen.queryAllByTestId("steadybeat-listen-dot-filled")).toHaveLength(
    0,
  );
  expect(screen.queryAllByTestId("steadybeat-listen-dot-empty")).toHaveLength(
    0,
  );
  expect(screen.getByText("Your turn!")).toBeTruthy();

  roundSpy.mockRestore();
  vi.useRealTimers();
});

it("evaluates taps correctly and increments score when tapping on the beat", () => {
  vi.useFakeTimers();
  const roundSpy = vi.spyOn(logic, "makeSteadyBeatRound").mockReturnValue({
    bpm: 100,
    beatsPerRound: 8,
  });

  render(<SteadyBeatGame onHome={() => {}} difficulty="easy" lang="en" />);

  // 4 metronome beats at 100 bpm (600ms per beat) = 2400ms to enter tap phase
  act(() => {
    vi.advanceTimersByTime(2400);
  });

  expect(screen.getByText("Your turn!")).toBeTruthy();
  const circle = screen.getByTestId("steadybeat-circle");

  // Tap 8 times on each beat (every 600ms, starting one beat after the count-in)
  for (let i = 0; i < 8; i++) {
    act(() => {
      vi.advanceTimersByTime(600);
    });
    act(() => {
      fireEvent.click(circle);
    });
  }

  // Advance time past totalTime (8 * 600 + 500 = 5300ms; currently elapsed in tap phase is 8 * 600 = 4800ms)
  act(() => {
    vi.advanceTimersByTime(600);
  });

  // After evaluation, round is won and score is incremented
  expect(screen.getByTestId("steadybeat-score").textContent).toContain("1/4");
  expect(screen.queryAllByText("☆")).toHaveLength(0);

  roundSpy.mockRestore();
  vi.useRealTimers();
});

it("evaluates to 0 hits and does not increment score when no taps are made", () => {
  vi.useFakeTimers();
  const roundSpy = vi.spyOn(logic, "makeSteadyBeatRound").mockReturnValue({
    bpm: 100,
    beatsPerRound: 8,
  });

  render(<SteadyBeatGame onHome={() => {}} difficulty="easy" lang="en" />);

  // Advance past listen phase (4 metronome beats at 100 bpm = 2400ms)
  act(() => {
    vi.advanceTimersByTime(2400);
  });

  expect(screen.getByText("Your turn!")).toBeTruthy();

  // No taps made, advance past tap phase evaluation timer (8 * 600 + 500 = 5300ms)
  act(() => {
    vi.advanceTimersByTime(5400);
  });

  // Score should remain 0/4 and all 8 stars should be empty
  expect(screen.getByTestId("steadybeat-score").textContent).toContain("0/4");
  expect(screen.getAllByText("☆")).toHaveLength(8);

  roundSpy.mockRestore();
  vi.useRealTimers();
});

it("speaks instruction line on mount", () => {
  const saySpy = vi.spyOn(sound, "say").mockImplementation(() => {});
  render(<SteadyBeatGame onHome={() => {}} difficulty="easy" lang="en" />);
  expect(saySpy).toHaveBeenCalledWith("Tap along with the beat!");
  saySpy.mockRestore();
});

it("speaks when entering tap phase", () => {
  vi.useFakeTimers();
  const saySpy = vi.spyOn(sound, "say").mockImplementation(() => {});
  render(<SteadyBeatGame onHome={() => {}} difficulty="easy" lang="en" />);
  expect(saySpy).toHaveBeenCalledWith("Tap along with the beat!");
  saySpy.mockClear();

  act(() => {
    vi.advanceTimersByTime(5000);
  });

  expect(saySpy).toHaveBeenCalledWith("Your turn!");
  saySpy.mockRestore();
  vi.useRealTimers();
});

it("provides visual beat cues during listen phase when muted", () => {
  vi.useFakeTimers();
  sound.setMuted(true);
  const roundSpy = vi.spyOn(logic, "makeSteadyBeatRound").mockReturnValue({
    bpm: 100,
    beatsPerRound: 8,
  });

  render(<SteadyBeatGame onHome={() => {}} difficulty="easy" lang="en" />);

  // Immediately on mount at 0ms (first beat): beat flashes visually
  expect(screen.getByTestId("steadybeat-beat-flash")).toBeTruthy();

  // Between beats (200ms): flash clears
  act(() => {
    vi.advanceTimersByTime(200);
  });
  expect(screen.queryByTestId("steadybeat-beat-flash")).toBeNull();

  // On the second beat (600ms): beat flashes visually again
  act(() => {
    vi.advanceTimersByTime(400);
  });
  expect(screen.getByTestId("steadybeat-beat-flash")).toBeTruthy();

  // Between beats (800ms): flash clears
  act(() => {
    vi.advanceTimersByTime(200);
  });
  expect(screen.queryByTestId("steadybeat-beat-flash")).toBeNull();

  // On the third beat (1200ms): beat flashes visually again
  act(() => {
    vi.advanceTimersByTime(400);
  });
  expect(screen.getByTestId("steadybeat-beat-flash")).toBeTruthy();

  // Between beats (1400ms): flash clears
  act(() => {
    vi.advanceTimersByTime(200);
  });
  expect(screen.queryByTestId("steadybeat-beat-flash")).toBeNull();

  // On the fourth beat (1800ms): beat flashes visually again
  act(() => {
    vi.advanceTimersByTime(400);
  });
  expect(screen.getByTestId("steadybeat-beat-flash")).toBeTruthy();

  // Advance to tap phase (at 2400ms)
  act(() => {
    vi.advanceTimersByTime(600);
  });
  expect(screen.getByText("Your turn!")).toBeTruthy();
  expect(screen.queryByTestId("steadybeat-beat-flash")).toBeNull();

  roundSpy.mockRestore();
  vi.useRealTimers();
});
