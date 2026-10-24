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
import * as sound from "../../../sound";
import * as logic from "../logic";
import { t } from "../../../i18n";

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

  it("queues the wrong-answer voice prompt only once when tapped rapidly", () => {
    render(<SumsGame onHome={() => {}} difficulty="easy" lang="en" />);

    // Clear initial round saySequence calls.
    vi.clearAllMocks();

    const buttons = screen.getAllByRole("button");
    const wrongButtons = buttons.filter((b) => {
      const tid = b.getAttribute("data-testid");
      return tid && tid.startsWith("sums-choice-") && !tid.endsWith("-answer");
    });

    const wrongButton = wrongButtons[0];
    expect(wrongButton).toBeDefined();

    // Tap rapidly 4 times
    fireEvent.click(wrongButton);
    act(() => {
      vi.advanceTimersByTime(100);
    });
    fireEvent.click(wrongButton);
    act(() => {
      vi.advanceTimersByTime(100);
    });
    fireEvent.click(wrongButton);
    act(() => {
      vi.advanceTimersByTime(100);
    });
    fireEvent.click(wrongButton);

    // Fast forward to just before the 500ms timeout of the last tap.
    // The last tap occurred at T=300ms; its 500ms timeout expires at T=800ms.
    act(() => {
      vi.advanceTimersByTime(499);
    });
    expect(sound.say).not.toHaveBeenCalled();

    // Fast forward exactly to the 500ms mark of the last tap.
    act(() => {
      vi.advanceTimersByTime(1);
    });

    expect(sound.say).toHaveBeenCalledTimes(1);
  });

  it("ignores rapid double tap on the correct answer before state update", () => {
    let sayThenCb: (() => void) | undefined;
    vi.spyOn(sound, "sayThen").mockImplementation((_texts, cb) => {
      sayThenCb = cb;
    });

    render(<SumsGame onHome={() => {}} difficulty="easy" lang="en" />);
    vi.clearAllMocks();

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

  it("clears pending incoming critter boing sound timers when correct answer is tapped quickly", () => {
    vi.useFakeTimers();
    vi.spyOn(sound, "say").mockImplementation(() => {});
    vi.spyOn(sound, "saySequence").mockImplementation(() => {});
    vi.spyOn(sound, "sayThen").mockImplementation(() => {});
    vi.spyOn(sound.sfx, "good").mockImplementation(() => {});
    vi.spyOn(sound.sfx, "wrong").mockImplementation(() => {});
    const boingSpy = vi.spyOn(sound.sfx, "boing").mockImplementation(() => {});

    vi.spyOn(logic, "makeSumsRound").mockReturnValue({
      icon: "butterfly",
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

    // At 200ms, no boing has fired yet (first is scheduled at 400ms).
    act(() => {
      vi.advanceTimersByTime(200);
    });
    expect(boingSpy).not.toHaveBeenCalled();

    // Tap the correct answer.
    const buttons = screen.getAllByRole("button");
    const correctBtn = buttons.find((b) =>
      b.getAttribute("data-testid")?.endsWith("-answer"),
    );
    expect(correctBtn).toBeDefined();
    fireEvent.click(correctBtn!);
    expect(sound.sfx.good).toHaveBeenCalledTimes(1);

    // Advance past all scheduled boing times (400ms, 650ms, 900ms).
    act(() => {
      vi.advanceTimersByTime(1500);
    });

    // Boing timers should have been cancelled when the correct answer was picked.
    expect(boingSpy).not.toHaveBeenCalled();

    unmount();
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("clears remaining incoming critter boing timers when answered after first boing", () => {
    vi.useFakeTimers();
    vi.spyOn(sound, "say").mockImplementation(() => {});
    vi.spyOn(sound, "saySequence").mockImplementation(() => {});
    vi.spyOn(sound, "sayThen").mockImplementation(() => {});
    vi.spyOn(sound.sfx, "good").mockImplementation(() => {});
    vi.spyOn(sound.sfx, "wrong").mockImplementation(() => {});
    const boingSpy = vi.spyOn(sound.sfx, "boing").mockImplementation(() => {});

    vi.spyOn(logic, "makeSumsRound").mockReturnValue({
      icon: "butterfly",
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

    // Advance to 500ms: first boing (at 400ms) has fired, remaining 2 (at 650ms, 900ms) pending.
    act(() => {
      vi.advanceTimersByTime(500);
    });
    expect(boingSpy).toHaveBeenCalledTimes(1);

    // Tap the correct answer.
    const buttons = screen.getAllByRole("button");
    const correctBtn = buttons.find((b) =>
      b.getAttribute("data-testid")?.endsWith("-answer"),
    );
    expect(correctBtn).toBeDefined();
    fireEvent.click(correctBtn!);
    expect(sound.sfx.good).toHaveBeenCalledTimes(1);

    // Advance past all scheduled boing times.
    act(() => {
      vi.advanceTimersByTime(1500);
    });

    // No additional boing sounds should have fired.
    expect(boingSpy).toHaveBeenCalledTimes(1);

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
});
