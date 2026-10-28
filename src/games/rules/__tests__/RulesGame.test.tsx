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
import { sfx, stopNarration } from "../../../sound";
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

  it("locks input during wrong-tap feedback so rapid taps trigger error feedback once", () => {
    vi.useFakeTimers();
    try {
      render(<RulesGame onHome={() => {}} difficulty="easy" lang="en" />);

      const wrongTiles = screen.getAllByTestId(/^rules-tile-\d+-.*-n$/);
      const matchTiles = screen.getAllByTestId(/^rules-tile-\d+-.*-y$/);
      expect(wrongTiles.length).toBeGreaterThanOrEqual(1);

      const wrongTile = wrongTiles[0];
      const matchTile = matchTiles[0];

      // Rapidly tap the wrong tile multiple times
      act(() => {
        fireEvent.click(wrongTile);
        fireEvent.click(wrongTile);
        fireEvent.click(wrongTile);
      });

      // sfx.wrong is triggered only once
      expect(sfx.wrong).toHaveBeenCalledTimes(1);

      // Tapping a match tile while wrong feedback is active is ignored
      act(() => {
        fireEvent.click(matchTile);
      });
      expect(sfx.good).not.toHaveBeenCalled();

      // Advance past the 450ms wobble timeout
      act(() => {
        vi.advanceTimersByTime(450);
      });

      // After unlocking, tapping a match tile succeeds
      act(() => {
        fireEvent.click(matchTile);
      });
      expect(sfx.good).toHaveBeenCalledTimes(1);
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
  });
});
