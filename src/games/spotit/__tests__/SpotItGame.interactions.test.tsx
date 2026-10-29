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
import * as sound from "../../../sound";
import { t } from "../../../i18n";
import { SpotItGame } from "../SpotItGame";
import * as difficultyModule from "../../../difficulty";

describe("SpotItGame win line localization", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.restoreAllMocks();
    vi.spyOn(sound.sfx, "wrong").mockImplementation(() => {});
    vi.spyOn(sound.sfx, "good").mockImplementation(() => {});
    vi.spyOn(difficultyModule, "settingsFor").mockReturnValue({
      ...difficultyModule.settingsFor("easy"),
      spotitRounds: 1, // fast win
    });
  });

  afterEach(() => {
    cleanup();
  });

  it("updates spoken win message when language changes", async () => {
    const saySpy = vi.spyOn(sound, "say").mockImplementation(() => {});
    const { rerender } = render(
      <SpotItGame onHome={() => {}} difficulty="easy" seed={42} lang="en" />,
    );

    // Play one round to win
    const topButtons = screen
      .getAllByRole("button")
      .filter((el) =>
        el.getAttribute("data-testid")?.startsWith("top-symbol-"),
      );
    const bottomButtons = screen
      .getAllByRole("button")
      .filter((el) =>
        el.getAttribute("data-testid")?.startsWith("bottom-symbol-"),
      );
    const topSymbolIds = topButtons.map((b) =>
      b.getAttribute("data-testid")!.replace("top-symbol-", ""),
    );
    const bottomSymbolIds = bottomButtons.map((b) =>
      b.getAttribute("data-testid")!.replace("bottom-symbol-", ""),
    );
    const matchingId = topSymbolIds.find((id) => bottomSymbolIds.includes(id));

    fireEvent.click(screen.getByTestId(`top-symbol-${matchingId}`));

    // Expect English win line
    expect(saySpy).toHaveBeenCalledWith(t("en", "win.spotit"));

    saySpy.mockClear();

    // Rerender with Japanese
    rerender(
      <SpotItGame onHome={() => {}} difficulty="easy" seed={42} lang="ja" />,
    );

    // Expect Japanese win line to be spoken because it was re-rendered with new lang
    expect(saySpy).toHaveBeenCalledWith(t("ja", "win.spotit"));
  });

  it("delays WinOverlay mount by 900ms celebration on final correct tap", () => {
    vi.useFakeTimers();
    try {
      render(
        <SpotItGame onHome={() => {}} difficulty="easy" seed={42} lang="en" />,
      );

      const topButtons = screen
        .getAllByRole("button")
        .filter((el) =>
          el.getAttribute("data-testid")?.startsWith("top-symbol-"),
        );
      const bottomButtons = screen
        .getAllByRole("button")
        .filter((el) =>
          el.getAttribute("data-testid")?.startsWith("bottom-symbol-"),
        );
      const topSymbolIds = topButtons.map((b) =>
        b.getAttribute("data-testid")!.replace("top-symbol-", ""),
      );
      const bottomSymbolIds = bottomButtons.map((b) =>
        b.getAttribute("data-testid")!.replace("bottom-symbol-", ""),
      );
      const matchingId = topSymbolIds.find((id) =>
        bottomSymbolIds.includes(id),
      );
      expect(matchingId).toBeDefined();

      expect(screen.queryByTestId("win-overlay")).toBeNull();

      act(() => {
        fireEvent.click(screen.getByTestId(`top-symbol-${matchingId}`));
      });

      // Score is updated and board remains visible
      expect(screen.getByTestId("spotit-score").textContent).toContain("1/1");
      expect(screen.queryByTestId(`top-symbol-${matchingId}`)).not.toBeNull();
      // WinOverlay is deferred
      expect(screen.queryByTestId("win-overlay")).toBeNull();

      // At 899ms, WinOverlay is still not mounted
      act(() => {
        vi.advanceTimersByTime(899);
      });
      expect(screen.queryByTestId("win-overlay")).toBeNull();

      // At 900ms, WinOverlay mounts
      act(() => {
        vi.advanceTimersByTime(1);
      });
      expect(screen.getByTestId("win-overlay")).toBeTruthy();

      // Tap shield arms the next-round button after 600ms
      act(() => {
        vi.advanceTimersByTime(600);
      });
      const playAgainBtn = screen.getByTestId("play-again");
      act(() => {
        fireEvent.click(playAgainBtn);
      });
      expect(screen.queryByTestId("win-overlay")).toBeNull();
      expect(screen.getByTestId("spotit-score").textContent).toContain("0/1");
    } finally {
      vi.useRealTimers();
    }
  });

  it("clears win celebration timer on unmount", () => {
    vi.useFakeTimers();
    const clearTimeoutSpy = vi.spyOn(globalThis, "clearTimeout");
    try {
      const { unmount } = render(
        <SpotItGame onHome={() => {}} difficulty="easy" seed={42} lang="en" />,
      );

      const topButtons = screen
        .getAllByRole("button")
        .filter((el) =>
          el.getAttribute("data-testid")?.startsWith("top-symbol-"),
        );
      const bottomButtons = screen
        .getAllByRole("button")
        .filter((el) =>
          el.getAttribute("data-testid")?.startsWith("bottom-symbol-"),
        );
      const topSymbolIds = topButtons.map((b) =>
        b.getAttribute("data-testid")!.replace("top-symbol-", ""),
      );
      const bottomSymbolIds = bottomButtons.map((b) =>
        b.getAttribute("data-testid")!.replace("bottom-symbol-", ""),
      );
      const matchingId = topSymbolIds.find((id) =>
        bottomSymbolIds.includes(id),
      );

      act(() => {
        fireEvent.click(screen.getByTestId(`top-symbol-${matchingId}`));
      });

      unmount();
      expect(clearTimeoutSpy).toHaveBeenCalled();
      expect(() => {
        vi.advanceTimersByTime(1000);
      }).not.toThrow();
    } finally {
      vi.useRealTimers();
    }
  });
});
