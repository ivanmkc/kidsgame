// @vitest-environment happy-dom
import React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render } from "@testing-library/react";
import { OddOneGame } from "../OddOneGame";
import * as logic from "../logic";
import { say, sfx } from "../../../sound";

vi.mock("../../../sound", () => ({
  say: vi.fn(),
  sfx: {
    good: vi.fn(),
    wrong: vi.fn(),
    tap: vi.fn(),
    win: vi.fn(),
  },
}));

describe("OddOneGame", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.clearAllMocks();
  });

  afterEach(() => {
    cleanup();
  });

  it("renders a 2-column grid for 4 tiles on easy difficulty", () => {
    const { container } = render(
      <OddOneGame onHome={() => {}} difficulty="easy" lang="en" />,
    );
    const buttons = container.querySelectorAll('[data-testid^="oddone-item-"]');
    expect(buttons).toHaveLength(4);
    const grid = buttons[0]?.parentElement;
    expect(grid).toBeTruthy();
    const tileWidth = parseFloat((buttons[0] as HTMLElement).style.width);
    const gridWidth = parseFloat((grid as HTMLElement).style.width);
    const gap = 12;
    // For cols = 2, grid width is 2 * tile + gap.
    // For cols = 3, grid width is 3 * tile + 2 * gap.
    const cols = Math.round((gridWidth + gap) / (tileWidth + gap));
    expect(cols).toBe(2);
  });

  it("renders a 3-column grid for 6 tiles on medium difficulty", () => {
    const { container } = render(
      <OddOneGame onHome={() => {}} difficulty="medium" lang="en" />,
    );
    const buttons = container.querySelectorAll('[data-testid^="oddone-item-"]');
    expect(buttons).toHaveLength(6);
    const grid = buttons[0]?.parentElement;
    expect(grid).toBeTruthy();
    const tileWidth = parseFloat((buttons[0] as HTMLElement).style.width);
    const gridWidth = parseFloat((grid as HTMLElement).style.width);
    const gap = 12;
    const cols = Math.round((gridWidth + gap) / (tileWidth + gap));
    expect(cols).toBe(3);
  });

  it("renders a 3-column grid for 9 tiles on hard difficulty", () => {
    const { container } = render(
      <OddOneGame onHome={() => {}} difficulty="hard" lang="en" />,
    );
    const buttons = container.querySelectorAll('[data-testid^="oddone-item-"]');
    expect(buttons).toHaveLength(9);
    const grid = buttons[0]?.parentElement;
    expect(grid).toBeTruthy();
    const tileWidth = parseFloat((buttons[0] as HTMLElement).style.width);
    const gridWidth = parseFloat((grid as HTMLElement).style.width);
    const gap = 12;
    const cols = Math.round((gridWidth + gap) / (tileWidth + gap));
    expect(cols).toBe(3);
  });

  it("prevents fast-tap hammering from advancing the round and RNG twice", () => {
    const generatedRounds: logic.OddOneRound[] = [];
    const origMakeOddOneRound = logic.makeOddOneRound;
    const makeRoundSpy = vi
      .spyOn(logic, "makeOddOneRound")
      .mockImplementation((rng, icons, n) => {
        const res = origMakeOddOneRound(rng, icons, n);
        generatedRounds.push(res);
        return res;
      });

    const { container } = render(
      <OddOneGame onHome={() => {}} difficulty="easy" lang="en" />,
    );

    expect(makeRoundSpy).toHaveBeenCalledTimes(1);

    const correctBtn = container.querySelector(
      '[data-testid$="-odd"]',
    ) as HTMLElement;
    expect(correctBtn).toBeTruthy();

    act(() => {
      fireEvent.click(correctBtn);
      fireEvent.click(correctBtn);
    });

    expect(
      container.querySelector('[data-testid="oddone-score"]')?.textContent,
    ).toContain("1/10");
    expect(makeRoundSpy).toHaveBeenCalledTimes(2);
    expect(sfx.good).toHaveBeenCalledTimes(1);

    const round2 = generatedRounds[1];
    expect(
      container.querySelector(
        `[data-testid="oddone-question-${round2.baseCategory}"]`,
      ),
    ).toBeTruthy();
  });

  it("locks input during wrong-tap feedback and unlocks after timeout", () => {
    vi.useFakeTimers();
    try {
      const { container } = render(
        <OddOneGame onHome={() => {}} difficulty="easy" lang="en" />,
      );
      const buttons = container.querySelectorAll(
        '[data-testid^="oddone-item-"]',
      );
      const wrongBtn = Array.from(buttons).find(
        (b) => !b.getAttribute("data-testid")?.endsWith("-odd"),
      ) as HTMLElement;
      expect(wrongBtn).toBeTruthy();

      // Tap wrong tile
      act(() => {
        fireEvent.click(wrongBtn);
      });
      expect(sfx.wrong).toHaveBeenCalledTimes(1);

      // Attempt tapping the correct tile while wrong feedback is active: blocked
      const correctBtn = container.querySelector(
        '[data-testid$="-odd"]',
      ) as HTMLElement;
      act(() => {
        fireEvent.click(correctBtn);
      });
      expect(sfx.good).not.toHaveBeenCalled();
      expect(
        container.querySelector('[data-testid="oddone-score"]')?.textContent,
      ).toContain("0/10");

      // Fast-forward past the 450ms wrong flash
      act(() => {
        vi.advanceTimersByTime(450);
      });

      // Now tapping the correct tile works
      act(() => {
        fireEvent.click(correctBtn);
      });

      expect(sfx.good).toHaveBeenCalledTimes(1);
      expect(
        container.querySelector('[data-testid="oddone-score"]')?.textContent,
      ).toContain("1/10");
    } finally {
      vi.useRealTimers();
    }
  });

  it("renders question banner as a button and replays prompt audio on tap", () => {
    const { container } = render(
      <OddOneGame onHome={() => {}} difficulty="easy" lang="en" />,
    );
    const banner = container.querySelector(
      '[data-testid^="oddone-question-"]',
    ) as HTMLElement;
    expect(banner).toBeTruthy();
    expect(banner.getAttribute("role")).toBe("button");

    expect(say).toHaveBeenCalledTimes(1);
    const initialPrompt = vi.mocked(say).mock.calls[0][0];
    expect(banner.textContent).toBe(initialPrompt);

    act(() => {
      fireEvent.click(banner);
    });

    expect(sfx.tap).toHaveBeenCalledTimes(1);
    expect(say).toHaveBeenCalledTimes(2);
    expect(vi.mocked(say).mock.calls[1][0]).toBe(initialPrompt);
  });

  it("disables question banner replay when game is won", () => {
    vi.spyOn(logic, "makeOddOneRound").mockImplementation(() => ({
      baseCategory: "food",
      oddCategory: "animals",
      odd: "cat",
      items: ["apple", "banana", "cat", "pizza"],
      oddIndex: 2,
    }));

    const { container } = render(
      <OddOneGame onHome={() => {}} difficulty="easy" lang="en" />,
    );
    const banner = container.querySelector(
      '[data-testid^="oddone-question-"]',
    ) as HTMLElement;
    expect(banner).toBeTruthy();

    // Advance 10 rounds to win (easy spotitRounds = 10)
    for (let i = 0; i < 10; i++) {
      const correctBtn = container.querySelector(
        '[data-testid$="-odd"]',
      ) as HTMLElement;
      expect(correctBtn).toBeTruthy();
      act(() => {
        fireEvent.click(correctBtn);
      });
    }

    expect(
      container.querySelector('[data-testid="oddone-score"]')?.textContent,
    ).toContain("10/10");

    vi.mocked(say).mockClear();
    vi.mocked(sfx.tap).mockClear();

    act(() => {
      fireEvent.click(banner);
    });

    expect(sfx.tap).not.toHaveBeenCalled();
    expect(say).not.toHaveBeenCalled();
  });
});
