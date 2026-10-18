// @vitest-environment happy-dom
import React from "react";
import { renderToString } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, fireEvent, screen, act } from "@testing-library/react";
import * as sound from "../../../sound";
import { CountGame } from "../CountGame";
import { PickDeps, PickState, applyPickAnswer, makeCountRound } from "../logic";
import { makeRng } from "../../../rng";

const capturedPressables: Record<string, { onPress?: () => void }> = {};

vi.mock("react-native", async (importOriginal) => {
  const actual = await importOriginal<Record<string, unknown>>();
  const ActualPressable = actual.Pressable as React.ComponentType<
    Record<string, unknown>
  >;
  return {
    ...actual,
    Pressable: (props: Record<string, unknown>) => {
      const testID =
        typeof props.testID === "string" ? props.testID : undefined;
      if (testID) {
        capturedPressables[testID] = props as { onPress?: () => void };
      }
      return React.createElement(ActualPressable, props);
    },
    Modal: (props: Record<string, unknown>) =>
      React.createElement(
        "div",
        { "data-testid": "mock-modal" },
        props.children as React.ReactNode,
      ),
  };
});

describe("CountGame", () => {
  const noop = () => {};

  beforeEach(() => {
    for (const key of Object.keys(capturedPressables)) {
      delete capturedPressables[key];
    }
    vi.restoreAllMocks();
  });

  it("ignores duplicate taps on the same critter and accumulates concurrent taps across different critters", () => {
    const sfxSpy = vi.spyOn(sound.sfx, "tap").mockReturnValue();
    const saySpy = vi.spyOn(sound, "say").mockReturnValue();

    renderToString(<CountGame onHome={noop} difficulty="medium" lang="en" />);

    const critter0 = capturedPressables["count-critter-0"];
    const critter1 = capturedPressables["count-critter-1"];
    expect(critter0).toBeDefined();
    expect(critter1).toBeDefined();

    // First tap on critter 0: registers "one"
    critter0.onPress?.();
    expect(sfxSpy).toHaveBeenCalledTimes(1);
    expect(saySpy).toHaveBeenCalledTimes(1);
    expect(saySpy).toHaveBeenNthCalledWith(1, "one");

    // Duplicate tap on critter 0 before re-rendering: ignored
    critter0.onPress?.();
    expect(sfxSpy).toHaveBeenCalledTimes(1);
    expect(saySpy).toHaveBeenCalledTimes(1);

    // Rapid concurrent tap on critter 1 before re-rendering: registers "two"
    critter1.onPress?.();
    expect(sfxSpy).toHaveBeenCalledTimes(2);
    expect(saySpy).toHaveBeenCalledTimes(2);
    expect(saySpy).toHaveBeenNthCalledWith(2, "two");
  });

  it("triggers quiz phase transition on the final concurrent tap", () => {
    vi.spyOn(sound.sfx, "tap").mockReturnValue();
    vi.spyOn(sound, "say").mockReturnValue();
    const sayThenSpy = vi.spyOn(sound, "sayThen").mockReturnValue();

    renderToString(<CountGame onHome={noop} difficulty="easy" lang="en" />);

    const critterKeys = Object.keys(capturedPressables).filter((k) =>
      /^count-critter-\d+$/.test(k),
    );
    expect(critterKeys.length).toBeGreaterThan(0);

    // Tap all critters rapidly without re-rendering
    for (const key of critterKeys) {
      capturedPressables[key].onPress?.();
    }

    // The final tap completes the count round and calls sayThen to switch to quiz
    expect(sayThenSpy).toHaveBeenCalledOnce();
  });
});

describe("logic: applyPickAnswer", () => {
  const dummyRound = makeCountRound(makeRng(1), "easy");

  it("rapid clicks on the correct answer only bump the score and queue sayThen once", () => {
    let locked = false;
    let score = 0;
    const setLocked = vi.fn((l: boolean) => {
      locked = l;
    });
    const setScore = vi.fn((s: number) => {
      score = s;
    });
    let queuedCb: (() => void) | undefined;
    const sayThenSpy = vi.fn((lines: string[], cb: () => void) => {
      queuedCb = cb;
    });
    const sfxSpy = { good: vi.fn(), wrong: vi.fn() };

    const state = {
      won: false,
      phase: "quiz",
      get locked() {
        return locked;
      },
      get score() {
        return score;
      },
      round: dummyRound,
      roundsToWin: 5,
      lang: "en" as const,
    };

    const deps = {
      sfx: sfxSpy,
      say: vi.fn(),
      sayThen: sayThenSpy,
      setTimeout: vi.fn((fn: () => void) => {
        fn();
        return setTimeout(() => {}, 0);
      }),
      makeNextRound: vi.fn(() => dummyRound),
      setScore,
      setWon: vi.fn(),
      setLocked,
      setRound: vi.fn(),
      setTapped: vi.fn(),
      setPhase: vi.fn(),
      setWrongPick: vi.fn(),
    };

    // First click (valid)
    applyPickAnswer(dummyRound.answer, state, deps);
    expect(setLocked).toHaveBeenCalledWith(true);
    expect(setScore).toHaveBeenCalledWith(1);
    expect(sfxSpy.good).toHaveBeenCalledTimes(1);
    expect(sayThenSpy).toHaveBeenCalledTimes(1);

    // Second rapid click (ignored because locked is true)
    applyPickAnswer(dummyRound.answer, state, deps);
    expect(setScore).toHaveBeenCalledTimes(1); // Still 1
    expect(sfxSpy.good).toHaveBeenCalledTimes(1); // Still 1
    expect(sayThenSpy).toHaveBeenCalledTimes(1); // Still 1

    // Now complete the audio playback
    if (queuedCb) queuedCb();
    expect(setLocked).toHaveBeenLastCalledWith(false);
    expect(deps.setRound).toHaveBeenCalledTimes(1);
    expect(deps.setPhase).toHaveBeenCalledWith("count");
  });

  it("handles wrong answers by playing sfx and setting wrong pick", () => {
    const sfxSpy = { good: vi.fn(), wrong: vi.fn() };
    const setWrongPick = vi.fn();
    const state = {
      won: false,
      phase: "quiz",
      locked: false,
      score: 0,
      round: dummyRound,
      roundsToWin: 5,
      lang: "en" as const,
    };
    const deps = {
      sfx: sfxSpy,
      say: vi.fn(),
      sayThen: vi.fn(),
      setTimeout: vi.fn(() => setTimeout(() => {}, 0)),
      makeNextRound: vi.fn(),
      setScore: vi.fn(),
      setWon: vi.fn(),
      setLocked: vi.fn(),
      setRound: vi.fn(),
      setTapped: vi.fn(),
      setPhase: vi.fn(),
      setWrongPick,
    };

    applyPickAnswer(dummyRound.answer + 1, state, deps);
    expect(sfxSpy.wrong).toHaveBeenCalledTimes(1);
    expect(setWrongPick).toHaveBeenCalledWith(dummyRound.answer + 1);
  });

  it("defers win state on the winning round until audio playback completes", () => {
    let locked = false;
    let score = 4;
    const setLocked = vi.fn((l: boolean) => {
      locked = l;
    });
    const setScore = vi.fn((s: number) => {
      score = s;
    });
    const setWon = vi.fn();
    let queuedCb: (() => void) | undefined;
    const sayThenSpy = vi.fn((_lines: string[], cb: () => void) => {
      queuedCb = cb;
    });
    const sfxSpy = { good: vi.fn(), wrong: vi.fn() };
    const makeNextRoundSpy = vi.fn(() => dummyRound);
    const setRoundSpy = vi.fn();
    const setPhaseSpy = vi.fn();

    const state: PickState = {
      won: false,
      phase: "quiz",
      get locked() {
        return locked;
      },
      get score() {
        return score;
      },
      round: dummyRound,
      roundsToWin: 5,
      lang: "en",
    };

    const deps: PickDeps = {
      sfx: sfxSpy,
      say: vi.fn(),
      sayThen: sayThenSpy,
      setTimeout: vi.fn((fn: () => void) => {
        fn();
        return setTimeout(() => {}, 0);
      }),
      makeNextRound: makeNextRoundSpy,
      setScore,
      setWon,
      setLocked,
      setRound: setRoundSpy,
      setTapped: vi.fn(),
      setPhase: setPhaseSpy,
      setWrongPick: vi.fn(),
    };

    applyPickAnswer(dummyRound.answer, state, deps);

    expect(setLocked).toHaveBeenCalledWith(true);
    expect(sfxSpy.good).toHaveBeenCalledTimes(1);
    expect(sayThenSpy).toHaveBeenCalledTimes(1);
    // Score updates immediately for visual feedback
    expect(setScore).toHaveBeenCalledWith(5);
    // Win state transition is deferred so praise audio is not cut off
    expect(setWon).not.toHaveBeenCalled();

    // Now audio completes
    expect(queuedCb).toBeDefined();
    queuedCb!();

    expect(setWon).toHaveBeenCalledWith(true);
    expect(setLocked).toHaveBeenLastCalledWith(false);
    expect(makeNextRoundSpy).not.toHaveBeenCalled();
    expect(setRoundSpy).not.toHaveBeenCalled();
    expect(setPhaseSpy).not.toHaveBeenCalled();
  });
});

describe("CountGame double-tap lock", () => {
  let sayThenDoneCallbacks: Array<() => void> = [];

  beforeEach(() => {
    sayThenDoneCallbacks = [];
    vi.restoreAllMocks();
    vi.spyOn(sound, "sayThen").mockImplementation((_texts, done) => {
      if (done) sayThenDoneCallbacks.push(done);
    });
    vi.spyOn(sound, "say").mockImplementation(() => {});
    vi.spyOn(sound.sfx, "tap").mockImplementation(() => {});
  });

  it("double-tap on correct answer only scores once and does not skip round", () => {
    render(<CountGame onHome={() => {}} difficulty="easy" lang="en" />);

    expect(screen.getByTestId("count-score").textContent).toBe("🔢 0/5");

    const stages = screen.getAllByTestId(/count-stage-/);
    const stage = stages[stages.length - 1];
    const testId = stage.getAttribute("data-testid");
    const n = Number(testId!.split("-").pop());

    for (let i = 0; i < n; i++) {
      fireEvent.click(screen.getByTestId(`count-critter-${i}`));
    }

    const finishCountSpeech = sayThenDoneCallbacks.pop()!;
    act(() => {
      finishCountSpeech();
    });

    const answerChoices = screen.getAllByTestId(/count-choice-.*-answer/);
    const answerChoice = answerChoices[answerChoices.length - 1];
    fireEvent.click(answerChoice);

    expect(screen.getByTestId("count-score").textContent).toBe("🔢 1/5");

    fireEvent.click(answerChoice);
    expect(screen.getByTestId("count-score").textContent).toBe("🔢 1/5");

    expect(sayThenDoneCallbacks).toHaveLength(1);
    const advanceRound = sayThenDoneCallbacks.pop()!;
    act(() => {
      advanceRound();
    });

    expect(screen.getByTestId("count-progress")).toBeDefined();
  });

  it("shows final score immediately and defers win overlay until speech completes", () => {
    vi.useFakeTimers();
    render(<CountGame onHome={() => {}} difficulty="easy" lang="en" />);

    for (let roundIdx = 0; roundIdx < 5; roundIdx++) {
      const stages = screen.getAllByTestId(/count-stage-/);
      const stage = stages[stages.length - 1];
      const testId = stage.getAttribute("data-testid");
      const n = Number(testId!.split("-").pop());

      for (let i = 0; i < n; i++) {
        const critters = screen.getAllByTestId(
          new RegExp(`^count-critter-${i}$`),
        );
        fireEvent.click(critters[critters.length - 1]);
      }

      const finishCountSpeech = sayThenDoneCallbacks.pop()!;
      act(() => {
        finishCountSpeech();
      });

      const answerChoices = screen.getAllByTestId(/count-choice-.*-answer/);
      const answerChoice = answerChoices[answerChoices.length - 1];
      fireEvent.click(answerChoice);

      if (roundIdx === 4) {
        // Final round: score chip updates immediately for visual feedback
        const scoreChips = screen.getAllByTestId("count-score");
        expect(scoreChips[scoreChips.length - 1].textContent).toBe("🔢 5/5");
        // Win overlay has not appeared yet while speech plays
        expect(screen.queryByTestId("win-overlay")).toBeNull();

        // Audio finishes
        expect(sayThenDoneCallbacks).toHaveLength(1);
        const finishPraiseSpeech = sayThenDoneCallbacks.pop()!;
        act(() => {
          finishPraiseSpeech();
        });

        // Now win overlay is visible
        expect(screen.getByTestId("win-overlay")).toBeDefined();

        // Arm the overlay buttons
        act(() => {
          vi.advanceTimersByTime(700);
        });

        // Click play again to reset
        fireEvent.click(screen.getByTestId("play-again"));
        const resetScoreChips = screen.getAllByTestId("count-score");
        expect(resetScoreChips[resetScoreChips.length - 1].textContent).toBe(
          "🔢 0/5",
        );
        expect(screen.queryByTestId("win-overlay")).toBeNull();
      } else {
        const scoreChips = screen.getAllByTestId("count-score");
        expect(scoreChips[scoreChips.length - 1].textContent).toBe(
          `🔢 ${roundIdx + 1}/5`,
        );
        const advanceRound = sayThenDoneCallbacks.pop()!;
        act(() => {
          advanceRound();
        });
      }
    }
    vi.useRealTimers();
  });
});
