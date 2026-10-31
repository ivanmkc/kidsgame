// @vitest-environment happy-dom
import React from "react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  render,
  screen,
  fireEvent,
  act,
  cleanup,
} from "@testing-library/react";
import { SumsGame } from "../SumsGame";
import { SPOTIT_ICONS } from "../../../assets/images";
import * as sound from "../../../sound";
import * as logic from "../logic";
import { t } from "../../../i18n";

vi.mock("../../../assets/images", () => {
  const p = new Proxy(
    {},
    {
      get: (_target, prop: string) => ({ uri: `${prop}.png` }),
    },
  );
  return {
    SPOTIT_ICONS: p,
    SPOTIT_SHADOWS: p,
    SCENE_IMAGES: p,
    SCENE_THUMBS: p,
    UI_IMAGES: p,
    DRESSUP_ICONS: p,
    RHYME_SPRITES: {},
  };
});

afterEach(() => {
  cleanup();
});

describe("SumsGame fast-tap", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.spyOn(sound.sfx, "wrong").mockImplementation(() => {});
    vi.spyOn(sound.sfx, "good").mockImplementation(() => {});
    vi.spyOn(sound.sfx, "boing").mockImplementation(() => {});
    vi.spyOn(sound, "say").mockImplementation(() => {});
    vi.spyOn(sound, "saySequence").mockImplementation(() => {});
    vi.spyOn(sound, "sayThen").mockImplementation((texts, done) => {
      if (done) done();
    });
  });

  afterEach(() => {
    vi.runOnlyPendingTimers();
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("allows immediate tap of correct choice after wrong answer while ignoring repeated wrong taps", () => {
    let sayThenCb: (() => void) | undefined;
    vi.spyOn(sound, "sayThen").mockImplementation((_texts, cb) => {
      sayThenCb = cb;
    });

    render(<SumsGame onHome={() => {}} difficulty="easy" lang="en" />);

    // Clear initial round saySequence calls.
    vi.clearAllMocks();

    act(() => {
      vi.advanceTimersByTime(3000);
    });
    const buttons = screen.getAllByRole("button");
    const wrongButtons = buttons.filter((b) => {
      const tid = b.getAttribute("data-testid");
      return tid && tid.startsWith("sums-choice-") && !tid.endsWith("-answer");
    });
    const correctBtn = buttons.find((b) =>
      b.getAttribute("data-testid")?.endsWith("-answer"),
    );

    const wrongButton = wrongButtons[0];
    expect(wrongButton).toBeDefined();
    expect(correctBtn).toBeDefined();

    // Tap wrong choice
    fireEvent.click(wrongButton);
    expect(sound.sfx.wrong).toHaveBeenCalledTimes(1);

    // Repeated tap on the same wrong choice is ignored
    fireEvent.click(wrongButton);
    expect(sound.sfx.wrong).toHaveBeenCalledTimes(1);

    // Immediately tap correct choice: succeeds without waiting for 450ms lockout
    fireEvent.click(correctBtn!);
    expect(sound.sfx.good).toHaveBeenCalledTimes(1);

    // Additional tap on wrong choice during celebration is ignored
    fireEvent.click(wrongButton);
    expect(sound.sfx.wrong).toHaveBeenCalledTimes(1);

    // Praise finishes and advances round
    act(() => {
      sayThenCb?.();
    });
    expect(screen.getByTestId("sums-score").textContent).toContain("1/5");
  });

  it("clears wrongPickTimer on unmount without throwing", () => {
    const { unmount } = render(
      <SumsGame onHome={() => {}} difficulty="easy" lang="en" />,
    );
    vi.clearAllMocks();

    act(() => {
      vi.advanceTimersByTime(3000);
    });
    const buttons = screen.getAllByRole("button");
    const wrongBtn = buttons.find((b) => {
      const tid = b.getAttribute("data-testid");
      return tid && tid.startsWith("sums-choice-") && !tid.endsWith("-answer");
    })!;

    fireEvent.click(wrongBtn);
    expect(sound.sfx.wrong).toHaveBeenCalledTimes(1);

    unmount();
    act(() => {
      vi.runAllTimers();
    });
  });

  it("calls stopNarration on unmount to prevent audio leak across navigation", () => {
    const stopNarrationSpy = vi.spyOn(sound, "stopNarration");
    const { unmount } = render(
      <SumsGame onHome={() => {}} difficulty="easy" lang="en" />,
    );
    expect(stopNarrationSpy).not.toHaveBeenCalled();

    unmount();

    expect(stopNarrationSpy).toHaveBeenCalledTimes(1);
  });

  it("ignores rapid double tap on the correct answer before state update", () => {
    let sayThenCb: (() => void) | undefined;
    vi.spyOn(sound, "sayThen").mockImplementation((_texts, cb) => {
      sayThenCb = cb;
    });

    render(<SumsGame onHome={() => {}} difficulty="easy" lang="en" />);
    vi.clearAllMocks();

    act(() => {
      vi.advanceTimersByTime(3000);
    });
    const buttons = screen.getAllByRole("button");
    const correctBtn = buttons.find((b) =>
      b.getAttribute("data-testid")?.endsWith("-answer"),
    );
    expect(correctBtn).toBeDefined();

    act(() => {
      fireEvent.click(correctBtn!);
      fireEvent.click(correctBtn!);
    });

    expect(sound.sfx.good).toHaveBeenCalledTimes(1);
    expect(sound.sayThen).toHaveBeenCalledTimes(1);
    expect(screen.getByTestId("sums-score").textContent).toContain("1/5");

    // Praise finishes: advances round and unlocks input
    act(() => {
      sayThenCb?.();
    });

    const nextButtons = screen.getAllByRole("button");
    const nextCorrectBtn = nextButtons.find((b) =>
      b.getAttribute("data-testid")?.endsWith("-answer"),
    );
    expect(nextCorrectBtn).toBeDefined();
    act(() => {
      vi.advanceTimersByTime(3000);
    });
    fireEvent.click(nextCorrectBtn!);
    expect(sound.sfx.good).toHaveBeenCalledTimes(2);
    expect(sound.sayThen).toHaveBeenCalledTimes(2);
    expect(screen.getByTestId("sums-score").textContent).toContain("2/5");
  });
});

describe("SumsGame", () => {
  it("plays through a full game to win, then resets", () => {
    vi.useFakeTimers();
    vi.spyOn(sound, "say").mockImplementation(() => {});
    vi.spyOn(sound, "saySequence").mockImplementation(() => {});
    vi.spyOn(sound, "sayThen").mockImplementation((_, cb) => cb());
    vi.spyOn(sound.sfx, "good").mockImplementation(() => {});
    vi.spyOn(sound.sfx, "wrong").mockImplementation(() => {});
    vi.spyOn(sound.sfx, "boing").mockImplementation(() => {});

    const { unmount } = render(
      <SumsGame onHome={() => {}} difficulty="easy" lang="en" />,
    );
    act(() => {
      vi.runAllTimers();
    });

    const clickAnswer = (isWrong = false) => {
      act(() => {
        vi.advanceTimersByTime(3000);
      });
      const buttons = screen.getAllByRole("button");
      const targetButtons = buttons.filter((b) => {
        const tid = b.getAttribute("data-testid");
        if (!tid || !tid.startsWith("sums-choice-")) return false;
        return isWrong ? !tid.endsWith("-answer") : tid.endsWith("-answer");
      });
      const target = targetButtons[0];
      expect(target).toBeDefined();
      if (!target) throw new Error("Target choice not found");
      fireEvent.click(target);
      act(() => {
        vi.runAllTimers();
      });
    };

    // Click wrong first
    clickAnswer(true);
    expect(sound.sfx.wrong).toHaveBeenCalled();

    // Need 5 correct to win on easy
    for (let i = 0; i < 5; i++) {
      clickAnswer(false);
    }
    expect(sound.sfx.good).toHaveBeenCalledTimes(5);
    expect(screen.getByTestId("win-overlay")).toBeDefined();

    const resetBtn = screen.getByTestId("play-again");
    expect(resetBtn).toBeDefined();
    fireEvent.click(resetBtn);
    act(() => {
      vi.runAllTimers();
    });

    expect(screen.queryByTestId("win-overlay")).toBeNull();
    unmount();

    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("does not trigger win line or victory overlay until praise finishes on final round", () => {
    vi.useFakeTimers();
    const saySpy = vi.spyOn(sound, "say").mockImplementation(() => {});
    vi.spyOn(sound, "saySequence").mockImplementation(() => {});
    const sayThenCallbacks: (() => void)[] = [];
    vi.spyOn(sound, "sayThen").mockImplementation((_lines, cb) => {
      if (cb) sayThenCallbacks.push(cb);
    });
    vi.spyOn(sound.sfx, "good").mockImplementation(() => {});
    vi.spyOn(sound.sfx, "wrong").mockImplementation(() => {});
    vi.spyOn(sound.sfx, "boing").mockImplementation(() => {});

    const { unmount } = render(
      <SumsGame onHome={() => {}} difficulty="easy" lang="en" />,
    );
    act(() => {
      vi.runAllTimers();
    });

    const clickCorrectAnswer = () => {
      act(() => {
        vi.advanceTimersByTime(3000);
      });
      const buttons = screen.getAllByRole("button");
      const target = buttons.find((b) => {
        const tid = b.getAttribute("data-testid");
        return tid && tid.startsWith("sums-choice-") && tid.endsWith("-answer");
      });
      expect(target).toBeDefined();
      if (!target) throw new Error("Target choice not found");
      fireEvent.click(target);
    };

    // Answer rounds 1 to 4 correctly, draining sayThen callback each time
    for (let round = 1; round <= 4; round++) {
      clickCorrectAnswer();
      expect(screen.getByTestId("sums-score").textContent).toContain(
        `${round}/5`,
      );
      expect(sayThenCallbacks).toHaveLength(1);
      const advance = sayThenCallbacks.pop()!;
      act(() => {
        advance();
        vi.runAllTimers();
      });
    }

    // Round 5: tap correct answer
    clickCorrectAnswer();

    // Score updates immediately for visual feedback (5/5)
    expect(screen.getByTestId("sums-score").textContent).toContain("5/5");

    // Win line and WinOverlay must NOT have triggered yet while praise is in flight
    expect(saySpy).not.toHaveBeenCalledWith(t("en", "win.sums"));
    expect(screen.queryByTestId("win-overlay")).toBeNull();

    // Praise finishes
    expect(sayThenCallbacks).toHaveLength(1);
    const finishPraise = sayThenCallbacks.pop()!;
    act(() => {
      finishPraise();
      vi.runAllTimers();
    });

    // Now win line and WinOverlay trigger
    expect(saySpy).toHaveBeenCalledWith(t("en", "win.sums"));
    expect(screen.getByTestId("win-overlay")).toBeDefined();

    unmount();
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("maintains minimum stage height and prevents critter overlap on mobile landscape viewports", () => {
    Object.defineProperty(document.documentElement, "clientWidth", {
      value: 800,
      configurable: true,
    });
    Object.defineProperty(document.documentElement, "clientHeight", {
      value: 360,
      configurable: true,
    });
    window.dispatchEvent(new Event("resize"));

    vi.spyOn(logic, "makeSumsRound").mockReturnValue({
      icon: "frog",
      bIcon: "butterfly",
      a: 5,
      b: 5,
      sum: 10,
      aPositions: [
        { x: 12.5, y: 16.7 },
        { x: 37.5, y: 16.7 },
        { x: 62.5, y: 16.7 },
        { x: 87.5, y: 16.7 },
        { x: 12.5, y: 50.0 },
      ],
      bPositions: [
        { x: 37.5, y: 50.0 },
        { x: 62.5, y: 50.0 },
        { x: 87.5, y: 50.0 },
        { x: 12.5, y: 83.3 },
        { x: 37.5, y: 83.3 },
      ],
      choices: [8, 9, 10],
    });

    const { unmount } = render(
      <SumsGame onHome={() => {}} difficulty="hard" lang="en" />,
    );

    const stage = screen.getByTestId("sums-stage-5+5");
    const stageH = parseFloat(stage.style.height);
    expect(stageH).toBeGreaterThanOrEqual(160);

    const critterRow1 = screen.getByTestId("sums-initial-0");
    const critterRow2 = screen.getByTestId("sums-initial-4");
    const critterRow3 = screen.getByTestId("sums-incoming-3");

    const top1 = parseFloat(critterRow1.style.top);
    const size1 = parseFloat(critterRow1.style.height);
    const bottom1 = top1 + size1;

    const top2 = parseFloat(critterRow2.style.top);
    const size2 = parseFloat(critterRow2.style.height);
    const bottom2 = top2 + size2;

    const top3 = parseFloat(critterRow3.style.top);

    expect(bottom1).toBeLessThanOrEqual(top2);
    expect(bottom2).toBeLessThanOrEqual(top3);

    const choiceButtons = screen.getAllByRole("button");
    const correctBtn = choiceButtons.find((b) =>
      b.getAttribute("data-testid")?.endsWith("-answer"),
    );
    expect(correctBtn).toBeDefined();

    unmount();
    vi.restoreAllMocks();
  });

  it("clears wrong pick lockout when language switches mid-flash so tapping the wrong choice again gives sfx.wrong", () => {
    vi.useFakeTimers();
    vi.spyOn(sound, "say").mockImplementation(() => {});
    vi.spyOn(sound, "saySequence").mockImplementation(() => {});
    vi.spyOn(sound, "sayThen").mockImplementation(() => {});
    vi.spyOn(sound.sfx, "good").mockImplementation(() => {});
    vi.spyOn(sound.sfx, "wrong").mockImplementation(() => {});
    vi.spyOn(sound.sfx, "boing").mockImplementation(() => {});

    vi.spyOn(logic, "makeSumsRound").mockReturnValue({
      icon: "butterfly",
      bIcon: "frog",
      a: 2,
      b: 3,
      sum: 5,
      aPositions: [
        { x: 10, y: 10 },
        { x: 20, y: 20 },
      ],
      bPositions: [
        { x: 30, y: 30 },
        { x: 40, y: 40 },
        { x: 50, y: 50 },
      ],
      choices: [3, 4, 5],
    });

    const { rerender, unmount } = render(
      <SumsGame onHome={() => {}} difficulty="easy" lang="en" />,
    );

    act(() => {
      vi.advanceTimersByTime(3000);
    });

    const buttons = screen.getAllByRole("button");
    const wrongBtn = buttons.find((b) => {
      const tid = b.getAttribute("data-testid");
      return tid && tid.startsWith("sums-choice-") && !tid.endsWith("-answer");
    })!;
    expect(wrongBtn).toBeDefined();

    vi.mocked(sound.sfx.wrong).mockClear();

    fireEvent.click(wrongBtn);
    expect(sound.sfx.wrong).toHaveBeenCalledTimes(1);

    fireEvent.click(wrongBtn);
    expect(sound.sfx.wrong).toHaveBeenCalledTimes(1);

    act(() => {
      vi.advanceTimersByTime(200);
    });
    rerender(<SumsGame onHome={() => {}} difficulty="easy" lang="ja" />);

    fireEvent.click(wrongBtn);
    expect(sound.sfx.wrong).toHaveBeenCalledTimes(2);

    unmount();
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("prevents tapping before incoming critters appear", () => {
    vi.useFakeTimers();
    vi.spyOn(sound, "say").mockImplementation(() => {});
    vi.spyOn(sound, "saySequence").mockImplementation(() => {});
    vi.spyOn(sound, "sayThen").mockImplementation(() => {});
    vi.spyOn(sound.sfx, "good").mockImplementation(() => {});
    vi.spyOn(sound.sfx, "wrong").mockImplementation(() => {});
    vi.spyOn(sound.sfx, "boing").mockImplementation(() => {});

    vi.spyOn(logic, "makeSumsRound").mockReturnValue({
      icon: "butterfly",
      bIcon: "frog",
      a: 2,
      b: 2,
      sum: 4,
      aPositions: [
        { x: 10, y: 10 },
        { x: 20, y: 20 },
      ],
      bPositions: [
        { x: 30, y: 30 },
        { x: 40, y: 40 },
      ],
      choices: [3, 4, 5],
    });

    const { unmount } = render(
      <SumsGame onHome={() => {}} difficulty="easy" lang="en" />,
    );

    // Initial state: locked. Tap correct answer immediately.
    const buttons = screen.getAllByRole("button");
    const correctBtn = buttons.find((b) =>
      b.getAttribute("data-testid")?.endsWith("-answer"),
    )!;

    fireEvent.click(correctBtn);
    expect(sound.sfx.good).not.toHaveBeenCalled();

    // Advance just before unlock (400 + 2 * 250 + 420 = 1320ms)
    // Actually, wait, it unlocks precisely at 1320.
    // If I advance to 1319, it's still locked.
    act(() => {
      vi.advanceTimersByTime(1319);
    });
    fireEvent.click(correctBtn);
    expect(sound.sfx.good).not.toHaveBeenCalled();

    // Advance to unlock
    act(() => {
      vi.advanceTimersByTime(1);
    });
    fireEvent.click(correctBtn);
    expect(sound.sfx.good).toHaveBeenCalledTimes(1);

    unmount();
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("provides visual confirmation with choiceCorrect and aria-selected on correct answer during praise delay", () => {
    vi.useFakeTimers();
    vi.spyOn(sound, "say").mockImplementation(() => {});
    vi.spyOn(sound, "saySequence").mockImplementation(() => {});
    let praiseDoneCb: (() => void) | undefined;
    vi.spyOn(sound, "sayThen").mockImplementation((_lines, cb) => {
      praiseDoneCb = cb;
    });
    vi.spyOn(sound.sfx, "good").mockImplementation(() => {});
    vi.spyOn(sound.sfx, "wrong").mockImplementation(() => {});
    vi.spyOn(sound.sfx, "boing").mockImplementation(() => {});

    const { unmount } = render(
      <SumsGame onHome={() => {}} difficulty="easy" lang="en" />,
    );

    // Wait for incoming critters animation to complete and unlock choices
    act(() => {
      vi.advanceTimersByTime(2000);
    });

    const buttons = screen.getAllByRole("button");
    const correctBtn = buttons.find((b) =>
      b.getAttribute("data-testid")?.endsWith("-answer"),
    )!;
    const otherBtn = buttons.find(
      (b) =>
        b.getAttribute("data-testid")?.startsWith("sums-choice-") &&
        !b.getAttribute("data-testid")?.endsWith("-answer"),
    )!;
    expect(correctBtn).toBeDefined();
    expect(otherBtn).toBeDefined();

    // Before tapping, neither button is selected
    expect(correctBtn.getAttribute("aria-selected")).toBe("false");
    expect(otherBtn.getAttribute("aria-selected")).toBe("false");

    // Tap wrong choice: wrong button highlights red, correct button is not highlighted
    fireEvent.click(otherBtn);
    expect(window.getComputedStyle(otherBtn).borderTopColor).toBe(
      "rgba(232, 86, 79, 1.00)",
    );
    expect(window.getComputedStyle(correctBtn).borderTopColor).not.toBe(
      "rgba(95, 191, 110, 1.00)",
    );
    expect(correctBtn.getAttribute("aria-selected")).toBe("false");

    // Advance timer past wrong pick lockout
    act(() => {
      vi.advanceTimersByTime(450);
    });

    // Tap correct choice
    fireEvent.click(correctBtn);

    // During praise delay (before praise finishes):
    // correct button has visual feedback
    expect(correctBtn.getAttribute("aria-selected")).toBe("true");
    expect(otherBtn.getAttribute("aria-selected")).toBe("false");
    expect(window.getComputedStyle(correctBtn).borderTopColor).toBe(
      "rgba(95, 191, 110, 1.00)",
    );
    expect(window.getComputedStyle(correctBtn).backgroundColor).toBe(
      "rgba(95, 191, 110, 0.14)",
    );
    expect(window.getComputedStyle(correctBtn).backgroundColor).not.toBe(
      window.getComputedStyle(otherBtn).backgroundColor,
    );

    // Praise finishes, round advances
    act(() => {
      praiseDoneCb?.();
      vi.runAllTimers();
    });

    // In new round, choices reset
    const newButtons = screen.getAllByRole("button");
    const newChoices = newButtons.filter((b) =>
      b.getAttribute("data-testid")?.startsWith("sums-choice-"),
    );
    for (const b of newChoices) {
      expect(b.getAttribute("aria-selected")).toBe("false");
    }

    unmount();
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("displays sum in equation banner upon correct answer and resets to question mark on next round", () => {
    vi.useFakeTimers();
    vi.spyOn(sound, "say").mockImplementation(() => {});
    vi.spyOn(sound, "saySequence").mockImplementation(() => {});
    vi.spyOn(sound.sfx, "good").mockImplementation(() => {});
    vi.spyOn(sound.sfx, "wrong").mockImplementation(() => {});
    vi.spyOn(sound.sfx, "boing").mockImplementation(() => {});

    let sayThenCb: (() => void) | undefined;
    vi.spyOn(sound, "sayThen").mockImplementation((_texts, cb) => {
      sayThenCb = cb;
    });

    vi.spyOn(logic, "makeSumsRound").mockReturnValue({
      icon: "butterfly",
      bIcon: "frog",
      a: 2,
      b: 3,
      sum: 5,
      aPositions: [
        { x: 10, y: 10 },
        { x: 20, y: 20 },
      ],
      bPositions: [
        { x: 30, y: 30 },
        { x: 40, y: 40 },
        { x: 50, y: 50 },
      ],
      choices: [3, 4, 5],
    });

    const { unmount } = render(
      <SumsGame onHome={() => {}} difficulty="easy" lang="en" />,
    );

    // Initial state: equation displays unsolved question mark
    expect(screen.getByTestId("sums-equation").textContent).toBe("2 + 3 = ?");

    // Advance past incoming critters animation lock
    act(() => {
      vi.advanceTimersByTime(2000);
    });

    const buttons = screen.getAllByRole("button");
    const wrongBtn = buttons.find((b) => {
      const tid = b.getAttribute("data-testid");
      return tid && tid.startsWith("sums-choice-") && !tid.endsWith("-answer");
    })!;
    const correctBtn = buttons.find((b) =>
      b.getAttribute("data-testid")?.endsWith("-answer"),
    )!;

    // Wrong pick keeps equation as unsolved question
    fireEvent.click(wrongBtn);
    expect(screen.getByTestId("sums-equation").textContent).toBe("2 + 3 = ?");

    // Advance past wrong pick lock
    act(() => {
      vi.advanceTimersByTime(500);
    });

    // Correct pick immediately updates equation to show the sum during praise
    fireEvent.click(correctBtn);
    expect(screen.getByTestId("sums-equation").textContent).toBe("2 + 3 = 5");

    // Next round begins after praise finishes
    vi.spyOn(logic, "makeSumsRound").mockReturnValue({
      icon: "frog",
      bIcon: "butterfly",
      a: 4,
      b: 1,
      sum: 5,
      aPositions: [
        { x: 10, y: 10 },
        { x: 20, y: 20 },
        { x: 30, y: 30 },
        { x: 40, y: 40 },
      ],
      bPositions: [{ x: 50, y: 50 }],
      choices: [4, 5, 6],
    });
    act(() => {
      sayThenCb?.();
    });

    // New round reverts to unsolved question mark with new addends
    expect(screen.getByTestId("sums-equation").textContent).toBe("4 + 1 = ?");

    unmount();
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("renders distinct icons for initial addend a and incoming addend b", () => {
    vi.spyOn(logic, "makeSumsRound").mockReturnValue({
      icon: "frog",
      bIcon: "butterfly",
      a: 2,
      b: 3,
      sum: 5,
      aPositions: [
        { x: 15, y: 25 },
        { x: 25, y: 65 },
      ],
      bPositions: [
        { x: 60, y: 20 },
        { x: 75, y: 50 },
        { x: 85, y: 75 },
      ],
      choices: [4, 5, 6],
    });

    const { unmount } = render(
      <SumsGame onHome={() => {}} difficulty="easy" lang="en" />,
    );

    const initial0 = screen.getByTestId("sums-initial-0");
    const initial1 = screen.getByTestId("sums-initial-1");
    const incoming0 = screen.getByTestId("sums-incoming-0");
    const incoming1 = screen.getByTestId("sums-incoming-1");
    const incoming2 = screen.getByTestId("sums-incoming-2");

    const getSource = (el: HTMLElement): string => {
      const img =
        el.tagName.toLowerCase() === "img" ? el : el.querySelector("img");
      if (img?.getAttribute("src")) return img.getAttribute("src")!;
      const bg =
        el.style.backgroundImage ||
        el.querySelector("div")?.style.backgroundImage;
      return bg || "";
    };

    const frogSrc = (SPOTIT_ICONS.frog as unknown as { uri: string }).uri;
    const butterflySrc = (SPOTIT_ICONS.butterfly as unknown as { uri: string })
      .uri;

    // Initial addend critters display SPOTIT_ICONS.frog
    expect(getSource(initial0)).toContain(frogSrc);
    expect(getSource(initial1)).toContain(frogSrc);

    // Incoming addend critters display SPOTIT_ICONS.butterfly
    expect(getSource(incoming0)).toContain(butterflySrc);
    expect(getSource(incoming1)).toContain(butterflySrc);
    expect(getSource(incoming2)).toContain(butterflySrc);

    // Initial and incoming icons are visually distinct
    expect(getSource(incoming0)).not.toBe(getSource(initial0));

    unmount();
    vi.restoreAllMocks();
  });

  it("does not remount critters when correct answer is picked before praise finishes", () => {
    vi.useFakeTimers();
    vi.spyOn(sound, "say").mockImplementation(() => {});
    vi.spyOn(sound, "saySequence").mockImplementation(() => {});
    vi.spyOn(sound.sfx, "good").mockImplementation(() => {});
    vi.spyOn(sound.sfx, "wrong").mockImplementation(() => {});
    vi.spyOn(sound.sfx, "boing").mockImplementation(() => {});

    let sayThenCb: (() => void) | undefined;
    vi.spyOn(sound, "sayThen").mockImplementation((_texts, cb) => {
      sayThenCb = cb;
    });

    const { unmount } = render(
      <SumsGame onHome={() => {}} difficulty="easy" lang="en" />,
    );

    // Advance past incoming critters animation lock
    act(() => {
      vi.advanceTimersByTime(2000);
    });

    // find an incoming critter
    const incomingCritter = screen.getByTestId("sums-incoming-0");

    // find correct answer
    const buttons = screen.getAllByRole("button");
    const correctBtn = buttons.find((b) =>
      b.getAttribute("data-testid")?.endsWith("-answer"),
    );

    // tap it
    fireEvent.click(correctBtn!);

    // score should update
    expect(screen.getByTestId("sums-score").textContent).toContain("1/");

    // verify the critter is the exact same DOM node (no remounting)
    const afterClickCritter = screen.getByTestId("sums-incoming-0");
    expect(afterClickCritter).toBe(incomingCritter);

    // now finish praise
    act(() => {
      sayThenCb?.();
    });

    // round advanced, it's a new round so the critter should be a new DOM node (remounted for the next round)
    const nextRoundCritter = screen.getByTestId("sums-incoming-0");
    expect(nextRoundCritter).not.toBe(incomingCritter);

    unmount();
    vi.useRealTimers();
    vi.restoreAllMocks();
  });
});
