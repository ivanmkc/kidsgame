// @vitest-environment happy-dom
import React, { useState } from "react";
import { LangContext } from "../../../components/GameShell";
import { Lang } from "../../../lang";
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { t } from "../../../i18n";
import * as sound from "../../../sound";
import { sfx } from "../../../sound";
import { nextSceneId } from "../../../difficulty";
import { allSceneOptions } from "../../sceneOptions";
import { PuzzleGame } from "../PuzzleGame";
import * as logic from "../logic";

describe("PuzzleGame", () => {
  const noop = () => {};
  const sceneId = allSceneOptions()[0].id;

  beforeEach(() => {
    vi.restoreAllMocks();
    vi.spyOn(sound, "say").mockImplementation(() => {});
    vi.spyOn(sound.sfx, "tap").mockImplementation(() => {});
    vi.spyOn(sound.sfx, "win").mockImplementation(() => {});
    vi.spyOn(sound.sfx, "good").mockImplementation(() => {});
    vi.spyOn(sound.sfx, "flip").mockImplementation(() => {});
  });

  afterEach(() => {
    cleanup();
  });

  it("renders the scene picker when no scene is selected", () => {
    render(
      <PuzzleGame
        onHome={noop}
        difficulty="easy"
        onPickScene={noop}
        onBackToPicker={noop}
        lang="en"
      />,
    );
    expect(screen.getByTestId("scene-surprise")).toBeTruthy();
    expect(screen.queryByTestId("puzzle-peek")).toBeNull();
  });

  it("launches puzzle when a dimmed scene outside the active filter is picked", () => {
    // Farm is a medium-difficulty scene ('d-farm'), dimmed when filter='easy'
    render(
      <PuzzleGame
        onHome={noop}
        difficulty="easy"
        filter="easy"
        sceneId="d-farm"
        onPickScene={noop}
        onBackToPicker={noop}
      />,
    );
    expect(screen.getByTestId("puzzle-peek")).toBeTruthy();
    expect(screen.queryByTestId("scene-surprise")).toBeNull();
  });

  it("progresses to nextSceneId when Next Level is tapped on a dimmed scene outside active filter", () => {
    vi.useFakeTimers();
    vi.spyOn(logic, "makePuzzle").mockReturnValue([0, 1, 2, 3, 4, 5]);
    const onPickScene = vi.fn();

    render(
      <PuzzleGame
        onHome={noop}
        difficulty="easy"
        filter="easy"
        sceneId="d-farm"
        onPickScene={onPickScene}
        onBackToPicker={noop}
      />,
    );

    act(() => {
      vi.advanceTimersByTime(1000);
    });

    const nextBtn = screen.getByTestId("play-again");
    expect(nextBtn).toBeTruthy();
    fireEvent.click(nextBtn);

    const all = allSceneOptions("all");
    const visible = allSceneOptions("easy");
    expect(onPickScene).toHaveBeenCalledWith(
      nextSceneId(all, visible, "d-farm"),
    );
    expect(onPickScene).toHaveBeenCalledWith("d-ocean");
    expect(onPickScene).not.toHaveBeenCalledWith("d-dinos");
    vi.useRealTimers();
  });

  it("progresses to nextSceneId within active filter when Next Level is tapped", () => {
    vi.useFakeTimers();
    vi.spyOn(logic, "makePuzzle").mockReturnValue([0, 1, 2, 3, 4, 5]);
    const onPickScene = vi.fn();

    render(
      <PuzzleGame
        onHome={noop}
        difficulty="easy"
        filter="easy"
        sceneId="d-dinos"
        onPickScene={onPickScene}
        onBackToPicker={noop}
      />,
    );

    act(() => {
      vi.advanceTimersByTime(1000);
    });

    const nextBtn = screen.getByTestId("play-again");
    expect(nextBtn).toBeTruthy();
    fireEvent.click(nextBtn);

    const all = allSceneOptions("all");
    const visible = allSceneOptions("easy");
    expect(onPickScene).toHaveBeenCalledWith(
      nextSceneId(all, visible, "d-dinos"),
    );
    vi.useRealTimers();
  });

  it("launches puzzle when a matching scene is picked", () => {
    render(
      <PuzzleGame
        onHome={noop}
        difficulty="easy"
        filter="easy"
        sceneId="d-dinos"
        onPickScene={noop}
        onBackToPicker={noop}
      />,
    );
    expect(screen.getByTestId("puzzle-peek")).toBeTruthy();
    expect(screen.queryByTestId("scene-surprise")).toBeNull();
  });

  it("renders 6 tiles and no timer for an easy scene under the all filter", () => {
    render(
      <PuzzleGame
        onHome={noop}
        difficulty="medium"
        filter="all"
        sceneId="d-dinos"
        onPickScene={noop}
        onBackToPicker={noop}
        lang="en"
      />,
    );
    expect(screen.getAllByTestId(/^puzzle-tile-/)).toHaveLength(6);
    expect(screen.queryByTestId("puzzle-timer")).toBeNull();
  });

  it("renders 12 tiles and a timer for a hard scene under the all filter", () => {
    render(
      <PuzzleGame
        onHome={noop}
        difficulty="medium"
        filter="all"
        sceneId="d-princess"
        onPickScene={noop}
        onBackToPicker={noop}
        lang="en"
      />,
    );
    expect(screen.getAllByTestId(/^puzzle-tile-/)).toHaveLength(12);
    expect(screen.getByTestId("puzzle-timer")).toBeTruthy();
  });

  it("renders 9 tiles and a timer for a medium scene under the all filter", () => {
    render(
      <PuzzleGame
        onHome={noop}
        difficulty="medium"
        filter="all"
        sceneId="d-unicorn"
        onPickScene={noop}
        onBackToPicker={noop}
        lang="en"
      />,
    );
    expect(screen.getAllByTestId(/^puzzle-tile-/)).toHaveLength(9);
    expect(screen.getByTestId("puzzle-timer")).toBeTruthy();
    for (let pos = 0; pos < 9; pos++) {
      const tile = screen.getByTestId(new RegExp(`^puzzle-tile-${pos}-`));
      const col = (pos % 3) + 1;
      const row = Math.floor(pos / 3) + 1;
      expect(tile.getAttribute("role")).toBe("button");
      expect(tile.getAttribute("aria-label")).toBe(
        t("en", "puzzle.tileA11y", { row, col }),
      );
    }
  });

  it("allows swapping tiles and increments moves counter", () => {
    render(
      <PuzzleGame
        onHome={noop}
        difficulty="medium"
        filter="all"
        sceneId="d-dinos"
        onPickScene={noop}
        onBackToPicker={noop}
        lang="en"
      />,
    );
    expect(screen.getByTestId("puzzle-moves").textContent).toContain("0");
    const tiles = screen.getAllByTestId(/^puzzle-tile-/);
    fireEvent.click(tiles[0]);
    fireEvent.click(tiles[1]);
    expect(screen.getByTestId("puzzle-moves").textContent).toContain("1");
  });

  it("shows peek overlay when peek button is tapped", () => {
    render(
      <PuzzleGame
        onHome={noop}
        difficulty="medium"
        filter="all"
        sceneId="d-dinos"
        onPickScene={noop}
        onBackToPicker={noop}
        lang="en"
      />,
    );
    expect(screen.queryByTestId("puzzle-peek-overlay")).toBeNull();
    fireEvent.click(screen.getByTestId("puzzle-peek"));
    expect(screen.getByTestId("puzzle-peek-overlay")).toBeTruthy();
  });

  it("renders peek button with English accessibility label", () => {
    const { unmount } = render(
      <PuzzleGame
        onHome={noop}
        difficulty="easy"
        sceneId={sceneId}
        onPickScene={noop}
        onBackToPicker={noop}
        lang="en"
      />,
    );

    const peekBtn = screen.getByTestId("puzzle-peek");
    expect(peekBtn.getAttribute("role")).toBe("button");
    expect(peekBtn.getAttribute("aria-label")).toBe(t("en", "puzzle.peekA11y"));
    expect(peekBtn.getAttribute("aria-label")).toBe(
      "Peek at the finished picture",
    );
    unmount();
  });

  it("renders peek button with localized accessibility label in Japanese", () => {
    const { unmount } = render(
      <PuzzleGame
        onHome={noop}
        difficulty="easy"
        sceneId={sceneId}
        onPickScene={noop}
        onBackToPicker={noop}
        lang="ja"
      />,
    );

    const peekBtn = screen.getByTestId("puzzle-peek");
    expect(peekBtn.getAttribute("role")).toBe("button");
    expect(peekBtn.getAttribute("aria-label")).toBe(t("ja", "puzzle.peekA11y"));
    expect(peekBtn.getAttribute("aria-label")).toBe(
      "かんせいした えを ちらっとみる",
    );
    const tile0 = screen.getByTestId(/^puzzle-tile-0-/);
    expect(tile0.getAttribute("role")).toBe("button");
    expect(tile0.getAttribute("aria-label")).toBe(
      t("ja", "puzzle.tileA11y", { row: 1, col: 1 }),
    );
    unmount();
  });

  it("renders peek button with localized accessibility label in Mandarin and Cantonese", () => {
    const { unmount: unmountCmn } = render(
      <PuzzleGame
        onHome={noop}
        difficulty="easy"
        sceneId={sceneId}
        onPickScene={noop}
        onBackToPicker={noop}
        lang="cmn"
      />,
    );
    expect(screen.getByTestId("puzzle-peek").getAttribute("aria-label")).toBe(
      t("cmn", "puzzle.peekA11y"),
    );
    expect(
      screen.getByTestId(/^puzzle-tile-0-/).getAttribute("aria-label"),
    ).toBe(t("cmn", "puzzle.tileA11y", { row: 1, col: 1 }));
    unmountCmn();

    const { unmount: unmountYue } = render(
      <PuzzleGame
        onHome={noop}
        difficulty="easy"
        sceneId={sceneId}
        onPickScene={noop}
        onBackToPicker={noop}
        lang="yue"
      />,
    );
    expect(screen.getByTestId("puzzle-peek").getAttribute("aria-label")).toBe(
      t("yue", "puzzle.peekA11y"),
    );
    expect(
      screen.getByTestId(/^puzzle-tile-0-/).getAttribute("aria-label"),
    ).toBe(t("yue", "puzzle.tileA11y", { row: 1, col: 1 }));
    unmountYue();
  });

  it("renders FilterCycleChip with localized text and accessibility label in scene picker", () => {
    const onFilter = vi.fn();
    const { unmount: unmountJa } = render(
      <PuzzleGame
        onHome={noop}
        difficulty="easy"
        filter="easy"
        onFilter={onFilter}
        onPickScene={noop}
        onBackToPicker={noop}
        lang="ja"
      />,
    );

    const jaFilterBtn = screen.getByTestId("difficulty-cycle");
    expect(jaFilterBtn.textContent).toBe(`😊 ${t("ja", "filter.easy")}`);
    expect(jaFilterBtn.textContent).toBe("😊 やさしい");
    expect(jaFilterBtn.getAttribute("aria-label")).toBe(
      "むずかしさ: やさしい。タップでかえる",
    );
    fireEvent.click(jaFilterBtn);
    expect(onFilter).toHaveBeenCalledWith("medium");
    unmountJa();

    const { unmount: unmountCmn } = render(
      <PuzzleGame
        onHome={noop}
        difficulty="easy"
        filter="easy"
        onFilter={onFilter}
        onPickScene={noop}
        onBackToPicker={noop}
        lang="cmn"
      />,
    );
    const cmnFilterBtn = screen.getByTestId("difficulty-cycle");
    expect(cmnFilterBtn.textContent).toBe(`😊 ${t("cmn", "filter.easy")}`);
    expect(cmnFilterBtn.getAttribute("aria-label")).toBe(
      t("cmn", "a11y.diffCycle", { name: t("cmn", "filter.easy") }),
    );
    unmountCmn();

    const { unmount: unmountYue } = render(
      <PuzzleGame
        onHome={noop}
        difficulty="easy"
        filter="easy"
        onFilter={onFilter}
        onPickScene={noop}
        onBackToPicker={noop}
        lang="yue"
      />,
    );
    const yueFilterBtn = screen.getByTestId("difficulty-cycle");
    expect(yueFilterBtn.textContent).toBe(`😊 ${t("yue", "filter.easy")}`);
    expect(yueFilterBtn.getAttribute("aria-label")).toBe(
      t("yue", "a11y.diffCycle", { name: t("yue", "filter.easy") }),
    );
    unmountYue();
  });

  it("plays tap sound when peek button is clicked", () => {
    const tapSpy = vi.spyOn(sfx, "tap").mockReturnValue();
    const { unmount } = render(
      <PuzzleGame
        onHome={noop}
        difficulty="easy"
        sceneId={sceneId}
        onPickScene={noop}
        onBackToPicker={noop}
        lang="en"
      />,
    );

    const peekBtn = screen.getByTestId("puzzle-peek");
    fireEvent.click(peekBtn);
    expect(tapSpy).toHaveBeenCalled();
    tapSpy.mockRestore();
    unmount();
  });

  it("speaks localized prompts for scene picker and puzzle board", () => {
    const useSaySpy = vi.spyOn(sound, "useSay");
    const { unmount } = render(
      <PuzzleGame
        onHome={noop}
        difficulty="medium"
        onPickScene={noop}
        onBackToPicker={noop}
        lang="ja"
      />,
    );
    expect(useSaySpy).toHaveBeenCalledWith("どの えを ときたい？");

    unmount();

    render(
      <PuzzleGame
        onHome={noop}
        difficulty="medium"
        sceneId="d-dinos"
        onPickScene={noop}
        onBackToPicker={noop}
        lang="ja"
      />,
    );
    expect(useSaySpy).toHaveBeenCalledWith(
      "1まい タップして、もう1まい タップして いれかえよう！",
    );
  });

  it("swaps tiles when tapped in rapid succession before re-render", () => {
    vi.spyOn(logic, "makePuzzle").mockReturnValue([1, 0, 2, 3, 4, 5]);

    render(
      <PuzzleGame
        onHome={noop}
        difficulty="easy"
        sceneId={sceneId}
        onPickScene={noop}
        onBackToPicker={noop}
        lang="en"
      />,
    );

    const tile0 = screen.getByTestId("puzzle-tile-0-piece-1");
    const tile1 = screen.getByTestId("puzzle-tile-1-piece-0");

    // Rapid successive taps inside the same execution frame / batch
    act(() => {
      fireEvent.click(tile0);
      fireEvent.click(tile1);
    });

    // Both tiles should have swapped positions
    expect(screen.queryByTestId("puzzle-tile-0-piece-0")).not.toBeNull();
    expect(screen.queryByTestId("puzzle-tile-1-piece-1")).not.toBeNull();
    expect(screen.getByTestId("puzzle-moves").textContent).toContain("1");
  });

  it("deselects tile when same tile is tapped rapidly before re-render", () => {
    vi.spyOn(logic, "makePuzzle").mockReturnValue([1, 0, 2, 3, 4, 5]);

    render(
      <PuzzleGame
        onHome={noop}
        difficulty="easy"
        sceneId={sceneId}
        onPickScene={noop}
        onBackToPicker={noop}
        lang="en"
      />,
    );

    const tile0 = screen.getByTestId("puzzle-tile-0-piece-1");

    // Rapid double-tap on the same tile deselects it
    act(() => {
      fireEvent.click(tile0);
      fireEvent.click(tile0);
    });

    // No swap occurred and moves stayed 0
    expect(screen.queryByTestId("puzzle-tile-0-piece-1")).not.toBeNull();
    expect(screen.getByTestId("puzzle-moves").textContent).toContain("0");

    // Subsequent tap on tile 1 selects tile 1 rather than swapping with tile 0
    const tile1 = screen.getByTestId("puzzle-tile-1-piece-0");
    fireEvent.click(tile1);
    expect(screen.getByTestId("puzzle-moves").textContent).toContain("0");
  });

  it("handles multiple rapid swaps in sequence", () => {
    vi.spyOn(logic, "makePuzzle").mockReturnValue([1, 0, 3, 2, 4, 5]);

    render(
      <PuzzleGame
        onHome={noop}
        difficulty="easy"
        sceneId={sceneId}
        onPickScene={noop}
        onBackToPicker={noop}
        lang="en"
      />,
    );

    const tile0 = screen.getByTestId("puzzle-tile-0-piece-1");
    const tile1 = screen.getByTestId("puzzle-tile-1-piece-0");
    const tile2 = screen.getByTestId("puzzle-tile-2-piece-3");
    const tile3 = screen.getByTestId("puzzle-tile-3-piece-2");

    act(() => {
      fireEvent.click(tile0);
      fireEvent.click(tile1);
      fireEvent.click(tile2);
      fireEvent.click(tile3);
    });

    expect(screen.queryByTestId("puzzle-tile-0-piece-0")).not.toBeNull();
    expect(screen.queryByTestId("puzzle-tile-1-piece-1")).not.toBeNull();
    expect(screen.queryByTestId("puzzle-tile-2-piece-2")).not.toBeNull();
    expect(screen.queryByTestId("puzzle-tile-3-piece-3")).not.toBeNull();
    expect(screen.getByTestId("puzzle-moves").textContent).toContain("2");
  });

  it("swaps tiles on standard spaced taps", () => {
    vi.spyOn(logic, "makePuzzle").mockReturnValue([1, 0, 2, 3, 4, 5]);

    render(
      <PuzzleGame
        onHome={noop}
        difficulty="easy"
        sceneId={sceneId}
        onPickScene={noop}
        onBackToPicker={noop}
        lang="en"
      />,
    );

    fireEvent.click(screen.getByTestId("puzzle-tile-0-piece-1"));
    fireEvent.click(screen.getByTestId("puzzle-tile-1-piece-0"));

    expect(screen.queryByTestId("puzzle-tile-0-piece-0")).not.toBeNull();
    expect(screen.queryByTestId("puzzle-tile-1-piece-1")).not.toBeNull();
    expect(screen.getByTestId("puzzle-moves").textContent).toContain("1");
  });

  it("plays tap sound on tile selection and deselection", () => {
    vi.spyOn(logic, "makePuzzle").mockReturnValue([1, 0, 2, 3, 4, 5]);
    const tapSpy = vi.spyOn(sound.sfx, "tap");

    render(
      <PuzzleGame
        onHome={noop}
        difficulty="easy"
        sceneId={sceneId}
        onPickScene={noop}
        onBackToPicker={noop}
        lang="en"
      />,
    );

    const tile0 = screen.getByTestId("puzzle-tile-0-piece-1");

    tapSpy.mockClear();
    fireEvent.click(tile0);
    expect(tapSpy).toHaveBeenCalledTimes(1);

    fireEvent.click(tile0);
    expect(tapSpy).toHaveBeenCalledTimes(2);
  });

  it("plays good sound when a swapped piece lands in its solved index, and flip sound otherwise", () => {
    vi.spyOn(logic, "makePuzzle").mockReturnValue([2, 3, 0, 1, 4, 5]);
    const goodSpy = vi.spyOn(sound.sfx, "good");
    const flipSpy = vi.spyOn(sound.sfx, "flip");

    render(
      <PuzzleGame
        onHome={noop}
        difficulty="easy"
        sceneId={sceneId}
        onPickScene={noop}
        onBackToPicker={noop}
        lang="en"
      />,
    );

    // Swap tile 0 (piece 2) and tile 1 (piece 3) -> [3, 2, 0, 1, 4, 5], neither at solved index
    fireEvent.click(screen.getByTestId("puzzle-tile-0-piece-2"));
    fireEvent.click(screen.getByTestId("puzzle-tile-1-piece-3"));

    expect(flipSpy).toHaveBeenCalledTimes(1);
    expect(goodSpy).not.toHaveBeenCalled();

    // Swap tile 2 (piece 0) and tile 0 (piece 3) -> [0, 2, 3, 1, 4, 5], piece 0 lands in solved index 0
    fireEvent.click(screen.getByTestId("puzzle-tile-2-piece-0"));
    fireEvent.click(screen.getByTestId("puzzle-tile-0-piece-3"));

    expect(goodSpy).toHaveBeenCalledTimes(1);
  });

  it("resolves localized scene names in allSceneOptions for diff and hidden scenes", () => {
    const enOptions = allSceneOptions("all", "en");
    expect(enOptions.find((o) => o.id === "d-dinos")?.name).toBe(
      "Dinosaur Valley",
    );
    expect(enOptions.find((o) => o.id === "h-jungle")?.name).toBe("Jungle");

    const jaOptions = allSceneOptions("all", "ja");
    expect(jaOptions.find((o) => o.id === "d-dinos")?.name).toBe(
      "きょうりゅう の たに",
    );
    expect(jaOptions.find((o) => o.id === "h-jungle")?.name).toBe("ジャングル");

    const cmnOptions = allSceneOptions("all", "cmn");
    expect(cmnOptions.find((o) => o.id === "d-dinos")?.name).toBe("恐龙山谷");
    expect(cmnOptions.find((o) => o.id === "h-jungle")?.name).toBe("丛林");

    const yueOptions = allSceneOptions("all", "yue");
    expect(yueOptions.find((o) => o.id === "d-dinos")?.name).toBe("恐龍山谷");
    expect(yueOptions.find((o) => o.id === "h-jungle")?.name).toBe("森林");
  });

  it("displays localized scene names on picker cards and gameplay subtitle in ja, cmn, and yue", () => {
    // 1. Scene picker cards show localized names and not English names
    const { unmount: unmountPickerJa } = render(
      <PuzzleGame
        onHome={noop}
        difficulty="easy"
        onPickScene={noop}
        onBackToPicker={noop}
        lang="ja"
      />,
    );
    expect(screen.getByText("きょうりゅう の たに")).toBeTruthy();
    expect(screen.getByText("ジャングル")).toBeTruthy();
    expect(screen.queryByText("Dinosaur Valley")).toBeNull();
    expect(screen.queryByText("Jungle")).toBeNull();
    unmountPickerJa();

    const { unmount: unmountPickerCmn } = render(
      <PuzzleGame
        onHome={noop}
        difficulty="easy"
        onPickScene={noop}
        onBackToPicker={noop}
        lang="cmn"
      />,
    );
    expect(screen.getByText("恐龙山谷")).toBeTruthy();
    expect(screen.getByText("丛林")).toBeTruthy();
    expect(screen.queryByText("Dinosaur Valley")).toBeNull();
    expect(screen.queryByText("Jungle")).toBeNull();
    unmountPickerCmn();

    const { unmount: unmountPickerYue } = render(
      <PuzzleGame
        onHome={noop}
        difficulty="easy"
        onPickScene={noop}
        onBackToPicker={noop}
        lang="yue"
      />,
    );
    expect(screen.getByText("恐龍山谷")).toBeTruthy();
    expect(screen.getByText("森林")).toBeTruthy();
    expect(screen.queryByText("Dinosaur Valley")).toBeNull();
    expect(screen.queryByText("Jungle")).toBeNull();
    unmountPickerYue();

    // 2. Gameplay header subtitle displays localized scene name
    const { unmount: unmountGameJa } = render(
      <PuzzleGame
        onHome={noop}
        difficulty="easy"
        sceneId="d-dinos"
        onPickScene={noop}
        onBackToPicker={noop}
        lang="ja"
      />,
    );
    expect(
      screen.getByText(
        "きょうりゅう の たに — 2まいを タップして いれかえよう",
      ),
    ).toBeTruthy();
    expect(
      screen.queryByText("Dinosaur Valley — 2まいを タップして いれかえよう"),
    ).toBeNull();
    unmountGameJa();

    const { unmount: unmountGameCmn } = render(
      <PuzzleGame
        onHome={noop}
        difficulty="easy"
        sceneId="d-dinos"
        onPickScene={noop}
        onBackToPicker={noop}
        lang="cmn"
      />,
    );
    expect(screen.getByText("恐龙山谷 — 点两块交换位置")).toBeTruthy();
    unmountGameCmn();

    const { unmount: unmountGameYue } = render(
      <PuzzleGame
        onHome={noop}
        difficulty="easy"
        sceneId="d-dinos"
        onPickScene={noop}
        onBackToPicker={noop}
        lang="yue"
      />,
    );
    expect(screen.getByText("恐龍山谷 — 撳兩塊調位")).toBeTruthy();
    unmountGameYue();

    // Also verify hidden scene subtitle in ja
    const { unmount: unmountHiddenJa } = render(
      <PuzzleGame
        onHome={noop}
        difficulty="easy"
        sceneId="h-jungle"
        onPickScene={noop}
        onBackToPicker={noop}
        lang="ja"
      />,
    );
    expect(
      screen.getByText("ジャングル — 2まいを タップして いれかえよう"),
    ).toBeTruthy();
    unmountHiddenJa();
  });

  it("does not speak gameplay instruction hint when switching languages on victory screen", () => {
    vi.spyOn(logic, "makePuzzle").mockReturnValue([0, 1, 2, 3, 4, 5]);
    const saySpy = vi.spyOn(sound, "say");
    const useSaySpy = vi.spyOn(sound, "useSay");

    function LangHarness({ initialLang = "en" }: { initialLang?: Lang }) {
      const [lang, setLang] = useState<Lang>(initialLang);
      const cycleLang = () => {
        setLang((l) =>
          l === "en" ? "ja" : l === "ja" ? "cmn" : l === "cmn" ? "yue" : "en",
        );
      };
      return (
        <LangContext.Provider value={{ lang, onCycle: cycleLang }}>
          <PuzzleGame
            onHome={noop}
            difficulty="easy"
            sceneId="d-dinos"
            onPickScene={noop}
            onBackToPicker={noop}
            lang={lang}
          />
        </LangContext.Provider>
      );
    }

    render(<LangHarness initialLang="en" />);

    // Initial mount with solved puzzle speaks win message
    expect(saySpy).toHaveBeenCalledWith(t("en", "win.puzzle"));

    // Verify victory screen (WinOverlay) is visible
    expect(screen.getByTestId("play-again")).toBeTruthy();

    saySpy.mockClear();
    useSaySpy.mockClear();

    // Tap language cycle button to switch from English to Japanese
    const langBtn = screen.getByTestId("lang-cycle");
    fireEvent.click(langBtn);

    // useSay should be called with null when won is true, not the gameplay hint
    expect(useSaySpy).toHaveBeenCalledWith(null);
    expect(saySpy).not.toHaveBeenCalledWith(t("ja", "puzzle.hint"));
  });
});
