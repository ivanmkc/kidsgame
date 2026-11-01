// @vitest-environment happy-dom
import React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render } from "@testing-library/react";
import { OddOneGame } from "../OddOneGame";
import * as logic from "../logic";
import { say, sfx, stopNarration } from "../../../sound";
import { CATEGORY_TEXT, CURRICULUM } from "../../../curriculum/content";
import { Lang, LANGS } from "../../../lang";
import { LangContext } from "../../../components/GameShell";
import { t } from "../../../i18n";

vi.mock("../../../sound", () => ({
  say: vi.fn(),
  stopNarration: vi.fn(),
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

  it("clamps minimum tile size to 60px on short viewports to prevent negative dimensions", () => {
    const originalWidth = window.innerWidth;
    const originalHeight = window.innerHeight;
    Object.defineProperty(window, "innerWidth", {
      value: 800,
      configurable: true,
    });
    Object.defineProperty(window, "innerHeight", {
      value: 100,
      configurable: true,
    });
    try {
      const { container } = render(
        <OddOneGame onHome={() => {}} difficulty="easy" lang="en" />,
      );
      const buttons = container.querySelectorAll(
        '[data-testid^="oddone-item-"]',
      );
      expect(buttons.length).toBeGreaterThan(0);
      const tileWidth = parseFloat((buttons[0] as HTMLElement).style.width);
      expect(tileWidth).toBe(60);
    } finally {
      Object.defineProperty(window, "innerWidth", {
        value: originalWidth,
        configurable: true,
      });
      Object.defineProperty(window, "innerHeight", {
        value: originalHeight,
        configurable: true,
      });
    }
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

  it("does not block input after a wrong tap and allows immediate correction", () => {
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

      // Immediately tap the correct tile without waiting for the 450ms timeout
      const correctBtn = container.querySelector(
        '[data-testid$="-odd"]',
      ) as HTMLElement;
      act(() => {
        fireEvent.click(correctBtn);
      });
      expect(sfx.good).toHaveBeenCalledTimes(1);
      expect(
        container.querySelector('[data-testid="oddone-score"]')?.textContent,
      ).toContain("1/10");

      // Advance timers to complete celebration
      act(() => {
        vi.advanceTimersByTime(600);
      });
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

  it("stops the timer immediately on final round answer during celebration delay", () => {
    vi.useFakeTimers();
    try {
      const { container } = render(
        <OddOneGame onHome={() => {}} difficulty="medium" lang="en" />,
      );

      const timerEl = container.querySelector('[data-testid="oddone-timer"]');
      expect(timerEl).toBeTruthy();
      expect(timerEl?.textContent).toContain("0:00");

      act(() => {
        vi.advanceTimersByTime(5000);
      });
      expect(timerEl?.textContent).toContain("0:05");

      for (let r = 0; r < 11; r++) {
        const correctBtn = container.querySelector(
          '[data-testid$="-odd"]',
        ) as HTMLElement;
        act(() => {
          fireEvent.click(correctBtn);
        });
        act(() => {
          vi.advanceTimersByTime(600);
        });
      }

      // When score reaches 12 (roundsToWin), score < roundsToWin becomes false,
      // so elapsed stops. 5000ms + 11 * 600ms = 11600ms = 0:11.
      const timeBeforeFinal = timerEl?.textContent;
      expect(timeBeforeFinal).toEqual("0:11");

      const winningBtn = container.querySelector(
        '[data-testid$="-odd"]',
      ) as HTMLElement;
      act(() => {
        fireEvent.click(winningBtn);
      });

      act(() => {
        vi.advanceTimersByTime(300);
      });
      const timeDuringCelebration = timerEl?.textContent;

      act(() => {
        vi.advanceTimersByTime(300);
      });
      const timeAfterCelebration = timerEl?.textContent;

      expect(timeDuringCelebration).toEqual(timeBeforeFinal);
      expect(timeAfterCelebration).toEqual(timeBeforeFinal);
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
    expect(banner.textContent).toBe(`🔊 ${initialPrompt}`);

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

  it("resolves category prompt question from centralized i18n table", () => {
    vi.spyOn(logic, "makeOddOneRound").mockImplementationOnce(() => ({
      baseCategory: "animals",
      oddCategory: "food",
      odd: "apple",
      items: ["dog", "cat", "lion", "apple"],
      oddIndex: 3,
    }));
    const { container, rerender } = render(
      <OddOneGame onHome={() => {}} difficulty="easy" lang="en" />,
    );
    const banner = container.querySelector(
      '[data-testid^="oddone-question-"]',
    ) as HTMLElement;
    expect(banner.textContent).toBe(`🔊 ${t("en", "oddone.not.animals")}`);

    rerender(<OddOneGame onHome={() => {}} difficulty="easy" lang="ja" />);
    expect(banner.textContent).toBe(`🔊 ${t("ja", "oddone.not.animals")}`);

    rerender(<OddOneGame onHome={() => {}} difficulty="easy" lang="cmn" />);
    expect(banner.textContent).toBe(`🔊 ${t("cmn", "oddone.not.animals")}`);

    rerender(<OddOneGame onHome={() => {}} difficulty="easy" lang="yue" />);
    expect(banner.textContent).toBe(`🔊 ${t("yue", "oddone.not.animals")}`);
  });

  it("stores centralized UIKey references in CATEGORY_TEXT", () => {
    for (const [catName, { not }] of Object.entries(CATEGORY_TEXT)) {
      expect(not).toBe(`oddone.not.${catName}`);
      for (const l of ["en", "ja", "cmn", "yue"] as const) {
        expect(t(l, not)).toBeTruthy();
      }
    }
  });

  describe("speechLines", () => {
    it("exports all 20 prompt lines across categories, fallback, and languages", () => {
      const lines = logic.speechLines();
      expect(lines).toHaveLength(20);
      expect(lines).toContain("Which one is NOT an animal?");
      expect(lines).toContain("どうぶつじゃないのは？");
      expect(lines).toContain("哪一个不是动物？");
      expect(lines).toContain("邊個唔係動物？");
      expect(lines).toContain(t("en", "oddone.defaultQuestion"));
      expect(lines).toContain(t("ja", "oddone.defaultQuestion"));
      expect(lines).toContain(t("cmn", "oddone.defaultQuestion"));
      expect(lines).toContain(t("yue", "oddone.defaultQuestion"));
      expect(new Set(lines).size).toBe(20);
    });

    it("includes oddone.defaultQuestion across all supported languages", () => {
      const lines = new Set(logic.speechLines());
      for (const l of LANGS) {
        expect(lines.has(t(l.id, "oddone.defaultQuestion"))).toBe(true);
      }
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
    expect(banner.textContent).toBe("🔊 ひとつだけ なかまじゃないのは？");
    expect(say).toHaveBeenCalledWith("ひとつだけ なかまじゃないのは？");
  });

  it("displays speaker icon (🔊) in question card for pre-readers across languages", () => {
    vi.spyOn(logic, "makeOddOneRound").mockImplementation(() => ({
      baseCategory: "food",
      oddCategory: "animals",
      odd: "cat",
      items: ["apple", "banana", "cat", "pizza"],
      oddIndex: 2,
    }));

    const { container, rerender } = render(
      <OddOneGame onHome={() => {}} difficulty="easy" lang="en" />,
    );
    let banner = container.querySelector(
      '[data-testid^="oddone-question-"]',
    ) as HTMLElement;
    expect(banner.textContent).toBe("🔊 Which one is NOT food?");
    expect(banner.textContent).toContain("🔊");

    rerender(<OddOneGame onHome={() => {}} difficulty="easy" lang="ja" />);
    banner = container.querySelector(
      '[data-testid^="oddone-question-"]',
    ) as HTMLElement;
    expect(banner.textContent).toBe("🔊 たべものじゃないのは？");

    rerender(<OddOneGame onHome={() => {}} difficulty="easy" lang="cmn" />);
    banner = container.querySelector(
      '[data-testid^="oddone-question-"]',
    ) as HTMLElement;
    expect(banner.textContent).toBe("🔊 哪一个不是食物？");

    rerender(<OddOneGame onHome={() => {}} difficulty="easy" lang="yue" />);
    banner = container.querySelector(
      '[data-testid^="oddone-question-"]',
    ) as HTMLElement;
    expect(banner.textContent).toBe("🔊 邊個唔係食物？");
  });

  it("localizes item tile accessibility labels according to lang", () => {
    vi.spyOn(logic, "makeOddOneRound").mockImplementation(() => ({
      baseCategory: "food",
      oddCategory: "animals",
      odd: "dog",
      items: ["apple", "banana", "cat", "dog"],
      oddIndex: 3,
    }));

    const { container, rerender } = render(
      <OddOneGame onHome={() => {}} difficulty="easy" lang="ja" />,
    );
    const tilesJa = container.querySelectorAll('[data-testid^="oddone-item-"]');
    expect(tilesJa).toHaveLength(4);
    expect(tilesJa[0]?.getAttribute("aria-label")).toBe("りんご");
    expect(tilesJa[1]?.getAttribute("aria-label")).toBe("バナナ");
    expect(tilesJa[2]?.getAttribute("aria-label")).toBe("ねこ");
    expect(tilesJa[3]?.getAttribute("aria-label")).toBe("いぬ");

    rerender(<OddOneGame onHome={() => {}} difficulty="easy" lang="cmn" />);
    const tilesCmn = container.querySelectorAll(
      '[data-testid^="oddone-item-"]',
    );
    expect(tilesCmn[0]?.getAttribute("aria-label")).toBe("苹果");
    expect(tilesCmn[1]?.getAttribute("aria-label")).toBe("香蕉");
    expect(tilesCmn[2]?.getAttribute("aria-label")).toBe("猫");
    expect(tilesCmn[3]?.getAttribute("aria-label")).toBe("狗");

    rerender(<OddOneGame onHome={() => {}} difficulty="easy" lang="yue" />);
    const tilesYue = container.querySelectorAll(
      '[data-testid^="oddone-item-"]',
    );
    expect(tilesYue[0]?.getAttribute("aria-label")).toBe("蘋果");
    expect(tilesYue[1]?.getAttribute("aria-label")).toBe("香蕉");
    expect(tilesYue[2]?.getAttribute("aria-label")).toBe("貓");
    expect(tilesYue[3]?.getAttribute("aria-label")).toBe("狗");

    rerender(<OddOneGame onHome={() => {}} difficulty="easy" lang="en" />);
    const tilesEn = container.querySelectorAll('[data-testid^="oddone-item-"]');
    expect(tilesEn[0]?.getAttribute("aria-label")).toBe("apple");
    expect(tilesEn[1]?.getAttribute("aria-label")).toBe("banana");
    expect(tilesEn[2]?.getAttribute("aria-label")).toBe("cat");
    expect(tilesEn[3]?.getAttribute("aria-label")).toBe("dog");
  });

  it("announces the correct intruder item name for vocabulary reinforcement on pick", () => {
    vi.spyOn(logic, "makeOddOneRound").mockImplementationOnce(() => ({
      baseCategory: "food",
      oddCategory: "animals",
      odd: "cat",
      items: ["apple", "banana", "cat", "pizza"],
      oddIndex: 2,
    }));

    const { container } = render(
      <OddOneGame onHome={() => {}} difficulty="easy" lang="en" />,
    );

    expect(say).toHaveBeenCalledWith(t("en", "oddone.not.food"));
    vi.mocked(say).mockClear();

    const correctBtn = container.querySelector(
      '[data-testid$="-odd"]',
    ) as HTMLElement;
    expect(correctBtn).toBeTruthy();

    act(() => {
      fireEvent.click(correctBtn);
    });

    expect(sfx.good).toHaveBeenCalledTimes(1);
    expect(say).toHaveBeenCalledTimes(1);
    expect(say).toHaveBeenCalledWith("cat");
  });

  it("announces the correct intruder item name in the chosen language on pick", () => {
    vi.spyOn(logic, "makeOddOneRound").mockImplementationOnce(() => ({
      baseCategory: "food",
      oddCategory: "animals",
      odd: "cat",
      items: ["apple", "banana", "cat", "pizza"],
      oddIndex: 2,
    }));

    const { container } = render(
      <OddOneGame onHome={() => {}} difficulty="easy" lang="ja" />,
    );

    vi.mocked(say).mockClear();

    const correctBtn = container.querySelector(
      '[data-testid$="-odd"]',
    ) as HTMLElement;
    expect(correctBtn).toBeTruthy();

    act(() => {
      fireEvent.click(correctBtn);
    });

    expect(sfx.good).toHaveBeenCalledTimes(1);
    expect(say).toHaveBeenCalledTimes(1);
    expect(say).toHaveBeenCalledWith("ねこ");
  });

  it("does not announce item name when picking a wrong tile", () => {
    vi.spyOn(logic, "makeOddOneRound").mockImplementationOnce(() => ({
      baseCategory: "food",
      oddCategory: "animals",
      odd: "cat",
      items: ["apple", "banana", "cat", "pizza"],
      oddIndex: 2,
    }));

    const { container } = render(
      <OddOneGame onHome={() => {}} difficulty="easy" lang="en" />,
    );

    vi.mocked(say).mockClear();

    const buttons = container.querySelectorAll('[data-testid^="oddone-item-"]');
    const wrongBtn = Array.from(buttons).find(
      (b) => !b.getAttribute("data-testid")?.endsWith("-odd"),
    ) as HTMLElement;
    expect(wrongBtn).toBeTruthy();

    act(() => {
      fireEvent.click(wrongBtn);
    });

    expect(sfx.wrong).toHaveBeenCalledTimes(1);
    expect(say).not.toHaveBeenCalled();
  });

  describe("itemLabel", () => {
    it("returns localized icon name across all supported languages", () => {
      expect(logic.itemLabel("dog", "en")).toBe("dog");
      expect(logic.itemLabel("dog", "ja")).toBe("いぬ");
      expect(logic.itemLabel("dog", "cmn")).toBe("狗");
      expect(logic.itemLabel("dog", "yue")).toBe("狗");
      expect(logic.itemLabel("apple", "en")).toBe("apple");
      expect(logic.itemLabel("apple", "ja")).toBe("りんご");
      expect(logic.itemLabel("apple", "cmn")).toBe("苹果");
      expect(logic.itemLabel("apple", "yue")).toBe("蘋果");
    });

    it("covers all ICON_CATEGORIES members in WORDS for all supported languages", () => {
      const langs: Lang[] = ["en", "ja", "cmn", "yue"];
      for (const icons of Object.values(CURRICULUM.categories)) {
        for (const icon of icons) {
          for (const lang of langs) {
            const label = logic.itemLabel(icon, lang);
            expect(label).toBeTruthy();
          }
        }
      }
    });

    it("fails loudly when an unknown oddone icon is requested", () => {
      expect(() => logic.itemLabel("unknown_icon", "en")).toThrow(
        "Unknown oddone icon: unknown_icon",
      );
    });
  });

  describe("language switch safety", () => {
    it("cancels old-language speech via stopNarration when switching language on victory screen", () => {
      vi.useFakeTimers();
      try {
        function Harness() {
          const [lang, setLang] = React.useState<Lang>("en");
          return (
            <LangContext.Provider
              value={{
                lang,
                onCycle: () => setLang((l) => (l === "en" ? "ja" : "en")),
              }}
            >
              <OddOneGame onHome={() => {}} difficulty="easy" lang={lang} />
            </LangContext.Provider>
          );
        }

        const { container } = render(<Harness />);

        // Play 10 rounds to reach victory (easy spotitRounds = 10)
        for (let r = 0; r < 10; r++) {
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
          container.querySelector('[data-testid="win-overlay"]'),
        ).toBeTruthy();
        expect(say).toHaveBeenCalledWith(t("en", "win.oddone"));

        vi.mocked(say).mockClear();
        vi.mocked(stopNarration).mockClear();

        // Cycle language via in-game header button while on victory screen
        const langBtn = container.querySelector(
          '[data-testid="lang-cycle"]',
        ) as HTMLElement;
        expect(langBtn).toBeTruthy();
        act(() => {
          fireEvent.click(langBtn);
        });

        // useLangEpoch calls stopNarration to halt in-flight victory audio
        expect(stopNarration).toHaveBeenCalledTimes(1);

        // Spoken victory message updates to Japanese
        expect(say).toHaveBeenCalledWith(t("ja", "win.oddone"));

        // Victory overlay displays translated message
        expect(
          container.querySelector('[data-testid="win-overlay"]')?.textContent,
        ).toContain(t("ja", "win.oddone"));
      } finally {
        vi.useRealTimers();
      }
    });

    it("halts old narration and speaks localized prompt when switching language mid-round", () => {
      vi.spyOn(logic, "makeOddOneRound").mockImplementation(() => ({
        baseCategory: "animals",
        oddCategory: "food",
        odd: "apple",
        items: ["dog", "cat", "lion", "apple"],
        oddIndex: 3,
      }));

      function Harness() {
        const [lang, setLang] = React.useState<Lang>("en");
        return (
          <LangContext.Provider
            value={{
              lang,
              onCycle: () => setLang((l) => (l === "en" ? "ja" : "en")),
            }}
          >
            <OddOneGame onHome={() => {}} difficulty="easy" lang={lang} />
          </LangContext.Provider>
        );
      }

      const { container } = render(<Harness />);

      expect(say).toHaveBeenCalledWith("Which one is NOT an animal?");
      vi.mocked(say).mockClear();
      vi.mocked(stopNarration).mockClear();

      // Switch language to Japanese mid-round
      const langBtn = container.querySelector(
        '[data-testid="lang-cycle"]',
      ) as HTMLElement;
      expect(langBtn).toBeTruthy();
      act(() => {
        fireEvent.click(langBtn);
      });

      // Old narration halted via useLangEpoch
      expect(stopNarration).toHaveBeenCalledTimes(1);

      // Prompt re-spoken in Japanese
      expect(say).toHaveBeenCalledWith("どうぶつじゃないのは？");

      // Banner text updated to Japanese
      const banner = container.querySelector(
        '[data-testid^="oddone-question-"]',
      ) as HTMLElement;
      expect(banner.textContent).toBe("🔊 どうぶつじゃないのは？");

      // Tile accessibility labels updated to Japanese
      const tiles = container.querySelectorAll('[data-testid^="oddone-item-"]');
      expect(tiles[0]?.getAttribute("aria-label")).toBe("いぬ");
      expect(tiles[3]?.getAttribute("aria-label")).toBe("りんご");
    });
  });

  it("calls stopNarration on unmount to prevent audio leak across navigation", () => {
    const { unmount } = render(
      <OddOneGame onHome={() => {}} difficulty="easy" lang="en" />,
    );
    expect(stopNarration).not.toHaveBeenCalled();

    unmount();

    expect(stopNarration).toHaveBeenCalledTimes(1);
  });

  it("calls stopNarration on unmount when player taps Home", () => {
    function Parent() {
      const [inGame, setInGame] = React.useState(true);
      return inGame ? (
        <OddOneGame
          onHome={() => setInGame(false)}
          difficulty="easy"
          lang="en"
        />
      ) : null;
    }
    const { container } = render(<Parent />);
    expect(stopNarration).not.toHaveBeenCalled();

    const homeBtn = container.querySelector(
      '[data-testid="back-button"]',
    ) as HTMLElement;
    expect(homeBtn).toBeTruthy();
    act(() => {
      fireEvent.click(homeBtn);
    });

    expect(stopNarration).toHaveBeenCalledTimes(1);
  });
});
