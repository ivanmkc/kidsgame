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
import { PuzzleGame, PuzzleVignette } from "./PuzzleGame";

vi.mock("react-native", async (importOriginal) => {
  const actual = await importOriginal<typeof import("react-native")>();
  return {
    ...actual,
    useWindowDimensions: () => ({ width: 828, height: 600 }),
  };
});

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

  it("renders PuzzleVignette with sun glow, diagonal shafts, and shadow for given offsets", () => {
    render(
      <PuzzleVignette
        boardW={600}
        boardH={400}
        offsetX={-200}
        offsetY={-150}
        testID="sample-vignette"
      />,
    );
    const vignette = screen.getByTestId("sample-vignette") as HTMLElement;
    expect(vignette).toBeDefined();
    // 3 sun glow elements, 2 diagonal light shafts, 3 shadow elements
    expect(vignette.children.length).toBe(8);
    expect(parseFloat(vignette.style.marginLeft)).toBeCloseTo(-200);
    expect(parseFloat(vignette.style.marginTop)).toBeCloseTo(-150);
    expect(parseFloat(vignette.style.width)).toBeCloseTo(600);
    expect(parseFloat(vignette.style.height)).toBeCloseTo(400);
  });

  it("renders subtle brightness vignette on each puzzle tile to make pieces distinct across platforms", () => {
    vi.useFakeTimers();
    render(
      <PuzzleGame
        onHome={() => {}}
        onBackToPicker={() => {}}
        onPickScene={() => {}}
        difficulty="easy"
        filter="easy"
        sceneId="d-snow"
      />,
    );

    // 6 pieces in easy difficulty (3 cols x 2 rows, board is 800x450)
    // tileW = 800 / 3 (~266.67px), tileH = 450 / 2 (225px)
    const offsets = new Set<string>();
    for (let piece = 0; piece < 6; piece++) {
      const vignette = screen.getByTestId(
        `puzzle-piece-vignette-${piece}`,
      ) as HTMLElement;
      expect(vignette).toBeDefined();
      expect(vignette.children.length).toBe(8);

      const marginLeft = parseFloat(vignette.style.marginLeft || "0");
      const marginTop = parseFloat(vignette.style.marginTop || "0");

      const pCol = piece % 3;
      const pRow = Math.floor(piece / 3);

      // Verify margin offsets match expected negative coordinates shifting the board slice
      expect(marginLeft).toBeCloseTo(-pCol * (800 / 3), 1);
      expect(marginTop).toBeCloseTo(-pRow * 225, 1);

      if (pCol > 0) {
        expect(marginLeft).toBeLessThan(0);
      }
      if (pRow > 0) {
        expect(marginTop).toBeLessThan(0);
      }

      offsets.add(`${marginLeft},${marginTop}`);
    }

    // All 6 pieces must have unique offsets so pieces never look identical
    expect(offsets.size).toBe(6);

    // Vignette is also rendered on peek preview
    fireEvent.click(screen.getByTestId("puzzle-peek"));
    const peekOverlay = screen.getByTestId("puzzle-peek-overlay");
    expect(peekOverlay).toBeDefined();
    expect(peekOverlay.nextElementSibling).not.toBeNull();
    vi.useRealTimers();
  });

  it("renders distinct offsets for all 12 tiles on hard 4x3 grid including middle and mirror tiles", () => {
    vi.useFakeTimers();
    render(
      <PuzzleGame
        onHome={() => {}}
        onBackToPicker={() => {}}
        onPickScene={() => {}}
        difficulty="hard"
        filter="hard"
        sceneId="d-snow"
      />,
    );

    // 12 pieces in hard difficulty (4 cols x 3 rows, board is 800x450)
    // tileW = 800 / 4 = 200px, tileH = 450 / 3 = 150px
    const offsets = new Set<string>();
    const pieceOffsets: Array<{ left: number; top: number }> = [];

    for (let piece = 0; piece < 12; piece++) {
      const vignette = screen.getByTestId(
        `puzzle-piece-vignette-${piece}`,
      ) as HTMLElement;
      expect(vignette).toBeDefined();
      expect(vignette.children.length).toBe(8);

      const marginLeft = parseFloat(vignette.style.marginLeft || "0");
      const marginTop = parseFloat(vignette.style.marginTop || "0");

      const pCol = piece % 4;
      const pRow = Math.floor(piece / 4);

      expect(marginLeft).toBeCloseTo(-pCol * 200, 1);
      expect(marginTop).toBeCloseTo(-pRow * 150, 1);

      offsets.add(`${marginLeft},${marginTop}`);
      pieceOffsets.push({ left: marginLeft, top: marginTop });
    }

    // All 12 pieces must receive strictly unique offsets
    expect(offsets.size).toBe(12);

    // Top-row sky middle tiles (1,0) and (2,0) must have different horizontal offsets
    expect(pieceOffsets[1].left).not.toBe(pieceOffsets[2].left);
    expect(pieceOffsets[1].left).toBeCloseTo(-200);
    expect(pieceOffsets[2].left).toBeCloseTo(-400);

    // Middle-row tiles (1,1) and (2,1) must also have different horizontal offsets
    expect(pieceOffsets[5].left).not.toBe(pieceOffsets[6].left);
    expect(pieceOffsets[5].left).toBeCloseTo(-200);
    expect(pieceOffsets[6].left).toBeCloseTo(-400);

    vi.useRealTimers();
  });
});
