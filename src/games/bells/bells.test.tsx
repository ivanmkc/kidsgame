// @vitest-environment happy-dom
import React from "react";
import { describe, expect, it, vi, afterEach } from "vitest";
import {
  render,
  screen,
  fireEvent,
  act,
  cleanup,
} from "@testing-library/react";
import { BellsGame } from "./BellsGame";
import * as music from "../../music";
import { t } from "../../i18n";

describe("BellsGame replay", () => {
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it("replay button restarts demo and clears taps", () => {
    vi.useFakeTimers();
    vi.spyOn(Math, "random").mockReturnValue(0); // Sequence will be [0, 0]
    const playNoteSpy = vi
      .spyOn(music, "playNote")
      .mockImplementation(() => {});

    render(<BellsGame onHome={() => {}} difficulty="easy" lang="en" />);

    act(() => {
      vi.advanceTimersByTime(5000);
    });
    playNoteSpy.mockClear();

    // Tap count is initially 0
    expect(screen.getByText("Your turn! (0/2)", { exact: false })).toBeTruthy();

    // Tap the first correct bell
    const bell0 = screen.getByTestId("bell-0");
    fireEvent.click(bell0);

    // Tap count should be 1
    expect(screen.getByText("Your turn! (1/2)", { exact: false })).toBeTruthy();

    // Verify replay button accessibility attributes and icon
    const replayBtn = screen.getByTestId("replay-button");
    expect(replayBtn.getAttribute("role")).toBe("button");
    expect(replayBtn.getAttribute("aria-label")).toBe(
      t("en", "spell.hearAgain"),
    );
    expect(replayBtn.textContent).toBe("🔊");

    // Press replay button
    fireEvent.click(replayBtn);

    expect(screen.queryByText("Your turn!", { exact: false })).toBeNull();

    // It should go back to listen phase
    expect(screen.getByText("Listen...")).toBeTruthy();

    // Fast-forward through demo again
    act(() => {
      vi.advanceTimersByTime(5000);
    });

    // Tap count should be back to 0
    expect(screen.getByText("Your turn! (0/2)", { exact: false })).toBeTruthy();

    vi.useRealTimers();
  });

  it("status card is non-interactive and does not discard partial taps", () => {
    vi.useFakeTimers();
    vi.spyOn(Math, "random").mockReturnValue(0);
    vi.spyOn(music, "playNote").mockImplementation(() => {});

    render(<BellsGame onHome={() => {}} difficulty="easy" lang="en" />);

    act(() => {
      vi.advanceTimersByTime(5000);
    });

    // Tap the first correct bell
    const bell0 = screen.getByTestId("bell-0");
    fireEvent.click(bell0);
    expect(screen.getByText("Your turn! (1/2)", { exact: false })).toBeTruthy();

    // The status card should not be a button
    const statusCard = screen.getByTestId("bells-status");
    expect(statusCard.getAttribute("role")).toBeNull();
    expect(statusCard.getAttribute("aria-label")).toBeNull();

    // Tapping the status card should not discard taps or restart demo
    fireEvent.click(statusCard);
    expect(screen.getByText("Your turn! (1/2)", { exact: false })).toBeTruthy();
    expect(screen.queryByText("Listen...")).toBeNull();

    vi.useRealTimers();
  });

  it("localizes replay button accessibilityLabel according to lang", () => {
    vi.useFakeTimers();
    vi.spyOn(Math, "random").mockReturnValue(0);
    vi.spyOn(music, "playNote").mockImplementation(() => {});

    render(<BellsGame onHome={() => {}} difficulty="easy" lang="ja" />);

    act(() => {
      vi.advanceTimersByTime(5000);
    });

    const replayBtn = screen.getByTestId("replay-button");
    expect(replayBtn.getAttribute("aria-label")).toBe(
      t("ja", "spell.hearAgain"),
    );

    vi.useRealTimers();
  });
});
