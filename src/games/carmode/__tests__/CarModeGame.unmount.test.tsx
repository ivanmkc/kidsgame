// @vitest-environment happy-dom
import React from "react";
import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import * as sound from "../../../sound";
import * as music from "../../../music";
import * as logic from "../logic";
import { CarModeGame } from "../CarModeGame";

describe("CarModeGame unmount", () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("clears boop timers and startRound timer when unmounted early", () => {
    vi.useFakeTimers();
    const sayThenSpy = vi.spyOn(sound, "sayThen").mockReturnValue();
    const playNoteSpy = vi.spyOn(music, "playNote").mockReturnValue();

    const actual = logic.startState("boops", 42);
    vi.spyOn(logic, "startState").mockReturnValue({
      ...actual,
      phase: "prompt",
      rounds: [
        {
          id: "test-1",
          pack: "boops",
          noteCount: 3,
          prompt: ["prompt1"],
          reveal: ["reveal1"],
          sfx: "good",
          gapMs: 1000,
        },
      ],
      roundIdx: 0,
    });

    const { unmount } = render(<CarModeGame onHome={() => {}} lang="en" />);

    // Unmount the component immediately!
    unmount();

    // Fast-forward through all timers.
    vi.runAllTimers();

    // We shouldn't have played any notes or said the prompt, because the timers were cleared!
    expect(playNoteSpy).not.toHaveBeenCalled();
    expect(sayThenSpy).not.toHaveBeenCalled();
  });

  it("stops narration when unmounted", () => {
    const stopNarrationSpy = vi.spyOn(sound, "stopNarration");
    const { unmount } = render(<CarModeGame onHome={() => {}} lang="en" />);
    stopNarrationSpy.mockClear();

    unmount();

    expect(stopNarrationSpy).toHaveBeenCalled();
  });

  it("clears reveal auto-advance timers when unmounted during reveal phase", () => {
    vi.useFakeTimers();
    const advanceSpy = vi.spyOn(logic, "advance");
    const actual = logic.startState("boops", 42);
    vi.spyOn(logic, "startState").mockReturnValue({
      ...actual,
      phase: "reveal",
      roundIdx: 0,
    });

    const { unmount } = render(<CarModeGame onHome={() => {}} lang="en" />);

    unmount();

    // Fast-forward through all timers.
    vi.runAllTimers();

    expect(advanceSpy).not.toHaveBeenCalled();
  });

  it("clears replay timers when unmounted during boops prompt replay", () => {
    vi.useFakeTimers();
    const sayThenSpy = vi.spyOn(sound, "sayThen");
    const actual = logic.startState("boops", 42);
    vi.spyOn(logic, "startState").mockReturnValue({
      ...actual,
      phase: "gap",
      roundIdx: 0,
    });

    const { unmount } = render(<CarModeGame onHome={() => {}} lang="en" />);

    // Advance past phase debounce
    act(() => {
      vi.advanceTimersByTime(400);
    });

    sayThenSpy.mockClear();

    // Tap to trigger replay
    const tapBtn = screen.getByTestId("carmode-tap");
    fireEvent.click(tapBtn);

    expect(sayThenSpy).not.toHaveBeenCalled();

    unmount();

    // Fast-forward through all timers.
    vi.runAllTimers();

    expect(sayThenSpy).not.toHaveBeenCalled();
  });
});
