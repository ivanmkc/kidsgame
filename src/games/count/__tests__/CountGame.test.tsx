// @vitest-environment happy-dom
import React from "react";
import { Animated } from "react-native";
import { renderToString } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  render,
  fireEvent,
  screen,
  act,
  cleanup,
} from "@testing-library/react";
import * as sound from "../../../sound";
import { CountGame } from "../CountGame";
import * as countLogic from "../logic";
import {
  STAGE_PADDING,
  applyPickAnswer,
  makeCountRound,
  stageCritterSize,
} from "../logic";
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

afterEach(() => {
  cleanup();
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

  it("speaks instructional prompt upon round start in count phase", () => {
    const saySpy = vi.spyOn(sound, "say").mockImplementation(() => {});

    render(<CountGame onHome={noop} difficulty="easy" lang="en" />);

    expect(saySpy).toHaveBeenCalledWith(
      "Tap every friend, then tell me how many",
    );
  });

  it("speaks localized instructional prompt upon round start in other languages", () => {
    const saySpy = vi.spyOn(sound, "say").mockImplementation(() => {});

    render(<CountGame onHome={noop} difficulty="easy" lang="ja" />);

    expect(saySpy).toHaveBeenCalledWith(
      "みんなを タップして いくつか おしえて",
    );
  });

  it("speaks instructional prompt again upon advancing to next round", () => {
    const saySpy = vi.spyOn(sound, "say").mockImplementation(() => {});
    let sayThenDone: (() => void) | undefined;
    vi.spyOn(sound, "sayThen").mockImplementation((_texts, done) => {
      sayThenDone = done;
    });

    render(<CountGame onHome={noop} difficulty="easy" lang="en" />);

    expect(saySpy).toHaveBeenCalledWith(
      "Tap every friend, then tell me how many",
    );
    saySpy.mockClear();

    const stages = screen.getAllByTestId(/count-stage-/);
    const stage = stages[stages.length - 1];
    const n = Number(stage.getAttribute("data-testid")!.split("-").pop());

    for (let i = 0; i < n; i++) {
      fireEvent.click(screen.getByTestId(`count-critter-${i}`));
    }

    act(() => {
      sayThenDone?.();
    });
    expect(saySpy).toHaveBeenCalledWith("How many?");
    saySpy.mockClear();

    const answerChoices = screen.getAllByTestId(/count-choice-.*-answer/);
    fireEvent.click(answerChoices[answerChoices.length - 1]);

    act(() => {
      sayThenDone?.();
    });
    expect(saySpy).toHaveBeenCalledWith(
      "Tap every friend, then tell me how many",
    );
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
      setLocked,
      setRound: vi.fn(),
      setRoundNo: vi.fn(),
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
    expect(deps.setRoundNo).toHaveBeenCalledTimes(1);
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
      setLocked: vi.fn(),
      setRound: vi.fn(),
      setRoundNo: vi.fn(),
      setTapped: vi.fn(),
      setPhase: vi.fn(),
      setWrongPick,
    };

    applyPickAnswer(dummyRound.answer + 1, state, deps);
    expect(sfxSpy.wrong).toHaveBeenCalledTimes(1);
    expect(setWrongPick).toHaveBeenCalledWith(dummyRound.answer + 1);
  });

  it("defers setScore on winning round until sayThen completes", () => {
    let locked = false;
    let score = 4;
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
      setTimeout: vi.fn(),
      makeNextRound: vi.fn(() => dummyRound),
      setScore,
      setLocked,
      setRound: vi.fn(),
      setRoundNo: vi.fn(),
      setTapped: vi.fn(),
      setPhase: vi.fn(),
      setWrongPick: vi.fn(),
    };

    applyPickAnswer(dummyRound.answer, state, deps);
    expect(setLocked).toHaveBeenCalledWith(true);
    expect(sfxSpy.good).toHaveBeenCalledTimes(1);
    expect(sayThenSpy).toHaveBeenCalledTimes(1);
    // Score must not be incremented yet on winning round to avoid premature win overlay
    expect(setScore).not.toHaveBeenCalled();

    // After praise speech completes, score is incremented to trigger win
    if (queuedCb) queuedCb();
    expect(setScore).toHaveBeenCalledWith(5);
    expect(setLocked).toHaveBeenLastCalledWith(false);
    expect(deps.setRound).not.toHaveBeenCalled();
  });

  it("cancels wrongTimer and sets it to null when correct answer is picked", () => {
    const wrongTimer = {
      current: 123 as unknown as ReturnType<typeof setTimeout>,
    };
    const clearTimeoutSpy = vi.fn();
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
      sfx: { good: vi.fn(), wrong: vi.fn() },
      say: vi.fn(),
      sayThen: vi.fn(),
      setTimeout: vi.fn(),
      clearTimeout: clearTimeoutSpy,
      makeNextRound: vi.fn(() => dummyRound),
      setScore: vi.fn(),
      setLocked: vi.fn(),
      setRound: vi.fn(),
      setRoundNo: vi.fn(),
      setTapped: vi.fn(),
      setPhase: vi.fn(),
      setWrongPick: vi.fn(),
      wrongTimer,
    };

    applyPickAnswer(dummyRound.answer, state, deps);
    expect(clearTimeoutSpy).toHaveBeenCalledWith(123);
    expect(wrongTimer.current).toBeNull();
  });

  it("schedules wrongTimer and clears previous wrongTimer on successive wrong picks", () => {
    const wrongTimer = {
      current: 111 as unknown as ReturnType<typeof setTimeout>,
    };
    const clearTimeoutSpy = vi.fn();
    const fakeTimerId = 222 as unknown as ReturnType<typeof setTimeout>;
    const setTimeoutSpy = vi.fn(() => fakeTimerId);
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
      sfx: { good: vi.fn(), wrong: vi.fn() },
      say: vi.fn(),
      sayThen: vi.fn(),
      setTimeout: setTimeoutSpy,
      clearTimeout: clearTimeoutSpy,
      makeNextRound: vi.fn(),
      setScore: vi.fn(),
      setLocked: vi.fn(),
      setRound: vi.fn(),
      setRoundNo: vi.fn(),
      setTapped: vi.fn(),
      setPhase: vi.fn(),
      setWrongPick: vi.fn(),
      wrongTimer,
    };

    applyPickAnswer(dummyRound.answer + 1, state, deps);
    expect(clearTimeoutSpy).toHaveBeenCalledWith(111);
    expect(wrongTimer.current).toBe(fakeTimerId);
  });
});

describe("CountGame double-tap lock", () => {
  let sayThenDoneCallbacks: Array<() => void> = [];

  beforeEach(() => {
    cleanup();
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

  it("plays pop animation on critter tap in round 1 and round 2 without popping on praise", () => {
    const springSpy = vi.spyOn(Animated, "spring");
    render(<CountGame onHome={() => {}} difficulty="easy" lang="en" />);

    springSpy.mockClear();

    const stages = screen.getAllByTestId(/count-stage-/);
    const stage = stages[stages.length - 1];
    const testId = stage.getAttribute("data-testid");
    const n = Number(testId!.split("-").pop());

    for (let i = 0; i < n; i++) {
      fireEvent.click(screen.getByTestId(`count-critter-${i}`));
    }
    expect(springSpy).toHaveBeenCalledTimes(n);

    const finishCountSpeech = sayThenDoneCallbacks.pop()!;
    act(() => {
      finishCountSpeech();
    });

    const answerChoices = screen.getAllByTestId(/count-choice-.*-answer/);
    const answerChoice = answerChoices[answerChoices.length - 1];
    fireEvent.click(answerChoice);

    // Score changed to 1 (ScoreChip pulses once), but critters must not remount and pop during praise
    expect(springSpy).toHaveBeenCalledTimes(n + 1);

    const advanceRound = sayThenDoneCallbacks.pop()!;
    act(() => {
      advanceRound();
    });

    // In round 2, tapping critter 0 plays its pop animation
    fireEvent.click(screen.getByTestId("count-critter-0"));
    expect(springSpy).toHaveBeenCalledTimes(n + 2);
  });

  it("does not trigger win overlay or win line until praise speech completes on final round", () => {
    vi.spyOn(countLogic, "countSettings").mockReturnValue({
      rounds: 1,
      min: 1,
      max: 5,
    });
    const saySpy = vi.spyOn(sound, "say").mockImplementation(() => {});

    render(<CountGame onHome={() => {}} difficulty="easy" lang="en" />);

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

    // Answer was selected: sayThen is queued for number word and praise.
    // Win overlay and win line speech must NOT have triggered yet.
    expect(screen.queryByTestId("win-overlay")).toBeNull();
    expect(saySpy).not.toHaveBeenCalledWith(
      expect.stringContaining("Amazing counter"),
    );

    // Complete the praise narration.
    expect(sayThenDoneCallbacks).toHaveLength(1);
    const finishPraiseSpeech = sayThenDoneCallbacks.pop()!;
    act(() => {
      finishPraiseSpeech();
    });

    // Now the win overlay appears and the win line is spoken.
    expect(screen.getByTestId("win-overlay")).toBeDefined();
    expect(saySpy).toHaveBeenCalledWith(
      expect.stringContaining("Amazing counter"),
    );
    expect(screen.getByTestId("count-score").textContent).toBe("🔢 1/1");
  });
});

describe("stageCritterSize", () => {
  it("sizes critters from the inner padded area so two rows never vertically overlap", () => {
    // Landscape stage (844x390 viewport => stageW=560, stageH=126)
    const stageW = 560;
    const stageH = 126;
    const innerH = stageH - 2 * STAGE_PADDING; // 94px
    const size = stageCritterSize(4, stageW, stageH);

    // Two rows of critters must fit within the inner usable height
    expect(2 * size).toBeLessThanOrEqual(innerH);
    expect(size).toBeGreaterThanOrEqual(30);
    expect(size).toBeLessThanOrEqual(72);
  });
});

describe("CountGame stage critter positioning", () => {
  it("renders corner critters with stage padding so sprites and check badges stay inside stage bounds", () => {
    Object.defineProperty(document.documentElement, "clientWidth", {
      value: 844,
      configurable: true,
    });
    Object.defineProperty(document.documentElement, "clientHeight", {
      value: 390,
      configurable: true,
    });
    window.dispatchEvent(new Event("resize"));

    vi.spyOn(countLogic, "makeCountRound").mockReturnValue({
      icon: "star",
      n: 1,
      positions: [{ x: 100, y: 0 }],
      choices: [1, 2, 3],
      answer: 1,
    });

    render(<CountGame onHome={() => {}} difficulty="easy" lang="en" />);

    const stage = screen.getByTestId("count-stage-star-1");
    const stageW = parseFloat(stage.style.width);

    const critter = screen.getByTestId("count-critter-0");
    const left = parseFloat(critter.style.left);
    const top = parseFloat(critter.style.top);
    const size = parseFloat(critter.style.width);

    // Corner sprite must be padded away from the stage card top and right edges
    expect(top).toBe(STAGE_PADDING);
    expect(left).toBe(stageW - STAGE_PADDING - size);

    // Tapping renders the checkmark badge at top: -4, right: -4
    fireEvent.click(critter);
    const checkBadgeTop = top - 4;
    const checkBadgeRight = left + size + 4;

    // Both edges must stay inside the stage card boundaries
    expect(checkBadgeTop).toBeGreaterThanOrEqual(0);
    expect(checkBadgeRight).toBeLessThanOrEqual(stageW);

    // Badge circle (diameter 22) must remain inside 24px corner arc (center at stageW - 24, 24)
    const cornerRadius = 24;
    const badgeCenterX = checkBadgeRight - 11;
    const badgeCenterY = checkBadgeTop + 11;
    const badgeMaxDist =
      Math.hypot(
        badgeCenterX - (stageW - cornerRadius),
        badgeCenterY - cornerRadius,
      ) + 11;
    expect(badgeMaxDist).toBeLessThanOrEqual(cornerRadius);
  });
});

describe("CountGame wrong answer timer", () => {
  let sayThenDoneCallbacks: Array<() => void> = [];

  beforeEach(() => {
    cleanup();
    sayThenDoneCallbacks = [];
    vi.restoreAllMocks();
    vi.spyOn(sound, "sayThen").mockImplementation((_texts, done) => {
      if (done) sayThenDoneCallbacks.push(done);
    });
    vi.spyOn(sound, "say").mockImplementation(() => {});
    vi.spyOn(sound.sfx, "tap").mockImplementation(() => {});
    vi.spyOn(sound.sfx, "good").mockImplementation(() => {});
    vi.spyOn(sound.sfx, "wrong").mockImplementation(() => {});
    vi.useFakeTimers();
  });

  afterEach(() => {
    act(() => {
      vi.runOnlyPendingTimers();
    });
    vi.useRealTimers();
    cleanup();
  });

  function completeCountPhase() {
    const stages = screen.getAllByTestId(/count-stage-/);
    const stage = stages[stages.length - 1];
    const n = Number(stage.getAttribute("data-testid")!.split("-").pop());
    for (let i = 0; i < n; i++) {
      fireEvent.click(screen.getByTestId(`count-critter-${i}`));
    }
    const finishCountSpeech = sayThenDoneCallbacks.pop()!;
    act(() => {
      finishCountSpeech();
    });
  }

  it("cancels wrong-answer repeat prompt timer when player taps correct answer choice", () => {
    const saySpy = vi.spyOn(sound, "say");
    render(<CountGame onHome={() => {}} difficulty="easy" lang="en" />);
    completeCountPhase();

    // In quiz phase, prompt "How many?" is spoken
    expect(saySpy).toHaveBeenCalledWith("How many?");
    saySpy.mockClear();

    // Find wrong and correct choices
    const answerChoices = screen.getAllByTestId(/count-choice-/);
    const correctChoice = answerChoices.find((c) =>
      c.getAttribute("data-testid")?.endsWith("-answer"),
    )!;
    const wrongChoice = answerChoices.find(
      (c) => !c.getAttribute("data-testid")?.endsWith("-answer"),
    )!;

    // Tap wrong choice: schedules 500ms prompt timer
    fireEvent.click(wrongChoice);
    expect(sound.sfx.wrong).toHaveBeenCalledTimes(1);

    // Player quickly taps the correct answer after 150ms
    act(() => {
      vi.advanceTimersByTime(150);
    });
    fireEvent.click(correctChoice);
    expect(sound.sfx.good).toHaveBeenCalledTimes(1);
    expect(sound.sayThen).toHaveBeenCalledTimes(2);

    // Advance past 500ms from the initial wrong tap
    act(() => {
      vi.advanceTimersByTime(400);
    });

    // The repeat prompt timer was cancelled, so `say("How many?")` was NOT called again
    expect(saySpy).not.toHaveBeenCalledWith("How many?");
  });

  it("cancels wrong-answer repeat prompt timer on unmount", () => {
    const saySpy = vi.spyOn(sound, "say");
    const { unmount } = render(
      <CountGame onHome={() => {}} difficulty="easy" lang="en" />,
    );
    completeCountPhase();
    saySpy.mockClear();

    const answerChoices = screen.getAllByTestId(/count-choice-/);
    const wrongChoice = answerChoices.find(
      (c) => !c.getAttribute("data-testid")?.endsWith("-answer"),
    )!;

    fireEvent.click(wrongChoice);

    act(() => {
      vi.advanceTimersByTime(150);
    });

    unmount();

    act(() => {
      vi.advanceTimersByTime(400);
    });

    expect(saySpy).not.toHaveBeenCalledWith("How many?");
  });

  it("speaks repeat prompt after 500ms if no correct answer is picked", () => {
    const saySpy = vi.spyOn(sound, "say");
    render(<CountGame onHome={() => {}} difficulty="easy" lang="en" />);
    completeCountPhase();
    saySpy.mockClear();

    const answerChoices = screen.getAllByTestId(/count-choice-/);
    const wrongChoice = answerChoices.find(
      (c) => !c.getAttribute("data-testid")?.endsWith("-answer"),
    )!;

    fireEvent.click(wrongChoice);

    act(() => {
      vi.advanceTimersByTime(500);
    });

    expect(saySpy).toHaveBeenCalledWith("How many?");
  });

  it("cancels wrong-answer repeat prompt timer on reset", () => {
    const saySpy = vi.spyOn(sound, "say");
    render(<CountGame onHome={() => {}} difficulty="easy" lang="en" />);
    completeCountPhase();

    const answerChoices = screen.getAllByTestId(/count-choice-/);
    const correctChoice = answerChoices.find((c) =>
      c.getAttribute("data-testid")?.endsWith("-answer"),
    )!;
    const wrongChoice = answerChoices.find(
      (c) => !c.getAttribute("data-testid")?.endsWith("-answer"),
    )!;

    // Pick wrong then correct
    fireEvent.click(wrongChoice);
    act(() => {
      vi.advanceTimersByTime(100);
    });
    fireEvent.click(correctChoice);

    const finishPraise = sayThenDoneCallbacks.pop()!;
    act(() => {
      finishPraise();
    });

    saySpy.mockClear();
    act(() => {
      vi.advanceTimersByTime(600);
    });

    expect(saySpy).not.toHaveBeenCalledWith("How many?");
  });
});
