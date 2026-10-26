// @vitest-environment happy-dom
import {
  render,
  screen,
  fireEvent,
  act,
  cleanup,
} from "@testing-library/react";
import React, { useState } from "react";
import { vi, test, expect, afterEach, describe, it } from "vitest";
import { LangContext } from "../../../components/GameShell";
import { Difficulty } from "../../../difficulty";
import { Lang } from "../../../lang";
import * as sound from "../../../sound";
import { BingoGame } from "../BingoGame";
import * as logic from "../logic";

vi.useFakeTimers();

afterEach(() => {
  sound.stopNarration();
  cleanup();
  vi.restoreAllMocks();
});

test("tapping an incorrect tile after a correct one does not cancel the round advance", async () => {
  const onHome = vi.fn();
  render(<BingoGame onHome={onHome} difficulty="easy" lang="en" />);

  await act(async () => {
    vi.advanceTimersByTime(1000);
  });

  let prompt = screen.getByTestId("bingo-prompt");
  let initialPrompt = prompt.getAttribute("aria-label")!;

  let icon = initialPrompt.replace("Find the ", "").replace("!", "");

  let cells = screen.queryAllByTestId(/bingo-cell-/);
  let correctCell = cells.find((c) => c.getAttribute("aria-label") === icon);
  let incorrectCell = cells.find((c) => c.getAttribute("aria-label") !== icon);

  // Tap correct
  await act(async () => {
    fireEvent.click(correctCell!);
  });

  // IMMEDIATELY tap incorrect
  await act(async () => {
    fireEvent.click(incorrectCell!);
  });

  // Wait for round advance logic
  await act(async () => {
    vi.advanceTimersByTime(100);
  });

  prompt = screen.getByTestId("bingo-prompt");
  // At 100ms, the game should still be waiting for the confirmation audio to finish,
  // rather than having been prematurely canceled by the incorrect tap.
  expect(prompt.getAttribute("aria-label")).toBe(initialPrompt);

  // After the full duration (9s fallback in test env), it should advance properly.
  await act(async () => {
    vi.advanceTimersByTime(9000);
  });

  prompt = screen.getByTestId("bingo-prompt");
  expect(prompt.getAttribute("aria-label")).not.toBe(initialPrompt);
});

test("rapid double-tap on correct tile only scores once and does not double-advance", async () => {
  const sayThenSpy = vi.spyOn(sound, "sayThen");
  const onHome = vi.fn();
  render(<BingoGame onHome={onHome} difficulty="easy" lang="en" />);

  await act(async () => {
    vi.advanceTimersByTime(1000);
  });

  const prompt = screen.getByTestId("bingo-prompt");
  const initialPrompt = prompt.getAttribute("aria-label")!;
  const icon = initialPrompt.replace("Find the ", "").replace("!", "");

  const cells = screen.queryAllByTestId(/bingo-cell-/);
  const correctCell = cells.find((c) => c.getAttribute("aria-label") === icon);
  expect(correctCell).toBeDefined();

  sayThenSpy.mockClear();

  // Rapidly tap the correct tile twice synchronously
  await act(async () => {
    fireEvent.click(correctCell!);
    fireEvent.click(correctCell!);
  });

  // Locked during confirmation: sayThen must only be queued once
  expect(sayThenSpy).toHaveBeenCalledTimes(1);

  // Advance past confirmation duration
  await act(async () => {
    vi.advanceTimersByTime(9000);
  });

  // Exactly 1 tile should be marked
  const score = screen.getByTestId("bingo-score");
  expect(score.textContent).toBe("⭐ 1");
});

test("changes language", async () => {
  const onHome = vi.fn();
  const { rerender } = render(
    <BingoGame onHome={onHome} difficulty="easy" lang="en" />,
  );
  await act(async () => {
    vi.runAllTimers();
  });

  // Change lang (covers line 75, 85)
  rerender(<BingoGame onHome={onHome} difficulty="easy" lang="ja" />);
  await act(async () => {
    vi.runAllTimers();
  });

  const prompts = screen.getAllByTestId("bingo-prompt");
  const jaPrompt = prompts[prompts.length - 1];
  expect(jaPrompt.textContent).toContain("さがしてね");
});

test("unmounts with wrong timer running", async () => {
  const onHome = vi.fn();
  const { unmount } = render(
    <BingoGame onHome={onHome} difficulty="easy" lang="en" />,
  );
  await act(async () => {
    vi.runAllTimers();
  });

  let prompt = screen.getByTestId("bingo-prompt");
  let icon = prompt
    .getAttribute("aria-label")!
    .replace("Find the ", "")
    .replace("!", "");

  let cells = screen.queryAllByTestId(/bingo-cell-/);
  let incorrectCell = cells.find((c) => c.getAttribute("aria-label") !== icon);

  // Tap incorrect tile (covers 130, 131)
  await act(async () => {
    fireEvent.click(incorrectCell!);
  });

  // Unmount while wrong timer is running (covers 98)
  unmount();
  // Expect no errors
  expect(true).toBe(true);
});

test("plays through to win and resets", async () => {
  const onHome = vi.fn();
  render(<BingoGame onHome={onHome} difficulty="easy" lang="en" />);
  await act(async () => {
    vi.runAllTimers();
  });

  // Play until win
  for (let round = 0; round < 10; round++) {
    if (screen.queryByTestId("win-overlay")) break;

    let prompt = screen.queryByTestId("bingo-prompt");
    if (!prompt) break;
    let icon = prompt
      .getAttribute("aria-label")!
      .replace("Find the ", "")
      .replace("!", "");
    let cells = screen.queryAllByTestId(/bingo-cell-/);
    let correctCell = cells.find((c) => c.getAttribute("aria-label") === icon);
    if (!correctCell) break;

    await act(async () => {
      fireEvent.click(correctCell);
    });
    await act(async () => {
      vi.runAllTimers();
    });
  }

  // Covers 118 (winLine set)
  expect(screen.getByTestId("win-overlay")).toBeDefined();

  // The WinOverlay arms its buttons after a 600ms delay to prevent misclicks
  await act(async () => {
    vi.advanceTimersByTime(1000);
  });

  // Click Play Again (covers 141-152)
  const nextBtn = screen.getByTestId("play-again");
  await act(async () => {
    fireEvent.click(nextBtn);
  });
  await act(async () => {
    vi.runAllTimers();
  });

  // Should have restarted
  expect(screen.getByTestId("bingo-prompt")).toBeDefined();
});

test("confetti remounts and triggers on subsequent correct answers", async () => {
  const onHome = vi.fn();
  render(<BingoGame onHome={onHome} difficulty="easy" lang="en" />);

  await act(async () => {
    vi.advanceTimersByTime(1000);
  });

  // Initially no confetti is shown
  expect(screen.queryAllByText("🎉").length).toBe(0);

  // Find and tap first correct tile
  let prompt = screen.getByTestId("bingo-prompt");
  let icon = prompt
    .getAttribute("aria-label")!
    .replace("Find the ", "")
    .replace("!", "");
  let cells = screen.queryAllByTestId(/bingo-cell-/);
  let correctCell = cells.find((c) => c.getAttribute("aria-label") === icon);

  await act(async () => {
    fireEvent.click(correctCell!);
  });

  // Confetti mounts on first correct answer
  const firstConfetti = screen.queryAllByText("🎉");
  expect(firstConfetti.length).toBeGreaterThan(0);

  // Advance past confirmation to next call
  await act(async () => {
    vi.advanceTimersByTime(9000);
  });

  // Find and tap second correct tile
  prompt = screen.getByTestId("bingo-prompt");
  icon = prompt
    .getAttribute("aria-label")!
    .replace("Find the ", "")
    .replace("!", "");
  cells = screen.queryAllByTestId(/bingo-cell-/);
  correctCell = cells.find((c) => c.getAttribute("aria-label") === icon);

  await act(async () => {
    fireEvent.click(correctCell!);
  });

  // Confetti must remount on second correct answer
  const secondConfetti = screen.queryAllByText("🎉");
  expect(secondConfetti.length).toBeGreaterThan(0);
  expect(secondConfetti[0]).not.toBe(firstConfetti[0]);
  expect(firstConfetti[0].isConnected).toBe(false);
});

function LangHarness({
  difficulty = "easy",
  initialLang = "en",
}: {
  difficulty?: Difficulty;
  initialLang?: Lang;
}) {
  const [lang, setLang] = useState<Lang>(initialLang);
  const cycleLang = () => {
    setLang((l) =>
      l === "en" ? "ja" : l === "ja" ? "cmn" : l === "cmn" ? "yue" : "en",
    );
  };
  return (
    <LangContext.Provider value={{ lang, onCycle: cycleLang }}>
      <BingoGame onHome={() => {}} difficulty={difficulty} lang={lang} />
    </LangContext.Provider>
  );
}

const mockBoardEn: logic.BingoBoard = {
  size: 3,
  cells: [
    { icon: "apple", label: "apple" },
    { icon: "banana", label: "banana" },
    { icon: "cat", label: "cat" },
    { icon: "dog", label: "dog" },
    { icon: "elephant", label: "elephant" },
    { icon: "fish", label: "fish" },
    { icon: "guitar", label: "guitar" },
    { icon: "hat", label: "hat" },
    { icon: "icecream", label: "ice cream" },
  ],
  calls: [
    {
      mode: "name",
      answerIdx: 0,
      promptLines: ["Find the apple!"],
      confirmLines: ["Apple!"],
    },
    {
      mode: "name",
      answerIdx: 1,
      promptLines: ["Find the banana!"],
      confirmLines: ["Banana!"],
    },
    {
      mode: "name",
      answerIdx: 2,
      promptLines: ["Find the cat!"],
      confirmLines: ["Cat!"],
    },
  ],
};

const mockBoardJa: logic.BingoBoard = {
  size: 3,
  cells: [
    { icon: "apple", label: "りんご" },
    { icon: "banana", label: "バナナ" },
    { icon: "cat", label: "ねこ" },
    { icon: "dog", label: "いぬ" },
    { icon: "elephant", label: "ぞう" },
    { icon: "fish", label: "さかな" },
    { icon: "guitar", label: "ギター" },
    { icon: "hat", label: "ぼうし" },
    { icon: "icecream", label: "アイスクリーム" },
  ],
  calls: [
    {
      mode: "name",
      answerIdx: 0,
      promptLines: ["さがしてね", "りんご！"],
      confirmLines: ["りんご！"],
    },
    {
      mode: "name",
      answerIdx: 1,
      promptLines: ["さがしてね", "バナナ！"],
      confirmLines: ["バナナ！"],
    },
    {
      mode: "name",
      answerIdx: 2,
      promptLines: ["さがしてね", "ねこ！"],
      confirmLines: ["ねこ！"],
    },
  ],
};

describe("Bingo mid-game language switch stale callback bug", () => {
  it("prematurely triggers WinOverlay on fresh board when cycling language after winning tile tap", async () => {
    vi.spyOn(logic, "makeBoard").mockImplementation(
      (_rng, _icons, _size, _mode, lang) =>
        lang === "ja" ? mockBoardJa : mockBoardEn,
    );

    render(<LangHarness initialLang="en" />);

    await act(async () => {
      vi.advanceTimersByTime(1000);
    });

    // Tap first tile (cell 0)
    await act(async () => {
      fireEvent.click(screen.getByTestId("bingo-cell-0"));
    });
    // Advance past confirmation for first tile
    await act(async () => {
      vi.advanceTimersByTime(9000);
    });

    // Tap second tile (cell 1)
    await act(async () => {
      fireEvent.click(screen.getByTestId("bingo-cell-1"));
    });
    // Advance past confirmation for second tile
    await act(async () => {
      vi.advanceTimersByTime(9000);
    });

    // Tap third tile (cell 2) - completes winning line [0, 1, 2]
    await act(async () => {
      fireEvent.click(screen.getByTestId("bingo-cell-2"));
    });

    // Immediately cycle language before confirmation finishes
    await act(async () => {
      fireEvent.click(screen.getByTestId("lang-cycle"));
    });

    // The new Japanese board should be fresh: 0 marked tiles, no win overlay
    expect(screen.queryByTestId("win-overlay")).toBeNull();
    expect(screen.getByTestId("bingo-score").textContent).toBe("⭐ 0");

    // Even after timers expire, win overlay must not appear
    await act(async () => {
      vi.advanceTimersByTime(9000);
    });
    expect(screen.queryByTestId("win-overlay")).toBeNull();
  });

  it("skips call 0 on new board due to stale setCallIdx callback on language switch", async () => {
    vi.spyOn(logic, "makeBoard").mockImplementation(
      (_rng, _icons, _size, _mode, lang) =>
        lang === "ja" ? mockBoardJa : mockBoardEn,
    );

    render(<LangHarness initialLang="en" />);

    await act(async () => {
      vi.advanceTimersByTime(1000);
    });

    // Tap call 0 (cell 0) - not a winning line
    await act(async () => {
      fireEvent.click(screen.getByTestId("bingo-cell-0"));
    });

    // Immediately cycle language before confirmation finishes
    await act(async () => {
      fireEvent.click(screen.getByTestId("lang-cycle"));
    });

    // Prompt on new Japanese board must still be call 0 (Apple), not call 1 (Banana)
    const prompt = screen.getByTestId("bingo-prompt");
    expect(prompt.textContent).toContain("りんご");
    expect(prompt.textContent).not.toContain("バナナ");

    // Advance timers - stale callback should not advance callIdx
    await act(async () => {
      vi.advanceTimersByTime(9000);
    });

    const promptAfter = screen.getByTestId("bingo-prompt");
    expect(promptAfter.textContent).toContain("りんご");
  });
});

