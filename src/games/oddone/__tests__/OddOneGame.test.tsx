// @vitest-environment happy-dom
import React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
} from "@testing-library/react";
import * as difficultyModule from "../../../difficulty";
import * as logic from "../logic";
import { sfx } from "../../../sound";
import { OddOneGame } from "../OddOneGame";

vi.mock("../../../sound", () => ({
  say: vi.fn(),
  sfx: {
    good: vi.fn(),
    wrong: vi.fn(),
    tap: vi.fn(),
    win: vi.fn(),
    flip: vi.fn(),
    boing: vi.fn(),
    thunder: vi.fn(),
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

  it("resets and unlocks when starting a new round after winning", () => {
    vi.useFakeTimers();
    try {
      const fakeSettings: Partial<difficultyModule.DifficultySettings> = {
        spotitRounds: 1,
        timer: false,
      };
      vi.spyOn(difficultyModule, "settingsFor").mockReturnValue(
        fakeSettings as difficultyModule.DifficultySettings,
      );

      render(<OddOneGame onHome={() => {}} difficulty="easy" lang="en" />);

      const oddTile = screen.getByTestId(/-odd$/);
      fireEvent.click(oddTile);
      expect(sfx.good).toHaveBeenCalledTimes(1);

      // Let win overlay animation arm the buttons
      act(() => {
        vi.advanceTimersByTime(1000);
      });

      const playAgainBtn = screen.getByTestId("play-again");
      fireEvent.click(playAgainBtn);

      // Should be back in game with score reset
      expect(screen.getByTestId("oddone-score").textContent).toContain("0/1");

      // Should be unlocked and responsive to taps
      const nextOddTile = screen.getByTestId(/-odd$/);
      fireEvent.click(nextOddTile);
      expect(sfx.good).toHaveBeenCalledTimes(2);
    } finally {
      vi.useRealTimers();
    }
  });
});
