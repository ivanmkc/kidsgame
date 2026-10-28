// @vitest-environment happy-dom
import React from "react";
import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import * as sound from "../../../sound";
import * as music from "../../../music";
import * as logic from "../logic";
import { CarModeGame } from "../CarModeGame";

describe("CarModeGame unmount", () => {
  let activeCancel: (() => void) | null = null;

  beforeEach(() => {
    activeCancel = null;
    vi.spyOn(music, "playSequence").mockImplementation(
      (notes, bpm, onNote, onDone) => {
        const beatSec = 60 / bpm;
        const timers: ReturnType<typeof setTimeout>[] = [];
        let cancelled = false;
        let offset = 0;
        for (let i = 0; i < notes.length; i++) {
          if (onNote) {
            const idx = i;
            const ms = Math.max(0, (0.05 + offset) * 1000);
            timers.push(
              setTimeout(() => {
                if (!cancelled) onNote(idx);
              }, ms),
            );
          }
          offset += notes[i].b * beatSec;
        }
        if (onDone) {
          const endMs = Math.max(0, (0.05 + offset) * 1000);
          timers.push(
            setTimeout(() => {
              if (!cancelled) onDone();
            }, endMs),
          );
        }
        const cancel = () => {
          cancelled = true;
          for (const t of timers) clearTimeout(t);
        };
        activeCancel = cancel;
        return cancel;
      },
    );
    vi.spyOn(music, "stopSequence").mockImplementation(() => {
      if (activeCancel) {
        activeCancel();
        activeCancel = null;
      }
    });
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("clears boop sequence and does not trigger prompt when unmounted early", () => {
    vi.useFakeTimers();
    const sayThenSpy = vi.spyOn(sound, "sayThen").mockReturnValue();
    const stopSequenceSpy = vi.spyOn(music, "stopSequence");

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

    expect(stopSequenceSpy).toHaveBeenCalled();

    // Fast-forward through all timers.
    vi.runAllTimers();

    // We shouldn't have said the prompt because the sequence was cancelled on unmount!
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
