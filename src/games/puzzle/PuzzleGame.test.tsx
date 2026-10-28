import { describe, it, expect, vi, afterEach } from "vitest";
// @vitest-environment happy-dom
import React from "react";
import {
  render,
  screen,
  fireEvent,
  act,
  cleanup,
} from "@testing-library/react";
import { PuzzleGame } from "./PuzzleGame";

vi.mock("../../sound", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../sound")>();
  return {
    ...actual,
    say: vi.fn(),
    sfx: {
      ...actual.sfx,
      tap: vi.fn(),
      good: vi.fn(),
      flip: vi.fn(),
      correct: vi.fn(),
      win: vi.fn(),
    },
  };
});

describe("PuzzleGame", () => {
  afterEach(() => {
    cleanup();
    vi.clearAllTimers();
  });

  it("renders picker when no sceneId is provided", () => {
    const onPickScene = vi.fn();
    render(
      <PuzzleGame
        onHome={() => {}}
        onBackToPicker={() => {}}
        onPickScene={onPickScene}
        difficulty="easy"
        filter="easy"
      />,
    );
    expect(screen.getByText("Choose a picture")).toBeDefined();
    expect(screen.getByText("Picture Puzzle")).toBeDefined();
  });

  it("renders board and handles interactions", () => {
    vi.useFakeTimers();
    const randomSpy = vi.spyOn(Math, "random").mockReturnValue(0.12345);
    const onPickScene = vi.fn();
    render(
      <PuzzleGame
        onHome={() => {}}
        onBackToPicker={() => {}}
        onPickScene={onPickScene}
        difficulty="medium"
        sceneId="d-farm"
      />,
    );

    const peekBtn = screen.getByTestId("puzzle-peek");
    fireEvent.click(peekBtn);
    expect(screen.getByTestId("puzzle-peek-overlay")).toBeDefined();

    act(() => {
      vi.advanceTimersByTime(3000);
    });
    expect(screen.queryByTestId("puzzle-peek-overlay")).toBeNull();

    const tiles = screen.getAllByTestId(/puzzle-tile-\d+-piece-\d+/);
    expect(tiles).toHaveLength(9);
    for (let pos = 0; pos < 9; pos++) {
      const tile = screen.getByTestId(new RegExp(`^puzzle-tile-${pos}-`));
      const col = (pos % 3) + 1;
      const row = Math.floor(pos / 3) + 1;
      expect(tile.getAttribute("role")).toBe("button");
      expect(tile.getAttribute("aria-label")).toBe(
        `Puzzle piece row ${row}, column ${col}`,
      );
    }

    fireEvent.click(tiles[0]);
    fireEvent.click(tiles[1]);

    expect(screen.getByTestId("puzzle-moves").textContent).toContain("🧩 1");

    // Press same tile twice
    fireEvent.click(tiles[2]);
    fireEvent.click(tiles[2]); // unselects
    // Pressing another doesn't swap with 2
    fireEvent.click(tiles[3]);
    fireEvent.click(tiles[4]);
    expect(screen.getByTestId("puzzle-moves").textContent).toContain("🧩 2");

    // Solve it
    // First, let's map pieces to their positions
    const getPieces = () => {
      const arr: number[] = [];
      for (const t of screen.getAllByTestId(/puzzle-tile-\d+-piece-\d+/)) {
        const testId = t.getAttribute("data-testid");
        if (!testId) continue;
        const match = testId.match(/puzzle-tile-(\d+)-piece-(\d+)/);
        if (match) {
          arr[Number(match[1])] = Number(match[2]);
        }
      }
      return arr;
    };

    // Bubble sort or selection sort manually by firing clicks
    for (let i = 0; i < 9; i++) {
      let arr = getPieces();
      if (arr[i] !== i) {
        const targetPos = arr.indexOf(i);
        const tile1 = screen.getByTestId(`puzzle-tile-${i}-piece-${arr[i]}`);
        const tile2 = screen.getByTestId(
          `puzzle-tile-${targetPos}-piece-${arr[targetPos]}`,
        );
        fireEvent.click(tile1);
        fireEvent.click(tile2);
      }
    }

    // Now it should be won
    expect(screen.getByText("Puzzle master! Amazing!")).toBeDefined();

    vi.useRealTimers();
    randomSpy.mockRestore();
  });

  it("clears peek timeout on unmount", () => {
    vi.useFakeTimers();
    const { unmount } = render(
      <PuzzleGame
        onHome={() => {}}
        onBackToPicker={() => {}}
        onPickScene={() => {}}
        difficulty="easy"
        filter="easy"
        sceneId="d-farm"
      />,
    );
    fireEvent.click(screen.getByTestId("puzzle-peek"));
    unmount();
    // if timer was not cleared, it might error after unmount. Since it's cleaned up, it won't.
    vi.runAllTimers();
    vi.useRealTimers();
  });
});
