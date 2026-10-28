// @vitest-environment happy-dom
import React, { useState } from "react";
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { LangContext } from "../../../components/GameShell";
import { Difficulty } from "../../../difficulty";
import { Lang } from "../../../lang";
import { t } from "../../../i18n";
import * as sound from "../../../sound";
import { sfx } from "../../../sound";
import { CompareGame } from "../CompareGame";
import * as logic from "../logic";
import { comparisonPhrase, speechLines as compareSpeechLines } from "../logic";

const noop = () => {};

describe("CompareGame fast-tap lock", () => {
  let goodSpy: ReturnType<typeof vi.spyOn>;
  let wrongSpy: ReturnType<typeof vi.spyOn>;
  let saySpy: ReturnType<typeof vi.spyOn>;
  let sayThenSpy: ReturnType<typeof vi.spyOn>;
  let sayThenCallback: (() => void) | null = null;

  beforeEach(() => {
    vi.restoreAllMocks();
    sayThenCallback = null;
    goodSpy = vi.spyOn(sound.sfx, "good").mockImplementation(() => {});
    wrongSpy = vi.spyOn(sound.sfx, "wrong").mockImplementation(() => {});
    saySpy = vi.spyOn(sound, "say").mockImplementation(() => {});
    sayThenSpy = vi.spyOn(sound, "sayThen").mockImplementation((_lines, cb) => {
      sayThenCallback = cb ?? null;
    });
  });

  afterEach(() => {
    cleanup();
    vi.useRealTimers();
  });

  it("hammering the wrong side ignores duplicate taps and queues only one error sound and voice prompt", () => {
    vi.useFakeTimers();
    render(<CompareGame onHome={() => {}} difficulty="easy" lang="en" />);

    saySpy.mockClear();

    const plates = [
      screen.getByTestId(/^compare-plate-left/),
      screen.getByTestId(/^compare-plate-right/),
    ];
    const wrongPlate = plates.find(
      (p) => !p.getAttribute("data-testid")?.endsWith("-correct"),
    )!;
    expect(wrongPlate).toBeDefined();

    act(() => {
      fireEvent.click(wrongPlate);
      fireEvent.click(wrongPlate);
      fireEvent.click(wrongPlate);
    });

    expect(wrongSpy).toHaveBeenCalledTimes(1);
    expect(saySpy).not.toHaveBeenCalled();

    act(() => {
      vi.advanceTimersByTime(500);
    });

    expect(saySpy).toHaveBeenCalledTimes(1);

    act(() => {
      fireEvent.click(wrongPlate);
    });
    expect(wrongSpy).toHaveBeenCalledTimes(2);
  });

  it("hammering the correct side ignores duplicate taps, increments score once, and advances round cleanly", () => {
    render(<CompareGame onHome={() => {}} difficulty="easy" lang="en" />);

    expect(screen.getByTestId("compare-score").textContent).toContain("0/6");

    const plates = [
      screen.getByTestId(/^compare-plate-left/),
      screen.getByTestId(/^compare-plate-right/),
    ];
    const correctPlate = plates.find((p) =>
      p.getAttribute("data-testid")?.endsWith("-correct"),
    )!;
    expect(correctPlate).toBeDefined();

    fireEvent.click(correctPlate);
    fireEvent.click(correctPlate);
    fireEvent.click(correctPlate);

    expect(goodSpy).toHaveBeenCalledTimes(1);
    expect(sayThenSpy).toHaveBeenCalledTimes(1);
    expect(screen.getByTestId("compare-score").textContent).toContain("1/6");

    expect(sayThenCallback).not.toBeNull();
    act(() => {
      sayThenCallback!();
    });

    expect(screen.getByTestId("compare-score").textContent).toContain("1/6");

    const nextPlates = [
      screen.getByTestId(/^compare-plate-left/),
      screen.getByTestId(/^compare-plate-right/),
    ];
    const nextCorrect = nextPlates.find((p) =>
      p.getAttribute("data-testid")?.endsWith("-correct"),
    )!;
    fireEvent.click(nextCorrect);
    expect(goodSpy).toHaveBeenCalledTimes(2);
    expect(screen.getByTestId("compare-score").textContent).toContain("2/6");
  });

  it("ignores taps on correct side while wrong-side feedback is active", () => {
    vi.useFakeTimers();
    render(<CompareGame onHome={() => {}} difficulty="easy" lang="en" />);

    const plates = [
      screen.getByTestId(/^compare-plate-left/),
      screen.getByTestId(/^compare-plate-right/),
    ];
    const wrongPlate = plates.find(
      (p) => !p.getAttribute("data-testid")?.endsWith("-correct"),
    )!;
    const correctPlate = plates.find((p) =>
      p.getAttribute("data-testid")?.endsWith("-correct"),
    )!;

    act(() => {
      fireEvent.click(wrongPlate);
    });
    expect(wrongSpy).toHaveBeenCalledTimes(1);

    act(() => {
      fireEvent.click(correctPlate);
    });
    expect(goodSpy).not.toHaveBeenCalled();
    expect(screen.getByTestId("compare-score").textContent).toContain("0/6");

    act(() => {
      vi.advanceTimersByTime(450);
    });

    act(() => {
      fireEvent.click(correctPlate);
    });
    expect(goodSpy).toHaveBeenCalledTimes(1);
    expect(screen.getByTestId("compare-score").textContent).toContain("1/6");
  });

  it("ignores wrong tap while correct side celebration is playing", () => {
    render(<CompareGame onHome={() => {}} difficulty="easy" lang="en" />);

    const plates = [
      screen.getByTestId(/^compare-plate-left/),
      screen.getByTestId(/^compare-plate-right/),
    ];
    const wrongPlate = plates.find(
      (p) => !p.getAttribute("data-testid")?.endsWith("-correct"),
    )!;
    const correctPlate = plates.find((p) =>
      p.getAttribute("data-testid")?.endsWith("-correct"),
    )!;

    fireEvent.click(correctPlate);
    expect(goodSpy).toHaveBeenCalledTimes(1);

    fireEvent.click(wrongPlate);
    expect(wrongSpy).not.toHaveBeenCalled();
  });

  it("reset on play again resets score and unlocks input", () => {
    vi.useFakeTimers();
    render(<CompareGame onHome={() => {}} difficulty="easy" lang="en" />);

    for (let r = 0; r < 6; r++) {
      const plates = [
        screen.getByTestId(/^compare-plate-left/),
        screen.getByTestId(/^compare-plate-right/),
      ];
      const correctPlate = plates.find((p) =>
        p.getAttribute("data-testid")?.endsWith("-correct"),
      )!;
      act(() => {
        fireEvent.click(correctPlate);
      });
      if (r < 5) {
        expect(sayThenCallback).not.toBeNull();
        act(() => {
          sayThenCallback!();
        });
      }
    }

    expect(screen.getByTestId("compare-score").textContent).toContain("6/6");

    act(() => {
      vi.advanceTimersByTime(600);
    });

    const playAgainBtn = screen.getByTestId("play-again");
    act(() => {
      fireEvent.click(playAgainBtn);
    });

    expect(screen.getByTestId("compare-score").textContent).toContain("0/6");

    const newPlates = [
      screen.getByTestId(/^compare-plate-left/),
      screen.getByTestId(/^compare-plate-right/),
    ];
    const newCorrect = newPlates.find((p) =>
      p.getAttribute("data-testid")?.endsWith("-correct"),
    )!;
    act(() => {
      fireEvent.click(newCorrect);
    });
    expect(screen.getByTestId("compare-score").textContent).toContain("1/6");
  });
});

describe("CompareGame prompt replay", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.spyOn(sound, "say").mockImplementation(() => {});
    vi.spyOn(sound, "sayThen").mockImplementation((_, cb) => cb && cb());
    vi.spyOn(sfx, "tap").mockImplementation(() => {});
    vi.spyOn(sfx, "good").mockImplementation(() => {});
    vi.spyOn(sfx, "wrong").mockImplementation(() => {});
  });

  afterEach(() => {
    cleanup();
  });

  it("renders prompt as an interactive button and replays spoken prompt on tap", () => {
    const saySpy = vi.spyOn(sound, "say");
    const tapSpy = vi.spyOn(sfx, "tap");

    render(<CompareGame onHome={noop} difficulty="easy" lang="en" />);

    // Initial mount speaks prompt once
    expect(saySpy).toHaveBeenCalledWith("Tap the side with MORE!");
    saySpy.mockClear();

    // The prompt card should have button role and prompt label
    const promptBtn = screen.getByRole("button", {
      name: "Tap the side with more",
    });
    expect(promptBtn).toBeDefined();
    expect(within(promptBtn).getByText("Tap the side with more")).toBeDefined();
    expect(screen.getByText("🔊 Tap to hear again")).toBeDefined();

    // Clicking the prompt card replays the instruction and plays tap sfx
    fireEvent.click(promptBtn);
    expect(tapSpy).toHaveBeenCalledOnce();
    expect(saySpy).toHaveBeenCalledWith("Tap the side with MORE!");
  });

  it("replays FEWER prompt when round asks for fewer on hard mode", () => {
    vi.spyOn(logic, "makeCompareRound").mockReturnValue({
      left: { icon: "star", count: 3, positions: [] },
      right: { icon: "dog", count: 6, positions: [] },
      ask: "fewer",
      correctSide: "left",
    });

    const saySpy = vi.spyOn(sound, "say");
    const tapSpy = vi.spyOn(sfx, "tap");

    render(<CompareGame onHome={noop} difficulty="hard" lang="en" />);

    expect(saySpy).toHaveBeenCalledWith("Tap the side with FEWER!");
    saySpy.mockClear();

    const promptBtn = screen.getByTestId("compare-prompt-fewer");
    expect(promptBtn).toBeDefined();
    expect(
      within(promptBtn).getByText("Tap the side with fewer"),
    ).toBeDefined();

    fireEvent.click(promptBtn);
    expect(tapSpy).toHaveBeenCalledOnce();
    expect(saySpy).toHaveBeenCalledWith("Tap the side with FEWER!");
  });

  it("disables prompt button and does not replay audio when game is won", () => {
    let queuedCb: (() => void) | undefined;
    vi.spyOn(sound, "sayThen").mockImplementation((_, cb) => {
      queuedCb = cb;
    });

    // Make rounds: 1 round needed to win on easy for this test
    vi.spyOn(logic, "compareSettings").mockReturnValue({
      rounds: 1,
      range: [1, 7],
      minGap: 3,
      minRatio: 1.25,
      fewerFraction: 0,
    });

    vi.spyOn(logic, "makeCompareRound").mockReturnValue({
      left: { icon: "star", count: 6, positions: [] },
      right: { icon: "dog", count: 2, positions: [] },
      ask: "more",
      correctSide: "left",
    });

    render(<CompareGame onHome={noop} difficulty="easy" lang="en" />);

    const saySpy = vi.spyOn(sound, "say");
    const tapSpy = vi.spyOn(sfx, "tap");
    saySpy.mockClear();

    // Tap correct plate to win
    const leftPlate = screen.getByTestId("compare-plate-left-star-6-correct");
    fireEvent.click(leftPlate);

    // Complete celebration callback
    act(() => {
      queuedCb?.();
    });

    // Win overlay is visible
    expect(screen.getByTestId("win-overlay")).toBeDefined();

    tapSpy.mockClear();
    saySpy.mockClear();

    // Prompt button should be disabled when won
    const promptBtn = screen.getByTestId("compare-prompt-more");
    fireEvent.click(promptBtn);

    expect(tapSpy).not.toHaveBeenCalled();
    expect(saySpy).not.toHaveBeenCalled();
  });

  it("does not replay audio while locked during round transition", () => {
    let queuedCb: (() => void) | undefined;
    vi.spyOn(sound, "sayThen").mockImplementation((_, cb) => {
      queuedCb = cb;
    });

    vi.spyOn(logic, "compareSettings").mockReturnValue({
      rounds: 5,
      range: [1, 7],
      minGap: 3,
      minRatio: 1.25,
      fewerFraction: 0,
    });

    vi.spyOn(logic, "makeCompareRound").mockReturnValue({
      left: { icon: "star", count: 6, positions: [] },
      right: { icon: "dog", count: 2, positions: [] },
      ask: "more",
      correctSide: "left",
    });

    render(<CompareGame onHome={noop} difficulty="easy" lang="en" />);

    const saySpy = vi.spyOn(sound, "say");
    const tapSpy = vi.spyOn(sfx, "tap");
    saySpy.mockClear();

    // Tap correct plate to start celebration/transition
    const leftPlate = screen.getByTestId("compare-plate-left-star-6-correct");
    fireEvent.click(leftPlate);

    // Prompt button is clicked while locked (queuedCb hasn't resolved yet)
    const promptBtn = screen.getByTestId("compare-prompt-more");
    fireEvent.click(promptBtn);

    expect(tapSpy).not.toHaveBeenCalled();
    expect(saySpy).not.toHaveBeenCalled();

    // Finish transition
    act(() => {
      queuedCb?.();
    });
  });
});

describe("CompareGame badges and comparative feedback", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.spyOn(sound.sfx, "tap").mockImplementation(() => {});
    vi.spyOn(sound.sfx, "good").mockImplementation(() => {});
    vi.spyOn(sound.sfx, "wrong").mockImplementation(() => {});
    vi.spyOn(sound, "say").mockImplementation(() => {});
    vi.spyOn(sound, "sayThen").mockImplementation(() => {});
  });

  afterEach(() => {
    cleanup();
  });

  it("initially hides count badges and displays initial prompt", () => {
    render(<CompareGame onHome={vi.fn()} difficulty="easy" lang="en" />);

    expect(screen.queryByTestId("compare-badge-left")).toBeNull();
    expect(screen.queryByTestId("compare-badge-right")).toBeNull();
    const prompt = screen.getByTestId(/^compare-prompt-/);
    expect(prompt.textContent).toContain("Tap the side with more");
  });

  it("wrong plate tap plays wrong sound and keeps count badges hidden", () => {
    render(<CompareGame onHome={vi.fn()} difficulty="easy" lang="en" />);

    const buttons = screen.getAllByRole("button");
    const wrongPlate = buttons.find((btn) => {
      const id = btn.getAttribute("data-testid") || "";
      return id.startsWith("compare-plate-") && !id.endsWith("-correct");
    });
    expect(wrongPlate).toBeDefined();

    fireEvent.click(wrongPlate!);

    expect(sound.sfx.wrong).toHaveBeenCalledTimes(1);
    expect(sound.sfx.good).not.toHaveBeenCalled();
    expect(sound.sayThen).not.toHaveBeenCalled();
    expect(screen.queryByTestId("compare-badge-left")).toBeNull();
    expect(screen.queryByTestId("compare-badge-right")).toBeNull();
  });

  it("correct plate tap reveals count badges on both plates and plays comparative feedback", () => {
    let queuedCb: (() => void) | undefined;
    vi.spyOn(sound, "sayThen").mockImplementation((_lines, cb) => {
      queuedCb = cb;
    });

    render(<CompareGame onHome={vi.fn()} difficulty="easy" lang="en" />);

    const buttons = screen.getAllByRole("button");
    const leftPlate = buttons.find((btn) =>
      (btn.getAttribute("data-testid") || "").startsWith("compare-plate-left-"),
    );
    const rightPlate = buttons.find((btn) =>
      (btn.getAttribute("data-testid") || "").startsWith(
        "compare-plate-right-",
      ),
    );
    expect(leftPlate).toBeDefined();
    expect(rightPlate).toBeDefined();

    const leftId = leftPlate!.getAttribute("data-testid") || "";
    const rightId = rightPlate!.getAttribute("data-testid") || "";
    const leftMatch = leftId.match(
      /^compare-plate-left-.*-(\d+)(?:-correct)?$/,
    );
    const rightMatch = rightId.match(
      /^compare-plate-right-.*-(\d+)(?:-correct)?$/,
    );
    expect(leftMatch).not.toBeNull();
    expect(rightMatch).not.toBeNull();

    const leftCount = leftMatch![1];
    const rightCount = rightMatch![1];
    expect(leftCount).not.toBe(rightCount);

    const isLeftCorrect = leftId.endsWith("-correct");
    const correctPlate = isLeftCorrect ? leftPlate! : rightPlate!;
    const winCount = Number(isLeftCorrect ? leftCount : rightCount);
    const otherCount = Number(isLeftCorrect ? rightCount : leftCount);

    fireEvent.click(correctPlate);

    expect(sound.sfx.good).toHaveBeenCalledTimes(1);
    expect(sound.sayThen).toHaveBeenCalledTimes(1);

    // Badges are revealed on BOTH plates with exact count text
    const leftBadge = screen.getByTestId("compare-badge-left");
    const rightBadge = screen.getByTestId("compare-badge-right");
    expect(leftBadge.textContent).toBe(String(leftCount));
    expect(rightBadge.textContent).toBe(String(rightCount));

    // Badges are positioned outside plate buttons so critters are not obscured
    expect(leftPlate!.contains(leftBadge)).toBe(false);
    expect(rightPlate!.contains(rightBadge)).toBe(false);

    // Prompt retains prompt text from i18n
    const prompt = screen.getByTestId(/^compare-prompt-/);
    expect(prompt.textContent).toContain("Tap the side with more");

    // sayThen receives the exact comparative line and praise
    const callArgs = vi.mocked(sound.sayThen).mock.calls[0][0];
    const expectedFeedback = comparisonPhrase(
      "en",
      "more",
      winCount,
      otherCount,
    );
    expect(callArgs[0]).toBe(expectedFeedback);
    expect(callArgs[1]).toBe("That's right!");

    const speechPool = new Set(compareSpeechLines());
    expect(speechPool.has(callArgs[0])).toBe(true);
    expect(speechPool.has(callArgs[1])).toBe(true);

    // Advancing via callback resets locked state and hides badges for next round
    act(() => {
      queuedCb?.();
    });

    expect(screen.queryByTestId("compare-badge-left")).toBeNull();
    expect(screen.queryByTestId("compare-badge-right")).toBeNull();
  });

  it("positions revealed count badges outside plate area so bottom critters remain unobstructed", () => {
    let queuedCb: (() => void) | undefined;
    vi.spyOn(sound, "sayThen").mockImplementation((_lines, cb) => {
      queuedCb = cb;
    });

    render(<CompareGame onHome={vi.fn()} difficulty="hard" lang="en" />);

    const buttons = screen.getAllByRole("button");
    const leftPlate = buttons.find((btn) =>
      (btn.getAttribute("data-testid") || "").startsWith("compare-plate-left-"),
    )!;
    const rightPlate = buttons.find((btn) =>
      (btn.getAttribute("data-testid") || "").startsWith(
        "compare-plate-right-",
      ),
    )!;

    const isLeftCorrect = (
      leftPlate.getAttribute("data-testid") || ""
    ).endsWith("-correct");
    const correctPlate = isLeftCorrect ? leftPlate : rightPlate;

    fireEvent.click(correctPlate);

    const leftBadge = screen.getByTestId("compare-badge-left");
    const rightBadge = screen.getByTestId("compare-badge-right");

    // Badges must be rendered outside the plate buttons (as siblings in badgeSlot)
    expect(leftPlate.contains(leftBadge)).toBe(false);
    expect(rightPlate.contains(rightBadge)).toBe(false);

    // Badges are not inside any plate element
    expect(leftBadge.closest("[data-testid^='compare-plate-']")).toBeNull();
    expect(rightBadge.closest("[data-testid^='compare-plate-']")).toBeNull();

    act(() => {
      queuedCb?.();
    });
  });

  it("supports comparative feedback in Japanese (ja)", () => {
    render(<CompareGame onHome={vi.fn()} difficulty="easy" lang="ja" />);

    const buttons = screen.getAllByRole("button");
    const leftPlate = buttons.find((btn) =>
      (btn.getAttribute("data-testid") || "").startsWith("compare-plate-left-"),
    );
    const rightPlate = buttons.find((btn) =>
      (btn.getAttribute("data-testid") || "").startsWith(
        "compare-plate-right-",
      ),
    );
    expect(leftPlate).toBeDefined();
    expect(rightPlate).toBeDefined();

    const leftId = leftPlate!.getAttribute("data-testid") || "";
    const rightId = rightPlate!.getAttribute("data-testid") || "";
    const leftMatch = leftId.match(
      /^compare-plate-left-.*-(\d+)(?:-correct)?$/,
    );
    const rightMatch = rightId.match(
      /^compare-plate-right-.*-(\d+)(?:-correct)?$/,
    );
    expect(leftMatch).not.toBeNull();
    expect(rightMatch).not.toBeNull();

    const leftCount = leftMatch![1];
    const rightCount = rightMatch![1];
    expect(leftCount).not.toBe(rightCount);

    const isLeftCorrect = leftId.endsWith("-correct");
    const correctPlate = isLeftCorrect ? leftPlate! : rightPlate!;
    const winCount = Number(isLeftCorrect ? leftCount : rightCount);
    const otherCount = Number(isLeftCorrect ? rightCount : leftCount);

    fireEvent.click(correctPlate);

    const leftBadge = screen.getByTestId("compare-badge-left");
    const rightBadge = screen.getByTestId("compare-badge-right");
    expect(leftBadge.textContent).toBe(String(leftCount));
    expect(rightBadge.textContent).toBe(String(rightCount));

    const prompt = screen.getByTestId(/^compare-prompt-/);
    expect(prompt.textContent).toContain("おおいほうを タップ");

    const callArgs = vi.mocked(sound.sayThen).mock.calls[0][0];
    const expectedJaFeedback = comparisonPhrase(
      "ja",
      "more",
      winCount,
      otherCount,
    );
    expect(callArgs[0]).toBe(expectedJaFeedback);
    expect(callArgs[1]).toBe("せいかい！");

    const speechPool = new Set(compareSpeechLines());
    expect(speechPool.has(callArgs[0])).toBe(true);
    expect(speechPool.has(callArgs[1])).toBe(true);
  });
});

function LangHarness({
  difficulty = "easy",
  initialLang = "en",
}: {
  difficulty?: Difficulty;
  initialLang?: Lang;
}) {
  const [lang, setLang] = useState<Lang>(initialLang);
  const cycleLang = () => {
    setLang((l) =>
      l === "en" ? "ja" : l === "ja" ? "cmn" : l === "cmn" ? "yue" : "en",
    );
  };
  return (
    <LangContext.Provider value={{ lang, onCycle: cycleLang }}>
      <CompareGame onHome={noop} difficulty={difficulty} lang={lang} />
    </LangContext.Provider>
  );
}

describe("CompareGame language switch safety", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.spyOn(sound.sfx, "good").mockImplementation(() => {});
    vi.spyOn(sound.sfx, "wrong").mockImplementation(() => {});
    vi.spyOn(sound.sfx, "tap").mockImplementation(() => {});
    vi.spyOn(sound, "say").mockImplementation(() => {});
  });

  afterEach(() => {
    cleanup();
    vi.useRealTimers();
  });

  it("preserves active round and speaks new language prompt when language is cycled mid-round", () => {
    const saySpy = vi.spyOn(sound, "say");
    const makeRoundSpy = vi.spyOn(logic, "makeCompareRound");

    render(<LangHarness initialLang="en" />);

    expect(makeRoundSpy).toHaveBeenCalledTimes(1);

    // English prompt spoken initially
    expect(saySpy).toHaveBeenCalledWith(
      expect.stringMatching(/Tap the side with (MORE|FEWER)!/),
    );
    saySpy.mockClear();

    const leftPlate = screen
      .getByTestId(/^compare-plate-left-/)
      .getAttribute("data-testid");
    const rightPlate = screen
      .getByTestId(/^compare-plate-right-/)
      .getAttribute("data-testid");

    // Cycle language to Japanese via in-game header chip
    const langBtn = screen.getByTestId("lang-cycle");
    fireEvent.click(langBtn);

    // Active round is preserved: makeCompareRound not called again, plates unchanged
    expect(makeRoundSpy).toHaveBeenCalledTimes(1);
    expect(
      screen.getByTestId(/^compare-plate-left-/).getAttribute("data-testid"),
    ).toBe(leftPlate);
    expect(
      screen.getByTestId(/^compare-plate-right-/).getAttribute("data-testid"),
    ).toBe(rightPlate);

    // Prompt updated visually and spoken in Japanese
    const prompt = screen.getByTestId(/^compare-prompt-/);
    expect(prompt.textContent).toMatch(/(おおい|すくない)ほうを タップ/);
    expect(saySpy).toHaveBeenCalledWith(
      expect.stringMatching(/(おおい|すくない) ほうは どっち？/),
    );
  });

  it("cycles lang during praise: finishes praise, advances to next round, and avoids double-advancing score", () => {
    vi.useFakeTimers();
    const saySpy = vi.spyOn(sound, "say");
    const goodSpy = vi.spyOn(sound.sfx, "good");
    const makeRoundSpy = vi.spyOn(logic, "makeCompareRound");

    render(<LangHarness initialLang="en" />);

    // Initial mount called makeCompareRound once
    expect(makeRoundSpy).toHaveBeenCalledTimes(1);
    expect(screen.getByTestId("compare-score").textContent).toContain("0/6");

    // Tap correct plate for round 1
    const plates = [
      screen.getByTestId(/^compare-plate-left-/),
      screen.getByTestId(/^compare-plate-right-/),
    ];
    const correctPlate = plates.find((p) =>
      p.getAttribute("data-testid")?.endsWith("-correct"),
    )!;
    expect(correctPlate).toBeDefined();

    fireEvent.click(correctPlate);

    expect(goodSpy).toHaveBeenCalledTimes(1);
    expect(screen.getByTestId("compare-score").textContent).toContain("1/6");
    expect(screen.getByTestId("compare-badge-left")).toBeDefined();

    saySpy.mockClear();

    // Cycle language while praise/sayThen is active
    const langBtn = screen.getByTestId("lang-cycle");
    fireEvent.click(langBtn);

    // sayThen callback runs via stopNarration cancelPendingSayThen to advance game state to round 2
    expect(makeRoundSpy).toHaveBeenCalledTimes(2);

    // Score remains 1/6 (not advanced again or reset)
    expect(screen.getByTestId("compare-score").textContent).toContain("1/6");

    // Board is unlocked and badges are reset for the fresh round
    expect(screen.queryByTestId("compare-badge-left")).toBeNull();
    expect(screen.queryByTestId("compare-badge-right")).toBeNull();

    // Prompt is spoken in Japanese for the rebuilt round
    expect(saySpy).toHaveBeenCalledWith(
      expect.stringMatching(/(おおい|すくない) ほうは どっち？/),
    );

    // Play the fresh round in Japanese
    const nextPlates = [
      screen.getByTestId(/^compare-plate-left-/),
      screen.getByTestId(/^compare-plate-right-/),
    ];
    const nextCorrect = nextPlates.find((p) =>
      p.getAttribute("data-testid")?.endsWith("-correct"),
    )!;
    expect(nextCorrect).toBeDefined();

    fireEvent.click(nextCorrect);

    // Score advances cleanly to 2/6 without skipped rounds or double-advance
    expect(goodSpy).toHaveBeenCalledTimes(2);
    expect(screen.getByTestId("compare-score").textContent).toContain("2/6");
  });

  it("drops pending wrong-tap speech and unlock timers on language switch", () => {
    vi.useFakeTimers();
    const saySpy = vi.spyOn(sound, "say");
    const wrongSpy = vi.spyOn(sound.sfx, "wrong");

    render(<LangHarness initialLang="en" />);

    saySpy.mockClear();

    const plates = [
      screen.getByTestId(/^compare-plate-left-/),
      screen.getByTestId(/^compare-plate-right-/),
    ];
    const wrongPlate = plates.find(
      (p) => !p.getAttribute("data-testid")?.endsWith("-correct"),
    )!;
    expect(wrongPlate).toBeDefined();

    // Wrong plate tap sets 450ms and 500ms timeouts
    fireEvent.click(wrongPlate);
    expect(wrongSpy).toHaveBeenCalledTimes(1);

    // Advance 100ms (still within error state)
    act(() => {
      vi.advanceTimersByTime(100);
    });

    // Cycle language mid-timeout
    const langBtn = screen.getByTestId("lang-cycle");
    fireEvent.click(langBtn);

    // New Japanese prompt spoken
    expect(saySpy).toHaveBeenCalledWith(
      expect.stringMatching(/(おおい|すくない) ほうは どっち？/),
    );
    saySpy.mockClear();

    // Advance past the old 450ms and 500ms marks
    act(() => {
      vi.advanceTimersByTime(1000);
    });

    // The old 500ms setTimeout did NOT speak the old English prompt
    expect(saySpy).not.toHaveBeenCalledWith("Tap the side with MORE!");
    expect(saySpy).not.toHaveBeenCalledWith("Tap the side with FEWER!");

    // Board is interactive and can be answered correctly
    const freshPlates = [
      screen.getByTestId(/^compare-plate-left-/),
      screen.getByTestId(/^compare-plate-right-/),
    ];
    const freshCorrect = freshPlates.find((p) =>
      p.getAttribute("data-testid")?.endsWith("-correct"),
    )!;
    fireEvent.click(freshCorrect);

    expect(screen.getByTestId("compare-score").textContent).toContain("1/6");
  });
});

describe("CompareGame unmount safety", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.spyOn(sound.sfx, "wrong").mockImplementation(() => {});
    vi.spyOn(sound.sfx, "good").mockImplementation(() => {});
    vi.spyOn(sound, "say").mockImplementation(() => {});
  });

  afterEach(() => {
    cleanup();
    vi.useRealTimers();
  });

  it("clears wrong-tap timeouts without leaking audio or state updates after unmount", () => {
    vi.useFakeTimers();
    const saySpy = vi.spyOn(sound, "say");
    const { unmount } = render(
      <CompareGame onHome={() => {}} difficulty="easy" lang="en" />,
    );
    saySpy.mockClear();

    const plates = [
      screen.getByTestId(/^compare-plate-left-/),
      screen.getByTestId(/^compare-plate-right-/),
    ];
    const wrongPlate = plates.find(
      (p) => !p.getAttribute("data-testid")?.endsWith("-correct"),
    )!;

    fireEvent.click(wrongPlate);

    // Unmount before the 450ms / 500ms timeouts fire
    unmount();

    // Advance past 500ms
    act(() => {
      vi.advanceTimersByTime(1000);
    });

    // Voice prompt should not fire on home screen
    expect(saySpy).not.toHaveBeenCalled();
  });

  it("prevents correct-tap sayThen callback from executing state updates on unmounted component when exiting mid-narration", () => {
    let sayThenCb: (() => void) | null = null;
    vi.spyOn(sound, "sayThen").mockImplementation((_lines, cb) => {
      sayThenCb = cb ?? null;
    });
    const makeRoundSpy = vi.spyOn(logic, "makeCompareRound");

    const { unmount } = render(
      <CompareGame onHome={() => {}} difficulty="easy" lang="en" />,
    );
    expect(makeRoundSpy).toHaveBeenCalledTimes(1);

    const plates = [
      screen.getByTestId(/^compare-plate-left-/),
      screen.getByTestId(/^compare-plate-right-/),
    ];
    const correctPlate = plates.find((p) =>
      p.getAttribute("data-testid")?.endsWith("-correct"),
    )!;

    fireEvent.click(correctPlate);
    expect(sayThenCb).not.toBeNull();

    // Unmount while sayThen celebration is active
    unmount();

    // Invoking callback after unmount should be a no-op
    act(() => {
      sayThenCb!();
    });

    // makeCompareRound should not be called again on unmounted component
    expect(makeRoundSpy).toHaveBeenCalledTimes(1);
  });
});

describe("CompareGame plate accessibility labels", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.spyOn(sound.sfx, "good").mockImplementation(() => {});
    vi.spyOn(sound.sfx, "wrong").mockImplementation(() => {});
    vi.spyOn(sound, "say").mockImplementation(() => {});
  });

  afterEach(() => {
    cleanup();
  });

  it("renders plates with localized accessibility labels across all languages", () => {
    vi.spyOn(logic, "makeCompareRound").mockReturnValue({
      left: { icon: "dog", count: 5, positions: [] },
      right: { icon: "star", count: 7, positions: [] },
      ask: "more",
      correctSide: "right",
    });

    render(<CompareGame onHome={noop} difficulty="easy" lang="en" />);
    expect(
      screen.getByTestId(/^compare-plate-left-/).getAttribute("aria-label"),
    ).toBe("5 dog");
    expect(
      screen.getByTestId(/^compare-plate-right-/).getAttribute("aria-label"),
    ).toBe("7 star");
    cleanup();

    render(<CompareGame onHome={noop} difficulty="easy" lang="ja" />);
    expect(
      screen.getByTestId(/^compare-plate-left-/).getAttribute("aria-label"),
    ).toBe("5 いぬ");
    expect(
      screen.getByTestId(/^compare-plate-right-/).getAttribute("aria-label"),
    ).toBe("7 ほし");
    cleanup();

    render(<CompareGame onHome={noop} difficulty="easy" lang="cmn" />);
    expect(
      screen.getByTestId(/^compare-plate-left-/).getAttribute("aria-label"),
    ).toBe("5 狗");
    expect(
      screen.getByTestId(/^compare-plate-right-/).getAttribute("aria-label"),
    ).toBe("7 星星");
    cleanup();

    render(<CompareGame onHome={noop} difficulty="easy" lang="yue" />);
    expect(
      screen.getByTestId(/^compare-plate-left-/).getAttribute("aria-label"),
    ).toBe("5 狗");
    expect(
      screen.getByTestId(/^compare-plate-right-/).getAttribute("aria-label"),
    ).toBe("7 星星");
  });

  it("updates plate accessibility labels when language is cycled", () => {
    let roundIndex = 0;
    const rounds: logic.CompareRound[] = [
      {
        left: { icon: "dog", count: 5, positions: [] },
        right: { icon: "butterfly", count: 3, positions: [] },
        ask: "more",
        correctSide: "left",
      },
      {
        left: { icon: "frog", count: 2, positions: [] },
        right: { icon: "rabbit", count: 6, positions: [] },
        ask: "more",
        correctSide: "right",
      },
    ];
    vi.spyOn(logic, "makeCompareRound").mockImplementation(
      () => rounds[roundIndex++ % rounds.length],
    );

    render(<LangHarness initialLang="en" />);
    expect(
      screen.getByTestId(/^compare-plate-left-/).getAttribute("aria-label"),
    ).toBe("5 dog");
    expect(
      screen.getByTestId(/^compare-plate-right-/).getAttribute("aria-label"),
    ).toBe("3 butterfly");

    // Cycle language to Japanese
    const langBtn = screen.getByTestId("lang-cycle");
    fireEvent.click(langBtn);

    expect(
      screen.getByTestId(/^compare-plate-left-/).getAttribute("aria-label"),
    ).toBe("5 いぬ");
    expect(
      screen.getByTestId(/^compare-plate-right-/).getAttribute("aria-label"),
    ).toBe("3 ちょうちょ");
  });
});

describe("CompareGame on-screen prompt localization", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.spyOn(sound, "say").mockImplementation(() => {});
    vi.spyOn(sound, "sayThen").mockImplementation((_, cb) => cb && cb());
    vi.spyOn(sfx, "tap").mockImplementation(() => {});
  });

  afterEach(() => {
    cleanup();
  });

  const cases: {
    lang: Lang;
    ask: "more" | "fewer";
    expectedKey: "shell.compare.subMore" | "shell.compare.subFewer";
  }[] = [
    { lang: "en", ask: "more", expectedKey: "shell.compare.subMore" },
    { lang: "en", ask: "fewer", expectedKey: "shell.compare.subFewer" },
    { lang: "ja", ask: "more", expectedKey: "shell.compare.subMore" },
    { lang: "ja", ask: "fewer", expectedKey: "shell.compare.subFewer" },
    { lang: "cmn", ask: "more", expectedKey: "shell.compare.subMore" },
    { lang: "cmn", ask: "fewer", expectedKey: "shell.compare.subFewer" },
    { lang: "yue", ask: "more", expectedKey: "shell.compare.subMore" },
    { lang: "yue", ask: "fewer", expectedKey: "shell.compare.subFewer" },
  ];

  for (const { lang, ask, expectedKey } of cases) {
    it(`routes prompt text through i18n table for ${lang} (${ask})`, () => {
      vi.spyOn(logic, "makeCompareRound").mockReturnValue({
        left: { icon: "star", count: 3, positions: [] },
        right: { icon: "dog", count: 6, positions: [] },
        ask,
        correctSide: ask === "more" ? "right" : "left",
      });

      const saySpy = vi.spyOn(sound, "say");
      render(<CompareGame onHome={noop} difficulty="easy" lang={lang} />);

      const expectedUI = t(lang, expectedKey);
      const expectedSpoken =
        ask === "more" ? logic.MORE_PROMPT[lang] : logic.FEWER_PROMPT[lang];

      const promptBtn = screen.getByTestId(`compare-prompt-${ask}`);
      expect(within(promptBtn).getByText(expectedUI)).toBeDefined();
      expect(promptBtn.getAttribute("aria-label")).toBe(expectedUI);

      // Verify spoken text uses conversational prompt from logic, not UI text
      expect(saySpy).toHaveBeenCalledWith(expectedSpoken);
    });
  }
});

