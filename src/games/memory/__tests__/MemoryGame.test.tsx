// @vitest-environment happy-dom
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
} from "@testing-library/react";
import React from "react";
import { Animated } from "react-native";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MemoryGame } from "../MemoryGame";

vi.mock("../../../sound", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../../sound")>();
  return {
    ...actual,
    say: vi.fn(),
    sfx: {
      ...actual.sfx,
      good: vi.fn(),
      wrong: vi.fn(),
      tap: vi.fn(),
      win: vi.fn(),
    },
  };
});

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
  window.dispatchEvent(new Event("resize"));
}

interface ValueState {
  _value?: number;
}

describe("MemoryGame", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    setViewport(800, 600);
  });

  afterEach(() => {
    cleanup();
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("renders cards on board and tracks moves on card flips", async () => {
    const onHome = vi.fn();
    render(<MemoryGame onHome={onHome} difficulty="easy" lang="en" />);

    const cards = screen
      .getAllByRole("button")
      .filter((el) =>
        el.getAttribute("data-testid")?.startsWith("memory-card-"),
      );
    // Easy mode memory has 4 pairs = 8 cards
    expect(cards).toHaveLength(8);

    // Initial state: all cards face down
    for (const card of cards) {
      expect(card.getAttribute("aria-label")).toBe("face-down card");
    }

    // Flip first card
    await act(async () => {
      fireEvent.click(cards[0]);
    });
    expect(cards[0].getAttribute("aria-label")).not.toBe("face-down card");

    // Flip second card
    await act(async () => {
      fireEvent.click(cards[1]);
    });

    // Score / moves should be updated
    const movesText = screen.getByTestId("memory-moves");
    expect(movesText.textContent).toContain("1");
  });

  it("localizes face-down card labels in non-English mode", () => {
    const onHome = vi.fn();
    render(<MemoryGame onHome={onHome} difficulty="easy" lang="ja" />);

    const cards = screen
      .getAllByRole("button")
      .filter((el) =>
        el.getAttribute("data-testid")?.startsWith("memory-card-"),
      );

    for (const card of cards) {
      expect(card.getAttribute("aria-label")).toBe("うらがえしのカード");
    }
  });

  it("mounts cards face down with no downward animation on next round", () => {
    render(<MemoryGame onHome={() => {}} difficulty="easy" lang="en" />);

    const getCardPairs = () => {
      const cards = screen.getAllByTestId(/^memory-card-/);
      const iconMap = new Map<string, HTMLElement[]>();
      for (const card of cards) {
        const testId = card.getAttribute("data-testid") ?? "";
        const match = testId.match(/^memory-card-\d+-(.+)$/);
        if (match) {
          const icon = match[1];
          const list = iconMap.get(icon) ?? [];
          list.push(card);
          iconMap.set(icon, list);
        }
      }
      return { cards, iconMap };
    };

    const initial = getCardPairs();
    expect(initial.cards.length).toBeGreaterThan(0);

    // Solve all pairs to trigger win overlay
    for (const [, pair] of initial.iconMap) {
      expect(pair.length).toBe(2);
      act(() => {
        fireEvent.click(pair[0]);
      });
      act(() => {
        fireEvent.click(pair[1]);
      });
    }

    expect(screen.getByTestId("win-overlay")).toBeDefined();

    // Advance timers so WinOverlay arms its buttons (600ms tap shield)
    act(() => {
      vi.advanceTimersByTime(700);
    });

    const playAgainBtn = screen.getByTestId("play-again");
    expect(playAgainBtn).toBeDefined();

    // Track any animation attempting to flip a card down from face-up
    const downwardAnimations: Array<{ from: number; to: number }> = [];
    const origSpring = Animated.spring;
    vi.spyOn(Animated, "spring").mockImplementation((val, config) => {
      const state = val as ValueState;
      const from = state._value ?? 0;
      const to = typeof config.toValue === "number" ? config.toValue : -1;
      if (from > 0 && to === 0) {
        downwardAnimations.push({ from, to });
      }
      return origSpring(val, config);
    });

    // Tap Next Round
    act(() => {
      fireEvent.click(playAgainBtn);
    });

    // No card should animate down from face-up, spoiling newly dealt positions
    expect(downwardAnimations).toHaveLength(0);

    // All cards on the newly dealt board must be face down
    const nextCards = screen.getAllByTestId(/^memory-card-/);
    expect(nextCards).toHaveLength(initial.cards.length);
    for (const card of nextCards) {
      expect(card.getAttribute("aria-label")).toBe("face-down card");
    }
  });

  it("mounts cards face down with no down animation on tier change", () => {
    const { rerender } = render(
      <MemoryGame onHome={() => {}} difficulty="easy" lang="en" />,
    );

    const initialCards = screen.getAllByTestId(/^memory-card-/);
    const testId0 = initialCards[0].getAttribute("data-testid") ?? "";
    const iconMatch = testId0.match(/^memory-card-\d+-(.+)$/);
    expect(iconMatch).not.toBeNull();
    const icon0 = iconMatch ? iconMatch[1] : "";
    const match = initialCards.filter((c) =>
      (c.getAttribute("data-testid") ?? "").endsWith(`-${icon0}`),
    );
    expect(match).toHaveLength(2);

    act(() => {
      fireEvent.click(match[0]);
    });
    act(() => {
      fireEvent.click(match[1]);
    });

    const downwardAnimations: Array<{ from: number; to: number }> = [];
    const origSpring = Animated.spring;
    vi.spyOn(Animated, "spring").mockImplementation((val, config) => {
      const state = val as ValueState;
      const from = state._value ?? 0;
      const to = typeof config.toValue === "number" ? config.toValue : -1;
      if (from > 0 && to === 0) {
        downwardAnimations.push({ from, to });
      }
      return origSpring(val, config);
    });

    // Rerender with medium difficulty
    act(() => {
      rerender(<MemoryGame onHome={() => {}} difficulty="medium" lang="en" />);
    });

    // No downward animation from face-up cards
    expect(downwardAnimations).toHaveLength(0);

    // Medium has 6 pairs = 12 cards, all face down
    const nextCards = screen.getAllByTestId(/^memory-card-/);
    expect(nextCards).toHaveLength(12);
    for (const card of nextCards) {
      expect(card.getAttribute("aria-label")).toBe("face-down card");
    }
  });
});
