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
  within,
} from "@testing-library/react";
import * as sound from "../../../sound";
import { t } from "../../../i18n";
import { CountGame } from "../CountGame";
import * as countLogic from "../logic";
import {
  PROMPTS,
  STAGE_PADDING,
  applyPickAnswer,
  critterLabel,
  gridFor,
  makeCountRound,
  stageCritterSize,
} from "../logic";
import { CURRICULUM } from "../../../curriculum/content";
import { Lang } from "../../../lang";
import { makeRng } from "../../../rng";

const capturedPressables: Record<
  string,
  { onPress?: () => void; accessibilityLabel?: string }
> = {};

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
        capturedPressables[testID] = props as {
          onPress?: () => void;
          accessibilityLabel?: string;
        };
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

    cleanup();
    saySpy.mockClear();
    render(<CountGame onHome={noop} difficulty="easy" lang="cmn" />);
    expect(saySpy).toHaveBeenCalledWith("点每个小伙伴，然后告诉我一共几个");

    cleanup();
    saySpy.mockClear();
    render(<CountGame onHome={noop} difficulty="easy" lang="yue" />);
    expect(saySpy).toHaveBeenCalledWith("撳每個朋友仔，然後話俾我聽有幾多個");
  });

  it("renders critters with localized accessibilityLabel following lang across all languages", () => {
    const langs: Lang[] = ["en", "ja", "cmn", "yue"];
    for (const lang of langs) {
      render(<CountGame onHome={noop} difficulty="easy" lang={lang} />);
      const stages = screen.getAllByTestId(/count-stage-/);
      const stage = stages[stages.length - 1];
      const match = stage
        .getAttribute("data-testid")!
        .match(/^count-stage-(.+)-(\d+)$/);
      expect(match).not.toBeNull();
      const [, icon, countStr] = match!;
      const count = Number(countStr);
      const expectedLabel = critterLabel(icon, lang);

      for (let i = 0; i < count; i++) {
        const critter = screen.getByTestId(`count-critter-${i}`);
        expect(critter.getAttribute("aria-label")).toBe(expectedLabel);
        expect(
          capturedPressables[`count-critter-${i}`]?.accessibilityLabel,
        ).toBe(expectedLabel);
      }
      cleanup();
    }
  });

  it("updates critter accessibilityLabel immediately when language switches mid-round", () => {
    const { rerender } = render(
      <CountGame onHome={noop} difficulty="easy" lang="en" />,
    );
    const stages = screen.getAllByTestId(/count-stage-/);
    const stage = stages[stages.length - 1];
    const match = stage
      .getAttribute("data-testid")!
      .match(/^count-stage-(.+)-(\d+)$/);
    expect(match).not.toBeNull();
    const [, icon] = match!;

    const critter0 = screen.getByTestId("count-critter-0");
    expect(critter0.getAttribute("aria-label")).toBe(critterLabel(icon, "en"));

    rerender(<CountGame onHome={noop} difficulty="easy" lang="ja" />);

    const critter0Ja = screen.getByTestId("count-critter-0");
    expect(critter0Ja.getAttribute("aria-label")).toBe(
      critterLabel(icon, "ja"),
    );
    expect(capturedPressables["count-critter-0"]?.accessibilityLabel).toBe(
      critterLabel(icon, "ja"),
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
      clearTimeouts: vi.fn(),
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
      setWon: vi.fn(),
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

  it("does not trigger won state until sayThen completes on the winning round", () => {
    let score = 4;
    const setScore = vi.fn((s: number) => {
      score = s;
    });
    const setWon = vi.fn();
    let queuedCb: (() => void) | undefined;
    const sayThenSpy = vi.fn((lines: string[], cb: () => void) => {
      queuedCb = cb;
    });

    const state = {
      won: false,
      phase: "quiz",
      locked: false,
      get score() {
        return score;
      },
      round: dummyRound,
      roundsToWin: 5,
      lang: "en" as const,
    };

    const deps = {
      sfx: { good: vi.fn(), wrong: vi.fn() },
      say: vi.fn(),
      sayThen: sayThenSpy,
      clearTimeouts: vi.fn(),
      setTimeout: vi.fn(),
      makeNextRound: vi.fn(() => dummyRound),
      setScore,
      setLocked: vi.fn(),
      setRound: vi.fn(),
      setRoundNo: vi.fn(),
      setTapped: vi.fn(),
      setPhase: vi.fn(),
      setWrongPick: vi.fn(),
      setWon,
    };

    applyPickAnswer(dummyRound.answer, state, deps);
    // Score updates immediately for visual feedback
    expect(setScore).toHaveBeenCalledWith(5);
    // But won is not triggered yet
    expect(setWon).not.toHaveBeenCalled();

    if (queuedCb) queuedCb();
    // Won is triggered after sayThen finishes
    expect(setWon).toHaveBeenCalledWith(true);
    expect(deps.setRound).not.toHaveBeenCalled();
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
      clearTimeouts: vi.fn(),
      setTimeout: vi.fn(() => setTimeout(() => {}, 0)),
      makeNextRound: vi.fn(),
      setScore: vi.fn(),
      setLocked: vi.fn(),
      setRound: vi.fn(),
      setRoundNo: vi.fn(),
      setTapped: vi.fn(),
      setPhase: vi.fn(),
      setWrongPick,
      setWon: vi.fn(),
    };

    applyPickAnswer(dummyRound.answer + 1, state, deps);
    expect(sfxSpy.wrong).toHaveBeenCalledTimes(1);
    expect(setWrongPick).toHaveBeenCalledWith(dummyRound.answer + 1);
  });

  it("clears pending timeouts and resets wrong pick when correct answer is picked", () => {
    const clearTimeouts = vi.fn();
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
      sfx: { good: vi.fn(), wrong: vi.fn() },
      say: vi.fn(),
      sayThen: vi.fn(),
      clearTimeouts,
      setTimeout: vi.fn(),
      makeNextRound: vi.fn(() => dummyRound),
      setScore: vi.fn(),
      setLocked: vi.fn(),
      setRound: vi.fn(),
      setRoundNo: vi.fn(),
      setTapped: vi.fn(),
      setPhase: vi.fn(),
      setWrongPick,
      setWon: vi.fn(),
    };

    applyPickAnswer(dummyRound.answer, state, deps);
    expect(clearTimeouts).toHaveBeenCalledTimes(1);
    expect(setWrongPick).toHaveBeenCalledWith(null);
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

  it("does not trigger win line or victory overlay until celebration finishes on final round", () => {
    const saySpy = vi.spyOn(sound, "say");
    render(<CountGame onHome={() => {}} difficulty="easy" lang="en" />);

    for (let round = 1; round <= 5; round++) {
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

      if (round < 5) {
        const advance = sayThenDoneCallbacks.pop()!;
        act(() => {
          advance();
        });
      }
    }

    // On final round: score updates immediately for visual feedback (R3)
    expect(screen.getByTestId("count-score").textContent).toBe("🔢 5/5");

    // But celebration audio is in flight, win line and overlay must not have triggered yet
    expect(saySpy).not.toHaveBeenCalledWith(t("en", "win.count"));
    expect(screen.queryByTestId("win-overlay")).toBeNull();
    expect(screen.queryByText(t("en", "win.count"))).toBeNull();

    // Finish celebration speech
    expect(sayThenDoneCallbacks).toHaveLength(1);
    const finishFinalCelebration = sayThenDoneCallbacks.pop()!;
    act(() => {
      finishFinalCelebration();
    });

    // Victory screen and speech only trigger after celebration completes
    expect(screen.getByTestId("count-score").textContent).toBe("🔢 5/5");
    expect(saySpy).toHaveBeenCalledWith(t("en", "win.count"));
    expect(screen.getByTestId("win-overlay")).toBeDefined();
    expect(screen.getByText(t("en", "win.count"))).toBeDefined();
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

  it("sizes critters for 9 and 10 items so three rows never vertically overlap", () => {
    // Landscape stage (844x390 viewport => stageW=560, stageH=126)
    const stageW = 560;
    const stageH = 126;
    const innerH = stageH - 2 * STAGE_PADDING; // 94px
    for (const n of [9, 10]) {
      const { rows } = gridFor(n);
      expect(rows).toBe(3);
      const size = stageCritterSize(n, stageW, stageH);

      // Three rows of critters must fit within the inner usable height
      expect(rows * size).toBeLessThanOrEqual(innerH);
      expect(size).toBeGreaterThanOrEqual(30);
      expect(size).toBeLessThanOrEqual(72);
    }
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

  it("clamps stage height to minimum floor on short viewports to prevent negative dimensions", () => {
    Object.defineProperty(document.documentElement, "clientWidth", {
      value: 600,
      configurable: true,
    });
    Object.defineProperty(document.documentElement, "clientHeight", {
      value: 240,
      configurable: true,
    });
    window.dispatchEvent(new Event("resize"));

    vi.spyOn(countLogic, "makeCountRound").mockReturnValue({
      icon: "star",
      n: 1,
      positions: [{ x: 50, y: 50 }],
      choices: [1, 2, 3],
      answer: 1,
    });

    render(<CountGame onHome={() => {}} difficulty="easy" lang="en" />);

    const stage = screen.getByTestId("count-stage-star-1");
    const stageH = parseFloat(stage.style.height);
    expect(stageH).toBeGreaterThanOrEqual(120);
    expect(stageH).toBe(120);
  });
});

describe("critterLabel", () => {
  it("returns localized critter name across all supported languages", () => {
    expect(critterLabel("dog", "en")).toBe("dog");
    expect(critterLabel("dog", "ja")).toBe("いぬ");
    expect(critterLabel("dog", "cmn")).toBe("狗");
    expect(critterLabel("dog", "yue")).toBe("狗");
    expect(critterLabel("butterfly", "en")).toBe("butterfly");
    expect(critterLabel("butterfly", "ja")).toBe("ちょうちょ");
    expect(critterLabel("butterfly", "cmn")).toBe("蝴蝶");
    expect(critterLabel("butterfly", "yue")).toBe("蝴蝶");
  });

  it("covers all CURRICULUM.critters in WORDS for every supported language", () => {
    const langs: Lang[] = ["en", "ja", "cmn", "yue"];
    for (const icon of CURRICULUM.critters) {
      for (const lang of langs) {
        const label = critterLabel(icon, lang);
        expect(label).toBeTruthy();
      }
    }
  });

  it("fails loudly when an unknown critter icon is requested", () => {
    expect(() => critterLabel("unknown_critter", "en")).toThrow(
      "Unknown critter icon: unknown_critter",
    );
  });
});

describe("CountGame language switch mid-quiz", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.runOnlyPendingTimers();
    vi.useRealTimers();
    cleanup();
  });

  it("cancels pending wrong-pick timeout on language switch so stale prompt does not speak", () => {
    const saySpy = vi.spyOn(sound, "say").mockImplementation(() => {});
    vi.spyOn(sound.sfx, "tap").mockImplementation(() => {});
    vi.spyOn(sound.sfx, "wrong").mockImplementation(() => {});
    vi.spyOn(sound, "sayThen").mockImplementation((_texts, done) => {
      done?.();
    });

    const { rerender } = render(
      <CountGame onHome={() => {}} difficulty="easy" lang="en" />,
    );

    // Tap all critters to enter the quiz phase.
    const stages = screen.getAllByTestId(/count-stage-/);
    const stage = stages[stages.length - 1];
    const n = Number(stage.getAttribute("data-testid")!.split("-").pop());
    for (let i = 0; i < n; i++) {
      fireEvent.click(screen.getByTestId(`count-critter-${i}`));
    }

    // Quiz phase is now active. Verify the initial English prompt.
    const promptCard = screen.getByTestId("count-prompt");
    expect(
      within(promptCard).getByText(t("en", "shell.count.prompt")),
    ).toBeDefined();
    expect(saySpy).toHaveBeenCalledWith(PROMPTS.en);

    // Find and tap a wrong answer choice.
    const buttons = screen.getAllByRole("button");
    const wrongChoice = buttons.find((b) => {
      const tid = b.getAttribute("data-testid");
      return tid && tid.startsWith("count-choice-") && !tid.endsWith("-answer");
    });
    expect(wrongChoice).toBeDefined();

    saySpy.mockClear();
    fireEvent.click(wrongChoice!);
    const wrongTid = wrongChoice!.getAttribute("data-testid")!;
    const getWrongStyles = () => {
      const p = capturedPressables[wrongTid] as {
        style?: (s: { pressed: boolean }) => unknown[];
      };
      return typeof p?.style === "function" ? p.style({ pressed: false }) : [];
    };
    expect(getWrongStyles()).toContainEqual(
      expect.objectContaining({ borderColor: "#E8564F" }),
    );

    // Immediately switch language to Japanese before the 500ms timeout expires.
    act(() => {
      rerender(<CountGame onHome={() => {}} difficulty="easy" lang="ja" />);
    });

    // Wrong pick visual state is immediately cleared on language switch.
    expect(getWrongStyles()).not.toContainEqual(
      expect.objectContaining({ borderColor: "#E8564F" }),
    );

    // Spoken prompt and display text should immediately reflect Japanese.
    expect(saySpy).toHaveBeenCalledWith(PROMPTS.ja);
    const promptCardJa = screen.getByTestId("count-prompt");
    expect(
      within(promptCardJa).getByText(t("ja", "shell.count.prompt")),
    ).toBeDefined();
    expect(screen.getByTestId("count-score").textContent).toBe("🔢 0/5");

    saySpy.mockClear();

    // Advance past the 500ms wrong-pick timeout.
    act(() => {
      vi.advanceTimersByTime(1000);
    });

    // The stale English prompt must NOT be spoken.
    expect(saySpy).not.toHaveBeenCalledWith(PROMPTS.en);
    expect(saySpy).not.toHaveBeenCalled();
    expect(
      within(promptCardJa).getByText(t("ja", "shell.count.prompt")),
    ).toBeDefined();
  });
});

describe("CountGame affordances, prompt replay and ordinal badges", () => {
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

  it("places sequential ordinal number badges on critters in tap order", () => {
    render(<CountGame onHome={() => {}} difficulty="easy" lang="en" />);

    const stages = screen.getAllByTestId(/count-stage-/);
    const stage = stages[stages.length - 1];
    const n = Number(stage.getAttribute("data-testid")!.split("-").pop());
    expect(n).toBeGreaterThanOrEqual(1);

    // Initially no critters have badges
    for (let i = 0; i < n; i++) {
      expect(screen.queryByTestId(`count-badge-${i}`)).toBeNull();
    }

    // Tap critter 0 first -> gets ordinal badge "1"
    fireEvent.click(screen.getByTestId("count-critter-0"));
    const badge0 = screen.getByTestId("count-badge-0");
    expect(badge0).toBeDefined();
    expect(badge0.textContent).toBe("1");

    // If there is more than 1 critter, tap critter 1 second -> gets ordinal badge "2"
    if (n > 1) {
      fireEvent.click(screen.getByTestId("count-critter-1"));
      const badge1 = screen.getByTestId("count-badge-1");
      expect(badge1).toBeDefined();
      expect(badge1.textContent).toBe("2");
      // Critter 0 badge remains "1"
      expect(screen.getByTestId("count-badge-0").textContent).toBe("1");
    }

    // Tapping critter 0 again does not change its badge or tap count
    fireEvent.click(screen.getByTestId("count-critter-0-tapped"));
    expect(screen.getByTestId("count-badge-0").textContent).toBe("1");

    // Tap remaining critters
    for (let i = 2; i < n; i++) {
      fireEvent.click(screen.getByTestId(`count-critter-${i}`));
      expect(screen.getByTestId(`count-badge-${i}`).textContent).toBe(
        String(i + 1),
      );
    }

    // Complete speech transition to quiz
    const finishSpeech = sayThenDoneCallbacks.pop();
    if (finishSpeech) {
      act(() => {
        finishSpeech();
      });
    }

    // In quiz phase, all ordinal badges remain on stage for cardinality confirmation
    for (let i = 0; i < n; i++) {
      expect(screen.getByTestId(`count-badge-${i}`)).toBeDefined();
      expect(screen.getByTestId(`count-badge-${i}`).textContent).toBe(
        String(i + 1),
      );
    }
  });

  it("makes promptCard an accessible button displaying spell.hearAgain and replays audio on tap", () => {
    const saySpy = vi.spyOn(sound, "say");
    render(<CountGame onHome={() => {}} difficulty="easy" lang="en" />);

    const stages = screen.getAllByTestId(/count-stage-/);
    const stage = stages[stages.length - 1];
    const n = Number(stage.getAttribute("data-testid")!.split("-").pop());
    for (let i = 0; i < n; i++) {
      fireEvent.click(screen.getByTestId(`count-critter-${i}`));
    }

    const finishSpeech = sayThenDoneCallbacks.pop()!;
    act(() => {
      finishSpeech();
    });

    const promptCard = screen.getByTestId("count-prompt");
    expect(promptCard.getAttribute("role")).toBe("button");
    expect(
      within(promptCard).getByText(t("en", "shell.count.prompt")),
    ).toBeDefined();
    expect(screen.getByText(t("en", "spell.hearAgain"))).toBeDefined();

    saySpy.mockClear();
    fireEvent.click(promptCard);
    expect(saySpy).toHaveBeenCalledWith(PROMPTS.en);
    expect(saySpy).toHaveBeenCalledTimes(1);

    fireEvent.click(promptCard);
    expect(saySpy).toHaveBeenCalledTimes(2);
  });

  it("shows spell.hearAgain in other languages and replays localized prompt", () => {
    const saySpy = vi.spyOn(sound, "say");
    render(<CountGame onHome={() => {}} difficulty="easy" lang="ja" />);

    const stages = screen.getAllByTestId(/count-stage-/);
    const stage = stages[stages.length - 1];
    const n = Number(stage.getAttribute("data-testid")!.split("-").pop());
    for (let i = 0; i < n; i++) {
      fireEvent.click(screen.getByTestId(`count-critter-${i}`));
    }

    const finishSpeech = sayThenDoneCallbacks.pop()!;
    act(() => {
      finishSpeech();
    });

    const promptCard = screen.getByTestId("count-prompt");
    expect(
      within(promptCard).getByText(t("ja", "shell.count.prompt")),
    ).toBeDefined();
    expect(screen.getByText(t("ja", "spell.hearAgain"))).toBeDefined();

    saySpy.mockClear();
    fireEvent.click(promptCard);
    expect(saySpy).toHaveBeenCalledWith(PROMPTS.ja);
  });

  it("highlights winning choice with choiceCorrect during praise audio and guards prompt replay while locked", () => {
    const saySpy = vi.spyOn(sound, "say");
    render(<CountGame onHome={() => {}} difficulty="easy" lang="en" />);

    const stages = screen.getAllByTestId(/count-stage-/);
    const stage = stages[stages.length - 1];
    const n = Number(stage.getAttribute("data-testid")!.split("-").pop());
    for (let i = 0; i < n; i++) {
      fireEvent.click(screen.getByTestId(`count-critter-${i}`));
    }

    const finishSpeech = sayThenDoneCallbacks.pop()!;
    act(() => {
      finishSpeech();
    });

    const answerChoices = screen.getAllByTestId(/count-choice-.*-answer/);
    const answerChoice = answerChoices[answerChoices.length - 1];
    const answerTid = answerChoice.getAttribute("data-testid")!;

    const getAnswerStyles = () => {
      const p = capturedPressables[answerTid] as {
        style?: (s: { pressed: boolean }) => unknown[];
      };
      return typeof p?.style === "function" ? p.style({ pressed: false }) : [];
    };

    // Before picking answer, winning button does not have choiceCorrect
    expect(getAnswerStyles()).not.toContainEqual(
      expect.objectContaining({ borderColor: "#5FBF6E" }),
    );

    // Pick the correct answer
    fireEvent.click(answerChoice);

    // During praise audio (locked), winning button receives green choiceCorrect style
    expect(getAnswerStyles()).toContainEqual(
      expect.objectContaining({
        borderColor: "#5FBF6E",
        backgroundColor: "rgba(95,191,110,0.14)",
      }),
    );

    // Prompt tap is guarded during locked celebration
    saySpy.mockClear();
    fireEvent.click(screen.getByTestId("count-prompt"));
    expect(saySpy).not.toHaveBeenCalled();

    // Finish celebration audio and advance to round 2
    const advanceRound = sayThenDoneCallbacks.pop()!;
    act(() => {
      advanceRound();
    });

    // In round 2, back to count phase
    expect(screen.getByTestId("count-progress")).toBeDefined();
  });
});
