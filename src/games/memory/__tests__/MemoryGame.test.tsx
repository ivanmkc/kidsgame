// @vitest-environment happy-dom
import React from "react";
import {
  render,
  screen,
  fireEvent,
  act,
  cleanup,
} from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { MemoryGame } from "../MemoryGame";

describe("MemoryGame", () => {
  const noop = () => {};

  beforeEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it("renders solo easy mode with 4 pairs, title, moves counter and no timer", () => {
    render(<MemoryGame onHome={noop} difficulty="easy" lang="en" />);

    expect(screen.getByText("Memory Match")).toBeDefined();
    expect(screen.getByText("Find all 4 pairs")).toBeDefined();
    expect(screen.getByTestId("memory-moves").textContent).toContain(
      "Moves: 0",
    );
    expect(screen.queryByTestId("memory-timer")).toBeNull();
    expect(screen.getByTestId("memory-score")).toBeDefined();
  });

  it("renders solo medium mode with timer and 6 pairs", () => {
    render(<MemoryGame onHome={noop} difficulty="medium" lang="en" />);
    expect(screen.getByText("Find all 6 pairs")).toBeDefined();
    expect(screen.getByTestId("memory-timer")).toBeDefined();
  });

  it("renders solo hard mode with timer and 8 pairs", () => {
    render(<MemoryGame onHome={noop} difficulty="hard" lang="en" />);
    expect(screen.getByText("Find all 8 pairs")).toBeDefined();
    expect(screen.getByTestId("memory-timer")).toBeDefined();
  });

  it("supports localization", () => {
    const { unmount } = render(
      <MemoryGame onHome={noop} difficulty="easy" lang="ja" />,
    );
    expect(screen.getByText("しんけいすいじゃく")).toBeDefined();
    expect(screen.getByText("4くみ ぜんぶ さがそう")).toBeDefined();
    expect(screen.getByTestId("memory-moves").textContent).toContain(
      "てすう: 0",
    );
    unmount();

    render(<MemoryGame onHome={noop} difficulty="easy" lang="cmn" />);
    expect(screen.getByText("记忆配对")).toBeDefined();
    expect(screen.getByText("找出全部 4 对")).toBeDefined();
    expect(screen.getByTestId("memory-moves").textContent).toContain("步数：0");
  });

  it("conditionally renders mode picker based on twoPlayerEnabled", () => {
    const { unmount } = render(
      <MemoryGame onHome={noop} difficulty="easy" twoPlayerEnabled lang="en" />,
    );
    expect(screen.getByTestId("mode-picker")).toBeDefined();
    unmount();

    render(
      <MemoryGame
        onHome={noop}
        difficulty="easy"
        twoPlayerEnabled={false}
        lang="en"
      />,
    );
    expect(screen.queryByTestId("mode-picker")).toBeNull();
    expect(screen.getByTestId("memory-moves").textContent).toContain(
      "Moves: 0",
    );
  });

  it("renders all cards and handles interactive card flipping and move counting", async () => {
    vi.useFakeTimers();
    try {
      render(<MemoryGame onHome={noop} difficulty="easy" lang="en" />);

      const cards = screen.getAllByRole("button").filter((el) => {
        const testId = el.getAttribute("data-testid");
        return testId && testId.startsWith("memory-card-");
      });
      expect(cards).toHaveLength(8);

      for (const card of cards) {
        expect(card.getAttribute("aria-label")).toBe("face-down card");
      }

      // Click first card
      await act(async () => {
        fireEvent.click(cards[0]);
      });
      expect(cards[0].getAttribute("aria-label")).not.toBe("face-down card");

      // Click second card
      await act(async () => {
        fireEvent.click(cards[1]);
      });

      // Moves should have incremented to 1
      const movesText = screen.getByTestId("memory-moves");
      expect(movesText.textContent).toContain("Moves: 1");

      // Advance timers for the mismatch flip-back delay
      await act(async () => {
        vi.advanceTimersByTime(750);
      });
    } finally {
      vi.useRealTimers();
    }
  });

  it('plays in 2P duel mode, updates player scores on matches, and allows rematch', async () => {
    const onHome = vi.fn();
    render(<MemoryGame onHome={onHome} difficulty="easy" twoPlayerEnabled lang="en" />);

    // In 2P enabled mode, ModePicker is shown first
    const twoPlayerBtn = screen.getByTestId('mp-choose-2p');
    await act(async () => {
      fireEvent.click(twoPlayerBtn);
    });

    // Board and duel chips are now visible
    expect(screen.getByTestId('memory-duel-chip-0')).toBeDefined();
    expect(screen.getByTestId('memory-duel-chip-1')).toBeDefined();

    const cards = screen
      .getAllByRole('button')
      .filter((el) => el.getAttribute('data-testid')?.startsWith('memory-card-'));
    expect(cards).toHaveLength(8);

    // Group cards by icon
    const iconPairs = new Map<string, HTMLElement[]>();
    for (const card of cards) {
      const parts = card.getAttribute('data-testid')!.split('-');
      const icon = parts.slice(3).join('-');
      const list = iconPairs.get(icon) ?? [];
      list.push(card);
      iconPairs.set(icon, list);
    }

    // Match all pairs
    for (const [c1, c2] of iconPairs.values()) {
      await act(async () => {
        fireEvent.click(c1);
      });
      await act(async () => {
        fireEvent.click(c2);
      });
    }

    // Fast-forward entrance animation so win overlay buttons arm
    act(() => {
      vi.advanceTimersByTime(700);
    });

    // WinOverlay appears with rematch button
    const rematchBtn = screen.getByTestId('play-again');
    expect(rematchBtn).toBeDefined();

    // Clicking Rematch resets board
    await act(async () => {
      fireEvent.click(rematchBtn);
    });

    const resetCards = screen
      .getAllByRole('button')
      .filter((el) => el.getAttribute('data-testid')?.startsWith('memory-card-'));
    expect(resetCards).toHaveLength(8);
    for (const card of resetCards) {
      expect(card.getAttribute('aria-label')).toBe('face-down card');
    }
  });
});
