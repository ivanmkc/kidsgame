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
import { SteadyBeatGame } from "./SteadyBeatGame";
import * as logic from "./logic";

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

it("renders progress dots correctly during the tap phase", () => {
  vi.useFakeTimers();

  render(<SteadyBeatGame onHome={() => {}} difficulty="easy" lang="en" />);

  // Should not have progress dots initially in the 'listen' phase
  expect(screen.queryAllByTestId("steadybeat-tap-dot-empty")).toHaveLength(0);

  // Advance to tap phase
  act(() => {
    vi.advanceTimersByTime(5000);
  });

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

  // Tap 8 times on each beat (every 600ms)
  for (let i = 0; i < 8; i++) {
    act(() => {
      fireEvent.click(circle);
    });
    if (i < 7) {
      act(() => {
        vi.advanceTimersByTime(600);
      });
    }
  }

  // Advance time past totalTime (8 * 600 + 500 = 5300ms; currently elapsed in tap phase is 7 * 600 = 4200ms)
  act(() => {
    vi.advanceTimersByTime(1200);
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
