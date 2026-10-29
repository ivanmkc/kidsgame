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
import * as sound from "../../../sound";
import { t } from "../../../i18n";
import { ConceptMatchGame } from "../ConceptMatchGame";
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
      win: vi.fn(),
      tap: vi.fn(),
    },
  };
});

vi.mock("../../../assets/images", () => {
  const p = new Proxy(
    {},
    {
      get: (_target, prop) => {
        if (prop === "nonexistent-icon") return undefined;
        return { uri: "stub.png" };
      },
    },
  );
  return {
    SPOTIT_ICONS: p,
    SHAPE_ICONS: p,
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

describe("ConceptMatchGame", () => {
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

  it("renders a board of face-down cards and simulates a full round", async () => {
    const fixedBoard: logic.ConceptMatchCard[] = [
      {
        key: "A-upper",
        conceptId: "A",
        display: { type: "text", text: "A" },
        speech: "A",
      },
      {
        key: "B-upper",
        conceptId: "B",
        display: { type: "text", text: "B" },
        speech: "B",
      },
      {
        key: "A-lower",
        conceptId: "A",
        display: { type: "text", text: "a" },
        speech: "A",
      },
      {
        key: "B-lower",
        conceptId: "B",
        display: { type: "text", text: "b" },
        speech: "B",
      },
    ];
    vi.spyOn(logic, "buildBoard").mockReturnValue(fixedBoard);

    const onHome = vi.fn();
    render(<ConceptMatchGame deck="letters" pairs={2} onHome={onHome} />);

    // 4 cards rendered, all face down initially
    const cards = screen
      .getAllByRole("button")
      .filter((el) =>
        el.getAttribute("data-testid")?.startsWith("concept-card-"),
      );
    expect(cards).toHaveLength(4);

    for (const card of cards) {
      expect(card.getAttribute("aria-label")).toBe("face-down card");
    }
    expect(screen.getByTestId("concept-score").textContent).toContain("0/2");
    expect(screen.getByTestId("concept-moves").textContent).toContain("0");

    // Tap first card (A-upper)
    const cardAUpper = screen.getByTestId("concept-card-A-upper");
    await act(async () => {
      fireEvent.click(cardAUpper);
    });
    expect(sound.say).toHaveBeenCalledWith("A");
    expect(cardAUpper.getAttribute("aria-label")).toBe("A");

    // Tap mismatched card (B-upper)
    const cardBUpper = screen.getByTestId("concept-card-B-upper");
    await act(async () => {
      fireEvent.click(cardBUpper);
    });
    expect(sound.say).toHaveBeenCalledWith("B");
    expect(screen.getByTestId("concept-moves").textContent).toContain("1");

    // Cards should flip back face-down after 750ms mismatch timeout
    act(() => {
      vi.advanceTimersByTime(750);
    });
    expect(cardAUpper.getAttribute("aria-label")).toBe("face-down card");
    expect(cardBUpper.getAttribute("aria-label")).toBe("face-down card");

    // Match first pair: A-upper and A-lower
    await act(async () => {
      fireEvent.click(screen.getByTestId("concept-card-A-upper"));
    });
    const cardALower = screen.getByTestId("concept-card-A-lower");
    await act(async () => {
      fireEvent.click(cardALower);
    });

    expect(sound.sfx.good).toHaveBeenCalled();
    expect(screen.getByTestId("concept-score").textContent).toContain("1/2");
    expect(cardAUpper.getAttribute("aria-label")).toBe("A");
    expect(cardALower.getAttribute("aria-label")).toBe("A");

    // Match second pair: B-upper and B-lower to win
    await act(async () => {
      fireEvent.click(screen.getByTestId("concept-card-B-upper"));
    });
    const cardBLower = screen.getByTestId("concept-card-B-lower");
    await act(async () => {
      fireEvent.click(cardBLower);
    });

    expect(sound.sfx.good).toHaveBeenCalledTimes(2);
    expect(screen.getByTestId("concept-score").textContent).toContain("2/2");
    expect(sound.say).toHaveBeenCalledWith(t("en", "win.memory"));

    // Advance 700ms for WinOverlay entrance animation
    act(() => {
      vi.advanceTimersByTime(700);
    });

    // WinOverlay appears
    expect(screen.getByTestId("win-overlay")).toBeDefined();
    const playAgainBtn = screen.getByTestId("play-again");
    expect(playAgainBtn).toBeDefined();

    // Click Play Again (resetGame)
    await act(async () => {
      fireEvent.click(playAgainBtn);
    });

    // Cards should be reset to fresh face-down instances
    const resetCards = screen
      .getAllByRole("button")
      .filter((el) =>
        el.getAttribute("data-testid")?.startsWith("concept-card-"),
      );
    expect(resetCards).toHaveLength(4);
    for (const card of resetCards) {
      expect(card.getAttribute("aria-label")).toBe("face-down card");
    }
  });

  it("renders card faces for all supported display types: text, icon, color, audio, and dots", async () => {
    const multiTypeBoard: logic.ConceptMatchCard[] = [
      {
        key: "c-text",
        conceptId: "text-id",
        display: { type: "text", text: "Elephant" },
        speech: "elephant",
      },
      {
        key: "c-icon",
        conceptId: "text-id",
        display: { type: "icon", icon: "dog" },
        speech: "dog",
      },
      {
        key: "c-color",
        conceptId: "color-id",
        display: { type: "color", color: "#E53935" },
        speech: "red",
      },
      {
        key: "c-audio",
        conceptId: "color-id",
        display: { type: "audio", text: "woof" },
        speech: "woof",
      },
      {
        key: "c-dots",
        conceptId: "dots-id",
        display: { type: "dots", count: 3 },
        speech: "three",
      },
      {
        key: "c-dots-match",
        conceptId: "dots-id",
        display: { type: "text", text: "3" },
        speech: "three",
      },
    ];
    vi.spyOn(logic, "buildBoard").mockReturnValue(multiTypeBoard);

    render(<ConceptMatchGame deck="picture-word" pairs={3} />);

    // Verify all card faces exist in the DOM
    expect(screen.getByTestId("card-text-c-text")).toBeDefined();
    expect(screen.getByTestId("card-text-c-text").textContent).toBe("Elephant");

    expect(screen.getByTestId("card-icon-c-icon")).toBeDefined();

    const colorCard = screen.getByTestId("card-color-c-color");
    expect(colorCard).toBeDefined();

    const audioCard = screen.getByTestId("card-audio-c-audio");
    expect(audioCard).toBeDefined();
    expect(screen.getByTestId("card-audio-text-c-audio").textContent).toBe(
      "woof",
    );

    const dotsCard = screen.getByTestId("card-dots-c-dots");
    expect(dotsCard).toBeDefined();
    expect(screen.getByTestId("card-dot-c-dots-0")).toBeDefined();
    expect(screen.getByTestId("card-dot-c-dots-1")).toBeDefined();
    expect(screen.getByTestId("card-dot-c-dots-2")).toBeDefined();
  });

  it("renders audio card face with speech fallback when text is omitted to satisfy R3", () => {
    const audioBoard: logic.ConceptMatchCard[] = [
      {
        key: "audio-no-text",
        conceptId: "apple",
        display: { type: "audio" },
        speech: "apple",
      },
      {
        key: "icon-apple",
        conceptId: "apple",
        display: { type: "icon", icon: "apple" },
        speech: "apple",
      },
    ];
    vi.spyOn(logic, "buildBoard").mockReturnValue(audioBoard);

    render(<ConceptMatchGame deck="picture-spoken" pairs={1} />);

    expect(screen.getByTestId("card-audio-audio-no-text")).toBeDefined();
    expect(
      screen.getByTestId("card-audio-text-audio-no-text").textContent,
    ).toBe("apple");
  });

  it("throws an error if icon asset is missing from asset maps", () => {
    const invalidBoard: logic.ConceptMatchCard[] = [
      {
        key: "missing-icon-card",
        conceptId: "missing-concept",
        display: { type: "icon", icon: "nonexistent-icon" },
        speech: "missing",
      },
    ];
    vi.spyOn(logic, "buildBoard").mockReturnValue(invalidBoard);

    expect(() =>
      render(<ConceptMatchGame deck="picture-word" pairs={1} />),
    ).toThrow("Missing icon asset for concept: nonexistent-icon");
  });

  it("localizes face-down cards and speech in non-English mode", async () => {
    const jpBoard: logic.ConceptMatchCard[] = [
      {
        key: "neko-icon",
        conceptId: "cat",
        display: { type: "icon", icon: "cat" },
        speech: "ねこ",
      },
      {
        key: "neko-word",
        conceptId: "cat",
        display: { type: "text", text: "ねこ" },
        speech: "ねこ",
      },
    ];
    vi.spyOn(logic, "buildBoard").mockReturnValue(jpBoard);

    render(<ConceptMatchGame deck="picture-word" lang="ja" pairs={1} />);

    const card = screen.getByTestId("concept-card-neko-icon");
    expect(card.getAttribute("aria-label")).toBe(
      t("ja", "memory.cardFaceDown"),
    );

    await act(async () => {
      fireEvent.click(card);
    });
    expect(sound.say).toHaveBeenCalledWith("ねこ");
    expect(card.getAttribute("aria-label")).toBe("ねこ");
  });

  it("speaks opening blurb instruction before the child acts to satisfy R6", () => {
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

    render(<ConceptMatchGame deck="letters" lang="ja" pairs={1} />);

    expect(speakSpy).toHaveBeenCalledWith(
      expect.objectContaining({ text: t("ja", "card.memory.blurb") }),
    );
  });

  it("ignores clicks on already face-up, matched, or locked cards", async () => {
    const board: logic.ConceptMatchCard[] = [
      {
        key: "A-1",
        conceptId: "A",
        display: { type: "text", text: "A" },
        speech: "A",
      },
      {
        key: "B-1",
        conceptId: "B",
        display: { type: "text", text: "B" },
        speech: "B",
      },
      {
        key: "C-1",
        conceptId: "C",
        display: { type: "text", text: "C" },
        speech: "C",
      },
      {
        key: "A-2",
        conceptId: "A",
        display: { type: "text", text: "a" },
        speech: "A",
      },
    ];
    vi.spyOn(logic, "buildBoard").mockReturnValue(board);

    render(<ConceptMatchGame deck="letters" pairs={2} />);
    vi.mocked(sound.say).mockClear();

    const cardA1 = screen.getByTestId("concept-card-A-1");
    await act(async () => {
      fireEvent.click(cardA1);
    });
    expect(sound.say).toHaveBeenCalledTimes(1);
    expect(sound.say).toHaveBeenCalledWith("A");

    // Clicking already face-up card should not say again
    await act(async () => {
      fireEvent.click(cardA1);
    });
    expect(sound.say).toHaveBeenCalledTimes(1);

    // Click B-1 to mismatch
    const cardB1 = screen.getByTestId("concept-card-B-1");
    await act(async () => {
      fireEvent.click(cardB1);
    });
    expect(sound.say).toHaveBeenCalledTimes(2);

    // Board is locked during mismatch timeout; clicking C-1 should do nothing
    const cardC1 = screen.getByTestId("concept-card-C-1");
    await act(async () => {
      fireEvent.click(cardC1);
    });
    expect(sound.say).toHaveBeenCalledTimes(2);
    expect(cardC1.getAttribute("aria-label")).toBe("face-down card");

    // Advance timer past mismatch
    act(() => {
      vi.advanceTimersByTime(750);
    });

    // Now clicking works again
    await act(async () => {
      fireEvent.click(cardC1);
    });
    expect(sound.say).toHaveBeenCalledTimes(3);
    expect(sound.say).toHaveBeenCalledWith("C");
  });

  it("calls onHome when back button or win-home button is pressed", async () => {
    const onHome = vi.fn();
    const board: logic.ConceptMatchCard[] = [
      {
        key: "A-1",
        conceptId: "A",
        display: { type: "text", text: "A" },
        speech: "A",
      },
      {
        key: "A-2",
        conceptId: "A",
        display: { type: "text", text: "a" },
        speech: "A",
      },
    ];
    vi.spyOn(logic, "buildBoard").mockReturnValue(board);

    render(<ConceptMatchGame deck="letters" pairs={1} onHome={onHome} />);

    // Click back button in GameShell
    const backBtn = screen.getByTestId("back-button");
    fireEvent.click(backBtn);
    expect(onHome).toHaveBeenCalledTimes(1);

    // Complete the pair
    await act(async () => {
      fireEvent.click(screen.getByTestId("concept-card-A-1"));
    });
    await act(async () => {
      fireEvent.click(screen.getByTestId("concept-card-A-2"));
    });

    act(() => {
      vi.advanceTimersByTime(700);
    });

    const winHomeBtn = screen.getByTestId("win-home");
    await act(async () => {
      fireEvent.click(winHomeBtn);
    });
    expect(onHome).toHaveBeenCalledTimes(2);
  });

  it("updates board when deck prop changes", () => {
    const spy = vi.spyOn(logic, "buildBoard");

    const { rerender } = render(<ConceptMatchGame deck="letters" pairs={2} />);
    expect(spy).toHaveBeenCalledWith(expect.anything(), "letters", "en", 2);

    rerender(<ConceptMatchGame deck="color-word" pairs={2} />);
    expect(spy).toHaveBeenCalledWith(expect.anything(), "color-word", "en", 2);
  });

  it("preserves active round progress and updates card text/speech when lang changes mid-game (G5)", async () => {
    const board: logic.ConceptMatchCard[] = [
      {
        key: "red-color",
        conceptId: "red",
        display: { type: "color", color: "#E53935" },
        speech: "red",
      },
      {
        key: "red-word",
        conceptId: "red",
        display: { type: "text", text: "red" },
        speech: "red",
      },
      {
        key: "blue-color",
        conceptId: "blue",
        display: { type: "color", color: "#1E88E5" },
        speech: "blue",
      },
      {
        key: "blue-word",
        conceptId: "blue",
        display: { type: "text", text: "blue" },
        speech: "blue",
      },
    ];
    const spy = vi.spyOn(logic, "buildBoard").mockReturnValue(board);

    const { rerender } = render(
      <ConceptMatchGame deck="color-word" pairs={2} lang="en" />,
    );
    expect(spy).toHaveBeenCalledTimes(1);

    // Match first pair
    await act(async () => {
      fireEvent.click(screen.getByTestId("concept-card-red-color"));
    });
    await act(async () => {
      fireEvent.click(screen.getByTestId("concept-card-red-word"));
    });
    expect(screen.getByTestId("concept-score").textContent).toContain("1/2");

    // Clear sound.say mock before lang switch
    vi.mocked(sound.say).mockClear();

    // Language switch mid-game
    rerender(<ConceptMatchGame deck="color-word" pairs={2} lang="ja" />);

    // Board must NOT rebuild, progress must be preserved
    expect(spy).toHaveBeenCalledTimes(1);
    expect(screen.getByTestId("concept-score").textContent).toContain("1/2");

    // Cards should now display and speak Japanese
    expect(screen.getByTestId("card-text-red-word").textContent).toBe("あか");
    expect(screen.getByTestId("card-text-blue-word").textContent).toBe("あお");
    expect(
      screen.getByTestId("concept-card-red-word").getAttribute("aria-label"),
    ).toBe("あか");

    // Tapping the unmatched blue card speaks Japanese
    await act(async () => {
      fireEvent.click(screen.getByTestId("concept-card-blue-word"));
    });
    expect(sound.say).toHaveBeenCalledWith("あお");
  });

  it("replays win narration and does not speak starting blurb when language switches on win screen (G5)", async () => {
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

    const board: logic.ConceptMatchCard[] = [
      {
        key: "A-1",
        conceptId: "A",
        display: { type: "text", text: "A" },
        speech: "A",
      },
      {
        key: "A-2",
        conceptId: "A",
        display: { type: "text", text: "a" },
        speech: "A",
      },
    ];
    vi.spyOn(logic, "buildBoard").mockReturnValue(board);

    const { rerender } = render(
      <ConceptMatchGame deck="letters" pairs={1} lang="en" />,
    );

    // Initial render speaks the opening blurb
    expect(speakSpy).toHaveBeenCalledWith(
      expect.objectContaining({ text: t("en", "card.memory.blurb") }),
    );
    speakSpy.mockClear();

    // Complete the pair to win
    await act(async () => {
      fireEvent.click(screen.getByTestId("concept-card-A-1"));
    });
    await act(async () => {
      fireEvent.click(screen.getByTestId("concept-card-A-2"));
    });

    expect(sound.say).toHaveBeenCalledWith(t("en", "win.memory"));
    vi.mocked(sound.say).mockClear();

    // Switch language while win screen is active
    rerender(<ConceptMatchGame deck="letters" pairs={1} lang="ja" />);

    // Starting blurb must NOT be spoken on win screen
    expect(speakSpy).not.toHaveBeenCalledWith(
      expect.objectContaining({ text: t("ja", "card.memory.blurb") }),
    );
    // Win message must replay in the new language
    expect(sound.say).toHaveBeenCalledWith(t("ja", "win.memory"));
  });

  it("renders a mixed deck game board and allows flipping cards", async () => {
    const mixedBoard: logic.ConceptMatchCard[] = [
      {
        key: "A-upper",
        conceptId: "A",
        display: { type: "text", text: "A" },
        speech: "A",
      },
      {
        key: "A-lower",
        conceptId: "A",
        display: { type: "text", text: "a" },
        speech: "A",
      },
      {
        key: "red-color",
        conceptId: "red",
        display: { type: "color", color: "#E53935" },
        speech: "red",
      },
      {
        key: "red-word",
        conceptId: "red",
        display: { type: "text", text: "red" },
        speech: "red",
      },
    ];
    vi.spyOn(logic, "buildBoard").mockReturnValue(mixedBoard);

    render(<ConceptMatchGame deck="mixed" pairs={2} lang="en" />);

    expect(screen.getByTestId("concept-board")).toBeDefined();
    expect(screen.getByTestId("concept-card-A-upper")).toBeDefined();
    expect(screen.getByTestId("concept-card-red-color")).toBeDefined();

    await act(async () => {
      fireEvent.click(screen.getByTestId("concept-card-red-color"));
    });
    expect(sound.say).toHaveBeenCalledWith("red");
    expect(screen.getByTestId("card-color-red-color")).toBeDefined();
  });

  it("adjusts pair count based on difficulty prop", () => {
    const buildBoardSpy = vi.spyOn(logic, "buildBoard");
    const { rerender } = render(
      <ConceptMatchGame deck="letters" difficulty="easy" lang="en" />,
    );
    expect(buildBoardSpy).toHaveBeenCalledWith(
      expect.anything(),
      "letters",
      "en",
      3,
    );

    rerender(<ConceptMatchGame deck="letters" difficulty="medium" lang="en" />);
    expect(buildBoardSpy).toHaveBeenCalledWith(
      expect.anything(),
      "letters",
      "en",
      4,
    );

    rerender(<ConceptMatchGame deck="letters" difficulty="hard" lang="en" />);
    expect(buildBoardSpy).toHaveBeenCalledWith(
      expect.anything(),
      "letters",
      "en",
      5,
    );
  });

  it("renders distinct card and pair counts for shapes-objects across easy, medium, and hard", () => {
    const { rerender } = render(
      <ConceptMatchGame deck="shapes-objects" difficulty="easy" lang="en" />,
    );
    let cards = screen
      .getAllByRole("button")
      .filter((el) =>
        el.getAttribute("data-testid")?.startsWith("concept-card-"),
      );
    expect(cards).toHaveLength(4);
    expect(screen.getByTestId("concept-score").textContent).toContain("0/2");
    expect(screen.getByText("Find all 2 pairs")).toBeDefined();

    rerender(
      <ConceptMatchGame deck="shapes-objects" difficulty="medium" lang="en" />,
    );
    cards = screen
      .getAllByRole("button")
      .filter((el) =>
        el.getAttribute("data-testid")?.startsWith("concept-card-"),
      );
    expect(cards).toHaveLength(6);
    expect(screen.getByTestId("concept-score").textContent).toContain("0/3");
    expect(screen.getByText("Find all 3 pairs")).toBeDefined();

    rerender(
      <ConceptMatchGame deck="shapes-objects" difficulty="hard" lang="en" />,
    );
    cards = screen
      .getAllByRole("button")
      .filter((el) =>
        el.getAttribute("data-testid")?.startsWith("concept-card-"),
      );
    expect(cards).toHaveLength(8);
    expect(screen.getByTestId("concept-score").textContent).toContain("0/4");
    expect(screen.getByText("Find all 4 pairs")).toBeDefined();
  });
});
