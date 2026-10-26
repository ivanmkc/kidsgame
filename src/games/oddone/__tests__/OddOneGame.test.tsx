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
    vi.useFakeTimers();
    try {
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
      expect(makeRoundSpy).toHaveBeenCalledTimes(1);
      expect(sfx.good).toHaveBeenCalledTimes(1);

      act(() => {
        vi.advanceTimersByTime(600);
      });

      expect(makeRoundSpy).toHaveBeenCalledTimes(2);
      const round2 = generatedRounds[1];
      expect(
        container.querySelector(
          `[data-testid="oddone-question-${round2.baseCategory}"]`,
        ),
      ).toBeTruthy();
    } finally {
      vi.useRealTimers();
    }
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

  it("shows celebration feedback on correct tile pick and delays round swap by 600ms", () => {
    vi.useFakeTimers();
    try {
      const { container } = render(
        <OddOneGame onHome={() => {}} difficulty="easy" lang="en" />,
      );
      const correctBtn = container.querySelector(
        '[data-testid$="-odd"]',
      ) as HTMLElement;
      const initialOddTestId = correctBtn.getAttribute("data-testid");
      expect(initialOddTestId).toBeTruthy();

      // Before click: no celebration sparkles
      expect(correctBtn.textContent).not.toMatch(/✨|⭐/);

      // Tap correct odd tile
      act(() => {
        fireEvent.click(correctBtn);
      });

      expect(sfx.good).toHaveBeenCalledTimes(1);
      expect(
        container.querySelector('[data-testid="oddone-score"]')?.textContent,
      ).toContain("1/10");

      // Visual feedback: celebration sparkles active on chosen tile
      expect(correctBtn.textContent).toMatch(/✨|⭐/);

      // The round has NOT swapped immediately on the same tick; the initial odd tile is still mounted
      expect(
        container.querySelector(`[data-testid="${initialOddTestId}"]`),
      ).toBeTruthy();

      // Stray tap on another tile during celebration is locked out
      const otherBtn = Array.from(
        container.querySelectorAll('[data-testid^="oddone-item-"]'),
      ).find((b) => b !== correctBtn) as HTMLElement;
      act(() => {
        fireEvent.click(otherBtn);
      });
      expect(sfx.wrong).not.toHaveBeenCalled();

      // At 599ms: round still hasn't swapped
      act(() => {
        vi.advanceTimersByTime(599);
      });
      expect(
        container.querySelector(`[data-testid="${initialOddTestId}"]`),
      ).toBeTruthy();

      // At 600ms: round advances to round 2
      act(() => {
        vi.advanceTimersByTime(1);
      });

      // Celebration sparkles cleared, next round is active
      const newButtons = container.querySelectorAll(
        '[data-testid^="oddone-item-"]',
      );
      newButtons.forEach((btn) => {
        expect(btn.textContent).not.toMatch(/✨|⭐/);
      });
    } finally {
      vi.useRealTimers();
    }
  });

  it("delays WinOverlay mount and sfx.win by 600ms on final winning round", () => {
    vi.useFakeTimers();
    try {
      const { container } = render(
        <OddOneGame onHome={() => {}} difficulty="easy" lang="en" />,
      );

      // Play 9 rounds to reach round 10 (easy difficulty spotitRounds is 10)
      for (let r = 0; r < 9; r++) {
        const correctBtn = container.querySelector(
          '[data-testid$="-odd"]',
        ) as HTMLElement;
        expect(correctBtn).toBeTruthy();
        act(() => {
          fireEvent.click(correctBtn);
        });
        act(() => {
          vi.advanceTimersByTime(600);
        });
      }

      expect(
        container.querySelector('[data-testid="oddone-score"]')?.textContent,
      ).toContain("9/10");

      vi.mocked(sfx.good).mockClear();
      vi.mocked(sfx.win).mockClear();

      // Tap final winning tile (round 10)
      const winningBtn = container.querySelector(
        '[data-testid$="-odd"]',
      ) as HTMLElement;
      expect(winningBtn).toBeTruthy();

      act(() => {
        fireEvent.click(winningBtn);
      });

      // Immediately: sfx.good fires, score increments, tile celebrates, WinOverlay is deferred
      expect(sfx.good).toHaveBeenCalledTimes(1);
      expect(sfx.win).not.toHaveBeenCalled();
      expect(
        container.querySelector('[data-testid="oddone-score"]')?.textContent,
      ).toContain("10/10");
      expect(winningBtn.textContent).toMatch(/✨|⭐/);
      expect(container.querySelector('[data-testid="win-overlay"]')).toBeNull();

      // Stray tap during celebration is ignored
      act(() => {
        fireEvent.click(winningBtn);
      });
      expect(sfx.good).toHaveBeenCalledTimes(1);

      // At 599ms: WinOverlay still not mounted
      act(() => {
        vi.advanceTimersByTime(599);
      });
      expect(sfx.win).not.toHaveBeenCalled();
      expect(container.querySelector('[data-testid="win-overlay"]')).toBeNull();

      // At 600ms: WinOverlay mounts and sfx.win fires
      act(() => {
        vi.advanceTimersByTime(1);
      });
      expect(sfx.win).toHaveBeenCalledTimes(1);
      expect(
        container.querySelector('[data-testid="win-overlay"]'),
      ).toBeTruthy();
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
    vi.useFakeTimers();
    try {
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
        act(() => {
          vi.advanceTimersByTime(600);
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
    } finally {
      vi.useRealTimers();
    }
  });

  it("speaks localized category prompt for non-English languages", () => {
    vi.spyOn(logic, "makeOddOneRound").mockImplementationOnce(() => ({
      baseCategory: "animals",
      oddCategory: "food",
      odd: "apple",
      items: ["dog", "cat", "lion", "apple"],
      oddIndex: 3,
    }));
    render(<OddOneGame onHome={() => {}} difficulty="easy" lang="ja" />);
    expect(say).toHaveBeenCalledWith("どうぶつじゃないのは？");
  });

  describe("speechLines", () => {
    it("exports all 16 prompt lines across all categories and languages", () => {
      const lines = logic.speechLines();
      expect(lines).toHaveLength(16);
      expect(lines).toContain("Which one is NOT an animal?");
      expect(lines).toContain("どうぶつじゃないのは？");
      expect(lines).toContain("哪一个不是动物？");
      expect(lines).toContain("邊個唔係動物？");
      expect(new Set(lines).size).toBe(16);
    });
  });

  it("uses translated fallback question when category lacks translation", () => {
    vi.spyOn(logic, "makeOddOneRound").mockImplementation(() => ({
      baseCategory: "unknown_category",
      oddCategory: "animals",
      odd: "cat",
      items: ["balloon", "car", "cat", "plane"],
      oddIndex: 2,
    }));

    const { container } = render(
      <OddOneGame onHome={() => {}} difficulty="easy" lang="ja" />,
    );
    const banner = container.querySelector(
      '[data-testid^="oddone-question-"]',
    ) as HTMLElement;
    expect(banner).toBeTruthy();
    expect(banner.textContent).toBe("ひとつだけ なかまじゃないのは？");
    expect(say).toHaveBeenCalledWith("ひとつだけ なかまじゃないのは？");
  });
});
