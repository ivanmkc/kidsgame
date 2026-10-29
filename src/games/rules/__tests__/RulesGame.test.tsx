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
import { RulesGame } from "../RulesGame";
import * as logic from "../logic";
import { say, saySequence, sfx, stopNarration } from "../../../sound";
import { t } from "../../../i18n";

vi.mock("../../../sound", () => ({
  say: vi.fn(),
  saySequence: vi.fn(),
  stopNarration: vi.fn(),
  sfx: {
    good: vi.fn(),
    wrong: vi.fn(),
    tap: vi.fn(),
  },
}));

describe("RulesGame", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.clearAllMocks();
  });

  afterEach(() => {
    cleanup();
    vi.useRealTimers();
  });

  it("renders initial round for hard difficulty", () => {
    render(<RulesGame onHome={() => {}} difficulty="hard" lang="en" />);
    expect(screen.getByTestId("rules-score")).toBeDefined();
    expect(screen.getByText("Rule #1")).toBeDefined();
  });

  it("prevents fast-tap hammering on the final tile from queuing multiple round transitions", () => {
    vi.useFakeTimers();
    try {
      const makeRoundSpy = vi.spyOn(logic, "makeRulesRound");
      render(<RulesGame onHome={() => {}} difficulty="easy" lang="en" />);

      expect(makeRoundSpy).toHaveBeenCalledTimes(1);
      expect(screen.getByTestId("rules-score").textContent).toContain("0/10");

      const matchTiles = screen.getAllByTestId(/^rules-tile-\d+-.*-y$/);
      expect(matchTiles.length).toBeGreaterThanOrEqual(2);

      // Tap all match tiles except the final one
      for (let i = 0; i < matchTiles.length - 1; i++) {
        fireEvent.click(matchTiles[i]);
      }
      expect(sfx.good).toHaveBeenCalledTimes(matchTiles.length - 1);

      // Rapidly hammer the final match tile
      const finalTile = matchTiles[matchTiles.length - 1];
      act(() => {
        fireEvent.click(finalTile);
        fireEvent.click(finalTile);
        fireEvent.click(finalTile);
      });

      // sfx.good fires only once for the final tile
      expect(sfx.good).toHaveBeenCalledTimes(matchTiles.length);

      // Attempting to tap during the 550ms transition is ignored
      const otherTiles = screen.getAllByTestId(/^rules-tile-\d+-.*-[yn]$/);
      act(() => {
        fireEvent.click(otherTiles[0]);
      });
      expect(sfx.wrong).not.toHaveBeenCalled();

      // Before transition timer fires, round has not advanced yet
      expect(screen.getByTestId("rules-score").textContent).toContain("0/10");
      expect(makeRoundSpy).toHaveBeenCalledTimes(1);

      // Fast-forward through the 550ms transition
      act(() => {
        vi.advanceTimersByTime(550);
      });

      // Advances exactly one round
      expect(screen.getByTestId("rules-score").textContent).toContain("1/10");
      expect(makeRoundSpy).toHaveBeenCalledTimes(2);

      // No stray timer fires another round transition
      act(() => {
        vi.advanceTimersByTime(1000);
      });
      expect(screen.getByTestId("rules-score").textContent).toContain("1/10");
      expect(makeRoundSpy).toHaveBeenCalledTimes(2);
    } finally {
      vi.useRealTimers();
    }
  });

  it("allows immediate tap of match tile after wrong tile while ignoring repeated wrong taps", () => {
    vi.useFakeTimers();
    try {
      render(<RulesGame onHome={() => {}} difficulty="easy" lang="en" />);

      const wrongTiles = screen.getAllByTestId(/^rules-tile-\d+-.*-n$/);
      const matchTiles = screen.getAllByTestId(/^rules-tile-\d+-.*-y$/);
      expect(wrongTiles.length).toBeGreaterThanOrEqual(1);

      const wrongTile = wrongTiles[0];
      const matchTile = matchTiles[0];

      // Rapidly tap the wrong tile multiple times
      act(() => { fireEvent.click(wrongTile); });
      act(() => { fireEvent.click(wrongTile); });
      act(() => { fireEvent.click(wrongTile); });

      // sfx.wrong is triggered only once
      expect(sfx.wrong).toHaveBeenCalledTimes(1);

      // Tapping a match tile while wrong feedback is active succeeds immediately
      act(() => {
        fireEvent.click(matchTile);
      });
      expect(sfx.good).toHaveBeenCalledTimes(1);

      // Advance past the 450ms wobble timeout
      act(() => {
        vi.advanceTimersByTime(450);
      });
    } finally {
      vi.useRealTimers();
    }
  });

  it("plays the spoken name of a distractor object when tapped concurrently with the error sound", () => {
    vi.useFakeTimers();
    try {
      vi.spyOn(logic, "makeRulesRound").mockReturnValue({
        ruleNumber: 1,
        rule: { category: "nature", label: "Tap the FLOWERS!" },
        isRecall: false,
        tiles: [
          { icon: "blossom", isMatch: true },
          { icon: "soccer", isMatch: false },
        ],
        matchCount: 1,
      });

      render(<RulesGame onHome={() => {}} difficulty="easy" lang="en" />);

      // Clear intro saySequence calls
      vi.mocked(saySequence).mockClear();
      vi.mocked(say).mockClear();

      const wrongTile = screen.getByTestId("rules-tile-1-soccer-n");

      act(() => {
        fireEvent.click(wrongTile);
      });

      expect(sfx.wrong).toHaveBeenCalledTimes(1);
      expect(say).toHaveBeenCalledWith("ball");
    } finally {
      vi.useRealTimers();
    }
  });

  it("preserves simultaneous multi-touch taps on correct tiles and completes the round", () => {
    vi.useFakeTimers();
    try {
      vi.spyOn(logic, "makeRulesRound").mockReturnValue({
        ruleNumber: 1,
        rule: { category: "nature", label: "Tap the FLOWERS!" },
        isRecall: false,
        tiles: [
          { icon: "blossom", isMatch: true },
          { icon: "sunflower", isMatch: true },
          { icon: "soccer", isMatch: false },
        ],
        matchCount: 2,
      });

      render(<RulesGame onHome={() => {}} difficulty="easy" lang="en" />);

      const blossomTile = screen.getByTestId("rules-tile-0-blossom-y");
      const sunflowerTile = screen.getByTestId("rules-tile-1-sunflower-y");

      act(() => {
        fireEvent.click(blossomTile);
        fireEvent.click(sunflowerTile);
      });

      expect(sfx.good).toHaveBeenCalledTimes(2);
      expect(screen.getByTestId("rules-progress").textContent).toBe(
        t("en", "rules.progress", { found: 2, total: 2 }),
      );

      act(() => {
        vi.advanceTimersByTime(550);
      });
      expect(screen.getByTestId("rules-score").textContent).toContain("1/10");
    } finally {
      vi.useRealTimers();
    }
  });

  it("preserves simultaneous multi-touch taps on correct tiles during partial match", () => {
    vi.useFakeTimers();
    try {
      vi.spyOn(logic, "makeRulesRound").mockReturnValue({
        ruleNumber: 1,
        rule: { category: "nature", label: "Tap the FLOWERS!" },
        isRecall: false,
        tiles: [
          { icon: "blossom", isMatch: true },
          { icon: "sunflower", isMatch: true },
          { icon: "rainbow", isMatch: true },
          { icon: "soccer", isMatch: false },
        ],
        matchCount: 3,
      });

      render(<RulesGame onHome={() => {}} difficulty="easy" lang="en" />);

      const blossomTile = screen.getByTestId("rules-tile-0-blossom-y");
      const sunflowerTile = screen.getByTestId("rules-tile-1-sunflower-y");

      act(() => {
        fireEvent.click(blossomTile);
        fireEvent.click(sunflowerTile);
      });

      expect(sfx.good).toHaveBeenCalledTimes(2);
      expect(screen.getByTestId("rules-progress").textContent).toBe(
        t("en", "rules.progress", { found: 2, total: 3 }),
      );
    } finally {
      vi.useRealTimers();
    }
  });

  it("ignores duplicate simultaneous taps on the same correct tile", () => {
    vi.useFakeTimers();
    try {
      vi.spyOn(logic, "makeRulesRound").mockReturnValue({
        ruleNumber: 1,
        rule: { category: "nature", label: "Tap the FLOWERS!" },
        isRecall: false,
        tiles: [
          { icon: "blossom", isMatch: true },
          { icon: "sunflower", isMatch: true },
          { icon: "soccer", isMatch: false },
        ],
        matchCount: 2,
      });

      render(<RulesGame onHome={() => {}} difficulty="easy" lang="en" />);

      const blossomTile = screen.getByTestId("rules-tile-0-blossom-y");

      act(() => {
        fireEvent.click(blossomTile);
        fireEvent.click(blossomTile);
      });

      expect(sfx.good).toHaveBeenCalledTimes(1);
      expect(screen.getByTestId("rules-progress").textContent).toBe(
        t("en", "rules.progress", { found: 1, total: 2 }),
      );
    } finally {
      vi.useRealTimers();
    }
  });

  it("displays Rule #6 after memory check on Hard difficulty without skipping numbers", () => {
    vi.useFakeTimers();
    try {
      render(<RulesGame onHome={() => {}} difficulty="hard" lang="en" />);

      // Play through rounds 0..4 (Rules #1 through #5)
      for (let r = 0; r < 5; r++) {
        expect(screen.getByText(`Rule #${r + 1}`)).toBeTruthy();
        const matchTiles = screen.getAllByTestId(/-y$/);
        for (const tile of matchTiles) {
          fireEvent.click(tile);
        }
        act(() => {
          vi.advanceTimersByTime(600);
        });
      }

      // Round 5 is memory check
      expect(screen.getByText("Memory check!")).toBeTruthy();
      expect(screen.getByText(/Do Rule #\d again/)).toBeTruthy();
      const recallMatches = screen.getAllByTestId(/-y$/);
      for (const tile of recallMatches) {
        fireEvent.click(tile);
      }
      act(() => {
        vi.advanceTimersByTime(600);
      });

      // Round 6 must be Rule #6 (not skipped to Rule #7)
      expect(screen.getByText("Rule #6")).toBeTruthy();
    } finally {
      vi.useRealTimers();
    }
  });

  it("uses localized accessibility label on recall remind button in non-English locales", () => {
    vi.useFakeTimers();
    try {
      render(<RulesGame onHome={() => {}} difficulty="hard" lang="ja" />);

      // Play through rounds 0..4 to reach recall round 5
      for (let r = 0; r < 5; r++) {
        const matchTiles = screen.getAllByTestId(/-y$/);
        for (const tile of matchTiles) {
          fireEvent.click(tile);
        }
        act(() => {
          vi.advanceTimersByTime(600);
        });
      }

      const remindBtn = screen.getByTestId("rules-remind");
      expect(remindBtn.getAttribute("aria-label")).toBe(
        t("ja", "rules.remind"),
      );
    } finally {
      vi.useRealTimers();
    }
  });

  it("uses localized toddler-appropriate accessibility labels on grid tiles across languages", () => {
    vi.spyOn(logic, "makeRulesRound").mockReturnValue({
      ruleNumber: 1,
      rule: { category: "nature", label: "Tap the FLOWERS!" },
      isRecall: false,
      tiles: [
        { icon: "blossom", isMatch: true },
        { icon: "soccer", isMatch: false },
        { icon: "icecream", isMatch: false },
      ],
      matchCount: 1,
    });

    const { rerender } = render(
      <RulesGame onHome={() => {}} difficulty="easy" lang="ja" />,
    );
    expect(
      screen.getByTestId("rules-tile-0-blossom-y").getAttribute("aria-label"),
    ).toBe("はな");
    expect(
      screen.getByTestId("rules-tile-1-soccer-n").getAttribute("aria-label"),
    ).toBe("ボール");
    expect(
      screen.getByTestId("rules-tile-2-icecream-n").getAttribute("aria-label"),
    ).toBe("アイスクリーム");

    rerender(<RulesGame onHome={() => {}} difficulty="easy" lang="cmn" />);
    expect(
      screen.getByTestId("rules-tile-0-blossom-y").getAttribute("aria-label"),
    ).toBe("花");
    expect(
      screen.getByTestId("rules-tile-1-soccer-n").getAttribute("aria-label"),
    ).toBe("足球");
    expect(
      screen.getByTestId("rules-tile-2-icecream-n").getAttribute("aria-label"),
    ).toBe("冰淇淋");

    rerender(<RulesGame onHome={() => {}} difficulty="easy" lang="en" />);
    expect(
      screen.getByTestId("rules-tile-0-blossom-y").getAttribute("aria-label"),
    ).toBe("flower");
    expect(
      screen.getByTestId("rules-tile-1-soccer-n").getAttribute("aria-label"),
    ).toBe("ball");
    expect(
      screen.getByTestId("rules-tile-2-icecream-n").getAttribute("aria-label"),
    ).toBe("ice cream");
  });

  describe("unmount and narration lifecycle", () => {
    it("speaks English intro line on mount when lang is en", () => {
      render(<RulesGame onHome={() => {}} difficulty="easy" lang="en" />);
      expect(saySequence).toHaveBeenCalledWith([
        "Rule Time! Do what the rule says as fast as you can.",
        expect.any(String),
      ]);
    });

    it("speaks localized intro line on mount for Japanese and Chinese locales", () => {
      render(<RulesGame onHome={() => {}} difficulty="easy" lang="ja" />);
      expect(saySequence).toHaveBeenCalledWith([
        "ルールタイム！ ルールどおりに はやく タップ！",
        expect.any(String),
      ]);
      expect(saySequence).not.toHaveBeenCalledWith([
        "Rule Time! Do what the rule says as fast as you can.",
        expect.any(String),
      ]);
    });

    it("repeats intro line in new language when lang switches mid-game", () => {
      const { rerender } = render(
        <RulesGame onHome={() => {}} difficulty="easy" lang="en" />,
      );
      vi.mocked(saySequence).mockClear();
      vi.mocked(say).mockClear();

      rerender(<RulesGame onHome={() => {}} difficulty="easy" lang="ja" />);

      expect(saySequence).toHaveBeenCalledWith([
        "ルールタイム！ ルールどおりに はやく タップ！",
        expect.any(String),
      ]);
    });

    it("speaks localized memory check prompt on recall round in non-English locales", () => {
      vi.useFakeTimers();
      try {
        render(<RulesGame onHome={() => {}} difficulty="hard" lang="ja" />);

        // Advance to recall round (round 5 is memory check)
        for (let r = 0; r < 5; r++) {
          const matchTiles = screen.getAllByTestId(/-y$/);
          for (const tile of matchTiles) {
            fireEvent.click(tile);
          }
          act(() => {
            vi.advanceTimersByTime(600);
          });
        }

        expect(screen.getByText("きおくクイズ！")).toBeTruthy();
        expect(say).toHaveBeenCalledWith(
          expect.stringContaining("きおくクイズ！"),
        );
        expect(say).not.toHaveBeenCalledWith(
          expect.stringMatching(/Memory check!/),
        );
      } finally {
        vi.useRealTimers();
      }
    });

    it("speaks English memory check prompt on recall round when lang is en", () => {
      vi.useFakeTimers();
      try {
        render(<RulesGame onHome={() => {}} difficulty="hard" lang="en" />);

        // Advance to recall round (round 5 is memory check)
        for (let r = 0; r < 5; r++) {
          const matchTiles = screen.getAllByTestId(/-y$/);
          for (const tile of matchTiles) {
            fireEvent.click(tile);
          }
          act(() => {
            vi.advanceTimersByTime(600);
          });
        }

        expect(screen.getByText("Memory check!")).toBeTruthy();
        expect(say).toHaveBeenCalledWith(
          expect.stringMatching(
            /^Memory check! Do Rule #\d+ again — remember it\? 🤔/,
          ),
        );
      } finally {
        vi.useRealTimers();
      }
    });

    it("stops narration when unmounted so ghost instructions do not leak onto home menu", () => {
      const { unmount } = render(
        <RulesGame onHome={() => {}} difficulty="easy" lang="en" />,
      );
      expect(stopNarration).not.toHaveBeenCalled();

      unmount();

      expect(stopNarration).toHaveBeenCalled();
    });

    it("clears the remind timer when advancing round to prevent state updates", () => {
      vi.useFakeTimers();
      const clearTimeoutSpy = vi.spyOn(global, "clearTimeout");
      try {
        render(<RulesGame onHome={() => {}} difficulty="hard" lang="en" />);

        // Advance to recall round (round 5 is memory check)
        for (let r = 0; r < 5; r++) {
          const matchTiles = screen.getAllByTestId(/-y$/);
          for (const tile of matchTiles) {
            fireEvent.click(tile);
          }
          act(() => {
            vi.advanceTimersByTime(600);
          });
        }

        clearTimeoutSpy.mockClear();

        // We are on round 5 (Memory check)
        const remindBtn = screen.getByTestId("rules-remind");
        fireEvent.click(remindBtn);

        // Complete the round quickly (before 2600ms)
        const recallMatches = screen.getAllByTestId(/-y$/);
        for (const tile of recallMatches) {
          fireEvent.click(tile);
        }

        // The remind timer should be cleared immediately upon completing the match count
        expect(clearTimeoutSpy).toHaveBeenCalled();
      } finally {
        clearTimeoutSpy.mockRestore();
        vi.useRealTimers();
      }
    });

    it("clears the remind timer when unmounting to prevent state updates", () => {
      vi.useFakeTimers();
      const clearTimeoutSpy = vi.spyOn(global, "clearTimeout");
      try {
        const { unmount } = render(
          <RulesGame onHome={() => {}} difficulty="hard" lang="en" />,
        );

        // Advance to recall round
        for (let r = 0; r < 5; r++) {
          const matchTiles = screen.getAllByTestId(/-y$/);
          for (const tile of matchTiles) {
            fireEvent.click(tile);
          }
          act(() => {
            vi.advanceTimersByTime(600);
          });
        }

        clearTimeoutSpy.mockClear();

        // Trigger remind timer
        const remindBtn = screen.getByTestId("rules-remind");
        fireEvent.click(remindBtn);

        // Unmount while the timer is still active
        unmount();

        expect(clearTimeoutSpy).toHaveBeenCalled();
      } finally {
        clearTimeoutSpy.mockRestore();
        vi.useRealTimers();
      }
    });

    it("clears the win timer when unmounting to prevent state leaks", () => {
      vi.useFakeTimers();
      const clearTimeoutSpy = vi.spyOn(global, "clearTimeout");
      try {
        const { unmount } = render(
          <RulesGame onHome={() => {}} difficulty="easy" lang="en" />,
        );

        clearTimeoutSpy.mockClear();

        // Trigger win timer by tapping all correct tiles
        const matchTiles = screen.getAllByTestId(/-y$/);
        for (const tile of matchTiles) {
          fireEvent.click(tile);
        }

        // Unmount while the timer is still active (before 550ms)
        unmount();

        expect(clearTimeoutSpy).toHaveBeenCalled();
      } finally {
        clearTimeoutSpy.mockRestore();
        vi.useRealTimers();
      }
    });

    it("clears the wrong timer when unmounting to prevent state leaks", () => {
      vi.useFakeTimers();
      const clearTimeoutSpy = vi.spyOn(global, "clearTimeout");
      try {
        const { unmount } = render(
          <RulesGame onHome={() => {}} difficulty="easy" lang="en" />,
        );

        clearTimeoutSpy.mockClear();

        // Trigger wrong timer by tapping a wrong tile
        const wrongTiles = screen.getAllByTestId(/-n$/);
        fireEvent.click(wrongTiles[0]);

        // Unmount while the timer is still active (before 450ms)
        unmount();

        expect(clearTimeoutSpy).toHaveBeenCalled();
      } finally {
        clearTimeoutSpy.mockRestore();
        vi.useRealTimers();
      }
    });
  });

  describe("layout responsiveness", () => {
    function setViewport(width: number, height: number) {
      Object.defineProperty(window, "innerWidth", {
        value: width,
        configurable: true,
      });
      Object.defineProperty(window, "innerHeight", {
        value: height,
        configurable: true,
      });
      Object.defineProperty(document.documentElement, "clientWidth", {
        value: width,
        configurable: true,
      });
      Object.defineProperty(document.documentElement, "clientHeight", {
        value: height,
        configurable: true,
      });
      if (window.visualViewport) {
        Object.defineProperty(window.visualViewport, "width", {
          value: width,
          configurable: true,
        });
        Object.defineProperty(window.visualViewport, "height", {
          value: height,
          configurable: true,
        });
      }
      window.dispatchEvent(new Event("resize"));
    }

    it("renders side-by-side landscape layout with 77px tiles on 667x375 viewport", () => {
      setViewport(667, 375);
      render(<RulesGame onHome={() => {}} difficulty="hard" lang="en" />);

      const tiles = screen.getAllByTestId(/^rules-tile-\d+-.*-[yn]$/);
      expect(tiles[0].style.width).toBe("77px");
      expect(tiles[0].style.height).toBe("77px");
    });

    it("renders landscape layout with 82px tiles on 844x390 viewport", () => {
      setViewport(844, 390);
      render(<RulesGame onHome={() => {}} difficulty="hard" lang="en" />);

      const tiles = screen.getAllByTestId(/^rules-tile-\d+-.*-[yn]$/);
      expect(tiles[0].style.width).toBe("82px");
      expect(tiles[0].style.height).toBe("82px");
    });

    it("renders portrait layout with >=110px tiles on 390x844 viewport", () => {
      setViewport(390, 844);
      render(<RulesGame onHome={() => {}} difficulty="hard" lang="en" />);

      const tiles = screen.getAllByTestId(/^rules-tile-\d+-.*-[yn]$/);
      expect(parseFloat(tiles[0].style.width)).toBeGreaterThanOrEqual(110);
    });
  });
});
