// @vitest-environment happy-dom
import React from "react";
import { act, render } from "@testing-library/react";
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

  it("stops prompt and does not play boop sequence when unmounted early", () => {
    vi.useFakeTimers();
    let sayThenCb: (() => void) | undefined;
    vi.spyOn(sound, "sayThen").mockImplementation((_t, cb) => {
      sayThenCb = cb;
    });
    const stopNarrationSpy = vi.spyOn(sound, "stopNarration");
    const playSequenceSpy = vi.spyOn(music, "playSequence");

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

    // Unmount the component while prompt is still speaking!
    unmount();

    expect(stopNarrationSpy).toHaveBeenCalled();

    // Now if the speech callback fires (which could happen if mock clears late or something),
    // it shouldn't trigger the boops because component is unmounted (isValid() check).
    sayThenCb?.();

    // Fast-forward through all timers.
    vi.runAllTimers();

    // We shouldn't have played the boops!
    expect(playSequenceSpy).not.toHaveBeenCalled();
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

  it("clears gap timer when unmounted during boops gap phase", () => {
    vi.useFakeTimers();
    const toRevealSpy = vi.spyOn(logic, "toReveal");
    const actual = logic.startState("boops", 42);
    vi.spyOn(logic, "startState").mockReturnValue({
      ...actual,
      phase: "gap",
      roundIdx: 0,
    });

    const { unmount } = render(<CarModeGame onHome={() => {}} lang="en" />);

    unmount();

    // Fast-forward through all timers.
    vi.runAllTimers();

    expect(toRevealSpy).not.toHaveBeenCalled();
  });

  it("does not transition to gap when unmounted while sayThen is active during prompt", () => {
    vi.useFakeTimers();
    const toGapSpy = vi.spyOn(logic, "toGap");
    const actual = logic.startState("rhyme", 42);
    vi.spyOn(logic, "startState").mockReturnValue({
      ...actual,
      pack: "rhyme",
      phase: "prompt",
      rounds: [
        {
          id: "rhyme-1",
          pack: "rhyme",
          prompt: ["prompt1"],
          reveal: ["reveal1"],
          sfx: "good",
          gapMs: 1000,
        },
      ],
      roundIdx: 0,
    });

    const { unmount } = render(<CarModeGame onHome={() => {}} lang="en" />);

    unmount();

    // Fast-forward through all timers.
    vi.runAllTimers();

    expect(toGapSpy).not.toHaveBeenCalled();
  });

  it("does not transition to gap when unmounted while playBoops is active", () => {
    vi.useFakeTimers();
    const toGapSpy = vi.spyOn(logic, "toGap");
    const actual = logic.startState("boops", 42);
    vi.spyOn(logic, "startState").mockReturnValue({
      ...actual,
      phase: "prompt",
      rounds: [
        {
          id: "test-boops-1",
          pack: "boops",
          noteCount: 2,
          prompt: ["prompt1"],
          reveal: ["reveal1"],
          sfx: "good",
          gapMs: 1000,
        },
      ],
      roundIdx: 0,
    });

    const { unmount } = render(<CarModeGame onHome={() => {}} lang="en" />);

    // Fast-forward so sayThen finishes and playBoops starts, but unmount before playBoops completes
    act(() => {
      vi.advanceTimersByTime(100);
    });

    // playBoops is active; unmount component while in flight
    unmount();

    // Fast-forward through all timers.
    vi.runAllTimers();

    expect(toGapSpy).not.toHaveBeenCalled();
  });

  it("does not transition to reveal when unmounted during gap phase", () => {
    vi.useFakeTimers();
    const toRevealSpy = vi.spyOn(logic, "toReveal");
    const actual = logic.startState("rhyme", 42);
    vi.spyOn(logic, "startState").mockReturnValue({
      ...actual,
      pack: "rhyme",
      phase: "gap",
      rounds: [
        {
          id: "rhyme-1",
          pack: "rhyme",
          prompt: ["prompt1"],
          reveal: ["reveal1"],
          sfx: "good",
          gapMs: 1000,
        },
      ],
      roundIdx: 0,
    });

    const { unmount } = render(<CarModeGame onHome={() => {}} lang="en" />);

    unmount();

    // Fast-forward through all timers.
    vi.runAllTimers();

    expect(toRevealSpy).not.toHaveBeenCalled();
  });
});
