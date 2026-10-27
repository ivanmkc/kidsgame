// @vitest-environment happy-dom
import React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  render,
  screen,
  fireEvent,
  act,
  cleanup,
} from "@testing-library/react";
import { Lang } from "../../../lang";
import { manifest } from "../../../manifest";
import * as sound from "../../../sound";
import { t } from "../../../i18n";
import { MemoryGame } from "../MemoryGame";
import * as logic from "../logic";

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

describe("cardLabel", () => {
  it("localizes icon names to the requested language", () => {
    expect(logic.cardLabel("star", "en")).toBe("star");
    expect(logic.cardLabel("star", "ja")).toBe("ほし");
    expect(logic.cardLabel("star", "cmn")).toBe("星星");
    expect(logic.cardLabel("star", "yue")).toBe("星星");
    expect(logic.cardLabel("butterfly", "en")).toBe("butterfly");
    expect(logic.cardLabel("butterfly", "ja")).toBe("ちょうちょ");
    expect(logic.cardLabel("ladybug", "ja")).toBe("てんとうむし");
    expect(logic.cardLabel("blossom", "en")).toBe("flower");
    expect(logic.cardLabel("blossom", "ja")).toBe("はな");
  });

  it("throws loudly when an icon is not in WORDS", () => {
    expect(() => logic.cardLabel("nonexistent_icon", "en")).toThrow(
      "Unknown memory icon: nonexistent_icon",
    );
  });

  it("resolves all icons in manifest.spotit.icons across all supported languages", () => {
    const langs: Lang[] = ["en", "ja", "cmn", "yue"];
    for (const icon of manifest.spotit.icons) {
      for (const lang of langs) {
        const label = logic.cardLabel(icon, lang);
        expect(label).toBeTruthy();
        expect(typeof label).toBe("string");
      }
    }
  });
});

describe("MemoryGame", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    setViewport(800, 600);
    vi.clearAllMocks();
  });

  afterEach(() => {
    act(() => {
      vi.runOnlyPendingTimers();
    });
    cleanup();
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("renders memory cards on board and tracks moves on card flips", async () => {
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

  it("localizes face-down card accessibility labels via i18n in non-English mode", () => {
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

  it("localizes face-up card accessibility labels in Japanese", async () => {
    vi.spyOn(logic, "buildBoard").mockReturnValue([
      { key: 0, icon: "star" },
      { key: 1, icon: "butterfly" },
      { key: 2, icon: "star" },
      { key: 3, icon: "butterfly" },
    ]);

    const onHome = vi.fn();
    render(<MemoryGame onHome={onHome} difficulty="easy" lang="ja" />);

    const starCard = screen.getByTestId("memory-card-0-star");
    expect(starCard.getAttribute("aria-label")).toBe("うらがえしのカード");

    await act(async () => {
      fireEvent.click(starCard);
    });

    expect(starCard.getAttribute("aria-label")).toBe("ほし");
    expect(starCard.getAttribute("aria-label")).not.toBe("star");
  });

  it("localizes face-up card accessibility labels in Mandarin and Cantonese", async () => {
    vi.spyOn(logic, "buildBoard").mockReturnValue([
      { key: 0, icon: "apple" },
      { key: 1, icon: "banana" },
      { key: 2, icon: "apple" },
      { key: 3, icon: "banana" },
    ]);

    const onHome = vi.fn();
    const { unmount } = render(
      <MemoryGame onHome={onHome} difficulty="easy" lang="cmn" />,
    );

    const appleCardCmn = screen.getByTestId("memory-card-0-apple");
    await act(async () => {
      fireEvent.click(appleCardCmn);
    });
    expect(appleCardCmn.getAttribute("aria-label")).toBe("苹果");

    unmount();

    render(<MemoryGame onHome={onHome} difficulty="easy" lang="yue" />);
    const appleCardYue = screen.getByTestId("memory-card-0-apple");
    await act(async () => {
      fireEvent.click(appleCardYue);
    });
    expect(appleCardYue.getAttribute("aria-label")).toBe("蘋果");
  });

  it("localizes intro blurb in solo mode and speaks it on mount", () => {
    const speakSpy = vi.fn();
    (window as unknown as { speechSynthesis: unknown }).speechSynthesis = {
      speak: speakSpy,
      cancel: vi.fn(),
    };
    (
      window as unknown as { SpeechSynthesisUtterance: unknown }
    ).SpeechSynthesisUtterance = class {
      text: string;
      constructor(text: string) {
        this.text = text;
      }
    };

    const onHome = vi.fn();
    render(<MemoryGame onHome={onHome} difficulty="easy" lang="ja" />);

    expect(speakSpy).toHaveBeenCalledWith(
      expect.objectContaining({ text: t("ja", "card.memory.blurb") }),
    );
    expect(speakSpy).not.toHaveBeenCalledWith(
      expect.objectContaining({ text: "Flip the cards and find the pairs!" }),
    );
  });

  it("mutes intro blurb when mode is null and speaks it once solo is chosen", async () => {
    const speakSpy = vi.fn();
    (window as unknown as { speechSynthesis: unknown }).speechSynthesis = {
      speak: speakSpy,
      cancel: vi.fn(),
    };
    (
      window as unknown as { SpeechSynthesisUtterance: unknown }
    ).SpeechSynthesisUtterance = class {
      text: string;
      constructor(text: string) {
        this.text = text;
      }
    };

    const onHome = vi.fn();
    render(
      <MemoryGame
        onHome={onHome}
        difficulty="easy"
        twoPlayerEnabled={true}
        lang="ja"
      />,
    );

    // ModePicker is visible, ModePicker title is spoken
    expect(screen.getByTestId("mode-picker")).toBeDefined();
    expect(speakSpy).toHaveBeenCalledWith(
      expect.objectContaining({ text: t("ja", "mp.title") }),
    );
    expect(speakSpy).not.toHaveBeenCalledWith(
      expect.objectContaining({ text: t("ja", "card.memory.blurb") }),
    );
    expect(speakSpy).not.toHaveBeenCalledWith(
      expect.objectContaining({ text: "Flip the cards and find the pairs!" }),
    );

    // Choose solo mode
    speakSpy.mockClear();
    await act(async () => {
      fireEvent.click(screen.getByTestId("mp-choose-1p"));
    });

    expect(speakSpy).toHaveBeenCalledWith(
      expect.objectContaining({ text: t("ja", "card.memory.blurb") }),
    );
  });

  it("plays in 2P duel mode, updates player scores on matches, and allows rematch", async () => {
    const onHome = vi.fn();
    render(
      <MemoryGame
        onHome={onHome}
        difficulty="easy"
        twoPlayerEnabled
        lang="en"
      />,
    );

    // In 2P enabled mode, ModePicker is shown first
    const twoPlayerBtn = screen.getByTestId("mp-choose-2p");
    await act(async () => {
      fireEvent.click(twoPlayerBtn);
    });

    // Board and duel chips are now visible
    expect(screen.getByTestId("memory-duel-chip-0")).toBeDefined();
    expect(screen.getByTestId("memory-duel-chip-1")).toBeDefined();

    const cards = screen
      .getAllByRole("button")
      .filter((el) =>
        el.getAttribute("data-testid")?.startsWith("memory-card-"),
      );
    expect(cards).toHaveLength(8);

    // Group cards by icon
    const iconPairs = new Map<string, HTMLElement[]>();
    for (const card of cards) {
      const parts = card.getAttribute("data-testid")!.split("-");
      const icon = parts.slice(3).join("-");
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
    const rematchBtn = screen.getByTestId("play-again");
    expect(rematchBtn).toBeDefined();

    // Clicking Rematch resets board
    await act(async () => {
      fireEvent.click(rematchBtn);
    });

    const resetCards = screen
      .getAllByRole("button")
      .filter((el) =>
        el.getAttribute("data-testid")?.startsWith("memory-card-"),
      );
    expect(resetCards).toHaveLength(8);
    for (const card of resetCards) {
      expect(card.getAttribute("aria-label")).toBe("face-down card");
    }
  });

  it("cancels mismatch timer on unmount and prevents ghost turn narration in duel mode", () => {
    vi.spyOn(logic, "buildBoard").mockReturnValue([
      { key: 0, icon: "apple" },
      { key: 1, icon: "banana" },
      { key: 2, icon: "apple" },
      { key: 3, icon: "banana" },
    ]);
    const { unmount } = render(
      <MemoryGame
        onHome={vi.fn()}
        difficulty="easy"
        twoPlayerEnabled={true}
        lang="en"
      />,
    );

    // Choose 2P duel mode
    fireEvent.click(screen.getByTestId("mp-choose-2p"));

    // Flip two mismatched cards
    fireEvent.click(screen.getByTestId("memory-card-0-apple"));
    fireEvent.click(screen.getByTestId("memory-card-1-banana"));

    // Clear prior narrations (like mode picker or starter announcement)
    vi.mocked(sound.say).mockClear();

    // Navigating away (unmount) immediately during the 750ms mismatch timeout
    unmount();

    // Advance past the 750ms mismatch timeout
    act(() => {
      vi.advanceTimersByTime(1000);
    });

    // Ghost speech should not be played after unmount
    expect(sound.say).not.toHaveBeenCalled();
  });

  it("allows normal card flip back after mismatch timeout when not unmounted", () => {
    vi.spyOn(logic, "buildBoard").mockReturnValue([
      { key: 0, icon: "apple" },
      { key: 1, icon: "banana" },
      { key: 2, icon: "apple" },
      { key: 3, icon: "banana" },
    ]);

    render(<MemoryGame onHome={vi.fn()} difficulty="easy" lang="en" />);

    // Flip two mismatched cards
    fireEvent.click(screen.getByTestId("memory-card-0-apple"));
    fireEvent.click(screen.getByTestId("memory-card-1-banana"));

    // Advance past the 750ms mismatch timeout
    act(() => {
      vi.advanceTimersByTime(750);
    });

    // After timer elapses, cards should turn face down again and next flips work
    fireEvent.click(screen.getByTestId("memory-card-0-apple"));
    fireEvent.click(screen.getByTestId("memory-card-2-apple"));

    expect(sound.sfx.good).toHaveBeenCalled();
  });

  it("announces next player turn after mismatch timeout when not unmounted in duel mode", () => {
    vi.spyOn(logic, "buildBoard").mockReturnValue([
      { key: 0, icon: "apple" },
      { key: 1, icon: "banana" },
      { key: 2, icon: "apple" },
      { key: 3, icon: "banana" },
    ]);

    render(
      <MemoryGame
        onHome={vi.fn()}
        difficulty="easy"
        twoPlayerEnabled={true}
        lang="en"
      />,
    );

    fireEvent.click(screen.getByTestId("mp-choose-2p"));

    fireEvent.click(screen.getByTestId("memory-card-0-apple"));
    fireEvent.click(screen.getByTestId("memory-card-1-banana"));

    vi.mocked(sound.say).mockClear();

    act(() => {
      vi.advanceTimersByTime(750);
    });

    expect(sound.say).toHaveBeenCalledWith(expect.stringContaining("'s turn!"));
  });

  it("mounts fresh face-down cards on next round without flipping down from face-up", async () => {
    const onHome = vi.fn();
    render(<MemoryGame onHome={onHome} difficulty="easy" lang="en" />);

    const cards = screen
      .getAllByRole("button")
      .filter((el) =>
        el.getAttribute("data-testid")?.startsWith("memory-card-"),
      );

    // Group cards by icon
    const iconPairs = new Map<string, HTMLElement[]>();
    for (const card of cards) {
      const parts = card.getAttribute("data-testid")!.split("-");
      const icon = parts.slice(3).join("-");
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

    const nextRoundBtn = screen.getByTestId("play-again");
    expect(nextRoundBtn).toBeDefined();

    // Click Next Round
    await act(async () => {
      fireEvent.click(nextRoundBtn);
    });

    // All card DOM elements should be fresh instances (not reused from round 1)
    const newCards = screen
      .getAllByRole("button")
      .filter((el) =>
        el.getAttribute("data-testid")?.startsWith("memory-card-"),
      );
    expect(newCards).toHaveLength(8);
    for (const card of newCards) {
      expect(cards).not.toContain(card);
      expect(card.getAttribute("aria-label")).toBe("face-down card");
    }
  });
});
