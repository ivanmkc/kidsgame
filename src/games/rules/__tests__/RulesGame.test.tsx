// @vitest-environment happy-dom
import React from "react";
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { RulesGame } from "../RulesGame";
import * as logic from "../logic";
import { sfx } from "../../../sound";

vi.mock("../../../sound", () => ({
  say: vi.fn(),
  saySequence: vi.fn(),
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
});
