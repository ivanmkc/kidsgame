// @vitest-environment happy-dom
import React from "react";
import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { RulesGame } from "../RulesGame";
import * as logic from "../logic";
import { sfx } from "../../../sound";

describe("RulesGame", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("renders initial round for hard difficulty", () => {
    render(<RulesGame onHome={() => {}} difficulty="hard" lang="en" />);
    expect(screen.getByTestId("rules-score")).toBeDefined();
    expect(screen.getByText("Rule #1")).toBeDefined();
  });

  it("ignores rapid double-tap on final matching tile to prevent double round transition", () => {
    vi.useFakeTimers();
    const makeRoundSpy = vi.spyOn(logic, "makeRulesRound");
    const goodSpy = vi.spyOn(sfx, "good");

    const { container } = render(
      <RulesGame onHome={() => {}} difficulty="easy" lang="en" />,
    );
    expect(makeRoundSpy).toHaveBeenCalledTimes(1);

    const matches = Array.from(
      container.querySelectorAll<HTMLElement>('[data-testid$="-y"]'),
    );
    expect(matches.length).toBeGreaterThanOrEqual(2);

    // Tap all matches except the final one
    for (let i = 0; i < matches.length - 1; i++) {
      act(() => {
        fireEvent.click(matches[i]);
      });
    }

    const finalTile = matches[matches.length - 1];
    const initialGoodCount = goodSpy.mock.calls.length;

    // Rapid double-tap on the final matching tile
    act(() => {
      fireEvent.click(finalTile);
      fireEvent.click(finalTile);
    });

    // Final tile sound should only play once
    expect(goodSpy).toHaveBeenCalledTimes(initialGoodCount + 1);

    // Advance past the 550ms round transition timeout
    act(() => {
      vi.advanceTimersByTime(550);
    });

    // Should only generate the next round once (total 2 calls: initial + 1 transition)
    expect(makeRoundSpy).toHaveBeenCalledTimes(2);
  });
});
