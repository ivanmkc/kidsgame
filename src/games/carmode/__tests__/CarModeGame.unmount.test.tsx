// @vitest-environment happy-dom
import React from "react";
import { render } from "@testing-library/react";
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
});
